import { useState, type FormEvent, type ReactNode } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';

import { ApiError } from '../api/client';
import { useAuth } from '../auth/AuthProvider';
import { Button } from '../components/Button';
import { FormField } from '../components/FormField';
import { formText } from '../utils/format';

export function LoginPage(): ReactNode {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  if (user) return <Navigate to="/athletes" replace />;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const email = formText(form, 'email').trim();
    const password = formText(form, 'password');
    const otp = formText(form, 'otp').trim();
    try {
      await login({ email, password, otp });
      const navigationState: unknown = location.state;
      const from =
        typeof navigationState === 'object' &&
        navigationState !== null &&
        'from' in navigationState &&
        typeof navigationState.from === 'string'
          ? navigationState.from
          : '/athletes';
      await navigate(from, { replace: true });
    } catch (reason) {
      setError(reason instanceof ApiError ? reason : new ApiError(503));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-intro">
        <p className="eyebrow">Национальная федерация · Молдова</p>
        <h1>Спортивные данные, собранные в одном точном реестре.</h1>
        <p>Демонстрационный контур для спортсменов, лошадей, соревнований и результатов.</p>
        <div className="login-intro__rule">
          <span>FEM</span>
          <span>DEMO / 2026</span>
        </div>
      </section>
      <section className="login-card" aria-labelledby="login-title">
        <p className="eyebrow">Защищённый доступ</p>
        <h2 id="login-title">Войти в реестр</h2>
        <p>Используйте выданную demo-учётную запись и код приложения-аутентификатора.</p>
        {error ? (
          <div className="form-error" role="alert">
            <strong>{error.message}</strong>
            {error.requestId ? <span>Код обращения: {error.requestId}</span> : null}
          </div>
        ) : null}
        <form onSubmit={(event) => void handleSubmit(event)}>
          <FormField label="Email" htmlFor="email">
            <input id="email" name="email" type="email" autoComplete="username" required />
          </FormField>
          <FormField label="Пароль" htmlFor="password">
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </FormField>
          <FormField label="Одноразовый код" htmlFor="otp" hint="6 цифр из приложения 2FA">
            <input
              id="otp"
              name="otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
            />
          </FormField>
          <Button type="submit" busy={busy}>
            Войти
          </Button>
        </form>
        <p className="login-card__security">Пароль и код не сохраняются в браузере.</p>
      </section>
    </main>
  );
}
