# OneBuy Food Cost

A web app for managing food costs and inventory across multiple restaurant brands. The interface is in English and Khmer (ភាសាខ្មែរ).

## Features

| Area | What it does |
| --- | --- |
| **Dashboard** | Cross-brand overview: revenue, cost of goods, gross profit, food cost % against target, stock value, low-stock alerts, waste cost, a revenue vs cost trend, brand comparison, top items by profit, and items over their target food cost. |
| **Cost Analytics** | Filter by **brand, location, category and period**, then group by brand, location, category or menu item. Each row's food cost % is coloured against its brand's target. Exports to CSV (UTF-8, so Khmer text opens correctly in Excel). |
| **Inventory** | Live stock per location with reorder levels, low-stock highlighting, and receive, waste and stock-count actions. Every change is logged as a stock movement. |
| **Ingredients** | Purchase cost per unit, **yield %** (trim and waste loss, which raises the effective cost), reorder level and supplier. |
| **Menu & Recipes** | Recipe builder with unit conversion (g↔kg, ml↔L). Cost, profit, food cost % and margin are calculated as you edit. Also shows a **suggested price** for the brand's target and the portions you can make from current stock at each location. |
| **Combo Builder** | Tap menu items to build a combo set. Cost, profit, margin, food cost % compared with target, the à-la-carte total, customer savings, the cost of each ingredient and its share of the total, and how many combos each location can make are all calculated automatically. |
| **Record Sale** | A simple point-of-sale screen. Each sale stores its price and cost at the time of sale and **deducts the ingredients from that location's stock straight away**. |
| **Settings** | Language (English/Khmer), optional Khmer numerals (០១២៣), display currency USD or KHR (៛) with an exchange rate, brands (with target food cost %), locations, categories, and JSON backup and restore. |

### Khmer support
- Every screen is fully translated (`src/i18n/km.ts`). The Khmer translation is type-checked against the English one, so no key can be missing.
- Brands, locations, categories, ingredients, menu items and combos each have an English and a Khmer name. If the Khmer name is empty, the English one is shown.
- Uses the Noto Sans Khmer font with taller line height so Khmer subscripts and vowels display correctly.
- Optional Khmer numerals, and riel amounts rounded to the nearest 100 ៛.

### How costs are calculated
- `effective unit cost = cost per unit ÷ yield %`
- `recipe cost = Σ (quantity converted to the ingredient's unit × effective unit cost)`
- `food cost % = cost ÷ price`, `margin % = (price − cost) ÷ price`
- `suggested price = cost ÷ brand target food cost %`
- Combo cost is the sum of its items' recipe costs. Customer savings is the à-la-carte total minus the combo price.

All of this is in `src/lib/costing.ts` and covered by unit tests.

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests for costing and analytics
npm run build      # production build in dist/
```

The app starts with demo data: 3 brands, 5 locations, 28 ingredients, 14 menu items, 3 combos and 45 days of sales. You can reset this data under **Settings → Reset demo data**.

## Data storage and "real-time"

Version 1 runs entirely in the browser:
- Data is saved to `localStorage`.
- Changes appear on every screen immediately, and are synced live to other tabs and windows open on the **same device**.

For several staff or devices to share live data, the store (`src/store/store.tsx`) needs a backend, for example Supabase or Firebase with realtime subscriptions, or your own API with WebSockets. The pages read and write only through the `useStore()` actions, so that change stays inside the store.

## Project structure

```
src/
  types.ts            data model
  lib/costing.ts      recipe and combo costing, unit conversion, portions
  lib/analytics.ts    filtering and grouping by brand, location and category
  lib/format.ts       currency (USD/KHR), Khmer numerals, localized names
  i18n/               English and Khmer dictionaries + useI18n()
  store/              app state, persistence, demo data
  components/         layout and shared UI
  pages/              Dashboard, Analytics, Inventory, Ingredients, Products, Combos, Sales, Settings
```
