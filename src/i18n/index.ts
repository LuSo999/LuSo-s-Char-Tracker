import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import cs from './cs.json'
import en from './en.json'

export const languages = ['en', 'cs'] as const
export type Language = (typeof languages)[number]

const STORAGE_KEY = 'language'

// The browser remembers the last language (used before sign-in); the account's choice wins once it loads.
function storedLanguage(): Language {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'en' || v === 'cs') return v
  } catch {
    // storage unavailable (private mode etc.)
  }
  return 'en'
}

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, cs: { translation: cs } },
  lng: storedLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

if (typeof document !== 'undefined') document.documentElement.lang = storedLanguage()

export function setLanguage(lang: Language) {
  void i18n.changeLanguage(lang)
  document.documentElement.lang = lang
  try {
    localStorage.setItem(STORAGE_KEY, lang)
  } catch {
    // ignore
  }
}

export default i18n
