import type { AppData, Combo, Ingredient, Product, Sale, StockMovement, Unit } from '../types';
import { comboBreakdown, effectiveUnitCost, indexById, productCost } from '../lib/costing';
import { startOfDay } from '../lib/analytics';

export const DATA_VERSION = 1;

/** Small deterministic PRNG so the demo data is stable between reloads. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ing = (
  id: string,
  en: string,
  km: string,
  unit: Unit,
  costPerUnit: number,
  yieldPct: number,
  parLevel: number,
  supplier?: string,
): Ingredient => ({ id, name: { en, km }, unit, costPerUnit, yieldPct, parLevel, supplier });

const line = (ingredientId: string, qty: number, unit: Unit) => ({ ingredientId, qty, unit });

export function buildSeed(now = Date.now()): AppData {
  const rand = mulberry32(42);

  const brands = [
    { id: 'b-noodle', name: { en: 'Angkor Noodle', km: 'គុយទាវអង្គរ' }, color: '#0f766e', targetFoodCost: 0.35 },
    { id: 'b-coffee', name: { en: 'Mekong Coffee', km: 'កាហ្វេមេគង្គ' }, color: '#b45309', targetFoodCost: 0.28 },
    { id: 'b-burger', name: { en: 'Phnom Penh Burger', km: 'ប៊ឺហ្គឺភ្នំពេញ' }, color: '#be123c', targetFoodCost: 0.32 },
  ];

  const locations = [
    { id: 'l-bkk1', brandId: 'b-noodle', name: { en: 'BKK1', km: 'បឹងកេងកង១' } },
    { id: 'l-tk', brandId: 'b-noodle', name: { en: 'Toul Kork', km: 'ទួលគោក' } },
    { id: 'l-river', brandId: 'b-coffee', name: { en: 'Riverside', km: 'មាត់ទន្លេ' } },
    { id: 'l-aeon', brandId: 'b-coffee', name: { en: 'Aeon Mall 1', km: 'ផ្សារទំនើបអ៊ីអន ១' } },
    { id: 'l-sensok', brandId: 'b-burger', name: { en: 'Sen Sok', km: 'សែនសុខ' } },
  ];

  const categories = [
    { id: 'c-noodle', name: { en: 'Noodles & Rice', km: 'គុយទាវ និងបាយ' } },
    { id: 'c-drink', name: { en: 'Drinks', km: 'ភេសជ្ជៈ' } },
    { id: 'c-burger', name: { en: 'Burgers', km: 'ប៊ឺហ្គឺ' } },
    { id: 'c-side', name: { en: 'Sides & Snacks', km: 'ម្ហូបបន្ទាប់បន្សំ' } },
    { id: 'c-combo', name: { en: 'Combo Sets', km: 'ឈុតកុំបូ' } },
  ];

  const ingredients: Ingredient[] = [
    ing('i-noodle', 'Rice noodles', 'គុយទាវ', 'kg', 1.6, 1, 8, 'Phsar Thmey'),
    ing('i-beef', 'Beef slices', 'សាច់គោ', 'kg', 11, 0.85, 4, 'Kampong Speu Meats'),
    ing('i-pork', 'Pork shoulder', 'សាច់ជ្រូក', 'kg', 6.5, 0.9, 5, 'Kampong Speu Meats'),
    ing('i-chicken', 'Chicken thigh', 'សាច់មាន់', 'kg', 4.2, 0.8, 4, 'Kampong Speu Meats'),
    ing('i-shrimp', 'Shrimp', 'បង្គា', 'kg', 12, 0.7, 2, 'Kep Seafood'),
    ing('i-bones', 'Soup bones', 'ឆ្អឹងស៊ុប', 'kg', 2, 1, 6),
    ing('i-sprout', 'Bean sprouts', 'សណ្ដែកបណ្ដុះ', 'kg', 0.9, 0.9, 2),
    ing('i-herbs', 'Fresh herbs', 'ជីរ', 'kg', 3, 0.75, 1),
    ing('i-fishsauce', 'Fish sauce', 'ទឹកត្រី', 'L', 2.5, 1, 2),
    ing('i-rice', 'Jasmine rice', 'អង្ករផ្កាម្លិះ', 'kg', 1.1, 1, 10),
    ing('i-egg', 'Eggs', 'ពងមាន់', 'pcs', 0.15, 1, 30),
    ing('i-palm', 'Palm sugar', 'ស្ករត្នោត', 'kg', 2.4, 1, 1),
    ing('i-oil', 'Cooking oil', 'ប្រេងឆា', 'L', 2.1, 1, 3),
    ing('i-coffee', 'Coffee beans', 'គ្រាប់កាហ្វេ', 'kg', 14, 1, 2, 'Mondulkiri Roasters'),
    ing('i-condensed', 'Condensed milk', 'ទឹកដោះគោខាប់', 'L', 3.2, 1, 3),
    ing('i-milk', 'Fresh milk', 'ទឹកដោះគោស្រស់', 'L', 2.2, 1, 6),
    ing('i-sugar', 'Sugar', 'ស្ករស', 'kg', 1, 1, 3),
    ing('i-ice', 'Ice', 'ទឹកកក', 'kg', 0.12, 1, 20),
    ing('i-tea', 'Tea leaves', 'ស្លឹកតែ', 'kg', 8, 1, 0.5),
    ing('i-cup', 'Takeaway cup', 'កែវយកទៅ', 'pcs', 0.06, 1, 100),
    ing('i-bun', 'Burger bun', 'នំប៉័ងប៊ឺហ្គឺ', 'pcs', 0.25, 1, 40),
    ing('i-baguette', 'Baguette', 'នំបុ័ង', 'pcs', 0.2, 1, 20),
    ing('i-mince', 'Ground beef', 'សាច់គោចិញ្ច្រាំ', 'kg', 9.5, 1, 5),
    ing('i-cheese', 'Cheese slice', 'ឈីស', 'pcs', 0.18, 1, 40),
    ing('i-lettuce', 'Lettuce', 'សាឡាដ', 'kg', 2.5, 0.8, 1),
    ing('i-tomato', 'Tomato', 'ប៉េងប៉ោះ', 'kg', 1.5, 0.9, 2),
    ing('i-potato', 'Potatoes', 'ដំឡូងបារាំង', 'kg', 1.3, 0.8, 10),
    ing('i-soda', 'Soft drink can', 'ភេសជ្ជៈកំប៉ុង', 'pcs', 0.35, 1, 48),
  ];

  const p = (
    id: string,
    brandId: string,
    categoryId: string,
    en: string,
    km: string,
    price: number,
    recipe: Product['recipe'],
  ): Product => ({ id, brandId, categoryId, name: { en, km }, price, recipe, active: true });

  const soup = [line('i-noodle', 150, 'g'), line('i-bones', 100, 'g'), line('i-sprout', 40, 'g'), line('i-herbs', 15, 'g'), line('i-fishsauce', 15, 'ml')];

  const products: Product[] = [
    p('p-beefnoodle', 'b-noodle', 'c-noodle', 'Beef Noodle Soup', 'គុយទាវសាច់គោ', 4.5, [...soup, line('i-beef', 70, 'g')]),
    p('p-porknoodle', 'b-noodle', 'c-noodle', 'Pork Noodle Soup', 'គុយទាវសាច់ជ្រូក', 3.5, [...soup, line('i-pork', 70, 'g')]),
    p('p-seanoodle', 'b-noodle', 'c-noodle', 'Seafood Noodle Soup', 'គុយទាវគ្រឿងសមុទ្រ', 5.5, [...soup, line('i-shrimp', 80, 'g')]),
    p('p-baysach', 'b-noodle', 'c-noodle', 'Pork & Broken Rice', 'បាយសាច់ជ្រូក', 3.5, [
      line('i-rice', 180, 'g'), line('i-pork', 100, 'g'), line('i-egg', 1, 'pcs'), line('i-fishsauce', 10, 'ml'), line('i-oil', 10, 'ml'), line('i-palm', 10, 'g'),
    ]),
    p('p-icedtea', 'b-noodle', 'c-drink', 'Iced Tea', 'តែទឹកកក', 1, [line('i-tea', 5, 'g'), line('i-sugar', 20, 'g'), line('i-ice', 200, 'g'), line('i-cup', 1, 'pcs')]),
    p('p-icedmilkcoffee', 'b-coffee', 'c-drink', 'Iced Milk Coffee', 'កាហ្វេទឹកដោះគោទឹកកក', 2, [line('i-coffee', 20, 'g'), line('i-condensed', 40, 'ml'), line('i-ice', 200, 'g'), line('i-cup', 1, 'pcs')]),
    p('p-latte', 'b-coffee', 'c-drink', 'Iced Latte', 'ឡាតេទឹកកក', 2.75, [line('i-coffee', 18, 'g'), line('i-milk', 180, 'ml'), line('i-sugar', 10, 'g'), line('i-ice', 150, 'g'), line('i-cup', 1, 'pcs')]),
    p('p-black', 'b-coffee', 'c-drink', 'Iced Black Coffee', 'កាហ្វេខ្មៅទឹកកក', 1.5, [line('i-coffee', 20, 'g'), line('i-sugar', 15, 'g'), line('i-ice', 200, 'g'), line('i-cup', 1, 'pcs')]),
    p('p-palmlatte', 'b-coffee', 'c-drink', 'Palm Sugar Latte', 'ឡាតេស្ករត្នោត', 3, [line('i-coffee', 18, 'g'), line('i-milk', 180, 'ml'), line('i-palm', 25, 'g'), line('i-ice', 150, 'g'), line('i-cup', 1, 'pcs')]),
    p('p-numpang', 'b-coffee', 'c-side', 'Num Pang Pâté', 'នំបុ័ងប៉ាតេ', 2.75, [line('i-baguette', 1, 'pcs'), line('i-pork', 60, 'g'), line('i-lettuce', 15, 'g'), line('i-tomato', 20, 'g')]),
    p('p-beefburger', 'b-burger', 'c-burger', 'Classic Beef Burger', 'ប៊ឺហ្គឺសាច់គោ', 5.5, [
      line('i-bun', 1, 'pcs'), line('i-mince', 150, 'g'), line('i-cheese', 1, 'pcs'), line('i-lettuce', 20, 'g'), line('i-tomato', 30, 'g'), line('i-oil', 5, 'ml'),
    ]),
    p('p-chickenburger', 'b-burger', 'c-burger', 'Crispy Chicken Burger', 'ប៊ឺហ្គឺសាច់មាន់', 4.5, [
      line('i-bun', 1, 'pcs'), line('i-chicken', 140, 'g'), line('i-lettuce', 20, 'g'), line('i-tomato', 30, 'g'), line('i-oil', 20, 'ml'), line('i-egg', 1, 'pcs'),
    ]),
    p('p-fries', 'b-burger', 'c-side', 'French Fries', 'ដំឡូងបារាំងបំពង', 2, [line('i-potato', 200, 'g'), line('i-oil', 30, 'ml')]),
    p('p-soda', 'b-burger', 'c-drink', 'Soft Drink', 'ភេសជ្ជៈកំប៉ុង', 1.25, [line('i-soda', 1, 'pcs'), line('i-ice', 100, 'g'), line('i-cup', 1, 'pcs')]),
  ];

  const combos: Combo[] = [
    {
      id: 'k-burgerset', brandId: 'b-burger', categoryId: 'c-combo', active: true, price: 7.5,
      name: { en: 'Burger Meal', km: 'ឈុតប៊ឺហ្គឺ' },
      items: [{ productId: 'p-beefburger', qty: 1 }, { productId: 'p-fries', qty: 1 }, { productId: 'p-soda', qty: 1 }],
    },
    {
      id: 'k-noodleset', brandId: 'b-noodle', categoryId: 'c-combo', active: true, price: 4,
      name: { en: 'Noodle & Tea Set', km: 'ឈុតគុយទាវ និងតែ' },
      items: [{ productId: 'p-porknoodle', qty: 1 }, { productId: 'p-icedtea', qty: 1 }],
    },
    {
      id: 'k-breakfast', brandId: 'b-coffee', categoryId: 'c-combo', active: true, price: 4.25,
      name: { en: 'Breakfast Set', km: 'ឈុតអាហារពេលព្រឹក' },
      items: [{ productId: 'p-icedmilkcoffee', qty: 1 }, { productId: 'p-numpang', qty: 1 }],
    },
  ];

  const ingMap = indexById(ingredients);
  const prodMap = indexById(products);

  // Opening stock: only ingredients the location's brand actually uses.
  const stock: AppData['stock'] = {};
  const movements: StockMovement[] = [];
  const openingTs = startOfDay(now) - 14 * 86_400_000;
  for (const loc of locations) {
    const used = new Set<string>();
    for (const prod of products) {
      if (prod.brandId === loc.brandId) prod.recipe.forEach((l) => used.add(l.ingredientId));
    }
    stock[loc.id] = {};
    for (const id of used) {
      const ingr = ingMap.get(id)!;
      // ~15% of items start below their reorder level so alerts are visible.
      const factor = rand() < 0.15 ? 0.4 + rand() * 0.5 : 1.5 + rand() * 4;
      const raw = ingr.parLevel * factor;
      const qty = ingr.unit === 'pcs' ? Math.round(raw) : Math.round(raw * 100) / 100;
      stock[loc.id][id] = qty;
      movements.push({
        id: `m-open-${loc.id}-${id}`, ts: openingTs, locationId: loc.id, ingredientId: id,
        delta: qty, type: 'receive', unitCost: ingr.costPerUnit, note: 'Opening stock',
      });
      if (rand() < 0.35) {
        const wRaw = ingr.parLevel * (0.05 + rand() * 0.15);
        const w = ingr.unit === 'pcs' ? Math.max(1, Math.round(wRaw)) : Math.round(wRaw * 100) / 100;
        movements.push({
          id: `m-waste-${loc.id}-${id}`, ts: now - Math.floor(rand() * 10) * 86_400_000 - 3_600_000,
          locationId: loc.id, ingredientId: id, delta: -w, type: 'waste',
          unitCost: effectiveUnitCost(ingr), note: 'Spoilage',
        });
      }
    }
  }

  // Sales history for the last 45 days.
  const sales: Sale[] = [];
  type Sellable = { kind: 'product' | 'combo'; id: string; price: number; cost: number; cat: string; w: number };
  const brandItems = new Map<string, Sellable[]>();
  for (const b of brands) {
    const items: Sellable[] = products
      .filter((x) => x.brandId === b.id)
      .map((x) => ({ kind: 'product', id: x.id, price: x.price, cost: productCost(x, ingMap), cat: x.categoryId, w: 1 + rand() * 3 }));
    for (const c of combos.filter((x) => x.brandId === b.id)) {
      items.push({ kind: 'combo', id: c.id, price: c.price, cost: comboBreakdown(c, prodMap, ingMap).cost, cat: c.categoryId, w: 2 });
    }
    brandItems.set(b.id, items);
  }
  const pick = <T extends { w: number }>(arr: T[]): T => {
    const total = arr.reduce((s, a) => s + a.w, 0);
    let r = rand() * total;
    for (const a of arr) {
      if ((r -= a.w) <= 0) return a;
    }
    return arr[arr.length - 1];
  };

  let n = 0;
  for (let d = 44; d >= 0; d--) {
    const dayStart = startOfDay(now) - d * 86_400_000;
    const weekend = [0, 6].includes(new Date(dayStart).getDay());
    for (const loc of locations) {
      const items = brandItems.get(loc.brandId)!;
      const tickets = Math.round((8 + rand() * 6) * (weekend ? 1.3 : 1));
      for (let t = 0; t < tickets; t++) {
        const ts = dayStart + (7 + rand() * 14) * 3_600_000;
        if (ts > now) continue;
        const lines = [];
        const count = 1 + Math.floor(rand() * 3);
        for (let k = 0; k < count; k++) {
          const it = pick(items);
          // Actual cost drifts a little from theoretical (price changes, portioning).
          const drift = 0.95 + rand() * 0.12;
          lines.push({ kind: it.kind, refId: it.id, qty: 1 + Math.floor(rand() * 4), price: it.price, cost: it.cost * drift, categoryId: it.cat });
        }
        sales.push({ id: `s-${n++}`, ts, brandId: loc.brandId, locationId: loc.id, lines });
      }
    }
  }
  sales.sort((a, b) => a.ts - b.ts);

  return {
    version: DATA_VERSION,
    brands,
    locations,
    categories,
    ingredients,
    products,
    combos,
    stock,
    movements,
    sales,
    settings: { lang: 'en', currency: 'USD', khrRate: 4100, khmerDigits: false },
  };
}
