import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';

import { apiRequest } from '../api/client';
import type {
  DataResponse,
  Horse,
  HorseDetail,
  RecordStatus,
  UpdateHorsePayload,
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

export function HorseDetailPage(): ReactNode {
  const { id = '' } = useParams();
  const horse = useApi(() => apiRequest<DataResponse<HorseDetail>>(`/admin/horses/${id}`), [id]);
  const lookups = useLookups();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<unknown>(null);

  if (horse.loading) return <LoadingState />;
  if (horse.error || !horse.data)
    return (
      <ErrorState error={horse.error ?? new Error('Лошадь не найдена.')} onRetry={horse.reload} />
    );
  const item = horse.data.data;

  const update = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setSaving(true);
    setFormError(null);
    const form = new FormData(event.currentTarget);
    const birthYear = formText(form, 'birthYear').trim();
    const payload: UpdateHorsePayload = {
      displayName: formText(form, 'displayName').trim(),
      passportName: formText(form, 'passportName').trim() || null,
      sex: formText(form, 'sex').trim() || null,
      breed: formText(form, 'breed').trim() || null,
      color: formText(form, 'color').trim() || null,
      birthYear: birthYear ? Number(birthYear) : null,
      countryOfBirthId: formText(form, 'countryOfBirthId') || null,
      status: (formText(form, 'status') || 'ACTIVE') as RecordStatus,
    };
    try {
      await apiRequest<DataResponse<Horse>>(`/admin/horses/${id}`, {
        method: 'PATCH',
        body: payload,
        version: item.version,
      });
      setEditing(false);
      horse.reload();
    } catch (error) {
      setFormError(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Link className="back-link" to="/horses">
        ← К реестру лошадей
      </Link>
      <PageHeader
        eyebrow="Карточка лошади"
        title={item.displayName}
        description={`${item.countryOfBirth?.name ?? 'Страна не указана'} · обновлено ${formatDate(item.updatedAt)}`}
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
              <dt>Паспортное имя</dt>
              <dd>{displayValue(item.passportName)}</dd>
            </div>
            <div>
              <dt>Пол</dt>
              <dd>{displayValue(item.sex)}</dd>
            </div>
            <div>
              <dt>Порода</dt>
              <dd>{displayValue(item.breed)}</dd>
            </div>
            <div>
              <dt>Масть</dt>
              <dd>{displayValue(item.color)}</dd>
            </div>
            <div>
              <dt>Год рождения</dt>
              <dd>{displayValue(item.birthYear)}</dd>
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
          <h2>Связанные спортсмены</h2>
          {item.athleteRelations.length ? (
            <ul className="relation-list">
              {item.athleteRelations.slice(0, 8).map((relation) => (
                <li key={relation.id}>
                  {relation.athlete ? (
                    <Link to={`/athletes/${relation.athlete.id}`}>
                      {relation.athlete.displayName}
                    </Link>
                  ) : (
                    '—'
                  )}
                  <span>{displayValue(relation.relationType)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Связей со спортсменами нет.</p>
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
                    {result.athlete ? (
                      <Link to={`/athletes/${result.athlete.id}`}>
                        {result.athlete.displayName}
                      </Link>
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
      <Drawer open={editing} title="Редактировать лошадь" onClose={() => setEditing(false)}>
        <FormFeedback error={formError} />
        <form className="form-grid" onSubmit={(event) => void update(event)}>
          <FormField label="Отображаемое имя" htmlFor="edit-horse-display">
            <input
              id="edit-horse-display"
              name="displayName"
              defaultValue={item.displayName}
              maxLength={240}
              required
            />
          </FormField>
          <FormField label="Паспортное имя" htmlFor="edit-horse-passport">
            <input
              id="edit-horse-passport"
              name="passportName"
              defaultValue={item.passportName ?? ''}
              maxLength={240}
            />
          </FormField>
          <FormField label="Пол" htmlFor="edit-horse-sex">
            <input id="edit-horse-sex" name="sex" defaultValue={item.sex ?? ''} maxLength={80} />
          </FormField>
          <FormField label="Порода" htmlFor="edit-horse-breed">
            <input
              id="edit-horse-breed"
              name="breed"
              defaultValue={item.breed ?? ''}
              maxLength={160}
            />
          </FormField>
          <FormField label="Масть" htmlFor="edit-horse-color">
            <input
              id="edit-horse-color"
              name="color"
              defaultValue={item.color ?? ''}
              maxLength={120}
            />
          </FormField>
          <FormField label="Год рождения" htmlFor="edit-horse-year">
            <input
              id="edit-horse-year"
              name="birthYear"
              type="number"
              min={1000}
              max={2100}
              defaultValue={item.birthYear ?? ''}
            />
          </FormField>
          <FormField label="Страна рождения" htmlFor="edit-horse-country">
            <select
              id="edit-horse-country"
              name="countryOfBirthId"
              defaultValue={item.countryOfBirthId ?? ''}
            >
              <option value="">Не указана</option>
              {lookups.data?.countries.map((country) => (
                <option key={country.id} value={country.id}>
                  {country.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Статус" htmlFor="edit-horse-status">
            <select id="edit-horse-status" name="status" defaultValue={item.status}>
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
