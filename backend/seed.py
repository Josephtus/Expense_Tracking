import asyncio
import random
import structlog
from datetime import date, datetime, timedelta, timezone
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from src.database import engine, Base, dispose_engine, get_session
from src.models import (
    User, Group, GroupMember, GlobalRole, GroupMemberRole, 
    Message, Report, ReportStatus, Friendship, FriendshipStatus, Expense, 
    SettlementStatus, AuditLog, GroupBan
)
from src.services.security import hash_password
from src.services.common import generate_invite_code

logger = structlog.get_logger(__name__)

async def _get_auto_nickname(session, user_id: int, group_name: str, exclude_group_id: int | None = None) -> str | None:
    stmt = (
        select(Group.name, GroupMember.nickname)
        .join(GroupMember, GroupMember.group_id == Group.id)
        .where(GroupMember.user_id == user_id, GroupMember.is_approved.is_(True))
    )
    if exclude_group_id:
        stmt = stmt.where(Group.id != exclude_group_id)
        
    result = await session.execute(stmt)
    rows = result.all()
    has_same_name = any(row.name == group_name for row in rows)
    if not has_same_name:
        return None
    used_labels = [row.nickname if row.nickname else row.name for row in rows]
    count = 2
    while f"{group_name}({count})" in used_labels:
        count += 1
    return f"{group_name}({count})"

# MEGA SEEDER AYARLARI
NUM_USERS = 500  # Daha yönetilebilir ama yeterli
NUM_GROUPS = 100
EXPENSES_PER_GROUP = 40
MESSAGES_PER_GROUP = 60
REPORTS_COUNT = 100
FRIENDSHIPS_COUNT = 1500

# GERÇEKÇİ VERİ LİSTELERİ
NAMES = ["Can", "Mert", "Deniz", "Ece", "Burak", "Zeynep", "Ali", "Ayşe", "Fatma", "Mehmet", "Ahmet", "Selin", "Derya", "Oğuz", "Aslı", "Kerem", "Gökhan", "İrem", "Büşra", "Emre", "Sibel", "Tuna", "Lara", "Cem", "Gizem", "Onur", "Melis", "Bora", "İdil", "Efe", "Ada", "Kaan", "Nil", "Eren", "Derin", "Arda", "Pelin", "Tolga", "Sude", "Mete", "Umut", "Beren", "Sarp", "Mira", "Taylan", "Yeliz", "Batu", "Selinay", "Koray", "Damla", "Caner", "Ezgi"]
SURNAMES = ["Yılmaz", "Kaya", "Demir", "Çelik", "Şahin", "Öztürk", "Arslan", "Doğan", "Kılıç", "Aydın", "Özkan", "Aslan", "Bulut", "Yıldız", "Güneş", "Korkmaz", "Erdoğan", "Yavuz", "Tekin", "Aksoy", "Kocaman", "Sarı", "Kurt", "Özcan", "Ünal", "Güler", "Yalçın", "Gül", "Polat", "Keskin", "Turan", "Avcı", "Eren", "Taş", "Koç", "Yiğit", "Gök", "Şen"]

GROUP_TEMPLATES = [
    {"name": "Eskişehir Ev", "content": "Kira, faturalar ve mutfak masrafları ortak.", "categories": ["Barınma", "Fatura", "Market"]},
    {"name": "Yaz Tatili", "content": "Tatil ulaşım, konaklama ve yemek giderleri.", "categories": ["Ulaşım", "Gıda", "Eğlence"]},
    {"name": "Ofis Kahve Fonu", "content": "Haftalık kahve ve atıştırmalık masrafları.", "categories": ["İçecek", "Gıda"]},
    {"name": "Halı Saha Ekibi", "content": "Saha kirası ve maç sonu su giderleri.", "categories": ["Eğlence", "İçecek"]},
    {"name": "Doğum Günü", "content": "Sürpriz parti masrafları.", "categories": ["Eğlence", "Gıda", "Hediye"]},
    {"name": "Kyk Yurdu 4. Kat", "content": "Ortak alınan temizlik malzemeleri.", "categories": ["Market", "Temizlik"]},
    {"name": "Üniversite Projesi", "content": "Kırtasiye ve yemek masrafları.", "categories": ["Eğitim", "Gıda"]},
    {"name": "Akşam Yemeği Kulübü", "content": "Her hafta farklı bir yerde yemek.", "categories": ["Gıda"]},
    {"name": "Kamp Meraklıları", "content": "Çadır, ekipman ve kamp yeri ücretleri.", "categories": ["Ulaşım", "Eğlence"]},
    {"name": "Yol Arkadaşları", "content": "Akaryakıt ve otoban geçiş ücretleri.", "categories": ["Ulaşım"]},
    {"name": "Oyun Gecesi", "content": "Pizza ve atıştırmalık giderleri.", "categories": ["Gıda", "Eğlence"]},
    {"name": "Kayak Tatili", "content": "Skipass ve ekipman kiralama.", "categories": ["Ulaşım", "Eğlence", "Gıda"]},
    {"name": "Yatırım Kulübü", "content": "Ortak alınan kitaplar ve abonelikler.", "categories": ["Eğitim", "Abonelik"]},
    {"name": "Müzik Grubu", "content": "Stüdyo kirası ve tel masrafları.", "categories": ["Eğlence"]},
    {"name": "Yoga Sınıfı", "content": "Hoca ücreti ve salon gideri.", "categories": ["Eğitim", "Eğlence"]}
]

EXPENSE_ITEMS = {
    "Market": ["Haftalık Market", "Mutfak Alışverişi", "Temizlik Malzemesi", "Manav Gideri", "Migros Alışverişi"],
    "Fatura": ["Elektrik", "Su", "Doğalgaz", "İnternet", "Site Aidatı"],
    "Gıda": ["Pizza Gecesi", "Akşam Yemeği", "Dışarıda Yemek", "Öğle Yemeği", "Burger Siparişi"],
    "Ulaşım": ["Benzin", "Otoban Ücreti", "Taksi / Uber", "Uçak Bileti", "Otobüs Bileti"],
    "Eğlence": ["Sinema", "Konser Bileti", "Saha Kirası", "Oyun / Steam", "Müze Girişi"],
    "İçecek": ["Kahve / Starbucks", "Damacana Su", "Maç Sonu Su", "Haftalık Bira", "Soft İçecekler"],
    "Eğitim": ["Kitap Alımı", "Kırtasiye Masrafı", "Online Kurs", "Fotokopi Gideri"],
    "Barınma": ["Aylık Kira", "Depozito Payı", "Eşya Alımı"],
    "Hediye": ["Doğum Günü Hediyesi", "Çiçek", "Veda Hediyesi"],
    "Temizlik": ["Deterjan Seti", "Peçete / Kağıt Havlu", "Çöp Torbası"],
    "Abonelik": ["Netflix", "Spotify", "Youtube Premium", "Gym Üyeliği"]
}

MESSAGES = [
    "Selam, market alışverişini kim yaptı?", "Faturayı ödedim, sisteme ekliyorum.", 
    "Bu ayki masraflar biraz fazla.", "Fişi buraya atıyorum.",
    "Bana borcu olanlar ödeme yapabilir mi?", "Ödemeleri aksatmayalım.",
    "Harika bir gündü!", "Haftaya plan var mı?",
    "Harcamayı girdim, onaylar mısınız?", "Oğuz borcun hala duruyor.",
    "Selam, yeni üye alıyor muyuz?", "Akşam buluşuyor muyuz?",
    "Ben ödememi yaptım.", "Fiyatlar çok artmış.",
    "Yeni katıldım, selamlar.", "Grup kuralları nedir?",
    "Borçları kapatalım artık.", "Ekmek almayı unutmayın.",
    "Saha kirası ne kadar tuttu?", "Herkes payına düşeni ödesin.",
    "Netflix ödemesi geldi beyler.", "Elektrik faturası çok yüksek gelmiş.",
    "Dünkü yemek çok güzeldi.", "Haftalık planı kim yapıyor?",
    "Kira ödemesini hatırlatmak isterim.", "Ortak mutfak için eksikler var."
]

REPORT_REASONS = [
    "Sürekli küfür ediyor.", "Spam yapıyor.", "Borcunu ödemiyor.",
    "Taciz edici mesaj.", "Sahte makbuz.", "Hakaret ediyor."
]
REPORT_CATEGORIES = ["HAKARET", "DOLANDIRICILIK", "SPAM", "UYGUNSUZ_İÇERİK", "DİĞER"]

async def reset_database():
    logger.info("Veritabanı sıfırlanıyor...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Tablolar oluşturuldu.")

async def seed_data():
    logger.info("Mega Seeding başlatıldı...")
    async with get_session() as session:
        default_pwd = hash_password("123")
        
        # 1. ADMIN
        admin = User(
            name="Sistem", surname="Yöneticisi", mail="admin@octoqus.com", password=default_pwd, 
            age=30, birthday=date(1994, 1, 1), phone_number="+900000000000", 
            role=GlobalRole.ADMIN, is_active=True,
            invite_code="#ADMIN"
        )
        session.add(admin)
        
        # 2. KULLANICILAR
        all_users = []
        for i in range(1, NUM_USERS + 1):
            user = User(
                name=random.choice(NAMES), surname=random.choice(SURNAMES), 
                mail=f"user{i}@octoqus.com", password=default_pwd,
                age=random.randint(18, 55), birthday=date(random.randint(1975, 2005), random.randint(1, 12), random.randint(1, 28)),
                phone_number=f"+905{random.randint(30, 59)}{random.randint(100, 999)}{random.randint(1000, 9999)}",
                role=GlobalRole.USER, is_active=True,
                invite_code=generate_invite_code()
            )
            session.add(user)
            all_users.append(user)
        await session.flush()
        logger.info(f"{NUM_USERS} kullanıcı oluşturuldu.")

        # 3. GRUPLAR & ÜYELİKLER
        all_groups = []
        group_members_map = {} # group_id -> list of member objects
        
        for i in range(1, NUM_GROUPS + 1):
            tpl = random.choice(GROUP_TEMPLATES)
            is_approved = random.random() > 0.10 # %90 onaylı
            
            group = Group(
                name=f"{tpl['name']} #{i}", 
                content=tpl['content'], 
                is_approved=is_approved,
                invite_code=generate_invite_code()
            )
            session.add(group)
            await session.flush()
            all_groups.append(group)
            group_members_map[group.id] = []
            
            # Lider
            leader = random.choice(all_users)
            auto_nick = await _get_auto_nickname(session, leader.id, group.name, exclude_group_id=group.id)
            gm_leader = GroupMember(user_id=leader.id, group_id=group.id, role=GroupMemberRole.GROUP_LEADER, is_approved=True, nickname=auto_nick)
            session.add(gm_leader)
            group_members_map[group.id].append(leader)
            
            # Üyeler
            members_count = random.randint(4, 15)
            potential_members = random.sample(all_users, members_count)
            for u in potential_members:
                if u.id == leader.id: continue
                approved = random.random() > 0.15 # %85 onaylı
                auto_nick = None
                if approved:
                    auto_nick = await _get_auto_nickname(session, u.id, group.name, exclude_group_id=group.id)
                    group_members_map[group.id].append(u)
                
                session.add(GroupMember(user_id=u.id, group_id=group.id, role=GroupMemberRole.USER, is_approved=approved, nickname=auto_nick))
        
        await session.flush()
        logger.info(f"{NUM_GROUPS} grup ve ilişkili üyelikler oluşturuldu.")

        # 4. HARCAMALAR & HESAPLAŞMALAR
        for group in all_groups:
            if not group.is_approved: continue
            
            members = group_members_map.get(group.id, [])
            if not members: continue

            # Şablona göre kategoriler
            tpl_name = group.name.split(" #")[0]
            tpl = next((t for t in GROUP_TEMPLATES if t["name"] == tpl_name), GROUP_TEMPLATES[0])
            categories = tpl["categories"]

            # Harcamalar
            for _ in range(random.randint(10, EXPENSES_PER_GROUP)):
                payer = random.choice(members)
                cat = random.choice(categories)
                content = random.choice(EXPENSE_ITEMS.get(cat, ["Genel Gider"]))
                
                days_ago = random.randint(0, 180)
                amount = round(random.uniform(50, 5000), 2)
                if cat == "Barınma": amount = round(random.uniform(5000, 25000), 2)
                if cat == "İçecek": amount = round(random.uniform(20, 500), 2)
                
                expense = Expense(
                    group_id=group.id, added_by=payer.id,
                    amount=amount,
                    content=content, category=cat,
                    date=date.today() - timedelta(days=days_ago),
                    created_at=datetime.now(timezone.utc) - timedelta(days=days_ago, hours=random.randint(0, 23)),
                    is_deleted=False, is_settlement=False
                )
                session.add(expense)
            
            # Hesaplaşmalar
            if len(members) >= 2:
                for _ in range(random.randint(1, 5)):
                    p1, p2 = random.sample(members, 2)
                    status = random.choice(list(SettlementStatus))
                    session.add(Expense(
                        group_id=group.id, added_by=p1.id, recipient_id=p2.id,
                        amount=round(random.uniform(100, 2000), 2),
                        content="Borç Kapatma", date=date.today() - timedelta(days=random.randint(0, 45)),
                        is_settlement=True, settlement_status=status, is_deleted=False
                    ))
        
        await session.flush()
        logger.info("Mantıklı harcamalar ve hesaplaşmalar eklendi.")

        # 5. MESAJLAR
        for group in all_groups:
            if not group.is_approved: continue
            members = group_members_map.get(group.id, [])
            if not members: continue

            for _ in range(random.randint(15, MESSAGES_PER_GROUP)):
                sender = random.choice(members)
                msg = Message(
                    group_id=group.id, sender_id=sender.id,
                    message_text=random.choice(MESSAGES),
                    timestamp=datetime.now(timezone.utc) - timedelta(days=random.randint(0, 60), minutes=random.randint(0, 10000))
                )
                session.add(msg)
        
        await session.flush()
        logger.info("Grup içi mantıklı konuşmalar oluşturuldu.")

        # 6. ARKADAŞLIKLAR (Daha mantıklı: aynı gruptakiler daha çok arkadaş)
        logger.info("Mantıklı arkadaşlıklar oluşturuluyor...")
        added_friendships = set() # (min, max) to avoid duplicates
        
        # Önce gruplardaki insanları birbirine arkadaş yap (Mantıklı olan bu)
        for g_id, members in group_members_map.items():
            if len(members) < 2: continue
            # Her gruptan birkaç arkadaşlık çıkar
            for _ in range(random.randint(2, 6)):
                u1, u2 = random.sample(members, 2)
                pair = tuple(sorted((u1.id, u2.id)))
                if pair not in added_friendships:
                    status = random.choice([FriendshipStatus.ACCEPTED, FriendshipStatus.ACCEPTED, FriendshipStatus.PENDING])
                    session.add(Friendship(user_id=u1.id, friend_id=u2.id, status=status))
                    added_friendships.add(pair)
        
        # Sonra rastgele arkadaşlıklar ekle
        while len(added_friendships) < FRIENDSHIPS_COUNT:
            u1, u2 = random.sample(all_users, 2)
            pair = tuple(sorted((u1.id, u2.id)))
            if pair not in added_friendships:
                status = random.choice([FriendshipStatus.ACCEPTED, FriendshipStatus.PENDING])
                session.add(Friendship(user_id=u1.id, friend_id=u2.id, status=status))
                added_friendships.add(pair)
        
        await session.flush()
        logger.info("Arkadaşlık ilişkileri eklendi.")

        # 7. ŞİKAYETLER
        stmt_msgs = select(Message).limit(500)
        all_msgs = (await session.scalars(stmt_msgs)).all()

        for _ in range(REPORTS_COUNT):
            reporter = random.choice(all_users)
            target_user = random.choice(all_users)
            target_msg = random.choice(all_msgs) if (all_msgs and random.random() > 0.3) else None
            
            session.add(Report(
                reporter_id=reporter.id,
                reported_user_id=target_user.id if not target_msg else None,
                reported_message_id=target_msg.id if target_msg else None,
                category=random.choice(REPORT_CATEGORIES),
                aciklama=random.choice(REPORT_REASONS),
                status=random.choice(list(ReportStatus)),
                created_at=datetime.now(timezone.utc) - timedelta(days=random.randint(0, 30))
            ))
        logger.info("Şikayetler eklendi.")

        # 8. DENETİM KAYITLARI
        processes = [
            "KULLANICI_ENGELLE", "GRUP_SIL", "HARCAMA_KALDIR", 
            "RAPOR_INCELE", "SİSTEM_GÜNCELLEME", "YETKİ_DEĞİŞİKLİĞİ"
        ]
        for _ in range(60):
            proc = random.choice(processes)
            session.add(AuditLog(
                admin_id=admin.id,
                process_performed=proc,
                content=f"Admin tarafından '{proc}' işlemi gerçekleştirildi. Kayıt ID: {random.randint(1000, 9999)}",
                timestamp=datetime.now(timezone.utc) - timedelta(days=random.randint(0, 20), hours=random.randint(0, 23))
            ))

        await session.commit()
        logger.info("=== MEGA SEEDING TAMAMLANDI ===")
        logger.info(f"Admin: admin@octoqus.com / 123")
        logger.info(f"Kullanıcılar: user1@octoqus.com ... user{NUM_USERS}@octoqus.com / 123")
        logger.info(f"İstatistik: {NUM_USERS} Kullanıcı, {NUM_GROUPS} Grup, {FRIENDSHIPS_COUNT} Arkadaşlık.")

async def main():
    try:
        await reset_database()
        await seed_data()
    except Exception as e:
        logger.error(f"Hata: {str(e)}")
        import traceback; traceback.print_exc()
    finally:
        await dispose_engine()

if __name__ == "__main__":
    asyncio.run(main())
