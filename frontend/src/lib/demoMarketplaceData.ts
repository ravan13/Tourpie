import type { Currency } from "@/context/LanguageContext";
import type {
  LocalizedText,
  MarketplaceAgency,
  MarketplaceDateRange,
  MarketplacePackage,
  MarketplaceSocialLinks,
} from "@/lib/marketplace";

type CompanySeed = {
  id: number;
  name: string;
  initials: string;
  primary: string;
  accent: string;
  description: string;
  country: string;
  officeAddress: string;
  website: string;
  email: string;
  phone: string;
  rating: number;
  reviewCount: number;
  years: number;
  verified: boolean;
  coverImage: string;
  socials: MarketplaceSocialLinks;
  packages: PackageSeed[];
};

type PackageSeed = {
  title: string;
  destination: string;
  country: string;
  city: string;
  region: string;
  category: string;
  packageType: string;
  description: string;
  days: number;
  price: number;
  originalPrice?: number;
  rating: number;
  reviews: number;
  image: string;
  services: string[];
  dates: MarketplaceDateRange[];
  capacity: number;
};

const AZN: Currency = "AZN";

function i18n(en: string, az: string, ru: string, tr: string): LocalizedText {
  return { en, az, ru, tr };
}

const companyI18nByName: Record<string, { name: LocalizedText; description: LocalizedText }> = {
  "Wanderlust Travel": {
    name: i18n("Wanderlust Travel", "Wanderlust Travel", "Wanderlust Travel (Вандерласт Трэвел)", "Wanderlust Travel"),
    description: i18n(
      "Wanderlust Travel curates design-led European escapes, elevated beach retreats, and private cultural itineraries for travelers who want premium planning with a personal touch.",
      "Wanderlust Travel dizayna fokuslanan Avropa qaçışları, premium çimərlik istirahətləri və şəxsi mədəni marşrutlar hazırlayır — fərdi yanaşma ilə yüksək səviyyəli planlama istəyənlər üçün.",
      "Wanderlust Travel предлагает стильные европейские поездки, премиальные пляжные ретриты и приватные культурные маршруты — для тех, кто ценит персональный подход и высокий сервис.",
      "Wanderlust Travel; tasarım odaklı Avrupa kaçamakları, premium sahil tatilleri ve özel kültür rotaları sunar — kişisel dokunuşla üst düzey planlama isteyenler için."
    ),
  },
  TravelGo: {
    name: i18n("TravelGo", "TravelGo", "TravelGo (ТрэвелГо)", "TravelGo"),
    description: i18n(
      "TravelGo focuses on relaxed, value-smart family holidays and sunny regional getaways with dependable logistics and warm support.",
      "TravelGo rahat, qiymət-büdcə baxımından ağıllı ailə istirahətləri və günəşli regional qaçışlar təklif edir — etibarlı logistika və səmimi dəstəklə.",
      "TravelGo специализируется на спокойных семейных отпусках с хорошей ценностью и солнечных поездках по региону — с надежной логистикой и внимательной поддержкой.",
      "TravelGo; rahat, fiyat/performans odaklı aile tatilleri ve güneşli yakın destinasyon kaçamaklarına odaklanır — güvenilir lojistik ve sıcak destekle."
    ),
  },
  Tripify: {
    name: i18n("Tripify", "Tripify", "Tripify (Трипифай)", "Tripify"),
    description: i18n(
      "Tripify designs stylish city breaks, trend-forward culture trips, and fast-paced premium itineraries for modern explorers.",
      "Tripify müasir səyahətçilər üçün dəbli şəhər turları, trend mədəniyyət səfərləri və dinamik premium marşrutlar hazırlayır.",
      "Tripify создаёт стильные сити-брейки, актуальные культурные поездки и динамичные премиальные маршруты для современных путешественников.",
      "Tripify; modern gezginler için şık şehir kaçamakları, trend kültür turları ve tempolu premium rotalar tasarlar."
    ),
  },
  ExploreMore: {
    name: i18n("ExploreMore", "ExploreMore", "ExploreMore (ЭксплорМор)", "ExploreMore"),
    description: i18n(
      "ExploreMore specializes in adventure, nature, and active small-group itineraries packed with scenery, movement, and memorable outdoor moments.",
      "ExploreMore macəra, təbiət və aktiv kiçik qrup marşrutlarında ixtisaslaşıb — mənzərə, hərəkət və unudulmaz outdoor anları ilə dolu.",
      "ExploreMore специализируется на приключениях, природе и активных маршрутах для небольших групп — с видами, движением и яркими моментами на свежем воздухе.",
      "ExploreMore; macera, doğa ve aktif küçük grup programlarında uzmanlaşır — manzara, hareket ve unutulmaz açık hava anlarıyla."
    ),
  },
  GlobalTrips: {
    name: i18n("GlobalTrips", "GlobalTrips", "GlobalTrips (ГлобалТрипс)", "GlobalTrips"),
    description: i18n(
      "GlobalTrips brings together polished long-haul leisure, honeymoon excellence, and resort-focused premium escapes with strong service standards.",
      "GlobalTrips uzaq məsafəli istirahət səfərləri, bal ayı paketləri və resort yönümlü premium qaçışları yüksək xidmət standartları ilə birləşdirir.",
      "GlobalTrips объединяет продуманные дальние поездки для отдыха, сильные honeymoon-программы и премиальные resort-форматы с высоким уровнем сервиса.",
      "GlobalTrips; uzun mesafe tatilleri, balayı programları ve resort odaklı premium kaçamakları güçlü hizmet standartlarıyla bir araya getirir."
    ),
  },
  SkyJourney: {
    name: i18n("SkyJourney", "SkyJourney", "SkyJourney (СкайДжорни)", "SkyJourney"),
    description: i18n(
      "SkyJourney combines alpine escapes, design-conscious city breaks, and premium cold-season planning for travelers who love crisp air and iconic skylines.",
      "SkyJourney alp dağları qaçışlarını, dizayna həssas şəhər turlarını və soyuq mövsüm üçün premium planlamanı birləşdirir — təmiz hava və ikonik panoramalar sevənlər üçün.",
      "SkyJourney сочетает альпийские поездки, стильные сити-брейки и премиальное планирование холодного сезона — для тех, кто любит свежий воздух и легендарные панорамы.",
      "SkyJourney; alp kaçamaklarını, tasarım odaklı şehir tatillerini ve soğuk sezon için premium planlamayı birleştirir — temiz hava ve ikonik manzaraları sevenler için."
    ),
  },
};

const geoI18n = {
  countries: {
    Turkey: i18n("Turkey", "Türkiyə", "Турция", "Türkiye"),
    Italy: i18n("Italy", "İtaliya", "Италия", "İtalya"),
    France: i18n("France", "Fransa", "Франция", "Fransa"),
    Greece: i18n("Greece", "Yunanıstan", "Греция", "Yunanistan"),
    Georgia: i18n("Georgia", "Gürcüstan", "Грузия", "Gürcistan"),
    Azerbaijan: i18n("Azerbaijan", "Azərbaycan", "Азербайджан", "Azerbaycan"),
    Egypt: i18n("Egypt", "Misir", "Египет", "Mısır"),
    Maldives: i18n("Maldives", "Maldivlər", "Мальдивы", "Maldivler"),
    UAE: i18n("UAE", "BƏƏ", "ОАЭ", "BAE"),
    Spain: i18n("Spain", "İspaniya", "Испания", "İspanya"),
    Japan: i18n("Japan", "Yaponiya", "Япония", "Japonya"),
    Thailand: i18n("Thailand", "Tailand", "Таиланд", "Tayland"),
    Indonesia: i18n("Indonesia", "İndoneziya", "Индонезия", "Endonezya"),
    Switzerland: i18n("Switzerland", "İsveçrə", "Швейцария", "İsviçre"),
    Montenegro: i18n("Montenegro", "Monteneqro", "Черногория", "Karadağ"),
  } satisfies Record<string, LocalizedText>,
  cities: {
    Istanbul: i18n("Istanbul", "İstanbul", "Стамбул", "İstanbul"),
    Positano: i18n("Positano", "Pozitano", "Позитано", "Positano"),
    Paris: i18n("Paris", "Paris", "Париж", "Paris"),
    Oia: i18n("Oia", "Oia", "Ия", "Oia"),
    Venice: i18n("Venice", "Venesiya", "Венеция", "Venedik"),
    Goreme: i18n("Goreme", "Göreme", "Гёреме", "Göreme"),
    Nice: i18n("Nice", "Nitsa", "Ницца", "Nice"),
    Antalya: i18n("Antalya", "Antalya", "Анталья", "Antalya"),
    "Sharm El Sheikh": i18n("Sharm El Sheikh", "Şarm əl-Şeyx", "Шарм-эль-Шейх", "Şarm El-Şeyh"),
    Batumi: i18n("Batumi", "Batumi", "Батуми", "Batum"),
    Budva: i18n("Budva", "Budva", "Будва", "Budva"),
    Gabala: i18n("Gabala", "Qəbələ", "Габала", "Gabala"),
    Baku: i18n("Baku", "Bakı", "Баку", "Bakü"),
    Tbilisi: i18n("Tbilisi", "Tbilisi", "Тбилиси", "Tiflis"),
    Dubai: i18n("Dubai", "Dubay", "Дубай", "Dubai"),
    Tokyo: i18n("Tokyo", "Tokio", "Токио", "Tokyo"),
    Barcelona: i18n("Barcelona", "Barselona", "Барселона", "Barselona"),
    Milan: i18n("Milan", "Milan", "Милан", "Milano"),
    Madrid: i18n("Madrid", "Madrid", "Мадрид", "Madrid"),
    Osaka: i18n("Osaka", "Osaka", "Осака", "Osaka"),
    Phuket: i18n("Phuket", "Phuket", "Пхукет", "Phuket"),
    Ubud: i18n("Ubud", "Ubud", "Убуд", "Ubud"),
    Interlaken: i18n("Interlaken", "Interlaken", "Интерлакен", "Interlaken"),
    Gudauri: i18n("Gudauri", "Gudauri", "Гудаури", "Gudauri"),
    "Chiang Mai": i18n("Chiang Mai", "Çianq May", "Чиангмай", "Chiang Mai"),
    Lankaran: i18n("Lankaran", "Lənkəran", "Ленкорань", "Lenkeran"),
    "Koh Samui": i18n("Koh Samui", "Koh Samui", "Ко Самуи", "Koh Samui"),
    Mykonos: i18n("Mykonos", "Mikonos", "Миконос", "Mikonos"),
    Cairo: i18n("Cairo", "Qahirə", "Каир", "Kahire"),
    Rome: i18n("Rome", "Roma", "Рим", "Roma"),
    Corfu: i18n("Corfu", "Korfu", "Корфу", "Korfu"),
    Zermatt: i18n("Zermatt", "Zermatt", "Церматт", "Zermatt"),
    Zurich: i18n("Zurich", "Sürix", "Цюрих", "Zürih"),
    Sapporo: i18n("Sapporo", "Sapporo", "Саппоро", "Sapporo"),
    Kyoto: i18n("Kyoto", "Kyoto", "Киото", "Kyoto"),
    Kayseri: i18n("Kayseri", "Kayseri", "Кайсери", "Kayseri"),
    "Male Atoll": i18n("Male Atoll", "Male Atoll", "Атолл Мале", "Male Atoll"),
  } satisfies Record<string, LocalizedText>,
  destinations: {
    "Amalfi Coast": i18n("Amalfi Coast", "Amalfi sahili", "Амальфитанское побережье", "Amalfi Sahili"),
    Santorini: i18n("Santorini", "Santorini", "Санторини", "Santorini"),
    Venice: i18n("Venice", "Venesiya", "Венеция", "Venedik"),
    Cappadocia: i18n("Cappadocia", "Kappadokiya", "Каппадокия", "Kapadokya"),
    Nice: i18n("Nice", "Nitsa", "Ницца", "Nice"),
    Antalya: i18n("Antalya", "Antalya", "Анталья", "Antalya"),
    "Sharm El Sheikh": i18n("Sharm El Sheikh", "Şarm əl-Şeyx", "Шарм-эль-Шейх", "Şarm El-Şeyh"),
    Batumi: i18n("Batumi", "Batumi", "Батуми", "Batum"),
    Budva: i18n("Budva", "Budva", "Будва", "Budva"),
    Gabala: i18n("Gabala", "Qəbələ", "Габала", "Gabala"),
    Baku: i18n("Baku", "Bakı", "Баку", "Bakü"),
    Tbilisi: i18n("Tbilisi", "Tbilisi", "Тбилиси", "Tiflis"),
    Dubai: i18n("Dubai", "Dubay", "Дубай", "Dubai"),
    Tokyo: i18n("Tokyo", "Tokio", "Токио", "Tokyo"),
    Barcelona: i18n("Barcelona", "Barselona", "Барселона", "Barselona"),
    Milan: i18n("Milan", "Milan", "Милан", "Milano"),
    Madrid: i18n("Madrid", "Madrid", "Мадрид", "Madrid"),
    Osaka: i18n("Osaka", "Osaka", "Осака", "Osaka"),
    Phuket: i18n("Phuket", "Phuket", "Пхукет", "Phuket"),
    Bali: i18n("Bali", "Bali", "Бали", "Bali"),
    Interlaken: i18n("Interlaken", "Interlaken", "Интерлакен", "Interlaken"),
    Gudauri: i18n("Gudauri", "Gudauri", "Гудаури", "Gudauri"),
    "Chiang Mai": i18n("Chiang Mai", "Çianq May", "Чиангмай", "Chiang Mai"),
    Lankaran: i18n("Lankaran", "Lənkəran", "Ленкорань", "Lenkeran"),
    "Koh Samui": i18n("Koh Samui", "Koh Samui", "Ко Самуи", "Koh Samui"),
    Maldives: i18n("Maldives", "Maldivlər", "Мальдивы", "Maldivler"),
    Mykonos: i18n("Mykonos", "Mikonos", "Миконос", "Mikonos"),
    Cairo: i18n("Cairo", "Qahirə", "Каир", "Kahire"),
    Rome: i18n("Rome", "Roma", "Рим", "Roma"),
    Corfu: i18n("Corfu", "Korfu", "Корфу", "Korfu"),
    Zermatt: i18n("Zermatt", "Zermatt", "Церматт", "Zermatt"),
    Zurich: i18n("Zurich", "Sürix", "Цюрих", "Zürih"),
    Sapporo: i18n("Sapporo", "Sapporo", "Саппоро", "Sapporo"),
    Kyoto: i18n("Kyoto", "Kyoto", "Киото", "Kyoto"),
    Kayseri: i18n("Kayseri", "Kayseri", "Кайсери", "Kayseri"),
    Paris: i18n("Paris", "Paris", "Париж", "Paris"),
    Istanbul: i18n("Istanbul", "İstanbul", "Стамбул", "İstanbul"),
  } satisfies Record<string, LocalizedText>,
};

const packageI18nByTitle: Record<string, { title: LocalizedText; description: LocalizedText }> = {
  "Bosphorus Luxe Escape": {
    title: i18n("Bosphorus Luxe Escape", "Boğaziçi Lüks Qaçış", "Люксовый отдых на Босфоре", "Boğaz'da Lüks Kaçamak"),
    description: i18n(
      "Five-star Bosphorus stay with private yacht sunset cruise, concierge shopping, and curated dining reservations.",
      "Boğaziçində 5 ulduzlu yerləşmə, şəxsi yaxtada günbatımı kruizi, concierge shopping və seçilmiş restoran rezervləri.",
      "Пятизвёздочное проживание у Босфора, приватный яхтенный круиз на закате, concierge-шопинг и продуманные бронирования ресторанов.",
      "Boğaz manzaralı 5 yıldızlı konaklama, özel yatla gün batımı turu, concierge alışveriş desteği ve seçkin restoran rezervasyonları."
    ),
  },
  "Amalfi Coast Signature Week": {
    title: i18n("Amalfi Coast Signature Week", "Amalfi sahili — İmza Həftəsi", "Амальфи: фирменная неделя", "Amalfi Sahili İmza Haftası"),
    description: i18n(
      "A romantic coastal itinerary with cliffside accommodation, Amalfi cruising, and elevated Italian dining moments.",
      "Uçurum kənarı otellərdə yerləşmə, Amalfi üzrə qayıq gəzintisi və yüksək səviyyəli italyan mətbəxi ilə romantik sahil marşrutu.",
      "Романтичный маршрут по побережью: отели на скалах, прогулка по Амальфи на лодке и лучшие итальянские гастро-впечатления.",
      "Uçurum üzeri konaklama, Amalfi tekne gezisi ve seçkin İtalyan lezzetleriyle romantik bir sahil rotası."
    ),
  },
  "Paris Art & Boutique Retreat": {
    title: i18n("Paris Art & Boutique Retreat", "Paris — İncəsənət və Butik İstirahət", "Париж: арт и бутик-ретрит", "Paris Sanat & Butik Kaçamak"),
    description: i18n(
      "A museum-rich Paris program with boutique hotel nights, Seine moments, and priority cultural access.",
      "Butik otel gecələri, Sena sahilində xüsusi anlar və mədəniyyət obyektlərinə prioritet girişlə muzeylərlə zəngin Paris proqramı.",
      "Парижская программа с упором на музеи: бутик-отель, прогулки у Сены и приоритетный доступ к культурным объектам.",
      "Müze odaklı Paris programı: butik otel konaklaması, Seine anları ve kültürel noktalara öncelikli giriş."
    ),
  },
  "Santorini Sunset Honeymoon": {
    title: i18n("Santorini Sunset Honeymoon", "Santorini — Günbatımı Balayı", "Санторини: медовый месяц на закате", "Santorini Gün Batımı Balayı"),
    description: i18n(
      "Iconic caldera views, private sunset tasting, and a slow luxury island rhythm tailored for couples.",
      "İkonik kaldera mənzərələri, şəxsi günbatımı dequstasiyası və cütlüklər üçün hazırlanmış sakit lüks ada ritmi.",
      "Знаменитые виды кальдеры, приватная дегустация на закате и размеренный люксовый ритм острова для двоих.",
      "İkonik kaldera manzaraları, özel gün batımı tadımı ve çiftlere özel sakin lüks ada temposu."
    ),
  },
  "Venice & Verona Romance Duo": {
    title: i18n("Venice & Verona Romance Duo", "Venesiya və Verona — Romantik Duo", "Венеция и Верона: романтический дуэт", "Venedik & Verona Romantik İkili"),
    description: i18n(
      "A polished twin-city journey with canals, opera ambiance, and effortless premium transfers.",
      "Kanallar, opera ab-havası və rahat premium transferlərlə iki şəhərli zərif səyahət.",
      "Продуманное путешествие по двум городам: каналы, оперная атмосфера и комфортные премиальные трансферы.",
      "Kanallar, opera atmosferi ve zahmetsiz premium transferlerle iki şehirli şık bir rota."
    ),
  },
  "Cappadocia Balloon & Cave Stay": {
    title: i18n("Cappadocia Balloon & Cave Stay", "Kappadokiya — Şar və Mağara Oteli", "Каппадокия: шар и пещерный отель", "Kapadokya Balon & Mağara Otel"),
    description: i18n(
      "Sunrise balloons, cave hotel nights, and a premium small-group route through Cappadocia’s dreamscape.",
      "Günəş doğumu şar uçuşu, mağara oteldə gecələr və Kappadokiyanın möcüzə mənzərələrində premium kiçik qrup marşrutu.",
      "Шары на рассвете, ночи в пещерном отеле и премиальный маршрут малой группой по сказочным пейзажам Каппадокии.",
      "Gün doğumu balon uçuşu, mağara otelde konaklama ve Kapadokya’nın masalsı manzaralarında premium küçük grup rotası."
    ),
  },
  "French Riviera Design Escape": {
    title: i18n("French Riviera Design Escape", "Fransız Rivierası — Dizayn Qaçışı", "Французская Ривьера: дизайн-отдых", "Fransız Rivierası Tasarım Kaçamağı"),
    description: i18n(
      "Mediterranean coastline, design hotel comforts, and curated Riviera experiences with a polished luxury feel.",
      "Aralıq dənizi sahili, dizayn otel komfortu və seçilmiş Riviera təcrübələri — zərif lüks hissi ilə.",
      "Средиземноморское побережье, комфорт дизайн-отеля и отобранные впечатления Ривьеры — с лёгким оттенком люкса.",
      "Akdeniz kıyıları, tasarım otel konforu ve özenle seçilmiş Riviera deneyimleriyle zarif bir lüks hissi."
    ),
  },
  "Antalya Family Sun Week": {
    title: i18n("Antalya Family Sun Week", "Antalya — Ailə Günəşi Həftəsi", "Анталья: семейная солнечная неделя", "Antalya Aile Güneşi Haftası"),
    description: i18n(
      "An easy family beach week with kid-friendly resort facilities, airport support, and hassle-free transfers.",
      "Uşaqlar üçün uyğun resort imkanları, hava limanı dəstəyi və rahat transferlərlə yüngül ailə çimərlik həftəsi.",
      "Лёгкая семейная пляжная неделя: дружелюбный к детям resort, помощь в аэропорту и удобные трансферы.",
      "Çocuk dostu resort imkânları, havalimanı desteği ve sorunsuz transferlerle kolay bir aile plaj haftası."
    ),
  },
  "Sharm El Sheikh Coral Family Trip": {
    title: i18n("Sharm El Sheikh Coral Family Trip", "Şarm əl-Şeyx — Mərcanlı Ailə Səfəri", "Шарм-эль-Шейх: семейная поездка к рифам", "Şarm El-Şeyh Mercan Aile Tatili"),
    description: i18n(
      "Red Sea sunshine with all-inclusive ease, snorkeling moments, and comfortable family pacing.",
      "Qırmızı dəniz günəşi, all-inclusive rahatlığı, snorkeling anları və ailə üçün komfortlu temp.",
      "Солнце Красного моря, all-inclusive комфорт, снорклинг и удобный ритм для всей семьи.",
      "Kızıldeniz güneşi, all-inclusive rahatlığı, şnorkel anları ve aileye uygun konforlu tempo."
    ),
  },
  "Batumi Weekend with the Kids": {
    title: i18n("Batumi Weekend with the Kids", "Batumi — Uşaqlarla Həftəsonu", "Батуми: уикенд с детьми", "Batum Çocuklarla Hafta Sonu"),
    description: i18n(
      "A short and playful Batumi reset combining seaside strolls, modern family hotel comfort, and smooth transfers.",
      "Sahil gəzintiləri, müasir ailə oteli rahatlığı və rahat transferlərlə qısa və əyləncəli Batumi fasiləsi.",
      "Короткая и лёгкая перезагрузка в Батуми: набережная, комфортный семейный отель и удобные трансферы.",
      "Kısa ve keyifli bir Batum molası: sahil yürüyüşleri, modern aile oteli konforu ve rahat transferler."
    ),
  },
  "Budva Coast Easy Escape": {
    title: i18n("Budva Coast Easy Escape", "Budva sahili — Rahat Qaçış", "Будва: лёгкий отдых на побережье", "Budva Sahili Kolay Kaçamak"),
    description: i18n(
      "Relaxed Adriatic beaches, family-friendly hotel comfort, and a breezy coastal pace from arrival to departure.",
      "Adriatik çimərlikləri, ailə üçün uyğun otel rahatlığı və gəlişdən dönüşə qədər yüngül sahil tempi.",
      "Спокойные адриатические пляжи, комфортный отель для семьи и лёгкий ритм отдыха от приезда до отъезда.",
      "Sakin Adriyatik plajları, aile dostu otel konforu ve gelişten dönüşe kadar hafif bir sahil temposu."
    ),
  },
  "Gabala Family Nature Break": {
    title: i18n("Gabala Family Nature Break", "Qəbələ — Ailə Təbiət Fasiləsi", "Габала: семейный отдых на природе", "Gabala Aile Doğa Molası"),
    description: i18n(
      "Mountain air, lakeside scenery, and a calm family rhythm with resort comfort close to nature.",
      "Dağ havası, göl kənarı mənzərələr və təbiətə yaxın resort rahatlığı ilə sakit ailə ritmi.",
      "Горный воздух, виды у озера и спокойный семейный ритм с комфортом resort рядом с природой.",
      "Dağ havası, göl manzaraları ve doğaya yakın resort konforuyla sakin bir aile temposu."
    ),
  },
  "Baku Old City & Sea Boulevard": {
    title: i18n("Baku Old City & Sea Boulevard", "Bakı — İçərişəhər və Bulvar", "Баку: Ичери-шехер и приморский бульвар", "Bakü İçeri Şehir & Sahil Bulvarı"),
    description: i18n(
      "A smart city break for families wanting heritage, modern skyline views, and a very easy urban itinerary.",
      "Tarix, müasir skyline mənzərələri və çox rahat şəhər marşrutu istəyən ailələr üçün ağıllı city break.",
      "Удобный сити-брейк для семьи: наследие, современный skyline и очень лёгкий городской маршрут.",
      "Miras, modern skyline ve çok kolay bir şehir planı isteyen aileler için akıllı bir city break."
    ),
  },
  "Tbilisi & Mtskheta Discovery": {
    title: i18n("Tbilisi & Mtskheta Discovery", "Tbilisi və Mtsxeta — Kəşf", "Тбилиси и Мцхета: знакомство", "Tiflis & Mtsheta Keşfi"),
    description: i18n(
      "Historic churches, warm hospitality, and a comfortable two-city Georgian discovery for mixed-age groups.",
      "Tarixi kilsələr, qonaqpərvərlik və müxtəlif yaş qrupları üçün rahat iki şəhərli Gürcüstan kəşfi.",
      "Исторические храмы, тёплое гостеприимство и комфортное двухгородское знакомство с Грузией для разных возрастов.",
      "Tarihi kiliseler, sıcak misafirperverlik ve farklı yaş grupları için konforlu iki şehirli Gürcistan keşfi."
    ),
  },
  "Dubai Skyline Signature": {
    title: i18n("Dubai Skyline Signature", "Dubay — Skyline İmza Paketi", "Дубай: фирменный skyline-тур", "Dubai Skyline İmza"),
    description: i18n(
      "Downtown towers, desert contrast, and a polished luxury city program with contemporary style throughout.",
      "Downtown göydələnləri, səhranın kontrastı və müasir üslubda zərif lüks şəhər proqramı.",
      "Небоскрёбы даунтауна, контраст пустыни и продуманный люксовый городской план в современном стиле.",
      "Downtown gökdelenleri, çöl kontrastı ve modern tarzda özenli bir lüks şehir programı."
    ),
  },
  "Kyoto & Tokyo Modern Japan": {
    title: i18n("Kyoto & Tokyo Modern Japan", "Kyoto və Tokio — Müasir Yaponiya", "Киото и Токио: современная Япония", "Kyoto & Tokyo Modern Japonya"),
    description: i18n(
      "A two-city Japan journey balancing neon energy, temple calm, and efficient premium transport.",
      "Neon enerji, məbəd sakitliyi və effektiv premium nəqliyyat balansı ilə iki şəhərli Yaponiya səyahəti.",
      "Двухгородской маршрут по Японии: неоновая энергия, спокойствие храмов и эффективный премиальный транспорт.",
      "Neon enerjisi, tapınak sakinliği ve verimli premium ulaşım dengesiyle iki şehirli Japonya rotası."
    ),
  },
  "Barcelona Creative City Break": {
    title: i18n("Barcelona Creative City Break", "Barselona — Kreativ Şəhər Qaçışı", "Барселона: творческий сити-брейк", "Barselona Yaratıcı City Break"),
    description: i18n(
      "Architecture, rooftop evenings, and an energetic Mediterranean city rhythm with strong lifestyle appeal.",
      "Memarlıq, rooftop axşamları və Aralıq dənizi şəhərinin enerjili ritmi — güclü lifestyle ab-havası ilə.",
      "Архитектура, вечера на rooftops и энергичный средиземноморский ритм города с яркой lifestyle-атмосферой.",
      "Mimari, rooftop akşamları ve güçlü lifestyle havasıyla enerjik bir Akdeniz şehir temposu."
    ),
  },
  "Milan Fashion Weekend": {
    title: i18n("Milan Fashion Weekend", "Milan — Moda Həftəsonu", "Милан: модный уикенд", "Milano Moda Hafta Sonu"),
    description: i18n(
      "A slick short break for shopping, galleries, and premium city style in the heart of Milan.",
      "Milanın mərkəzində alış-veriş, qalereyalar və premium şəhər üslubu üçün dəbli qısa səfər.",
      "Стильный короткий выезд: шопинг, галереи и премиальная городская эстетика в самом центре Милана.",
      "Milano’nun kalbinde alışveriş, galeriler ve premium şehir stilini bir araya getiren şık kısa bir kaçamak."
    ),
  },
  "Paris & Versailles Chic Escape": {
    title: i18n("Paris & Versailles Chic Escape", "Paris və Versal — Şıq Qaçış", "Париж и Версаль: шиканый отдых", "Paris & Versailles Şık Kaçamak"),
    description: i18n(
      "A refined city plan with boutique comfort, Versailles access, and elegant Parisian downtime.",
      "Butik komfort, Versala giriş və zərif Paris istirahəti ilə rafinə şəhər planı.",
      "Утончённый городской план: бутик-комфорт, посещение Версаля и элегантный парижский отдых.",
      "Butik konfor, Versailles ziyareti ve zarif Paris molalarıyla rafine bir şehir planı."
    ),
  },
  "Madrid Culture & Tapas Route": {
    title: i18n("Madrid Culture & Tapas Route", "Madrid — Mədəniyyət və Tapas Marşrutu", "Мадрид: культура и тапас-маршрут", "Madrid Kültür & Tapas Rotası"),
    description: i18n(
      "Museums, evening plazas, and authentic tapas experiences on a smooth urban culture itinerary.",
      "Muzeylər, axşam meydanları və autentik tapas təcrübələri ilə rahat şəhər mədəniyyəti marşrutu.",
      "Музеи, вечерние площади и аутентичные тапас-впечатления в удобном городском культурном маршруте.",
      "Müzeler, akşam meydanları ve otantik tapas deneyimleriyle akıcı bir şehir kültürü rotası."
    ),
  },
  "Osaka Lights & Street Food": {
    title: i18n("Osaka Lights & Street Food", "Osaka — İşıqlar və Street Food", "Осака: огни и стрит-фуд", "Osaka Işıkları & Sokak Lezzetleri"),
    description: i18n(
      "A food-forward Japan city break with efficient logistics, neon nights, and memorable neighborhood energy.",
      "Effektiv logistika, neon gecələri və yadda qalan məhəllə enerjisi ilə yemək yönümlü Yaponiya city break.",
      "Городской выезд по Японии с акцентом на еду: удобная логистика, неоновые ночи и яркая энергия районов.",
      "Yemek odaklı Japonya city break’i: verimli lojistik, neon geceler ve unutulmaz mahalle enerjisi."
    ),
  },
  "Phuket Island Adventure": {
    title: i18n("Phuket Island Adventure", "Phuket — Ada Macərası", "Пхукет: островное приключение", "Phuket Ada Macerası"),
    description: i18n(
      "Island hopping, speedboat energy, and easy resort recovery for travelers who want fun and movement.",
      "Ada-hopping, sürətli qayıq enerjisi və əyləncə sevənlər üçün resortda rahat bərpa günləri.",
      "Айленд-хоппинг, драйв скоростных лодок и комфортный отдых в resort для тех, кто любит динамику и развлечения.",
      "Ada turları, sürat teknesi enerjisi ve eğlenceyi sevenler için resortta rahat toparlanma günleri."
    ),
  },
  "Bali Jungle & Beach Route": {
    title: i18n("Bali Jungle & Beach Route", "Bali — Cəngəllik və Çimərlik Marşrutu", "Бали: джунгли и пляжный маршрут", "Bali Orman & Plaj Rotası"),
    description: i18n(
      "Rice terraces, waterfalls, and beach club balance in a signature Bali active-escape format.",
      "Düyü terrası, şəlalələr və beach club balansı ilə imza Bali aktiv-qaçış formatı.",
      "Рисовые террасы, водопады и баланс beach club-отдыха в фирменном активном формате Бали.",
      "Pirinç tarlaları, şelaleler ve beach club dengesiyle imza Bali aktif kaçamak formatı."
    ),
  },
  "Interlaken Alpine Adventure": {
    title: i18n("Interlaken Alpine Adventure", "Interlaken — Alp Macərası", "Интерлакен: альпийское приключение", "Interlaken Alp Macerası"),
    description: i18n(
      "Swiss mountain railways, lake views, and active alpine days with polished logistics throughout.",
      "İsveçrə dağ qatarları, göl mənzərələri və zərif logistika ilə aktiv alp günləri.",
      "Швейцарские горные поезда, виды на озёра и активные альпийские дни с продуманной логистикой.",
      "İsviçre dağ trenleri, göl manzaraları ve özenli lojistikle aktif alp günleri."
    ),
  },
  "Gudauri Peaks & Trails": {
    title: i18n("Gudauri Peaks & Trails", "Gudauri — Zirvələr və Cığırlar", "Гудаури: вершины и тропы", "Gudauri Zirveler & Patikalar"),
    description: i18n(
      "Fresh mountain air, panoramic cable cars, and scenic hiking routes in the Caucasus highlands.",
      "Təmiz dağ havası, panoramik kanat yolu və Qafqaz yüksəkliklərində mənzərəli yürüş marşrutları.",
      "Свежий горный воздух, панорамные канатные дороги и живописные маршруты хайкинга в Кавказских горах.",
      "Temiz dağ havası, panoramik teleferik ve Kafkas yaylalarında manzaralı yürüyüş rotaları."
    ),
  },
  "Chiang Mai Active Escape": {
    title: i18n("Chiang Mai Active Escape", "Çianq May — Aktiv Qaçış", "Чиангмай: активный отдых", "Chiang Mai Aktif Kaçamak"),
    description: i18n(
      "Temple calm, ethical elephant experiences, and active northern Thailand days with balanced pacing.",
      "Məbəd sakitliyi, etik fil təcrübələri və balanslı temp ilə Şimali Tailandın aktiv günləri.",
      "Спокойствие храмов, этичные впечатления с слонами и активные дни на севере Таиланда в комфортном темпе.",
      "Tapınak sakinliği, etik fil deneyimleri ve dengeli tempoyla Kuzey Tayland’da aktif günler."
    ),
  },
  "Lankaran Forest & Coast Retreat": {
    title: i18n("Lankaran Forest & Coast Retreat", "Lənkəran — Meşə və Sahil İstirahəti", "Ленкорань: лес и побережье", "Lenkeran Orman & Sahil Dinlenmesi"),
    description: i18n(
      "Tea gardens, Hyrcanian forest edges, and gentle coastal calm in southern Azerbaijan.",
      "Çay bağları, Hirkan meşəsi kənarları və Azərbaycanın cənubunda sakit sahil atmosferi.",
      "Чайные плантации, окраины Гирканского леса и мягкое прибрежное спокойствие на юге Азербайджана.",
      "Çay bahçeleri, Hirkan ormanı kıyıları ve Azerbaycan’ın güneyinde yumuşak sahil huzuru."
    ),
  },
  "Koh Samui Beach & Kayak Days": {
    title: i18n("Koh Samui Beach & Kayak Days", "Koh Samui — Çimərlik və Kayak Günləri", "Ко Самуи: пляж и дни каяка", "Koh Samui Plaj & Kano Günleri"),
    description: i18n(
      "A softer tropical active break pairing golden beaches with kayaking and boat-day exploration.",
      "Qızılı çimərliklər, kayak və qayıq günü ilə daha yumşaq tropik aktiv fasilə.",
      "Более мягкий тропический актив-отдых: золотые пляжи, каякинг и прогулки на лодке.",
      "Altın plajları kano ve tekne günleriyle birleştiren daha yumuşak tropik aktif bir mola."
    ),
  },
  "Maldives Water Villa Bliss": {
    title: i18n("Maldives Water Villa Bliss", "Maldivlər — Su Üstü Villa Zövqü", "Мальдивы: блаженство водной виллы", "Maldivler Su Üstü Villa Keyfi"),
    description: i18n(
      "Overwater villas, turquoise lagoon time, and a polished honeymoon experience built for slow luxury.",
      "Su üstü villalar, firuzəyi laqun saatları və yavaş lüks üçün hazırlanmış zərif balayı təcrübəsi.",
      "Виллы над водой, время в бирюзовой лагуне и продуманный медовый месяц в стиле slow luxury.",
      "Su üstü villalar, turkuaz lagün zamanı ve slow luxury ruhunda özenli bir balayı deneyimi."
    ),
  },
  "Dubai Palm Premium Stay": {
    title: i18n("Dubai Palm Premium Stay", "Dubay Palm — Premium Yerləşmə", "Дубай Palm: премиальное проживание", "Dubai Palm Premium Konaklama"),
    description: i18n(
      "Palm-side luxury with beach club access, skyline dining, and seamless premium transfers.",
      "Palm sahilində lüks, beach club girişi, skyline-dinner və problemsiz premium transferlər.",
      "Люкс на Palm, доступ в beach club, ужины с видом на skyline и бесшовные премиальные трансферы.",
      "Palm bölgesinde lüks konaklama, beach club erişimi, skyline manzaralı yemekler ve sorunsuz premium transferler."
    ),
  },
  "Mykonos Beach Club Collection": {
    title: i18n("Mykonos Beach Club Collection", "Mikonos — Beach Club Kolleksiyası", "Миконос: коллекция beach club-отдыха", "Mikonos Beach Club Koleksiyonu"),
    description: i18n(
      "Whitewashed style, curated beach club days, and a premium island social vibe on Mykonos.",
      "Ağ-ağ üslub, seçilmiş beach club günləri və Mikonosda premium sosial ada atmosferi.",
      "Белоснежный стиль, отобранные дни в beach club и премиальная социальная атмосфера острова Миконос.",
      "Beyaz ada stili, seçilmiş beach club günleri ve Mikonos’ta premium sosyal ada havası."
    ),
  },
  "Mediterranean Cruise Discovery": {
    title: i18n("Mediterranean Cruise Discovery", "Aralıq dənizi — Kruiz Kəşfi", "Средиземноморье: круиз-открытие", "Akdeniz Kruvaziyer Keşfi"),
    description: i18n(
      "An elegant cruise format linking major Mediterranean highlights with floating-hotel comfort.",
      "Əsas Aralıq dənizi məkanlarını üzən-otel komfortu ilə birləşdirən zərif kruiz formatı.",
      "Элегантный круиз, соединяющий ключевые точки Средиземноморья с комфортом «плавучего отеля».",
      "Akdeniz’in öne çıkan noktalarını “yüzen otel” konforuyla birleştiren zarif bir kruvaziyer formatı."
    ),
  },
  "Cairo Icons & Nile Upgrade": {
    title: i18n("Cairo Icons & Nile Upgrade", "Qahirə — İkonlar və Nil Upgrade", "Каир: легенды и апгрейд по Нилу", "Kahire İkonları & Nil Upgrade"),
    description: i18n(
      "Pyramids, upgraded Nile touches, and a premium history-focused itinerary with extra comfort.",
      "Piramidlər, Nil üzrə upgrade toxunuşlar və əlavə komfortla premium tarix yönümlü marşrut.",
      "Пирамиды, улучшенные Nile-впечатления и премиальный маршрут по истории с дополнительным комфортом.",
      "Piramitler, Nil deneyiminde upgrade dokunuşlar ve ekstra konforla premium tarih odaklı bir rota."
    ),
  },
  "Rome & Tuscany Premium Pairing": {
    title: i18n("Rome & Tuscany Premium Pairing", "Roma və Toskana — Premium Uyğunluq", "Рим и Тоскана: премиальное сочетание", "Roma & Toskana Premium Eşleşme"),
    description: i18n(
      "Classic Italy with a higher-end feel, pairing Rome highlights with a soft Tuscan countryside finish.",
      "Roma highlights və Toskana kənd sakitliyi ilə birləşən daha yüksək səviyyəli klassik İtaliya.",
      "Классическая Италия в более премиальном формате: Рим + мягкое завершение в тосканской глубинке.",
      "Daha premium bir dokunuşla klasik İtalya: Roma öne çıkanları ve Toskana kırsalında yumuşak bir final."
    ),
  },
  "Corfu Blue Lagoon Holiday": {
    title: i18n("Corfu Blue Lagoon Holiday", "Korfu — Mavi Laqun Tətili", "Корфу: отпуск у голубой лагуны", "Korfu Mavi Lagün Tatili"),
    description: i18n(
      "A relaxed Greek island program with premium resort comfort and beautiful lagoon-focused days.",
      "Premium resort rahatlığı və laquna fokuslu gözəl günlərlə rahat Yunan ada proqramı.",
      "Спокойная греческая островная программа: премиальный комфорт resort и красивые дни у лагуны.",
      "Premium resort konforu ve lagün odaklı güzel günlerle rahat bir Yunan adası programı."
    ),
  },
  "Zermatt Alpine Snow Week": {
    title: i18n("Zermatt Alpine Snow Week", "Zermatt — Alp Qarı Həftəsi", "Церматт: альпийская снежная неделя", "Zermatt Alp Kar Haftası"),
    description: i18n(
      "A premium alpine week with Matterhorn views, stylish lodging, and smooth slope-day planning.",
      "Matterhorn mənzərələri, dəbli yerləşmə və rahat xizək günü planlaması ilə premium alp həftəsi.",
      "Премиальная альпийская неделя: виды на Маттерхорн, стильное проживание и комфортное планирование дней на склонах.",
      "Matterhorn manzaraları, şık konaklama ve rahat pist planlamasıyla premium bir alp haftası."
    ),
  },
  "Zurich Winter City Lights": {
    title: i18n("Zurich Winter City Lights", "Sürix — Qış Şəhər İşıqları", "Цюрих: зимние огни города", "Zürih Kış Şehir Işıkları"),
    description: i18n(
      "A crisp Swiss city break with lakefront elegance, festive streets, and premium urban comfort.",
      "Göl kənarı zəriflik, bayram ab-havası və premium şəhər rahatlığı ilə İsveçrə city break.",
      "Свежий швейцарский сити-брейк: элегантность у озера, праздничные улицы и премиальный городской комфорт.",
      "Göl kıyısı zarafeti, festivalli sokaklar ve premium şehir konforuyla ferah bir İsviçre city break’i."
    ),
  },
  "Hokkaido Powder Adventure": {
    title: i18n("Hokkaido Powder Adventure", "Hokkaydo — Powder Macərası", "Хоккайдо: приключение на пухлом снегу", "Hokkaido Powder Macerası"),
    description: i18n(
      "Deep powder, hot spring downtime, and a tightly planned Japan snow itinerary with premium support.",
      "Dərin powder qar, onsen (isti bulaq) istirahəti və premium dəstək ilə sıx planlanmış Yaponiya qış marşrutu.",
      "Глубокий пухляк, отдых в онсэнах и чётко спланированный снежный маршрут по Японии с премиальной поддержкой.",
      "Derin powder kar, onsen molaları ve premium destekle sıkı planlanmış Japonya kar rotası."
    ),
  },
  "Kyoto Winter Temples": {
    title: i18n("Kyoto Winter Temples", "Kyoto — Qış Məbədləri", "Киото: зимние храмы", "Kyoto Kış Tapınakları"),
    description: i18n(
      "A slower winter Japan route pairing Kyoto’s temple elegance with calm premium hospitality.",
      "Kyoto məbədlərinin zərifliyini sakit premium qonaqpərvərliklə birləşdirən yavaş qış Yaponiya marşrutu.",
      "Более спокойный зимний маршрут по Японии: храмовая элегантность Киото и тихий премиальный сервис.",
      "Kyoto’nun tapınak zarafetini sakin premium misafirperverlikle birleştiren daha yavaş bir kış Japonya rotası."
    ),
  },
  "Paris Winter Elegance": {
    title: i18n("Paris Winter Elegance", "Paris — Qış Zərifliyi", "Париж: зимняя элегантность", "Paris Kış Zarafeti"),
    description: i18n(
      "A refined Paris winter stay with boutique luxury, festive dinners, and elegant urban pacing.",
      "Butik lüks, bayram şam yeməkləri və zərif şəhər tempi ilə rafinə Paris qış istirahəti.",
      "Утончённый зимний Париж: бутик-люкс, праздничные ужины и элегантный городской ритм.",
      "Butik lüks, festivalli akşam yemekleri ve zarif şehir temposuyla rafine bir Paris kış konaklaması."
    ),
  },
  "Vienna to Venice Rail Duo": {
    title: i18n("Vienna to Venice Rail Duo", "Vyana–Venesiya — Dəmir Yol Duo", "Вена–Венеция: железнодорожный дуэт", "Viyana–Venedik Tren İkilisi"),
    description: i18n(
      "A scenic rail-linked dual-city route for travelers who want romance, architecture, and easy premium movement.",
      "Romantika, memarlıq və rahat premium hərəkət istəyənlər üçün mənzərəli dəmir yolu ilə iki şəhərli marşrut.",
      "Живописный двухгородской маршрут на поезде для тех, кто любит романтику, архитектуру и комфортное премиальное перемещение.",
      "Romantizm, mimari ve kolay premium ulaşım isteyenler için manzaralı tren bağlantılı iki şehir rotası."
    ),
  },
  "Erciyes Snow & Spa Weekend": {
    title: i18n("Erciyes Snow & Spa Weekend", "Erciyes — Qar və Spa Həftəsonu", "Эрджиес: снег и spa-уикенд", "Erciyes Kar & Spa Hafta Sonu"),
    description: i18n(
      "A short mountain-ski weekend with thermal recovery and a premium winter-lodge atmosphere.",
      "Termal bərpa və premium qış lodge ab-havası ilə qısa dağ-xizək həftəsonu.",
      "Короткий горнолыжный уикенд: термальное восстановление и премиальная атмосфера зимнего lodge.",
      "Termal toparlanma ve premium kış lodge atmosferiyle kısa bir dağ-kayak hafta sonu."
    ),
  },
};

function createLogoDataUrl(initials: string, primary: string, accent: string) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${primary}" />
          <stop offset="100%" stop-color="${accent}" />
        </linearGradient>
      </defs>
      <rect width="160" height="160" rx="38" fill="url(#g)" />
      <circle cx="124" cy="38" r="14" fill="rgba(255,255,255,0.22)" />
      <text x="80" y="92" text-anchor="middle" font-family="Poppins, Arial, sans-serif" font-size="54" font-weight="700" fill="#ffffff">${initials}</text>
    </svg>
  `;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function buildAgency(seed: CompanySeed): MarketplaceAgency {
  const i18nData = companyI18nByName[seed.name];
  return {
    id: seed.id,
    name: seed.name,
    description: seed.description,
    name_i18n: i18nData?.name,
    description_i18n: i18nData?.description,
    website: seed.website,
    contact_email: seed.email,
    phone_number: seed.phone,
    country: seed.country,
    office_address: seed.officeAddress,
    status: seed.verified ? "approved" : "pending",
    logo_url: createLogoDataUrl(seed.initials, seed.primary, seed.accent),
    cover_image_url: seed.coverImage,
    marketplace_rating: seed.rating,
    marketplace_review_count: seed.reviewCount,
    years_on_tourpie: seed.years,
    is_marketplace_verified: seed.verified,
    social_links: seed.socials,
  };
}

function buildPackage(seed: CompanySeed, agency: MarketplaceAgency, pkg: PackageSeed, index: number): MarketplacePackage {
  const price = pkg.price;
  const firstDate = pkg.dates[0];
  const lastDate = pkg.dates[pkg.dates.length - 1];
  const i18nData = packageI18nByTitle[pkg.title];
  /*const countryI18n = geoI18n.countries[pkg.country]; --- CHANGED!!! --- */
  /*const destinationI18n = geoI18n.destinations[pkg.destination]; --- CHANGED!!! --- */
  /*const cityI18n = geoI18n.cities[pkg.city]; --- CHANGED!!! --- */
  const countryI18n = geoI18n.countries[pkg.country as keyof typeof geoI18n.countries];
  const destinationI18n = geoI18n.destinations[pkg.destination as keyof typeof geoI18n.destinations];
const cityI18n = geoI18n.cities[pkg.city as keyof typeof geoI18n.cities];

  return {
    id: seed.id * 100 + index + 1,
    title: pkg.title,
    description: pkg.description,
    destination: pkg.destination,
    country: pkg.country,
    city: pkg.city,
    region: pkg.region,
    title_i18n: i18nData?.title,
    description_i18n: i18nData?.description,
    country_i18n: countryI18n,
    destination_i18n: destinationI18n,
    city_i18n: cityI18n,
    duration_days: pkg.days,
    capacity: pkg.capacity,
    price,
    base_currency: AZN,
    prices: { AZN: price },
    discount_price: pkg.originalPrice ?? null,
    status: "active",
    image_url: pkg.image,
    images: [pkg.image],
    category: pkg.category,
    package_type: pkg.packageType,
    highlights: pkg.services,
    included_services: pkg.services,
    start_date: firstDate.start,
    end_date: lastDate.end,
    available_date_ranges: pkg.dates,
    marketplace_rating: pkg.rating,
    marketplace_review_count: pkg.reviews,
    transportation_type: pkg.services.some((item) => item.toLowerCase().includes("flight")) ? "flight" : "transfer",
    hotel_rating: Math.max(4, Math.min(5, Math.round(pkg.rating))),
    created_at: `2026-0${(index % 6) + 2}-0${(index % 8) + 1}T10:00:00.000Z`,
    updated_at: `2026-0${(index % 6) + 3}-1${index % 8}T10:00:00.000Z`,
    agency_id: agency.id,
    agency: {
      id: agency.id,
      name: agency.name,
      description: agency.description,
      website: agency.website,
      contact_email: agency.contact_email,
    },
  };
}

const companySeeds: CompanySeed[] = [
  {
    id: 9101,
    name: "Wanderlust Travel",
    initials: "WT",
    primary: "#022A6B",
    accent: "#FF6A1A",
    description:
      "Wanderlust Travel curates design-led European escapes, elevated beach retreats, and private cultural itineraries for travelers who want premium planning with a personal touch.",
    country: "Azerbaijan",
    officeAddress: "Nizami Street 90, Baku, Azerbaijan",
    website: "https://wanderlust-demo.tourpie.example",
    email: "hello@wanderlust-demo.tourpie.example",
    phone: "+994 12 555 1101",
    rating: 4.9,
    reviewCount: 684,
    years: 6,
    verified: true,
    coverImage: "https://images.unsplash.com/photo-1491557345352-5929e343eb89?q=80&w=1600&auto=format&fit=crop",
    socials: {
      instagram: "https://instagram.com/wanderlustdemo",
      facebook: "https://facebook.com/wanderlustdemo",
      linkedin: "https://linkedin.com/company/wanderlustdemo",
      website: "https://wanderlust-demo.tourpie.example",
    },
    packages: [
      {
        title: "Bosphorus Luxe Escape",
        destination: "Istanbul",
        country: "Turkey",
        city: "Istanbul",
        region: "Marmara",
        category: "Luxury",
        packageType: "luxury",
        description: "Five-star Bosphorus stay with private yacht sunset cruise, concierge shopping, and curated dining reservations.",
        days: 4,
        price: 1280,
        originalPrice: 1460,
        rating: 4.9,
        reviews: 132,
        image: "https://images.unsplash.com/photo-1527838832700-5059252407fa?q=80&w=1400&auto=format&fit=crop",
        services: ["Boutique hotel", "Private transfer", "Breakfast", "Sunset yacht cruise", "Local guide", "Insurance"],
        dates: [
          { start: "2026-08-08", end: "2026-08-12", label: "8-12 Aug 2026" },
          { start: "2026-09-12", end: "2026-09-16", label: "12-16 Sep 2026" },
          { start: "2026-10-10", end: "2026-10-14", label: "10-14 Oct 2026" },
        ],
        capacity: 14,
      },
      {
        title: "Amalfi Coast Signature Week",
        destination: "Amalfi Coast",
        country: "Italy",
        city: "Positano",
        region: "Campania",
        category: "Honeymoon",
        packageType: "honeymoon",
        description: "A romantic coastal itinerary with cliffside accommodation, Amalfi cruising, and elevated Italian dining moments.",
        days: 7,
        price: 2640,
        originalPrice: 2890,
        rating: 5,
        reviews: 118,
        image: "https://images.unsplash.com/photo-1504608524841-42fe6f032b4b?q=80&w=1400&auto=format&fit=crop",
        services: ["Sea-view hotel", "Flights", "Breakfast", "Boat excursion", "Private driver", "Insurance"],
        dates: [
          { start: "2026-08-18", end: "2026-08-24", label: "18-24 Aug 2026" },
          { start: "2026-09-22", end: "2026-09-28", label: "22-28 Sep 2026" },
          { start: "2026-10-13", end: "2026-10-19", label: "13-19 Oct 2026" },
        ],
        capacity: 10,
      },
      {
        title: "Paris Art & Boutique Retreat",
        destination: "Paris",
        country: "France",
        city: "Paris",
        region: "Ile-de-France",
        category: "Culture",
        packageType: "culture",
        description: "A museum-rich Paris program with boutique hotel nights, Seine moments, and priority cultural access.",
        days: 5,
        price: 1790,
        rating: 4.8,
        reviews: 104,
        image: "https://images.unsplash.com/photo-1499856871958-5b9627545d1a?q=80&w=1400&auto=format&fit=crop",
        services: ["Boutique hotel", "Flights", "Breakfast", "Museum pass", "Walking guide", "Insurance"],
        dates: [
          { start: "2026-08-26", end: "2026-08-30", label: "26-30 Aug 2026" },
          { start: "2026-09-09", end: "2026-09-13", label: "9-13 Sep 2026" },
          { start: "2026-10-21", end: "2026-10-25", label: "21-25 Oct 2026" },
        ],
        capacity: 16,
      },
      {
        title: "Santorini Sunset Honeymoon",
        destination: "Santorini",
        country: "Greece",
        city: "Oia",
        region: "Cyclades",
        category: "Honeymoon",
        packageType: "honeymoon",
        description: "Iconic caldera views, private sunset tasting, and a slow luxury island rhythm tailored for couples.",
        days: 6,
        price: 2390,
        originalPrice: 2580,
        rating: 4.9,
        reviews: 127,
        image: "https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?q=80&w=1400&auto=format&fit=crop",
        services: ["Cave suite", "Flights", "Breakfast", "Private transfer", "Sunset tasting", "Insurance"],
        dates: [
          { start: "2026-08-14", end: "2026-08-19", label: "14-19 Aug 2026" },
          { start: "2026-09-17", end: "2026-09-22", label: "17-22 Sep 2026" },
          { start: "2026-10-08", end: "2026-10-13", label: "8-13 Oct 2026" },
        ],
        capacity: 12,
      },
      {
        title: "Venice & Verona Romance Duo",
        destination: "Venice",
        country: "Italy",
        city: "Venice",
        region: "Veneto",
        category: "City Break",
        packageType: "city_break",
        description: "A polished twin-city journey with canals, opera ambiance, and effortless premium transfers.",
        days: 5,
        price: 1680,
        rating: 4.7,
        reviews: 89,
        image: "https://images.unsplash.com/photo-1516483638261-f4dbaf036963?q=80&w=1400&auto=format&fit=crop",
        services: ["Canal hotel", "Flights", "Breakfast", "Rail tickets", "City pass", "Insurance"],
        dates: [
          { start: "2026-08-05", end: "2026-08-09", label: "5-9 Aug 2026" },
          { start: "2026-09-05", end: "2026-09-09", label: "5-9 Sep 2026" },
          { start: "2026-10-02", end: "2026-10-06", label: "2-6 Oct 2026" },
        ],
        capacity: 18,
      },
      {
        title: "Cappadocia Balloon & Cave Stay",
        destination: "Cappadocia",
        country: "Turkey",
        city: "Goreme",
        region: "Central Anatolia",
        category: "Nature",
        packageType: "nature",
        description: "Sunrise balloons, cave hotel nights, and a premium small-group route through Cappadocia’s dreamscape.",
        days: 4,
        price: 1490,
        originalPrice: 1590,
        rating: 4.8,
        reviews: 96,
        image: "https://images.unsplash.com/photo-1641047771167-fb7dbb8f0fe1?q=80&w=1400&auto=format&fit=crop",
        services: ["Cave hotel", "Flights", "Breakfast", "Balloon flight", "Guide", "Insurance"],
        dates: [
          { start: "2026-08-20", end: "2026-08-23", label: "20-23 Aug 2026" },
          { start: "2026-09-14", end: "2026-09-17", label: "14-17 Sep 2026" },
          { start: "2026-10-16", end: "2026-10-19", label: "16-19 Oct 2026" },
        ],
        capacity: 12,
      },
      {
        title: "French Riviera Design Escape",
        destination: "Nice",
        country: "France",
        city: "Nice",
        region: "Provence-Alpes-Cote d'Azur",
        category: "Luxury",
        packageType: "luxury",
        description: "Mediterranean coastline, design hotel comforts, and curated Riviera experiences with a polished luxury feel.",
        days: 6,
        price: 2240,
        rating: 4.8,
        reviews: 92,
        image: "https://images.unsplash.com/photo-1500375592092-40eb2168fd21?q=80&w=1400&auto=format&fit=crop",
        services: ["Design hotel", "Flights", "Breakfast", "Private transfer", "Beach club access", "Insurance"],
        dates: [
          { start: "2026-08-28", end: "2026-09-02", label: "28 Aug-2 Sep 2026" },
          { start: "2026-09-25", end: "2026-09-30", label: "25-30 Sep 2026" },
          { start: "2026-10-23", end: "2026-10-28", label: "23-28 Oct 2026" },
        ],
        capacity: 14,
      },
    ],
  },
  {
    id: 9102,
    name: "TravelGo",
    initials: "TG",
    primary: "#0B4BB8",
    accent: "#24C3B5",
    description:
      "TravelGo focuses on relaxed, value-smart family holidays and sunny regional getaways with dependable logistics and warm support.",
    country: "Georgia",
    officeAddress: "Rustaveli Avenue 18, Tbilisi, Georgia",
    website: "https://travelgo-demo.tourpie.example",
    email: "care@travelgo-demo.tourpie.example",
    phone: "+995 32 255 2202",
    rating: 4.6,
    reviewCount: 512,
    years: 4,
    verified: true,
    coverImage: "https://images.unsplash.com/photo-1468413253725-0d5181091126?q=80&w=1600&auto=format&fit=crop",
    socials: {
      instagram: "https://instagram.com/travelgodemo",
      facebook: "https://facebook.com/travelgodemo",
      tiktok: "https://tiktok.com/@travelgodemo",
      website: "https://travelgo-demo.tourpie.example",
    },
    packages: [
      {
        title: "Antalya Family Sun Week",
        destination: "Antalya",
        country: "Turkey",
        city: "Antalya",
        region: "Mediterranean",
        category: "Family",
        packageType: "family",
        description: "An easy family beach week with kid-friendly resort facilities, airport support, and hassle-free transfers.",
        days: 7,
        price: 1380,
        originalPrice: 1540,
        rating: 4.7,
        reviews: 124,
        image: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=1400&auto=format&fit=crop",
        services: ["Resort hotel", "Flights", "Breakfast", "Airport transfer", "Kids club", "Insurance"],
        dates: [
          { start: "2026-08-07", end: "2026-08-13", label: "7-13 Aug 2026" },
          { start: "2026-09-11", end: "2026-09-17", label: "11-17 Sep 2026" },
          { start: "2026-10-09", end: "2026-10-15", label: "9-15 Oct 2026" },
        ],
        capacity: 26,
      },
      {
        title: "Sharm El Sheikh Coral Family Trip",
        destination: "Sharm El Sheikh",
        country: "Egypt",
        city: "Sharm El Sheikh",
        region: "South Sinai",
        category: "Beach",
        packageType: "beach",
        description: "Red Sea sunshine with all-inclusive ease, snorkeling moments, and comfortable family pacing.",
        days: 6,
        price: 1190,
        rating: 4.5,
        reviews: 97,
        image: "https://images.unsplash.com/photo-1564501049412-61c2a3083791?q=80&w=1400&auto=format&fit=crop",
        services: ["Beach resort", "Flights", "Breakfast", "Transfer", "Snorkeling trip", "Insurance"],
        dates: [
          { start: "2026-08-16", end: "2026-08-21", label: "16-21 Aug 2026" },
          { start: "2026-09-18", end: "2026-09-23", label: "18-23 Sep 2026" },
          { start: "2026-10-12", end: "2026-10-17", label: "12-17 Oct 2026" },
        ],
        capacity: 24,
      },
      {
        title: "Batumi Weekend with the Kids",
        destination: "Batumi",
        country: "Georgia",
        city: "Batumi",
        region: "Adjara",
        category: "City Break",
        packageType: "city_break",
        description: "A short and playful Batumi reset combining seaside strolls, modern family hotel comfort, and smooth transfers.",
        days: 3,
        price: 540,
        rating: 4.4,
        reviews: 76,
        image: "https://images.unsplash.com/photo-1533105079780-92b9be482077?q=80&w=1400&auto=format&fit=crop",
        services: ["Family hotel", "Breakfast", "Transfer", "City guide", "Travel support"],
        dates: [
          { start: "2026-08-22", end: "2026-08-24", label: "22-24 Aug 2026" },
          { start: "2026-09-26", end: "2026-09-28", label: "26-28 Sep 2026" },
          { start: "2026-10-24", end: "2026-10-26", label: "24-26 Oct 2026" },
        ],
        capacity: 20,
      },
      {
        title: "Budva Coast Easy Escape",
        destination: "Budva",
        country: "Montenegro",
        city: "Budva",
        region: "Adriatic Coast",
        category: "Beach",
        packageType: "beach",
        description: "Relaxed Adriatic beaches, family-friendly hotel comfort, and a breezy coastal pace from arrival to departure.",
        days: 5,
        price: 980,
        rating: 4.5,
        reviews: 83,
        image: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=1400&auto=format&fit=crop",
        services: ["Seaside hotel", "Flights", "Breakfast", "Transfer", "Boat tour", "Insurance"],
        dates: [
          { start: "2026-08-25", end: "2026-08-29", label: "25-29 Aug 2026" },
          { start: "2026-09-15", end: "2026-09-19", label: "15-19 Sep 2026" },
          { start: "2026-10-18", end: "2026-10-22", label: "18-22 Oct 2026" },
        ],
        capacity: 18,
      },
      {
        title: "Gabala Family Nature Break",
        destination: "Gabala",
        country: "Azerbaijan",
        city: "Gabala",
        region: "Northwest Azerbaijan",
        category: "Nature",
        packageType: "nature",
        description: "Mountain air, lakeside scenery, and a calm family rhythm with resort comfort close to nature.",
        days: 4,
        price: 690,
        rating: 4.6,
        reviews: 72,
        image: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=1400&auto=format&fit=crop",
        services: ["Resort hotel", "Breakfast", "Transfer", "Cable car tickets", "Guide", "Insurance"],
        dates: [
          { start: "2026-08-11", end: "2026-08-14", label: "11-14 Aug 2026" },
          { start: "2026-09-20", end: "2026-09-23", label: "20-23 Sep 2026" },
          { start: "2026-10-05", end: "2026-10-08", label: "5-8 Oct 2026" },
        ],
        capacity: 16,
      },
      {
        title: "Baku Old City & Sea Boulevard",
        destination: "Baku",
        country: "Azerbaijan",
        city: "Baku",
        region: "Absheron",
        category: "Culture",
        packageType: "culture",
        description: "A smart city break for families wanting heritage, modern skyline views, and a very easy urban itinerary.",
        days: 3,
        price: 510,
        rating: 4.3,
        reviews: 64,
        image: "https://images.unsplash.com/photo-1516483638261-f4dbaf036963?q=80&w=1400&auto=format&fit=crop",
        services: ["City hotel", "Breakfast", "Airport transfer", "Guide", "Museum tickets"],
        dates: [
          { start: "2026-08-30", end: "2026-09-01", label: "30 Aug-1 Sep 2026" },
          { start: "2026-09-12", end: "2026-09-14", label: "12-14 Sep 2026" },
          { start: "2026-10-17", end: "2026-10-19", label: "17-19 Oct 2026" },
        ],
        capacity: 22,
      },
      {
        title: "Tbilisi & Mtskheta Discovery",
        destination: "Tbilisi",
        country: "Georgia",
        city: "Tbilisi",
        region: "Kartli",
        category: "Culture",
        packageType: "culture",
        description: "Historic churches, warm hospitality, and a comfortable two-city Georgian discovery for mixed-age groups.",
        days: 4,
        price: 760,
        originalPrice: 860,
        rating: 4.6,
        reviews: 88,
        image: "https://images.unsplash.com/photo-1521295121783-8a321d551ad2?q=80&w=1400&auto=format&fit=crop",
        services: ["City hotel", "Breakfast", "Transfer", "Guide", "Historic site tickets", "Insurance"],
        dates: [
          { start: "2026-08-18", end: "2026-08-21", label: "18-21 Aug 2026" },
          { start: "2026-09-22", end: "2026-09-25", label: "22-25 Sep 2026" },
          { start: "2026-10-20", end: "2026-10-23", label: "20-23 Oct 2026" },
        ],
        capacity: 18,
      },
    ],
  },
  {
    id: 9103,
    name: "Tripify",
    initials: "TP",
    primary: "#5B4BDB",
    accent: "#FF6A1A",
    description:
      "Tripify designs stylish city breaks, trend-forward culture trips, and fast-paced premium itineraries for modern explorers.",
    country: "United Arab Emirates",
    officeAddress: "Dubai Marina Walk 45, Dubai, UAE",
    website: "https://tripify-demo.tourpie.example",
    email: "book@tripify-demo.tourpie.example",
    phone: "+971 4 555 3303",
    rating: 4.8,
    reviewCount: 598,
    years: 5,
    verified: false,
    coverImage: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?q=80&w=1600&auto=format&fit=crop",
    socials: {
      instagram: "https://instagram.com/tripifydemo",
      facebook: "https://facebook.com/tripifydemo",
      linkedin: "https://linkedin.com/company/tripifydemo",
      website: "https://tripify-demo.tourpie.example",
    },
    packages: [
      {
        title: "Dubai Skyline Signature",
        destination: "Dubai",
        country: "UAE",
        city: "Dubai",
        region: "Dubai",
        category: "Luxury",
        packageType: "luxury",
        description: "Downtown towers, desert contrast, and a polished luxury city program with contemporary style throughout.",
        days: 4,
        price: 1730,
        rating: 4.8,
        reviews: 142,
        image: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?q=80&w=1400&auto=format&fit=crop",
        services: ["City hotel", "Flights", "Breakfast", "Airport transfer", "Desert safari", "Insurance"],
        dates: [
          { start: "2026-08-09", end: "2026-08-12", label: "9-12 Aug 2026" },
          { start: "2026-09-06", end: "2026-09-09", label: "6-9 Sep 2026" },
          { start: "2026-10-11", end: "2026-10-14", label: "11-14 Oct 2026" },
        ],
        capacity: 14,
      },
      {
        title: "Kyoto & Tokyo Modern Japan",
        destination: "Tokyo",
        country: "Japan",
        city: "Tokyo",
        region: "Kanto",
        category: "Culture",
        packageType: "culture",
        description: "A two-city Japan journey balancing neon energy, temple calm, and efficient premium transport.",
        days: 8,
        price: 3490,
        originalPrice: 3780,
        rating: 4.9,
        reviews: 110,
        image: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?q=80&w=1400&auto=format&fit=crop",
        services: ["Hotel stays", "Flights", "Breakfast", "Shinkansen tickets", "Guide", "Insurance"],
        dates: [
          { start: "2026-08-20", end: "2026-08-27", label: "20-27 Aug 2026" },
          { start: "2026-09-17", end: "2026-09-24", label: "17-24 Sep 2026" },
          { start: "2026-10-15", end: "2026-10-22", label: "15-22 Oct 2026" },
        ],
        capacity: 12,
      },
      {
        title: "Barcelona Creative City Break",
        destination: "Barcelona",
        country: "Spain",
        city: "Barcelona",
        region: "Catalonia",
        category: "City Break",
        packageType: "city_break",
        description: "Architecture, rooftop evenings, and an energetic Mediterranean city rhythm with strong lifestyle appeal.",
        days: 4,
        price: 1490,
        rating: 4.7,
        reviews: 98,
        image: "https://images.unsplash.com/photo-1583422409516-2895a77efded?q=80&w=1400&auto=format&fit=crop",
        services: ["Boutique hotel", "Flights", "Breakfast", "Transit card", "Guide", "Insurance"],
        dates: [
          { start: "2026-08-13", end: "2026-08-16", label: "13-16 Aug 2026" },
          { start: "2026-09-19", end: "2026-09-22", label: "19-22 Sep 2026" },
          { start: "2026-10-24", end: "2026-10-27", label: "24-27 Oct 2026" },
        ],
        capacity: 16,
      },
      {
        title: "Milan Fashion Weekend",
        destination: "Milan",
        country: "Italy",
        city: "Milan",
        region: "Lombardy",
        category: "City Break",
        packageType: "city_break",
        description: "A slick short break for shopping, galleries, and premium city style in the heart of Milan.",
        days: 3,
        price: 1360,
        rating: 4.6,
        reviews: 87,
        image: "https://images.unsplash.com/photo-1516483638261-f4dbaf036963?q=80&w=1400&auto=format&fit=crop",
        services: ["Design hotel", "Flights", "Breakfast", "Transfer", "Outlet shuttle", "Insurance"],
        dates: [
          { start: "2026-08-29", end: "2026-08-31", label: "29-31 Aug 2026" },
          { start: "2026-09-26", end: "2026-09-28", label: "26-28 Sep 2026" },
          { start: "2026-10-10", end: "2026-10-12", label: "10-12 Oct 2026" },
        ],
        capacity: 14,
      },
      {
        title: "Paris & Versailles Chic Escape",
        destination: "Paris",
        country: "France",
        city: "Paris",
        region: "Ile-de-France",
        category: "Luxury",
        packageType: "luxury",
        description: "A refined city plan with boutique comfort, Versailles access, and elegant Parisian downtime.",
        days: 5,
        price: 1920,
        originalPrice: 2070,
        rating: 4.8,
        reviews: 94,
        image: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?q=80&w=1400&auto=format&fit=crop",
        services: ["Boutique hotel", "Flights", "Breakfast", "Versailles tickets", "Guide", "Insurance"],
        dates: [
          { start: "2026-08-06", end: "2026-08-10", label: "6-10 Aug 2026" },
          { start: "2026-09-10", end: "2026-09-14", label: "10-14 Sep 2026" },
          { start: "2026-10-07", end: "2026-10-11", label: "7-11 Oct 2026" },
        ],
        capacity: 15,
      },
      {
        title: "Madrid Culture & Tapas Route",
        destination: "Madrid",
        country: "Spain",
        city: "Madrid",
        region: "Community of Madrid",
        category: "Culture",
        packageType: "culture",
        description: "Museums, evening plazas, and authentic tapas experiences on a smooth urban culture itinerary.",
        days: 4,
        price: 1420,
        rating: 4.7,
        reviews: 81,
        image: "https://images.unsplash.com/photo-1539037116277-4db20889f2d4?q=80&w=1400&auto=format&fit=crop",
        services: ["Central hotel", "Flights", "Breakfast", "Museum pass", "Food tour", "Insurance"],
        dates: [
          { start: "2026-08-16", end: "2026-08-19", label: "16-19 Aug 2026" },
          { start: "2026-09-13", end: "2026-09-16", label: "13-16 Sep 2026" },
          { start: "2026-10-20", end: "2026-10-23", label: "20-23 Oct 2026" },
        ],
        capacity: 18,
      },
      {
        title: "Osaka Lights & Street Food",
        destination: "Osaka",
        country: "Japan",
        city: "Osaka",
        region: "Kansai",
        category: "City Break",
        packageType: "city_break",
        description: "A food-forward Japan city break with efficient logistics, neon nights, and memorable neighborhood energy.",
        days: 5,
        price: 2240,
        rating: 4.8,
        reviews: 86,
        image: "https://images.unsplash.com/photo-1528360983277-13d401cdc186?q=80&w=1400&auto=format&fit=crop",
        services: ["City hotel", "Flights", "Breakfast", "Rail pass", "Food crawl", "Insurance"],
        dates: [
          { start: "2026-08-24", end: "2026-08-28", label: "24-28 Aug 2026" },
          { start: "2026-09-21", end: "2026-09-25", label: "21-25 Sep 2026" },
          { start: "2026-10-27", end: "2026-10-31", label: "27-31 Oct 2026" },
        ],
        capacity: 12,
      },
    ],
  },
  {
    id: 9104,
    name: "ExploreMore",
    initials: "EM",
    primary: "#0E7C66",
    accent: "#9EE37D",
    description:
      "ExploreMore specializes in adventure, nature, and active small-group itineraries packed with scenery, movement, and memorable outdoor moments.",
    country: "Thailand",
    officeAddress: "Sukhumvit 101, Bangkok, Thailand",
    website: "https://exploremore-demo.tourpie.example",
    email: "adventure@exploremore-demo.tourpie.example",
    phone: "+66 2 555 4404",
    rating: 4.7,
    reviewCount: 466,
    years: 7,
    verified: true,
    coverImage: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?q=80&w=1600&auto=format&fit=crop",
    socials: {
      instagram: "https://instagram.com/exploremoredemo",
      facebook: "https://facebook.com/exploremoredemo",
      tiktok: "https://tiktok.com/@exploremoredemo",
      website: "https://exploremore-demo.tourpie.example",
    },
    packages: [
      {
        title: "Phuket Island Adventure",
        destination: "Phuket",
        country: "Thailand",
        city: "Phuket",
        region: "Southern Thailand",
        category: "Adventure",
        packageType: "adventure",
        description: "Island hopping, speedboat energy, and easy resort recovery for travelers who want fun and movement.",
        days: 5,
        price: 1260,
        originalPrice: 1430,
        rating: 4.8,
        reviews: 118,
        image: "https://images.unsplash.com/photo-1589395595558-a1ac3c22e1cf?q=80&w=1400&auto=format&fit=crop",
        services: ["Resort hotel", "Flights", "Breakfast", "Speedboat tour", "Transfer", "Insurance"],
        dates: [
          { start: "2026-08-12", end: "2026-08-16", label: "12-16 Aug 2026" },
          { start: "2026-09-08", end: "2026-09-12", label: "8-12 Sep 2026" },
          { start: "2026-10-14", end: "2026-10-18", label: "14-18 Oct 2026" },
        ],
        capacity: 16,
      },
      {
        title: "Bali Jungle & Beach Route",
        destination: "Bali",
        country: "Indonesia",
        city: "Ubud",
        region: "Bali",
        category: "Nature",
        packageType: "nature",
        description: "Rice terraces, waterfalls, and beach club balance in a signature Bali active-escape format.",
        days: 7,
        price: 1680,
        rating: 4.8,
        reviews: 109,
        image: "https://images.unsplash.com/photo-1537953773345-d172ccf13cf1?q=80&w=1400&auto=format&fit=crop",
        services: ["Villa stay", "Flights", "Breakfast", "Transfer", "Waterfall tour", "Insurance"],
        dates: [
          { start: "2026-08-18", end: "2026-08-24", label: "18-24 Aug 2026" },
          { start: "2026-09-15", end: "2026-09-21", label: "15-21 Sep 2026" },
          { start: "2026-10-21", end: "2026-10-27", label: "21-27 Oct 2026" },
        ],
        capacity: 14,
      },
      {
        title: "Interlaken Alpine Adventure",
        destination: "Interlaken",
        country: "Switzerland",
        city: "Interlaken",
        region: "Bernese Oberland",
        category: "Adventure",
        packageType: "adventure",
        description: "Swiss mountain railways, lake views, and active alpine days with polished logistics throughout.",
        days: 6,
        price: 2840,
        originalPrice: 3050,
        rating: 4.9,
        reviews: 88,
        image: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?q=80&w=1400&auto=format&fit=crop",
        services: ["Mountain hotel", "Flights", "Breakfast", "Rail pass", "Guide", "Insurance"],
        dates: [
          { start: "2026-08-27", end: "2026-09-01", label: "27 Aug-1 Sep 2026" },
          { start: "2026-09-24", end: "2026-09-29", label: "24-29 Sep 2026" },
          { start: "2026-10-19", end: "2026-10-24", label: "19-24 Oct 2026" },
        ],
        capacity: 12,
      },
      {
        title: "Gudauri Peaks & Trails",
        destination: "Gudauri",
        country: "Georgia",
        city: "Gudauri",
        region: "Greater Caucasus",
        category: "Nature",
        packageType: "nature",
        description: "Fresh mountain air, panoramic cable cars, and scenic hiking routes in the Caucasus highlands.",
        days: 4,
        price: 870,
        rating: 4.6,
        reviews: 67,
        image: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=1400&auto=format&fit=crop",
        services: ["Mountain lodge", "Breakfast", "Transfer", "Guide", "Cable car pass", "Insurance"],
        dates: [
          { start: "2026-08-08", end: "2026-08-11", label: "8-11 Aug 2026" },
          { start: "2026-09-05", end: "2026-09-08", label: "5-8 Sep 2026" },
          { start: "2026-10-03", end: "2026-10-06", label: "3-6 Oct 2026" },
        ],
        capacity: 15,
      },
      {
        title: "Chiang Mai Active Escape",
        destination: "Chiang Mai",
        country: "Thailand",
        city: "Chiang Mai",
        region: "Northern Thailand",
        category: "Culture",
        packageType: "culture",
        description: "Temple calm, ethical elephant experiences, and active northern Thailand days with balanced pacing.",
        days: 5,
        price: 1180,
        rating: 4.7,
        reviews: 73,
        image: "https://images.unsplash.com/photo-1528181304800-259b08848526?q=80&w=1400&auto=format&fit=crop",
        services: ["Boutique hotel", "Flights", "Breakfast", "Transfer", "Temple tour", "Insurance"],
        dates: [
          { start: "2026-08-14", end: "2026-08-18", label: "14-18 Aug 2026" },
          { start: "2026-09-12", end: "2026-09-16", label: "12-16 Sep 2026" },
          { start: "2026-10-09", end: "2026-10-13", label: "9-13 Oct 2026" },
        ],
        capacity: 16,
      },
      {
        title: "Lankaran Forest & Coast Retreat",
        destination: "Lankaran",
        country: "Azerbaijan",
        city: "Lankaran",
        region: "South Azerbaijan",
        category: "Nature",
        packageType: "nature",
        description: "Tea gardens, Hyrcanian forest edges, and gentle coastal calm in southern Azerbaijan.",
        days: 4,
        price: 620,
        rating: 4.5,
        reviews: 59,
        image: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?q=80&w=1400&auto=format&fit=crop",
        services: ["Nature hotel", "Breakfast", "Transfer", "Guide", "Insurance"],
        dates: [
          { start: "2026-08-21", end: "2026-08-24", label: "21-24 Aug 2026" },
          { start: "2026-09-18", end: "2026-09-21", label: "18-21 Sep 2026" },
          { start: "2026-10-16", end: "2026-10-19", label: "16-19 Oct 2026" },
        ],
        capacity: 18,
      },
      {
        title: "Koh Samui Beach & Kayak Days",
        destination: "Koh Samui",
        country: "Thailand",
        city: "Koh Samui",
        region: "Gulf of Thailand",
        category: "Beach",
        packageType: "beach",
        description: "A softer tropical active break pairing golden beaches with kayaking and boat-day exploration.",
        days: 6,
        price: 1390,
        rating: 4.7,
        reviews: 82,
        image: "https://images.unsplash.com/photo-1519046904884-53103b34b206?q=80&w=1400&auto=format&fit=crop",
        services: ["Beach hotel", "Flights", "Breakfast", "Transfer", "Kayak day", "Insurance"],
        dates: [
          { start: "2026-08-31", end: "2026-09-05", label: "31 Aug-5 Sep 2026" },
          { start: "2026-09-27", end: "2026-10-02", label: "27 Sep-2 Oct 2026" },
          { start: "2026-10-25", end: "2026-10-30", label: "25-30 Oct 2026" },
        ],
        capacity: 14,
      },
    ],
  },
  {
    id: 9105,
    name: "GlobalTrips",
    initials: "GT",
    primary: "#111827",
    accent: "#C68A2B",
    description:
      "GlobalTrips brings together polished long-haul leisure, honeymoon excellence, and resort-focused premium escapes with strong service standards.",
    country: "Maldives",
    officeAddress: "Male Harbor Front 9, Male, Maldives",
    website: "https://globaltrips-demo.tourpie.example",
    email: "vip@globaltrips-demo.tourpie.example",
    phone: "+960 555 5505",
    rating: 4.9,
    reviewCount: 742,
    years: 8,
    verified: true,
    coverImage: "https://images.unsplash.com/photo-1506953823976-52e1fdc0149a?q=80&w=1600&auto=format&fit=crop",
    socials: {
      instagram: "https://instagram.com/globaltripsdemo",
      facebook: "https://facebook.com/globaltripsdemo",
      linkedin: "https://linkedin.com/company/globaltripsdemo",
      website: "https://globaltrips-demo.tourpie.example",
    },
    packages: [
      {
        title: "Maldives Water Villa Bliss",
        destination: "Maldives",
        country: "Maldives",
        city: "Male Atoll",
        region: "North Male Atoll",
        category: "Honeymoon",
        packageType: "honeymoon",
        description: "Overwater villas, turquoise lagoon time, and a polished honeymoon experience built for slow luxury.",
        days: 6,
        price: 3590,
        originalPrice: 3920,
        rating: 5,
        reviews: 166,
        image: "https://images.unsplash.com/photo-1514282401047-d79a71a590e8?q=80&w=1400&auto=format&fit=crop",
        services: ["Water villa", "Flights", "Breakfast", "Speedboat transfer", "Spa credit", "Insurance"],
        dates: [
          { start: "2026-08-10", end: "2026-08-15", label: "10-15 Aug 2026" },
          { start: "2026-09-14", end: "2026-09-19", label: "14-19 Sep 2026" },
          { start: "2026-10-12", end: "2026-10-17", label: "12-17 Oct 2026" },
        ],
        capacity: 10,
      },
      {
        title: "Dubai Palm Premium Stay",
        destination: "Dubai",
        country: "UAE",
        city: "Dubai",
        region: "Palm Jumeirah",
        category: "Luxury",
        packageType: "luxury",
        description: "Palm-side luxury with beach club access, skyline dining, and seamless premium transfers.",
        days: 5,
        price: 1940,
        rating: 4.8,
        reviews: 121,
        image: "https://images.unsplash.com/photo-1518684079-3c830dcef090?q=80&w=1400&auto=format&fit=crop",
        services: ["Luxury hotel", "Flights", "Breakfast", "Transfer", "Beach club access", "Insurance"],
        dates: [
          { start: "2026-08-19", end: "2026-08-23", label: "19-23 Aug 2026" },
          { start: "2026-09-11", end: "2026-09-15", label: "11-15 Sep 2026" },
          { start: "2026-10-18", end: "2026-10-22", label: "18-22 Oct 2026" },
        ],
        capacity: 14,
      },
      {
        title: "Mykonos Beach Club Collection",
        destination: "Mykonos",
        country: "Greece",
        city: "Mykonos",
        region: "Cyclades",
        category: "Beach",
        packageType: "beach",
        description: "Whitewashed style, curated beach club days, and a premium island social vibe on Mykonos.",
        days: 5,
        price: 2260,
        originalPrice: 2410,
        rating: 4.8,
        reviews: 102,
        image: "https://images.unsplash.com/photo-1533105079780-92b9be482077?q=80&w=1400&auto=format&fit=crop",
        services: ["Sea-view hotel", "Flights", "Breakfast", "Transfer", "Beach club access", "Insurance"],
        dates: [
          { start: "2026-08-22", end: "2026-08-26", label: "22-26 Aug 2026" },
          { start: "2026-09-18", end: "2026-09-22", label: "18-22 Sep 2026" },
          { start: "2026-10-09", end: "2026-10-13", label: "9-13 Oct 2026" },
        ],
        capacity: 12,
      },
      {
        title: "Mediterranean Cruise Discovery",
        destination: "Barcelona",
        country: "Spain",
        city: "Barcelona",
        region: "Mediterranean",
        category: "Cruise",
        packageType: "cruise",
        description: "An elegant cruise format linking major Mediterranean highlights with floating-hotel comfort.",
        days: 8,
        price: 2860,
        rating: 4.9,
        reviews: 95,
        image: "https://images.unsplash.com/photo-1500375592092-40eb2168fd21?q=80&w=1400&auto=format&fit=crop",
        services: ["Cruise cabin", "Flights", "Breakfast", "Port transfers", "Onboard entertainment", "Insurance"],
        dates: [
          { start: "2026-08-30", end: "2026-09-06", label: "30 Aug-6 Sep 2026" },
          { start: "2026-09-25", end: "2026-10-02", label: "25 Sep-2 Oct 2026" },
          { start: "2026-10-20", end: "2026-10-27", label: "20-27 Oct 2026" },
        ],
        capacity: 18,
      },
      {
        title: "Cairo Icons & Nile Upgrade",
        destination: "Cairo",
        country: "Egypt",
        city: "Cairo",
        region: "Greater Cairo",
        category: "Culture",
        packageType: "culture",
        description: "Pyramids, upgraded Nile touches, and a premium history-focused itinerary with extra comfort.",
        days: 5,
        price: 1280,
        rating: 4.6,
        reviews: 86,
        image: "https://images.unsplash.com/photo-1539650116574-75c0c6d73f75?q=80&w=1400&auto=format&fit=crop",
        services: ["City hotel", "Flights", "Breakfast", "Transfer", "Guide", "Insurance"],
        dates: [
          { start: "2026-08-15", end: "2026-08-19", label: "15-19 Aug 2026" },
          { start: "2026-09-09", end: "2026-09-13", label: "9-13 Sep 2026" },
          { start: "2026-10-05", end: "2026-10-09", label: "5-9 Oct 2026" },
        ],
        capacity: 16,
      },
      {
        title: "Rome & Tuscany Premium Pairing",
        destination: "Rome",
        country: "Italy",
        city: "Rome",
        region: "Lazio",
        category: "Luxury",
        packageType: "luxury",
        description: "Classic Italy with a higher-end feel, pairing Rome highlights with a soft Tuscan countryside finish.",
        days: 7,
        price: 2480,
        originalPrice: 2660,
        rating: 4.8,
        reviews: 97,
        image: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?q=80&w=1400&auto=format&fit=crop",
        services: ["Premium hotels", "Flights", "Breakfast", "Private driver", "Guide", "Insurance"],
        dates: [
          { start: "2026-08-07", end: "2026-08-13", label: "7-13 Aug 2026" },
          { start: "2026-09-16", end: "2026-09-22", label: "16-22 Sep 2026" },
          { start: "2026-10-14", end: "2026-10-20", label: "14-20 Oct 2026" },
        ],
        capacity: 12,
      },
      {
        title: "Corfu Blue Lagoon Holiday",
        destination: "Corfu",
        country: "Greece",
        city: "Corfu",
        region: "Ionian Islands",
        category: "Beach",
        packageType: "beach",
        description: "A relaxed Greek island program with premium resort comfort and beautiful lagoon-focused days.",
        days: 6,
        price: 1870,
        rating: 4.7,
        reviews: 75,
        image: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=1400&auto=format&fit=crop",
        services: ["Resort hotel", "Flights", "Breakfast", "Transfer", "Boat day", "Insurance"],
        dates: [
          { start: "2026-08-26", end: "2026-08-31", label: "26-31 Aug 2026" },
          { start: "2026-09-21", end: "2026-09-26", label: "21-26 Sep 2026" },
          { start: "2026-10-23", end: "2026-10-28", label: "23-28 Oct 2026" },
        ],
        capacity: 14,
      },
    ],
  },
  {
    id: 9106,
    name: "SkyJourney",
    initials: "SJ",
    primary: "#022A6B",
    accent: "#7DD3FC",
    description:
      "SkyJourney combines alpine escapes, design-conscious city breaks, and premium cold-season planning for travelers who love crisp air and iconic skylines.",
    country: "Switzerland",
    officeAddress: "Bahnhofstrasse 44, Zurich, Switzerland",
    website: "https://skyjourney-demo.tourpie.example",
    email: "team@skyjourney-demo.tourpie.example",
    phone: "+41 44 555 6606",
    rating: 4.7,
    reviewCount: 438,
    years: 3,
    verified: false,
    coverImage: "https://images.unsplash.com/photo-1521295121783-8a321d551ad2?q=80&w=1600&auto=format&fit=crop",
    socials: {
      instagram: "https://instagram.com/skyjourneydemo",
      facebook: "https://facebook.com/skyjourneydemo",
      linkedin: "https://linkedin.com/company/skyjourneydemo",
      website: "https://skyjourney-demo.tourpie.example",
    },
    packages: [
      {
        title: "Zermatt Alpine Snow Week",
        destination: "Zermatt",
        country: "Switzerland",
        city: "Zermatt",
        region: "Valais",
        category: "Ski",
        packageType: "ski",
        description: "A premium alpine week with Matterhorn views, stylish lodging, and smooth slope-day planning.",
        days: 7,
        price: 3180,
        originalPrice: 3440,
        rating: 4.9,
        reviews: 92,
        image: "https://images.unsplash.com/photo-1516483638261-f4dbaf036963?q=80&w=1400&auto=format&fit=crop",
        services: ["Mountain hotel", "Flights", "Breakfast", "Rail transfer", "Ski pass", "Insurance"],
        dates: [
          { start: "2026-11-20", end: "2026-11-26", label: "20-26 Nov 2026" },
          { start: "2026-12-11", end: "2026-12-17", label: "11-17 Dec 2026" },
          { start: "2027-01-08", end: "2027-01-14", label: "8-14 Jan 2027" },
        ],
        capacity: 12,
      },
      {
        title: "Zurich Winter City Lights",
        destination: "Zurich",
        country: "Switzerland",
        city: "Zurich",
        region: "Zurich",
        category: "City Break",
        packageType: "city_break",
        description: "A crisp Swiss city break with lakefront elegance, festive streets, and premium urban comfort.",
        days: 4,
        price: 1840,
        rating: 4.6,
        reviews: 68,
        image: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=1400&auto=format&fit=crop",
        services: ["City hotel", "Flights", "Breakfast", "Transit pass", "Guide", "Insurance"],
        dates: [
          { start: "2026-11-14", end: "2026-11-17", label: "14-17 Nov 2026" },
          { start: "2026-12-05", end: "2026-12-08", label: "5-8 Dec 2026" },
          { start: "2027-01-16", end: "2027-01-19", label: "16-19 Jan 2027" },
        ],
        capacity: 16,
      },
      {
        title: "Hokkaido Powder Adventure",
        destination: "Sapporo",
        country: "Japan",
        city: "Sapporo",
        region: "Hokkaido",
        category: "Ski",
        packageType: "ski",
        description: "Deep powder, hot spring downtime, and a tightly planned Japan snow itinerary with premium support.",
        days: 8,
        price: 3720,
        rating: 4.9,
        reviews: 84,
        image: "https://images.unsplash.com/photo-1510798831971-661eb04b3739?q=80&w=1400&auto=format&fit=crop",
        services: ["Ski resort", "Flights", "Breakfast", "Transfer", "Ski pass", "Insurance"],
        dates: [
          { start: "2026-12-18", end: "2026-12-25", label: "18-25 Dec 2026" },
          { start: "2027-01-10", end: "2027-01-17", label: "10-17 Jan 2027" },
          { start: "2027-02-07", end: "2027-02-14", label: "7-14 Feb 2027" },
        ],
        capacity: 10,
      },
      {
        title: "Kyoto Winter Temples",
        destination: "Kyoto",
        country: "Japan",
        city: "Kyoto",
        region: "Kansai",
        category: "Culture",
        packageType: "culture",
        description: "A slower winter Japan route pairing Kyoto’s temple elegance with calm premium hospitality.",
        days: 5,
        price: 2280,
        rating: 4.8,
        reviews: 78,
        image: "https://images.unsplash.com/photo-1492571350019-22de08371fd3?q=80&w=1400&auto=format&fit=crop",
        services: ["Ryokan stay", "Flights", "Breakfast", "Rail pass", "Guide", "Insurance"],
        dates: [
          { start: "2026-11-25", end: "2026-11-29", label: "25-29 Nov 2026" },
          { start: "2026-12-15", end: "2026-12-19", label: "15-19 Dec 2026" },
          { start: "2027-01-20", end: "2027-01-24", label: "20-24 Jan 2027" },
        ],
        capacity: 12,
      },
      {
        title: "Paris Winter Elegance",
        destination: "Paris",
        country: "France",
        city: "Paris",
        region: "Ile-de-France",
        category: "Luxury",
        packageType: "luxury",
        description: "A refined Paris winter stay with boutique luxury, festive dinners, and elegant urban pacing.",
        days: 4,
        price: 1980,
        originalPrice: 2140,
        rating: 4.7,
        reviews: 73,
        image: "https://images.unsplash.com/photo-1431274172761-fca41d930114?q=80&w=1400&auto=format&fit=crop",
        services: ["Boutique hotel", "Flights", "Breakfast", "Transfer", "Dinner reservation", "Insurance"],
        dates: [
          { start: "2026-11-19", end: "2026-11-22", label: "19-22 Nov 2026" },
          { start: "2026-12-12", end: "2026-12-15", label: "12-15 Dec 2026" },
          { start: "2027-01-23", end: "2027-01-26", label: "23-26 Jan 2027" },
        ],
        capacity: 14,
      },
      {
        title: "Vienna to Venice Rail Duo",
        destination: "Venice",
        country: "Italy",
        city: "Venice",
        region: "Veneto",
        category: "City Break",
        packageType: "city_break",
        description: "A scenic rail-linked dual-city route for travelers who want romance, architecture, and easy premium movement.",
        days: 6,
        price: 2090,
        rating: 4.6,
        reviews: 69,
        image: "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?q=80&w=1400&auto=format&fit=crop",
        services: ["Hotels", "Flights", "Breakfast", "Rail tickets", "Guide", "Insurance"],
        dates: [
          { start: "2026-11-28", end: "2026-12-03", label: "28 Nov-3 Dec 2026" },
          { start: "2026-12-20", end: "2026-12-25", label: "20-25 Dec 2026" },
          { start: "2027-01-27", end: "2027-02-01", label: "27 Jan-1 Feb 2027" },
        ],
        capacity: 12,
      },
      {
        title: "Erciyes Snow & Spa Weekend",
        destination: "Kayseri",
        country: "Turkey",
        city: "Kayseri",
        region: "Central Anatolia",
        category: "Ski",
        packageType: "ski",
        description: "A short mountain-ski weekend with thermal recovery and a premium winter-lodge atmosphere.",
        days: 4,
        price: 1160,
        rating: 4.5,
        reviews: 58,
        image: "https://images.unsplash.com/photo-1551524164-6cf2ac778ce2?q=80&w=1400&auto=format&fit=crop",
        services: ["Mountain hotel", "Flights", "Breakfast", "Transfer", "Ski pass", "Insurance"],
        dates: [
          { start: "2026-12-04", end: "2026-12-07", label: "4-7 Dec 2026" },
          { start: "2027-01-14", end: "2027-01-17", label: "14-17 Jan 2027" },
          { start: "2027-02-11", end: "2027-02-14", label: "11-14 Feb 2027" },
        ],
        capacity: 16,
      },
    ],
  },
];

export const demoMarketplaceCompanies: MarketplaceAgency[] = companySeeds.map(buildAgency);

export const demoMarketplacePackages: MarketplacePackage[] = companySeeds.flatMap((seed) => {
  const agency = buildAgency(seed);
  return seed.packages.map((pkg, index) => buildPackage(seed, agency, pkg, index));
});

export const demoMarketplaceCompanyMap = new Map<number, MarketplaceAgency>(
  demoMarketplaceCompanies.map((company) => [company.id, company])
);

export const demoMarketplacePackageMap = new Map<number, MarketplacePackage>(
  demoMarketplacePackages.map((pkg) => [pkg.id, pkg])
);

export const demoTrendingMarketplacePackages = demoMarketplacePackages
  .slice()
  .sort((a, b) => (b.marketplace_review_count || 0) - (a.marketplace_review_count || 0))
  .slice(0, 24);

export const demoTopRatedMarketplacePackages = demoMarketplacePackages
  .slice()
  .sort((a, b) => (b.marketplace_rating || 0) - (a.marketplace_rating || 0) || (b.marketplace_review_count || 0) - (a.marketplace_review_count || 0))
  .slice(0, 24);
