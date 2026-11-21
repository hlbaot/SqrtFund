"use client";

import React, { createContext, useContext, useCallback, useEffect, useState } from "react";
import type { Locale, Translations } from "@/lib/copy";
import { copy } from "@/lib/copy";

export const LOCALE_COOKIE_KEY = "sqrt-fund-locale";
export const STORAGE_KEY = "sqrt-fund-locale";
export const LOCALE_CHANGE_EVENT = "sqrt-fund-locale-change";
const ONE_YEAR_IN_SECONDS = 31536000;

function setLocaleCookie(locale: Locale) {
  if (typeof document === "undefined") return;
  try {
    document.cookie = `${LOCALE_COOKIE_KEY}=${locale}; path=/; max-age=${ONE_YEAR_IN_SECONDS}; SameSite=Lax`;
  } catch {
    // bỏ qua
  }
}

type LocaleContextType = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: Translations;
};

const LocaleContext = createContext<LocaleContextType | null>(null);

export function LocaleProvider({
  children,
  initialLocale = "en",
}: {
  children: React.ReactNode;
  initialLocale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  // Đồng bộ state khi prop initialLocale đổi
  useEffect(() => {
    setLocaleState(initialLocale);
  }, [initialLocale]);

  // Giữ <html lang="..."> khớp locale hiện tại
  useEffect(() => {
    try {
      document.documentElement.lang = locale;
    } catch {
      // bỏ qua
    }
  }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    setLocaleCookie(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      // bỏ qua
    }
    window.dispatchEvent(new Event(LOCALE_CHANGE_EVENT));
  }, []);

  // Migrate sau hydrate: chưa có cookie nhưng localStorage có giá trị thì chuyển sang cookie & state
  useEffect(() => {
    try {
      const hasCookie = document.cookie
        .split(";")
        .some((c) => c.trim().startsWith(`${LOCALE_COOKIE_KEY}=`));

      const stored = localStorage.getItem(STORAGE_KEY);
      if (!hasCookie && (stored === "vi" || stored === "en") && stored !== locale) {
        setLocale(stored);
      }
    } catch {
      // bỏ qua
    }
  }, [locale, setLocale]);

  // Lắng nghe sự kiện storage / giữa các tab
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && (e.newValue === "vi" || e.newValue === "en")) {
        setLocaleState(e.newValue);
        setLocaleCookie(e.newValue);
      }
    };
    const handleCustom = () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored === "vi" || stored === "en") {
          setLocaleState(stored);
        }
      } catch {
        // bỏ qua
      }
    };
    window.addEventListener("storage", handleStorage);
    window.addEventListener(LOCALE_CHANGE_EVENT, handleCustom);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(LOCALE_CHANGE_EVENT, handleCustom);
    };
  }, []);

  const t = copy[locale];

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextType {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within a LocaleProvider");
  return ctx;
}
