import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { Geist_Mono, Manrope, Unbounded } from "next/font/google";
import type { Metadata } from "next";
import { QueryProvider } from "@/components/query-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { ToastProvider } from "@/components/toast-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getCurrentBusiness } from "@/server/services/business";
import "../globals.css";

// UI typeface (spec 13.5 names it for the tagline; used across the whole app for consistency).
// Named "--font-sans" to match the theme's `--font-sans: var(--font-sans)` mapping in globals.css.
const manrope = Manrope({
  variable: "--font-sans",
  subsets: ["cyrillic-ext", "latin"],
  weight: ["400", "500", "600", "700", "800"],
});

// Logo wordmark only ("Ясен", spec 13.5) — never used for body UI text.
const unbounded = Unbounded({
  variable: "--font-logo",
  subsets: ["cyrillic-ext", "latin"],
  weight: ["600"],
});

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
        className={`${manrope.variable} ${geistMono.variable} ${unbounded.variable} min-h-full flex flex-col antialiased`}
      >
        <NextIntlClientProvider>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <QueryProvider>
              <TooltipProvider delay={400}>
                <ToastProvider>{children}</ToastProvider>
              </TooltipProvider>
            </QueryProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
