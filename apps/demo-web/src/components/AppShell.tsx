import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';

import { useAuth } from '../auth/AuthProvider';
import { Button } from './Button';

const navigation = [
  { to: '/athletes', label: 'Спортсмены' },
  { to: '/horses', label: 'Лошади' },
  { to: '/competitions', label: 'Соревнования' },
] as const;

export function AppShell(): ReactNode {
  const { logout } = useAuth();
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
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div>
            <p className="topbar__context">Платформа управления данными</p>
            <strong>Администратор FEM</strong>
          </div>
          <Button variant="quiet" onClick={() => void handleLogout()}>
            Выйти
          </Button>
        </header>
        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
