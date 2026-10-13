import { useMemo, useState } from 'react';
import { useStore } from '../store/store';
import { useI18n } from '../i18n';
import { effectiveUnitCost } from '../lib/costing';
import { uid } from '../lib/format';
import { Card, Field, Modal, MoneyInput, NameFields, NumberInput, PageHeader } from '../components/ui';
import type { Ingredient, Unit } from '../types';
import type { TKey } from '../i18n/en';

const UNITS: Unit[] = ['g', 'kg', 'ml', 'L', 'pcs'];

const blank = (): Ingredient => ({ id: uid('i-'), name: { en: '', km: '' }, unit: 'kg', costPerUnit: 0, yieldPct: 1, parLevel: 0, supplier: '' });

export function Ingredients() {
  const { data, upsert, remove } = useStore();
  const { t, n, money, pct, num } = useI18n();
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<Ingredient | null>(null);
  const [error, setError] = useState('');

  const usage = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of data.products) new Set(p.recipe.map((l) => l.ingredientId)).forEach((id) => m.set(id, (m.get(id) ?? 0) + 1));
    return m;
  }, [data.products]);

  const rows = data.ingredients.filter((i) => `${i.name.en} ${i.name.km ?? ''} ${i.supplier ?? ''}`.toLowerCase().includes(q.trim().toLowerCase()));

  const save = () => {
    if (!edit || !edit.name.en.trim()) return setError(t('errRequired'));
    upsert('ingredients', edit);
    setEdit(null);
  };

  const del = (ing: Ingredient) => {
    if (!confirm(t('confirmDelete', { name: n(ing.name) }))) return;
    const err = remove('ingredients', ing.id);
    if (err) alert(t(err as TKey));
  };

  return (
    <>
      <PageHeader
        title={t('ingTitle')}
        subtitle={t('ingSubtitle')}
        actions={<button className="btn primary" onClick={() => { setError(''); setEdit(blank()); }}>+ {t('addIngredient')}</button>}
      />
      <Card>
        <div className="toolbar"><input className="search" placeholder={t('search')} value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t('name')}</th>
                <th>{t('unit')}</th>
                <th className="num">{t('costPerUnit')}</th>
                <th className="num">{t('yield')}</th>
                <th className="num">{t('effectiveCost')}</th>
                <th className="num">{t('reorderLevel')}</th>
                <th>{t('supplier')}</th>
                <th>{t('usedIn')}</th>
                <th className="actions-col">{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((i) => (
                <tr key={i.id}>
                  <td><strong>{n(i.name)}</strong>{i.name.km && <div className="muted small">{i.name.en}</div>}</td>
                  <td>{i.unit}</td>
                  <td className="num">{money(i.costPerUnit)}</td>
                  <td className="num">{pct(i.yieldPct, 0)}</td>
                  <td className="num">{money(effectiveUnitCost(i))}</td>
                  <td className="num">{num(i.parLevel)} {i.unit}</td>
                  <td>{i.supplier}</td>
                  <td>{t('nItems', { n: num(usage.get(i.id) ?? 0, 0) })}</td>
                  <td className="actions-col">
                    <button className="btn sm ghost" onClick={() => { setError(''); setEdit({ ...i, name: { ...i.name } }); }}>{t('edit')}</button>
                    <button className="btn sm ghost danger" onClick={() => del(i)}>{t('delete')}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {edit && (
        <Modal
          title={edit.name.en ? n(edit.name) : t('addIngredient')}
          onClose={() => setEdit(null)}
          footer={<><button className="btn ghost" onClick={() => setEdit(null)}>{t('cancel')}</button><button className="btn primary" onClick={save}>{t('save')}</button></>}
        >
          {error && <p className="error">{error}</p>}
          <NameFields value={edit.name} onChange={(name) => setEdit({ ...edit, name })} />
          <div className="grid-3">
            <Field label={t('unit')}>
              <select value={edit.unit} onChange={(e) => setEdit({ ...edit, unit: e.target.value as Unit })}>
                {UNITS.map((u) => <option key={u}>{u}</option>)}
              </select>
            </Field>
            <Field label={`${t('costPerUnit')} (1 ${edit.unit})`}>
              <MoneyInput usd={edit.costPerUnit} onChange={(costPerUnit) => setEdit({ ...edit, costPerUnit })} />
            </Field>
            <Field label={`${t('yield')} %`} help={t('yieldHelp')}>
              <NumberInput value={Math.round(edit.yieldPct * 100)} onChange={(v) => setEdit({ ...edit, yieldPct: Math.min(Math.max(v, 1), 100) / 100 })} min={1} />
            </Field>
          </div>
          <div className="grid-2">
            <Field label={`${t('reorderLevel')} (${edit.unit})`}>
              <NumberInput value={edit.parLevel} onChange={(parLevel) => setEdit({ ...edit, parLevel })} min={0} />
            </Field>
            <Field label={t('supplier')}>
              <input value={edit.supplier ?? ''} onChange={(e) => setEdit({ ...edit, supplier: e.target.value })} />
            </Field>
          </div>
          <p className="muted small">{t('effectiveCost')}: <strong>{money(effectiveUnitCost(edit))}</strong> / {edit.unit}</p>
        </Modal>
      )}
    </>
  );
}
