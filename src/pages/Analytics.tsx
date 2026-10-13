import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useStore } from '../store/store';
import { useI18n } from '../i18n';
import { byBrand, byCategory, byItem, byLocation, DEFAULT_FILTERS, filteredLines, totals, wasteCost, type Filters, type Row } from '../lib/analytics';
import { indexById } from '../lib/costing';
import { Card, downloadFile, FilterBar, FoodCostBadge, Kpi, PageHeader, toCsv } from '../components/ui';
import type { TKey } from '../i18n/en';

type Dim = 'brand' | 'location' | 'category' | 'item';
const DIMS: { id: Dim; key: TKey }[] = [
  { id: 'brand', key: 'byBrand' },
  { id: 'location', key: 'byLocation' },
  { id: 'category', key: 'byCategory' },
  { id: 'item', key: 'byItem' },
];

export function Analytics() {
  const { data } = useStore();
  const { t, n, money, pct, num } = useI18n();
  const [filters, setFilters] = useState<Filters>({ ...DEFAULT_FILTERS });
  const [dim, setDim] = useState<Dim>('brand');

  const brands = indexById(data.brands);
  const locs = indexById(data.locations);
  const cats = indexById(data.categories);
  const prods = indexById(data.products);
  const combos = indexById(data.combos);

  const lines = useMemo(() => filteredLines(data, filters), [data, filters]);
  const tot = useMemo(() => totals(lines), [lines]);
  const waste = useMemo(() => wasteCost(data, filters), [data, filters]);
  const rows: Row[] = useMemo(() => {
    switch (dim) {
      case 'brand': return byBrand(lines);
      case 'location': return byLocation(lines);
      case 'category': return byCategory(lines);
      case 'item': return byItem(lines);
    }
  }, [dim, lines]);

  /** Target used to colour a row: the brand's own target where the row maps to one brand. */
  const targetFor = (key: string): number => {
    if (dim === 'brand') return brands.get(key)?.targetFoodCost ?? 0.3;
    if (dim === 'location') return brands.get(locs.get(key)?.brandId ?? '')?.targetFoodCost ?? 0.3;
    if (dim === 'item') {
      const [kind, id] = key.split(':');
      const b = kind === 'combo' ? combos.get(id)?.brandId : prods.get(id)?.brandId;
      return brands.get(b ?? '')?.targetFoodCost ?? 0.3;
    }
    return filters.brandId !== 'all' ? brands.get(filters.brandId)?.targetFoodCost ?? 0.3 : 0.3;
  };

  const label = (key: string): string => {
    if (dim === 'brand') return n(brands.get(key)?.name);
    if (dim === 'location') {
      const l = locs.get(key);
      return `${n(l?.name)} · ${n(brands.get(l?.brandId ?? '')?.name)}`;
    }
    if (dim === 'category') return n(cats.get(key)?.name);
    const [kind, id] = key.split(':');
    return n(kind === 'combo' ? combos.get(id)?.name : prods.get(id)?.name);
  };

  const chartData = rows.slice(0, 12).map((r) => ({ name: label(r.key), fc: r.foodCostPct * 100, target: targetFor(r.key) * 100 }));

  const exportCsv = () => {
    const header = [t(DIMS.find((d) => d.id === dim)!.key), t('unitsSold'), t('revenue'), t('cogs'), t('grossProfit'), t('foodCostPct'), t('marginPct')];
    const body = rows.map((r) => [label(r.key), r.qty, r.revenue.toFixed(2), r.cost.toFixed(2), r.profit.toFixed(2), (r.foodCostPct * 100).toFixed(1), (r.marginPct * 100).toFixed(1)]);
    downloadFile(`onebuy-${dim}-${filters.days}d.csv`, toCsv([header, ...body]), 'text/csv;charset=utf-8');
  };

  return (
    <>
      <PageHeader title={t('analyticsTitle')} subtitle={t('analyticsSubtitle')} />
      <Card>
        <FilterBar filters={filters} onChange={setFilters} />
      </Card>

      <div className="kpis">
        <Kpi label={t('revenue')} value={money(tot.revenue)} hint={`${num(tot.orders, 0)} ${t('orders')}`} />
        <Kpi label={t('cogs')} value={money(tot.cost)} />
        <Kpi label={t('grossProfit')} value={money(tot.profit)} tone="good" />
        <Kpi label={t('foodCostPct')} value={pct(tot.foodCostPct)} />
        <Kpi label={t('avgTicket')} value={money(tot.orders ? tot.revenue / tot.orders : 0)} />
        <Kpi label={t('wasteCost')} value={money(waste)} tone={waste > 0 ? 'warn' : undefined} />
      </div>

      <Card
        title={
          <div className="tabs">
            {DIMS.map((d) => (
              <button key={d.id} className={dim === d.id ? 'on' : ''} onClick={() => setDim(d.id)}>{t(d.key)}</button>
            ))}
          </div>
        }
        actions={<button className="btn ghost" onClick={exportCsv}>⇩ {t('exportCsv')}</button>}
      >
        {rows.length === 0 ? <p className="muted">{t('noData')}</p> : (
          <>
            <div className="chart">
              <ResponsiveContainer width="100%" height={Math.max(160, chartData.length * 30)}>
                <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" horizontal={false} />
                  <XAxis type="number" unit="%" tick={{ fontSize: 11 }} stroke="var(--muted)" />
                  <YAxis type="category" dataKey="name" width={170} tick={{ fontSize: 11 }} stroke="var(--muted)" />
                  <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
                  <Bar isAnimationActive={false} dataKey="fc" name={t('foodCostPct')} radius={[0, 4, 4, 0]}>
                    {chartData.map((d, idx) => (
                      <Cell key={idx} fill={d.fc <= d.target ? 'var(--good)' : d.fc <= d.target + 5 ? 'var(--warn)' : 'var(--bad)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t(DIMS.find((d) => d.id === dim)!.key)}</th>
                    <th className="num">{t('unitsSold')}</th>
                    <th className="num">{t('revenue')}</th>
                    <th className="num">{t('cogs')}</th>
                    <th className="num">{t('grossProfit')}</th>
                    <th className="num">{t('foodCostPct')}</th>
                    <th className="num">{t('marginPct')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.key}>
                      <td>{label(r.key)}</td>
                      <td className="num">{num(r.qty, 0)}</td>
                      <td className="num">{money(r.revenue)}</td>
                      <td className="num">{money(r.cost)}</td>
                      <td className="num">{money(r.profit)}</td>
                      <td className="num"><FoodCostBadge value={r.foodCostPct} target={targetFor(r.key)} /></td>
                      <td className="num">{pct(r.marginPct)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td>{t('total')}</td>
                    <td className="num">{num(tot.qty, 0)}</td>
                    <td className="num">{money(tot.revenue)}</td>
                    <td className="num">{money(tot.cost)}</td>
                    <td className="num">{money(tot.profit)}</td>
                    <td className="num">{pct(tot.foodCostPct)}</td>
                    <td className="num">{pct(tot.marginPct)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </Card>
    </>
  );
}
