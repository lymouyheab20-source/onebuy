import { describe, expect, it } from 'vitest';
import { comboBreakdown, convert, effectiveUnitCost, indexById, margin, portionsAvailable, productCost, productUsage, suggestedPrice } from './costing';
import { byBrand, filteredLines, totals, DEFAULT_FILTERS } from './analytics';
import { buildSeed } from '../store/seed';
import { fmtMoney, toKhmerDigits } from './format';
import type { Ingredient, Product } from '../types';

const beef: Ingredient = { id: 'beef', name: { en: 'Beef' }, unit: 'kg', costPerUnit: 10, yieldPct: 0.8, parLevel: 1 };
const bun: Ingredient = { id: 'bun', name: { en: 'Bun' }, unit: 'pcs', costPerUnit: 0.25, yieldPct: 1, parLevel: 10 };
const ings = indexById([beef, bun]);
const burger: Product = {
  id: 'burger', brandId: 'b', categoryId: 'c', name: { en: 'Burger' }, price: 5, active: true,
  recipe: [{ ingredientId: 'beef', qty: 160, unit: 'g' }, { ingredientId: 'bun', qty: 1, unit: 'pcs' }],
};
const fries: Product = {
  id: 'fries', brandId: 'b', categoryId: 'c', name: { en: 'Fries' }, price: 2, active: true,
  recipe: [{ ingredientId: 'bun', qty: 2, unit: 'pcs' }],
};

describe('costing', () => {
  it('converts within a unit family and rejects cross-family', () => {
    expect(convert(250, 'g', 'kg')).toBe(0.25);
    expect(convert(1.5, 'L', 'ml')).toBe(1500);
    expect(() => convert(1, 'kg', 'pcs')).toThrow();
  });

  it('applies yield to ingredient cost', () => {
    expect(effectiveUnitCost(beef)).toBeCloseTo(12.5);
  });

  it('costs a recipe with unit conversion and yield', () => {
    // 0.16 kg * $12.50 + 1 * $0.25 = $2.25
    expect(productCost(burger, ings)).toBeCloseTo(2.25);
    const m = margin(burger.price, productCost(burger, ings));
    expect(m.foodCostPct).toBeCloseTo(0.45);
    expect(m.profit).toBeCloseTo(2.75);
    expect(suggestedPrice(2.25, 0.3)).toBeCloseTo(7.5);
  });

  it('breaks down a combo into cost, margin, savings and ingredient usage', () => {
    const prods = indexById([burger, fries]);
    const b = comboBreakdown({ price: 6, items: [{ productId: 'burger', qty: 1 }, { productId: 'fries', qty: 2 }] }, prods, ings);
    expect(b.cost).toBeCloseTo(2.25 + 2 * 0.5);
    expect(b.alaCartePrice).toBeCloseTo(9);
    expect(b.savings).toBeCloseTo(3);
    expect(b.marginPct).toBeCloseTo((6 - 3.25) / 6);
    expect(b.ingredientUsage.get('bun')?.qtyInStockUnit).toBe(5);
    expect(b.ingredientUsage.get('beef')?.qtyInStockUnit).toBeCloseTo(0.16);
  });

  it('computes portions from the scarcest ingredient', () => {
    const usage = productUsage(burger, ings);
    expect(portionsAvailable(usage, { beef: 1, bun: 100 })).toBe(6);
    expect(portionsAvailable(usage, { beef: 10, bun: 3 })).toBe(3);
    expect(portionsAvailable(usage, {})).toBe(0);
  });
});

describe('analytics on seed data', () => {
  const data = buildSeed(new Date('2026-06-15T18:00:00').getTime());
  const now = new Date('2026-06-15T18:00:00').getTime();

  it('brand totals add up to the overall total', () => {
    const lines = filteredLines(data, { ...DEFAULT_FILTERS, days: 30 }, now);
    const all = totals(lines);
    const brands = byBrand(lines);
    expect(brands).toHaveLength(3);
    expect(brands.reduce((s, r) => s + r.revenue, 0)).toBeCloseTo(all.revenue);
    expect(all.foodCostPct).toBeGreaterThan(0.1);
    expect(all.foodCostPct).toBeLessThan(0.6);
  });

  it('filters by location and category', () => {
    const loc = filteredLines(data, { ...DEFAULT_FILTERS, locationId: 'l-bkk1' }, now);
    expect(loc.every((l) => l.sale.locationId === 'l-bkk1')).toBe(true);
    const cat = filteredLines(data, { ...DEFAULT_FILTERS, categoryId: 'c-drink' }, now);
    expect(cat.length).toBeGreaterThan(0);
    expect(cat.every((l) => l.categoryId === 'c-drink')).toBe(true);
  });
});

describe('format', () => {
  const base = { lang: 'km' as const, currency: 'KHR' as const, khrRate: 4100, khmerDigits: true };
  it('formats riel rounded to 100 with Khmer digits', () => {
    expect(fmtMoney(2.5, base)).toBe('១០,៣០០ ៛');
    expect(fmtMoney(2.5, { ...base, currency: 'USD', khmerDigits: false })).toBe('$2.50');
    expect(toKhmerDigits('2026')).toBe('២០២៦');
  });
});
