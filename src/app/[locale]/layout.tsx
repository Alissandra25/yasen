import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { Geist_Mono, IBM_Plex_Serif, Play } from "next/font/google";
import type { Metadata } from "next";
import { QueryProvider } from "@/components/query-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { getCurrentBusiness } from "@/server/services/business";
import "../globals.css";

// Named "--font-sans" (not "--font-ibm-plex-serif") to match the theme's own
// `--font-sans: var(--font-sans)` mapping in globals.css — that line only resolves to a real
// font if something upstream defines this exact variable name in the cascade.
const ibmPlexSerif = IBM_Plex_Serif({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const play = Play({
  variable: "--font-play",
  subsets: ["cyrillic-ext", "latin"],
  weight: ["400", "700"]
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Every page reads live business/session data, so nothing here should be statically cached
// from build time.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  const business = await getCurrentBusiness();
  return {
    title: business?.name ?? t("title"),
    description: business?.description ?? t("description"),
  };
}

export default async function LocaleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={`${ibmPlexSerif.variable} ${geistMono.variable} ${play.variable} min-h-full flex flex-col antialiased`}
      >
        <NextIntlClientProvider>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <QueryProvider>{children}</QueryProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
