import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

import { useAuth } from '../auth/AuthProvider';
import { AppShell } from '../components/AppShell';
import { LoadingState } from '../components/PageState';
import { AthleteDetailPage } from '../pages/AthleteDetailPage';
import { AthletesPage } from '../pages/AthletesPage';
import { CompetitionDetailPage } from '../pages/CompetitionDetailPage';
import { CompetitionsPage } from '../pages/CompetitionsPage';
import { HorseDetailPage } from '../pages/HorseDetailPage';
import { HorsesPage } from '../pages/HorsesPage';
import { LoginPage } from '../pages/LoginPage';
import { NotFoundPage } from '../pages/NotFoundPage';

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
  );
}
