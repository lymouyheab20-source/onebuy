import { useRef, useState } from 'react';
import { useStore } from '../store/store';
import { useI18n } from '../i18n';
import { useDialogs } from '../components/dialogs';
import { uid } from '../lib/format';
import { Card, downloadFile, Field, Modal, NameFields, NumberInput, PageHeader, Toast } from '../components/ui';
import type { Brand, Category, Location } from '../types';
import type { TKey } from '../i18n/en';

type Editing =
  | { kind: 'brands'; item: Brand }
  | { kind: 'locations'; item: Location }
  | { kind: 'categories'; item: Category };

export function Settings() {
  const store = useStore();
  const { data, updateSettings, upsert, remove } = store;
  const { t, n, pct } = useI18n();
  const { ask, notify } = useDialogs();
  const s = data.settings;
  const [editing, setEditing] = useState<Editing | null>(null);
  const [toast, setToast] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const del = async (kind: Editing['kind'], id: string, name: string) => {
    if (!(await ask(t('confirmDelete', { name })))) return;
    const err = remove(kind, id);
    if (err) notify(t(err as TKey));
  };

  const save = () => {
    if (!editing || !editing.item.name.en.trim()) return;
    if (editing.kind === 'brands') upsert('brands', editing.item);
    else if (editing.kind === 'locations') upsert('locations', editing.item);
    else upsert('categories', editing.item);
    setEditing(null);
  };

  const onImport = async (file: File) => {
    const ok = store.importJson(await file.text());
    setToast(ok ? t('importOk') : t('importFailed'));
  };

  return (
    <>
      <PageHeader title={t('settingsTitle')} />
      <div className="grid-2 align-start">
        <Card title={t('language') + ' / ' + t('currency')}>
          <Field label={t('language')}>
            <select value={s.lang} onChange={(e) => updateSettings({ lang: e.target.value as 'en' | 'km' })}>
              <option value="en">English</option>
              <option value="km">ភាសាខ្មែរ (Khmer)</option>
            </select>
          </Field>
          <label className="check"><input type="checkbox" checked={s.khmerDigits} onChange={(e) => updateSettings({ khmerDigits: e.target.checked })} /> <span className="km">{t('khmerDigits')}</span></label>
          <Field label={t('currency')}>
            <select value={s.currency} onChange={(e) => updateSettings({ currency: e.target.value as 'USD' | 'KHR' })}>
              <option value="USD">USD ($)</option>
              <option value="KHR">KHR (៛)</option>
            </select>
          </Field>
          <Field label={t('exchangeRate')}>
            <NumberInput value={s.khrRate} onChange={(khrRate) => khrRate > 0 && updateSettings({ khrRate })} min={1} />
          </Field>
        </Card>

        <Card title={t('data')}>
          <p className="muted small">{t('dataNote')}</p>
          <div className="btn-col">
            <button className="btn" onClick={() => downloadFile(`onebuy-backup-${new Date().toISOString().slice(0, 10)}.json`, store.exportJson(), 'application/json')}>⇩ {t('exportData')}</button>
            <button className="btn" onClick={() => fileRef.current?.click()}>⇧ {t('importData')}</button>
            <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onImport(f); e.target.value = ''; }} />
            <button className="btn ghost danger" onClick={async () => (await ask(t('resetConfirm'))) && store.resetDemo()}>{t('resetDemo')}</button>
          </div>
        </Card>
      </div>

      <Card title={t('manageBrands')} actions={<button className="btn sm" onClick={() => setEditing({ kind: 'brands', item: { id: uid('b-'), name: { en: '', km: '' }, color: '#2563eb', targetFoodCost: 0.3 } })}>+ {t('addBrand')}</button>}>
        <div className="table-wrap">
          <table>
            <thead><tr><th>{t('name')}</th><th className="num">{t('targetFoodCost')}</th><th>{t('locations')}</th><th className="actions-col">{t('actions')}</th></tr></thead>
            <tbody>
              {data.brands.map((b) => (
                <tr key={b.id}>
                  <td><span className="swatch" style={{ background: b.color }} /><strong>{n(b.name)}</strong></td>
                  <td className="num">{pct(b.targetFoodCost, 0)}</td>
                  <td>{data.locations.filter((l) => l.brandId === b.id).map((l) => n(l.name)).join(', ')}</td>
                  <td className="actions-col">
                    <button className="btn sm ghost" onClick={() => setEditing({ kind: 'brands', item: structuredClone(b) })}>{t('edit')}</button>
                    <button className="btn sm ghost danger" onClick={() => del('brands', b.id, n(b.name))}>{t('delete')}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid-2 align-start">
        <Card title={t('manageLocations')} actions={<button className="btn sm" disabled={!data.brands.length} onClick={() => setEditing({ kind: 'locations', item: { id: uid('l-'), brandId: data.brands[0]?.id ?? '', name: { en: '', km: '' } } })}>+ {t('addLocation')}</button>}>
          <div className="table-wrap">
            <table>
              <thead><tr><th>{t('name')}</th><th>{t('brand')}</th><th className="actions-col">{t('actions')}</th></tr></thead>
              <tbody>
                {data.locations.map((l) => (
                  <tr key={l.id}>
                    <td>{n(l.name)}</td>
                    <td>{n(data.brands.find((b) => b.id === l.brandId)?.name)}</td>
                    <td className="actions-col">
                      <button className="btn sm ghost" onClick={() => setEditing({ kind: 'locations', item: structuredClone(l) })}>{t('edit')}</button>
                      <button className="btn sm ghost danger" onClick={() => del('locations', l.id, n(l.name))}>{t('delete')}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title={t('manageCategories')} actions={<button className="btn sm" onClick={() => setEditing({ kind: 'categories', item: { id: uid('c-'), name: { en: '', km: '' } } })}>+ {t('addCategory')}</button>}>
          <div className="table-wrap">
            <table>
              <thead><tr><th>{t('name')}</th><th className="actions-col">{t('actions')}</th></tr></thead>
              <tbody>
                {data.categories.map((c) => (
                  <tr key={c.id}>
                    <td>{n(c.name)}</td>
                    <td className="actions-col">
                      <button className="btn sm ghost" onClick={() => setEditing({ kind: 'categories', item: structuredClone(c) })}>{t('edit')}</button>
                      <button className="btn sm ghost danger" onClick={() => del('categories', c.id, n(c.name))}>{t('delete')}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {editing && (
        <Modal
          title={t(editing.kind === 'brands' ? 'manageBrands' : editing.kind === 'locations' ? 'manageLocations' : 'manageCategories')}
          onClose={() => setEditing(null)}
          footer={<><button className="btn ghost" onClick={() => setEditing(null)}>{t('cancel')}</button><button className="btn primary" onClick={save}>{t('save')}</button></>}
        >
          <NameFields value={editing.item.name} onChange={(name) => setEditing({ ...editing, item: { ...editing.item, name } } as Editing)} />
          {editing.kind === 'brands' && (
            <div className="grid-2">
              <Field label={`${t('targetFoodCost')} %`}>
                <NumberInput value={Math.round(editing.item.targetFoodCost * 100)} onChange={(v) => setEditing({ ...editing, item: { ...editing.item, targetFoodCost: Math.min(Math.max(v, 1), 100) / 100 } })} min={1} />
              </Field>
              <Field label={t('color')}>
                <input type="color" value={editing.item.color} onChange={(e) => setEditing({ ...editing, item: { ...editing.item, color: e.target.value } })} />
              </Field>
            </div>
          )}
          {editing.kind === 'locations' && (
            <Field label={t('brand')}>
              <select value={editing.item.brandId} onChange={(e) => setEditing({ ...editing, item: { ...editing.item, brandId: e.target.value } })}>
                {data.brands.map((b) => <option key={b.id} value={b.id}>{n(b.name)}</option>)}
              </select>
            </Field>
          )}
        </Modal>
      )}
      {toast && <Toast message={toast} onDone={() => setToast('')} />}
    </>
  );
}
