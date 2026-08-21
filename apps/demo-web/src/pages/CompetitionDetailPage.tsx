import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import { apiRequest, toQuery } from '../api/client';
import type {
  AthleteListResponse,
  Competition,
  CompetitionClass,
  CompetitionClassListResponse,
  CompetitionDetail,
  CompetitionResult,
  CompetitionResultListResponse,
  CreateCompetitionClassPayload,
  CreateCompetitionResultPayload,
  DataResponse,
  HorseListResponse,
  RecordStatus,
  UpdateCompetitionClassPayload,
  UpdateCompetitionPayload,
  UpdateCompetitionResultPayload,
} from '../api/contracts';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { DataTable, type TableColumn } from '../components/DataTable';
import { Drawer } from '../components/Drawer';
import { FormFeedback } from '../components/FormFeedback';
import { FormField } from '../components/FormField';
import { PageHeader } from '../components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '../components/PageState';
import { useApi } from '../hooks/useApi';
import { useLookups } from '../hooks/useLookups';
import {
  displayValue,
  formText,
  formatDate,
  formatDateRange,
  optionalNumber,
} from '../utils/format';
import { portfolioReadonly } from '../config/portfolio';

type DrawerState<T> = { readonly open: false } | { readonly open: true; readonly item?: T };

export function CompetitionDetailPage(): ReactNode {
  const { id = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const lookups = useLookups();
  const competition = useApi(
    () => apiRequest<DataResponse<CompetitionDetail>>(`/admin/competitions/${id}`),
    [id],
  );
  const classes = useApi(
    () =>
      apiRequest<CompetitionClassListResponse>(
        `/admin/competitions/${id}/classes${toQuery({ page: 1, limit: 100 })}`,
      ),
    [id],
  );
  const people = useApi(async () => {
    const query = toQuery({ page: 1, limit: 100, status: 'ACTIVE' });
    const [athletes, horses] = await Promise.all([
      apiRequest<AthleteListResponse>(`/admin/athletes${query}`),
      apiRequest<HorseListResponse>(`/admin/horses${query}`),
    ]);
    return { athletes: athletes.data, horses: horses.data };
  }, []);
  const selectedClassId = params.get('classId') ?? classes.data?.data[0]?.id ?? '';
  const results = useApi(
    () =>
      selectedClassId
        ? apiRequest<CompetitionResultListResponse>(
            `/admin/competition-classes/${selectedClassId}/results${toQuery({
              page: 1,
              limit: 100,
            })}`,
          )
        : Promise.resolve({ data: [], meta: { page: 1, limit: 100, total: 0, totalPages: 0 } }),
    [selectedClassId],
  );
  const [competitionEditor, setCompetitionEditor] = useState(false);
  const [classEditor, setClassEditor] = useState<DrawerState<CompetitionClass>>({ open: false });
  const [resultEditor, setResultEditor] = useState<DrawerState<CompetitionResult>>({ open: false });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<unknown>(null);
  const selectedClass = classes.data?.data.find((item) => item.id === selectedClassId);

  const resultColumns = useMemo<readonly TableColumn<CompetitionResult>[]>(
    () => [
      { key: 'rank', label: 'Место', numeric: true, render: (item) => item.rank ?? '—' },
      {
        key: 'status',
        label: 'Статус / результат',
        render: (item) => item.status?.label ?? item.resultDisplay ?? '—',
      },
      {
        key: 'athlete',
        label: 'Спортсмен',
        render: (item) =>
          item.athlete ? (
            <Link to={`/athletes/${item.athlete.id}`}>{item.athlete.displayName}</Link>
          ) : (
            '—'
          ),
      },
      {
        key: 'horse',
        label: 'Лошадь',
        render: (item) =>
          item.horse ? <Link to={`/horses/${item.horse.id}`}>{item.horse.displayName}</Link> : '—',
      },
      { key: 'points', label: 'Баллы', numeric: true, render: (item) => displayValue(item.points) },
      {
        key: 'time',
        label: 'Время',
        numeric: true,
        render: (item) => (item.timeSeconds ? `${item.timeSeconds} с` : '—'),
      },
      {
        key: 'penalties',
        label: 'Штрафы',
        numeric: true,
        render: (item) => displayValue(item.penalties),
      },
      {
        key: 'edit',
        label: 'Действие',
        render: (item) =>
          portfolioReadonly ? null : (
            <Button
              variant="quiet"
              onClick={() => {
                setFormError(null);
                setResultEditor({ open: true, item });
              }}
            >
              Изменить
            </Button>
          ),
      },
    ],
    [],
  );

  if (competition.loading || classes.loading) return <LoadingState />;
  if (competition.error || !competition.data)
    return (
      <ErrorState
        error={competition.error ?? new Error('Соревнование не найдено.')}
        onRetry={competition.reload}
      />
    );
  if (classes.error) return <ErrorState error={classes.error} onRetry={classes.reload} />;
  const item = competition.data.data;

  const saveCompetition = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setSaving(true);
    setFormError(null);
    const form = new FormData(event.currentTarget);
    const payload: UpdateCompetitionPayload = {
      title: formText(form, 'title').trim(),
      slug: formText(form, 'slug').trim(),
      startDate: formText(form, 'startDate'),
      endDate: formText(form, 'endDate'),
      location: formText(form, 'location').trim() || null,
      venue: formText(form, 'venue').trim() || null,
      countryId: formText(form, 'countryId') || null,
      organizerName: formText(form, 'organizerName').trim() || null,
      status: (formText(form, 'status') || 'ACTIVE') as RecordStatus,
    };
    try {
      await apiRequest<DataResponse<Competition>>(`/admin/competitions/${id}`, {
        method: 'PATCH',
        body: payload,
        version: item.version,
      });
      setCompetitionEditor(false);
      competition.reload();
    } catch (error) {
      setFormError(error);
    } finally {
      setSaving(false);
    }
  };

  const saveClass = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setSaving(true);
    setFormError(null);
    const form = new FormData(event.currentTarget);
    const editing = classEditor.open ? classEditor.item : undefined;
    const base = {
      competitionEventId: id,
      title: formText(form, 'title').trim(),
      disciplineId: formText(form, 'disciplineId'),
      category: formText(form, 'category').trim() || null,
      level: formText(form, 'level').trim() || null,
      competitionDate: formText(form, 'competitionDate') || null,
      sortOrder: Number(formText(form, 'sortOrder') || 0),
      status: (formText(form, 'status') || 'ACTIVE') as RecordStatus,
    };
    try {
      if (editing) {
        const payload: UpdateCompetitionClassPayload = base;
        await apiRequest(`/admin/competition-classes/${editing.id}`, {
          method: 'PATCH',
          body: payload,
          version: editing.version,
        });
      } else {
        const payload: CreateCompetitionClassPayload = base;
        await apiRequest('/admin/competition-classes', { method: 'POST', body: payload });
      }
      setClassEditor({ open: false });
      classes.reload();
      competition.reload();
    } catch (error) {
      setFormError(error);
    } finally {
      setSaving(false);
    }
  };

  const saveResult = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setSaving(true);
    setFormError(null);
    const form = new FormData(event.currentTarget);
    const editing = resultEditor.open ? resultEditor.item : undefined;
    const base = {
      competitionClassId: selectedClassId,
      athleteId: formText(form, 'athleteId'),
      horseId: formText(form, 'horseId'),
      rank: optionalNumber(form.get('rank')),
      resultDisplay: formText(form, 'resultDisplay').trim() || null,
      points: optionalNumber(form.get('points')),
      timeSeconds: optionalNumber(form.get('timeSeconds')),
      penalties: optionalNumber(form.get('penalties')),
    };
    try {
      if (editing) {
        const payload: UpdateCompetitionResultPayload = base;
        await apiRequest(`/admin/results/${editing.id}`, {
          method: 'PATCH',
          body: payload,
          version: editing.version,
        });
      } else {
        const payload: CreateCompetitionResultPayload = base;
        await apiRequest('/admin/results', { method: 'POST', body: payload });
      }
      setResultEditor({ open: false });
      results.reload();
    } catch (error) {
      setFormError(error);
    } finally {
      setSaving(false);
    }
  };

  const groupedClasses =
    classes.data?.data.reduce<Record<string, CompetitionClass[]>>((groups, classItem) => {
      const key = classItem.category ?? 'Без категории';
      (groups[key] ??= []).push(classItem);
      return groups;
    }, {}) ?? {};

  return (
    <>
      <Link className="back-link" to="/competitions">
        ← К списку соревнований
      </Link>
      <PageHeader
        eyebrow="Рабочее пространство соревнования"
        title={item.title}
        description={`${formatDateRange(item.startDate, item.endDate)} · ${item.venue ?? item.location ?? 'место не указано'}`}
        action={
          portfolioReadonly ? undefined : (
            <Button
              onClick={() => {
                setFormError(null);
                setCompetitionEditor(true);
              }}
            >
              Редактировать
            </Button>
          )
        }
      />
      <section className="competition-summary">
        <div>
          <span>Статус</span>
          <Badge value={item.status} />
        </div>
        <div>
          <span>Страна</span>
          <strong>{item.country?.name ?? '—'}</strong>
        </div>
        <div>
          <span>Организатор</span>
          <strong>{item.organizerName ?? '—'}</strong>
        </div>
        <div>
          <span>Классы</span>
          <strong>{classes.data?.meta.total ?? 0}</strong>
        </div>
      </section>
      <section className="competition-workspace">
        <aside className="class-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Структура</p>
              <h2>Категории и классы</h2>
            </div>
            <Button
              variant="secondary"
              onClick={() => {
                setFormError(null);
                setClassEditor({ open: true });
              }}
            >
              Добавить класс
            </Button>
          </div>
          {Object.entries(groupedClasses).length ? (
            Object.entries(groupedClasses).map(([category, categoryClasses]) => (
              <div className="class-group" key={category}>
                <h3>{category}</h3>
                {categoryClasses.map((classItem) => (
                  <button
                    key={classItem.id}
                    className={`class-option ${classItem.id === selectedClassId ? 'class-option--active' : ''}`}
                    onClick={() => setParams({ classId: classItem.id })}
                  >
                    <span>
                      <strong>{classItem.title}</strong>
                      <small>
                        {classItem.discipline?.name ?? 'Дисциплина'} ·{' '}
                        {formatDate(classItem.competitionDate)}
                      </small>
                    </span>
                    <em>{classItem._count?.results ?? 0}</em>
                  </button>
                ))}
              </div>
            ))
          ) : (
            <EmptyState />
          )}
        </aside>
        <div className="results-panel">
          {selectedClass ? (
            <>
              <div className="section-heading">
                <div>
                  <p className="eyebrow">{selectedClass.category ?? 'Класс'}</p>
                  <h2>{selectedClass.title}</h2>
                  <p>
                    {selectedClass.discipline?.name ?? '—'} ·{' '}
                    {selectedClass.level ?? 'уровень не указан'}
                  </p>
                </div>
                <div className="button-cluster">
                  {!portfolioReadonly ? (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setFormError(null);
                        setClassEditor({ open: true, item: selectedClass });
                      }}
                    >
                      Изменить класс
                    </Button>
                  ) : null}
                  {!portfolioReadonly ? (
                    <Button
                      onClick={() => {
                        setFormError(null);
                        setResultEditor({ open: true });
                      }}
                    >
                      Добавить результат
                    </Button>
                  ) : null}
                </div>
              </div>
              {results.loading ? <LoadingState /> : null}
              {results.error ? <ErrorState error={results.error} onRetry={results.reload} /> : null}
              {results.data?.data.length === 0 ? <EmptyState /> : null}
              {results.data && results.data.data.length > 0 ? (
                <DataTable
                  caption={`Результаты класса ${selectedClass.title}`}
                  columns={resultColumns}
                  rows={results.data.data}
                  rowKey={(result) => result.id}
                />
              ) : null}
            </>
          ) : (
            <EmptyState />
          )}
        </div>
      </section>
      {!portfolioReadonly ? (
        <Drawer
          open={competitionEditor}
          title="Редактировать соревнование"
          description="Измените основные параметры соревнования."
          onClose={() => setCompetitionEditor(false)}
        >
          <FormFeedback error={formError} />
          <form className="form-grid" onSubmit={(event) => void saveCompetition(event)}>
            <FormField label="Название" htmlFor="edit-competition-title">
              <input
                id="edit-competition-title"
                name="title"
                defaultValue={item.title}
                maxLength={240}
                required
              />
            </FormField>
            <FormField label="Slug" htmlFor="edit-competition-slug">
              <input
                id="edit-competition-slug"
                name="slug"
                defaultValue={item.slug}
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                maxLength={240}
                required
              />
            </FormField>
            <div className="form-row">
              <FormField label="Дата начала" htmlFor="edit-competition-start">
                <input
                  id="edit-competition-start"
                  name="startDate"
                  type="date"
                  defaultValue={item.startDate.slice(0, 10)}
                  required
                />
              </FormField>
              <FormField label="Дата окончания" htmlFor="edit-competition-end">
                <input
                  id="edit-competition-end"
                  name="endDate"
                  type="date"
                  defaultValue={item.endDate.slice(0, 10)}
                  required
                />
              </FormField>
            </div>
            <FormField label="Населённый пункт" htmlFor="edit-competition-location">
              <input
                id="edit-competition-location"
                name="location"
                defaultValue={item.location ?? ''}
                maxLength={240}
              />
            </FormField>
            <FormField label="Площадка" htmlFor="edit-competition-venue">
              <input
                id="edit-competition-venue"
                name="venue"
                defaultValue={item.venue ?? ''}
                maxLength={240}
              />
            </FormField>
            <FormField label="Страна" htmlFor="edit-competition-country">
              <select
                id="edit-competition-country"
                name="countryId"
                defaultValue={item.countryId ?? ''}
              >
                <option value="">Не указана</option>
                {lookups.data?.countries.map((country) => (
                  <option key={country.id} value={country.id}>
                    {country.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Организатор" htmlFor="edit-competition-organizer">
              <input
                id="edit-competition-organizer"
                name="organizerName"
                defaultValue={item.organizerName ?? ''}
                maxLength={240}
              />
            </FormField>
            <FormField label="Статус" htmlFor="edit-competition-status">
              <select id="edit-competition-status" name="status" defaultValue={item.status}>
                <option value="ACTIVE">ACTIVE</option>
                <option value="DRAFT">DRAFT</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </FormField>
            <div className="form-actions">
              <Button type="button" variant="secondary" onClick={() => setCompetitionEditor(false)}>
                Отмена
              </Button>
              <Button type="submit" busy={saving}>
                Сохранить
              </Button>
            </div>
          </form>
        </Drawer>
      ) : null}

      {!portfolioReadonly ? (
        <Drawer
          open={classEditor.open}
          title={classEditor.open && classEditor.item ? 'Редактировать класс' : 'Новый класс'}
          onClose={() => setClassEditor({ open: false })}
        >
          <FormFeedback error={formError} />
          {classEditor.open ? (
            <form className="form-grid" onSubmit={(event) => void saveClass(event)}>
              <FormField label="Название" htmlFor="class-title">
                <input
                  id="class-title"
                  name="title"
                  defaultValue={classEditor.item?.title ?? ''}
                  maxLength={240}
                  required
                />
              </FormField>
              <FormField label="Дисциплина" htmlFor="class-discipline">
                <select
                  id="class-discipline"
                  name="disciplineId"
                  defaultValue={classEditor.item?.disciplineId ?? ''}
                  required
                >
                  <option value="" disabled>
                    Выберите дисциплину
                  </option>
                  {lookups.data?.disciplines.map((discipline) => (
                    <option key={discipline.id} value={discipline.id}>
                      {discipline.name}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Категория" htmlFor="class-category">
                <select
                  id="class-category"
                  name="category"
                  defaultValue={classEditor.item?.category ?? 'Открытый класс'}
                >
                  <option>Открытый класс</option>
                  <option>Юниоры</option>
                  <option>Любители</option>
                  <option>Молодые лошади</option>
                </select>
              </FormField>
              <FormField label="Уровень" htmlFor="class-level">
                <input
                  id="class-level"
                  name="level"
                  defaultValue={classEditor.item?.level ?? ''}
                  maxLength={160}
                />
              </FormField>
              <FormField label="Дата класса" htmlFor="class-date">
                <input
                  id="class-date"
                  name="competitionDate"
                  type="date"
                  min={item.startDate.slice(0, 10)}
                  max={item.endDate.slice(0, 10)}
                  defaultValue={
                    classEditor.item?.competitionDate?.slice(0, 10) ?? item.startDate.slice(0, 10)
                  }
                />
              </FormField>
              <FormField label="Порядок" htmlFor="class-sort">
                <input
                  id="class-sort"
                  name="sortOrder"
                  type="number"
                  min={0}
                  max={100000}
                  defaultValue={classEditor.item?.sortOrder ?? classes.data?.data.length ?? 0}
                />
              </FormField>
              <FormField label="Статус" htmlFor="class-status">
                <select
                  id="class-status"
                  name="status"
                  defaultValue={classEditor.item?.status ?? 'ACTIVE'}
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="DRAFT">DRAFT</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </FormField>
              <div className="form-actions">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setClassEditor({ open: false })}
                >
                  Отмена
                </Button>
                <Button type="submit" busy={saving}>
                  Сохранить
                </Button>
              </div>
            </form>
          ) : null}
        </Drawer>
      ) : null}

      {!portfolioReadonly ? (
        <Drawer
          open={resultEditor.open}
          title={
            resultEditor.open && resultEditor.item ? 'Редактировать результат' : 'Новый результат'
          }
          description={selectedClass?.title ?? 'Выбранный класс'}
          onClose={() => setResultEditor({ open: false })}
        >
          <FormFeedback error={formError} />
          {resultEditor.open ? (
            <form className="form-grid" onSubmit={(event) => void saveResult(event)}>
              <FormField label="Спортсмен" htmlFor="result-athlete">
                <select
                  id="result-athlete"
                  name="athleteId"
                  defaultValue={resultEditor.item?.athleteId ?? ''}
                  required
                >
                  <option value="" disabled>
                    Выберите спортсмена
                  </option>
                  {people.data?.athletes.map((athleteItem) => (
                    <option key={athleteItem.id} value={athleteItem.id}>
                      {athleteItem.displayName}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Лошадь" htmlFor="result-horse">
                <select
                  id="result-horse"
                  name="horseId"
                  defaultValue={resultEditor.item?.horseId ?? ''}
                  required
                >
                  <option value="" disabled>
                    Выберите лошадь
                  </option>
                  {people.data?.horses.map((horseItem) => (
                    <option key={horseItem.id} value={horseItem.id}>
                      {horseItem.displayName}
                    </option>
                  ))}
                </select>
              </FormField>
              <div className="form-row">
                <FormField label="Место" htmlFor="result-rank">
                  <input
                    id="result-rank"
                    name="rank"
                    type="number"
                    min={1}
                    defaultValue={resultEditor.item?.rank ?? ''}
                  />
                </FormField>
                <FormField label="Отображаемый результат" htmlFor="result-display">
                  <input
                    id="result-display"
                    name="resultDisplay"
                    defaultValue={resultEditor.item?.resultDisplay ?? ''}
                    maxLength={500}
                  />
                </FormField>
              </div>
              <div className="form-row">
                <FormField label="Баллы" htmlFor="result-points">
                  <input
                    id="result-points"
                    name="points"
                    type="number"
                    step="0.001"
                    defaultValue={resultEditor.item?.points ?? ''}
                  />
                </FormField>
                <FormField label="Время, сек." htmlFor="result-time">
                  <input
                    id="result-time"
                    name="timeSeconds"
                    type="number"
                    min={0}
                    step="0.001"
                    defaultValue={resultEditor.item?.timeSeconds ?? ''}
                  />
                </FormField>
              </div>
              <FormField label="Штрафы" htmlFor="result-penalties">
                <input
                  id="result-penalties"
                  name="penalties"
                  type="number"
                  min={0}
                  step="0.001"
                  defaultValue={resultEditor.item?.penalties ?? ''}
                />
              </FormField>
              <div className="form-actions">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setResultEditor({ open: false })}
                >
                  Отмена
                </Button>
                <Button type="submit" busy={saving}>
                  Сохранить
                </Button>
              </div>
            </form>
          ) : null}
        </Drawer>
      ) : null}
    </>
  );
}
