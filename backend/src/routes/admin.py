"""
src/routes/admin.py
===================
Admin Paneli ve Denetim İzi (Audit Log) Blueprint
/api/admin prefix'i ile çalışır.

Endpoints:
  PUT    /api/admin/users/<user_id>/status              → Kullanıcıyı engelle/kaldır
  PUT    /api/admin/groups/<group_id>/approve           → Grubu onayla
  DELETE /api/admin/messages/<message_id>               → Mesajı soft-delete yap
  DELETE /api/admin/expenses/<group_id>/<expense_id>    → Harcamayı soft-delete yap
  GET    /api/admin/reports                             → Şikayetleri listele
  GET    /api/admin/audit-logs                          → Denetim izlerini listele

Kurallar:
  - Tüm rotalar @protected ve @role_required(GlobalRole.ADMIN) ile korunur.
  - Veriyi değiştiren her işlem (PUT, DELETE) AuditLog tablosuna kaydedilir.
"""

import json
from datetime import date, datetime, timezone
from pathlib import Path

import structlog
from sanic import Blueprint, Request
from sanic.exceptions import BadRequest, NotFound
from sanic.response import HTTPResponse, json as sanic_json
from sqlalchemy import select, case

from src.database import get_session
from src.models import (
    AuditLog,
    Expense,
    GlobalRole,
    Group,
    GroupMember,
    Message,
    Report,
    ReportStatus,
    User,
)
from src.routes.expenses import (
    ALLOWED_MIME_TYPES,
    EXTENSION_TO_MIME,
    MAX_RECEIPT_SIZE,
    _detect_mime,
    _save_receipt,
)
from src.services.security import protected, role_required

logger = structlog.get_logger(__name__)

admin_bp = Blueprint("admin", url_prefix="/api/admin")


# =============================================================================
# Helpers
# =============================================================================

async def _create_audit_log(
    session, admin_id: int, process: str, content: dict | str
) -> None:
    """Verilen işlem için AuditLog tablosuna kayıt ekler."""
    if isinstance(content, dict):
        content_str = json.dumps(content, ensure_ascii=False)
    else:
        content_str = str(content)

    log_entry = AuditLog(
        admin_id=admin_id,
        process_performed=process,
        content=content_str,
    )
    session.add(log_entry)
    # session flush / commit işlemi ana akış tarafından yönetilecek


def _build_report_response(report: Report) -> dict:
    return {
        "id": report.id,
        "reporter_id": report.reporter_id,
        "reported_message_id": report.reported_message_id,
        "reported_user_id": report.reported_user_id,
        "aciklama": report.aciklama,
        "status": report.status.value,
        "created_at": report.created_at.isoformat() if report.created_at else None,
    }


def _build_audit_log_response(log: AuditLog) -> dict:
    return {
        "id": log.id,
        "admin_id": log.admin_id,
        "process_performed": log.process_performed,
        "content": log.content,
        "timestamp": log.timestamp.isoformat() if log.timestamp else None,
    }


# =============================================================================
# ENDPOINT 1: PUT /api/admin/users/<user_id>/status — Engelle/Kaldır
# =============================================================================

@admin_bp.put("/users/<user_id:int>/status")
@protected
@role_required(GlobalRole.ADMIN)
async def toggle_user_status(request: Request, user_id: int) -> HTTPResponse:
    """
    Kullanıcının is_active durumunu tersine çevirir (engelle / engeli kaldır).
    Kendini engellemeye izin verilmez.
    """
    admin_id: int = int(request.ctx.user["sub"])

    if admin_id == user_id:
        raise BadRequest("Kendi hesabınızın durumunu değiştiremezsiniz.")

    async with get_session() as session:
        stmt = select(User).where(User.id == user_id, User.deleted_at.is_(None))
        user = await session.scalar(stmt)

        if not user:
            raise NotFound(f"Kullanıcı bulunamadı (id={user_id}).")

        # Durumu tersine çevir
        user.is_active = not user.is_active
        new_status = "ACTIVE" if user.is_active else "BLOCKED"

        # Audit Log
        await _create_audit_log(
            session,
            admin_id=admin_id,
            process="USER_STATUS_TOGGLE",
            content={"user_id": user_id, "new_status": new_status},
        )

        logger.info(
            "admin.user_status_changed",
            admin_id=admin_id,
            target_user=user_id,
            new_status=new_status,
        )

        return sanic_json(
            {
                "message": f"Kullanıcı durumu güncellendi: {new_status}",
                "user_id": user_id,
                "is_active": user.is_active,
            },
            status=200,
        )


# =============================================================================
# ENDPOINT 2: PUT /api/admin/groups/<group_id>/approve — Grup Onayla
# =============================================================================

@admin_bp.put("/groups/<group_id:int>/approve")
@protected
@role_required(GlobalRole.ADMIN)
async def approve_group(request: Request, group_id: int) -> HTTPResponse:
    """
    Kullanıcıların oluşturduğu grubu onaylar (is_approved=True).
    Zaten onaylıysa hata dönmez, 200 döner (idempotency).
    """
    admin_id: int = int(request.ctx.user["sub"])

    async with get_session() as session:
        stmt = select(Group).where(Group.id == group_id)
        group = await session.scalar(stmt)

        if not group:
            raise NotFound(f"Grup bulunamadı (id={group_id}).")

        if group.is_approved:
            return sanic_json({"message": "Grup zaten onaylı."}, status=200)

        group.is_approved = True

        # Audit Log
        await _create_audit_log(
            session,
            admin_id=admin_id,
            process="GROUP_APPROVE",
            content={"group_id": group_id, "group_name": group.name},
        )

        logger.info("admin.group_approved", admin_id=admin_id, group_id=group_id)

        return sanic_json(
            {"message": f"Grup (id={group_id}) başarıyla onaylandı."},
            status=200,
        )


# =============================================================================
# ENDPOINT 3: DELETE /api/admin/messages/<message_id> — Mesaj Sil
# =============================================================================

@admin_bp.delete("/messages/<message_id:int>")
@protected
@role_required(GlobalRole.ADMIN)
async def delete_message(request: Request, message_id: int) -> HTTPResponse:
    """
    Grup mesajını moderasyon amacıyla soft-delete yapar.
    Ayrıca bu mesajı içeren pending şikayetleri çözüldü olarak işaretler.
    """
    admin_id: int = int(request.ctx.user["sub"])

    async with get_session() as session:
        stmt = select(Message).where(
            Message.id == message_id, Message.is_deleted.is_(False)
        )
        message = await session.scalar(stmt)

        if not message:
            raise NotFound("Mesaj bulunamadı veya zaten silinmiş.")

        # Soft delete
        message.is_deleted = True
        message.deleted_at = datetime.now(timezone.utc)

        # İlgili şikayetleri otomatik RESOLVED yap (opsiyonel kolaylık)
        stmt_reports = select(Report).where(
            Report.reported_message_id == message_id,
            Report.status == ReportStatus.PENDING,
        )
        reports = await session.scalars(stmt_reports)
        for rep in reports:
            rep.status = ReportStatus.RESOLVED

        # Audit Log
        await _create_audit_log(
            session,
            admin_id=admin_id,
            process="MESSAGE_DELETE",
            content={"message_id": message_id, "group_id": message.group_id},
        )

        logger.info(
            "admin.message_deleted", admin_id=admin_id, message_id=message_id
        )

        return sanic_json({"message": "Mesaj başarıyla silindi."}, status=200)


# =============================================================================
# ENDPOINT 4: DELETE /api/admin/expenses/<group_id>/<expense_id> — Harcama Sil
# =============================================================================

@admin_bp.delete("/expenses/<group_id:int>/<expense_id:int>")
@protected
@role_required(GlobalRole.ADMIN)
async def delete_expense(
    request: Request, group_id: int, expense_id: int
) -> HTTPResponse:
    """
    Grubun hatalı bir harcamasını soft-delete yapar.
    """
    admin_id: int = int(request.ctx.user["sub"])

    async with get_session() as session:
        stmt = select(Expense).where(
            Expense.id == expense_id,
            Expense.group_id == group_id,
            Expense.is_deleted.is_(False),
        )
        expense = await session.scalar(stmt)

        if not expense:
            raise NotFound("Harcama bulunamadı veya zaten silinmiş.")

        # Soft delete
        expense.is_deleted = True
        expense.deleted_at = datetime.now(timezone.utc)

        # Audit Log
        await _create_audit_log(
            session,
            admin_id=admin_id,
            process="EXPENSE_DELETE",
            content={
                "expense_id": expense_id,
                "group_id": group_id,
                "amount": float(expense.amount),
            },
        )

        logger.info(
            "admin.expense_deleted", admin_id=admin_id, expense_id=expense_id
        )

        return sanic_json({"message": "Harcama başarıyla silindi."}, status=200)


# =============================================================================
# ENDPOINT 5: GET /api/admin/reports — Şikayetleri Listele
# =============================================================================

@admin_bp.get("/reports")
@protected
@role_required(GlobalRole.ADMIN)
async def list_reports(request: Request) -> HTTPResponse:
    """
    Sistemdeki şikayetleri listeler.
    status=PENDING olanlar en üstte çıkacak şekilde sıralanır.
    """
    try:
        page = max(1, int(request.args.get("page", 1)))
        limit = min(100, max(1, int(request.args.get("limit", 20))))
    except (ValueError, TypeError):
        page, limit = 1, 20

    offset = (page - 1) * limit

    async with get_session() as session:
        # PENDING olanları öncelikli getir, ardından creation date desc
        stmt = (
            select(Report)
            .order_by(
                case(
                    (Report.status == ReportStatus.PENDING, 0),
                    else_=1
                ),
                Report.created_at.desc()
            )
            .offset(offset)
            .limit(limit)
        )
        reports = list(await session.scalars(stmt))

        return sanic_json(
            {
                "page": page,
                "limit": limit,
                "count": len(reports),
                "data": [_build_report_response(r) for r in reports],
            },
            status=200,
        )


# =============================================================================
# ENDPOINT 6: GET /api/admin/audit-logs — Denetim İzlerini Listele
# =============================================================================

@admin_bp.get("/audit-logs")
@protected
@role_required(GlobalRole.ADMIN)
async def list_audit_logs(request: Request) -> HTTPResponse:
    """
    AuditLog tablosundaki kayıtları listeler.
    En yeniden en eskiye (timestamp desc) sıralanır.
    """
    try:
        page = max(1, int(request.args.get("page", 1)))
        limit = min(200, max(1, int(request.args.get("limit", 50))))
    except (ValueError, TypeError):
        page, limit = 1, 50

    offset = (page - 1) * limit

    async with get_session() as session:
        stmt = (
            select(AuditLog)
            .order_by(AuditLog.timestamp.desc())
            .offset(offset)
            .limit(limit)
        )
        logs = list(await session.scalars(stmt))

        return sanic_json(
            {
                "page": page,
                "limit": limit,
                "count": len(logs),
                "data": [_build_audit_log_response(log) for log in logs],
            },
            status=200,
        )


# =============================================================================
# ENDPOINT 7: POST /api/admin/expenses/<group_id>/on-behalf/<target_user_id>
# =============================================================================

@admin_bp.post("/expenses/<group_id:int>/on-behalf/<target_user_id:int>")
@protected
@role_required(GlobalRole.ADMIN)
async def add_expense_on_behalf(
    request: Request, group_id: int, target_user_id: int
) -> HTTPResponse:
    """
    Adminin, belirtilen kullanıcı adına harcama eklemesi.
    Hedef kullanıcının grupta onaylı üye olması gerekir.
    """
    admin_id: int = int(request.ctx.user["sub"])

    async with get_session() as session:
        # Grup onaylı mı?
        stmt_group = select(Group).where(Group.id == group_id, Group.is_approved.is_(True))
        group = await session.scalar(stmt_group)
        if not group:
            raise NotFound(f"Onaylı grup bulunamadı (id={group_id}).")

        # Hedef kullanıcı grubun onaylı üyesi mi?
        stmt_member = select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == target_user_id,
            GroupMember.is_approved.is_(True),
        )
        member = await session.scalar(stmt_member)
        if not member:
            raise BadRequest("Hedef kullanıcı bu grubun onaylı üyesi değil.")

        # Form alanlarını al
        form = request.form
        if not form:
            raise BadRequest("multipart/form-data formatında gönderilmeli.")

        # amount
        raw_amount = form.get("amount")
        if not raw_amount:
            raise BadRequest("'amount' alanı zorunludur.")
        try:
            amount = float(raw_amount)
            if amount <= 0:
                raise ValueError
        except ValueError:
            raise BadRequest("'amount' pozitif bir sayı olmalıdır.")

        # date
        raw_date = form.get("date")
        if not raw_date:
            raise BadRequest("'date' alanı zorunludur (YYYY-MM-DD).")
        try:
            expense_date = date.fromisoformat(raw_date)
        except ValueError:
            raise BadRequest("'date' YYYY-MM-DD formatında olmalıdır.")

        content = (form.get("content") or "").strip() or None

        # Fatura fotoğrafı
        bill_photo_url: str | None = None
        upload = request.files.get("bill_photo")
        if upload:
            if isinstance(upload, list):
                upload = upload[0]
            body = upload.body
            name = upload.name or "receipt.jpg"

            if len(body) > MAX_RECEIPT_SIZE:
                raise BadRequest(f"Fatura boyutu çok büyük. Max: {MAX_RECEIPT_SIZE // (1024*1024)} MB")
            if len(body) == 0:
                raise BadRequest("Boş dosya gönderilemez.")

            ext = Path(name).suffix.lower()
            if ext not in EXTENSION_TO_MIME:
                raise BadRequest(f"Geçersiz uzantı: {ext}")

            mime = _detect_mime(body)
            if not mime or mime not in ALLOWED_MIME_TYPES:
                raise BadRequest("Geçersiz dosya formatı. JPEG, PNG, GIF veya WebP gönderin.")

            bill_photo_url = await _save_receipt(body, name)

        # Veritabanına kaydet
        expense = Expense(
            group_id=group_id,
            added_by=target_user_id,
            amount=amount,
            content=content,
            bill_photo=bill_photo_url,
            date=expense_date,
            is_deleted=False,
        )
        session.add(expense)
        await session.flush()

        # Audit Log
        await _create_audit_log(
            session,
            admin_id=admin_id,
            process="EXPENSE_ADD_ON_BEHALF",
            content={
                "expense_id": expense.id,
                "group_id": group_id,
                "target_user_id": target_user_id,
                "amount": amount,
            },
        )

        logger.info(
            "admin.expense_added_on_behalf",
            admin_id=admin_id,
            group_id=group_id,
            target_user=target_user_id,
            expense_id=expense.id,
        )

        return sanic_json(
            {
                "message": f"Harcama (Kullanıcı {target_user_id} adına) başarıyla eklendi.",
                "expense_id": expense.id,
            },
            status=201,
        )


# =============================================================================
# ENDPOINT 8: PUT /api/admin/expenses/<group_id>/<expense_id>
# =============================================================================

@admin_bp.put("/expenses/<group_id:int>/<expense_id:int>")
@protected
@role_required(GlobalRole.ADMIN)
async def update_expense(
    request: Request, group_id: int, expense_id: int
) -> HTTPResponse:
    """
    Adminin mevcut bir harcamayı güncellemesi (Partial update).
    """
    admin_id: int = int(request.ctx.user["sub"])
    body = request.json or {}

    if not body:
        raise BadRequest("Güncellenecek alanlar (JSON formatında) gereklidir.")

    async with get_session() as session:
        stmt = select(Expense).where(
            Expense.id == expense_id,
            Expense.group_id == group_id,
            Expense.is_deleted.is_(False),
        )
        expense = await session.scalar(stmt)

        if not expense:
            raise NotFound("Harcama bulunamadı veya silinmiş.")

        # Eski değerleri sakla
        old_values = {
            "amount": float(expense.amount),
            "content": expense.content,
            "date": expense.date.isoformat() if expense.date else None,
        }
        new_values = {}

        # amount
        if "amount" in body:
            try:
                new_amt = float(body["amount"])
                if new_amt <= 0:
                    raise ValueError
                expense.amount = new_amt
                new_values["amount"] = new_amt
            except (ValueError, TypeError):
                raise BadRequest("'amount' pozitif bir sayı olmalıdır.")

        # content
        if "content" in body:
            new_content = (body["content"] or "").strip() or None
            expense.content = new_content
            new_values["content"] = new_content

        # date
        if "date" in body:
            try:
                new_date = date.fromisoformat(body["date"])
                expense.date = new_date
                new_values["date"] = body["date"]
            except (ValueError, TypeError):
                raise BadRequest("'date' YYYY-MM-DD formatında olmalıdır.")

        if not new_values:
            return sanic_json({"message": "Değişiklik yapılmadı."}, status=200)

        # Audit Log
        await _create_audit_log(
            session,
            admin_id=admin_id,
            process="EXPENSE_UPDATE",
            content={
                "expense_id": expense_id,
                "group_id": group_id,
                "old_values": old_values,
                "new_values": new_values,
            },
        )

        logger.info(
            "admin.expense_updated",
            admin_id=admin_id,
            expense_id=expense_id,
            updated_fields=list(new_values.keys()),
        )

        return sanic_json(
            {
                "message": "Harcama başarıyla güncellendi.",
                "updated_fields": new_values,
            },
            status=200,
        )
