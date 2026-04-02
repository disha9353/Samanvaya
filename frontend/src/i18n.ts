import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import resourcesToBackend from 'i18next-resources-to-backend'

const SUPPORTED_LANGUAGES = ['en', 'hi', 'kn'] as const

i18n
  // Lazy-load JSON bundles per language (Vite code-splits these).
  .use(resourcesToBackend((lng: string) => import(`./locales/${lng}.json`)))
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    supportedLngs: [...SUPPORTED_LANGUAGES],
    nonExplicitSupportedLngs: true,
    load: 'languageOnly',

    // We use flat keys containing dots like "alerts.action_failed".
    // Disabling keySeparator prevents i18next from treating "." as nested path.
    keySeparator: false,

    interpolation: { escapeValue: false },

    detection: {
      order: ['querystring', 'localStorage', 'cookie', 'navigator', 'htmlTag'],
      caches: ['localStorage', 'cookie'],
    },
  })

export default i18n
