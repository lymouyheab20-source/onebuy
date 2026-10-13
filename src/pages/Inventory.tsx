import { useMemo, useState } from 'react';
import { useStore } from '../store/store';
import { useI18n } from '../i18n';
import { stockRows } from '../lib/analytics';
import { indexById } from '../lib/costing';
import { Badge, Card, Field, FilterBar, Kpi, Modal, NumberInput, PageHeader } from '../components/ui';
import type { Ingredient, MovementType } from '../types';
import { DEFAULT_FILTERS, type Filters } from '../lib/analytics';

type Action = { kind: 'receive' | 'waste' | 'count'; locationId: string; ingredient: Ingredient };

export function Inventory() {
  const { data, moveStock, countStock } = useStore();
  const { t, n, money, num, dateTime } = useI18n();
  const [filters, setFilters] = useState<Filters>({ ...DEFAULT_FILTERS });
  const [q, setQ] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const [action, setAction] = useState<Action | null>(null);
  const [qty, setQty] = useState(0);
  const [note, setNote] = useState('');

  const ings = indexById(data.ingredients);
  const locs = indexById(data.locations);
  const brands = indexById(data.brands);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return stockRows(data, filters.brandId, filters.locationId)
      .filter((r) => !lowOnly || r.low)
      .filter((r) => {
        if (!needle) return true;
        const ing = ings.get(r.ingredientId);
        return `${ing?.name.en} ${ing?.name.km ?? ''}`.toLowerCase().includes(needle);
      })
      .sort((a, b) => Number(b.low) - Number(a.low) || a.locationId.localeCompare(b.locationId));
  }, [data, filters, q, lowOnly]);

  const value = rows.reduce((s, r) => s + r.value, 0);
  const lowCount = rows.filter((r) => r.low).length;

  const locIds = new Set(
    data.locations.filter((l) => (filters.brandId === 'all' || l.brandId === filters.brandId) && (filters.locationId === 'all' || l.id === filters.locationId)).map((l) => l.id),
  );
  const recent = data.movements.filter((m) => locIds.has(m.locationId)).slice(-25).reverse();

  const open = (kind: Action['kind'], locationId: string, ingredient: Ingredient) => {
    setAction({ kind, locationId, ingredient });
    setQty(kind === 'count' ? data.stock[locationId]?.[ingredient.id] ?? 0 : 0);
    setNote('');
  };

  const submit = () => {
    if (!action) return;
    if (action.kind === 'count') countStock(action.locationId, action.ingredient.id, qty, note || undefined);
    else if (qty > 0) moveStock(action.locationId, action.ingredient.id, action.kind === 'waste' ? -qty : qty, action.kind as MovementType, note || undefined);
    setAction(null);
  };

  const typeTone: Record<MovementType, 'good' | 'bad' | 'warn' | 'neutral'> = { receive: 'good', waste: 'bad', adjust: 'warn', sale: 'neutral', transfer: 'neutral' };

  return (
    <>
      <PageHeader title={t('invTitle')} subtitle={t('invSubtitle')} />
      <Card>
        <div className="toolbar">
          <FilterBar filters={filters} onChange={setFilters} show={{ brand: true, location: true }} />
          <input className="search" placeholder={t('search')} value={q} onChange={(e) => setQ(e.target.value)} />
          <label className="check"><input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} /> {t('showLowOnly')}</label>
        </div>
      </Card>

      <div className="kpis">
        <Kpi label={t('stockValue')} value={money(value)} />
        <Kpi label={t('lowStockItems')} value={num(lowCount, 0)} tone={lowCount ? 'warn' : 'good'} />
        <Kpi label={t('items')} value={num(rows.length, 0)} />
      </div>

      <Card>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t('ingredient')}</th>
                <th>{t('location')}</th>
                <th className="num">{t('onHand')}</th>
                <th className="num">{t('reorderLevel')}</th>
                <th>{t('status')}</th>
                <th className="num">{t('stockValue')}</th>
                <th className="actions-col">{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const ing = ings.get(r.ingredientId)!;
                const loc = locs.get(r.locationId);
                const fill = Math.max(0, Math.min(1, r.qty / ((r.parLevel || 1) * 3)));
                return (
                  <tr key={r.locationId + r.ingredientId} className={r.low ? 'row-low' : ''}>
                    <td><strong>{n(ing.name)}</strong></td>
                    <td><span className="swatch" style={{ background: brands.get(loc?.brandId ?? '')?.color }} />{n(loc?.name)}</td>
                    <td className="num">
                      {num(r.qty)} {ing.unit}
                      <div className="meter"><span style={{ width: `${fill * 100}%` }} className={r.low ? 'low' : ''} /></div>
                    </td>
                    <td className="num">{num(r.parLevel)} {ing.unit}</td>
                    <td><Badge tone={r.qty <= 0 ? 'bad' : r.low ? 'warn' : 'good'}>{r.low ? t('low') : t('ok')}</Badge></td>
                    <td className="num">{money(r.value)}</td>
                    <td className="actions-col">
                      <button className="btn sm" onClick={() => open('receive', r.locationId, ing)}>+ {t('receive')}</button>
                      <button className="btn sm ghost" onClick={() => open('waste', r.locationId, ing)}>{t('waste')}</button>
                      <button className="btn sm ghost" onClick={() => open('count', r.locationId, ing)}>{t('count')}</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length === 0 && <p className="muted pad">{t('noData')}</p>}
        </div>
      </Card>

      <Card title={t('recentMovements')}>
        <div className="table-wrap">
          <table>
            <thead><tr><th>{t('date')}</th><th>{t('type')}</th><th>{t('ingredient')}</th><th>{t('location')}</th><th className="num">{t('qty')}</th><th>{t('note')}</th></tr></thead>
            <tbody>
              {recent.map((m) => {
                const ing = ings.get(m.ingredientId);
                return (
                  <tr key={m.id}>
                    <td>{dateTime(m.ts)}</td>
                    <td><Badge tone={typeTone[m.type]}>{t(m.type)}</Badge></td>
                    <td>{n(ing?.name)}</td>
                    <td>{n(locs.get(m.locationId)?.name)}</td>
                    <td className={`num ${m.delta < 0 ? 'neg' : 'pos'}`}>{m.delta > 0 ? '+' : ''}{num(m.delta, 3)} {ing?.unit}</td>
                    <td className="muted small">{m.type === 'sale' ? '' : m.note}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {action && (
        <Modal
          title={`${t(action.kind)} · ${n(action.ingredient.name)}`}
          onClose={() => setAction(null)}
          footer={<><button className="btn ghost" onClick={() => setAction(null)}>{t('cancel')}</button><button className="btn primary" onClick={submit}>{t('save')}</button></>}
        >
          <p className="muted">{n(locs.get(action.locationId)?.name)} · {t('onHand')}: {num(data.stock[action.locationId]?.[action.ingredient.id] ?? 0)} {action.ingredient.unit}</p>
          <Field label={action.kind === 'count' ? t('countedQty', { unit: action.ingredient.unit }) : t('quantityIn', { unit: action.ingredient.unit })}>
            <NumberInput value={qty} onChange={setQty} min={0} />
          </Field>
          {action.kind === 'receive' && <p className="muted small">{t('cost')}: {money(qty * action.ingredient.costPerUnit)}</p>}
          {action.kind === 'waste' && <p className="muted small">{t('wasteCost')}: {money(qty * action.ingredient.costPerUnit / (action.ingredient.yieldPct || 1))}</p>}
          <Field label={t('note')}>
            <input value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </Modal>
      )}
    </>
  );
}
