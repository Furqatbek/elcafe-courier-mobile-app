import { createInstance } from 'i18next';

import en from '@/i18n/locales/en.json';
import ru from '@/i18n/locales/ru.json';
import uz from '@/i18n/locales/uz.json';

// AvailableOrderCard renders relative timestamps via these keys with a
// { count } option, so every locale must resolve the pluralized variants
// i18next looks up (key_one / key_other).
const LOCALES = { en, ru, uz } as const;

const makeI18n = async (lng: keyof typeof LOCALES) => {
  const instance = createInstance();
  await instance.init({
    lng,
    fallbackLng: 'en',
    resources: {
      [lng]: { translation: LOCALES[lng] },
    },
    interpolation: { escapeValue: false },
  });
  return instance;
};

describe.each(Object.keys(LOCALES) as (keyof typeof LOCALES)[])(
  'time-ago keys (%s)',
  (lng) => {
    it('defines just_now and pluralized minutes/hours keys', () => {
      const orders = (LOCALES[lng] as unknown as { orders: Record<string, string> }).orders;
      expect(orders.just_now).toBeTruthy();
      expect(orders.minutes_ago_one).toContain('{{count}}');
      expect(orders.minutes_ago_other).toContain('{{count}}');
      expect(orders.hours_ago_one).toContain('{{count}}');
      expect(orders.hours_ago_other).toContain('{{count}}');
    });

    it('resolves orders.minutes_ago with a count instead of echoing the key', async () => {
      const i18n = await makeI18n(lng);
      const one = i18n.t('orders.minutes_ago', { count: 1 });
      const many = i18n.t('orders.minutes_ago', { count: 5 });
      expect(one).not.toBe('orders.minutes_ago');
      expect(many).toContain('5');
    });

    it('resolves orders.hours_ago with a count instead of echoing the key', async () => {
      const i18n = await makeI18n(lng);
      const many = i18n.t('orders.hours_ago', { count: 3 });
      expect(many).not.toBe('orders.hours_ago');
      expect(many).toContain('3');
    });
  }
);
