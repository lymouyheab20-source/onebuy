import type { AppData, Sale } from '../types';
import { effectiveUnitCost, indexById } from './costing';

export interface Filters {
  brandId: string | 'all';
  locationId: string | 'all';
  categoryId: string | 'all';
  /** Number of days back from now, inclusive of today. */
  days: number;
}

export const DEFAULT_FILTERS: Filters = { brandId: 'all', locationId: 'all', categoryId: 'all', days: 30 };

export interface Totals {
  revenue: number;
  cost: number;
  profit: number;
  qty: number;
  orders: number;
  foodCostPct: number;
  marginPct: number;
}

export interface Row extends Totals {
  key: string;
}

function emptyTotals(): Totals {
  return { revenue: 0, cost: 0, profit: 0, qty: 0, orders: 0, foodCostPct: 0, marginPct: 0 };
}

function finish<T extends Totals>(t: T): T {
  t.profit = t.revenue - t.cost;
  t.foodCostPct = t.revenue > 0 ? t.cost / t.revenue : 0;
  t.marginPct = t.revenue > 0 ? t.profit / t.revenue : 0;
  return t;
}

export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface FlatLine {
  sale: Sale;
  refId: string;
  kind: 'product' | 'combo';
  categoryId: string;
  qty: number;
  revenue: number;
  cost: number;
}

/** Sale lines matching the filters, flattened. Category filter applies per line. */
export function filteredLines(data: AppData, f: Filters, now = Date.now()): FlatLine[] {
  const since = startOfDay(now) - (f.days - 1) * 86_400_000;
  const out: FlatLine[] = [];
  for (const sale of data.sales) {
    if (sale.ts < since || sale.ts > now) continue;
    if (f.brandId !== 'all' && sale.brandId !== f.brandId) continue;
    if (f.locationId !== 'all' && sale.locationId !== f.locationId) continue;
    for (const l of sale.lines) {
      if (f.categoryId !== 'all' && l.categoryId !== f.categoryId) continue;
      out.push({
        sale,
        refId: l.refId,
        kind: l.kind,
        categoryId: l.categoryId,
        qty: l.qty,
        revenue: l.price * l.qty,
        cost: l.cost * l.qty,
      });
    }
  }
  return out;
}

export function totals(lines: FlatLine[]): Totals {
  const t = emptyTotals();
  const orders = new Set<string>();
  for (const l of lines) {
    t.revenue += l.revenue;
    t.cost += l.cost;
    t.qty += l.qty;
    orders.add(l.sale.id);
  }
  t.orders = orders.size;
  return finish(t);
}

export function groupBy(lines: FlatLine[], keyOf: (l: FlatLine) => string): Row[] {
  const map = new Map<string, Row & { _orders: Set<string> }>();
  for (const l of lines) {
    const key = keyOf(l);
    let r = map.get(key);
    if (!r) {
      r = { key, ...emptyTotals(), _orders: new Set() };
      map.set(key, r);
    }
    r.revenue += l.revenue;
    r.cost += l.cost;
    r.qty += l.qty;
    r._orders.add(l.sale.id);
  }
  return [...map.values()]
    .map(({ _orders, ...r }) => finish({ ...r, orders: _orders.size }))
    .sort((a, b) => b.revenue - a.revenue);
}

export const byBrand = (lines: FlatLine[]) => groupBy(lines, (l) => l.sale.brandId);
export const byLocation = (lines: FlatLine[]) => groupBy(lines, (l) => l.sale.locationId);
export const byCategory = (lines: FlatLine[]) => groupBy(lines, (l) => l.categoryId);
export const byItem = (lines: FlatLine[]) => groupBy(lines, (l) => `${l.kind}:${l.refId}`);

/** Daily revenue/cost series covering every day in the window (zero-filled). */
export function dailySeries(lines: FlatLine[], days: number, now = Date.now()) {
  const map = new Map<string, { day: string; revenue: number; cost: number; profit: number }>();
  const start = startOfDay(now) - (days - 1) * 86_400_000;
  for (let i = 0; i < days; i++) {
    const k = dayKey(start + i * 86_400_000 + 3_600_000);
    map.set(k, { day: k, revenue: 0, cost: 0, profit: 0 });
  }
  for (const l of lines) {
    const r = map.get(dayKey(l.sale.ts));
    if (!r) continue;
    r.revenue += l.revenue;
    r.cost += l.cost;
    r.profit = r.revenue - r.cost;
  }
  return [...map.values()];
}

export interface StockRow {
  locationId: string;
  ingredientId: string;
  qty: number;
  value: number;
  parLevel: number;
  low: boolean;
}

export function stockRows(data: AppData, brandId: string | 'all', locationId: string | 'all'): StockRow[] {
  const ings = indexById(data.ingredients);
  const rows: StockRow[] = [];
  for (const loc of data.locations) {
    if (brandId !== 'all' && loc.brandId !== brandId) continue;
    if (locationId !== 'all' && loc.id !== locationId) continue;
    const s = data.stock[loc.id] ?? {};
    // A location tracks an ingredient once it holds stock of it or its brand's recipes need it.
    const tracked = new Set(Object.keys(s));
    for (const p of data.products) {
      if (p.brandId === loc.brandId) p.recipe.forEach((l) => tracked.add(l.ingredientId));
    }
    for (const ing of data.ingredients) {
      if (!tracked.has(ing.id)) continue;
      const qty = s[ing.id] ?? 0;
      rows.push({
        locationId: loc.id,
        ingredientId: ing.id,
        qty,
        value: Math.max(qty, 0) * (ings.get(ing.id)?.costPerUnit ?? 0),
        parLevel: ing.parLevel,
        low: qty <= ing.parLevel,
      });
    }
  }
  return rows;
}

/** Shrinkage (waste) cost in the window, honoring brand/location filters. */
export function wasteCost(data: AppData, f: Filters, now = Date.now()): number {
  const since = startOfDay(now) - (f.days - 1) * 86_400_000;
  const locBrand = new Map(data.locations.map((l) => [l.id, l.brandId]));
  const ings = indexById(data.ingredients);
  let total = 0;
  for (const m of data.movements) {
    if (m.type !== 'waste' || m.ts < since) continue;
    if (f.locationId !== 'all' && m.locationId !== f.locationId) continue;
    if (f.brandId !== 'all' && locBrand.get(m.locationId) !== f.brandId) continue;
    const ing = ings.get(m.ingredientId);
    total += Math.abs(m.delta) * (m.unitCost || (ing ? effectiveUnitCost(ing) : 0));
  }
  return total;
}
