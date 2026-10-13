import { useMemo, useState } from 'react';
import { useStore, type CartLine } from '../store/store';
import { useI18n } from '../i18n';
import { comboBreakdown, indexById, margin, portionsAvailable, productCost, productUsage } from '../lib/costing';
import { Badge, Card, FoodCostBadge, PageHeader, Toast } from '../components/ui';

export function Sales() {
  const { data, recordSale } = useStore();
  const { t, n, money, num, dateTime } = useI18n();
  const [locationId, setLocationId] = useState(data.locations[0]?.id ?? '');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [toast, setToast] = useState('');

  const loc = data.locations.find((l) => l.id === locationId);
  const brand = data.brands.find((b) => b.id === loc?.brandId);
  const ings = useMemo(() => indexById(data.ingredients), [data.ingredients]);
  const prods = useMemo(() => indexById(data.products), [data.products]);
  const combos = indexById(data.combos);
  const stock = data.stock[locationId];

  const menu = data.products.filter((p) => p.active && p.brandId === loc?.brandId);
  const comboMenu = data.combos.filter((c) => c.active && c.brandId === loc?.brandId);

  const priceOf = (l: CartLine) => (l.kind === 'product' ? prods.get(l.refId)?.price ?? 0 : combos.get(l.refId)?.price ?? 0);
  const costOf = (l: CartLine) => {
    if (l.kind === 'product') {
      const p = prods.get(l.refId);
      return p ? productCost(p, ings) : 0;
    }
    const c = combos.get(l.refId);
    return c ? comboBreakdown(c, prods, ings).cost : 0;
  };
  const total = cart.reduce((s, l) => s + priceOf(l) * l.qty, 0);
  const cost = cart.reduce((s, l) => s + costOf(l) * l.qty, 0);
  const m = margin(total, cost);

  const add = (kind: CartLine['kind'], refId: string, delta = 1) => {
    setCart((c) => {
      const idx = c.findIndex((l) => l.kind === kind && l.refId === refId);
      if (idx < 0) return delta > 0 ? [...c, { kind, refId, qty: delta }] : c;
      const qty = c[idx].qty + delta;
      return qty <= 0 ? c.filter((_, i) => i !== idx) : c.map((l, i) => (i === idx ? { ...l, qty } : l));
    });
  };

  const checkout = () => {
    if (recordSale(locationId, cart)) {
      setCart([]);
      setToast(t('saleRecorded'));
    }
  };

  const recent = data.sales.filter((s) => s.locationId === locationId).slice(-10).reverse();

  return (
    <>
      <PageHeader
        title={t('salesTitle')}
        subtitle={t('salesSubtitle')}
        actions={
          <label className="inline">
            <span>{t('location')}</span>
            <select value={locationId} onChange={(e) => { setLocationId(e.target.value); setCart([]); }}>
              {data.brands.map((b) => (
                <optgroup key={b.id} label={n(b.name)}>
                  {data.locations.filter((l) => l.brandId === b.id).map((l) => <option key={l.id} value={l.id}>{n(l.name)}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
        }
      />
      <div className="combo-layout">
        <div>
          <Card title={t('menuItems')}>
            <div className="pick-grid">
              {menu.map((p) => {
                const avail = portionsAvailable(productUsage(p, ings), stock);
                return (
                  <button key={p.id} className="pick" onClick={() => add('product', p.id)}>
                    <span className="pick-name">{n(p.name)}</span>
                    <span className="pick-price">{money(p.price)}</span>
                    <span className="pick-meta"><Badge tone={avail === 0 ? 'bad' : avail < 10 ? 'warn' : 'good'}>{num(avail, 0)}</Badge> {t('portionsAvailable')}</span>
                  </button>
                );
              })}
            </div>
          </Card>
          {comboMenu.length > 0 && (
            <Card title={t('combos')}>
              <div className="pick-grid">
                {comboMenu.map((c) => {
                  const avail = portionsAvailable(new Map([...comboBreakdown(c, prods, ings).ingredientUsage].map(([k, v]) => [k, v.qtyInStockUnit])), stock);
                  return (
                    <button key={c.id} className="pick" onClick={() => add('combo', c.id)}>
                      <span className="pick-name">{n(c.name)}</span>
                      <span className="pick-price">{money(c.price)}</span>
                      <span className="pick-meta"><Badge tone={avail === 0 ? 'bad' : avail < 10 ? 'warn' : 'good'}>{num(avail, 0)}</Badge> {t('portionsAvailable')}</span>
                    </button>
                  );
                })}
              </div>
            </Card>
          )}
        </div>

        <Card title={t('cart')} className="combo-editor">
          {cart.length === 0 ? <p className="muted">{t('emptyCart')}</p> : (
            <table className="compact">
              <tbody>
                {cart.map((l) => (
                  <tr key={l.kind + l.refId}>
                    <td>{n(l.kind === 'product' ? prods.get(l.refId)?.name : combos.get(l.refId)?.name)}</td>
                    <td className="num">
                      <div className="stepper">
                        <button onClick={() => add(l.kind, l.refId, -1)} aria-label="-">−</button>
                        <span>{num(l.qty, 0)}</span>
                        <button onClick={() => add(l.kind, l.refId, 1)} aria-label="+">+</button>
                      </div>
                    </td>
                    <td className="num">{money(priceOf(l) * l.qty)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="combo-summary">
            <div className="big"><span>{t('total')}</span><strong>{money(total)}</strong></div>
            <div className="big"><span>{t('cost')}</span><strong>{money(cost)}</strong></div>
            <div className="big"><span>{t('profit')}</span><strong className="pos">{money(m.profit)}</strong></div>
            <div className="big"><span>{t('foodCostPct')}</span><FoodCostBadge value={m.foodCostPct} target={brand?.targetFoodCost ?? 0.3} /></div>
          </div>
          <button className="btn primary block" disabled={cart.length === 0} onClick={checkout}>{t('checkout')}</button>

          <h3>{t('recentSales')}</h3>
          <ul className="sale-list">
            {recent.map((s) => {
              const rev = s.lines.reduce((a, l) => a + l.price * l.qty, 0);
              return (
                <li key={s.id}>
                  <span className="muted small">{dateTime(s.ts)}</span>
                  <span className="small">{s.lines.map((l) => `${l.qty}× ${n(l.kind === 'product' ? prods.get(l.refId)?.name : combos.get(l.refId)?.name)}`).join(', ')}</span>
                  <strong>{money(rev)}</strong>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
      {toast && <Toast message={toast} onDone={() => setToast('')} />}
    </>
  );
}
