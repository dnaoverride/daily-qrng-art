export const locales = ["sr"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "sr";
