import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';

import { useAuth } from '../auth/AuthProvider';
import { Button } from './Button';

const navigation = [
  { to: '/athletes', label: 'Спортсмены', code: '01' },
  { to: '/horses', label: 'Лошади', code: '02' },
  { to: '/competitions', label: 'Соревнования', code: '03' },
] as const;

export function AppShell(): ReactNode {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async (): Promise<void> => {
    await logout();
    await navigate('/login', { replace: true, state: { from: location.pathname } });
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand__mark" aria-hidden="true">
            FEM
          </div>
          <div>
            <strong>Федерация конного спорта</strong>
            <span>Республика Молдова</span>
          </div>
        </div>
        <nav className="primary-nav" aria-label="Основная навигация">
          {navigation.map((item) => (
            <NavLink key={item.to} to={item.to}>
              <span>{item.code}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar__note">
          <span className="signal-dot" aria-hidden="true" />
          <div>
            <strong>Демо-прототип</strong>
            <p>Только вымышленные данные</p>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div>
            <p className="topbar__context">Внутренний инструмент учёта</p>
            <strong>{user?.displayName}</strong>
          </div>
          <Button variant="quiet" onClick={() => void handleLogout()}>
            Выйти
          </Button>
        </header>
        <div className="demo-banner" role="note">
          <strong>Демо-прототип.</strong> Данные вымышлены; справочники категорий предварительные.
        </div>
        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
