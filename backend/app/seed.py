from sqlalchemy.orm import Session
from sqlalchemy import func
from .database import SessionLocal, engine, Base
from . import models, auth
import datetime
import json
import sys

def seed_db():
    # Create tables
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    
    # Create an agency
    agency = db.query(models.Agency).filter(models.Agency.name == "Global Adventures").first()
    if not agency:
        agency = models.Agency(
            name="Global Adventures",
            description="Your gateway to the world.",
            website="https://globaladventures.com",
            contact_email="contact@globaladventures.com"
        )
        db.add(agency)
        db.commit()
        db.refresh(agency)

    # Create some packages
    package_data = [
        {
            "title": "Alpine Adventure",
            "description": "Experience the beauty of the Swiss Alps with guided hiking and luxury stays.",
            "price": 2499,
            "pricing_mode": "manual",
            "base_currency": "USD",
            "prices": json.dumps({ "USD": 2499, "EUR": 2299, "AZN": 3899, "RUB": 245000, "TRY": 95999 }),
            "destination": "Swiss Alps",
            "duration_days": 10,
            "capacity": 20,
            "category": "Nature",
            "image_url": "https://images.unsplash.com/photo-1531310197839-ccf54634509e?q=80&w=2000&auto=format&fit=crop",
            "images": json.dumps([
                "https://images.unsplash.com/photo-1531310197839-ccf54634509e?q=80&w=2000&auto=format&fit=crop",
                "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=2000&auto=format&fit=crop",
                "https://images.unsplash.com/photo-1472791108553-c9405341e398?q=80&w=2000&auto=format&fit=crop"
            ]),
            "highlights": json.dumps([
                "Guided Alpine Trekking",
                "Luxury Chalet Stay",
                "Panoramic Mountain Views",
                "Local Swiss Cuisine",
                "All-inclusive Transport"
            ]),
            "agency_id": agency.id
        },
        {
            "title": "Safari Expedition",
            "description": "Witness the Great Migration in the heart of the Serengeti.",
            "price": 3200,
            "pricing_mode": "manual",
            "base_currency": "USD",
            "prices": json.dumps({ "USD": 3200, "EUR": 2990, "AZN": 4990, "RUB": 319000, "TRY": 129999 }),
            "destination": "Serengeti, Tanzania",
            "duration_days": 12,
            "capacity": 15,
            "category": "Adventure",
            "image_url": "https://images.unsplash.com/photo-1516426122078-c23e76319801?q=80&w=2000&auto=format&fit=crop",
            "images": json.dumps([
                "https://images.unsplash.com/photo-1516426122078-c23e76319801?q=80&w=2000&auto=format&fit=crop",
                "https://images.unsplash.com/photo-1523805081446-993956245991?q=80&w=2000&auto=format&fit=crop",
                "https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?q=80&w=2000&auto=format&fit=crop"
            ]),
            "highlights": json.dumps([
                "Big Five Game Drives",
                "Luxury Tented Camp",
                "Hot Air Balloon Safari",
                "Maasai Village Visit",
                "Professional Ranger Guide"
            ]),
            "agency_id": agency.id
        },
        {
            "title": "Tropical Paradise",
            "description": "Relax on the pristine beaches of Bali with all-inclusive luxury.",
            "price": 1299,
            "pricing_mode": "manual",
            "base_currency": "USD",
            "prices": json.dumps({ "USD": 1299, "EUR": 1199, "AZN": 1999, "RUB": 125000, "TRY": 49999 }),
            "destination": "Bali, Indonesia",
            "duration_days": 7,
            "capacity": 30,
            "category": "Nature",
            "image_url": "https://images.unsplash.com/photo-1502791451862-7bd8c1df43a7?q=80&w=2000&auto=format&fit=crop",
            "images": json.dumps([
                "https://images.unsplash.com/photo-1502791451862-7bd8c1df43a7?q=80&w=2000&auto=format&fit=crop",
                "https://images.unsplash.com/photo-1537996194471-e657df975ab4?q=80&w=2000&auto=format&fit=crop",
                "https://images.unsplash.com/photo-1552733407-5d5c46c3bb3b?q=80&w=2000&auto=format&fit=crop"
            ]),
            "highlights": json.dumps([
                "Beachfront Resort Stay",
                "Private Pool Villa",
                "Ubud Cultural Tour",
                "Sunset Dinner Cruise",
                "Balinese Spa Treatment"
            ]),
            "agency_id": agency.id
        },
        {
            "title": "Ancient Wonders",
            "description": "Explore the pyramids and the Nile in a historical journey through Egypt.",
            "price": 1850,
            "pricing_mode": "manual",
            "base_currency": "USD",
            "prices": json.dumps({ "USD": 1850, "EUR": 1699, "AZN": 2899, "RUB": 179000, "TRY": 72999 }),
            "destination": "Cairo, Egypt",
            "duration_days": 8,
            "capacity": 25,
            "category": "History",
            "image_url": "https://images.unsplash.com/photo-1503177119275-0aa32b3a9368?q=80&w=2000&auto=format&fit=crop",
            "images": json.dumps([
                "https://images.unsplash.com/photo-1503177119275-0aa32b3a9368?q=80&w=2000&auto=format&fit=crop",
                "https://images.unsplash.com/photo-1539635278303-d4002c07dee3?q=80&w=2000&auto=format&fit=crop",
                "https://images.unsplash.com/photo-1572120339161-21707519961d?q=80&w=2000&auto=format&fit=crop"
            ]),
            "highlights": json.dumps([
                "Giza Pyramids Visit",
                "Nile River Cruise",
                "Egyptian Museum Tour",
                "Valley of the Kings",
                "Expert Egyptologist Guide"
            ]),
            "agency_id": agency.id
        }
    ]
    
    packages = []
    for p_data in package_data:
        pkg = db.query(models.Package).filter(models.Package.title == p_data["title"]).first()
        if not pkg:
            pkg = models.Package(**p_data)
            db.add(pkg)
            db.commit()
            db.refresh(pkg)
        packages.append(pkg)

    articles_data = [
        {
            "slug": "48-hours-in-tokyo",
            "category": "food",
            "author_name": "Mina H.",
            "cover_image_url": "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?q=80&w=2000&auto=format&fit=crop",
            "reading_minutes": 7,
            "title": "48 hours in Tokyo: markets, neon streets, and quiet gardens",
            "excerpt": "A practical weekend plan that balances fast-paced neighborhoods with calm stops.",
            "content": "Start in Asakusa early, then move to Ueno markets for lunch. End the day in Shinjuku for neon streets. Day 2: a slow morning in a garden, then a curated food crawl.",
            "title_i18n": json.dumps({
                "en": "48 hours in Tokyo: markets, neon streets, and quiet gardens",
                "ru": "48 часов в Токио: рынки, неоновые улицы и тихие сады",
                "az": "Tokioda 48 saat: bazarlar, neon küçələr və sakit bağlar",
                "tr": "Tokyo’da 48 saat: pazarlar, neon sokaklar ve sakin bahçeler",
            }),
            "excerpt_i18n": json.dumps({
                "en": "A practical weekend plan that balances fast-paced neighborhoods with calm stops.",
                "ru": "Практичный план на выходные: динамичные районы и спокойные места для пауз.",
                "az": "Həftəsonu üçün praktik plan: dinamik məhəllələr və sakit dayanacaqlar.",
                "tr": "Hafta sonu için pratik plan: hareketli bölgeler ve sakin duraklar.",
            }),
            "content_i18n": json.dumps({
                "en": "Start in Asakusa early, then move to Ueno markets for lunch. End the day in Shinjuku for neon streets. Day 2: a slow morning in a garden, then a curated food crawl.",
                "ru": "Начните рано в Асакусе, затем пообедайте на рынках Уэно. Вечером — неон Синдзюку. День 2: спокойное утро в саду и гастро-маршрут.",
                "az": "Səhəri Asakusada başlayın, nahar üçün Ueno bazarlarına keçin. Axşam Şincuku neon küçələri. 2-ci gün: bağda sakit səhər və seçilmiş food-marşrut.",
                "tr": "Sabah erken Asakusa’da başlayın, öğle için Ueno pazarlarına geçin. Akşam Shinjuku’nun neon sokakları. 2. gün: bahçede sakin bir sabah ve seçilmiş bir lezzet rotası.",
            }),
        },
        {
            "slug": "budget-switzerland-scenic-trains",
            "category": "budget",
            "author_name": "David K.",
            "cover_image_url": "https://images.unsplash.com/photo-1530122037265-a5f1f91d3b99?q=80&w=2000&auto=format&fit=crop",
            "reading_minutes": 6,
            "title": "Budget Switzerland: scenic trains without premium prices",
            "excerpt": "How to keep costs under control while still getting the views.",
            "content": "Use saver day passes, travel early, and choose one highlight train per day. Stay outside the core tourist towns and use local grocery meals for breakfast.",
            "title_i18n": json.dumps({
                "en": "Budget Switzerland: scenic trains without premium prices",
                "ru": "Швейцария с бюджетом: красивые поезда без премиальных цен",
                "az": "Büdcə ilə İsveçrə: mənzərəli qatarlar, yüksək qiymətsiz",
                "tr": "Bütçeyle İsviçre: premium fiyatlar olmadan manzaralı trenler",
            }),
            "excerpt_i18n": json.dumps({
                "en": "How to keep costs under control while still getting the views.",
                "ru": "Как сдержать расходы и при этом получить максимум впечатлений.",
                "az": "Xərcləri nəzarətdə saxlayıb mənzərədən zövq almağın yolu.",
                "tr": "Masrafları kontrol ederken manzarayı kaçırmamanın yolları.",
            }),
            "content_i18n": json.dumps({
                "en": "Use saver day passes, travel early, and choose one highlight train per day. Stay outside the core tourist towns and use local grocery meals for breakfast.",
                "ru": "Берите дневные проездные со скидкой, выезжайте рано и выбирайте один «главный» поезд в день. Живите вне самых дорогих городков и завтракайте из супермаркета.",
                "az": "Endirimli günlük keçidlərdən istifadə edin, erkən yola çıxın və gündə bir əsas marşrut seçin. Bahalı mərkəzlərdən kənarda qalın, səhər yeməyini marketdən alın.",
                "tr": "İndirimli günlük biletleri kullanın, erken yola çıkın ve günde bir ‘öne çıkan’ tren seçin. Pahalı merkezlerin dışında konaklayın, kahvaltıyı marketten alın.",
            }),
        },
        {
            "slug": "packing-like-a-pro",
            "category": "culture",
            "author_name": "Aylin M.",
            "cover_image_url": "https://images.unsplash.com/photo-1526772662000-3f88f10405ff?q=80&w=2000&auto=format&fit=crop",
            "reading_minutes": 5,
            "title": "Pack like a pro: the 10-item travel system",
            "excerpt": "A simple packing system that works for city breaks and nature trips.",
            "content": "Build around one neutral palette, pick 2 shoes max, and pack layers. Keep essentials in a single pouch so airport days stay stress-free.",
            "title_i18n": json.dumps({
                "en": "Pack like a pro: the 10-item travel system",
                "ru": "Собирайтесь как профи: система из 10 вещей",
                "az": "Peşəkar kimi yığının: 10 əşyalıq sistem",
                "tr": "Profesyonel gibi valiz: 10 parçalık sistem",
            }),
            "excerpt_i18n": json.dumps({
                "en": "A simple packing system that works for city breaks and nature trips.",
                "ru": "Простая система сборов для города и природы.",
                "az": "Şəhər və təbiət səfərləri üçün sadə yığılma sistemi.",
                "tr": "Şehir kaçamakları ve doğa gezileri için basit bir sistem.",
            }),
            "content_i18n": json.dumps({
                "en": "Build around one neutral palette, pick 2 shoes max, and pack layers. Keep essentials in a single pouch so airport days stay stress-free.",
                "ru": "Соберите нейтральную палитру, максимум 2 пары обуви и многослойность. Все важное держите в одном чехле — так аэропорт проходит спокойнее.",
                "az": "Neytral rəng palitrası seçin, maksimum 2 ayaqqabı və laylı geyim götürün. Əsasları bir çantada saxlayın ki, hava limanı günü rahat keçsin.",
                "tr": "Nötr bir palet seçin, en fazla 2 ayakkabı alın ve katmanlı giyinin. Önemlileri tek bir çantada tutun; havaalanı günleri daha rahat geçer.",
            }),
        },
    ]

    for a_data in articles_data:
        exists = db.query(models.BlogArticle).filter(models.BlogArticle.slug == a_data["slug"]).first()
        if not exists:
            db.add(models.BlogArticle(**a_data))
            db.commit()

    # Create a user
    user = db.query(models.User).filter(models.User.email == "user@example.com").first()
    if not user:
        user = models.User(
            email="user@example.com",
            hashed_password=auth.get_password_hash("password123"),
            full_name="John Doe",
            role=models.UserRole.USER
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    # Create an agency user
    agency_user = db.query(models.User).filter(models.User.email == "agency@example.com").first()
    if not agency_user:
        agency_user = models.User(
            email="agency@example.com",
            hashed_password=auth.get_password_hash("agency123"),
            full_name="Global Admin",
            role=models.UserRole.AGENCY,
            agency_id=agency.id,
            is_verified=True,
            onboarding_completed=True,
        )
        db.add(agency_user)
        db.commit()
        db.refresh(agency_user)
    else:
        updated = False
        if agency_user.agency_id != agency.id:
            agency_user.agency_id = agency.id
            updated = True
        if not getattr(agency_user, "is_verified", False):
            agency_user.is_verified = True
            updated = True
        if not getattr(agency_user, "onboarding_completed", False):
            agency_user.onboarding_completed = True
            updated = True
        if updated:
            db.commit()

    # Create an admin user
    admin_user = db.query(models.User).filter(models.User.email == "admin@example.com").first()
    if not admin_user:
        admin_user = models.User(
            email="admin@example.com",
            hashed_password=auth.get_password_hash("admin123"),
            full_name="Site Admin",
            role=models.UserRole.ADMIN,
            is_verified=True,
            onboarding_completed=True,
        )
        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)
    else:
        updated = False
        if not getattr(admin_user, "is_verified", False):
            admin_user.is_verified = True
            updated = True
        if not getattr(admin_user, "onboarding_completed", False):
            admin_user.onboarding_completed = True
            updated = True
        if updated:
            db.commit()

    # Add some dummy reviews
    for pkg in packages:
        review_exists = db.query(models.Review).filter(
            models.Review.user_id == user.id,
            models.Review.package_id == pkg.id
        ).first()
        if not review_exists:
            review = models.Review(
                user_id=user.id,
                package_id=pkg.id,
                rating=5,
                comment="Amazing experience! Highly recommend."
            )
            db.add(review)
    
    db.commit()
    print("Database seeded successfully.")

def reset_admin_password(email: str, new_password: str) -> None:
    normalized_email = (email or "").strip().lower()
    if not normalized_email:
        raise RuntimeError("Email is required")
    auth.validate_strong_password(new_password)

    db = SessionLocal()
    try:
        user = db.query(models.User).filter(func.lower(models.User.email) == normalized_email).first()
        if not user:
            raise RuntimeError("Admin not found")
        role_value = user.role.value if hasattr(user.role, "value") else user.role
        if role_value != "admin":
            raise RuntimeError("User is not an admin")
        user.hashed_password = auth.get_password_hash(new_password)
        if hasattr(user, "is_verified"):
            user.is_verified = True
        if hasattr(user, "onboarding_completed"):
            user.onboarding_completed = True
        db.commit()
        print("ok")
    finally:
        db.close()

if __name__ == "__main__":
    if len(sys.argv) >= 2 and sys.argv[1] == "reset_admin_password":
        if len(sys.argv) < 4:
            raise SystemExit("Usage: python -m app.seed reset_admin_password <email> <new_password>")
        reset_admin_password(sys.argv[2], sys.argv[3])
    else:
        seed_db()
