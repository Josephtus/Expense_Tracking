import asyncio
import structlog
import os
from datetime import date
from sqlalchemy import select

from src.database import engine, Base, dispose_engine, get_session
from src.models import User, GlobalRole, Group, Expense, Message, Report, AuditLog, GroupBan
from src.services.security import hash_password

# Log yapılandırması
logger = structlog.get_logger(__name__)

async def reset_database():
    """Tüm tabloları siler ve şemayı yeniden oluşturur."""
    logger.info("Veritabanı sıfırlanıyor (Drop & Create)...")
    async with engine.begin() as conn:
        # Önce mevcut tüm tabloları sil
        await conn.run_sync(Base.metadata.drop_all)
        # Şemayı modellerden yola çıkarak oluştur
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Tablolar başarıyla yeniden oluşturuldu.")

async def seed_admin():
    """Sisteme giriş yapabilmek için bir admin kullanıcısı ekler."""
    logger.info("Admin kullanıcısı ekleniyor...")
    
    admin_mail = "admin@octoqus.com"
    admin_pass = "admin123"
    
    async with get_session() as session:
        # Admin zaten var mı kontrol et (drop_all sonrası beklenmez ama güvenlik için)
        stmt = select(User).where(User.mail == admin_mail)
        result = await session.execute(stmt)
        existing_admin = result.scalar_one_or_none()
        
        if existing_admin:
            logger.info("Admin kullanıcısı zaten mevcut, atlanıyor.")
            return

        hashed_pwd = hash_password(admin_pass)
        admin_user = User(
            name="Sistem",
            surname="Yöneticisi",
            mail=admin_mail,
            password=hashed_pwd,
            age=30,
            birthday=date(1994, 1, 1),
            phone_number="+900000000000",
            role=GlobalRole.ADMIN,
            is_active=True
        )
        session.add(admin_user)
        # get_session context manager'ı otomatik olarak commit yapar.
        
    logger.info(
        "Admin başarıyla eklendi.", 
        email=admin_mail, 
        password=admin_pass
    )

async def main():
    """Ana sıfırlama ve tohumlama akışı."""
    try:
        await reset_database()
        await seed_admin()
        logger.info("Veritabanı başarıyla sıfırlandı ve admin eklendi.")
    except Exception as e:
        logger.error("Veritabanı sıfırlanırken hata oluştu!", error=str(e))
        raise
    finally:
        await dispose_engine()

if __name__ == "__main__":
    # Windows üzerinde loop politikası gerekebilir (bazı durumlarda)
    if os.name == 'nt':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    
    asyncio.run(main())
