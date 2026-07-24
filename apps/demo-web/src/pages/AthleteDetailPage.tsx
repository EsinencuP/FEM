import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';

import { apiRequest } from '../api/client';
import type {
  Athlete,
  AthleteDetail,
  DataResponse,
  RecordStatus,
  UpdateAthletePayload,
} from '../api/contracts';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Drawer } from '../components/Drawer';
import { FormFeedback } from '../components/FormFeedback';
import { FormField } from '../components/FormField';
import { PageHeader } from '../components/PageHeader';
import { ErrorState, LoadingState } from '../components/PageState';
import { useApi } from '../hooks/useApi';
import { useLookups } from '../hooks/useLookups';
import { displayValue, formText, formatDate } from '../utils/format';

export function AthleteDetailPage(): ReactNode {
  const { id = '' } = useParams();
  const athlete = useApi(
    () => apiRequest<DataResponse<AthleteDetail>>(`/admin/athletes/${id}`),
    [id],
  );
  const lookups = useLookups();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<unknown>(null);

  if (athlete.loading) return <LoadingState />;
  if (athlete.error || !athlete.data) {
    return (
      <ErrorState
        error={athlete.error ?? new Error('Спортсмен не найден.')}
        onRetry={athlete.reload}
      />
    );
  }
  const item = athlete.data.data;

  const update = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setSaving(true);
    setFormError(null);
    const form = new FormData(event.currentTarget);
    const countryId = formText(form, 'countryId');
    const payload: UpdateAthletePayload = {
      firstName: formText(form, 'firstName').trim(),
      lastName: formText(form, 'lastName').trim(),
      displayName: formText(form, 'displayName').trim(),
      status: (formText(form, 'status') || 'ACTIVE') as RecordStatus,
      countryId: countryId || null,
    };
    try {
      await apiRequest<DataResponse<Athlete>>(`/admin/athletes/${id}`, {
        method: 'PATCH',
        body: payload,
        version: item.version,
      });
      setEditing(false);
      athlete.reload();
    } catch (error) {
      setFormError(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Link className="back-link" to="/athletes">
        ← К реестру спортсменов
      </Link>
      <PageHeader
        eyebrow="Карточка спортсмена"
        title={item.displayName}
        description={`${item.country?.name ?? 'Страна не указана'} · обновлено ${formatDate(item.updatedAt)}`}
        action={<Button onClick={() => setEditing(true)}>Редактировать</Button>}
      />
      <section className="detail-grid">
        <article className="detail-card detail-card--primary">
          <div className="detail-card__heading">
            <h2>Основные данные</h2>
            <Badge value={item.status} />
          </div>
          <dl className="definition-list">
            <div>
              <dt>Имя</dt>
              <dd>{item.firstName}</dd>
            </div>
            <div>
              <dt>Фамилия</dt>
              <dd>{item.lastName}</dd>
            </div>
            <div>
              <dt>Федерация</dt>
              <dd>{item.nationalFederation?.name ?? '—'}</dd>
            </div>
            <div>
              <dt>Публичность</dt>
              <dd>
                <Badge value={item.publicationStatus} />
              </dd>
            </div>
          </dl>
        </article>
        <article className="detail-card">
          <h2>Текущие клубы</h2>
          {item.clubMemberships.filter(({ endDate }) => !endDate).length ? (
            <ul className="relation-list">
              {item.clubMemberships
                .filter(({ endDate }) => !endDate)
                .map((membership) => (
                  <li key={membership.id}>
                    <strong>{membership.club?.name ?? 'Клуб не указан'}</strong>
                    <span>с {formatDate(membership.startDate)}</span>
                  </li>
                ))}
            </ul>
          ) : (
            <p className="muted">Текущих клубов нет.</p>
          )}
        </article>
        <article className="detail-card">
          <h2>Связанные лошади</h2>
          {item.horseRelations.length ? (
            <ul className="relation-list">
              {item.horseRelations.slice(0, 8).map((relation) => (
                <li key={relation.id}>
                  {relation.horse ? (
                    <Link to={`/horses/${relation.horse.id}`}>{relation.horse.displayName}</Link>
                  ) : (
                    '—'
                  )}
                  <span>{displayValue(relation.relationType)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Связей с лошадьми нет.</p>
          )}
        </article>
        <article className="detail-card">
          <h2>Идентификаторы</h2>
          {item.externalIdentifiers.length ? (
            <ul className="relation-list">
              {item.externalIdentifiers.map((identifier) => (
                <li key={identifier.id}>
                  <strong>{identifier.value}</strong>
                  <span>
                    {identifier.namespace} · {identifier.identifierType}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Коды не добавлены.</p>
          )}
        </article>
        <article className="detail-card detail-card--wide">
          <h2>Последние результаты</h2>
          {item.competitionResults.length ? (
            <div className="compact-results">
              {item.competitionResults.slice(0, 10).map((result) => (
                <div key={result.id}>
                  <strong>
                    {result.competitionClass?.competitionEvent.title ?? 'Соревнование'}
                  </strong>
                  <span>{result.competitionClass?.title ?? 'Класс'}</span>
                  <span>
                    {result.rank
                      ? `${result.rank} место`
                      : (result.status?.label ?? displayValue(result.resultDisplay))}
                  </span>
                  <span>
                    {result.horse ? (
                      <Link to={`/horses/${result.horse.id}`}>{result.horse.displayName}</Link>
                    ) : (
                      '—'
                    )}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">Результатов пока нет.</p>
          )}
        </article>
      </section>
      <Drawer open={editing} title="Редактировать спортсмена" onClose={() => setEditing(false)}>
        <FormFeedback error={formError} />
        <form className="form-grid" onSubmit={(event) => void update(event)}>
          <FormField label="Имя" htmlFor="edit-athlete-first">
            <input
              id="edit-athlete-first"
              name="firstName"
              defaultValue={item.firstName}
              maxLength={120}
              required
            />
          </FormField>
          <FormField label="Фамилия" htmlFor="edit-athlete-last">
            <input
              id="edit-athlete-last"
              name="lastName"
              defaultValue={item.lastName}
              maxLength={120}
              required
            />
          </FormField>
          <FormField label="Отображаемое имя" htmlFor="edit-athlete-display">
            <input
              id="edit-athlete-display"
              name="displayName"
              defaultValue={item.displayName}
              maxLength={240}
              required
            />
          </FormField>
          <FormField label="Страна" htmlFor="edit-athlete-country">
            <select id="edit-athlete-country" name="countryId" defaultValue={item.countryId ?? ''}>
              <option value="">Не указана</option>
              {lookups.data?.countries.map((country) => (
                <option key={country.id} value={country.id}>
                  {country.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Статус" htmlFor="edit-athlete-status">
            <select id="edit-athlete-status" name="status" defaultValue={item.status}>
              <option value="ACTIVE">ACTIVE</option>
              <option value="DRAFT">DRAFT</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>
          </FormField>
          <div className="form-actions">
            <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
              Отмена
            </Button>
            <Button type="submit" busy={saving}>
              Сохранить
            </Button>
          </div>
        </form>
      </Drawer>
    </>
  );
}
