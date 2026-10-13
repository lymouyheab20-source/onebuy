import { useMemo, useState } from 'react';
import { useStore } from '../store/store';
import { useI18n } from '../i18n';
import { comboBreakdown, indexById, margin, portionsAvailable, productCost, suggestedPrice } from '../lib/costing';
import { uid } from '../lib/format';
import { Badge, Card, Field, FoodCostBadge, MoneyInput, NameFields, PageHeader, Toast } from '../components/ui';
import type { Combo } from '../types';
import type { TKey } from '../i18n/en';

export function Combos() {
  const { data, upsert, remove } = useStore();
  const { t, n, money, pct, num } = useI18n();

  const comboCat = data.categories.find((c) => c.id === 'c-combo')?.id ?? data.categories[0]?.id ?? '';
  const blank = (brandId = data.brands[0]?.id ?? ''): Combo => ({ id: uid('k-'), brandId, categoryId: comboCat, name: { en: '', km: '' }, price: 0, items: [], active: true });

  const [draft, setDraft] = useState<Combo>(() => blank());
  const [catFilter, setCatFilter] = useState('all');
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  // Until the user types a price, keep it at 90% of the à-la-carte total.
  const [priceTouched, setPriceTouched] = useState(false);
  const startNew = (brandId: string) => { setError(''); setPriceTouched(false); setDraft(blank(brandId)); };

  const ings = useMemo(() => indexById(data.ingredients), [data.ingredients]);
  const prods = useMemo(() => indexById(data.products), [data.products]);
  const brands = indexById(data.brands);
  const isExisting = data.combos.some((c) => c.id === draft.id);
  const brand = brands.get(draft.brandId);
  const target = brand?.targetFoodCost ?? 0.3;

  const b = useMemo(() => comboBreakdown(draft, prods, ings), [draft, prods, ings]);
  const sp = suggestedPrice(b.cost, target);

  const menu = data.products.filter((p) => p.active && p.brandId === draft.brandId && (catFilter === 'all' || p.categoryId === catFilter));

  const setQty = (productId: string, qty: number) => {
    const items = draft.items.filter((i) => i.productId !== productId);
    if (qty > 0) {
      const idx = draft.items.findIndex((i) => i.productId === productId);
      const next = { productId, qty };
      if (idx >= 0) items.splice(idx, 0, next);
      else items.push(next);
    }
    const nextCombo = { ...draft, items };
    if (priceTouched) return setDraft(nextCombo);
    const nb = comboBreakdown(nextCombo, prods, ings);
    setDraft({ ...nextCombo, price: Math.round(nb.alaCartePrice * 0.9 * 4) / 4 });
  };
  const qtyOf = (id: string) => draft.items.find((i) => i.productId === id)?.qty ?? 0;

  const save = () => {
    if (!draft.name.en.trim() || draft.items.length === 0 || draft.price <= 0) return setError(t('errRequired'));
    setError('');
    upsert('combos', draft);
    setToast(t('comboSaved'));
  };

  const del = (c: Combo) => {
    if (!confirm(t('confirmDelete', { name: n(c.name) }))) return;
    const err = remove('combos', c.id);
    if (err) alert(t(err as TKey));
    if (c.id === draft.id) startNew(c.brandId);
  };

  const usage = [...b.ingredientUsage.values()].sort((a, z) => z.cost - a.cost);
  const comboUsage = new Map(usage.map((u) => [u.ingredientId, u.qtyInStockUnit]));
  const brandLocs = data.locations.filter((l) => l.brandId === draft.brandId);

  return (
    <>
      <PageHeader
        title={t('comboTitle')}
        subtitle={t('comboSubtitle')}
        actions={<button className="btn" onClick={() => startNew(draft.brandId)}>+ {t('newCombo')}</button>}
      />

      <div className="combo-layout">
        <Card title={t('pickItems')}>
          <div className="toolbar">
            <label className="inline">
              <span>{t('brand')}</span>
              <select value={draft.brandId} onChange={(e) => { setPriceTouched(false); setDraft({ ...draft, brandId: e.target.value, items: [], price: 0 }); }} disabled={isExisting}>
                {data.brands.map((x) => <option key={x.id} value={x.id}>{n(x.name)}</option>)}
              </select>
            </label>
            <label className="inline">
              <span>{t('category')}</span>
              <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
                <option value="all">{t('allCategories')}</option>
                {data.categories.map((c) => <option key={c.id} value={c.id}>{n(c.name)}</option>)}
              </select>
            </label>
          </div>
          <div className="pick-grid">
            {menu.map((p) => {
              const cost = productCost(p, ings);
              const m = margin(p.price, cost);
              const q = qtyOf(p.id);
              return (
                <button key={p.id} className={`pick ${q ? 'on' : ''}`} onClick={() => setQty(p.id, q + 1)}>
                  {q > 0 && <span className="pick-qty">×{num(q, 0)}</span>}
                  <span className="pick-name">{n(p.name)}</span>
                  <span className="pick-price">{money(p.price)}</span>
                  <span className="pick-meta">{t('cost')} {money(cost)} · {pct(m.foodCostPct, 0)}</span>
                </button>
              );
            })}
            {menu.length === 0 && <p className="muted">{t('noData')}</p>}
          </div>
        </Card>

        <Card title={isExisting ? n(draft.name) || t('edit') : t('newCombo')} className="combo-editor">
          {error && <p className="error">{error}</p>}
          <NameFields value={draft.name} onChange={(name) => setDraft({ ...draft, name })} />

          <h3>{t('selectedItems')}</h3>
          {b.items.length === 0 ? <p className="muted">{t('noItemsSelected')}</p> : (
            <div className="table-wrap">
              <table className="compact">
                <thead><tr><th>{t('item')}</th><th className="num">{t('qty')}</th><th className="num">{t('price')}</th><th className="num">{t('cost')}</th></tr></thead>
                <tbody>
                  {b.items.map((it) => (
                    <tr key={it.productId}>
                      <td>{n(prods.get(it.productId)?.name)}</td>
                      <td className="num">
                        <div className="stepper">
                          <button onClick={() => setQty(it.productId, it.qty - 1)} aria-label="-">−</button>
                          <span>{num(it.qty, 0)}</span>
                          <button onClick={() => setQty(it.productId, it.qty + 1)} aria-label="+">+</button>
                        </div>
                      </td>
                      <td className="num">{money(it.unitPrice * it.qty)}</td>
                      <td className="num">{money(it.unitCost * it.qty)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="grid-2 align-end">
            <Field label={t('comboPrice') + ' *'}>
              <MoneyInput usd={draft.price} onChange={(price) => { setPriceTouched(true); setDraft({ ...draft, price }); }} />
            </Field>
            {sp > 0 && (
              <button className="btn ghost" onClick={() => { setPriceTouched(true); setDraft({ ...draft, price: Math.ceil(sp * 4) / 4 }); }} title={t('suggestedHelp', { t: pct(target) })}>
                {t('useSuggested')}: {money(Math.ceil(sp * 4) / 4)}
              </button>
            )}
          </div>

          <div className="combo-summary">
            <div className="big">
              <span>{t('cost')}</span>
              <strong>{money(b.cost)}</strong>
            </div>
            <div className="big">
              <span>{t('profit')}</span>
              <strong className={b.profit < 0 ? 'neg' : 'pos'}>{money(b.profit)}</strong>
            </div>
            <div className="big">
              <span>{t('marginPct')}</span>
              <strong>{pct(b.marginPct)}</strong>
            </div>
            <div className="big">
              <span>{t('foodCostPct')}</span>
              <FoodCostBadge value={b.foodCostPct} target={target} />
              <small className="muted">{t('target')} {pct(target)}</small>
            </div>
            <div>
              <span>{t('alaCarte')}</span>
              <strong>{money(b.alaCartePrice)}</strong>
            </div>
            <div>
              <span>{t('customerSaves')}</span>
              <strong>{money(b.savings)} ({pct(b.savingsPct, 0)})</strong>
            </div>
          </div>

          {usage.length > 0 && (
            <>
              <h3>{t('ingredientBreakdown')}</h3>
              <div className="table-wrap">
                <table className="compact">
                  <thead><tr><th>{t('ingredient')}</th><th className="num">{t('qty')}</th><th className="num">{t('cost')}</th><th>{t('share')}</th></tr></thead>
                  <tbody>
                    {usage.map((u) => {
                      const ing = ings.get(u.ingredientId);
                      const share = b.cost > 0 ? u.cost / b.cost : 0;
                      return (
                        <tr key={u.ingredientId}>
                          <td>{n(ing?.name)}</td>
                          <td className="num">{num(u.qtyInStockUnit, 3)} {ing?.unit}</td>
                          <td className="num">{money(u.cost)}</td>
                          <td><div className="share"><span style={{ width: `${share * 100}%` }} /><em>{pct(share, 0)}</em></div></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="chips">
                {brandLocs.map((l) => (
                  <span key={l.id} className="chip">{t('availableAt', { loc: n(l.name) })}: <strong>{num(portionsAvailable(comboUsage, data.stock[l.id]), 0)}</strong></span>
                ))}
              </div>
            </>
          )}

          <div className="row-end">
            <label className="check"><input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} /> {t('active')}</label>
            <button className="btn primary" onClick={save}>{isExisting ? t('updateCombo') : t('saveCombo')}</button>
          </div>
        </Card>
      </div>

      <Card title={t('savedCombos')}>
        {data.combos.length === 0 ? <p className="muted">{t('noCombos')}</p> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>{t('name')}</th><th>{t('brand')}</th><th>{t('items')}</th><th className="num">{t('price')}</th><th className="num">{t('cost')}</th><th className="num">{t('profit')}</th><th className="num">{t('foodCostPct')}</th><th className="actions-col">{t('actions')}</th></tr></thead>
              <tbody>
                {data.combos.map((c) => {
                  const cb = comboBreakdown(c, prods, ings);
                  return (
                    <tr key={c.id} className={c.id === draft.id ? 'row-selected' : c.active ? '' : 'row-muted'}>
                      <td><strong>{n(c.name)}</strong>{!c.active && <> <Badge tone="neutral">{t('inactive')}</Badge></>}</td>
                      <td><span className="swatch" style={{ background: brands.get(c.brandId)?.color }} />{n(brands.get(c.brandId)?.name)}</td>
                      <td className="small">{c.items.map((i) => `${i.qty}× ${n(prods.get(i.productId)?.name)}`).join(', ')}</td>
                      <td className="num">{money(c.price)}</td>
                      <td className="num">{money(cb.cost)}</td>
                      <td className="num">{money(cb.profit)}</td>
                      <td className="num"><FoodCostBadge value={cb.foodCostPct} target={brands.get(c.brandId)?.targetFoodCost ?? 0.3} /></td>
                      <td className="actions-col">
                        <button className="btn sm ghost" onClick={() => { setError(''); setPriceTouched(true); setDraft(structuredClone(c)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>{t('edit')}</button>
                        <button className="btn sm ghost danger" onClick={() => del(c)}>{t('delete')}</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {toast && <Toast message={toast} onDone={() => setToast('')} />}
    </>
  );
}
