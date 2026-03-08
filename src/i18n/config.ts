export const locales = ["sr", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "sr";

export const localeLabels: Record<Locale, string> = {
  sr: "SR",
  en: "EN",
};
