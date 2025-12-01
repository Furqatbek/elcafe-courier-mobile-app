import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';

import en from './locales/en.json';
import ru from './locales/ru.json';
import uz from './locales/uz.json';

const RESOURCES = {
  en: { translation: en },
  ru: { translation: ru },
  uz: { translation: uz },
};

const LANGUAGE_DETECTOR = {
  type: 'languageDetector' as const,
  async: true,
  detect: async (callback: (lang: string) => void) => {
    try {
      const storedLanguage = await AsyncStorage.getItem('user-language');
      if (storedLanguage) {
        return callback(storedLanguage);
      }
      
      const locale = Localization.getLocales()[0];
      const languageCode = locale?.languageCode;
      
      if (languageCode && ['en', 'ru', 'uz'].includes(languageCode)) {
        return callback(languageCode);
      }
      
      return callback('en');
    } catch (error) {
      console.log('Error reading language', error);
      callback('en');
    }
  },
  init: () => {},
  cacheUserLanguage: async (language: string) => {
    try {
      await AsyncStorage.setItem('user-language', language);
    } catch (error) {
      console.log('Error saving language', error);
    }
  },
};

i18n
  .use(initReactI18next)
  .use(LANGUAGE_DETECTOR)
  .init({
    resources: RESOURCES,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

export default i18n;
