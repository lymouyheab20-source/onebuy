import { useEffect, useState, type ReactNode } from 'react';
import { useI18n } from '../i18n';
import { useStore } from '../store/store';
import type { Filters } from '../lib/analytics';
import type { Localized } from '../types';
import { fromUsd, toUsd } from '../lib/format';

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

export function Card({ title, actions, children, className = '' }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <div className="card-head">
          {title && <h2>{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Kpi({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'good' | 'bad' | 'warn' }) {
  return (
    <div className={`kpi ${tone ?? ''}`}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {hint && <div className="kpi-hint">{hint}</div>}
    </div>
  );
}

/** Food-cost badge coloured against a target (green ≤ target, amber ≤ target+5pt, red above). */
export function FoodCostBadge({ value, target }: { value: number; target: number }) {
  const { pct } = useI18n();
  const tone = value <= target ? 'good' : value <= target + 0.05 ? 'warn' : 'bad';
  return <span className={`badge ${tone}`}>{pct(value)}</span>;
}

export function Badge({ tone, children }: { tone: 'good' | 'bad' | 'warn' | 'neutral'; children: ReactNode }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

export function FilterBar({
  filters,
  onChange,
  show = { brand: true, location: true, category: true, days: true },
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
  show?: Partial<Record<'brand' | 'location' | 'category' | 'days', boolean>>;
}) {
  const { data } = useStore();
  const { t, n } = useI18n();
  const locs = data.locations.filter((l) => filters.brandId === 'all' || l.brandId === filters.brandId);
  return (
    <div className="filter-bar">
      {show.brand && (
        <label>
          <span>{t('brand')}</span>
          <select value={filters.brandId} onChange={(e) => onChange({ ...filters, brandId: e.target.value, locationId: 'all' })}>
            <option value="all">{t('allBrands')}</option>
            {data.brands.map((b) => <option key={b.id} value={b.id}>{n(b.name)}</option>)}
          </select>
        </label>
      )}
      {show.location && (
        <label>
          <span>{t('location')}</span>
          <select value={filters.locationId} onChange={(e) => onChange({ ...filters, locationId: e.target.value })}>
            <option value="all">{t('allLocations')}</option>
            {locs.map((l) => <option key={l.id} value={l.id}>{n(l.name)}</option>)}
          </select>
        </label>
      )}
      {show.category && (
        <label>
          <span>{t('category')}</span>
          <select value={filters.categoryId} onChange={(e) => onChange({ ...filters, categoryId: e.target.value })}>
            <option value="all">{t('allCategories')}</option>
            {data.categories.map((c) => <option key={c.id} value={c.id}>{n(c.name)}</option>)}
          </select>
        </label>
      )}
      {show.days && (
        <label>
          <span>{t('period')}</span>
          <select value={filters.days} onChange={(e) => onChange({ ...filters, days: Number(e.target.value) })}>
            <option value={1}>{t('today')}</option>
            {[7, 14, 30, 45].map((d) => <option key={d} value={d}>{t('lastNDays', { n: d })}</option>)}
          </select>
        </label>
      )}
    </div>
  );
}

export function Modal({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="close">×</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, children, help }: { label: string; children: ReactNode; help?: string }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {help && <span className="field-help">{help}</span>}
    </label>
  );
}

export function NameFields({ value, onChange }: { value: Localized; onChange: (v: Localized) => void }) {
  const { t } = useI18n();
  return (
    <div className="grid-2">
      <Field label={t('nameEn') + ' *'}>
        <input value={value.en} onChange={(e) => onChange({ ...value, en: e.target.value })} required />
      </Field>
      <Field label={t('nameKm')}>
        <input className="km" value={value.km ?? ''} onChange={(e) => onChange({ ...value, km: e.target.value })} />
      </Field>
    </div>
  );
}

/** Number input that keeps a local string so users can type "1." or clear the field. */
export function NumberInput({ value, onChange, step = 'any', min, className }: { value: number; onChange: (n: number) => void; step?: string; min?: number; className?: string }) {
  const [text, setText] = useState(String(value));
  useEffect(() => {
    if (Number(text) !== value) setText(String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <input
      className={className}
      type="number"
      inputMode="decimal"
      step={step}
      min={min}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const v = Number(e.target.value);
        if (e.target.value !== '' && Number.isFinite(v)) onChange(v);
      }}
    />
  );
}

export function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const id = setTimeout(onDone, 2500);
    return () => clearTimeout(id);
  }, [message, onDone]);
  return <div className="toast" role="status">{message}</div>;
}

type ClaudeHost = { use(name: 'downloads'): Promise<{ save(r: { filename: string; data: string }): Promise<unknown> } | null> };

/**
 * Save a generated file. Inside the claude.ai viewer, plain download links are blocked,
 * so use its `downloads` capability there; everywhere else use a normal browser download.
 */
export async function downloadFile(name: string, content: string, type = 'text/plain') {
  const host = (window as unknown as { claude?: ClaudeHost }).claude;
  if (host?.use) {
    try {
      const downloads = await host.use('downloads');
      if (downloads) {
        await downloads.save({ filename: name, data: content });
        return;
      }
    } catch {
      // Declined or unavailable: nothing else to do inside the viewer.
      return;
    }
  }
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function toCsv(rows: (string | number)[][]): string {
  return '﻿' + rows.map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(',')).join('\n');
}

/** Money input that edits in the display currency but reports USD. */
export function MoneyInput({ usd, onChange }: { usd: number; onChange: (usd: number) => void }) {
  const { settings } = useI18n();
  return (
    <div className="money-input">
      <span>{settings.currency === 'KHR' ? '៛' : '$'}</span>
      <NumberInput value={fromUsd(usd, settings)} onChange={(v) => onChange(toUsd(v, settings))} min={0} step={settings.currency === 'KHR' ? '100' : '0.01'} />
    </div>
  );
}
