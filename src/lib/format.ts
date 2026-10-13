import type { Localized, Settings } from '../types';

const KHMER_DIGITS = ['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩'];

export function toKhmerDigits(s: string): string {
  return s.replace(/[0-9]/g, (d) => KHMER_DIGITS[Number(d)]);
}

function digits(s: string, settings: Settings): string {
  return settings.lang === 'km' && settings.khmerDigits ? toKhmerDigits(s) : s;
}

export function fmtNumber(n: number, settings: Settings, maxFrac = 2): string {
  const s = n.toLocaleString('en-US', { maximumFractionDigits: maxFrac });
  return digits(s, settings);
}

/** Format a USD amount in the user's display currency. */
export function fmtMoney(usd: number, settings: Settings): string {
  if (settings.currency === 'KHR') {
    // Riel is not used with decimals; round to the nearest 100 like cash practice.
    const riel = Math.round((usd * settings.khrRate) / 100) * 100;
    return digits(riel.toLocaleString('en-US'), settings) + ' ៛';
  }
  const neg = usd < 0;
  const s = Math.abs(usd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (neg ? '-$' : '$') + digits(s, settings);
}

export function fmtPct(fraction: number, settings: Settings, frac = 1): string {
  return digits((fraction * 100).toFixed(frac), settings) + '%';
}

export function fmtDate(ts: number, settings: Settings): string {
  const d = new Date(ts);
  const s = d.toLocaleDateString(settings.lang === 'km' ? 'km-KH' : 'en-GB', { day: '2-digit', month: 'short' });
  return digits(s, settings);
}

export function fmtDateTime(ts: number, settings: Settings): string {
  const d = new Date(ts);
  const s = d.toLocaleString(settings.lang === 'km' ? 'km-KH' : 'en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
  return digits(s, settings);
}

export function ln(name: Localized | undefined, lang: Settings['lang']): string {
  if (!name) return '';
  return (lang === 'km' && name.km?.trim()) || name.en;
}

/** Convert a value typed in display currency back to USD. */
export function toUsd(value: number, settings: Settings): number {
  return settings.currency === 'KHR' ? value / settings.khrRate : value;
}

export function fromUsd(usd: number, settings: Settings): number {
  return settings.currency === 'KHR' ? Math.round(usd * settings.khrRate) : Math.round(usd * 10000) / 10000;
}

export function uid(prefix = ''): string {
  return prefix + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
}
