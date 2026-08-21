import { useState, type FormEvent, type ReactNode } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';

import { ApiError } from '../api/client';
import { useAuth } from '../auth/AuthProvider';
import { formText } from '../utils/format';
import {
  portfolioDemoPassword,
  portfolioDemoUsername,
  portfolioReadonly,
} from '../config/portfolio';

function BrandMark(): ReactNode {
  return (
    <svg className="fem-login__horse-mark" viewBox="0 0 64 64" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M14 55c7.8-7.4 11.5-16.2 10.8-26.3L19.4 14c-.6-1.7 1.3-3 2.7-1.9l9.3 7.1 2.4-10.1c.4-1.7 2.6-2.1 3.6-.7l8.9 12.5c4.8 5.6 7.4 12.9 7.7 21.8-4.7-2.7-9.2-4-13.5-4-4.4 0-7.5 1.7-9.3 5.1 2.4 4.5 6.7 7.2 12.8 8.2L14 55Zm27.1-29.6a1.7 1.7 0 1 0 3.4 0 1.7 1.7 0 0 0-3.4 0Z"
        clipRule="evenodd"
      />
      <path d="M29.5 23.5c4.6-2.8 9.7-3.4 15.2-1.7M28.1 29.5c5-2.2 10.2-2.1 15.5.2" />
    </svg>
  );
}

function EnvelopeIcon(): ReactNode {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 6.5h16v11H4z" />
      <path d="m5 8 7 5 7-5" />
    </svg>
  );
}

function LockIcon(): ReactNode {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4.5" y="10" width="15" height="10" rx="3" />
      <path d="M8 10V7.5a4 4 0 0 1 8 0V10M12 14v2.5" />
    </svg>
  );
}

function KeyIcon(): ReactNode {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="8.5" cy="12" r="4" />
      <path d="M12.5 12H21M17 12v3M20 12v2" />
    </svg>
  );
}

function EyeIcon({ hidden }: { readonly hidden: boolean }): ReactNode {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 12s3.3-5 9-5 9 5 9 5-3.3 5-9 5-9-5-9-5Z" />
      <circle cx="12" cy="12" r="2.6" />
      {hidden ? <path d="m4 4 16 16" /> : null}
    </svg>
  );
}

export function LoginPage(): ReactNode {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [showPassword, setShowPassword] = useState(false);

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
      await login({ email, password, ...(otp ? { otp } : {}) });
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
    <main className="fem-login" id="main-content">
      <a className="fem-login__skip" href="#login-email">
        Перейти к форме входа
      </a>
      <div className="fem-login__dotgrid" aria-hidden="true" />
      <div className="fem-login__blob fem-login__blob--sky" aria-hidden="true" />
      <div className="fem-login__blob fem-login__blob--coral" aria-hidden="true" />

      <header className="fem-login__nav">
        <div className="fem-login__brand">
          <span className="fem-login__brand-mark">
            <BrandMark />
          </span>
          <span>
            <strong>FEM</strong>
            <small>Federația Ecvestră din Moldova</small>
          </span>
        </div>
        <div className="fem-login__nav-status">
          <span aria-hidden="true" />
          Защищённый доступ
        </div>
      </header>

      <div className="fem-login__hero">
        <section className="fem-login__intro" aria-labelledby="fem-login-heading">
          <div className="fem-login__badge">
            <span aria-hidden="true">✦</span>
            Информационная платформа Федерации
          </div>
          <h1 id="fem-login-heading" aria-label="База данных конного спорта Молдовы.">
            База данных
            <span> конного спорта Молдовы.</span>
            <svg className="fem-login__underline" viewBox="0 0 360 28" aria-hidden="true">
              <path d="M7 18c72-10 167-13 346-5-94 0-190 3-284 11" />
            </svg>
          </h1>
          <p className="fem-login__lead">Платформа для управления базой данных FEM.</p>
          <ul className="fem-login__benefits" aria-label="Возможности реестра">
            <li>
              <span>✓</span>История данных сохраняется
            </li>
            <li>
              <span>✓</span>Изменения проходят аудит
            </li>
            <li>
              <span>✓</span>Доступ защищён двухфакторной проверкой
            </li>
          </ul>
          <div className="fem-login__proof">
            <div className="fem-login__proof-marks" aria-hidden="true">
              <span>СП</span>
              <span>ЛШ</span>
              <span>РЗ</span>
            </div>
            <p>
              <strong>Один реестр.</strong> Точные связи между ключевыми данными.
            </p>
          </div>
        </section>

        <div className="fem-login__card-wrap">
          <div className="fem-login__halo" aria-hidden="true" />
          <section className="fem-login__card" aria-labelledby="login-title">
            <aside className="fem-login__aside">
              <div className="fem-login__aside-orbit" aria-hidden="true" />
              <div className="fem-login__aside-top">
                <span className="fem-login__aside-mark">
                  <BrandMark />
                </span>
              </div>
              <div className="fem-login__aside-visual" aria-hidden="true">
                <span className="fem-login__sun" />
                <span className="fem-login__horizon" />
                <BrandMark />
              </div>
              <div className="fem-login__aside-copy">
                <strong>Управление данными FEM</strong>
                <span>Спортсмены. Лошади. Соревнования.</span>
              </div>
            </aside>

            <div className="fem-login__form-panel">
              <div className="fem-login__form-heading">
                <div>
                  <span className="fem-login__kicker">С возвращением</span>
                  <h2 id="login-title">Войти в реестр</h2>
                </div>
                <span className="fem-login__smile" aria-hidden="true">
                  ⌣
                </span>
              </div>
              <p className="fem-login__form-copy">
                {portfolioReadonly
                  ? 'Демо-доступ открыт только для просмотра данных.'
                  : 'Введите email, пароль и актуальный код приложения 2FA.'}
              </p>
              {portfolioReadonly ? (
                <div className="fem-login__demo-credentials" role="note">
                  <strong>Данные для просмотра</strong>
                  <span>Логин: {portfolioDemoUsername}</span>
                  <span>Пароль: {portfolioDemoPassword}</span>
                </div>
              ) : null}

              {error ? (
                <div className="fem-login__error" role="alert" aria-live="assertive">
                  <span aria-hidden="true">!</span>
                  <div>
                    <strong>{error.message}</strong>
                    {error.requestId ? <small>Код обращения: {error.requestId}</small> : null}
                  </div>
                </div>
              ) : null}

              <form onSubmit={(event) => void handleSubmit(event)}>
                <fieldset className="fem-login__fieldset" disabled={busy}>
                  <div className="fem-login__field">
                    <label htmlFor="login-email">{portfolioReadonly ? 'Логин' : 'Email'}</label>
                    <span className="fem-login__input">
                      <i>
                        <EnvelopeIcon />
                      </i>
                      <input
                        id="login-email"
                        name="email"
                        type={portfolioReadonly ? 'text' : 'email'}
                        autoComplete="username"
                        placeholder={portfolioReadonly ? portfolioDemoUsername : 'admin@fem.md'}
                        autoFocus
                        required
                      />
                    </span>
                  </div>

                  {!portfolioReadonly ? (
                    <div className="fem-login__field">
                      <label htmlFor="login-password">Пароль</label>
                      <span className="fem-login__input">
                        <i>
                          <LockIcon />
                        </i>
                        <input
                          id="login-password"
                          name="password"
                          type={showPassword ? 'text' : 'password'}
                          autoComplete="current-password"
                          placeholder="Введите пароль"
                          required
                        />
                        <button
                          className="fem-login__reveal"
                          type="button"
                          aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                          aria-pressed={showPassword}
                          onClick={() => setShowPassword((current) => !current)}
                        >
                          <EyeIcon hidden={showPassword} />
                        </button>
                      </span>
                    </div>
                  ) : null}

                  <div className="fem-login__field">
                    <label className="fem-login__field-label" htmlFor="login-otp">
                      Код 2FA
                      <small>6 цифр</small>
                    </label>
                    <span className="fem-login__input">
                      <i>
                        <KeyIcon />
                      </i>
                      <input
                        id="login-otp"
                        name="otp"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        pattern="[0-9]{6}"
                        maxLength={6}
                        placeholder="000 000"
                        required
                      />
                    </span>
                  </div>

                  <button className="fem-login__submit" type="submit">
                    <span>{busy ? 'Проверяем доступ…' : 'Продолжить'}</span>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  </button>
                </fieldset>
              </form>

              <div className="fem-login__security">
                <span aria-hidden="true">✓</span>
                <p>
                  <strong>Защищённая сессия</strong>Пароль и код не сохраняются в браузере.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>

      <footer className="fem-login__footer">
        <span>© 2026 Federația Ecvestră din Moldova</span>
      </footer>
    </main>
  );
}
