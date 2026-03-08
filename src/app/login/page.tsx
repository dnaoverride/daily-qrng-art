"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";

export default function LoginPage() {
  const router = useRouter();
  const t = useTranslations("login");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (mode === "register") {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        setError(data.error ?? t("errorRegister"));
        setLoading(false);
        return;
      }
    }

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError(t("errorWrongCredentials"));
      setLoading(false);
      return;
    }

    router.push("/profile");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <main className="pt-28 pb-16 px-4 max-w-md mx-auto">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 p-8">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-2 text-center">
            {mode === "login" ? t("titleLogin") : t("titleRegister")}
          </h1>
          <p className="text-sm text-zinc-500 text-center mb-6">
            {mode === "login" ? t("subtitleLogin") : t("subtitleRegister")}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  {t("nameLabel")}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("namePlaceholder")}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                {t("emailLabel")}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder={t("emailPlaceholder")}
                className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                {t("passwordLabel")}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder={mode === "register" ? t("passwordPlaceholderRegister") : t("passwordPlaceholderLogin")}
                className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading
                ? t("loading")
                : mode === "login"
                ? t("submitLogin")
                : t("submitRegister")}
            </button>
          </form>

          <p className="text-sm text-center text-zinc-500 mt-5">
            {mode === "login" ? (
              <>
                {t("noAccount")}{" "}
                <button
                  onClick={() => { setMode("register"); setError(null); }}
                  className="text-zinc-900 dark:text-zinc-100 font-medium underline underline-offset-2"
                >
                  {t("registerLink")}
                </button>
              </>
            ) : (
              <>
                {t("hasAccount")}{" "}
                <button
                  onClick={() => { setMode("login"); setError(null); }}
                  className="text-zinc-900 dark:text-zinc-100 font-medium underline underline-offset-2"
                >
                  {t("loginLink")}
                </button>
              </>
            )}
          </p>

          <p className="text-xs text-center text-zinc-400 mt-4">
            <Link href="/" className="hover:text-zinc-600 dark:hover:text-zinc-300">
              {t("backHome")}
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
