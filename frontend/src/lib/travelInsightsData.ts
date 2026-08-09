export const CURRENCIES = ["USD", "EUR", "GBP", "AED", "TRY"];
export const SEASONS = [
  "Spring (Mar–May)",
  "Summer (Jun–Aug)",
  "Autumn (Sep–Nov)",
  "Winter (Dec–Feb)",
];
export const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
export const HOTEL_CATEGORIES = [
  "5-Star Luxury",
  "4-Star Boutique",
  "All-Inclusive Resorts",
  "Heritage Hotels",
  "Beachfront Villas",
];
export const ACTIVITIES = [
  "Historical Tours",
  "Gastronomy",
  "Hiking",
  "Spa & Wellness",
  "Water Sports",
  "Photography",
  "Wildlife",
  "Shopping",
];

export type DestinationStat = {
  country: string;
  countrySlug: string;
  flag: string;
  city: string;
  tagline: string;
  heroPrompt: string;
  facts: { label: string; value: string }[];
  bestSeason: string;
  visaInfo: string;
  weather: string;
  activities: string[];
  avgPrice: number;
  popularity: number;
  agencies: number;
  rating: number;
  reviews: number;
  trendMonth: number;
  mostBooked: string;
  isHidden?: boolean;
  highlights?: string[];
  tips?: string[];
};

export const BUILD_IMAGE = (
  prompt: string,
  size:
    | "landscape_16_9"
    | "landscape_4_3"
    | "portrait_4_3"
    | "square_hd" = "landscape_16_9"
) =>
  `https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=${encodeURIComponent(
    prompt
  )}&image_size=${size}`;

export function flagOf(country: string): string {
  const map: Record<string, string> = {
    Italy: "🇮🇹",
    France: "🇫🇷",
    Japan: "🇯🇵",
    Turkey: "🇹🇷",
    Greece: "🇬🇷",
    Switzerland: "🇨🇭",
    UAE: "🇦🇪",
    Maldives: "🇲🇻",
    Azerbaijan: "🇦🇿",
    Georgia: "🇬🇪",
    Montenegro: "🇲🇪",
    Spain: "🇪🇸",
    Austria: "🇦🇹",
    "South Korea": "🇰🇷",
    Morocco: "🇲🇦",
    Indonesia: "🇮🇩",
    Canada: "🇨🇦",
    NewZealand: "🇳🇿",
    "New Zealand": "🇳🇿",
    Portugal: "🇵🇹",
    Croatia: "🇭🇷",
    Iceland: "🇮🇸",
    Vietnam: "🇻🇳",
    Peru: "🇵🇪",
    Norway: "🇳🇴",
  };
  return map[country] || "🌍";
}

export function slugOf(country: string): string {
  return country
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export const DESTINATIONS: DestinationStat[] = [
  {
    country: "Italy",
    countrySlug: slugOf("Italy"),
    flag: flagOf("Italy"),
    city: "Lake Como",
    tagline: "La Dolce Vita refined.",
    heroPrompt:
      "Luxury cinematic Lake Como sunset view from Villa d'Este, turquoise lake water, alpine backdrop, premium travel editorial photography, warm golden hour, ultra realistic",
    facts: [
      { label: "Capital", value: "Rome" },
      { label: "Language", value: "Italian" },
      { label: "Currency", value: "EUR (€)" },
      { label: "Timezone", value: "GMT+1" },
    ],
    bestSeason: SEASONS[0],
    visaInfo: "Schengen Area · 90 days visa-free for many nations",
    weather: "Mild spring and autumn · Summers 25–32°C on lakes",
    activities: ["Private Villas", "Cooking Classes", "Wine Tasting", "Boat Cruises"],
    avgPrice: 1480,
    popularity: 96,
    agencies: 42,
    rating: 4.9,
    reviews: 3240,
    trendMonth: +18,
    mostBooked: "Amalfi Coast",
    highlights: [
      "Lakefront Luxury",
      "Renaissance Art",
      "Slow Food Trails",
      "Cinque Terre Hikes",
    ],
    tips: [
      "Book a shoulder flight to avoid crowds",
      "Try agriturismi in Tuscany",
      "Reserve high-season ferries 6 weeks early",
    ],
  },
  {
    country: "Japan",
    countrySlug: slugOf("Japan"),
    flag: flagOf("Japan"),
    city: "Kyoto",
    tagline: "Tradition meets tomorrow.",
    heroPrompt:
      "Cinematic Kyoto bamboo grove Arashiyama morning light, mist between tall bamboo, monk silhouette, premium travel editorial photography, ultra realistic",
    facts: [
      { label: "Capital", value: "Tokyo" },
      { label: "Language", value: "Japanese" },
      { label: "Currency", value: "JPY (¥)" },
      { label: "Timezone", value: "GMT+9" },
    ],
    bestSeason: SEASONS[0],
    visaInfo: "Visa-free for 62 nations · eVisa available for others",
    weather: "Cherry blossom springs · Mild autumn foliage",
    activities: ["Tea Ceremonies", "Ryokan Stays", "Onsen", "Shinkansen Tours"],
    avgPrice: 1890,
    popularity: 94,
    agencies: 36,
    rating: 4.8,
    reviews: 2780,
    trendMonth: +22,
    mostBooked: "Tokyo",
    highlights: [
      "Kyoto Temples",
      "Osaka Street Food",
      "Hakone Onsen",
      "Mt Fuji Views",
    ],
    tips: [
      "Buy a JR Pass before departure",
      "Carry cash — rural shops prefer it",
      "Book ryokan dinners in advance",
    ],
  },
  {
    country: "Turkey",
    countrySlug: slugOf("Turkey"),
    flag: flagOf("Turkey"),
    city: "Cappadocia",
    tagline: "Where continents dream together.",
    heroPrompt:
      "Cinematic Cappadocia sunrise with hundreds of hot air balloons over fairy chimneys, premium travel editorial photography, warm sunrise tones, ultra realistic",
    facts: [
      { label: "Capital", value: "Ankara" },
      { label: "Language", value: "Turkish" },
      { label: "Currency", value: "TRY (₺)" },
      { label: "Timezone", value: "GMT+3" },
    ],
    bestSeason: SEASONS[2],
    visaInfo: "eVisa for most nationalities in under 5 minutes",
    weather: "Hot Aegean summers · Crisp Cappadocian springs",
    activities: ["Hot Air Balloons", "Bosphorus Cruises", "Hamam Rituals", "Hiking"],
    avgPrice: 820,
    popularity: 92,
    agencies: 58,
    rating: 4.7,
    reviews: 4102,
    trendMonth: +14,
    mostBooked: "Istanbul",
    highlights: [
      "Cappadocia Balloons",
      "Istanbul Bazaars",
      "Pamukkale Pools",
      "Lycian Way Hikes",
    ],
    tips: [
      "Balloon flights are weather-dependent — add a buffer day",
      "Try lokma and baklava in Gaziantep",
      "Use Istanbulkart for cheap transit",
    ],
  },
  {
    country: "France",
    countrySlug: slugOf("France"),
    flag: flagOf("France"),
    city: "French Riviera",
    tagline: "Elegance, coast to coast.",
    heroPrompt:
      "Cinematic French Riviera Villefranche-sur-Mer cliffside bay, azure water, luxury yachts, coastal villas, premium travel editorial photography, golden hour, ultra realistic",
    facts: [
      { label: "Capital", value: "Paris" },
      { label: "Language", value: "French" },
      { label: "Currency", value: "EUR (€)" },
      { label: "Timezone", value: "GMT+1" },
    ],
    bestSeason: SEASONS[2],
    visaInfo: "Schengen Area · Standard visitor visa rules",
    weather: "Sunny Riviera summers · Parisian spring showers",
    activities: ["Wine Tastings", "Riviera Cruises", "Alpine Skiing", "Fashion"],
    avgPrice: 1640,
    popularity: 93,
    agencies: 39,
    rating: 4.8,
    reviews: 2990,
    trendMonth: +12,
    mostBooked: "Paris",
    highlights: [
      "Provence Villages",
      "Monaco Glamour",
      "Bordeaux Vineyards",
      "Mont Saint-Michel",
    ],
    tips: [
      "Skip the Paris taxi — use Metro or RER B",
      "Book Eiffel Tower summit tickets 2 months early",
      "Sunday markets are half the magic",
    ],
  },
  {
    country: "Greece",
    countrySlug: slugOf("Greece"),
    flag: flagOf("Greece"),
    city: "Santorini",
    tagline: "Postcards from the Aegean.",
    heroPrompt:
      "Cinematic Santorini Oia sunset with whitewashed houses and blue domes, caldera view, premium travel editorial photography, ultra realistic",
    facts: [
      { label: "Capital", value: "Athens" },
      { label: "Language", value: "Greek" },
      { label: "Currency", value: "EUR (€)" },
      { label: "Timezone", value: "GMT+2" },
    ],
    bestSeason: SEASONS[0],
    visaInfo: "Schengen Area · Island ferry-friendly stays",
    weather: "Dry, sunny summers · Mild winters in Athens",
    activities: ["Island Hopping", "Sailing", "Ancient Ruins", "Sunset Yoga"],
    avgPrice: 1320,
    popularity: 91,
    agencies: 31,
    rating: 4.8,
    reviews: 3550,
    trendMonth: +20,
    mostBooked: "Mykonos",
    highlights: [
      "Caldera Sunsets",
      "Delos Archaeological Site",
      "Crete Beaches",
      "Zakynthos Shipwreck",
    ],
    tips: [
      "Pre-book ferries during July–August",
      "Oia sunsets are crowded — try Imerovigli instead",
      "Rent an ATV in smaller islands",
    ],
  },
  {
    country: "Switzerland",
    countrySlug: slugOf("Switzerland"),
    flag: flagOf("Switzerland"),
    city: "Zermatt",
    tagline: "Alpine precision, scenic perfection.",
    heroPrompt:
      "Cinematic Zermatt Matterhorn reflection in Riffelsee lake at sunrise, premium travel editorial photography, ultra realistic",
    facts: [
      { label: "Capital", value: "Bern" },
      { label: "Language", value: "DE / FR / IT / EN" },
      { label: "Currency", value: "CHF" },
      { label: "Timezone", value: "GMT+1" },
    ],
    bestSeason: SEASONS[2],
    visaInfo: "Schengen Area · Cross-border CTA with Liechtenstein",
    weather: "Alpine winters · Summer hiking above 20°C",
    activities: ["Glacier Express", "Skiing", "Hiking", "Chocolate Tours"],
    avgPrice: 2420,
    popularity: 88,
    agencies: 22,
    rating: 4.9,
    reviews: 1780,
    trendMonth: +9,
    mostBooked: "Interlaken",
    highlights: [
      "Matterhorn Sunrise",
      "Lucerne Lake",
      "Jungfraujoch Top of Europe",
      "Lavaux Vineyards",
    ],
    tips: [
      "Swiss Travel Pass saves on trains, boats & cableways",
      "Coins still matter for lockers and public phones",
      "Summer trails can close abruptly — check SLF daily",
    ],
  },
  {
    country: "UAE",
    countrySlug: slugOf("UAE"),
    flag: flagOf("UAE"),
    city: "Dubai",
    tagline: "Skyline meets sandline.",
    heroPrompt:
      "Cinematic Dubai Marina skyline at blue hour with Burj Khalifa silhouette in background, palm jumeirah, premium travel editorial photography, ultra realistic",
    facts: [
      { label: "Capital", value: "Abu Dhabi" },
      { label: "Language", value: "Arabic (EN widely spoken)" },
      { label: "Currency", value: "AED (د.إ)" },
      { label: "Timezone", value: "GMT+4" },
    ],
    bestSeason: SEASONS[3],
    visaInfo: "Free visa-on-arrival for 100+ nationalities",
    weather: "Perfect winters · Avoid June–August heat",
    activities: ["Desert Safaris", "Yacht Charters", "Skydiving", "Fine Dining"],
    avgPrice: 1760,
    popularity: 90,
    agencies: 47,
    rating: 4.7,
    reviews: 3890,
    trendMonth: +15,
    mostBooked: "Dubai",
    highlights: [
      "Burj Khalifa Sunsets",
      "Sheikh Zayed Grand Mosque",
      "Empty Quarter Dunes",
      "Louvre Abu Dhabi",
    ],
    tips: [
      "Nol card covers metro, buses and water buses",
      "Reserve desert safaris with a reputable operator",
      "Ramadan timings significantly alter daytime dining",
    ],
  },
  {
    country: "Maldives",
    countrySlug: slugOf("Maldives"),
    flag: flagOf("Maldives"),
    city: "Baa Atoll",
    tagline: "Paradise distilled.",
    heroPrompt:
      "Cinematic Maldives overwater bungalows with glass floor, turquoise lagoon, reef shark silhouette below, premium travel editorial photography, ultra realistic",
    facts: [
      { label: "Capital", value: "Malé" },
      { label: "Language", value: "Dhivehi (EN widely spoken)" },
      { label: "Currency", value: "MVR / USD accepted" },
      { label: "Timezone", value: "GMT+5" },
    ],
    bestSeason: SEASONS[3],
    visaInfo: "Free 30-day visa on arrival for all nationalities",
    weather: "Dry Nov–Apr · Monsoon season May–Oct",
    activities: ["Snorkeling", "Scuba Diving", "Spa", "Private Sandbanks"],
    avgPrice: 3280,
    popularity: 87,
    agencies: 29,
    rating: 4.9,
    reviews: 2140,
    trendMonth: +11,
    mostBooked: "Malé Atoll",
    highlights: [
      "Bioluminescent Beaches",
      "Hanifaru Bay Manta Rays",
      "Underwater Restaurants",
      "Seaplane Transfers",
    ],
    tips: [
      "Seaplanes stop at sunset — arrive during daylight",
      "All-inclusive packages save on meals and transfers",
      "Respect reef-safe sunscreen policies",
    ],
  },
  {
    country: "Azerbaijan",
    countrySlug: slugOf("Azerbaijan"),
    flag: flagOf("Azerbaijan"),
    city: "Baku",
    tagline: "Land of Fire's modern soul.",
    heroPrompt:
      "Cinematic Baku Flame Towers illuminated at dusk with Caspian Sea and old city silhouette, premium travel editorial photography, ultra realistic",
    facts: [
      { label: "Capital", value: "Baku" },
      { label: "Language", value: "Azerbaijani (EN/RU widely spoken)" },
      { label: "Currency", value: "AZN (₼)" },
      { label: "Timezone", value: "GMT+4" },
    ],
    bestSeason: SEASONS[0],
    visaInfo: "eVisa in 3 working days / visa-on-arrival at airports",
    weather: "Sunny 20–28°C spring/autumn · Winter 5–10°C",
    activities: ["Caspian Sailing", "Wine Tastings", "Caucasus Hikes", "Mud Volcanoes"],
    avgPrice: 760,
    popularity: 82,
    agencies: 16,
    rating: 4.6,
    reviews: 980,
    trendMonth: +31,
    mostBooked: "Baku",
    highlights: [
      "Old City Walls",
      "Gobustan Petroglyphs",
      "Ateshgah Fire Temple",
      "Shaki Caravanserai",
    ],
    tips: [
      "BakuCard covers transport + 60+ attractions",
      "Shaki is a 6-hour drive — fly to Ganja for a combo trip",
      "Try qutab and shah plov at local chaikhanas",
    ],
  },
  {
    country: "Georgia",
    countrySlug: slugOf("Georgia"),
    flag: flagOf("Georgia"),
    city: "Svaneti",
    tagline: "Where the Caucasus sings.",
    heroPrompt:
      "Cinematic Svaneti mountain village Mestia at sunrise with ancient stone watchtowers and snow-capped Caucasus, premium travel editorial photography, ultra realistic",
    facts: [
      { label: "Capital", value: "Tbilisi" },
      { label: "Language", value: "Georgian (EN/RU widely spoken)" },
      { label: "Currency", value: "GEL (₾)" },
      { label: "Timezone", value: "GMT+4" },
    ],
    bestSeason: SEASONS[0],
    visaInfo: "Visa-free for 98 nationalities up to 365 days",
    weather: "Sunny Tbilisi springs · Skiable winters in Gudauri",
    activities: ["Qvevri Wine Tasting", "Caucasus Trekking", "Hot Springs", "Cable Cars"],
    avgPrice: 640,
    popularity: 85,
    agencies: 18,
    rating: 4.7,
    reviews: 1320,
    trendMonth: +27,
    mostBooked: "Tbilisi",
    highlights: [
      "Kakheti Wine Region",
      "Kazbegi Gergeti Trinity",
      "Martvili Canyon",
      "Uplistsikhe Cave Town",
    ],
    tips: [
      "Marshrutkas are cheap — book seats online in summer",
      "Try chacha, khinkali and mtsvadi on the same day only if brave",
      "Svaneti passes open mid-June, close late September",
    ],
  },
  {
    country: "Portugal",
    countrySlug: slugOf("Portugal"),
    flag: flagOf("Portugal"),
    city: "Algarve",
    tagline: "Atlantic sun and saudade.",
    heroPrompt:
      "Cinematic Algarve Benagil Cave drone view at sunset with limestone arches and turquoise water, premium travel editorial photography, ultra realistic",
    facts: [
      { label: "Capital", value: "Lisbon" },
      { label: "Language", value: "Portuguese" },
      { label: "Currency", value: "EUR (€)" },
      { label: "Timezone", value: "GMT+0" },
    ],
    bestSeason: SEASONS[2],
    visaInfo: "Schengen Area · Easy visitor stays",
    weather: "300+ sunny days · Summer 25–32°C",
    activities: ["Surfing", "Cave Boat Tours", "Port Tasting", "Tram 28 Crawls"],
    avgPrice: 1120,
    popularity: 89,
    agencies: 24,
    rating: 4.8,
    reviews: 2410,
    trendMonth: +17,
    mostBooked: "Lisbon",
    highlights: [
      "Lagos Caves",
      "Sintra Palaces",
      "Porto Wine Cellars",
      "Madeira Levadas",
    ],
    tips: [
      "Lisbon tram 28 pickpockets are legendary — watch bags",
      "Rent a car for Algarve cliffside villages",
      "Book Benagil cave kayak tours at low tide",
    ],
  },
  {
    country: "Iceland",
    countrySlug: slugOf("Iceland"),
    flag: flagOf("Iceland"),
    city: "Reykjavik",
    tagline: "Land of fire, ice and unforgettable light.",
    heroPrompt:
      "Cinematic Iceland Skógafoss waterfall with northern lights aurora borealis in green sky, premium travel editorial photography, ultra realistic",
    facts: [
      { label: "Capital", value: "Reykjavík" },
      { label: "Language", value: "Icelandic (EN fluent)" },
      { label: "Currency", value: "ISK (kr)" },
      { label: "Timezone", value: "GMT+0" },
    ],
    bestSeason: SEASONS[2],
    visaInfo: "Schengen Area · Keflavik airport arrivals friendly",
    weather: "Unpredictable — pack layers and waterproofs year-round",
    activities: ["Northern Lights", "Glacier Hikes", "Blue Lagoon", "Whale Watching"],
    avgPrice: 2680,
    popularity: 86,
    agencies: 14,
    rating: 4.9,
    reviews: 1580,
    trendMonth: +13,
    mostBooked: "Reykjavik",
    highlights: [
      "Ring Road Itinerary",
      "Jökulsárlón Glacier Lagoon",
      "Reynisfjara Black Beach",
      "Landmannalaugar Highlands",
    ],
    tips: [
      "Rent a 4x4 for F-roads in summer",
      "Aurora chase only on clear, KP-index 3+ nights",
      "Pre-book Blue Lagoon — it sells out",
    ],
  },
  {
    country: "Morocco",
    countrySlug: slugOf("Morocco"),
    flag: flagOf("Morocco"),
    city: "Marrakech",
    tagline: "Colors, spices, mountains, dunes.",
    heroPrompt:
      "Cinematic Marrakech medina Jemaa el-Fnaa at dusk with orange lanterns and smoke from food stalls, premium travel editorial photography, ultra realistic",
    facts: [
      { label: "Capital", value: "Rabat" },
      { label: "Language", value: "Arabic / Berber / FR" },
      { label: "Currency", value: "MAD (د.م.)" },
      { label: "Timezone", value: "GMT+1" },
    ],
    bestSeason: SEASONS[2],
    visaInfo: "Visa-free for 70+ nationalities · 90 days",
    weather: "Spring 18–28°C · Avoid desert July–August heat",
    activities: ["Desert Camping", "Medina Exploration", "Atlas Hikes", "Cooking Classes"],
    avgPrice: 920,
    popularity: 84,
    agencies: 21,
    rating: 4.6,
    reviews: 1840,
    trendMonth: +8,
    mostBooked: "Marrakech",
    highlights: [
      "Merzouga Sahara Dunes",
      "Chefchaouen Blue City",
      "Fes Medina Tannery",
      "Ouzoud Waterfalls",
    ],
    tips: [
      "Exchange MAD inside the country for better rates",
      "Negotiate politely — first price is rarely the final one",
      "A private desert camp beats a group one every time",
    ],
    isHidden: true,
  },
  {
    country: "Montenegro",
    countrySlug: slugOf("Montenegro"),
    flag: flagOf("Montenegro"),
    city: "Kotor",
    tagline: "The Adriatic's quietest crown jewel.",
    heroPrompt:
      "Cinematic Kotor Bay sunrise with medieval walled town, church steeples and mountain reflections, premium travel editorial photography, ultra realistic",
    facts: [
      { label: "Capital", value: "Podgorica" },
      { label: "Language", value: "Montenegrin (EN spoken)" },
      { label: "Currency", value: "EUR (€)" },
      { label: "Timezone", value: "GMT+1" },
    ],
    bestSeason: SEASONS[2],
    visaInfo: "Schengen-friendly · Simplified stays 30–90 days",
    weather: "25–30°C summer · Winter ski in Kolašin",
    activities: ["Fiord Boat Trips", "Mountain Hiking", "Old Town Walking", "Seafood"],
    avgPrice: 980,
    popularity: 80,
    agencies: 11,
    rating: 4.7,
    reviews: 720,
    trendMonth: +36,
    mostBooked: "Budva",
    highlights: [
      "Kotor Fortress Hike",
      "Perast Our Lady of the Rocks",
      "Durmitor Black Lake",
      "Sveti Stefan Island",
    ],
    tips: [
      "Kotor Old Town parking is a nightmare — stay a 10-min walk away",
      "Rent a boat for Our Lady of the Rocks instead of the crowded ferry",
      "Try pršut and rakija on the coast",
    ],
    isHidden: true,
  },
  {
    country: "Vietnam",
    countrySlug: slugOf("Vietnam"),
    flag: flagOf("Vietnam"),
    city: "Hạ Long",
    tagline: "Emerald waters, rice terraces, soulful streets.",
    heroPrompt:
      "Cinematic Halong Bay limestone karsts at dawn with junk boat sail, emerald water, premium travel editorial photography, ultra realistic",
    facts: [
      { label: "Capital", value: "Hanoi" },
      { label: "Language", value: "Vietnamese" },
      { label: "Currency", value: "VND (₫)" },
      { label: "Timezone", value: "GMT+7" },
    ],
    bestSeason: SEASONS[2],
    visaInfo: "eVisa 90 days · Visa-free short stays for many nations",
    weather: "Hanoi cool winters · Saigon tropical year-round",
    activities: ["Hạ Long Cruises", "Sapa Trekking", "Hội An Lanterns", "Phở Crawls"],
    avgPrice: 860,
    popularity: 83,
    agencies: 19,
    rating: 4.7,
    reviews: 1660,
    trendMonth: +19,
    mostBooked: "Ho Chi Minh City",
    highlights: [
      "Sapa Rice Terraces",
      "Hội An Old Town",
      "Phong Nha-Ke Bang Caves",
      "Mekong Delta Floating Markets",
    ],
    tips: [
      "Grab taxi apps to avoid meter scams",
      "Motorbike rental requires an IDP for insurance",
      "Book Hội An tailor-made clothes with 3+ fittings",
    ],
    isHidden: true,
  },
];
