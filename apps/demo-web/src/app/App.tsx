import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';

import { useAuth } from '../auth/AuthProvider';
import { LoadingState } from '../components/PageState';
import { LoginPage } from '../pages/LoginPage';

const AppShell = lazy(async () => {
  const module = await import('../components/AppShell');
  return { default: module.AppShell };
});

const AthleteDetailPage = lazy(async () => {
  const module = await import('../pages/AthleteDetailPage');
  return { default: module.AthleteDetailPage };
});

const AthletesPage = lazy(async () => {
  const module = await import('../pages/AthletesPage');
  return { default: module.AthletesPage };
});

const CompetitionDetailPage = lazy(async () => {
  const module = await import('../pages/CompetitionDetailPage');
  return { default: module.CompetitionDetailPage };
});

const CompetitionsPage = lazy(async () => {
  const module = await import('../pages/CompetitionsPage');
  return { default: module.CompetitionsPage };
});

const HorseDetailPage = lazy(async () => {
  const module = await import('../pages/HorseDetailPage');
  return { default: module.HorseDetailPage };
});

const HorsesPage = lazy(async () => {
  const module = await import('../pages/HorsesPage');
  return { default: module.HorsesPage };
});

const NotFoundPage = lazy(async () => {
  const module = await import('../pages/NotFoundPage');
  return { default: module.NotFoundPage };
});

function ProtectedLayout(): ReactNode {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <LoadingState label="Проверяем защищённую сессию…" />;
  if (!user)
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <AppShell />;
}

export function App(): ReactNode {
  return (
    <Suspense fallback={<LoadingState label="Загружаем рабочее пространство…" />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedLayout />}>
          <Route index element={<Navigate to="/athletes" replace />} />
          <Route path="/athletes" element={<AthletesPage />} />
          <Route path="/athletes/:id" element={<AthleteDetailPage />} />
          <Route path="/horses" element={<HorsesPage />} />
          <Route path="/horses/:id" element={<HorseDetailPage />} />
          <Route path="/competitions" element={<CompetitionsPage />} />
          <Route path="/competitions/:id" element={<CompetitionDetailPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
