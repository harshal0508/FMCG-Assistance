'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { DICTIONARY, SupportedLanguage, TranslationKey } from './translations';

interface I18nContextType {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  toggleLanguage: () => void;
  t: (key: TranslationKey) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);

export function LanguageProvider({
  children,
  initialLanguage = 'en',
}: {
  children: React.ReactNode;
  initialLanguage?: SupportedLanguage;
}) {
  const [language, setLanguageState] = useState<SupportedLanguage>(initialLanguage);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const urlLang = urlParams.get('lang') as SupportedLanguage;
      if (urlLang === 'en' || urlLang === 'hi') {
        setLanguageState(urlLang);
        localStorage.setItem('vitarak_lang', urlLang);
        document.cookie = `vitarak_lang=${urlLang}; path=/; max-age=31536000`;
        document.documentElement.lang = urlLang;
        return;
      }
      const saved = localStorage.getItem('vitarak_lang') as SupportedLanguage;
      if (saved && (saved === 'en' || saved === 'hi')) {
        setLanguageState(saved);
        document.cookie = `vitarak_lang=${saved}; path=/; max-age=31536000`;
        document.documentElement.lang = saved;
      }
    }
  }, []);

  const setLanguage = (lang: SupportedLanguage) => {
    setLanguageState(lang);
    if (typeof window !== 'undefined') {
      localStorage.setItem('vitarak_lang', lang);
      document.cookie = `vitarak_lang=${lang}; path=/; max-age=31536000`;
      document.documentElement.lang = lang;
    }
  };

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'hi' : 'en');
  };

  const t = (key: TranslationKey): string => {
    const dict = DICTIONARY[language] || DICTIONARY.en;
    return dict[key] || DICTIONARY.en[key] || key;
  };

  return (
    <I18nContext.Provider value={{ language, setLanguage, toggleLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(I18nContext);
  if (!context) {
    // Fallback if rendered outside provider
    return {
      language: 'en' as SupportedLanguage,
      setLanguage: () => {},
      toggleLanguage: () => {},
      t: (key: TranslationKey) => DICTIONARY.en[key] || key,
    };
  }
  return context;
}

export const useLanguage = useTranslation;

