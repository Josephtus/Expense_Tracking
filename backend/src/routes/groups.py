"""
src/routes/groups.py
====================
Grup Yönetimi Blueprint
/api/groups prefix'i ile çalışır.

Endpoints:
  POST /api/groups                                          → Grup oluştur
  GET  /api/groups                                          → Onaylı grupları listele
  POST /api/groups/<group_id>/join                          → Gruba katılma isteği
  POST /api/groups/<group_id>/approve/<user_id>             → Üyeyi onayla (Lider)
  POST /api/groups/<group_id>/transfer_leadership/<target>  → Liderliği devret
  POST /api/groups/<group_id>/leave                         → Gruptan ayrıl

İş Kuralları:
  - Grup oluşturulduğunda is_approved=False (Admin onayı bekler)
  - Kurucu GroupLeader olarak is_approved=True ile eklenir
  - Katılma isteği is_approved=False olarak eklenir
  - Yalnızca o grubun GROUP_LEADER'ı (is_approved=True) üye onaylayabilir
  - Lider ayrılırsa en eski onaylı üye otomatik lider olur
"""

import structlog
from pydantic import BaseModel, ValidationError, field_validator
from sanic import Blueprint, Request
from sanic.exceptions import BadRequest, Forbidden, NotFound
from sanic.response import HTTPResponse, json as sanic_json
from sqlalchemy import asc, select

from src.database import get_session
from src.models import Group, GroupMember, GroupMemberRole
from src.services.security import protected

logger = structlog.get_logger(__name__)

groups_bp = Blueprint("groups", url_prefix="/api/groups")


# =============================================================================
# Pydantic Şemaları
# =============================================================================

class CreateGroupRequest(BaseModel):
    """Grup oluşturma isteği."""

    name: str
    content: str | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Grup adı boş olamaz.")
        if len(v) > 200:
            raise ValueError("Grup adı en fazla 200 karakter olabilir.")
        return v

    @field_validator("content")
    @classmethod
    def validate_content(cls, v: str | None) -> str | None:
        if v is not None:
            v = v.strip() or None
        return v


# =============================================================================
# Helpers
# =============================================================================

def _build_group_response(group: Group) -> dict:
    """Group nesnesini API response dict'ine dönüştürür."""
    return {
        "id": group.id,
        "name": group.name,
        "content": group.content,
        "is_approved": group.is_approved,
        "created_at": group.created_at.isoformat() if group.created_at else None,
    }


def _build_member_response(member: GroupMember) -> dict:
    """GroupMember nesnesini API response dict'ine dönüştürür."""
    return {
        "user_id": member.user_id,
        "group_id": member.group_id,
        "role": member.role.value,
        "is_approved": member.is_approved,
        "joined_at": member.joined_at.isoformat() if member.joined_at else None,
    }


async def _get_approved_group(session, group_id: int) -> Group:
    """
    Onaylanmış (is_approved=True) grubu getirir.
    Bulunamazsa veya onaylanmamışsa 404 fırlatır.
    """
    stmt = select(Group).where(Group.id == group_id, Group.is_approved.is_(True))
    group = await session.scalar(stmt)
    if not group:
        raise NotFound(f"Onaylı grup bulunamadı (id={group_id}).")
    return group


async def _get_leader_membership(session, group_id: int, user_id: int) -> GroupMember:
    """
    Belirtilen kullanıcının bu grupta aktif GROUP_LEADER olup olmadığını kontrol eder.
    Değilse 403 Forbidden fırlatır.
    """
    stmt = select(GroupMember).where(
        GroupMember.group_id == group_id,
        GroupMember.user_id == user_id,
        GroupMember.role == GroupMemberRole.GROUP_LEADER,
        GroupMember.is_approved.is_(True),
    )
    membership = await session.scalar(stmt)
    if not membership:
        raise Forbidden("Bu işlemi yalnızca grubun onaylı lideri yapabilir.")
    return membership


async def _get_membership(session, group_id: int, user_id: int) -> GroupMember | None:
    """Bir kullanıcının gruptaki üyelik kaydını döner (yoksa None)."""
    stmt = select(GroupMember).where(
        GroupMember.group_id == group_id,
        GroupMember.user_id == user_id,
    )
    return await session.scalar(stmt)


# =============================================================================
# ENDPOINT 1: POST /api/groups — Grup Oluşturma
# =============================================================================

@groups_bp.post("/")
@protected
async def create_group(request: Request) -> HTTPResponse:
    """
    Yeni grup oluşturur.

    İş Kuralları:
      - Grup `is_approved=False` olarak oluşturulur (Admin onayı gerekir).
      - Kurucusu GroupMember'a `role=GROUP_LEADER`, `is_approved=True` ile eklenir.

    Request Body (JSON):
        name   : str (zorunlu)
        content: str | null (opsiyonel)

    Responses:
        201 → Grup oluşturuldu, lider olarak eklendi
        400 → Validasyon hatası
    """
    body = request.json
    if not body:
        raise BadRequest("İstek gövdesi JSON formatında olmalıdır.")

    try:
        data = CreateGroupRequest.model_validate(body)
    except ValidationError as exc:
        errors = [
            {"field": e["loc"][0] if e["loc"] else "unknown", "message": e["msg"]}
            for e in exc.errors()
        ]
        raise BadRequest(f"Validasyon hatası: {errors}")

    creator_id: int = int(request.ctx.user["sub"])

    async with get_session() as session:
        # Grubu oluştur (Admin onayı bekleyecek)
        new_group = Group(
            name=data.name,
            content=data.content,
            is_approved=False,
        )
        session.add(new_group)
        await session.flush()  # ID al

        # Kurucuyu GROUP_LEADER olarak ve onaylı şekilde ekle
        leader_membership = GroupMember(
            user_id=creator_id,
            group_id=new_group.id,
            role=GroupMemberRole.GROUP_LEADER,
            is_approved=True,  # Kurucu direkt onaylı lider
        )
        session.add(leader_membership)

        logger.info(
            "group.created",
            group_id=new_group.id,
            creator_id=creator_id,
        )

        return sanic_json(
            {
                "message": "Grup oluşturma isteği alındı. Admin onayı bekleniyor.",
                "group": _build_group_response(new_group),
                "your_membership": _build_member_response(leader_membership),
            },
            status=201,
        )


# =============================================================================
# ENDPOINT 2: GET /api/groups — Onaylı Grupları Listele
# =============================================================================

@groups_bp.get("/")
@protected
async def list_groups(request: Request) -> HTTPResponse:
    """
    Admin tarafından onaylanmış tüm grupları listeler.
    Kullanıcıların katılacak grup bulabilmesi için herkese açıktır (token gerekli).

    Query Parameters (opsiyonel):
        page  : int (default: 1)
        limit : int (default: 20, max: 100)

    Responses:
        200 → Onaylı grupların listesi (pagination ile)
    """
    # Basit pagination
    try:
        page = max(1, int(request.args.get("page", 1)))
        limit = min(100, max(1, int(request.args.get("limit", 20))))
    except (ValueError, TypeError):
        page, limit = 1, 20

    offset = (page - 1) * limit

    async with get_session() as session:
        stmt = (
            select(Group)
            .where(Group.is_approved.is_(True))
            .order_by(Group.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        result = await session.scalars(stmt)
        groups = result.all()

        return sanic_json(
            {
                "page": page,
                "limit": limit,
                "count": len(groups),
                "groups": [_build_group_response(g) for g in groups],
            },
            status=200,
        )


# =============================================================================
# ENDPOINT 3: POST /api/groups/<group_id>/join — Gruba Katılma İsteği
# =============================================================================

@groups_bp.post("/<group_id:int>/join")
@protected
async def join_group(request: Request, group_id: int) -> HTTPResponse:
    """
    Onaylı bir gruba katılma isteği gönderir.

    İş Kuralları:
      - Yalnızca is_approved=True gruplarına istek gönderilebilir.
      - Kullanıcı zaten üyeyse 400 döner (bekleyen istek de dahil).
      - Yeni üyelik `role=USER`, `is_approved=False` ile eklenir.

    Responses:
        201 → Katılma isteği gönderildi, lider onayı bekleniyor
        400 → Zaten üye veya bekleyen istek var
        404 → Grup bulunamadı
    """
    user_id: int = int(request.ctx.user["sub"])

    async with get_session() as session:
        # Grup mevcut ve onaylı mı?
        await _get_approved_group(session, group_id)

        # Zaten üye mi?
        existing = await _get_membership(session, group_id, user_id)
        if existing:
            if existing.is_approved:
                raise BadRequest("Bu grubun zaten aktif bir üyesisiniz.")
            else:
                raise BadRequest("Bu grup için zaten bekleyen bir katılma isteğiniz var.")

        # Katılma isteği oluştur
        new_membership = GroupMember(
            user_id=user_id,
            group_id=group_id,
            role=GroupMemberRole.USER,
            is_approved=False,   # Lider onayı bekliyor
        )
        session.add(new_membership)

        logger.info("group.join_request", group_id=group_id, user_id=user_id)

        return sanic_json(
            {
                "message": "Katılma isteğiniz alındı. Grup liderinin onayı bekleniyor.",
                "membership": _build_member_response(new_membership),
            },
            status=201,
        )


# =============================================================================
# ENDPOINT 4: POST /api/groups/<group_id>/approve/<user_id> — Üye Onaylama
# =============================================================================

@groups_bp.post("/<group_id:int>/approve/<target_user_id:int>")
@protected
async def approve_member(
    request: Request, group_id: int, target_user_id: int
) -> HTTPResponse:
    """
    Grup liderinin bekleyen katılma isteğini onaylaması.

    Yetki:
        Yalnızca o grubun onaylı GROUP_LEADER'ı yapabilir.

    Responses:
        200 → Üye onaylandı
        400 → Bekleyen istek yok veya zaten onaylı
        403 → Yetkisiz (lider değil)
        404 → Grup veya üye bulunamadı
    """
    requester_id: int = int(request.ctx.user["sub"])

    async with get_session() as session:
        await _get_approved_group(session, group_id)
        await _get_leader_membership(session, group_id, requester_id)

        # Hedef üyenin bekleyen isteğini bul
        stmt = select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == target_user_id,
        )
        target_membership = await session.scalar(stmt)

        if not target_membership:
            raise NotFound(
                f"Bu grupta kullanıcı (id={target_user_id}) için bekleyen bir istek bulunamadı."
            )
        if target_membership.is_approved:
            raise BadRequest("Bu kullanıcı zaten grubun onaylı üyesi.")

        target_membership.is_approved = True

        logger.info(
            "group.member_approved",
            group_id=group_id,
            approved_user=target_user_id,
            by_leader=requester_id,
        )

        return sanic_json(
            {
                "message": "Üye başarıyla onaylandı.",
                "membership": _build_member_response(target_membership),
            },
            status=200,
        )


# =============================================================================
# ENDPOINT 5: POST /api/groups/<group_id>/transfer_leadership/<target_user_id>
# =============================================================================

@groups_bp.post("/<group_id:int>/transfer_leadership/<target_user_id:int>")
@protected
async def transfer_leadership(
    request: Request, group_id: int, target_user_id: int
) -> HTTPResponse:
    """
    Grup liderinin liderliğini başka bir onaylı üyeye devretmesi.

    İş Kuralları:
      - Hedef kullanıcı bu grubun onaylı (is_approved=True) üyesi olmalı.
      - Mevcut lider USER rolüne düşürülür.
      - Hedef kullanıcı GROUP_LEADER rolüne yükseltilir.
      - Kendine devir yapılamaz.

    Responses:
        200 → Liderlik devredildi
        400 → Kendine devir veya geçersiz hedef
        403 → Yetkisiz
        404 → Grup veya hedef üye bulunamadı
    """
    requester_id: int = int(request.ctx.user["sub"])

    if requester_id == target_user_id:
        raise BadRequest("Liderliği kendinize deviremezsiniz.")

    async with get_session() as session:
        await _get_approved_group(session, group_id)
        current_leader_membership = await _get_leader_membership(
            session, group_id, requester_id
        )

        # Hedef kullanıcının onaylı üyeliğini kontrol et
        stmt = select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == target_user_id,
            GroupMember.is_approved.is_(True),
        )
        target_membership = await session.scalar(stmt)

        if not target_membership:
            raise NotFound(
                f"Hedef kullanıcı (id={target_user_id}) bu grubun onaylı üyesi değil."
            )

        # Rol değişimi
        current_leader_membership.role = GroupMemberRole.USER
        target_membership.role = GroupMemberRole.GROUP_LEADER

        logger.info(
            "group.leadership_transferred",
            group_id=group_id,
            from_user=requester_id,
            to_user=target_user_id,
        )

        return sanic_json(
            {
                "message": "Liderlik başarıyla devredildi.",
                "new_leader_user_id": target_user_id,
                "previous_leader_user_id": requester_id,
            },
            status=200,
        )


# =============================================================================
# ENDPOINT 6: POST /api/groups/<group_id>/leave — Gruptan Ayrılma
# =============================================================================

@groups_bp.post("/<group_id:int>/leave")
@protected
async def leave_group(request: Request, group_id: int) -> HTTPResponse:
    """
    Kullanıcının gruptan ayrılması.

    İş Kuralları:
      1. Kullanıcı bu grubun üyesi olmalı.
      2. Ayrılan kullanıcı GROUP_LEADER ise:
         a. Başka onaylı üyeler varsa → en eski (joined_at ASC) üye otomatik lider olur.
         b. Başka onaylı üye yoksa → grup sahipsiz kalır (üyelik silinir, grup kaydı tutulur).
      3. Üyelik kaydı kalıcı olarak silinir (GroupMember soft-delete yok).

    Responses:
        200 → Gruptan ayrıldı (gerekirse yeni lider atandı)
        400 → Zaten üye değil
        404 → Grup bulunamadı
    """
    user_id: int = int(request.ctx.user["sub"])

    async with get_session() as session:
        # Grubun var olduğunu kontrol et (is_approved durumundan bağımsız)
        stmt = select(Group).where(Group.id == group_id)
        group = await session.scalar(stmt)
        if not group:
            raise NotFound(f"Grup bulunamadı (id={group_id}).")

        # Kullanıcının üyeliğini bul
        user_membership = await _get_membership(session, group_id, user_id)
        if not user_membership:
            raise BadRequest("Bu grubun üyesi değilsiniz.")

        response_extra: dict = {}

        # ── Lider ayrılıyor → Otomasyon ─────────────────────────────────────
        if user_membership.role == GroupMemberRole.GROUP_LEADER:
            # En eski onaylı üyeyi bul (lider hariç)
            stmt_next = (
                select(GroupMember)
                .where(
                    GroupMember.group_id == group_id,
                    GroupMember.user_id != user_id,
                    GroupMember.is_approved.is_(True),
                )
                .order_by(asc(GroupMember.joined_at))
                .limit(1)
            )
            next_leader = await session.scalar(stmt_next)

            if next_leader:
                # Eski üyeyi GROUP_LEADER'a yükselt
                next_leader.role = GroupMemberRole.GROUP_LEADER
                response_extra["new_leader_user_id"] = next_leader.user_id
                response_extra["message_detail"] = (
                    f"Gruptan ayrıldınız. Kullanıcı (id={next_leader.user_id}) "
                    f"yeni grup lideri olarak atandı."
                )
                logger.info(
                    "group.auto_leader_assigned",
                    group_id=group_id,
                    old_leader=user_id,
                    new_leader=next_leader.user_id,
                )
            else:
                # Grup sahipsiz kalacak
                response_extra["message_detail"] = (
                    "Gruptan ayrıldınız. Grupta başka onaylı üye kalmadığı için "
                    "grup lidersiz duruma geçti."
                )
                logger.warning(
                    "group.no_leader_left",
                    group_id=group_id,
                    last_leader=user_id,
                )

        # ── Üyelik kaydını sil ───────────────────────────────────────────────
        await session.delete(user_membership)

        logger.info("group.left", group_id=group_id, user_id=user_id)

        return sanic_json(
            {
                "message": response_extra.get(
                    "message_detail", "Gruptan başarıyla ayrıldınız."
                ),
                **{k: v for k, v in response_extra.items() if k != "message_detail"},
            },
            status=200,
        )
