import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "uk", "ru"],
  // The shop this app serves is Ukrainian; English and Russian are the other launch languages.
  defaultLocale: "uk",
});
