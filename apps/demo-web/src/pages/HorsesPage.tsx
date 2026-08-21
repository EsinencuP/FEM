import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { apiRequest, toQuery } from '../api/client';
import type {
  CreateHorsePayload,
  DataResponse,
  Horse,
  HorseListItem,
  HorseListResponse,
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
import { displayValue, formText } from '../utils/format';
import { portfolioReadonly } from '../config/portfolio';

export function HorsesPage(): ReactNode {
  const state = useListState('displayName');
  const navigate = useNavigate();
  const lookups = useLookups();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<unknown>(null);
  const query = toQuery({
    page: state.page,
    limit: state.limit,
    search: state.search,
    sex: state.get('sex'),
    breed: state.get('breed'),
    birthYear: state.get('birthYear'),
    countryOfBirthId: state.get('countryOfBirthId'),
    status: state.get('status'),
    sortBy: state.sortBy,
    sortOrder: state.sortOrder,
  });
  const horses = useApi(() => apiRequest<HorseListResponse>(`/admin/horses${query}`), [query]);
  const columns = useMemo<readonly TableColumn<HorseListItem>[]>(
    () => [
      { key: 'code', label: 'Код', render: (item) => item.primaryIdentifier?.value ?? '—' },
      {
        key: 'name',
        label: 'Лошадь',
        sortKey: 'displayName',
        render: (item) => <Link to={`/horses/${item.id}`}>{item.displayName}</Link>,
      },
      {
        key: 'passportName',
        label: 'Паспортное имя',
        sortKey: 'passportName',
        render: (item) => displayValue(item.passportName),
      },
      { key: 'sex', label: 'Пол', render: (item) => displayValue(item.sex) },
      { key: 'breed', label: 'Порода', render: (item) => displayValue(item.breed) },
      {
        key: 'birthYear',
        label: 'Год',
        sortKey: 'birthYear',
        numeric: true,
        render: (item) => displayValue(item.birthYear),
      },
      { key: 'country', label: 'Страна', render: (item) => item.countryOfBirth?.name ?? '—' },
      { key: 'status', label: 'Статус', render: (item) => <Badge value={item.status} /> },
    ],
    [],
  );

  const create = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setSaving(true);
    setFormError(null);
    const form = new FormData(event.currentTarget);
    const passportName = formText(form, 'passportName').trim();
    const birthYear = formText(form, 'birthYear').trim();
    const countryOfBirthId = formText(form, 'countryOfBirthId');
    const payload: CreateHorsePayload = {
      displayName: formText(form, 'displayName').trim(),
      passportName: passportName || null,
      sex: formText(form, 'sex').trim() || null,
      breed: formText(form, 'breed').trim() || null,
      color: formText(form, 'color').trim() || null,
      birthYear: birthYear ? Number(birthYear) : null,
      countryOfBirthId: countryOfBirthId || null,
      status: (formText(form, 'status') || 'ACTIVE') as RecordStatus,
    };
    try {
      const response = await apiRequest<DataResponse<Horse>>('/admin/horses', {
        method: 'POST',
        body: payload,
      });
      setDrawerOpen(false);
      horses.reload();
      await navigate(`/horses/${response.data.id}`);
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
    state.get('sex') ||
    state.get('breed') ||
    state.get('birthYear') ||
    state.get('countryOfBirthId') ||
    state.get('status'),
  );

  return (
    <>
      <PageHeader
        eyebrow="Реестр / 02"
        title="Лошади"
        description="Карточки лошадей и их связи со спортсменами и результатами."
        action={
          portfolioReadonly ? undefined : (
            <Button onClick={() => setDrawerOpen(true)}>Добавить лошадь</Button>
          )
        }
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
        <FilterControl label="Пол">
          <input
            value={state.get('sex')}
            maxLength={80}
            placeholder="Например, мерин"
            onChange={(event) => state.set({ sex: event.target.value })}
          />
        </FilterControl>
        <FilterControl label="Порода">
          <input
            value={state.get('breed')}
            maxLength={160}
            placeholder="Все породы"
            onChange={(event) => state.set({ breed: event.target.value })}
          />
        </FilterControl>
        <FilterControl label="Год рождения">
          <input
            type="number"
            min={1000}
            max={2100}
            value={state.get('birthYear')}
            onChange={(event) => state.set({ birthYear: event.target.value })}
          />
        </FilterControl>
        <FilterControl label="Страна">
          <select
            value={state.get('countryOfBirthId')}
            onChange={(event) => state.set({ countryOfBirthId: event.target.value })}
          >
            <option value="">Все страны</option>
            {lookups.data?.countries.map((country) => (
              <option key={country.id} value={country.id}>
                {country.name}
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
            <option value="ACTIVE">ACTIVE</option>
            <option value="DRAFT">DRAFT</option>
            <option value="INACTIVE">INACTIVE</option>
          </select>
        </FilterControl>
      </FilterBar>
      {horses.loading ? <LoadingState /> : null}
      {horses.error ? <ErrorState error={horses.error} onRetry={horses.reload} /> : null}
      {horses.data?.data.length === 0 ? (
        <EmptyState filtered={filtered} onReset={state.reset} />
      ) : null}
      {horses.data && horses.data.data.length > 0 ? (
        <>
          <DataTable
            caption="Список лошадей"
            columns={columns}
            rows={horses.data.data}
            rowKey={(item) => item.id}
            sortBy={state.sortBy}
            sortOrder={state.sortOrder}
            onSort={sort}
          />
          <Pagination meta={horses.data.meta} onPage={(page) => state.set({ page })} />
        </>
      ) : null}
      {!portfolioReadonly ? (
        <Drawer
          open={drawerOpen}
          title="Новая лошадь"
          description="Официальные FEI, паспортные и microchip ID не генерируются."
          onClose={() => setDrawerOpen(false)}
        >
          <FormFeedback error={formError} />
          <form className="form-grid" onSubmit={(event) => void create(event)}>
            <FormField label="Отображаемое имя" htmlFor="horse-display">
              <input id="horse-display" name="displayName" maxLength={240} required />
            </FormField>
            <FormField label="Паспортное имя" htmlFor="horse-passport">
              <input id="horse-passport" name="passportName" maxLength={240} />
            </FormField>
            <FormField label="Пол" htmlFor="horse-sex">
              <input id="horse-sex" name="sex" maxLength={80} />
            </FormField>
            <FormField label="Порода" htmlFor="horse-breed">
              <input id="horse-breed" name="breed" maxLength={160} />
            </FormField>
            <FormField label="Масть" htmlFor="horse-color">
              <input id="horse-color" name="color" maxLength={120} />
            </FormField>
            <FormField label="Год рождения" htmlFor="horse-year">
              <input id="horse-year" name="birthYear" type="number" min={1000} max={2100} />
            </FormField>
            <FormField label="Страна рождения" htmlFor="horse-country">
              <select id="horse-country" name="countryOfBirthId">
                <option value="">Не указана</option>
                {lookups.data?.countries.map((country) => (
                  <option key={country.id} value={country.id}>
                    {country.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Статус" htmlFor="horse-status">
              <select id="horse-status" name="status" defaultValue="ACTIVE">
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
      ) : null}
    </>
  );
}
