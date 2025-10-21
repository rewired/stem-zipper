import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import de from './locales/de.json';
import fr from './locales/fr.json';
import it from './locales/it.json';
import es from './locales/es.json';
import pt from './locales/pt.json';

let initialized = false;

export const initI18n = async (language: string) => {
  if (initialized) {
    await i18n.changeLanguage(language);
    return i18n;
  }

  await i18n
    .use(initReactI18next)
    .init({
      resources: {
        en: { translation: en },
        de: { translation: de },
        fr: { translation: fr },
        it: { translation: it },
        es: { translation: es },
        pt: { translation: pt }
      },
      lng: language,
      fallbackLng: 'en',
      interpolation: {
        escapeValue: false
      },
      returnNull: false
    });

  initialized = true;
  return i18n;
};
