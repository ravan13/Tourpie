"use client";

import { useEffect, useMemo, useState } from "react";
import { api, clearSessionToken, getStoredToken, Package, PackageCreate } from "@/lib/api";
import NextImage from "next/image";
import { Currency, useLanguage } from "@/context/LanguageContext";

interface PackageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingPackage?: Package | null;
  agencyId: number;
}

const currencyOptions: Currency[] = ["USD", "EUR", "AZN", "RUB", "TRY"];
const currencySymbol: Record<Currency, string> = {
  USD: "$",
  EUR: "€",
  AZN: "₼",
  RUB: "₽",
  TRY: "₺",
};

export default function PackageModal({ isOpen, onClose, onSuccess, editingPackage, agencyId }: PackageModalProps) {
  const { t } = useLanguage();
  const placeholderImage = useMemo(
    () =>
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=80",
    []
  );
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    price: 0,
    destination: "",
    country: "",
    city: "",
    duration_days: 0,
    capacity: 0,
    category: "Nature",
    status: "active" as "draft" | "active" | "expired" | "archived",
    start_date: "",
    end_date: "",
    highlights: "",
  });
  const [pricingMode, setPricingMode] = useState<"auto" | "manual">("auto");
  const [baseCurrency, setBaseCurrency] = useState<Currency>("USD");
  const [manualPrices, setManualPrices] = useState<Record<Currency, string>>({
    USD: "",
    EUR: "",
    AZN: "",
    RUB: "",
    TRY: "",
  });

  const [images, setImages] = useState<string[]>([]);
  const [urlToAdd, setUrlToAdd] = useState("");
  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [brokenImages, setBrokenImages] = useState<Record<string, true>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const id = window.setTimeout(() => {
      setFormData({
        title: editingPackage?.title || "",
        description: editingPackage?.description || "",
        price: typeof editingPackage?.price === "number" && Number.isFinite(editingPackage.price) ? editingPackage.price : 0,
        destination: editingPackage?.destination || "",
        country: typeof editingPackage?.country === "string" ? editingPackage.country : "",
        city: typeof editingPackage?.city === "string" ? editingPackage.city : "",
        duration_days:
          typeof editingPackage?.duration_days === "number" && Number.isFinite(editingPackage.duration_days) ? editingPackage.duration_days : 0,
        capacity: typeof editingPackage?.capacity === "number" && Number.isFinite(editingPackage.capacity) ? editingPackage.capacity : 0,
        category: editingPackage?.category || "Nature",
        status: (editingPackage?.status as "draft" | "active" | "expired" | "archived") || "active",
        start_date:
          typeof editingPackage?.start_date === "string"
            ? editingPackage.start_date.slice(0, 10)
            : "",
        end_date:
          typeof editingPackage?.end_date === "string"
            ? editingPackage.end_date.slice(0, 10)
            : "",
        highlights: editingPackage?.highlights ? editingPackage.highlights.join(", ") : "",
      });

      const mode = editingPackage?.pricing_mode === "manual" ? "manual" : "auto";
      setPricingMode(mode);
      setBaseCurrency(
        currencyOptions.includes((editingPackage?.base_currency as Currency) || "USD")
          ? ((editingPackage?.base_currency as Currency) || "USD")
          : "USD"
      );

      const nextPrices: Record<Currency, string> = { USD: "", EUR: "", AZN: "", RUB: "", TRY: "" };
      const incoming = editingPackage?.prices && typeof editingPackage.prices === "object" ? editingPackage.prices : null;
      for (const c of currencyOptions) {
        const v = incoming ? (incoming as Record<string, unknown>)[c] : undefined;
        if (typeof v === "number" && Number.isFinite(v) && v >= 0) nextPrices[c] = String(v);
      }
      setManualPrices(nextPrices);

      const base =
        editingPackage?.images && editingPackage.images.length
          ? editingPackage.images
          : editingPackage?.image_url
            ? [editingPackage.image_url]
            : [];
      setImages(
        base
          .filter((v) => typeof v === "string")
          .map((v) => v.trim())
          .filter(Boolean)
      );

      setUrlToAdd("");
      setImageBusy(false);
      setImageError(null);
      setDragIndex(null);
      setBrokenImages({});
      setLoading(false);
    }, 0);
    return () => window.clearTimeout(id);
  }, [editingPackage, isOpen]);

  const verifyImageUrl = (url: string) => {
    return new Promise<boolean>((resolve) => {
      try {
        const img = new window.Image();
        const done = (ok: boolean) => {
          img.onload = null;
          img.onerror = null;
          resolve(ok);
        };
        const timeout = window.setTimeout(() => done(false), 4500);
        img.onload = () => {
          window.clearTimeout(timeout);
          done(true);
        };
        img.onerror = () => {
          window.clearTimeout(timeout);
          done(false);
        };
        img.src = url;
      } catch {
        resolve(false);
      }
    });
  };

  const addImageUrl = async () => {
    const raw = urlToAdd.trim();
    if (!raw) return;
    setImageError(null);
    try {
      const u = new URL(raw);
      if (u.protocol !== "http:" && u.protocol !== "https:") {
        setImageError(t("package_modal_error_invalid_url"));
        return;
      }
    } catch {
      setImageError(t("package_modal_error_invalid_url"));
      return;
    }

    if (images.includes(raw)) {
      setUrlToAdd("");
      return;
    }

    setImageBusy(true);
    const ok = await verifyImageUrl(raw);
    setImageBusy(false);
    if (!ok) {
      setImageError(t("package_modal_error_image_not_loaded"));
      return;
    }
    setImages((prev) => [...prev, raw]);
    setUrlToAdd("");
  };

  const readFileAsDataUrl = (file: File) => {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error(t("package_modal_error_read_file")));
      reader.onload = () => resolve(String(reader.result || ""));
      reader.readAsDataURL(file);
    });
  };

  const addFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setImageError(null);
    const allowedTypes = new Set([
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "image/svg+xml",
      "image/jpg",
    ]);
    const maxSizeBytes = 5 * 1024 * 1024;
    const next: string[] = [];
    setImageBusy(true);
    try {
      for (const file of Array.from(fileList)) {
        const ext = file.name.split(".").pop()?.toLowerCase() || "";
        const okType =
          (file.type && allowedTypes.has(file.type)) ||
          ["jpg", "jpeg", "png", "webp", "gif", "svg"].includes(ext);
        if (!okType) {
          setImageError(t("package_modal_error_unsupported_image_type"));
          continue;
        }
        if (file.size > maxSizeBytes) {
          setImageError(t("package_modal_error_image_too_large"));
          continue;
        }
        const dataUrl = await readFileAsDataUrl(file);
        if (!dataUrl.startsWith("data:image/")) {
          setImageError(t("package_modal_error_unsupported_image_data"));
          continue;
        }
        next.push(dataUrl);
      }
    } finally {
      setImageBusy(false);
    }
    if (next.length) {
      setImages((prev) => [...prev, ...next]);
    }
  };

  const moveImage = (from: number, to: number) => {
    setImages((prev) => {
      if (from < 0 || from >= prev.length) return prev;
      if (to < 0 || to >= prev.length) return prev;
      const copy = prev.slice();
      const [item] = copy.splice(from, 1);
      copy.splice(to, 0, item);
      return copy;
    });
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const token = getStoredToken();
    if (!token) {
      alert(t("package_modal_error_login_required"));
      setLoading(false);
      return;
    }

    if (images.length === 0) {
      alert(t("package_modal_error_add_image"));
      setLoading(false);
      return;
    }

    const parsedPrices: Partial<Record<Currency, number>> = {};
    for (const c of currencyOptions) {
      const raw = manualPrices[c].trim();
      if (!raw) continue;
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0) continue;
      parsedPrices[c] = n;
    }

    if (pricingMode === "manual" && Object.keys(parsedPrices).length === 0) {
      alert(t("package_modal_error_set_price"));
      setLoading(false);
      return;
    }

    const baseManual = typeof parsedPrices[baseCurrency] === "number" ? Number(parsedPrices[baseCurrency]) : null;

    const startDate = formData.start_date ? new Date(`${formData.start_date}T00:00:00Z`) : null;
    const endDate = formData.end_date ? new Date(`${formData.end_date}T00:00:00Z`) : null;
    if (startDate && Number.isNaN(startDate.getTime())) {
      alert(t("package_modal_error_invalid_start_date"));
      setLoading(false);
      return;
    }
    if (endDate && Number.isNaN(endDate.getTime())) {
      alert(t("package_modal_error_invalid_end_date"));
      setLoading(false);
      return;
    }
    if (startDate && endDate && startDate.getTime() > endDate.getTime()) {
      alert(t("package_modal_error_end_date_before_start"));
      setLoading(false);
      return;
    }

    const payload: PackageCreate = {
      title: formData.title.trim(),
      description: formData.description.trim(),
      price:
        pricingMode === "manual"
          ? Math.max(0, baseManual ?? (Number(formData.price) || 0))
          : Math.max(0, Number(formData.price) || 0),
      status: formData.status,
      pricing_mode: pricingMode,
      base_currency: baseCurrency,
      prices: pricingMode === "manual" ? parsedPrices : null,
      destination: formData.destination.trim(),
      country: formData.country.trim() || null,
      city: formData.city.trim() || null,
      duration_days: Math.max(0, Number(formData.duration_days) || 0),
      capacity: Math.max(0, Number(formData.capacity) || 0),
      start_date: formData.start_date ? formData.start_date : null,
      end_date: formData.end_date ? formData.end_date : null,
      image_url: images[0] || placeholderImage,
      category: formData.category,
      agency_id: agencyId,
      highlights: formData.highlights
        .split(",")
        .map((h) => h.trim())
        .filter(Boolean),
      images,
    };

    try {
      if (editingPackage) {
        await api.packages.update(editingPackage.id, payload);
      } else {
        await api.packages.create(payload);
      }
      onSuccess();
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.toLowerCase().includes("not authenticated") || message.toLowerCase().includes("invalid token")) {
        await clearSessionToken();
        alert(t("package_modal_error_session_expired"));
        window.location.href = "/login";
        return;
      }
      alert(t("package_modal_error_save_failed"));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="tp-motion-modal-backdrop fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="tp-motion-modal-panel bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="p-8">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900">
              {editingPackage ? t("package_modal_title_edit") : t("package_modal_title_create")}
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                {t("package_modal_label_title")}
              </label>
              <input
                required
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 font-medium text-gray-900 placeholder-gray-400"
                placeholder={t("package_modal_placeholder_title")}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                {t("package_modal_label_description")}
              </label>
              <textarea
                required
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 font-medium text-gray-900 placeholder-gray-400"
                placeholder={t("package_modal_placeholder_description")}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                {t("package_modal_label_destination")}
              </label>
              <input
                required
                type="text"
                value={formData.destination}
                onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 font-medium text-gray-900 placeholder-gray-400"
                placeholder={t("package_modal_placeholder_destination")}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                {t("package_modal_label_status")}
              </label>
              <select
                value={formData.status}
                onChange={(e) =>
                  setFormData({ ...formData, status: e.target.value as "draft" | "active" | "expired" | "archived" })
                }
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 font-medium text-gray-900"
              >
                <option value="draft">{t("package_status_draft")}</option>
                <option value="active">{t("package_status_active")}</option>
                <option value="expired">{t("package_status_expired")}</option>
                <option value="archived">{t("package_status_archived")}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                {t("package_modal_label_country")}
              </label>
              <input
                type="text"
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 font-medium text-gray-900 placeholder-gray-400"
                placeholder={t("package_modal_placeholder_country")}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                {t("package_modal_label_city")}
              </label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 font-medium text-gray-900 placeholder-gray-400"
                placeholder={t("package_modal_placeholder_city")}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                {t("package_modal_label_start_date")}
              </label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 font-medium text-gray-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                {t("package_modal_label_end_date")}
              </label>
              <input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 font-medium text-gray-900"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                {t("package_modal_label_pricing")}
              </label>
              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div className="inline-flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-2xl p-1">
                    <button
                      type="button"
                      onClick={() => setPricingMode("auto")}
                      className={`px-4 py-2 rounded-xl text-xs font-black transition ${
                        pricingMode === "auto" ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-white"
                      }`}
                    >
                      {t("package_modal_pricing_auto")}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPricingMode("manual");
                        setManualPrices((prev) => {
                          const next = { ...prev };
                          if (!next[baseCurrency].trim() && Number.isFinite(formData.price) && formData.price > 0) {
                            next[baseCurrency] = String(formData.price);
                          }
                          return next;
                        });
                      }}
                      className={`px-4 py-2 rounded-xl text-xs font-black transition ${
                        pricingMode === "manual" ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-white"
                      }`}
                    >
                      {t("package_modal_pricing_manual")}
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                      {t("package_modal_pricing_base")}
                    </div>
                    <select
                      value={baseCurrency}
                      onChange={(e) => setBaseCurrency(e.target.value as Currency)}
                      className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-black text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {currencyOptions.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {pricingMode === "auto" ? (
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                        {t("package_modal_pricing_base_price")}
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-4 flex items-center text-gray-500 font-black">
                          {currencySymbol[baseCurrency]}
                        </div>
                        <input
                          required
                          type="number"
                          min={0}
                          step="0.01"
                          value={formData.price}
                          onChange={(e) => setFormData({ ...formData, price: Math.max(0, Number(e.target.value) || 0) })}
                          className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-3 focus:ring-2 focus:ring-blue-500 font-medium text-gray-900 placeholder-gray-400"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {currencyOptions.map((c) => (
                      <div key={c} className="relative">
                        <div className="absolute inset-y-0 left-4 flex items-center text-gray-500 font-black">
                          {currencySymbol[c]}
                        </div>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={manualPrices[c]}
                          onChange={(e) => {
                            const v = e.target.value;
                            setManualPrices((prev) => ({ ...prev, [c]: v }));
                          }}
                          className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-3 focus:ring-2 focus:ring-blue-500 font-medium text-gray-900 placeholder-gray-400"
                          placeholder={c}
                        />
                        <div className="absolute -top-2 right-3 bg-white px-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                          {c}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                {t("package_modal_label_duration_days")}
              </label>
              <input
                required
                type="number"
                min={0}
                value={formData.duration_days}
                onChange={(e) => setFormData({ ...formData, duration_days: Math.max(0, Number(e.target.value) || 0) })}
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 font-medium text-gray-900 placeholder-gray-400"
                placeholder="7"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                {t("package_modal_label_capacity_people")}
              </label>
              <input
                required
                type="number"
                min={0}
                value={formData.capacity}
                onChange={(e) => setFormData({ ...formData, capacity: Math.max(0, Number(e.target.value) || 0) })}
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 font-medium text-gray-900 placeholder-gray-400"
                placeholder="20"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                {t("package_modal_label_category")}
              </label>
              <select
                required
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 font-medium text-gray-900"
              >
                <option value="Nature">{t("marketplace_category_nature")}</option>
                <option value="Adventure">{t("marketplace_category_adventure")}</option>
                <option value="Culture">{t("marketplace_category_culture")}</option>
                <option value="History">{t("marketplace_category_history")}</option>
                <option value="City">{t("marketplace_category_city")}</option>
                <option value="Beach">{t("marketplace_category_beach")}</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                {t("package_modal_label_images")}
              </label>
              <div
                className="rounded-2xl border border-gray-200 bg-white p-4"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const files = e.dataTransfer?.files || null;
                  void addFiles(files);
                }}
              >
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="url"
                      value={urlToAdd}
                      onChange={(e) => setUrlToAdd(e.target.value)}
                      className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 font-medium text-gray-900 placeholder-gray-400"
                      placeholder={t("package_modal_placeholder_image_url")}
                    />
                    <button
                      type="button"
                      disabled={imageBusy || !urlToAdd.trim()}
                      onClick={() => void addImageUrl()}
                      className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-100 disabled:text-gray-400 text-white font-bold px-5 py-3 rounded-xl transition"
                    >
                      {imageBusy ? t("package_modal_button_adding") : t("package_modal_button_add_url")}
                    </button>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
                      multiple
                      onChange={(e) => void addFiles(e.target.files)}
                      className="block w-full text-sm text-gray-600 file:mr-4 file:py-3 file:px-5 file:rounded-xl file:border-0 file:bg-gray-100 file:text-gray-900 file:font-bold hover:file:bg-blue-50"
                    />
                    <div className="text-xs font-bold text-gray-500">
                      {t("package_modal_drag_hint")}
                    </div>
                  </div>

                  {imageError ? <div className="text-sm font-bold text-red-600">{imageError}</div> : null}

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {(images.length ? images : [placeholderImage]).map((src, idx) => {
                      const isPlaceholder = images.length === 0;
                      const resolvedSrc = brokenImages[src] ? placeholderImage : src;
                      return (
                        <div
                          key={`${idx}-${src.slice(0, 30)}`}
                          className={`rounded-2xl border overflow-hidden bg-gray-50 ${idx === 0 && !isPlaceholder ? "border-blue-600" : "border-gray-200"}`}
                          draggable={!isPlaceholder}
                          onDragStart={() => setDragIndex(idx)}
                          onDragEnd={() => setDragIndex(null)}
                          onDragOver={(e) => {
                            if (isPlaceholder) return;
                            e.preventDefault();
                          }}
                          onDrop={() => {
                            if (isPlaceholder) return;
                            if (dragIndex == null || dragIndex === idx) return;
                            moveImage(dragIndex, idx);
                            setDragIndex(null);
                          }}
                        >
                          <div className="relative w-full aspect-[4/3] bg-gray-100">
                            <NextImage
                              src={resolvedSrc}
                              alt={t("package_modal_label_images")}
                              fill
                              sizes="(max-width: 640px) 50vw, 33vw"
                              className="object-cover"
                              onError={() => {
                                setBrokenImages((prev) => (prev[src] ? prev : { ...prev, [src]: true }));
                              }}
                            />
                          </div>
                          {!isPlaceholder ? (
                            <div className="p-2 flex items-center justify-between gap-2">
                              <div className="text-[11px] font-black text-gray-500">
                                {idx === 0 ? t("package_modal_cover") : `#${idx + 1}`}
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => moveImage(idx, idx - 1)}
                                  disabled={idx === 0}
                                  className="h-8 w-8 rounded-lg bg-white border border-gray-200 text-gray-700 font-black disabled:opacity-40 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition"
                                  aria-label={t("package_modal_aria_move_left")}
                                >
                                  ←
                                </button>
                                <button
                                  type="button"
                                  onClick={() => moveImage(idx, idx + 1)}
                                  disabled={idx === images.length - 1}
                                  className="h-8 w-8 rounded-lg bg-white border border-gray-200 text-gray-700 font-black disabled:opacity-40 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition"
                                  aria-label={t("package_modal_aria_move_right")}
                                >
                                  →
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeImage(idx)}
                                  className="h-8 w-8 rounded-lg bg-white border border-gray-200 text-gray-700 font-black hover:bg-red-50 hover:text-red-700 hover:border-red-200 transition"
                                  aria-label={t("package_modal_aria_remove")}
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="p-2 text-[11px] font-black text-gray-500">{t("package_modal_preview_placeholder")}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                {t("package_modal_label_highlights")}
              </label>
              <input
                type="text"
                value={formData.highlights}
                onChange={(e) => setFormData({ ...formData, highlights: e.target.value })}
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 font-medium text-gray-900 placeholder-gray-400"
                placeholder={t("package_modal_placeholder_highlights")}
              />
            </div>

            <div className="md:col-span-2 flex gap-4 mt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-4 rounded-2xl transition duration-200"
              >
                {t("common_cancel")}
              </button>
              <button
                disabled={loading}
                type="submit"
                className="flex-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-12 rounded-2xl transition duration-200 shadow-lg shadow-blue-100 disabled:bg-gray-100 disabled:text-gray-400"
              >
                {loading
                  ? t("package_modal_submit_saving")
                  : editingPackage
                    ? t("package_modal_submit_update")
                    : t("package_modal_submit_create")}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
