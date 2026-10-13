import type { Combo, Ingredient, Product, RecipeLine, Unit } from '../types';

const UNIT_FAMILY: Record<Unit, 'mass' | 'volume' | 'count'> = {
  g: 'mass',
  kg: 'mass',
  ml: 'volume',
  L: 'volume',
  pcs: 'count',
};

/** Size of each unit expressed in its family's base unit (g, ml, pcs). */
const UNIT_FACTOR: Record<Unit, number> = { g: 1, kg: 1000, ml: 1, L: 1000, pcs: 1 };

export function compatibleUnits(unit: Unit): Unit[] {
  return (Object.keys(UNIT_FAMILY) as Unit[]).filter((u) => UNIT_FAMILY[u] === UNIT_FAMILY[unit]);
}

/** Convert a quantity between units of the same family. Throws on mismatch (e.g. kg -> pcs). */
export function convert(qty: number, from: Unit, to: Unit): number {
  if (from === to) return qty;
  if (UNIT_FAMILY[from] !== UNIT_FAMILY[to]) {
    throw new Error(`Cannot convert ${from} to ${to}`);
  }
  return (qty * UNIT_FACTOR[from]) / UNIT_FACTOR[to];
}

/** Cost of one ingredient unit after accounting for trim/waste yield. */
export function effectiveUnitCost(ing: Ingredient): number {
  const y = ing.yieldPct > 0 ? Math.min(ing.yieldPct, 1) : 1;
  return ing.costPerUnit / y;
}

export interface CostLine {
  ingredientId: string;
  /** Quantity in the ingredient's own (stock) unit, before yield. */
  qtyInStockUnit: number;
  cost: number;
}

type IngredientMap = Map<string, Ingredient>;

export function indexById<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((i) => [i.id, i]));
}

export function recipeLineCost(line: RecipeLine, ingredients: IngredientMap): CostLine {
  const ing = ingredients.get(line.ingredientId);
  if (!ing) return { ingredientId: line.ingredientId, qtyInStockUnit: 0, cost: 0 };
  const qty = convert(line.qty, line.unit, ing.unit);
  return { ingredientId: ing.id, qtyInStockUnit: qty, cost: qty * effectiveUnitCost(ing) };
}

export function productCost(product: Pick<Product, 'recipe'>, ingredients: IngredientMap): number {
  return product.recipe.reduce((sum, l) => sum + recipeLineCost(l, ingredients).cost, 0);
}

export interface MarginInfo {
  price: number;
  cost: number;
  profit: number;
  /** Gross margin as a fraction of price. */
  marginPct: number;
  /** Food cost as a fraction of price. */
  foodCostPct: number;
}

export function margin(price: number, cost: number): MarginInfo {
  const profit = price - cost;
  return {
    price,
    cost,
    profit,
    marginPct: price > 0 ? profit / price : 0,
    foodCostPct: price > 0 ? cost / price : 0,
  };
}

/** Price needed to hit a target food-cost fraction. */
export function suggestedPrice(cost: number, targetFoodCost: number): number {
  if (targetFoodCost <= 0) return 0;
  return cost / targetFoodCost;
}

export interface ComboBreakdown extends MarginInfo {
  /** Sum of the items' individual menu prices. */
  alaCartePrice: number;
  /** Customer saving vs ordering items separately. */
  savings: number;
  savingsPct: number;
  items: { productId: string; qty: number; unitCost: number; unitPrice: number }[];
  /** Total ingredient usage for one combo, keyed by ingredient id (stock unit). */
  ingredientUsage: Map<string, CostLine>;
}

export function comboBreakdown(
  combo: Pick<Combo, 'items' | 'price'>,
  products: Map<string, Product>,
  ingredients: IngredientMap,
): ComboBreakdown {
  let cost = 0;
  let alaCartePrice = 0;
  const usage = new Map<string, CostLine>();
  const items: ComboBreakdown['items'] = [];

  for (const item of combo.items) {
    const p = products.get(item.productId);
    if (!p || item.qty <= 0) continue;
    let unitCost = 0;
    for (const line of p.recipe) {
      const cl = recipeLineCost(line, ingredients);
      unitCost += cl.cost;
      const prev = usage.get(cl.ingredientId) ?? { ingredientId: cl.ingredientId, qtyInStockUnit: 0, cost: 0 };
      prev.qtyInStockUnit += cl.qtyInStockUnit * item.qty;
      prev.cost += cl.cost * item.qty;
      usage.set(cl.ingredientId, prev);
    }
    cost += unitCost * item.qty;
    alaCartePrice += p.price * item.qty;
    items.push({ productId: p.id, qty: item.qty, unitCost, unitPrice: p.price });
  }

  const savings = alaCartePrice - combo.price;
  return {
    ...margin(combo.price, cost),
    alaCartePrice,
    savings,
    savingsPct: alaCartePrice > 0 ? savings / alaCartePrice : 0,
    items,
    ingredientUsage: usage,
  };
}

/** Ingredient usage (stock unit) for one unit of a product. */
export function productUsage(product: Product, ingredients: IngredientMap): Map<string, number> {
  const out = new Map<string, number>();
  for (const line of product.recipe) {
    const cl = recipeLineCost(line, ingredients);
    out.set(cl.ingredientId, (out.get(cl.ingredientId) ?? 0) + cl.qtyInStockUnit);
  }
  return out;
}

/** How many portions can be produced from current stock, limited by the scarcest ingredient. */
export function portionsAvailable(usage: Map<string, number>, stock: Record<string, number> | undefined): number {
  let min = Infinity;
  for (const [ingId, need] of usage) {
    if (need <= 0) continue;
    const have = Math.max(stock?.[ingId] ?? 0, 0);
    min = Math.min(min, Math.floor(have / need + 1e-9));
  }
  return min === Infinity ? 0 : min;
}
