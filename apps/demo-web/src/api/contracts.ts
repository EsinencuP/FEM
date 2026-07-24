import type { components } from '../../../../api-client/generated/schema';

export type ApiSchemas = components['schemas'];
export type ApiErrorBody = ApiSchemas['ApiErrorDto'];
export type PaginationMeta = ApiSchemas['PaginationMeta'];
export type AuthIdentity = ApiSchemas['AdminIdentity'];
export type LoginResponse = ApiSchemas['AuthLoginResponse'];
export type LoginPayload = ApiSchemas['LoginDto'];

export type Athlete = ApiSchemas['Athlete'];
export type AthleteListItem = ApiSchemas['AthleteListItem'];
export type AthleteDetail = ApiSchemas['AthleteDetail'];
export type AthleteListResponse = ApiSchemas['AthleteListItemListResponse'];
export type CreateAthletePayload = ApiSchemas['CreateAthleteDto'];
export type UpdateAthletePayload = ApiSchemas['UpdateAthleteDto'];

export type Horse = ApiSchemas['Horse'];
export type HorseListItem = ApiSchemas['HorseListItem'];
export type HorseDetail = ApiSchemas['HorseDetail'];
export type HorseListResponse = ApiSchemas['HorseListItemListResponse'];
export type CreateHorsePayload = ApiSchemas['CreateHorseDto'];
export type UpdateHorsePayload = ApiSchemas['UpdateHorseDto'];

export type Competition = ApiSchemas['CompetitionEvent'];
export type CompetitionDetail = ApiSchemas['CompetitionEventDetail'];
export type CompetitionListResponse = ApiSchemas['CompetitionEventListResponse'];
export type CreateCompetitionPayload = ApiSchemas['CreateCompetitionDto'];
export type UpdateCompetitionPayload = ApiSchemas['UpdateCompetitionDto'];

export type CompetitionClass = ApiSchemas['CompetitionClassProjection'];
export type CompetitionClassDetail = ApiSchemas['CompetitionClassDetail'];
export type CompetitionClassListResponse = ApiSchemas['CompetitionClassProjectionListResponse'];
export type CreateCompetitionClassPayload = ApiSchemas['CreateCompetitionClassDto'];
export type UpdateCompetitionClassPayload = ApiSchemas['UpdateCompetitionClassDto'];

export type CompetitionResult = ApiSchemas['CompetitionResultProjection'];
export type CompetitionResultDetail = ApiSchemas['CompetitionResultDetail'];
export type CompetitionResultListResponse = ApiSchemas['CompetitionResultProjectionListResponse'];
export type CreateCompetitionResultPayload = ApiSchemas['CreateCompetitionResultDto'];
export type UpdateCompetitionResultPayload = ApiSchemas['UpdateCompetitionResultDto'];

export type Country = ApiSchemas['Country'];
export type Club = ApiSchemas['Club'];
export type Discipline = ApiSchemas['Discipline'];
export type ListResponse<T> = { readonly data: readonly T[]; readonly meta: PaginationMeta };
export type DataResponse<T> = { readonly data: T };

export type RecordStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
