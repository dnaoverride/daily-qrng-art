"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { locales, localeLabels, type Locale } from "@/i18n/config";

interface LanguageSwitcherProps {
  currentLocale: Locale;
}

export function LanguageSwitcher({ currentLocale }: LanguageSwitcherProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  async function switchLocale(locale: Locale) {
    if (locale === currentLocale) return;
    await fetch("/api/set-locale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale }),
    });
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-1">
      {locales.map((locale) => (
        <button
          key={locale}
          type="button"
          disabled={isPending}
          onClick={() => void switchLocale(locale)}
          className={`text-xs px-2 py-1 rounded font-medium transition-colors ${
            locale === currentLocale
              ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
              : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
          }`}
        >
          {localeLabels[locale]}
        </button>
      ))}
    </div>
  );
}
