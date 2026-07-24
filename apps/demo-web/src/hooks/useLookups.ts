import { apiRequest, toQuery } from '../api/client';
import type { Club, Country, Discipline, ListResponse } from '../api/contracts';
import { useApi } from './useApi';

export interface Lookups {
  readonly countries: readonly Country[];
  readonly clubs: readonly Club[];
  readonly disciplines: readonly Discipline[];
}

export function useLookups(): ReturnType<typeof useApi<Lookups>> {
  return useApi(async () => {
    const query = toQuery({ page: 1, limit: 100 });
    const [countries, clubs, disciplines] = await Promise.all([
      apiRequest<ListResponse<Country>>(`/admin/countries${query}`),
      apiRequest<ListResponse<Club>>(`/admin/clubs${query}`),
      apiRequest<ListResponse<Discipline>>(`/admin/disciplines${query}`),
    ]);
    return {
      countries: countries.data,
      clubs: clubs.data,
      disciplines: disciplines.data,
    };
  }, []);
}
