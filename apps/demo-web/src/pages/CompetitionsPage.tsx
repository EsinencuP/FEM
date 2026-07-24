import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { apiRequest, toQuery } from '../api/client';
import type {
  Competition,
  CompetitionListResponse,
  CreateCompetitionPayload,
  DataResponse,
  RecordStatus,
} from '../api/contracts';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { DataTable, type TableColumn } from '../components/DataTable';
import { Drawer } from '../components/Drawer';
import { FilterBar, FilterControl } from '../components/FilterBar';
import { FormFeedback } from '../components/FormFeedback';
import { FormField } from '../components/FormField';
import { PageHeader } from '../components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '../components/PageState';
import { Pagination } from '../components/Pagination';
import { useApi } from '../hooks/useApi';
import { useListState } from '../hooks/useListState';
import { useLookups } from '../hooks/useLookups';
import { formText, formatDateRange } from '../utils/format';

export function CompetitionsPage(): ReactNode {
  const state = useListState('startDate');
  const navigate = useNavigate();
  const lookups = useLookups();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<unknown>(null);
  const query = toQuery({
    page: state.page,
    limit: state.limit,
    search: state.search,
    disciplineId: state.get('disciplineId'),
    status: state.get('status'),
    dateFrom: state.get('dateFrom'),
    dateTo: state.get('dateTo'),
    sortBy: state.sortBy,
    sortOrder: state.sortOrder,
  });
  const competitions = useApi(
    () => apiRequest<CompetitionListResponse>(`/admin/competitions${query}`),
    [query],
  );
  const columns = useMemo<readonly TableColumn<Competition>[]>(
    () => [
      {
        key: 'title',
        label: 'Соревнование',
        sortKey: 'title',
        render: (item) => <Link to={`/competitions/${item.id}`}>{item.title}</Link>,
      },
      {
        key: 'dates',
        label: 'Даты',
        sortKey: 'startDate',
        render: (item) => formatDateRange(item.startDate, item.endDate),
      },
      { key: 'venue', label: 'Место', render: (item) => item.venue ?? item.location ?? '—' },
      { key: 'country', label: 'Страна', render: (item) => item.country?.name ?? '—' },
      { key: 'status', label: 'Статус', render: (item) => <Badge value={item.status} /> },
      {
        key: 'classes',
        label: 'Классы',
        numeric: true,
        render: (item) => item._count?.classes ?? 0,
      },
    ],
    [],
  );

  const create = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setSaving(true);
    setFormError(null);
    const form = new FormData(event.currentTarget);
    const payload: CreateCompetitionPayload = {
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
      const response = await apiRequest<DataResponse<Competition>>('/admin/competitions', {
        method: 'POST',
        body: payload,
      });
      setDrawerOpen(false);
      competitions.reload();
      await navigate(`/competitions/${response.data.id}`);
    } catch (error) {
      setFormError(error);
    } finally {
      setSaving(false);
    }
  };
  const sort = (key: string): void =>
    state.set({
      sortBy: key,
      sortOrder: state.sortBy === key && state.sortOrder === 'asc' ? 'desc' : 'asc',
    });
  const filtered = Boolean(
    state.search ||
    state.get('disciplineId') ||
    state.get('status') ||
    state.get('dateFrom') ||
    state.get('dateTo'),
  );

  return (
    <>
      <PageHeader
        eyebrow="Реестр / 03"
        title="Соревнования"
        description="События, категории, классы и результаты в одном рабочем контуре."
        action={<Button onClick={() => setDrawerOpen(true)}>Добавить соревнование</Button>}
      />
      <FilterBar onReset={state.reset}>
        <FilterControl label="Поиск">
          <input
            type="search"
            value={state.search}
            maxLength={200}
            placeholder="Название"
            onChange={(event) => state.set({ search: event.target.value })}
          />
        </FilterControl>
        <FilterControl label="Дисциплина">
          <select
            value={state.get('disciplineId')}
            onChange={(event) => state.set({ disciplineId: event.target.value })}
          >
            <option value="">Все дисциплины</option>
            {lookups.data?.disciplines.map((discipline) => (
              <option key={discipline.id} value={discipline.id}>
                {discipline.name}
              </option>
            ))}
          </select>
        </FilterControl>
        <FilterControl label="С даты">
          <input
            type="date"
            value={state.get('dateFrom')}
            onChange={(event) => state.set({ dateFrom: event.target.value })}
          />
        </FilterControl>
        <FilterControl label="По дату">
          <input
            type="date"
            value={state.get('dateTo')}
            onChange={(event) => state.set({ dateTo: event.target.value })}
          />
        </FilterControl>
        <FilterControl label="Статус">
          <select
            value={state.get('status')}
            onChange={(event) => state.set({ status: event.target.value })}
          >
            <option value="">Все статусы</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="DRAFT">DRAFT</option>
            <option value="INACTIVE">INACTIVE</option>
          </select>
        </FilterControl>
      </FilterBar>
      {competitions.loading ? <LoadingState /> : null}
      {competitions.error ? (
        <ErrorState error={competitions.error} onRetry={competitions.reload} />
      ) : null}
      {competitions.data?.data.length === 0 ? (
        <EmptyState filtered={filtered} onReset={state.reset} />
      ) : null}
      {competitions.data && competitions.data.data.length > 0 ? (
        <>
          <DataTable
            caption="Список соревнований"
            columns={columns}
            rows={competitions.data.data}
            rowKey={(item) => item.id}
            sortBy={state.sortBy}
            sortOrder={state.sortOrder}
            onSort={sort}
          />
          <Pagination meta={competitions.data.meta} onPage={(page) => state.set({ page })} />
        </>
      ) : null}
      <Drawer
        open={drawerOpen}
        title="Новое соревнование"
        description="Информационное событие без заявок и регистрации участников."
        onClose={() => setDrawerOpen(false)}
      >
        <FormFeedback error={formError} />
        <form className="form-grid" onSubmit={(event) => void create(event)}>
          <FormField label="Название" htmlFor="competition-title">
            <input id="competition-title" name="title" maxLength={240} required />
          </FormField>
          <FormField label="Slug" htmlFor="competition-slug" hint="Латиница, цифры и дефисы">
            <input
              id="competition-slug"
              name="slug"
              maxLength={240}
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              required
            />
          </FormField>
          <div className="form-row">
            <FormField label="Дата начала" htmlFor="competition-start">
              <input id="competition-start" name="startDate" type="date" required />
            </FormField>
            <FormField label="Дата окончания" htmlFor="competition-end">
              <input id="competition-end" name="endDate" type="date" required />
            </FormField>
          </div>
          <FormField label="Населённый пункт" htmlFor="competition-location">
            <input id="competition-location" name="location" maxLength={240} />
          </FormField>
          <FormField label="Площадка" htmlFor="competition-venue">
            <input id="competition-venue" name="venue" maxLength={240} />
          </FormField>
          <FormField label="Страна" htmlFor="competition-country">
            <select id="competition-country" name="countryId">
              <option value="">Не указана</option>
              {lookups.data?.countries.map((country) => (
                <option key={country.id} value={country.id}>
                  {country.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Организатор" htmlFor="competition-organizer">
            <input id="competition-organizer" name="organizerName" maxLength={240} />
          </FormField>
          <FormField label="Статус" htmlFor="competition-status">
            <select id="competition-status" name="status" defaultValue="ACTIVE">
              <option value="ACTIVE">ACTIVE</option>
              <option value="DRAFT">DRAFT</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>
          </FormField>
          <div className="form-actions">
            <Button type="button" variant="secondary" onClick={() => setDrawerOpen(false)}>
              Отмена
            </Button>
            <Button type="submit" busy={saving}>
              Создать
            </Button>
          </div>
        </form>
      </Drawer>
    </>
  );
}
