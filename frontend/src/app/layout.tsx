import type { Metadata } from "next";
import { Geist_Mono, Noto_Sans, Poppins } from "next/font/google";
import "flag-icons/css/flag-icons.min.css";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SplashGate from "@/components/SplashScreen";
import { LanguageProvider } from "@/context/LanguageContext";
import { cookies } from "next/headers";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://127.0.0.1:3000";

const poppins = Poppins({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const azSans = Noto_Sans({
  variable: "--font-az-sans",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "TourPie",
    template: "%s | TourPie",
  },
  applicationName: "TourPie",
  description:
    "TourPie is a global travel marketplace where travelers discover, compare and book unique tours, activities, destinations and travel experiences from around the world.",
  keywords: [
    "TourPie",
    "travel marketplace",
    "tours",
    "activities",
    "destinations",
    "travel experiences",
    "discover your slice of the world",
  ],
  openGraph: {
    type: "website",
    siteName: "TourPie",
    title: "TourPie",
    description:
      "Discover your slice of the world with a global travel marketplace for tours, activities, destinations and unforgettable experiences.",
    images: [
      {
        url: "/tourpie-social.svg",
        width: 1200,
        height: 630,
        alt: "TourPie brand card",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "TourPie",
    description: "Discover your slice of the world.",
    images: ["/tourpie-social.svg"],
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-icon.svg", type: "image/svg+xml" }],
    shortcut: ["/tourpie-favicon.svg"],
  },
  themeColor: "#022A6B",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const langCookie = cookieStore.get("lang")?.value;
  const lang = langCookie === "ru" || langCookie === "az" || langCookie === "tr" ? langCookie : "en";
  const currencyCookie = cookieStore.get("currency")?.value;
  const currency =
    currencyCookie === "AZN" || currencyCookie === "USD" || currencyCookie === "EUR" || currencyCookie === "RUB" || currencyCookie === "TRY"
      ? currencyCookie
      : "USD";

  return (
    <html lang={lang}>
      <body
        className={`${poppins.variable} ${geistMono.variable} ${azSans.variable} antialiased min-h-screen bg-gray-50`}
      >
        <LanguageProvider initialLanguage={lang} initialCurrency={currency}>
          <SplashGate>
            <Navbar />
            <main>{children}</main>
            <Footer />
          </SplashGate>
        </LanguageProvider>
      </body>
    </html>
  );
}

