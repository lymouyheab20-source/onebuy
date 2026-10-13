/** A name that can be shown in English and Khmer. Khmer falls back to English when missing. */
export interface Localized {
  en: string;
  km?: string;
}

export type Unit = 'g' | 'kg' | 'ml' | 'L' | 'pcs';

export interface Brand {
  id: string;
  name: Localized;
  color: string;
  /** Target food cost as a fraction of selling price, e.g. 0.3 = 30%. */
  targetFoodCost: number;
}

export interface Location {
  id: string;
  brandId: string;
  name: Localized;
}

export interface Category {
  id: string;
  name: Localized;
}

export interface Ingredient {
  id: string;
  name: Localized;
  unit: Unit;
  /** Purchase cost (USD) per one `unit`. */
  costPerUnit: number;
  /** Usable fraction after trimming/waste, 0..1. Effective cost = cost / yield. */
  yieldPct: number;
  /** Reorder when stock at a location drops to or below this quantity. */
  parLevel: number;
  supplier?: string;
}

export interface RecipeLine {
  ingredientId: string;
  qty: number;
  unit: Unit;
}

export interface Product {
  id: string;
  brandId: string;
  categoryId: string;
  name: Localized;
  /** Selling price in USD. */
  price: number;
  recipe: RecipeLine[];
  active: boolean;
}

export interface ComboItem {
  productId: string;
  qty: number;
}

export interface Combo {
  id: string;
  brandId: string;
  categoryId: string;
  name: Localized;
  price: number;
  items: ComboItem[];
  active: boolean;
}

export type MovementType = 'receive' | 'waste' | 'adjust' | 'sale' | 'transfer';

export interface StockMovement {
  id: string;
  ts: number;
  locationId: string;
  ingredientId: string;
  /** Change in the ingredient's own unit (negative = out). */
  delta: number;
  type: MovementType;
  /** Unit cost at the time of movement (USD). */
  unitCost: number;
  note?: string;
}

export interface SaleLine {
  kind: 'product' | 'combo';
  refId: string;
  qty: number;
  /** Unit selling price snapshot (USD). */
  price: number;
  /** Unit theoretical cost snapshot (USD). */
  cost: number;
  categoryId: string;
}

export interface Sale {
  id: string;
  ts: number;
  brandId: string;
  locationId: string;
  lines: SaleLine[];
}

export type Lang = 'en' | 'km';
export type Currency = 'USD' | 'KHR';

export interface Settings {
  lang: Lang;
  currency: Currency;
  /** KHR per 1 USD. */
  khrRate: number;
  khmerDigits: boolean;
}

export interface AppData {
  version: number;
  brands: Brand[];
  locations: Location[];
  categories: Category[];
  ingredients: Ingredient[];
  products: Product[];
  combos: Combo[];
  /** stock[locationId][ingredientId] = quantity in the ingredient's unit */
  stock: Record<string, Record<string, number>>;
  movements: StockMovement[];
  sales: Sale[];
  settings: Settings;
}
