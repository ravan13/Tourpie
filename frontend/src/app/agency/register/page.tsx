"use client";

import { api, getStoredToken, getStoredTokenPayload } from "@/lib/api";
import { useLanguage } from "@/context/LanguageContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";

export default function AgencyRegisterPage() {
  const { t, language } = useLanguage();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    void (async () => {
      const debugRedirects = process.env.NEXT_PUBLIC_DEBUG_REDIRECTS === "1";
      const token = getStoredToken();
      if (!token) {
        setReady(true);
        return;
      }
      const decoded = getStoredTokenPayload();
      const role = typeof decoded?.role === "string" ? decoded.role : null;
      const agencyStatus = typeof decoded?.agency_status === "string" ? decoded.agency_status : null;
      if (debugRedirects) {
        console.warn("[agency/register] redirect-check", { role, agencyStatus });
      }
      if (role === "admin") {
        router.replace("/admin");
        return;
      }
      if (role === "agency") {
        const statusValue = (agencyStatus || "").toLowerCase();
        if (statusValue === "approved") {
          router.replace("/agency");
          return;
        }
        if (statusValue === "rejected") {
          router.replace("/agency/rejected");
          return;
        }
        router.replace("/agency/pending-review");
        return;
      }
      router.replace("/dashboard");
    })();
  }, [router]);

  const [agencyName, setAgencyName] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [country, setCountry] = useState("");
  const [officeAddress, setOfficeAddress] = useState("");
  const [website, setWebsite] = useState("");
  const [taxVatInfo, setTaxVatInfo] = useState("");
  const [password, setPassword] = useState("");

  const [businessLicense, setBusinessLicense] = useState<File | null>(null);
  const [tourismCertificate, setTourismCertificate] = useState<File | null>(null);
  const [idVerification, setIdVerification] = useState<File | null>(null);

  if (!ready) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-sm font-bold text-gray-500">{t("common_loading")}</div>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const body = new FormData();
      body.set("agency_name", agencyName);
      body.set("company_email", companyEmail);
      body.set("phone_number", phoneNumber);
      body.set("country", country);
      body.set("office_address", officeAddress);
      body.set("tax_vat_info", taxVatInfo);
      body.set("password", password);
      body.set("language", language);
      if (website.trim()) body.set("website", website.trim());

      if (businessLicense) body.set("business_license", businessLicense);
      if (tourismCertificate) body.set("tourism_certificate", tourismCertificate);
      if (idVerification) body.set("id_verification", idVerification);

      await api.agencies.apply(body);
      setMessage({ type: "success", text: t("agency_register_success") });
      setTimeout(() => {
        router.push("/login");
      }, 1200);
    } catch (error) {
      const text = error instanceof Error ? error.message : t("agency_register_error");
      setMessage({ type: "error", text });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-10">
          <Logo />
          <Link href="/" className="text-sm font-bold text-gray-700 hover:text-blue-600">
            {t("agency_register_back_home")}
          </Link>
        </div>

        <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-8">
          <h1 className="text-3xl font-black text-gray-900 mb-2">{t("agency_register_title")}</h1>
          <p className="text-gray-500 font-medium mb-8">{t("agency_register_subtitle")}</p>

          <form onSubmit={submit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                  {t("agency_register_agency_name")}
                </label>
                <input
                  value={agencyName}
                  onChange={(e) => setAgencyName(e.target.value)}
                  type="text"
                  required
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 font-medium text-gray-900 placeholder-gray-400"
                  placeholder={t("agency_register_agency_name_placeholder")}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                  {t("agency_register_company_email")}
                </label>
                <input
                  value={companyEmail}
                  onChange={(e) => setCompanyEmail(e.target.value)}
                  type="email"
                  required
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 font-medium text-gray-900 placeholder-gray-400"
                  placeholder={t("agency_register_company_email_placeholder")}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                  {t("agency_register_phone")}
                </label>
                <input
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  type="tel"
                  required
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 font-medium text-gray-900 placeholder-gray-400"
                  placeholder={t("agency_register_phone_placeholder")}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                  {t("agency_register_country")}
                </label>
                <input
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  type="text"
                  required
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 font-medium text-gray-900 placeholder-gray-400"
                  placeholder={t("agency_register_country_placeholder")}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                {t("agency_register_office_address")}
              </label>
              <input
                value={officeAddress}
                onChange={(e) => setOfficeAddress(e.target.value)}
                type="text"
                required
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 font-medium text-gray-900 placeholder-gray-400"
                placeholder={t("agency_register_office_address_placeholder")}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                  {t("agency_register_website")}
                </label>
                <input
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  type="url"
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 font-medium text-gray-900 placeholder-gray-400"
                  placeholder={t("agency_register_website_placeholder")}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                  {t("agency_register_tax_vat")}
                </label>
                <input
                  value={taxVatInfo}
                  onChange={(e) => setTaxVatInfo(e.target.value)}
                  type="text"
                  required
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 font-medium text-gray-900 placeholder-gray-400"
                  placeholder={t("agency_register_tax_vat_placeholder")}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                {t("agency_register_password")}
              </label>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                required
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 font-medium text-gray-900 placeholder-gray-400"
                placeholder={t("agency_register_password_placeholder")}
              />
            </div>

            <div className="bg-gray-50 border border-gray-100 rounded-2xl p-6">
              <h2 className="text-lg font-black text-gray-900 mb-1">{t("agency_register_documents_title")}</h2>
              <p className="text-sm text-gray-500 font-medium mb-6">{t("agency_register_documents_subtitle")}</p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white border border-gray-200 rounded-2xl p-4">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                    {t("agency_register_doc_business_license")}
                  </p>
                  <input
                    type="file"
                    onChange={(e) => setBusinessLicense(e.target.files?.[0] || null)}
                    className="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-blue-600 file:text-white file:font-bold hover:file:bg-blue-700"
                  />
                </div>
                <div className="bg-white border border-gray-200 rounded-2xl p-4">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                    {t("agency_register_doc_tourism_certificate")}
                  </p>
                  <input
                    type="file"
                    onChange={(e) => setTourismCertificate(e.target.files?.[0] || null)}
                    className="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-blue-600 file:text-white file:font-bold hover:file:bg-blue-700"
                  />
                </div>
                <div className="bg-white border border-gray-200 rounded-2xl p-4">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                    {t("agency_register_doc_id_verification")}
                  </p>
                  <input
                    type="file"
                    onChange={(e) => setIdVerification(e.target.files?.[0] || null)}
                    className="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-blue-600 file:text-white file:font-bold hover:file:bg-blue-700"
                  />
                </div>
              </div>
            </div>

            {message ? (
              <div
                className={`p-4 rounded-xl text-sm font-bold ${
                  message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                }`}
              >
                {message.text}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className={`w-full font-bold py-4 rounded-2xl transition duration-200 shadow-lg ${
                loading
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200"
              }`}
            >
              {loading ? t("agency_register_submitting") : t("agency_register_submit")}
            </button>

            <p className="text-center text-xs text-gray-400">{t("agency_register_pending_note")}</p>
          </form>
        </div>
      </div>
    </div>
  );
}
