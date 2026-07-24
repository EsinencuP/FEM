import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'] as const;
type PathItem = OpenAPIObject['paths'][string];
type PathOperation = NonNullable<PathItem['get']>;
type ApiResponse = NonNullable<PathOperation['responses'][string]>;
type ComponentSchema = NonNullable<NonNullable<OpenAPIObject['components']>['schemas']>[string];

const LIST_OPERATION_METHODS = new Set([
  'list',
  'clubs',
  'horses',
  'owners',
  'athletes',
  'classes',
  'results',
  'identifiers',
]);

function successStatus(operation: PathOperation, method: (typeof HTTP_METHODS)[number]): string {
  const documented = Object.keys(operation.responses).find((status) => /^2\d\d$/.test(status));
  if (documented) return documented;
  if (method === 'post') return '201';
  if (method === 'delete') return '204';
  return '200';
}

function operationMethodName(operation: PathOperation): string {
  return operation.operationId?.split('_').at(-1) ?? '';
}

function isListOperation(operation: PathOperation): boolean {
  const methodName = operationMethodName(operation);
  return LIST_OPERATION_METHODS.has(methodName) || methodName.endsWith('List');
}

const uuidSchema: ComponentSchema = { type: 'string', format: 'uuid' };
const dateSchema: ComponentSchema = { type: 'string', format: 'date-time', nullable: true };
const dateTimeSchema: ComponentSchema = {
  type: 'string',
  format: 'date-time',
  nullable: true,
};
const stringSchema: ComponentSchema = { type: 'string' };
const nullableStringSchema: ComponentSchema = { type: 'string', nullable: true };
const statusSchema: ComponentSchema = {
  type: 'string',
  enum: ['DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED'],
};
const publicationSchema: ComponentSchema = {
  type: 'string',
  enum: ['DRAFT', 'PUBLISHED', 'WITHDRAWN'],
};

function ref(name: string): ComponentSchema {
  return { $ref: `#/components/schemas/${name}` };
}

function nullableRef(name: string): ComponentSchema {
  return { allOf: [ref(name)], nullable: true };
}

function arrayOf(name: string): ComponentSchema {
  return { type: 'array', items: ref(name) };
}

function resourceSchema(
  properties: Record<string, ComponentSchema>,
  required: string[],
): ComponentSchema {
  const effectiveRequired =
    'version' in properties && !required.includes('version') ? [...required, 'version'] : required;
  return {
    type: 'object',
    additionalProperties: false,
    required: effectiveRequired,
    properties,
    description:
      'Stable resource fields. Detail operations may add documented relation projections.',
  };
}

function commonProperties(): Record<string, ComponentSchema> {
  return {
    id: uuidSchema,
    version: { type: 'integer', minimum: 1 },
    isDemo: { type: 'boolean' },
    archivedAt: dateTimeSchema,
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  };
}

function registerResourceSchemas(document: OpenAPIObject): void {
  document.components ??= {};
  document.components.schemas ??= {};
  const schemas = document.components.schemas;
  const common = commonProperties();

  schemas.Country = resourceSchema(
    {
      ...common,
      isoAlpha2: { type: 'string', minLength: 2, maxLength: 2 },
      isoAlpha3: { type: 'string', minLength: 3, maxLength: 3 },
      name: stringSchema,
      publicationStatus: publicationSchema,
      publishedAt: dateTimeSchema,
    },
    [
      'id',
      'isoAlpha2',
      'isoAlpha3',
      'name',
      'publicationStatus',
      'isDemo',
      'createdAt',
      'updatedAt',
    ],
  );
  schemas.Discipline = resourceSchema(
    {
      ...common,
      code: stringSchema,
      name: stringSchema,
      description: nullableStringSchema,
      status: statusSchema,
      publicationStatus: publicationSchema,
      publishedAt: dateTimeSchema,
    },
    ['id', 'code', 'name', 'status', 'publicationStatus', 'isDemo', 'createdAt', 'updatedAt'],
  );
  schemas.Club = resourceSchema(
    {
      ...common,
      name: stringSchema,
      legalName: nullableStringSchema,
      countryId: { ...uuidSchema, nullable: true },
      nationalFederationId: { ...uuidSchema, nullable: true },
      status: statusSchema,
      publicationStatus: publicationSchema,
      publishedAt: dateTimeSchema,
      country: nullableRef('CountrySummary'),
      nationalFederation: nullableRef('NationalFederationSummary'),
      _count: resourceSchema({ memberships: { type: 'integer', minimum: 0 } }, ['memberships']),
    },
    ['id', 'name', 'status', 'publicationStatus', 'isDemo', 'createdAt', 'updatedAt'],
  );
  schemas.Owner = resourceSchema(
    {
      ...common,
      displayName: stringSchema,
      ownerType: nullableStringSchema,
      countryId: { ...uuidSchema, nullable: true },
      status: statusSchema,
      country: nullableRef('CountrySummary'),
    },
    ['id', 'displayName', 'status', 'isDemo', 'createdAt', 'updatedAt'],
  );
  schemas.Athlete = resourceSchema(
    {
      ...common,
      firstName: stringSchema,
      lastName: stringSchema,
      displayName: stringSchema,
      dateOfBirth: dateSchema,
      gender: nullableStringSchema,
      countryId: { ...uuidSchema, nullable: true },
      nationalFederationId: { ...uuidSchema, nullable: true },
      photoId: { ...uuidSchema, nullable: true },
      status: statusSchema,
      publicationStatus: publicationSchema,
      publishedAt: dateTimeSchema,
      country: nullableRef('CountrySummary'),
      nationalFederation: nullableRef('NationalFederationSummary'),
    },
    [
      'id',
      'firstName',
      'lastName',
      'displayName',
      'status',
      'publicationStatus',
      'isDemo',
      'createdAt',
      'updatedAt',
    ],
  );
  schemas.Horse = resourceSchema(
    {
      ...common,
      passportName: nullableStringSchema,
      displayName: stringSchema,
      dateOfBirth: dateSchema,
      birthYear: { type: 'integer', nullable: true },
      sex: nullableStringSchema,
      breed: nullableStringSchema,
      color: nullableStringSchema,
      countryOfBirthId: { ...uuidSchema, nullable: true },
      studbook: nullableStringSchema,
      imageId: { ...uuidSchema, nullable: true },
      status: statusSchema,
      publicationStatus: publicationSchema,
      publishedAt: dateTimeSchema,
      countryOfBirth: nullableRef('CountrySummary'),
    },
    ['id', 'displayName', 'status', 'publicationStatus', 'isDemo', 'createdAt', 'updatedAt'],
  );
  schemas.CompetitionEvent = resourceSchema(
    {
      ...common,
      title: stringSchema,
      slug: stringSchema,
      description: nullableStringSchema,
      startDate: { type: 'string', format: 'date-time' },
      endDate: { type: 'string', format: 'date-time' },
      location: nullableStringSchema,
      venue: nullableStringSchema,
      countryId: { ...uuidSchema, nullable: true },
      organizerName: nullableStringSchema,
      status: statusSchema,
      publicationStatus: publicationSchema,
      coverMediaId: { ...uuidSchema, nullable: true },
      publishedAt: dateTimeSchema,
      country: nullableRef('CountrySummary'),
      _count: resourceSchema({ classes: { type: 'integer', minimum: 0 } }, ['classes']),
    },
    [
      'id',
      'title',
      'slug',
      'startDate',
      'endDate',
      'status',
      'publicationStatus',
      'isDemo',
      'createdAt',
      'updatedAt',
    ],
  );
  schemas.CompetitionClass = resourceSchema(
    {
      ...common,
      competitionEventId: uuidSchema,
      title: stringSchema,
      disciplineId: uuidSchema,
      category: nullableStringSchema,
      level: nullableStringSchema,
      competitionDate: dateSchema,
      sortOrder: { type: 'integer' },
      status: statusSchema,
      competitionEvent: ref('CompetitionEventSummary'),
      discipline: ref('DisciplineSummary'),
      _count: resourceSchema({ results: { type: 'integer', minimum: 0 } }, ['results']),
    },
    [
      'id',
      'competitionEventId',
      'title',
      'disciplineId',
      'sortOrder',
      'status',
      'isDemo',
      'createdAt',
      'updatedAt',
    ],
  );
  schemas.CompetitionResult = resourceSchema(
    {
      ...common,
      competitionClassId: uuidSchema,
      athleteId: uuidSchema,
      horseId: uuidSchema,
      rank: { type: 'integer', minimum: 1, nullable: true },
      statusId: { ...uuidSchema, nullable: true },
      resultDisplay: nullableStringSchema,
      penalties: { type: 'string', nullable: true },
      timeSeconds: { type: 'string', nullable: true },
      points: { type: 'string', nullable: true },
      bonus: { type: 'string', nullable: true },
      sourceDocumentId: { ...uuidSchema, nullable: true },
      sourceReference: nullableStringSchema,
      publicationStatus: publicationSchema,
      publishedAt: dateTimeSchema,
      approvedAt: dateTimeSchema,
      approvedById: { ...uuidSchema, nullable: true },
      competitionClass: ref('CompetitionClassResultSummary'),
      athlete: ref('AthleteSummary'),
      horse: ref('HorseSummary'),
      status: nullableRef('ResultStatusSummary'),
      metrics: arrayOf('ResultMetric'),
      _count: resourceSchema({ metrics: { type: 'integer', minimum: 0 } }, ['metrics']),
    },
    [
      'id',
      'competitionClassId',
      'athleteId',
      'horseId',
      'publicationStatus',
      'isDemo',
      'createdAt',
      'updatedAt',
    ],
  );
  schemas.ResultMetric = resourceSchema(
    {
      id: uuidSchema,
      version: { type: 'integer', minimum: 1 },
      competitionResultId: uuidSchema,
      metricCode: stringSchema,
      numericValue: { type: 'string', nullable: true },
      textValue: nullableStringSchema,
      unit: nullableStringSchema,
      sortOrder: { type: 'integer' },
      isDemo: { type: 'boolean' },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
    ['id', 'competitionResultId', 'metricCode', 'sortOrder', 'isDemo', 'createdAt', 'updatedAt'],
  );
  schemas.ExternalIdentifier = resourceSchema(
    {
      ...common,
      entityType: stringSchema,
      entityId: uuidSchema,
      identifierType: stringSchema,
      namespace: stringSchema,
      value: stringSchema,
      normalizedValue: stringSchema,
      normalizationVersion: stringSchema,
      verificationStatus: {
        type: 'string',
        enum: ['UNVERIFIED', 'VERIFIED', 'CONFLICT', 'REJECTED'],
      },
      isPrimary: { type: 'boolean' },
      validFrom: dateSchema,
      validTo: dateSchema,
      sourceDocumentId: { ...uuidSchema, nullable: true },
      sourceReference: nullableStringSchema,
      verifiedById: { ...uuidSchema, nullable: true },
      verifiedAt: dateTimeSchema,
    },
    [
      'id',
      'identifierType',
      'namespace',
      'value',
      'normalizationVersion',
      'verificationStatus',
      'isPrimary',
      'createdAt',
      'updatedAt',
    ],
  );
  schemas.AthleteClubMembership = resourceSchema(
    {
      ...common,
      athleteId: uuidSchema,
      clubId: uuidSchema,
      membershipType: nullableStringSchema,
      startDate: { type: 'string', format: 'date-time' },
      endDate: dateSchema,
      sourceDocumentId: { ...uuidSchema, nullable: true },
    },
    ['id', 'athleteId', 'clubId', 'startDate', 'isDemo', 'createdAt', 'updatedAt'],
  );
  schemas.AthleteHorseRelation = resourceSchema(
    {
      ...common,
      athleteId: uuidSchema,
      horseId: uuidSchema,
      relationType: nullableStringSchema,
      disciplineId: { ...uuidSchema, nullable: true },
      startDate: { type: 'string', format: 'date-time' },
      endDate: dateSchema,
      sourceDocumentId: { ...uuidSchema, nullable: true },
    },
    ['id', 'athleteId', 'horseId', 'startDate', 'isDemo', 'createdAt', 'updatedAt'],
  );
  schemas.HorseOwnership = resourceSchema(
    {
      ...common,
      horseId: uuidSchema,
      ownerId: uuidSchema,
      startDate: { type: 'string', format: 'date-time' },
      endDate: dateSchema,
      ownershipShare: { type: 'string', nullable: true },
      sourceDocumentId: { ...uuidSchema, nullable: true },
    },
    ['id', 'horseId', 'ownerId', 'startDate', 'isDemo', 'createdAt', 'updatedAt'],
  );

  schemas.CountrySummary = resourceSchema(
    {
      id: uuidSchema,
      isoAlpha2: { type: 'string', minLength: 2, maxLength: 2 },
      isoAlpha3: { type: 'string', minLength: 3, maxLength: 3 },
      name: stringSchema,
    },
    ['id', 'isoAlpha2', 'name'],
  );
  schemas.NationalFederationSummary = resourceSchema(
    {
      id: uuidSchema,
      name: stringSchema,
      shortName: nullableStringSchema,
    },
    ['id', 'name'],
  );
  schemas.DisciplineSummary = resourceSchema(
    { id: uuidSchema, code: stringSchema, name: stringSchema },
    ['id', 'code', 'name'],
  );
  schemas.ClubSummary = resourceSchema(
    {
      id: uuidSchema,
      name: stringSchema,
      status: statusSchema,
      archivedAt: dateTimeSchema,
    },
    ['id', 'name', 'status'],
  );
  schemas.OwnerSummary = resourceSchema(
    { id: uuidSchema, displayName: stringSchema, status: statusSchema },
    ['id', 'displayName', 'status'],
  );
  schemas.AthleteSummary = resourceSchema(
    {
      id: uuidSchema,
      displayName: stringSchema,
      status: statusSchema,
      archivedAt: dateTimeSchema,
    },
    ['id', 'displayName'],
  );
  schemas.HorseSummary = resourceSchema(
    {
      id: uuidSchema,
      displayName: stringSchema,
      status: statusSchema,
      archivedAt: dateTimeSchema,
    },
    ['id', 'displayName'],
  );
  schemas.CompetitionEventSummary = resourceSchema(
    {
      id: uuidSchema,
      title: stringSchema,
      slug: stringSchema,
      startDate: { type: 'string', format: 'date-time' },
      endDate: { type: 'string', format: 'date-time' },
    },
    ['id', 'title', 'slug'],
  );
  schemas.CompetitionClassResultSummary = resourceSchema(
    {
      id: uuidSchema,
      title: stringSchema,
      discipline: ref('DisciplineSummary'),
      competitionEvent: ref('CompetitionEventSummary'),
    },
    ['id', 'title', 'competitionEvent'],
  );
  schemas.ResultStatusSummary = resourceSchema(
    {
      id: uuidSchema,
      code: stringSchema,
      label: stringSchema,
    },
    ['id', 'code', 'label'],
  );
  schemas.ExternalIdentifierSummary = resourceSchema(
    {
      id: uuidSchema,
      identifierType: stringSchema,
      namespace: stringSchema,
      value: stringSchema,
      verificationStatus: {
        type: 'string',
        enum: ['UNVERIFIED', 'VERIFIED', 'CONFLICT', 'REJECTED'],
      },
      isPrimary: { type: 'boolean' },
    },
    ['id', 'identifierType', 'namespace', 'value', 'verificationStatus', 'isPrimary'],
  );
  schemas.CurrentClubProjection = resourceSchema(
    {
      id: uuidSchema,
      membershipType: nullableStringSchema,
      startDate: { type: 'string', format: 'date-time' },
      endDate: dateSchema,
      club: ref('ClubSummary'),
    },
    ['id', 'startDate', 'club'],
  );
  schemas.AthleteListItem = {
    allOf: [
      ref('Athlete'),
      {
        type: 'object',
        required: ['currentClubs', 'primaryIdentifier'],
        properties: {
          currentClubs: arrayOf('CurrentClubProjection'),
          primaryIdentifier: nullableRef('ExternalIdentifierSummary'),
        },
      },
    ],
  };
  schemas.HorseListItem = {
    allOf: [
      ref('Horse'),
      {
        type: 'object',
        required: ['primaryIdentifier'],
        properties: {
          primaryIdentifier: nullableRef('ExternalIdentifierSummary'),
        },
      },
    ],
  };
  schemas.PublicCountry = resourceSchema(
    {
      id: uuidSchema,
      isoAlpha2: { type: 'string', minLength: 2, maxLength: 2 },
      isoAlpha3: { type: 'string', minLength: 3, maxLength: 3 },
      name: stringSchema,
    },
    ['id', 'isoAlpha2', 'isoAlpha3', 'name'],
  );
  schemas.PublicNationalFederation = resourceSchema(
    {
      id: uuidSchema,
      name: stringSchema,
      shortName: nullableStringSchema,
      websiteUrl: { type: 'string', format: 'uri', nullable: true },
      country: ref('PublicCountry'),
    },
    ['id', 'name', 'country'],
  );
  schemas.PublicDiscipline = resourceSchema(
    {
      id: uuidSchema,
      code: stringSchema,
      name: stringSchema,
      description: nullableStringSchema,
    },
    ['id', 'code', 'name'],
  );
  schemas.PublicClub = resourceSchema(
    {
      id: uuidSchema,
      name: stringSchema,
      country: nullableRef('PublicCountry'),
      nationalFederation: nullableRef('PublicNationalFederation'),
    },
    ['id', 'name', 'country', 'nationalFederation'],
  );
  schemas.PublicAthlete = resourceSchema(
    {
      id: uuidSchema,
      firstName: stringSchema,
      lastName: stringSchema,
      displayName: stringSchema,
      country: nullableRef('PublicCountry'),
      nationalFederation: nullableRef('PublicNationalFederation'),
    },
    ['id', 'firstName', 'lastName', 'displayName', 'country', 'nationalFederation'],
  );
  schemas.PublicHorse = resourceSchema(
    {
      id: uuidSchema,
      passportName: nullableStringSchema,
      displayName: stringSchema,
      birthYear: { type: 'integer', nullable: true },
      sex: nullableStringSchema,
      breed: nullableStringSchema,
      color: nullableStringSchema,
      studbook: nullableStringSchema,
      countryOfBirth: nullableRef('PublicCountry'),
    },
    ['id', 'displayName', 'countryOfBirth'],
  );
  schemas.PublicCompetition = resourceSchema(
    {
      id: uuidSchema,
      slug: stringSchema,
      title: stringSchema,
      description: nullableStringSchema,
      startDate: { type: 'string', format: 'date-time' },
      endDate: { type: 'string', format: 'date-time' },
      location: nullableStringSchema,
      venue: nullableStringSchema,
      organizerName: nullableStringSchema,
      publishedAt: { type: 'string', format: 'date-time' },
      country: nullableRef('PublicCountry'),
    },
    ['id', 'slug', 'title', 'startDate', 'endDate', 'publishedAt', 'country'],
  );
  schemas.PublicCompetitionSummary = resourceSchema(
    {
      id: uuidSchema,
      slug: stringSchema,
      title: stringSchema,
      startDate: { type: 'string', format: 'date-time' },
      endDate: { type: 'string', format: 'date-time' },
    },
    ['id', 'slug', 'title', 'startDate', 'endDate'],
  );
  schemas.PublicCompetitionClass = resourceSchema(
    {
      id: uuidSchema,
      title: stringSchema,
      category: nullableStringSchema,
      level: nullableStringSchema,
      competitionDate: dateTimeSchema,
      sortOrder: { type: 'integer' },
      discipline: ref('PublicDiscipline'),
      competitionEvent: ref('PublicCompetitionSummary'),
    },
    ['id', 'title', 'sortOrder', 'discipline', 'competitionEvent'],
  );
  schemas.PublicAthleteSummary = resourceSchema({ id: uuidSchema, displayName: stringSchema }, [
    'id',
    'displayName',
  ]);
  schemas.PublicHorseSummary = resourceSchema({ id: uuidSchema, displayName: stringSchema }, [
    'id',
    'displayName',
  ]);
  schemas.PublicResultStatus = resourceSchema(
    {
      id: uuidSchema,
      code: stringSchema,
      label: stringSchema,
      description: nullableStringSchema,
      sortOrder: { type: 'integer' },
    },
    ['id', 'code', 'label', 'sortOrder'],
  );
  schemas.PublicResultMetric = resourceSchema(
    {
      metricCode: stringSchema,
      numericValue: { type: 'string', nullable: true },
      textValue: nullableStringSchema,
      unit: nullableStringSchema,
      sortOrder: { type: 'integer' },
    },
    ['metricCode', 'sortOrder'],
  );
  schemas.PublicCompetitionResult = resourceSchema(
    {
      id: uuidSchema,
      rank: { type: 'integer', minimum: 1, nullable: true },
      resultDisplay: nullableStringSchema,
      penalties: { type: 'string', nullable: true },
      timeSeconds: { type: 'string', nullable: true },
      points: { type: 'string', nullable: true },
      bonus: { type: 'string', nullable: true },
      publishedAt: { type: 'string', format: 'date-time' },
      competitionClass: ref('PublicCompetitionClass'),
      athlete: ref('PublicAthleteSummary'),
      horse: ref('PublicHorseSummary'),
      status: nullableRef('PublicResultStatus'),
      metrics: arrayOf('PublicResultMetric'),
    },
    ['id', 'publishedAt', 'competitionClass', 'athlete', 'horse', 'status', 'metrics'],
  );
  schemas.AthleteClubMembershipProjection = {
    allOf: [
      ref('AthleteClubMembership'),
      {
        type: 'object',
        properties: { club: ref('ClubSummary') },
      },
    ],
  };
  schemas.ClubMembershipProjection = resourceSchema(
    {
      id: uuidSchema,
      athleteId: uuidSchema,
      membershipType: nullableStringSchema,
      startDate: { type: 'string', format: 'date-time' },
      endDate: dateSchema,
      athlete: ref('AthleteSummary'),
    },
    ['id', 'athleteId', 'startDate', 'athlete'],
  );
  schemas.AthleteHorseRelationProjection = {
    allOf: [
      ref('AthleteHorseRelation'),
      {
        type: 'object',
        properties: {
          athlete: ref('AthleteSummary'),
          horse: ref('HorseSummary'),
          discipline: nullableRef('DisciplineSummary'),
        },
      },
    ],
  };
  schemas.HorseOwnershipProjection = {
    allOf: [
      ref('HorseOwnership'),
      {
        type: 'object',
        properties: {
          horse: ref('HorseSummary'),
          owner: ref('OwnerSummary'),
        },
      },
    ],
  };
  schemas.CompetitionClassProjection = {
    allOf: [
      ref('CompetitionClass'),
      {
        type: 'object',
        properties: {
          discipline: ref('DisciplineSummary'),
          competitionEvent: ref('CompetitionEventSummary'),
        },
      },
    ],
  };
  schemas.CompetitionResultProjection = {
    allOf: [
      ref('CompetitionResult'),
      {
        type: 'object',
        properties: {
          competitionClass: ref('CompetitionClassResultSummary'),
          athlete: ref('AthleteSummary'),
          horse: ref('HorseSummary'),
          status: nullableRef('ResultStatusSummary'),
          metrics: arrayOf('ResultMetric'),
          _count: resourceSchema({ metrics: { type: 'integer', minimum: 0 } }, ['metrics']),
        },
      },
    ],
  };

  schemas.AthleteDetail = {
    allOf: [
      ref('Athlete'),
      {
        type: 'object',
        required: [
          'country',
          'nationalFederation',
          'clubMemberships',
          'horseRelations',
          'competitionResults',
          'externalIdentifiers',
        ],
        properties: {
          country: nullableRef('CountrySummary'),
          nationalFederation: nullableRef('NationalFederationSummary'),
          clubMemberships: arrayOf('AthleteClubMembershipProjection'),
          horseRelations: arrayOf('AthleteHorseRelationProjection'),
          competitionResults: arrayOf('CompetitionResultProjection'),
          externalIdentifiers: arrayOf('ExternalIdentifierSummary'),
        },
      },
    ],
  };
  schemas.HorseDetail = {
    allOf: [
      ref('Horse'),
      {
        type: 'object',
        required: [
          'countryOfBirth',
          'ownerships',
          'athleteRelations',
          'competitionResults',
          'externalIdentifiers',
        ],
        properties: {
          countryOfBirth: nullableRef('CountrySummary'),
          ownerships: arrayOf('HorseOwnershipProjection'),
          athleteRelations: arrayOf('AthleteHorseRelationProjection'),
          competitionResults: arrayOf('CompetitionResultProjection'),
          externalIdentifiers: arrayOf('ExternalIdentifierSummary'),
        },
      },
    ],
  };
  schemas.ClubDetail = {
    allOf: [
      ref('Club'),
      {
        type: 'object',
        required: ['country', 'nationalFederation', 'memberships', '_count'],
        properties: {
          country: nullableRef('CountrySummary'),
          nationalFederation: nullableRef('NationalFederationSummary'),
          memberships: arrayOf('ClubMembershipProjection'),
          _count: resourceSchema({ memberships: { type: 'integer', minimum: 0 } }, ['memberships']),
        },
      },
    ],
  };
  schemas.OwnerDetail = {
    allOf: [
      ref('Owner'),
      {
        type: 'object',
        required: ['country', 'ownerships'],
        properties: {
          country: nullableRef('CountrySummary'),
          ownerships: arrayOf('HorseOwnershipProjection'),
        },
      },
    ],
  };
  schemas.CompetitionEventDetail = {
    allOf: [
      ref('CompetitionEvent'),
      {
        type: 'object',
        required: ['country'],
        properties: {
          country: nullableRef('CountrySummary'),
          classes: arrayOf('CompetitionClassProjection'),
        },
      },
    ],
  };
  schemas.CompetitionClassDetail = {
    allOf: [
      ref('CompetitionClass'),
      {
        type: 'object',
        required: ['competitionEvent', 'discipline'],
        properties: {
          competitionEvent: ref('CompetitionEventSummary'),
          discipline: ref('DisciplineSummary'),
        },
      },
    ],
  };
  schemas.CompetitionResultDetail = {
    allOf: [
      ref('CompetitionResult'),
      {
        type: 'object',
        required: ['competitionClass', 'athlete', 'horse', 'status', 'metrics', '_count'],
        properties: {
          competitionClass: ref('CompetitionClassProjection'),
          athlete: ref('AthleteSummary'),
          horse: ref('HorseSummary'),
          status: nullableRef('ResultStatusSummary'),
          metrics: arrayOf('ResultMetric'),
          _count: resourceSchema({ metrics: { type: 'integer', minimum: 0 } }, ['metrics']),
        },
      },
    ],
  };

  schemas.AdminIdentity = resourceSchema(
    {
      userId: uuidSchema,
      sessionId: uuidSchema,
      email: { type: 'string', format: 'email' },
      displayName: stringSchema,
      roles: { type: 'array', items: { type: 'string' } },
      permissions: { type: 'array', items: { type: 'string' } },
      secondFactorMethod: { type: 'string', enum: ['TOTP', 'RECOVERY'] },
    },
    ['userId', 'sessionId', 'email', 'displayName', 'roles', 'permissions', 'secondFactorMethod'],
  );
  schemas.AdminSessionPublic = resourceSchema(
    {
      id: uuidSchema,
      expiresAt: { type: 'string', format: 'date-time' },
      idleExpiresAt: { type: 'string', format: 'date-time' },
      lastSeenAt: { type: 'string', format: 'date-time' },
      revokedAt: dateTimeSchema,
      revokeReason: nullableStringSchema,
      ipAddress: nullableStringSchema,
      userAgent: nullableStringSchema,
      createdAt: { type: 'string', format: 'date-time' },
    },
    ['id', 'expiresAt', 'idleExpiresAt', 'lastSeenAt', 'createdAt'],
  );
  schemas.AdminSessionIssued = resourceSchema(
    {
      id: uuidSchema,
      expiresAt: { type: 'string', format: 'date-time' },
      idleExpiresAt: { type: 'string', format: 'date-time' },
    },
    ['id', 'expiresAt', 'idleExpiresAt'],
  );
  schemas.AuthLoginResponse = {
    type: 'object',
    required: ['data'],
    properties: {
      data: {
        type: 'object',
        required: ['user', 'session', 'csrfToken'],
        properties: {
          user: {
            type: 'object',
            required: ['id', 'email', 'displayName', 'roles', 'permissions'],
            properties: {
              id: uuidSchema,
              email: { type: 'string', format: 'email' },
              displayName: stringSchema,
              roles: { type: 'array', items: { type: 'string' } },
              permissions: { type: 'array', items: { type: 'string' } },
            },
          },
          session: ref('AdminSessionIssued'),
          csrfToken: {
            type: 'string',
            writeOnly: true,
            description: 'Return once and send as X-CSRF-Token for state-changing requests',
          },
        },
      },
    },
  };
  schemas.AdminIdentityResponse = {
    type: 'object',
    required: ['data'],
    properties: { data: ref('AdminIdentity') },
  };
  schemas.AdminSessionListResponse = {
    type: 'object',
    required: ['data'],
    properties: { data: arrayOf('AdminSessionPublic') },
  };
  schemas.RecoveryCodesResponse = {
    type: 'object',
    required: ['data'],
    properties: {
      data: {
        type: 'object',
        required: ['recoveryCodes'],
        properties: {
          recoveryCodes: {
            type: 'array',
            minItems: 10,
            maxItems: 10,
            items: { type: 'string', writeOnly: true },
          },
        },
      },
    },
  };
  schemas.TotpReenrollmentStartResponse = {
    type: 'object',
    required: ['data'],
    properties: {
      data: {
        type: 'object',
        required: ['secret', 'expiresAt'],
        properties: {
          secret: { type: 'string', writeOnly: true },
          expiresAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  };
  schemas.AuditLog = resourceSchema(
    {
      id: uuidSchema,
      actorId: { ...uuidSchema, nullable: true },
      sessionId: { ...uuidSchema, nullable: true },
      action: stringSchema,
      entityType: stringSchema,
      entityId: uuidSchema,
      oldData: { type: 'object', nullable: true, additionalProperties: true },
      newData: { type: 'object', nullable: true, additionalProperties: true },
      reason: nullableStringSchema,
      requestId: nullableStringSchema,
      createdAt: { type: 'string', format: 'date-time' },
    },
    ['id', 'action', 'entityType', 'entityId', 'createdAt'],
  );
}

function authSuccessSchemaName(path: string, operation: PathOperation): string | undefined {
  if (!/^\/[^/]+\/v1\/auth\//.test(path)) return undefined;
  switch (operationMethodName(operation)) {
    case 'login':
    case 'refresh':
      return 'AuthLoginResponse';
    case 'me':
      return 'AdminIdentityResponse';
    case 'sessions':
      return 'AdminSessionListResponse';
    case 'recoveryCodes':
    case 'confirmTotpReenrollment':
      return 'RecoveryCodesResponse';
    case 'startTotpReenrollment':
      return 'TotpReenrollmentStartResponse';
    default:
      return undefined;
  }
}

function resourceSchemaName(
  path: string,
  operation: PathOperation,
  method: (typeof HTTP_METHODS)[number],
): string | undefined {
  const publicPath = path.replace(/^\/[^/]+\/v1\/public\/\{lang\}\//, '/api/v1/public/');
  if (publicPath.startsWith('/api/v1/public/countries')) return 'PublicCountry';
  if (publicPath.startsWith('/api/v1/public/disciplines')) return 'PublicDiscipline';
  if (publicPath.startsWith('/api/v1/public/clubs')) return 'PublicClub';
  if (publicPath.startsWith('/api/v1/public/athletes')) return 'PublicAthlete';
  if (publicPath.startsWith('/api/v1/public/horses')) return 'PublicHorse';
  if (publicPath.startsWith('/api/v1/public/competitions')) return 'PublicCompetition';
  if (publicPath.startsWith('/api/v1/public/competition-classes')) {
    return 'PublicCompetitionClass';
  }
  if (publicPath.startsWith('/api/v1/public/results')) return 'PublicCompetitionResult';
  path = path.replace(/^\/[^/]+\/v1\/admin\//, '/api/v1/');
  const methodName = operationMethodName(operation);
  const isDetailRead = method === 'get' && ['get', 'getBySlug'].includes(methodName);
  if (path.includes('/identifiers')) return 'ExternalIdentifier';
  if (path.startsWith('/api/v1/audit-logs')) return 'AuditLog';
  if (path.includes('/metrics')) return 'ResultMetric';
  if (path.includes('/athletes/{id}/clubs')) {
    return method === 'get' ? 'AthleteClubMembershipProjection' : 'AthleteClubMembership';
  }
  if (path.includes('/athletes/{id}/horses') || path.includes('/horses/{id}/athletes')) {
    return method === 'get' ? 'AthleteHorseRelationProjection' : 'AthleteHorseRelation';
  }
  if (path.includes('/horses/{id}/owners')) {
    return method === 'get' ? 'HorseOwnershipProjection' : 'HorseOwnership';
  }
  if (methodName === 'results') return 'CompetitionResultProjection';
  if (path.startsWith('/api/v1/results')) {
    return isDetailRead ? 'CompetitionResultDetail' : 'CompetitionResult';
  }
  if (methodName === 'classes') return 'CompetitionClassProjection';
  if (path.startsWith('/api/v1/competition-classes')) {
    return isDetailRead ? 'CompetitionClassDetail' : 'CompetitionClass';
  }
  if (path.startsWith('/api/v1/countries')) return 'Country';
  if (path.startsWith('/api/v1/disciplines')) return 'Discipline';
  if (path.startsWith('/api/v1/clubs')) return isDetailRead ? 'ClubDetail' : 'Club';
  if (path.startsWith('/api/v1/owners')) return isDetailRead ? 'OwnerDetail' : 'Owner';
  if (path.startsWith('/api/v1/athletes')) {
    if (methodName === 'list') return 'AthleteListItem';
    return isDetailRead ? 'AthleteDetail' : 'Athlete';
  }
  if (path.startsWith('/api/v1/horses')) {
    if (methodName === 'list') return 'HorseListItem';
    return isDetailRead ? 'HorseDetail' : 'Horse';
  }
  if (path.startsWith('/api/v1/competitions')) {
    return isDetailRead ? 'CompetitionEventDetail' : 'CompetitionEvent';
  }
  return undefined;
}

function applyPathParameterFormats(document: OpenAPIObject): void {
  for (const pathItem of Object.values(document.paths)) {
    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      if (!operation) continue;
      for (const parameter of operation.parameters ?? []) {
        if (
          !('$ref' in parameter) &&
          parameter.in === 'path' &&
          parameter.name !== 'slug' &&
          parameter.name !== 'lang' &&
          parameter.schema &&
          typeof parameter.schema === 'object' &&
          !('$ref' in parameter.schema) &&
          parameter.schema.type === 'string'
        ) {
          parameter.schema.format = 'uuid';
        }
      }
    }
  }
}

function envelopeSchemaName(document: OpenAPIObject, resourceName: string, list: boolean): string {
  document.components ??= {};
  document.components.schemas ??= {};
  const suffix = list ? 'ListResponse' : 'Response';
  const name = `${resourceName}${suffix}`;
  if (document.components.schemas[name]) return name;
  document.components.schemas[name] = list
    ? {
        type: 'object',
        required: ['data', 'meta'],
        properties: {
          data: { type: 'array', items: ref(resourceName) },
          meta: ref('PaginationMeta'),
        },
      }
    : {
        type: 'object',
        required: ['data'],
        properties: { data: ref(resourceName) },
      };
  return name;
}

export function applySuccessEnvelopeSchemas(document: OpenAPIObject): OpenAPIObject {
  document.components ??= {};
  document.components.schemas ??= {};
  registerResourceSchemas(document);
  document.components.schemas.PaginationMeta = {
    type: 'object',
    required: ['page', 'limit', 'total', 'totalPages'],
    properties: {
      page: { type: 'integer', minimum: 1 },
      limit: { type: 'integer', minimum: 1, maximum: 100 },
      total: { type: 'integer', minimum: 0 },
      totalPages: { type: 'integer', minimum: 0 },
    },
  };
  document.components.schemas.DataEnvelope = {
    type: 'object',
    required: ['data'],
    properties: {
      data: { type: 'object', additionalProperties: true },
    },
  };
  document.components.schemas.ListEnvelope = {
    type: 'object',
    required: ['data', 'meta'],
    properties: {
      data: { type: 'array', items: { type: 'object', additionalProperties: true } },
      meta: ref('PaginationMeta'),
    },
  };

  for (const [path, pathItem] of Object.entries(document.paths)) {
    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      if (!operation) continue;
      const isPublicOperation = /^\/[^/]+\/v1\/public\/\{lang\}(?:\/|$)/.test(path);
      if (isPublicOperation) {
        operation.security = [];
        operation.parameters ??= [];
        if (
          !operation.parameters.some(
            (parameter) =>
              !('$ref' in parameter) &&
              parameter.in === 'header' &&
              parameter.name.toLowerCase() === 'if-none-match',
          )
        ) {
          operation.parameters.push({
            name: 'If-None-Match',
            in: 'header',
            required: false,
            description: 'Return 304 when the supplied entity tag still matches the representation',
            schema: { type: 'string' },
          });
        }
        operation.responses['304'] ??= {
          description: 'Not modified; the current ETag matched If-None-Match',
          headers: {
            ETag: { schema: { type: 'string' } },
            'Cache-Control': { schema: { type: 'string' } },
            'Content-Language': { schema: { type: 'string', enum: ['ro', 'ru'] } },
          },
        };
      }
      const status = successStatus(operation, method);
      const existing = operation.responses[status];
      const response: ApiResponse =
        existing && !('$ref' in existing)
          ? existing
          : { description: status === '204' ? 'No content' : 'Successful response' };
      if (isPublicOperation && !('$ref' in response)) {
        response.headers = {
          ...response.headers,
          ETag: {
            description: 'Strong entity tag for conditional revalidation',
            schema: { type: 'string' },
          },
          'Cache-Control': {
            description: 'Shared-cache policy requiring revalidation before reuse',
            schema: {
              type: 'string',
              example: 'public, max-age=0, s-maxage=0, must-revalidate',
            },
          },
          'Content-Language': {
            description: 'Requested API locale',
            schema: { type: 'string', enum: ['ro', 'ru'] },
          },
        };
      }
      const hasDocumentedJsonSchema =
        !('$ref' in response) && response.content?.['application/json']?.schema !== undefined;
      if (status !== '204' && !hasDocumentedJsonSchema) {
        const authSchemaName = authSuccessSchemaName(path, operation);
        const resourceName = resourceSchemaName(path, operation, method);
        const schemaName =
          authSchemaName ??
          (resourceName
            ? envelopeSchemaName(document, resourceName, isListOperation(operation))
            : isListOperation(operation)
              ? 'ListEnvelope'
              : 'DataEnvelope');
        response.content = {
          'application/json': {
            schema: { $ref: `#/components/schemas/${schemaName}` },
          },
        };
      }
      operation.responses[status] = response;
    }
  }
  applyPathParameterFormats(document);
  return document;
}

export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('National Equestrian Federation of Moldova API')
    .setDescription(
      'REST API for the information platform of the National Equestrian Federation of Moldova. Administrative routes require an ADMIN session, a second factor at login, and CSRF protection for mutations. Public routes expose only explicitly documented projections.',
    )
    .setVersion('1.0.0')
    .addCookieAuth(
      'fem_admin_session',
      { type: 'apiKey', in: 'cookie', description: 'Opaque ADMIN session cookie' },
      'adminSession',
    )
    .addTag('Countries')
    .addTag('Disciplines')
    .addTag('Clubs')
    .addTag('Owners')
    .addTag('Athletes')
    .addTag('Horses')
    .addTag('Competitions')
    .addTag('Competition Classes')
    .addTag('Results')
    .addTag('Audit')
    .addTag('Public API')
    .build();
  return applySuccessEnvelopeSchemas(SwaggerModule.createDocument(app, config));
}
