import { RecordStatus, type Prisma } from '@prisma/client';

export const PUBLIC_RECORD_STATUSES = [RecordStatus.ACTIVE, RecordStatus.INACTIVE];

const publicRecordState = {
  archivedAt: null,
  isDemo: false,
  status: { in: PUBLIC_RECORD_STATUSES },
};

const publicPublicationState = (
  now: Date,
): {
  publicationStatus: 'PUBLISHED';
  publishedAt: { not: null; lte: Date };
} => ({
  publicationStatus: 'PUBLISHED' as const,
  publishedAt: { not: null, lte: now },
});

export function publicCountryDependenciesWhere(): Prisma.CountryWhereInput {
  return {
    archivedAt: null,
    isDemo: false,
  };
}

export function publicCountryWhere(now: Date): Prisma.CountryWhereInput {
  return {
    ...publicCountryDependenciesWhere(),
    ...publicPublicationState(now),
  };
}

export const publicStatusWhere = {
  ...publicRecordState,
};

export function publicFederationWhere(now: Date): Prisma.NationalFederationWhereInput {
  return {
    ...publicRecordState,
    country: { is: publicCountryWhere(now) },
  };
}

export function publicDisciplineDependenciesWhere(): Prisma.DisciplineWhereInput {
  return { ...publicRecordState };
}

export function publicDisciplineWhere(now: Date): Prisma.DisciplineWhereInput {
  return {
    ...publicDisciplineDependenciesWhere(),
    ...publicPublicationState(now),
  };
}

export function publicClubDependenciesWhere(now: Date): Prisma.ClubWhereInput {
  return {
    ...publicRecordState,
    AND: [
      {
        OR: [{ countryId: null }, { country: { is: publicCountryWhere(now) } }],
      },
      {
        OR: [
          { nationalFederationId: null },
          { nationalFederation: { is: publicFederationWhere(now) } },
        ],
      },
    ],
  };
}

export function publicClubWhere(now: Date): Prisma.ClubWhereInput {
  return {
    ...publicClubDependenciesWhere(now),
    ...publicPublicationState(now),
  };
}

export function publicAthleteDependenciesWhere(now: Date): Prisma.AthleteWhereInput {
  return {
    ...publicRecordState,
    AND: [
      {
        OR: [{ countryId: null }, { country: { is: publicCountryWhere(now) } }],
      },
      {
        OR: [
          { nationalFederationId: null },
          { nationalFederation: { is: publicFederationWhere(now) } },
        ],
      },
    ],
  };
}

export function publicAthleteWhere(now: Date): Prisma.AthleteWhereInput {
  return {
    ...publicAthleteDependenciesWhere(now),
    ...publicPublicationState(now),
  };
}

export function publicHorseDependenciesWhere(now: Date): Prisma.HorseWhereInput {
  return {
    ...publicRecordState,
    AND: [
      {
        OR: [{ countryOfBirthId: null }, { countryOfBirth: { is: publicCountryWhere(now) } }],
      },
    ],
  };
}

export function publicHorseWhere(now: Date): Prisma.HorseWhereInput {
  return {
    ...publicHorseDependenciesWhere(now),
    ...publicPublicationState(now),
  };
}

export function publicEventDependenciesWhere(now: Date): Prisma.CompetitionEventWhereInput {
  return {
    ...publicRecordState,
    AND: [
      {
        OR: [{ countryId: null }, { country: { is: publicCountryWhere(now) } }],
      },
    ],
  };
}

export function publicEventWhere(now: Date): Prisma.CompetitionEventWhereInput {
  return {
    ...publicEventDependenciesWhere(now),
    ...publicPublicationState(now),
  };
}

export function publicClassWhere(now: Date): Prisma.CompetitionClassWhereInput {
  return {
    ...publicRecordState,
    discipline: { is: publicDisciplineWhere(now) },
    competitionEvent: { is: publicEventWhere(now) },
  };
}

export function publicResultDependenciesWhere(now: Date): Prisma.CompetitionResultWhereInput {
  return {
    archivedAt: null,
    isDemo: false,
    competitionClass: { is: publicClassWhere(now) },
    athlete: { is: publicAthleteWhere(now) },
    horse: { is: publicHorseWhere(now) },
    OR: [{ statusId: null }, { status: { is: publicStatusWhere } }],
  };
}

export function publicResultWhere(now: Date): Prisma.CompetitionResultWhereInput {
  return {
    ...publicResultDependenciesWhere(now),
    ...publicPublicationState(now),
  };
}
