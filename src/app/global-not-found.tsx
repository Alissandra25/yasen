/* eslint-disable i18next/no-literal-string --
 * This page bypasses app/[locale]/layout.tsx entirely (see next.config.ts's note on
 * globalNotFound), so it has no next-intl locale context — a URL that matches no route at all
 * has no locale segment to read either. It defaults to the business's primary language (uk) and
 * routes "home" to the default locale rather than trying to guess the visitor's preference.
 */
import type { Metadata } from "next";
import { Manrope, Unbounded } from "next/font/google";
import { ErrorPanel } from "@/components/error-panel";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-sans",
  subsets: ["cyrillic-ext", "latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const unbounded = Unbounded({
  variable: "--font-logo",
  subsets: ["cyrillic-ext", "latin"],
  weight: ["600"],
});

export const metadata: Metadata = {
  title: "Такої сторінки немає",
  description: "Перевірте адресу або поверніться на головну.",
};

export default function GlobalNotFound() {
  return (
    <html lang="uk" className={`${manrope.variable} ${unbounded.variable}`}>
      <body className="flex min-h-svh flex-col antialiased">
        <ErrorPanel
          title="Такої сторінки немає"
          description="Перевірте адресу або поверніться на головну."
          homeHref="/uk"
          homeLabel="На головну"
        />
      </body>
    </html>
  );
}
