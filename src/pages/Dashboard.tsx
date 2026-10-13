import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useStore } from '../store/store';
import { useI18n } from '../i18n';
import { byBrand, byItem, dailySeries, DEFAULT_FILTERS, filteredLines, stockRows, totals, wasteCost, type Filters } from '../lib/analytics';
import { comboBreakdown, indexById, margin, productCost } from '../lib/costing';
import { Badge, Card, FilterBar, FoodCostBadge, Kpi, PageHeader } from '../components/ui';

export function Dashboard() {
  const { data } = useStore();
  const i = useI18n();
  const { t, n, money, pct, num } = i;
  const [filters, setFilters] = useState<Filters>({ ...DEFAULT_FILTERS });

  const brands = indexById(data.brands);
  const locs = indexById(data.locations);
  const ings = indexById(data.ingredients);
  const prods = indexById(data.products);
  const combos = indexById(data.combos);

  const lines = useMemo(() => filteredLines(data, filters), [data, filters]);
  const tot = useMemo(() => totals(lines), [lines]);
  const brandRows = useMemo(() => byBrand(filteredLines(data, { ...filters, brandId: 'all', locationId: 'all' })), [data, filters]);
  const series = useMemo(() => dailySeries(lines, filters.days), [lines, filters.days]);
  const stock = useMemo(() => stockRows(data, filters.brandId, filters.locationId), [data, filters]);
  const low = stock.filter((r) => r.low).sort((a, b) => a.qty / (a.parLevel || 1) - b.qty / (b.parLevel || 1));
  const stockValue = stock.reduce((s, r) => s + r.value, 0);
  const waste = useMemo(() => wasteCost(data, filters), [data, filters]);
  const top = useMemo(() => byItem(lines).sort((a, b) => b.profit - a.profit).slice(0, 6), [lines]);

  const target = filters.brandId !== 'all' ? brands.get(filters.brandId)?.targetFoodCost ?? 0.3 : weightedTarget();
  function weightedTarget() {
    const rev = brandRows.reduce((s, r) => s + r.revenue, 0);
    if (!rev) return 0.3;
    return brandRows.reduce((s, r) => s + (brands.get(r.key)?.targetFoodCost ?? 0.3) * r.revenue, 0) / rev;
  }

  const watch = useMemo(() => {
    const out: { id: string; name: string; brandId: string; fc: number; target: number; price: number; cost: number }[] = [];
    for (const p of data.products) {
      if (!p.active || (filters.brandId !== 'all' && p.brandId !== filters.brandId)) continue;
      const m = margin(p.price, productCost(p, ings));
      const tg = brands.get(p.brandId)?.targetFoodCost ?? 0.3;
      if (m.foodCostPct > tg) out.push({ id: p.id, name: n(p.name), brandId: p.brandId, fc: m.foodCostPct, target: tg, price: p.price, cost: m.cost });
    }
    for (const c of data.combos) {
      if (!c.active || (filters.brandId !== 'all' && c.brandId !== filters.brandId)) continue;
      const b = comboBreakdown(c, prods, ings);
      const tg = brands.get(c.brandId)?.targetFoodCost ?? 0.3;
      if (b.foodCostPct > tg) out.push({ id: c.id, name: n(c.name), brandId: c.brandId, fc: b.foodCostPct, target: tg, price: c.price, cost: b.cost });
    }
    return out.sort((a, b) => b.fc - b.target - (a.fc - a.target));
  }, [data, filters.brandId, n]);

  const itemName = (key: string) => {
    const [kind, id] = key.split(':');
    return n(kind === 'combo' ? combos.get(id)?.name : prods.get(id)?.name);
  };

  const chartMoney = (v: number) => money(v);
  const brandChart = brandRows.map((r) => ({ name: n(brands.get(r.key)?.name), revenue: r.revenue, cost: r.cost, color: brands.get(r.key)?.color }));

  return (
    <>
      <PageHeader title={t('dashTitle')} subtitle={t('dashSubtitle')} actions={<FilterBar filters={filters} onChange={setFilters} show={{ brand: true, location: true, days: true }} />} />

      <div className="kpis">
        <Kpi label={t('revenue')} value={money(tot.revenue)} hint={`${num(tot.orders, 0)} ${t('orders')}`} />
        <Kpi label={t('cogs')} value={money(tot.cost)} />
        <Kpi label={t('grossProfit')} value={money(tot.profit)} hint={`${t('marginPct')} ${pct(tot.marginPct)}`} tone="good" />
        <Kpi label={t('foodCostPct')} value={pct(tot.foodCostPct)} hint={t('vsTarget', { t: pct(target) })} tone={tot.foodCostPct <= target ? 'good' : 'bad'} />
        <Kpi label={t('stockValue')} value={money(stockValue)} />
        <Kpi label={t('lowStockItems')} value={num(low.length, 0)} tone={low.length ? 'warn' : 'good'} hint={`${t('wasteCost')}: ${money(waste)}`} />
      </div>

      <div className="grid-main">
        <Card title={t('revenueVsCost')}>
          <div className="chart">
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={series} margin={{ left: 8, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                <XAxis dataKey="day" tickFormatter={(d: string) => i.date(new Date(d + 'T12:00').getTime())} tick={{ fontSize: 11 }} stroke="var(--muted)" minTickGap={20} />
                <YAxis tickFormatter={chartMoney} tick={{ fontSize: 11 }} stroke="var(--muted)" width={80} />
                <Tooltip formatter={(v: number) => money(v)} labelFormatter={(d: string) => i.date(new Date(d + 'T12:00').getTime())} />
                <Legend />
                <Area isAnimationActive={false} type="monotone" dataKey="revenue" name={t('revenue')} stroke="var(--accent)" fill="url(#gRev)" strokeWidth={2} />
                <Area isAnimationActive={false} type="monotone" dataKey="cost" name={t('cost')} stroke="var(--bad)" fill="transparent" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title={t('lowStockAlerts')} actions={<Link to="/inventory" className="link">{t('viewAll')} →</Link>}>
          {low.length === 0 ? (
            <p className="muted">{t('noLowStock')}</p>
          ) : (
            <ul className="alert-list">
              {low.slice(0, 8).map((r) => {
                const ing = ings.get(r.ingredientId)!;
                return (
                  <li key={r.locationId + r.ingredientId}>
                    <div>
                      <strong>{n(ing.name)}</strong>
                      <div className="muted small">{n(locs.get(r.locationId)?.name)}</div>
                    </div>
                    <div className="right">
                      <Badge tone={r.qty <= 0 ? 'bad' : 'warn'}>{num(r.qty)} {ing.unit}</Badge>
                      <div className="muted small">{t('reorderLevel')}: {num(r.parLevel)}</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <Card title={t('brandPerformance')}>
        <div className="grid-2 align-start">
          <div className="chart">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={brandChart} margin={{ left: 8, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="var(--muted)" />
                <YAxis tickFormatter={chartMoney} tick={{ fontSize: 11 }} stroke="var(--muted)" width={80} />
                <Tooltip formatter={(v: number) => money(v)} />
                <Legend />
                <Bar isAnimationActive={false} dataKey="revenue" name={t('revenue')} fill="var(--accent)" radius={[4, 4, 0, 0]} />
                <Bar isAnimationActive={false} dataKey="cost" name={t('cost')} fill="var(--bad)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>{t('brand')}</th><th className="num">{t('revenue')}</th><th className="num">{t('grossProfit')}</th><th className="num">{t('foodCostPct')}</th></tr>
              </thead>
              <tbody>
                {brandRows.map((r) => {
                  const b = brands.get(r.key);
                  return (
                    <tr key={r.key}>
                      <td><span className="swatch" style={{ background: b?.color }} />{n(b?.name)}</td>
                      <td className="num">{money(r.revenue)}</td>
                      <td className="num">{money(r.profit)}</td>
                      <td className="num"><FoodCostBadge value={r.foodCostPct} target={b?.targetFoodCost ?? 0.3} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      <div className="grid-2 align-start">
        <Card title={t('topItems')}>
          {top.length === 0 ? <p className="muted">{t('noData')}</p> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>{t('item')}</th><th className="num">{t('unitsSold')}</th><th className="num">{t('profit')}</th><th className="num">{t('marginPct')}</th></tr></thead>
                <tbody>
                  {top.map((r) => (
                    <tr key={r.key}><td>{itemName(r.key)}</td><td className="num">{num(r.qty, 0)}</td><td className="num">{money(r.profit)}</td><td className="num">{pct(r.marginPct)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <Card title={t('watchList')} actions={<Link to="/menu" className="link">{t('viewAll')} →</Link>}>
          {watch.length === 0 ? <p className="muted">{t('noWatch')}</p> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>{t('item')}</th><th className="num">{t('price')}</th><th className="num">{t('cost')}</th><th className="num">{t('foodCostPct')}</th></tr></thead>
                <tbody>
                  {watch.slice(0, 8).map((w) => (
                    <tr key={w.id}>
                      <td>{w.name}<div className="muted small">{n(brands.get(w.brandId)?.name)} · {t('target')} {pct(w.target)}</div></td>
                      <td className="num">{money(w.price)}</td>
                      <td className="num">{money(w.cost)}</td>
                      <td className="num"><FoodCostBadge value={w.fc} target={w.target} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
