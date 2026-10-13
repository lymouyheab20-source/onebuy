import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { StoreProvider } from './store/store';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Analytics } from './pages/Analytics';
import { Inventory } from './pages/Inventory';
import { Ingredients } from './pages/Ingredients';
import { Products } from './pages/Products';
import { Combos } from './pages/Combos';
import { Sales } from './pages/Sales';
import { Settings } from './pages/Settings';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      {/* Hash routing so the build works from any static host without rewrites. */}
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="ingredients" element={<Ingredients />} />
            <Route path="menu" element={<Products />} />
            <Route path="combos" element={<Combos />} />
            <Route path="sales" element={<Sales />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<Dashboard />} />
          </Route>
        </Routes>
      </HashRouter>
    </StoreProvider>
  </StrictMode>,
);
