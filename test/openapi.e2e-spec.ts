import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import type { OpenAPIObject } from '@nestjs/swagger';

import { AppModule } from '../src/app.module';
import { configureHttpApplication } from '../src/bootstrap/configure-http-application';
import { createOpenApiDocument } from '../src/bootstrap/openapi';
import { assertSafeTestDatabaseEnvironment } from '../src/common/database/database-safety';
import { AppConfigService } from '../src/config/app-config.service';

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'] as const;
type PathItem = OpenAPIObject['paths'][string];
type PathOperation = NonNullable<PathItem['get']>;
type ComponentSchema = NonNullable<NonNullable<OpenAPIObject['components']>['schemas']>[string];

describe('OpenAPI contract (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    assertSafeTestDatabaseEnvironment(process.env);
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const config = moduleRef.get(AppConfigService);
    app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false });
    configureHttpApplication(app, config);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('documents a success envelope or explicit no-content response for every operation', () => {
    const document = createOpenApiDocument(app);
    const operations: PathOperation[] = [];
    for (const pathItem of Object.values(document.paths)) {
      for (const method of HTTP_METHODS) {
        const operation = pathItem[method];
        if (operation) operations.push(operation);
      }
    }

    expect(operations).toHaveLength(125);
    for (const operation of operations) {
      const success = Object.entries(operation.responses).find(([status]) =>
        /^2\d\d$/.test(status),
      );
      expect(success).toBeDefined();
      if (!success) continue;
      const [status, response] = success;
      if (status === '204') continue;
      expect(response).toBeDefined();
      if (!response) continue;
      const schema =
        '$ref' in response ? undefined : response.content?.['application/json']?.schema;
      const schemaReference = schema && '$ref' in schema ? schema.$ref : undefined;
      expect(schemaReference).toMatch(/^#\/components\/schemas\//);
    }
  });

  it('contains reusable data and paginated list envelope schemas', () => {
    const document = createOpenApiDocument(app);

    expect(document.components?.schemas).toMatchObject({
      DataEnvelope: { required: ['data'] },
      ListEnvelope: { required: ['data', 'meta'] },
    });
  });

  it('preserves the bare health contract and classifies nested list operations', () => {
    const document = createOpenApiDocument(app);
    const healthResponse = document.paths['/api/health']?.get?.responses['200'];
    const identifierResponse =
      document.paths['/api/v1/admin/athletes/{id}/identifiers']?.get?.responses['200'];

    const healthSchema =
      healthResponse && !('$ref' in healthResponse)
        ? healthResponse.content?.['application/json']?.schema
        : undefined;
    const identifierSchema =
      identifierResponse && !('$ref' in identifierResponse)
        ? identifierResponse.content?.['application/json']?.schema
        : undefined;

    expect(healthSchema && '$ref' in healthSchema ? healthSchema.$ref : undefined).toBe(
      '#/components/schemas/HealthResponseDto',
    );
    expect(identifierSchema && '$ref' in identifierSchema ? identifierSchema.$ref : undefined).toBe(
      '#/components/schemas/ExternalIdentifierListResponse',
    );

    const relationLists = [
      [
        '/api/v1/admin/athletes/{id}/clubs',
        '#/components/schemas/AthleteClubMembershipProjectionListResponse',
      ],
      [
        '/api/v1/admin/athletes/{id}/horses',
        '#/components/schemas/AthleteHorseRelationProjectionListResponse',
      ],
      [
        '/api/v1/admin/horses/{id}/owners',
        '#/components/schemas/HorseOwnershipProjectionListResponse',
      ],
      [
        '/api/v1/admin/competitions/{id}/classes',
        '#/components/schemas/CompetitionClassProjectionListResponse',
      ],
      [
        '/api/v1/admin/competitions/{id}/results',
        '#/components/schemas/CompetitionResultProjectionListResponse',
      ],
    ] as const;
    for (const [path, expectedReference] of relationLists) {
      const response = document.paths[path]?.get?.responses['200'];
      const schema =
        response && !('$ref' in response)
          ? response.content?.['application/json']?.schema
          : undefined;
      expect(schema && '$ref' in schema ? schema.$ref : undefined).toBe(expectedReference);
    }
  });

  it('documents resource properties instead of generic success objects', () => {
    const document = createOpenApiDocument(app);
    const athleteList = document.paths['/api/v1/admin/athletes']?.get?.responses['200'];
    const athleteSchema =
      athleteList && !('$ref' in athleteList)
        ? athleteList.content?.['application/json']?.schema
        : undefined;

    expect(athleteSchema && '$ref' in athleteSchema ? athleteSchema.$ref : undefined).toBe(
      '#/components/schemas/AthleteListItemListResponse',
    );
    const horseList = document.paths['/api/v1/admin/horses']?.get?.responses['200'];
    const horseListSchema =
      horseList && !('$ref' in horseList)
        ? horseList.content?.['application/json']?.schema
        : undefined;
    expect(horseListSchema && '$ref' in horseListSchema ? horseListSchema.$ref : undefined).toBe(
      '#/components/schemas/HorseListItemListResponse',
    );
    expect(document.components?.schemas?.AthleteListItem).toMatchObject({
      allOf: [
        { $ref: '#/components/schemas/Athlete' },
        {
          required: ['currentClubs', 'primaryIdentifier'],
          properties: {
            currentClubs: {
              type: 'array',
              items: { $ref: '#/components/schemas/CurrentClubProjection' },
            },
            primaryIdentifier: {
              allOf: [{ $ref: '#/components/schemas/ExternalIdentifierSummary' }],
              nullable: true,
            },
          },
        },
      ],
    });
    const athleteComponent = document.components?.schemas?.Athlete;
    expect(athleteComponent).toBeDefined();
    if (!athleteComponent || '$ref' in athleteComponent) return;
    expect(athleteComponent.required).toEqual(
      expect.arrayContaining(['id', 'firstName', 'lastName', 'displayName']),
    );
    expect(athleteComponent.properties?.id).toEqual({ type: 'string', format: 'uuid' });
    expect(athleteComponent.properties?.firstName).toEqual({ type: 'string' });
    expect(athleteComponent.properties?.archivedAt).toEqual({
      type: 'string',
      format: 'date-time',
      nullable: true,
    });
  });

  it('documents relation projections for detail responses', () => {
    const document = createOpenApiDocument(app);
    const expectations = [
      ['/api/v1/admin/athletes/{id}', 'AthleteDetailResponse', 'AthleteDetail'],
      ['/api/v1/admin/horses/{id}', 'HorseDetailResponse', 'HorseDetail'],
      ['/api/v1/admin/clubs/{id}', 'ClubDetailResponse', 'ClubDetail'],
      ['/api/v1/admin/owners/{id}', 'OwnerDetailResponse', 'OwnerDetail'],
      [
        '/api/v1/admin/competitions/{id}',
        'CompetitionEventDetailResponse',
        'CompetitionEventDetail',
      ],
      [
        '/api/v1/admin/competition-classes/{id}',
        'CompetitionClassDetailResponse',
        'CompetitionClassDetail',
      ],
      ['/api/v1/admin/results/{id}', 'CompetitionResultDetailResponse', 'CompetitionResultDetail'],
    ] as const;

    for (const [path, envelopeName, detailName] of expectations) {
      const response = document.paths[path]?.get?.responses['200'];
      const schema =
        response && !('$ref' in response)
          ? response.content?.['application/json']?.schema
          : undefined;
      expect(schema && '$ref' in schema ? schema.$ref : undefined).toBe(
        `#/components/schemas/${envelopeName}`,
      );
      expect(document.components?.schemas?.[detailName]).toBeDefined();
    }

    expect(document.components?.schemas?.AthleteDetail).toMatchObject({
      allOf: [
        { $ref: '#/components/schemas/Athlete' },
        {
          properties: {
            clubMemberships: {
              type: 'array',
              items: { $ref: '#/components/schemas/AthleteClubMembershipProjection' },
            },
            competitionResults: {
              type: 'array',
              items: { $ref: '#/components/schemas/CompetitionResultProjection' },
            },
          },
        },
      ],
    });
    expect(document.components?.schemas?.HorseDetail).toMatchObject({
      allOf: [
        { $ref: '#/components/schemas/Horse' },
        {
          required: [
            'countryOfBirth',
            'ownerships',
            'athleteRelations',
            'competitionResults',
            'externalIdentifiers',
          ],
          properties: {
            competitionResults: {
              type: 'array',
              items: { $ref: '#/components/schemas/CompetitionResultProjection' },
            },
            externalIdentifiers: {
              type: 'array',
              items: { $ref: '#/components/schemas/ExternalIdentifierSummary' },
            },
          },
        },
      ],
    });
  });

  it('marks identifier path parameters as UUIDs and documents payload limits', () => {
    const document = createOpenApiDocument(app);
    const invalidPathParameters: string[] = [];
    let requestBodyOperations = 0;

    for (const [path, pathItem] of Object.entries(document.paths)) {
      for (const method of HTTP_METHODS) {
        const operation = pathItem[method];
        if (!operation) continue;
        for (const parameter of operation.parameters ?? []) {
          if (
            !('$ref' in parameter) &&
            parameter.in === 'path' &&
            parameter.name !== 'slug' &&
            parameter.name !== 'lang' &&
            (!parameter.schema || '$ref' in parameter.schema || parameter.schema.format !== 'uuid')
          ) {
            invalidPathParameters.push(`${method.toUpperCase()} ${path}:${parameter.name}`);
          }
        }
        if (operation.requestBody) {
          requestBodyOperations += 1;
          expect(operation.responses['413']).toBeDefined();
        }
      }
    }

    expect(requestBodyOperations).toBeGreaterThan(0);
    expect(invalidPathParameters).toEqual([]);
  });

  it('documents locale-scoped Public operations with strict response components', () => {
    const document = createOpenApiDocument(app);
    const expectations = [
      ['/api/v1/public/{lang}/countries', 'PublicCountryListResponse'],
      ['/api/v1/public/{lang}/disciplines', 'PublicDisciplineListResponse'],
      ['/api/v1/public/{lang}/clubs', 'PublicClubListResponse'],
      ['/api/v1/public/{lang}/clubs/{id}', 'PublicClubResponse'],
      ['/api/v1/public/{lang}/athletes', 'PublicAthleteListResponse'],
      ['/api/v1/public/{lang}/athletes/{id}', 'PublicAthleteResponse'],
      ['/api/v1/public/{lang}/horses', 'PublicHorseListResponse'],
      ['/api/v1/public/{lang}/horses/{id}', 'PublicHorseResponse'],
      ['/api/v1/public/{lang}/competitions', 'PublicCompetitionListResponse'],
      ['/api/v1/public/{lang}/competitions/{slug}', 'PublicCompetitionResponse'],
      ['/api/v1/public/{lang}/competition-classes', 'PublicCompetitionClassListResponse'],
      ['/api/v1/public/{lang}/competition-classes/{id}', 'PublicCompetitionClassResponse'],
      ['/api/v1/public/{lang}/results', 'PublicCompetitionResultListResponse'],
      ['/api/v1/public/{lang}/results/{id}', 'PublicCompetitionResultResponse'],
    ] as const;

    for (const [path, schemaName] of expectations) {
      const operation = document.paths[path]?.get;
      const response = operation?.responses['200'];
      const schema =
        response && !('$ref' in response)
          ? response.content?.['application/json']?.schema
          : undefined;
      expect(operation?.security).toEqual([]);
      expect(operation?.responses['304']).toBeDefined();
      expect(
        operation?.parameters?.some(
          (parameter) => !('$ref' in parameter) && parameter.name === 'If-None-Match',
        ),
      ).toBe(true);
      const responseHeaders = response && !('$ref' in response) ? response.headers : undefined;
      expect(responseHeaders?.ETag).toBeDefined();
      expect(responseHeaders?.['Cache-Control']).toBeDefined();
      expect(responseHeaders?.['Content-Language']).toBeDefined();
      expect(schema && '$ref' in schema ? schema.$ref : undefined).toBe(
        `#/components/schemas/${schemaName}`,
      );
    }

    const athlete = document.components?.schemas?.PublicAthlete;
    expect(athlete && !('$ref' in athlete) ? athlete.additionalProperties : undefined).toBe(false);
    expect(athlete && !('$ref' in athlete) ? Object.keys(athlete.properties ?? {}) : []).toEqual(
      expect.arrayContaining(['id', 'firstName', 'lastName', 'displayName']),
    );
    expect(JSON.stringify(athlete)).not.toMatch(
      /dateOfBirth|gender|isDemo|archivedAt|createdAt|updatedAt/,
    );
    const langParameter = document.paths['/api/v1/public/{lang}/athletes']?.get?.parameters?.find(
      (parameter) => !('$ref' in parameter) && parameter.name === 'lang',
    );
    expect(
      langParameter && !('$ref' in langParameter) ? langParameter.schema : undefined,
    ).toMatchObject({ enum: ['ro', 'ru'] });
  });

  it('documents the ADMIN cookie, CSRF boundary and typed authentication responses', () => {
    const document = createOpenApiDocument(app);
    expect(document.components?.securitySchemes?.adminSession).toMatchObject({
      type: 'apiKey',
      in: 'cookie',
      name: 'fem_admin_session',
    });

    const login = document.paths['/api/v1/auth/login']?.post;
    const refresh = document.paths['/api/v1/auth/refresh']?.post;
    const startReenrollment = document.paths['/api/v1/auth/totp/re-enrollment']?.post;
    const confirmReenrollment = document.paths['/api/v1/auth/totp/re-enrollment/confirm']?.post;
    const me = document.paths['/api/v1/auth/me']?.get;
    const adminCreate = document.paths['/api/v1/admin/countries']?.post;
    const loginResponse = login?.responses['200'];
    const meResponse = me?.responses['200'];
    const loginSchema =
      loginResponse && !('$ref' in loginResponse)
        ? loginResponse.content?.['application/json']?.schema
        : undefined;
    const meSchema =
      meResponse && !('$ref' in meResponse)
        ? meResponse.content?.['application/json']?.schema
        : undefined;

    expect(login?.security ?? []).toEqual([]);
    expect(refresh?.security).toContainEqual({ adminSession: [] });
    expect(me?.security).toContainEqual({ adminSession: [] });
    expect(adminCreate?.security).toContainEqual({ adminSession: [] });
    expect(
      adminCreate?.parameters?.some(
        (parameter) => !('$ref' in parameter) && parameter.name === 'X-CSRF-Token',
      ),
    ).toBe(true);
    expect(loginSchema && '$ref' in loginSchema ? loginSchema.$ref : undefined).toBe(
      '#/components/schemas/AuthLoginResponse',
    );
    expect(meSchema && '$ref' in meSchema ? meSchema.$ref : undefined).toBe(
      '#/components/schemas/AdminIdentityResponse',
    );
    const schemas = document.components?.schemas;
    const adminIdentity = schemas?.AdminIdentity;
    const loginEnvelope = schemas?.AuthLoginResponse;
    expect(
      adminIdentity && !('$ref' in adminIdentity) ? adminIdentity.required : undefined,
    ).toEqual(expect.arrayContaining(['roles', 'permissions', 'secondFactorMethod']));
    expect(JSON.stringify(loginEnvelope)).toContain('"permissions"');
    const responseReference = (operation: PathOperation | undefined): string | undefined => {
      const response = operation?.responses['200'];
      const schema =
        response && !('$ref' in response)
          ? response.content?.['application/json']?.schema
          : undefined;
      return schema && '$ref' in schema ? schema.$ref : undefined;
    };
    expect(responseReference(refresh)).toBe('#/components/schemas/AuthLoginResponse');
    expect(responseReference(startReenrollment)).toBe(
      '#/components/schemas/TotpReenrollmentStartResponse',
    );
    expect(responseReference(confirmReenrollment)).toBe(
      '#/components/schemas/RecoveryCodesResponse',
    );
  });

  it('keeps every Admin PATCH route inside the optimistic-version entity inventory', () => {
    const document = createOpenApiDocument(app);
    const supportedPaths = [
      /^\/api\/v1\/admin\/countries\/\{id\}(?:\/archive|\/restore|\/publish|\/withdraw)?$/,
      /^\/api\/v1\/admin\/disciplines\/\{id\}(?:\/archive|\/restore|\/publish|\/withdraw)?$/,
      /^\/api\/v1\/admin\/clubs\/\{id\}(?:\/archive|\/restore|\/publish|\/withdraw)?$/,
      /^\/api\/v1\/admin\/owners\/\{id\}(?:\/archive|\/restore)?$/,
      /^\/api\/v1\/admin\/athletes\/\{id\}(?:\/archive|\/restore|\/publish|\/withdraw)?$/,
      /^\/api\/v1\/admin\/horses\/\{id\}(?:\/archive|\/restore|\/publish|\/withdraw)?$/,
      /^\/api\/v1\/admin\/competitions\/\{id\}(?:\/archive|\/restore|\/publish|\/withdraw)?$/,
      /^\/api\/v1\/admin\/competition-classes\/\{id\}(?:\/archive|\/restore)?$/,
      /^\/api\/v1\/admin\/results\/\{id\}(?:\/archive|\/restore|\/publish|\/withdraw)?$/,
      /^\/api\/v1\/admin\/athletes\/\{id\}\/clubs\/\{membershipId\}$/,
      /^\/api\/v1\/admin\/(?:athletes\/\{id\}\/horses|horses\/\{id\}\/athletes)\/\{relationId\}$/,
      /^\/api\/v1\/admin\/horses\/\{id\}\/owners\/\{ownershipId\}$/,
      /^\/api\/v1\/admin\/(?:athletes|horses|clubs)\/\{id\}\/identifiers\/\{identifierId\}$/,
      /^\/api\/v1\/admin\/results\/\{id\}\/metrics\/\{metricId\}$/,
    ];
    const unknownPatchPaths = Object.entries(document.paths)
      .filter(([path, pathItem]) => path.startsWith('/api/v1/admin/') && pathItem.patch)
      .map(([path]) => path)
      .filter((path) => !supportedPaths.some((pattern) => pattern.test(path)));

    expect(unknownPatchPaths).toEqual([]);
  });

  it('documents scalar query and request fields without empty Object fallbacks', () => {
    const document = createOpenApiDocument(app);
    const objectFallbackReferences: string[] = [];
    const unstructuredObjectFields: string[] = [];

    const inspectSchema = (schema: ComponentSchema | undefined, location: string): void => {
      if (!schema) return;
      if ('$ref' in schema) {
        if (schema.$ref === '#/components/schemas/Object') {
          objectFallbackReferences.push(location);
        }
        return;
      }
      for (const nested of schema.allOf ?? []) {
        inspectSchema(nested, location);
      }
      for (const [field, nested] of Object.entries(schema.properties ?? {})) {
        if (
          !('$ref' in nested) &&
          nested.type === 'object' &&
          nested.properties === undefined &&
          nested.additionalProperties === undefined
        ) {
          unstructuredObjectFields.push(`${location}.${field}`);
        }
      }
    };

    for (const [path, pathItem] of Object.entries(document.paths)) {
      for (const method of HTTP_METHODS) {
        const operation = pathItem[method];
        if (!operation) continue;
        for (const parameter of operation.parameters ?? []) {
          if ('$ref' in parameter) continue;
          inspectSchema(parameter.schema, `${method.toUpperCase()} ${path}?${parameter.name}`);
        }
        const requestBody = operation.requestBody;
        if (!requestBody || '$ref' in requestBody) continue;
        inspectSchema(
          requestBody.content['application/json']?.schema,
          `${method.toUpperCase()} ${path} body`,
        );
      }
    }

    expect(objectFallbackReferences).toEqual([]);
    expect(unstructuredObjectFields).toEqual([]);

    const athletePage = document.paths['/api/v1/admin/athletes']?.get?.parameters?.find(
      (parameter) => !('$ref' in parameter) && parameter.name === 'page',
    );
    expect(athletePage && !('$ref' in athletePage) ? athletePage.schema : undefined).toMatchObject({
      type: 'integer',
      minimum: 1,
      default: 1,
    });

    const createCompetition = document.components?.schemas?.CreateCompetitionDto;
    expect(
      createCompetition && !('$ref' in createCompetition) ? createCompetition.properties : {},
    ).toMatchObject({
      description: { type: 'string', nullable: true },
      countryId: { type: 'string', format: 'uuid', nullable: true },
      startDate: { type: 'string', format: 'date' },
    });
  });
});
