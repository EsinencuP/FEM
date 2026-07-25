import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { apiRequest, toQuery } from '../api/client';
import type {
  Athlete,
  AthleteListItem,
  AthleteListResponse,
  CreateAthletePayload,
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
import { formText, formatDate } from '../utils/format';

const statuses: readonly RecordStatus[] = ['ACTIVE', 'DRAFT', 'INACTIVE'];

export function AthletesPage(): ReactNode {
  const state = useListState('lastName');
  const navigate = useNavigate();
  const lookups = useLookups();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<unknown>(null);
  const query = toQuery({
    page: state.page,
    limit: state.limit,
    search: state.search,
    countryId: state.get('countryId'),
    clubId: state.get('clubId'),
    status: state.get('status'),
    sortBy: state.sortBy,
    sortOrder: state.sortOrder,
  });
  const athletes = useApi(
    () => apiRequest<AthleteListResponse>(`/admin/athletes${query}`),
    [query],
  );

  const columns = useMemo<readonly TableColumn<AthleteListItem>[]>(
    () => [
      {
        key: 'code',
        label: 'Код',
        render: (item) => item.primaryIdentifier?.value ?? '—',
      },
      {
        key: 'name',
        label: 'Спортсмен',
        sortKey: 'lastName',
        render: (item) => <Link to={`/athletes/${item.id}`}>{item.displayName}</Link>,
      },
      { key: 'country', label: 'Страна', render: (item) => item.country?.name ?? '—' },
      {
        key: 'club',
        label: 'Текущий клуб',
        render: (item) => item.currentClubs.map(({ club }) => club.name).join(', ') || '—',
      },
      { key: 'status', label: 'Статус', render: (item) => <Badge value={item.status} /> },
      {
        key: 'updatedAt',
        label: 'Обновлено',
        sortKey: 'updatedAt',
        render: (item) => formatDate(item.updatedAt),
      },
    ],
    [],
  );

  const sort = (key: string): void => {
    state.set({
      sortBy: key,
      sortOrder: state.sortBy === key && state.sortOrder === 'asc' ? 'desc' : 'asc',
    });
  };

  const create = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setSaving(true);
    setFormError(null);
    const form = new FormData(event.currentTarget);
    const countryId = formText(form, 'countryId');
    const payload: CreateAthletePayload = {
      firstName: formText(form, 'firstName').trim(),
      lastName: formText(form, 'lastName').trim(),
      displayName: formText(form, 'displayName').trim(),
      status: (formText(form, 'status') || 'ACTIVE') as RecordStatus,
      ...(countryId ? { countryId } : {}),
    };
    try {
      const response = await apiRequest<DataResponse<Athlete>>('/admin/athletes', {
        method: 'POST',
        body: payload,
      });
      setDrawerOpen(false);
      athletes.reload();
      await navigate(`/athletes/${response.data.id}`);
    } catch (error) {
      setFormError(error);
    } finally {
      setSaving(false);
    }
  };

  const filtered = Boolean(
    state.search || state.get('countryId') || state.get('clubId') || state.get('status'),
  );
  return (
    <>
      <PageHeader
        eyebrow="Реестр / 01"
        title="Спортсмены"
        description="Единый список спортсменов, клубов и связанных спортивных данных."
        action={<Button onClick={() => setDrawerOpen(true)}>Добавить спортсмена</Button>}
      />
      <FilterBar onReset={state.reset}>
        <FilterControl label="Поиск">
          <input
            type="search"
            value={state.search}
            maxLength={200}
            placeholder="Имя или код"
            onChange={(event) => state.set({ search: event.target.value })}
          />
        </FilterControl>
        <FilterControl label="Страна">
          <select
            value={state.get('countryId')}
            onChange={(event) => state.set({ countryId: event.target.value })}
          >
            <option value="">Все страны</option>
            {lookups.data?.countries.map((country) => (
              <option key={country.id} value={country.id}>
                {country.name}
              </option>
            ))}
          </select>
        </FilterControl>
        <FilterControl label="Клуб">
          <select
            value={state.get('clubId')}
            onChange={(event) => state.set({ clubId: event.target.value })}
          >
            <option value="">Все клубы</option>
            {lookups.data?.clubs.map((club) => (
              <option key={club.id} value={club.id}>
                {club.name}
              </option>
            ))}
          </select>
        </FilterControl>
        <FilterControl label="Статус">
          <select
            value={state.get('status')}
            onChange={(event) => state.set({ status: event.target.value })}
          >
            <option value="">Все статусы</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </FilterControl>
      </FilterBar>
      {athletes.loading ? <LoadingState /> : null}
      {athletes.error ? <ErrorState error={athletes.error} onRetry={athletes.reload} /> : null}
      {athletes.data && athletes.data.data.length === 0 ? (
        <EmptyState filtered={filtered} onReset={state.reset} />
      ) : null}
      {athletes.data && athletes.data.data.length > 0 ? (
        <>
          <DataTable
            caption="Список спортсменов"
            columns={columns}
            rows={athletes.data.data}
            rowKey={(item) => item.id}
            sortBy={state.sortBy}
            sortOrder={state.sortOrder}
            onSort={sort}
          />
          <Pagination meta={athletes.data.meta} onPage={(page) => state.set({ page })} />
        </>
      ) : null}
      <Drawer
        open={drawerOpen}
        title="Новый спортсмен"
        description="Заполните основные данные спортсмена."
        onClose={() => setDrawerOpen(false)}
      >
        <FormFeedback error={formError} />
        <form className="form-grid" onSubmit={(event) => void create(event)}>
          <FormField label="Имя" htmlFor="athlete-first-name">
            <input id="athlete-first-name" name="firstName" maxLength={120} required />
          </FormField>
          <FormField label="Фамилия" htmlFor="athlete-last-name">
            <input id="athlete-last-name" name="lastName" maxLength={120} required />
          </FormField>
          <FormField label="Отображаемое имя" htmlFor="athlete-display-name">
            <input id="athlete-display-name" name="displayName" maxLength={240} required />
          </FormField>
          <FormField label="Страна" htmlFor="athlete-country">
            <select id="athlete-country" name="countryId">
              <option value="">Не указана</option>
              {lookups.data?.countries.map((country) => (
                <option key={country.id} value={country.id}>
                  {country.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Статус" htmlFor="athlete-status">
            <select id="athlete-status" name="status" defaultValue="ACTIVE">
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
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
