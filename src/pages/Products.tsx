import { useMemo, useState } from 'react';
import { useStore } from '../store/store';
import { useI18n } from '../i18n';
import { compatibleUnits, indexById, margin, portionsAvailable, productCost, productUsage, recipeLineCost, suggestedPrice } from '../lib/costing';
import { uid } from '../lib/format';
import { Badge, Card, Field, FilterBar, FoodCostBadge, Modal, MoneyInput, NameFields, NumberInput, PageHeader } from '../components/ui';
import { DEFAULT_FILTERS, type Filters } from '../lib/analytics';
import type { Product, Unit } from '../types';
import type { TKey } from '../i18n/en';

export function Products() {
  const { data, upsert, remove } = useStore();
  const { t, n, money, num } = useI18n();
  const [filters, setFilters] = useState<Filters>({ ...DEFAULT_FILTERS });
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<Product | null>(null);
  const [error, setError] = useState('');

  const ings = useMemo(() => indexById(data.ingredients), [data.ingredients]);
  const brands = indexById(data.brands);
  const cats = indexById(data.categories);
  const locs = indexById(data.locations);

  const rows = data.products
    .filter((p) => (filters.brandId === 'all' || p.brandId === filters.brandId) && (filters.categoryId === 'all' || p.categoryId === filters.categoryId))
    .filter((p) => `${p.name.en} ${p.name.km ?? ''}`.toLowerCase().includes(q.trim().toLowerCase()))
    .map((p) => {
      const m = margin(p.price, productCost(p, ings));
      const usage = productUsage(p, ings);
      const brandLocs = data.locations.filter((l) => l.brandId === p.brandId && (filters.locationId === 'all' || l.id === filters.locationId));
      const portions = brandLocs.reduce((s, l) => s + portionsAvailable(usage, data.stock[l.id]), 0);
      return { p, m, portions, target: brands.get(p.brandId)?.targetFoodCost ?? 0.3 };
    });

  const newProduct = (): Product => ({
    id: uid('p-'),
    brandId: filters.brandId !== 'all' ? filters.brandId : data.brands[0]?.id ?? '',
    categoryId: filters.categoryId !== 'all' ? filters.categoryId : data.categories[0]?.id ?? '',
    name: { en: '', km: '' },
    price: 0,
    recipe: [],
    active: true,
  });

  const save = () => {
    if (!edit || !edit.name.en.trim() || !edit.brandId || !edit.categoryId) return setError(t('errRequired'));
    upsert('products', { ...edit, recipe: edit.recipe.filter((l) => l.ingredientId && l.qty > 0) });
    setEdit(null);
  };

  const del = (p: Product) => {
    if (!confirm(t('confirmDelete', { name: n(p.name) }))) return;
    const err = remove('products', p.id);
    if (err) alert(t(err as TKey));
  };

  return (
    <>
      <PageHeader
        title={t('prodTitle')}
        subtitle={t('prodSubtitle')}
        actions={<button className="btn primary" onClick={() => { setError(''); setEdit(newProduct()); }}>+ {t('addProduct')}</button>}
      />
      <Card>
        <div className="toolbar">
          <FilterBar filters={filters} onChange={setFilters} show={{ brand: true, location: true, category: true }} />
          <input className="search" placeholder={t('search')} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </Card>
      <Card>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t('name')}</th>
                <th>{t('brand')}</th>
                <th>{t('category')}</th>
                <th className="num">{t('price')}</th>
                <th className="num">{t('cost')}</th>
                <th className="num">{t('profit')}</th>
                <th className="num">{t('foodCostPct')}</th>
                <th className="num">{t('portionsAvailable')}</th>
                <th className="actions-col">{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ p, m, portions, target }) => (
                <tr key={p.id} className={p.active ? '' : 'row-muted'}>
                  <td><strong>{n(p.name)}</strong>{!p.active && <> <Badge tone="neutral">{t('inactive')}</Badge></>}</td>
                  <td><span className="swatch" style={{ background: brands.get(p.brandId)?.color }} />{n(brands.get(p.brandId)?.name)}</td>
                  <td>{n(cats.get(p.categoryId)?.name)}</td>
                  <td className="num">{money(p.price)}</td>
                  <td className="num">{money(m.cost)}</td>
                  <td className="num">{money(m.profit)}</td>
                  <td className="num"><FoodCostBadge value={m.foodCostPct} target={target} /></td>
                  <td className="num">{num(portions, 0)}</td>
                  <td className="actions-col">
                    <button className="btn sm ghost" onClick={() => { setError(''); setEdit(structuredClone(p)); }}>{t('edit')}</button>
                    <button className="btn sm ghost danger" onClick={() => del(p)}>{t('delete')}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <p className="muted pad">{t('noData')}</p>}
        </div>
      </Card>

      {edit && (
        <Modal
          title={edit.name.en ? n(edit.name) : t('addProduct')}
          onClose={() => setEdit(null)}
          footer={<><button className="btn ghost" onClick={() => setEdit(null)}>{t('cancel')}</button><button className="btn primary" onClick={save}>{t('save')}</button></>}
        >
          {error && <p className="error">{error}</p>}
          <NameFields value={edit.name} onChange={(name) => setEdit({ ...edit, name })} />
          <div className="grid-3">
            <Field label={t('brand')}>
              <select value={edit.brandId} onChange={(e) => setEdit({ ...edit, brandId: e.target.value })}>
                {data.brands.map((b) => <option key={b.id} value={b.id}>{n(b.name)}</option>)}
              </select>
            </Field>
            <Field label={t('category')}>
              <select value={edit.categoryId} onChange={(e) => setEdit({ ...edit, categoryId: e.target.value })}>
                {data.categories.map((c) => <option key={c.id} value={c.id}>{n(c.name)}</option>)}
              </select>
            </Field>
            <Field label={t('price')}>
              <MoneyInput usd={edit.price} onChange={(price) => setEdit({ ...edit, price })} />
            </Field>
          </div>
          <label className="check"><input type="checkbox" checked={edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} /> {t('active')}</label>

          <h3>{t('recipe')}</h3>
          <RecipeEditor product={edit} onChange={(recipe) => setEdit({ ...edit, recipe })} />
          <CostSummary product={edit} target={brands.get(edit.brandId)?.targetFoodCost ?? 0.3} onUsePrice={(price) => setEdit({ ...edit, price })} />
          {data.locations.filter((l) => l.brandId === edit.brandId).length > 0 && edit.recipe.length > 0 && (
            <div className="chips">
              {data.locations.filter((l) => l.brandId === edit.brandId).map((l) => (
                <span key={l.id} className="chip">{n(locs.get(l.id)?.name)}: <strong>{num(portionsAvailable(productUsage(edit, ings), data.stock[l.id]), 0)}</strong></span>
              ))}
            </div>
          )}
        </Modal>
      )}
    </>
  );
}

function RecipeEditor({ product, onChange }: { product: Product; onChange: (r: Product['recipe']) => void }) {
  const { data } = useStore();
  const { t, n, money } = useI18n();
  const ings = indexById(data.ingredients);
  const lines = product.recipe;
  const set = (idx: number, patch: Partial<Product['recipe'][number]>) => onChange(lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)));

  return (
    <div className="recipe">
      {lines.length === 0 && <p className="muted">{t('emptyRecipe')}</p>}
      {lines.map((l, idx) => {
        const ing = ings.get(l.ingredientId);
        const units: Unit[] = ing ? compatibleUnits(ing.unit) : [l.unit];
        const cost = ing ? recipeLineCost(l, ings).cost : 0;
        return (
          <div className="recipe-line" key={idx}>
            <select
              value={l.ingredientId}
              onChange={(e) => {
                const next = ings.get(e.target.value);
                const unit = next && !compatibleUnits(next.unit).includes(l.unit) ? next.unit === 'kg' ? 'g' : next.unit === 'L' ? 'ml' : next.unit : l.unit;
                set(idx, { ingredientId: e.target.value, unit });
              }}
            >
              {data.ingredients.map((i) => <option key={i.id} value={i.id}>{n(i.name)}</option>)}
            </select>
            <NumberInput value={l.qty} onChange={(qty) => set(idx, { qty })} min={0} className="qty" />
            <select value={l.unit} onChange={(e) => set(idx, { unit: e.target.value as Unit })} className="unit">
              {units.map((u) => <option key={u}>{u}</option>)}
            </select>
            <span className="num line-cost">{money(cost)}</span>
            <button className="icon-btn" aria-label={t('delete')} onClick={() => onChange(lines.filter((_, i) => i !== idx))}>×</button>
          </div>
        );
      })}
      <button
        className="btn sm ghost"
        onClick={() => {
          const first = data.ingredients[0];
          if (!first) return;
          onChange([...lines, { ingredientId: first.id, qty: 0, unit: first.unit === 'kg' ? 'g' : first.unit === 'L' ? 'ml' : first.unit }]);
        }}
      >
        + {t('addLine')}
      </button>
    </div>
  );
}

function CostSummary({ product, target, onUsePrice }: { product: Product; target: number; onUsePrice: (p: number) => void }) {
  const { data } = useStore();
  const { t, money, pct } = useI18n();
  const ings = indexById(data.ingredients);
  const m = margin(product.price, productCost(product, ings));
  const sp = suggestedPrice(m.cost, target);
  return (
    <div className="cost-summary">
      <div><span>{t('recipeCost')}</span><strong>{money(m.cost)}</strong></div>
      <div><span>{t('profit')}</span><strong className={m.profit < 0 ? 'neg' : ''}>{money(m.profit)}</strong></div>
      <div><span>{t('foodCostPct')}</span><FoodCostBadge value={m.foodCostPct} target={target} /></div>
      <div><span>{t('marginPct')}</span><strong>{pct(m.marginPct)}</strong></div>
      <div title={t('suggestedHelp', { t: pct(target) })}>
        <span>{t('suggestedPrice')}</span>
        <strong>{money(sp)}</strong>
        {sp > 0 && <button className="btn xs ghost" onClick={() => onUsePrice(Math.ceil(sp * 4) / 4)}>{t('useSuggested')}</button>}
      </div>
    </div>
  );
}
