import { useEffect, useMemo } from 'react';
import { en, type TKey } from './en';
import { km } from './km';
import { useStore } from '../store/store';
import { fmtDate, fmtDateTime, fmtMoney, fmtNumber, fmtPct, ln } from '../lib/format';
import type { Localized } from '../types';

const dicts = { en, km };

export function translate(lang: 'en' | 'km', key: TKey, vars?: Record<string, string | number>): string {
  let s: string = dicts[lang][key] ?? en[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

/** Translation + locale-aware formatting bound to the current settings. */
export function useI18n() {
  const { data } = useStore();
  const settings = data.settings;

  useEffect(() => {
    document.documentElement.lang = settings.lang === 'km' ? 'km' : 'en';
  }, [settings.lang]);

  return useMemo(
    () => ({
      lang: settings.lang,
      settings,
      t: (key: TKey, vars?: Record<string, string | number>) => translate(settings.lang, key, vars),
      n: (name: Localized | undefined) => ln(name, settings.lang),
      money: (usd: number) => fmtMoney(usd, settings),
      pct: (f: number, frac = 1) => fmtPct(f, settings, frac),
      num: (v: number, frac = 2) => fmtNumber(v, settings, frac),
      date: (ts: number) => fmtDate(ts, settings),
      dateTime: (ts: number) => fmtDateTime(ts, settings),
    }),
    [settings],
  );
}

export type I18n = ReturnType<typeof useI18n>;
