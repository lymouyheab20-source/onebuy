import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useI18n } from '../i18n';
import { useStore } from '../store/store';
import type { TKey } from '../i18n/en';

// 24x24 stroke icon paths.
const ICONS = {
  dashboard: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z',
  analytics: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  inventory: 'M3 7l9-4 9 4-9 4-9-4zM3 7v10l9 4 9-4V7M12 11v10',
  ingredients: 'M12 3c4 3 6 6 6 9a6 6 0 0 1-12 0c0-3 2-6 6-9zM12 21v-6',
  menu: 'M6 3v8a2 2 0 0 0 4 0V3M8 11v10M17 3c-2 2-2 6 0 8v10',
  combos: 'M4 4h7v7H4zM13 13h7v7h-7zM16.5 4v7M13 7.5h7M7.5 13v7M4 16.5h7',
  sales: 'M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6M10 21h.01M18 21h.01',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 14H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 3.1V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
};

const NAV: { to: string; key: TKey; icon: keyof typeof ICONS }[] = [
  { to: '/', key: 'navDashboard', icon: 'dashboard' },
  { to: '/analytics', key: 'navAnalytics', icon: 'analytics' },
  { to: '/inventory', key: 'navInventory', icon: 'inventory' },
  { to: '/ingredients', key: 'navIngredients', icon: 'ingredients' },
  { to: '/menu', key: 'navProducts', icon: 'menu' },
  { to: '/combos', key: 'navCombos', icon: 'combos' },
  { to: '/sales', key: 'navSales', icon: 'sales' },
  { to: '/settings', key: 'navSettings', icon: 'settings' },
];

function Icon({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={ICONS[name]} />
    </svg>
  );
}

export function Layout() {
  const { data, updateSettings, lastChange } = useStore();
  const { t, lang, dateTime } = useI18n();
  const [open, setOpen] = useState(false);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    setPulse(true);
    const id = setTimeout(() => setPulse(false), 800);
    return () => clearTimeout(id);
  }, [lastChange]);

  return (
    <div className={`app lang-${lang}`}>
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand-mark">
          <div className="logo">OB</div>
          <div>
            <div className="app-name">{t('appName')}</div>
            <div className="app-tag">{t('appTagline')}</div>
          </div>
        </div>
        <nav>
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} onClick={() => setOpen(false)}>
              <Icon name={item.icon} />
              {t(item.key)}
            </NavLink>
          ))}
        </nav>
      </aside>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}

      <div className="main">
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setOpen(true)} aria-label="menu">☰</button>
          <div className={`live ${pulse ? 'pulse' : ''}`} title={t('updatedAt', { time: dateTime(lastChange) })}>
            <span className="dot" /> {t('live')} · {t('updatedAt', { time: dateTime(lastChange) })}
          </div>
          <div className="topbar-right">
            <div className="seg" role="group" aria-label={t('currency')}>
              {(['USD', 'KHR'] as const).map((c) => (
                <button key={c} className={data.settings.currency === c ? 'on' : ''} onClick={() => updateSettings({ currency: c })}>
                  {c}
                </button>
              ))}
            </div>
            <div className="seg" role="group" aria-label={t('language')}>
              <button className={lang === 'en' ? 'on' : ''} onClick={() => updateSettings({ lang: 'en' })}>EN</button>
              <button className={`km ${lang === 'km' ? 'on' : ''}`} onClick={() => updateSettings({ lang: 'km' })}>ខ្មែរ</button>
            </div>
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
