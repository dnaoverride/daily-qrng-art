"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useSession, signOut } from "next-auth/react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import type { Locale } from "@/i18n/config";

interface HeaderProps {
  currentLocale?: Locale;
}

export function Header({ currentLocale = "sr" }: HeaderProps) {
  const [open, setOpen] = useState(false);
  const t = useTranslations("header");
  const { data: session } = useSession();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 dark:bg-zinc-900/90 backdrop-blur border-b border-zinc-200 dark:border-zinc-800">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          {t("brand")}
        </Link>

        <div className="flex items-center gap-2">
          <LanguageSwitcher currentLocale={currentLocale} />

          {session?.user && (
            <Link
              href="/profile"
              className="hidden sm:flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-xs font-medium text-zinc-700 dark:text-zinc-300">
                {session.user.name?.[0]?.toUpperCase() ?? session.user.email?.[0]?.toUpperCase() ?? "?"}
              </div>
            </Link>
          )}

          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            aria-label={t("menuAria")}
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {open ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <nav className="absolute top-full left-0 right-0 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 shadow-lg">
          <div className="max-w-5xl mx-auto px-4 py-4 space-y-1">
            <Link
              href="/archive"
              onClick={() => setOpen(false)}
              className="block py-2 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 font-medium"
            >
              {t("archive")}
            </Link>
            <Link
              href="/create-art"
              onClick={() => setOpen(false)}
              className="block py-2 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 font-medium"
            >
              {t("playground")}
            </Link>

            <div className="border-t border-zinc-100 dark:border-zinc-800 pt-2 mt-2">
              {session?.user ? (
                <>
                  <Link
                    href="/profile"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 py-2 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 font-medium"
                  >
                    <div className="w-7 h-7 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-xs font-medium shrink-0">
                      {session.user.name?.[0]?.toUpperCase() ?? session.user.email?.[0]?.toUpperCase() ?? "?"}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate">{session.user.name ?? "Profil"}</p>
                      <p className="text-xs text-zinc-400 truncate">{session.user.email}</p>
                    </div>
                  </Link>
                  <button
                    type="button"
                    onClick={() => { signOut({ callbackUrl: "/" }); setOpen(false); }}
                    className="block w-full text-left py-2 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 font-medium text-sm"
                  >
                    {t("logout")}
                  </button>
                </>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="block py-2 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 font-medium"
                >
                  {t("login")}
                </Link>
              )}
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}
