export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface DataResponse<T> {
  data: T;
}

export interface ListResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export function dataResponse<T>(data: T): DataResponse<T> {
  return { data };
}

export function listResponse<T>(
  data: T[],
  page: number,
  limit: number,
  total: number,
): ListResponse<T> {
  return {
    data,
    meta: {
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    },
  };
}
