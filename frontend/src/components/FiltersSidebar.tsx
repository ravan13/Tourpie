"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";

export default function FiltersSidebar() {
  const { t } = useLanguage();
  const router = useRouter();
  const sp = useSearchParams();
  const spKey = sp.toString();

  const defaults = useMemo(() => {
    const getText = (key: string) => (sp.get(key) || "").trim();
    const getNum = (key: string) => {
      const raw = (sp.get(key) || "").trim();
      if (!raw) return "";
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0) return "";
      return String(n);
    };
    const currency = (getText("currency") || "USD").toUpperCase();
    const flexible = Boolean(getText("flexible_days"));
    return {
      country: getText("country"),
      city: getText("city"),
      region: getText("region"),
      destination: getText("destination"),
      currency,
      minBudget: getNum("min_budget"),
      maxBudget: getNum("max_budget"),
      departDate: getText("depart_date"),
      returnDate: getText("return_date"),
      flexible,
      flexibleDays: getNum("flexible_days") || "3",
      adults: getNum("adults") || "2",
      children: getNum("children") || "0",
      teenagers: getNum("teenagers") || "0",
      infants: getNum("infants") || "0",
      durationMin: getNum("duration_min"),
      durationMax: getNum("duration_max"),
      packageType: getText("package_type"),
      hotelRatingMin: getNum("hotel_rating_min"),
      transportationType: getText("transportation_type"),
    };
  }, [sp]);

  const handleApply = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const params = new URLSearchParams(sp.toString());

    const setOrDelete = (key: string, value: string | null) => {
      const v = (value || "").trim();
      if (!v) params.delete(key);
      else params.set(key, v);
    };

    setOrDelete("country", formData.get("country")?.toString() || null);
    setOrDelete("city", formData.get("city")?.toString() || null);
    setOrDelete("region", formData.get("region")?.toString() || null);
    setOrDelete("destination", formData.get("destination")?.toString() || null);

    const cur = (formData.get("currency")?.toString() || "USD").trim().toUpperCase();
    if (cur) params.set("currency", cur);
    else params.delete("currency");

    setOrDelete("min_budget", formData.get("min_budget")?.toString() || null);
    setOrDelete("max_budget", formData.get("max_budget")?.toString() || null);

    setOrDelete("depart_date", formData.get("depart_date")?.toString() || null);
    setOrDelete("return_date", formData.get("return_date")?.toString() || null);

    const flexible = formData.get("flexible")?.toString() === "on";
    if (flexible) setOrDelete("flexible_days", formData.get("flexible_days")?.toString() || null);
    else params.delete("flexible_days");

    const toCount = (key: string, fallback: number) => {
      const raw = (formData.get(key)?.toString() || "").trim();
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0) return fallback;
      return Math.floor(n);
    };
    const adults = toCount("adults", 2);
    const children = toCount("children", 0);
    const teenagers = toCount("teenagers", 0);
    const infants = toCount("infants", 0);
    setOrDelete("adults", String(adults));
    setOrDelete("children", String(children));
    setOrDelete("teenagers", String(teenagers));
    setOrDelete("infants", String(infants));
    params.set("people", String(Math.max(1, adults + children + teenagers + infants)));

    setOrDelete("duration_min", formData.get("duration_min")?.toString() || null);
    setOrDelete("duration_max", formData.get("duration_max")?.toString() || null);
    setOrDelete("package_type", formData.get("package_type")?.toString() || null);
    setOrDelete("hotel_rating_min", formData.get("hotel_rating_min")?.toString() || null);
    setOrDelete("transportation_type", formData.get("transportation_type")?.toString() || null);

    router.push(`/results?${params.toString()}`);
  };

  const handleClear = () => {
    const params = new URLSearchParams();
    router.push(`/results?${params.toString()}`);
  };

  return (
    <aside className="w-full">
      <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm lg:sticky lg:top-24 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-50 bg-gray-50/30 flex items-center justify-between">
          <div className="text-sm font-black text-gray-900 uppercase tracking-widest">{t("filters_title")}</div>
          <button type="button" onClick={handleClear} className="text-xs font-black text-gray-500 hover:text-gray-900 transition-colors">
            {t("filters_clear")}
          </button>
        </div>

        <form key={spKey} onSubmit={handleApply} className="p-6 space-y-6">
          <div className="space-y-3">
            <div className="text-xs font-black text-gray-400 uppercase tracking-widest">{t("filters_section_destination")}</div>
            <div className="grid grid-cols-1 gap-3">
              <input name="country" defaultValue={defaults.country} placeholder={t("filters_country_placeholder")} className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 font-bold text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500" />
              <input name="city" defaultValue={defaults.city} placeholder={t("filters_city_placeholder")} className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 font-bold text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500" />
              <input name="region" defaultValue={defaults.region} placeholder={t("filters_region_placeholder")} className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 font-bold text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500" />
              <input name="destination" defaultValue={defaults.destination} placeholder={t("filters_destination_search_placeholder")} className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 font-bold text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-xs font-black text-gray-400 uppercase tracking-widest">{t("filters_section_budget")}</div>
            <div className="grid grid-cols-2 gap-3">
              <input name="min_budget" inputMode="numeric" defaultValue={defaults.minBudget} placeholder={t("filters_min_placeholder")} className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 font-bold text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500" />
              <input name="max_budget" inputMode="numeric" defaultValue={defaults.maxBudget} placeholder={t("filters_max_placeholder")} className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 font-bold text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500" />
            </div>
            <select name="currency" defaultValue={defaults.currency} className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 font-black text-gray-900 focus:ring-2 focus:ring-blue-500">
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="AZN">AZN</option>
              <option value="TRY">TRY</option>
              <option value="RUB">RUB</option>
            </select>
          </div>

          <div className="space-y-3">
            <div className="text-xs font-black text-gray-400 uppercase tracking-widest">{t("filters_section_travel_dates")}</div>
            <div className="grid grid-cols-1 gap-3">
              <input name="depart_date" type="date" defaultValue={defaults.departDate} className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 font-bold text-gray-900 focus:ring-2 focus:ring-blue-500" />
              <input name="return_date" type="date" defaultValue={defaults.returnDate} className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 font-bold text-gray-900 focus:ring-2 focus:ring-blue-500" />
              <label className="flex items-center gap-3 text-sm font-bold text-gray-700">
                <input name="flexible" type="checkbox" defaultChecked={defaults.flexible} className="h-5 w-5" />
                {t("filters_flexible_dates")}
              </label>
              <select name="flexible_days" defaultValue={defaults.flexibleDays} className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 font-black text-gray-900 focus:ring-2 focus:ring-blue-500">
                <option value="1">{t("filters_flexible_days", { days: 1 })}</option>
                <option value="3">{t("filters_flexible_days", { days: 3 })}</option>
                <option value="5">{t("filters_flexible_days", { days: 5 })}</option>
                <option value="7">{t("filters_flexible_days", { days: 7 })}</option>
                <option value="14">{t("filters_flexible_days", { days: 14 })}</option>
              </select>
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-xs font-black text-gray-400 uppercase tracking-widest">{t("filters_section_travelers")}</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs font-black text-gray-500">{t("filters_adults")}</div>
                <input name="adults" inputMode="numeric" defaultValue={defaults.adults} className="mt-2 w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 font-bold text-gray-900 focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <div className="text-xs font-black text-gray-500">{t("filters_children")}</div>
                <input name="children" inputMode="numeric" defaultValue={defaults.children} className="mt-2 w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 font-bold text-gray-900 focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <div className="text-xs font-black text-gray-500">{t("filters_teenagers")}</div>
                <input name="teenagers" inputMode="numeric" defaultValue={defaults.teenagers} className="mt-2 w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 font-bold text-gray-900 focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <div className="text-xs font-black text-gray-500">{t("filters_infants")}</div>
                <input name="infants" inputMode="numeric" defaultValue={defaults.infants} className="mt-2 w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 font-bold text-gray-900 focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-xs font-black text-gray-400 uppercase tracking-widest">{t("filters_section_more")}</div>
            <div className="grid grid-cols-2 gap-3">
              <input name="duration_min" inputMode="numeric" defaultValue={defaults.durationMin} placeholder={t("filters_min_days_placeholder")} className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 font-bold text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500" />
              <input name="duration_max" inputMode="numeric" defaultValue={defaults.durationMax} placeholder={t("filters_max_days_placeholder")} className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 font-bold text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500" />
            </div>
            <select name="package_type" defaultValue={defaults.packageType} className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 font-black text-gray-900 focus:ring-2 focus:ring-blue-500">
              <option value="">{t("filters_package_type")}</option>
              <option value="tour">{t("filters_package_type_tour")}</option>
              <option value="city_break">{t("filters_package_type_city_break")}</option>
              <option value="beach">{t("filters_package_type_beach")}</option>
              <option value="adventure">{t("filters_package_type_adventure")}</option>
              <option value="wellness">{t("filters_package_type_wellness")}</option>
              <option value="family">{t("filters_package_type_family")}</option>
            </select>
            <select name="hotel_rating_min" defaultValue={defaults.hotelRatingMin} className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 font-black text-gray-900 focus:ring-2 focus:ring-blue-500">
              <option value="">{t("filters_hotel_rating")}</option>
              <option value="1">{t("filters_stars_plus", { stars: 1 })}</option>
              <option value="2">{t("filters_stars_plus", { stars: 2 })}</option>
              <option value="3">{t("filters_stars_plus", { stars: 3 })}</option>
              <option value="4">{t("filters_stars_plus", { stars: 4 })}</option>
              <option value="5">{t("filters_stars_exact", { stars: 5 })}</option>
            </select>
            <select name="transportation_type" defaultValue={defaults.transportationType} className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 font-black text-gray-900 focus:ring-2 focus:ring-blue-500">
              <option value="">{t("filters_transportation")}</option>
              <option value="flight">{t("filters_transportation_flight")}</option>
              <option value="train">{t("filters_transportation_train")}</option>
              <option value="bus">{t("filters_transportation_bus")}</option>
              <option value="car">{t("filters_transportation_car")}</option>
              <option value="cruise">{t("filters_transportation_cruise")}</option>
            </select>
          </div>

          <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl transition shadow-sm shadow-blue-200">
            {t("filters_apply")}
          </button>
        </form>
      </div>
    </aside>
  );
}
