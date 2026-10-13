import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AppData, MovementType, Sale, SaleLine, Settings } from '../types';
import { buildSeed, DATA_VERSION } from './seed';
import { comboBreakdown, effectiveUnitCost, indexById, productCost, productUsage } from '../lib/costing';
import { uid } from '../lib/format';

const STORAGE_KEY = 'onebuy:data';

type EntityKey = 'brands' | 'locations' | 'categories' | 'ingredients' | 'products' | 'combos';
type Entity<K extends EntityKey> = AppData[K][number];

function load(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppData;
      if (parsed.version === DATA_VERSION) return parsed;
    }
  } catch {
    // Corrupt or inaccessible storage: fall back to demo data.
  }
  return buildSeed();
}

function save(data: AppData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Quota exceeded or storage blocked; the in-memory state still works.
  }
}

export interface CartLine {
  kind: 'product' | 'combo';
  refId: string;
  qty: number;
}

interface Store {
  data: AppData;
  lastChange: number;
  upsert<K extends EntityKey>(key: K, item: Entity<K>): void;
  remove<K extends EntityKey>(key: K, id: string): string | null;
  moveStock(locationId: string, ingredientId: string, delta: number, type: MovementType, note?: string): void;
  /** Set an absolute counted quantity, recording the difference as an adjustment. */
  countStock(locationId: string, ingredientId: string, counted: number, note?: string): void;
  recordSale(locationId: string, lines: CartLine[]): Sale | null;
  updateSettings(patch: Partial<Settings>): void;
  resetDemo(): void;
  exportJson(): string;
  importJson(json: string): boolean;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(load);
  const [lastChange, setLastChange] = useState(Date.now());
  const fromOtherTab = useRef(false);

  // Persist on every change (unless the change itself came from another tab).
  useEffect(() => {
    if (fromOtherTab.current) {
      fromOtherTab.current = false;
      return;
    }
    save(data);
  }, [data]);

  // Live sync: other tabs/windows on this device see changes immediately.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      try {
        fromOtherTab.current = true;
        setData(JSON.parse(e.newValue));
        setLastChange(Date.now());
      } catch {
        fromOtherTab.current = false;
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const mutate = useCallback((fn: (d: AppData) => AppData) => {
    setData((d) => fn(d));
    setLastChange(Date.now());
  }, []);

  const upsert = useCallback(<K extends EntityKey>(key: K, item: Entity<K>) => {
    mutate((d) => {
      const list = d[key] as Entity<K>[];
      const idx = list.findIndex((x) => x.id === item.id);
      const next = idx >= 0 ? list.map((x, i) => (i === idx ? item : x)) : [...list, item];
      return { ...d, [key]: next };
    });
  }, [mutate]);

  const remove = useCallback(<K extends EntityKey>(key: K, id: string): string | null => {
    // Referential checks so costing never points at missing data.
    const d = data;
    if (key === 'ingredients' && d.products.some((p) => p.recipe.some((l) => l.ingredientId === id))) return 'errInUseRecipe';
    if (key === 'products' && d.combos.some((c) => c.items.some((i) => i.productId === id))) return 'errInUseCombo';
    if (key === 'brands' && (d.locations.some((l) => l.brandId === id) || d.products.some((p) => p.brandId === id))) return 'errInUseBrand';
    if (key === 'categories' && (d.products.some((p) => p.categoryId === id) || d.combos.some((c) => c.categoryId === id))) return 'errInUseCategory';
    if (key === 'locations' && d.sales.some((s) => s.locationId === id)) return 'errInUseLocation';
    mutate((cur) => ({ ...cur, [key]: (cur[key] as Entity<K>[]).filter((x) => x.id !== id) }));
    return null;
  }, [data, mutate]);

  const moveStock = useCallback((locationId: string, ingredientId: string, delta: number, type: MovementType, note?: string) => {
    if (!delta) return;
    mutate((d) => {
      const ing = d.ingredients.find((i) => i.id === ingredientId);
      const locStock = { ...(d.stock[locationId] ?? {}) };
      locStock[ingredientId] = round((locStock[ingredientId] ?? 0) + delta);
      return {
        ...d,
        stock: { ...d.stock, [locationId]: locStock },
        movements: [
          ...d.movements,
          { id: uid('m-'), ts: Date.now(), locationId, ingredientId, delta, type, note,
            unitCost: ing ? (type === 'waste' ? effectiveUnitCost(ing) : ing.costPerUnit) : 0 },
        ],
      };
    });
  }, [mutate]);

  const countStock = useCallback((locationId: string, ingredientId: string, counted: number, note?: string) => {
    const current = data.stock[locationId]?.[ingredientId] ?? 0;
    moveStock(locationId, ingredientId, round(counted - current), 'adjust', note);
  }, [data, moveStock]);

  const recordSale = useCallback((locationId: string, cart: CartLine[]): Sale | null => {
    const loc = data.locations.find((l) => l.id === locationId);
    if (!loc || cart.length === 0) return null;
    const ings = indexById(data.ingredients);
    const prods = indexById(data.products);
    const combos = indexById(data.combos);
    const usage = new Map<string, number>();
    const addUsage = (productId: string, qty: number) => {
      const p = prods.get(productId);
      if (!p) return;
      for (const [ingId, q] of productUsage(p, ings)) usage.set(ingId, (usage.get(ingId) ?? 0) + q * qty);
    };
    const lines: SaleLine[] = [];
    for (const c of cart) {
      if (c.kind === 'product') {
        const p = prods.get(c.refId);
        if (!p) continue;
        lines.push({ kind: 'product', refId: p.id, qty: c.qty, price: p.price, cost: productCost(p, ings), categoryId: p.categoryId });
        addUsage(p.id, c.qty);
      } else {
        const k = combos.get(c.refId);
        if (!k) continue;
        lines.push({ kind: 'combo', refId: k.id, qty: c.qty, price: k.price, cost: comboBreakdown(k, prods, ings).cost, categoryId: k.categoryId });
        k.items.forEach((i) => addUsage(i.productId, i.qty * c.qty));
      }
    }
    if (lines.length === 0) return null;
    const ts = Date.now();
    const sale: Sale = { id: uid('s-'), ts, brandId: loc.brandId, locationId, lines };
    mutate((d) => {
      const locStock = { ...(d.stock[locationId] ?? {}) };
      const moves = [...d.movements];
      for (const [ingId, q] of usage) {
        locStock[ingId] = round((locStock[ingId] ?? 0) - q);
        moves.push({ id: uid('m-'), ts, locationId, ingredientId: ingId, delta: -round(q), type: 'sale', unitCost: ings.get(ingId)?.costPerUnit ?? 0, note: sale.id });
      }
      return { ...d, sales: [...d.sales, sale], movements: moves, stock: { ...d.stock, [locationId]: locStock } };
    });
    return sale;
  }, [data, mutate]);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    mutate((d) => ({ ...d, settings: { ...d.settings, ...patch } }));
  }, [mutate]);

  const resetDemo = useCallback(() => {
    mutate((d) => ({ ...buildSeed(), settings: d.settings }));
  }, [mutate]);

  const exportJson = useCallback(() => JSON.stringify(data, null, 2), [data]);

  const importJson = useCallback((json: string) => {
    try {
      const parsed = JSON.parse(json) as AppData;
      if (parsed.version !== DATA_VERSION || !Array.isArray(parsed.brands)) return false;
      mutate(() => parsed);
      return true;
    } catch {
      return false;
    }
  }, [mutate]);

  const value = useMemo<Store>(
    () => ({ data, lastChange, upsert, remove, moveStock, countStock, recordSale, updateSettings, resetDemo, exportJson, importJson }),
    [data, lastChange, upsert, remove, moveStock, countStock, recordSale, updateSettings, resetDemo, exportJson, importJson],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function round(n: number) {
  return Math.round(n * 10000) / 10000;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore must be used inside StoreProvider');
  return s;
}
