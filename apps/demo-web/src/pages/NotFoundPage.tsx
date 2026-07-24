import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export function NotFoundPage(): ReactNode {
  return (
    <section className="state-panel">
      <p className="state-panel__eyebrow">404</p>
      <h1>Страница не найдена</h1>
      <p>Проверьте адрес или вернитесь к реестру спортсменов.</p>
      <Link className="button button--primary button--default" to="/athletes">
        К спортсменам
      </Link>
    </section>
  );
}
