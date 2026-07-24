import { randomUUID } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { z } from 'zod';

import { AppModule } from '../src/app.module';
import { configureHttpApplication } from '../src/bootstrap/configure-http-application';
import { assertSafeTestDatabaseEnvironment } from '../src/common/database/database-safety';
import { AppConfigService } from '../src/config/app-config.service';
import { createAdminTestClient, type AdminTestClient } from './setup/admin-test-client';

const listEnvelopeSchema = z.object({
  data: z.array(z.record(z.string(), z.unknown())),
  meta: z.object({
    page: z.number().int(),
    limit: z.number().int(),
    total: z.number().int(),
    totalPages: z.number().int(),
  }),
});

const dataEnvelopeSchema = z.object({
  data: z.record(z.string(), z.unknown()),
});

const errorSchema = z.object({
  statusCode: z.number().int(),
  message: z.string(),
  code: z.string(),
  details: z.array(z.unknown()),
  requestId: z.string(),
});

const forbiddenPublicKeys = new Set([
  'version',
  'isDemo',
  'archivedAt',
  'publicationStatus',
  'sourceDocumentId',
  'sourceReference',
  'approvedAt',
  'approvedById',
  'createdAt',
  'updatedAt',
  'dateOfBirth',
  'gender',
  'externalIdentifiers',
  'ownerships',
  'storageKey',
  'normalizedValue',
]);

function collectForbiddenKeys(value: unknown, path = '$'): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => collectForbiddenKeys(entry, `${path}[${index}]`));
  }
  if (typeof value !== 'object' || value === null) return [];
  const findings: string[] = [];
  for (const [key, nested] of Object.entries(value)) {
    if (forbiddenPublicKeys.has(key)) findings.push(`${path}.${key}`);
    findings.push(...collectForbiddenKeys(nested, `${path}.${key}`));
  }
  return findings;
}

function validIds(...values: string[]): string[] {
  return values.filter((value) => z.uuid().safeParse(value).success);
}

function expectExactKeys(value: Record<string, unknown>, keys: string[]): void {
  expect(Object.keys(value).sort()).toEqual([...keys].sort());
}

async function uniqueCountryCodes(
  prisma: PrismaClient,
  seed: number,
): Promise<{ isoAlpha2: string; isoAlpha3: string }> {
  const existing = await prisma.country.findMany({
    select: { isoAlpha2: true, isoAlpha3: true },
  });
  const usedAlpha2 = new Set(existing.map((country) => country.isoAlpha2.trim()));
  const usedAlpha3 = new Set(existing.map((country) => country.isoAlpha3.trim()));
  for (let offset = 0; offset < 26 * 26 * 26; offset += 1) {
    const value = (seed + offset) % (26 * 26 * 26);
    const first = String.fromCharCode(65 + (Math.floor(value / (26 * 26)) % 26));
    const second = String.fromCharCode(65 + (Math.floor(value / 26) % 26));
    const third = String.fromCharCode(65 + (value % 26));
    const isoAlpha2 = `${first}${second}`;
    const isoAlpha3 = `${first}${second}${third}`;
    if (!usedAlpha2.has(isoAlpha2) && !usedAlpha3.has(isoAlpha3)) {
      return { isoAlpha2, isoAlpha3 };
    }
  }
  throw new Error('No unused synthetic country code is available for the test fixture');
}

describe('Public API visibility and contract (e2e)', () => {
  const prisma = new PrismaClient();
  const suffix = randomUUID().replaceAll('-', '');
  const fixture = {
    countryId: '',
    federationId: '',
    disciplineId: '',
    clubId: '',
    membershipId: '',
    athleteId: '',
    horseId: '',
    statusId: '',
    eventId: '',
    eventSlug: `public-event-${suffix.slice(0, 12)}`,
    classId: '',
    rankedResultId: '',
    statusOnlyResultId: '',
    draftResultId: '',
    draftEventId: '',
    draftEventSlug: `draft-event-${suffix.slice(0, 12)}`,
    demoCountryId: '',
    demoDisciplineId: '',
    demoAthleteId: '',
    demoHorseId: '',
    demoEventId: '',
    demoEventSlug: `demo-event-${suffix.slice(0, 12)}`,
    demoClassId: '',
    demoResultId: '',
  };
  let app: NestExpressApplication;
  let adminRequest: AdminTestClient;
  let allowedCorsOrigin: string;

  beforeAll(async () => {
    assertSafeTestDatabaseEnvironment(process.env);
    await prisma.$connect();
    const officialCodes = await uniqueCountryCodes(prisma, Number.parseInt(suffix.slice(0, 6), 16));
    const country = await prisma.country.create({
      data: {
        ...officialCodes,
        name: `Public Country ${suffix.slice(0, 8)}`,
        publicationStatus: 'PUBLISHED',
        publishedAt: new Date(Date.now() - 120_000),
      },
    });
    fixture.countryId = country.id;
    const federation = await prisma.nationalFederation.create({
      data: {
        countryId: country.id,
        name: `Public Federation ${suffix.slice(0, 8)}`,
        shortName: `PF${suffix.slice(0, 4)}`,
        websiteUrl: 'https://example.test/federation',
        status: 'ACTIVE',
      },
    });
    fixture.federationId = federation.id;
    const discipline = await prisma.discipline.create({
      data: {
        code: `PUBLIC_${suffix.slice(0, 12)}`,
        name: `Public Discipline ${suffix.slice(0, 8)}`,
        description: 'Public discipline description',
        status: 'ACTIVE',
        publicationStatus: 'PUBLISHED',
        publishedAt: new Date(Date.now() - 110_000),
      },
    });
    fixture.disciplineId = discipline.id;
    const club = await prisma.club.create({
      data: {
        name: `Public Club ${suffix.slice(0, 8)}`,
        legalName: 'Internal legal name must not leak',
        countryId: country.id,
        nationalFederationId: federation.id,
        status: 'ACTIVE',
        publicationStatus: 'PUBLISHED',
        publishedAt: new Date(Date.now() - 100_000),
      },
    });
    fixture.clubId = club.id;
    const athlete = await prisma.athlete.create({
      data: {
        firstName: 'Public',
        lastName: `Athlete ${suffix.slice(0, 6)}`,
        displayName: `Public Athlete ${suffix.slice(0, 6)}`,
        dateOfBirth: new Date('2000-01-01T00:00:00.000Z'),
        gender: 'PRIVATE_TEST_VALUE',
        countryId: country.id,
        nationalFederationId: federation.id,
        status: 'ACTIVE',
        publicationStatus: 'PUBLISHED',
        publishedAt: new Date(Date.now() - 90_000),
      },
    });
    fixture.athleteId = athlete.id;
    const horse = await prisma.horse.create({
      data: {
        passportName: `PUBLIC PASSPORT NAME ${suffix.slice(0, 6)}`,
        displayName: `Public Horse ${suffix.slice(0, 6)}`,
        dateOfBirth: new Date('2014-02-03T00:00:00.000Z'),
        birthYear: 2014,
        sex: 'GELDING',
        breed: 'Fictional sport horse',
        color: 'Bay',
        studbook: 'Fictional studbook',
        countryOfBirthId: country.id,
        status: 'ACTIVE',
        publicationStatus: 'PUBLISHED',
        publishedAt: new Date(Date.now() - 80_000),
      },
    });
    fixture.horseId = horse.id;
    const membership = await prisma.athleteClubMembership.create({
      data: {
        athleteId: athlete.id,
        clubId: club.id,
        startDate: new Date('2020-01-01T00:00:00.000Z'),
      },
    });
    fixture.membershipId = membership.id;
    const status = await prisma.resultStatus.create({
      data: {
        code: `PUBLIC_STATUS_${suffix.slice(0, 10)}`,
        label: 'Public status-only result',
        description: 'No ranking position is required',
        sortOrder: 10,
        status: 'ACTIVE',
      },
    });
    fixture.statusId = status.id;
    const event = await prisma.competitionEvent.create({
      data: {
        title: `Public Event ${suffix.slice(0, 8)}`,
        slug: fixture.eventSlug,
        description: 'Published public event',
        startDate: new Date('2025-05-10T00:00:00.000Z'),
        endDate: new Date('2025-05-12T00:00:00.000Z'),
        location: 'Chisinau',
        venue: 'Fictional Arena',
        organizerName: 'FEM test organizer',
        countryId: country.id,
        status: 'ACTIVE',
        publicationStatus: 'PUBLISHED',
        publishedAt: new Date(Date.now() - 60_000),
      },
    });
    fixture.eventId = event.id;
    const competitionClass = await prisma.competitionClass.create({
      data: {
        competitionEventId: event.id,
        disciplineId: discipline.id,
        title: `Public Class ${suffix.slice(0, 8)}`,
        category: 'Provisional category',
        level: 'Provisional level',
        competitionDate: new Date('2025-05-11T00:00:00.000Z'),
        sortOrder: 1,
        status: 'ACTIVE',
      },
    });
    fixture.classId = competitionClass.id;
    const ranked = await prisma.competitionResult.create({
      data: {
        competitionClassId: competitionClass.id,
        athleteId: athlete.id,
        horseId: horse.id,
        rank: 1,
        resultDisplay: 'Public ranked result',
        points: '10.5',
        publicationStatus: 'PUBLISHED',
        publishedAt: new Date(Date.now() - 30_000),
        sourceReference: 'PRIVATE SOURCE REFERENCE',
        metrics: {
          create: {
            metricCode: 'PUBLIC_METRIC',
            numericValue: '7.25',
            unit: 'points',
            sortOrder: 1,
          },
        },
      },
    });
    fixture.rankedResultId = ranked.id;
    const statusOnly = await prisma.competitionResult.create({
      data: {
        competitionClassId: competitionClass.id,
        athleteId: athlete.id,
        horseId: horse.id,
        rank: null,
        statusId: status.id,
        resultDisplay: 'Status only',
        publicationStatus: 'PUBLISHED',
        publishedAt: new Date(Date.now() - 20_000),
      },
    });
    fixture.statusOnlyResultId = statusOnly.id;
    const draftResult = await prisma.competitionResult.create({
      data: {
        competitionClassId: competitionClass.id,
        athleteId: athlete.id,
        horseId: horse.id,
        rank: 2,
        resultDisplay: 'Draft result awaiting publication',
      },
    });
    fixture.draftResultId = draftResult.id;
    const draftEvent = await prisma.competitionEvent.create({
      data: {
        title: `Draft Event ${suffix.slice(0, 8)}`,
        slug: fixture.draftEventSlug,
        startDate: new Date('2025-06-01T00:00:00.000Z'),
        endDate: new Date('2025-06-02T00:00:00.000Z'),
        countryId: country.id,
        status: 'ACTIVE',
        publicationStatus: 'DRAFT',
      },
    });
    fixture.draftEventId = draftEvent.id;

    const demoCodes = await uniqueCountryCodes(prisma, Number.parseInt(suffix.slice(6, 12), 16));
    const demoCountry = await prisma.country.create({
      data: {
        ...demoCodes,
        name: `Demo Public Country ${suffix.slice(0, 8)}`,
        isDemo: true,
      },
    });
    fixture.demoCountryId = demoCountry.id;
    const demoDiscipline = await prisma.discipline.create({
      data: {
        code: `DEMO_PUBLIC_${suffix.slice(0, 10)}`,
        name: `Demo Public Discipline ${suffix.slice(0, 8)}`,
        status: 'ACTIVE',
        isDemo: true,
      },
    });
    fixture.demoDisciplineId = demoDiscipline.id;
    const demoAthlete = await prisma.athlete.create({
      data: {
        firstName: 'Demo',
        lastName: 'Hidden',
        displayName: `Demo Hidden Athlete ${suffix.slice(0, 6)}`,
        countryId: demoCountry.id,
        status: 'ACTIVE',
        isDemo: true,
      },
    });
    fixture.demoAthleteId = demoAthlete.id;
    const demoHorse = await prisma.horse.create({
      data: {
        displayName: `Demo Hidden Horse ${suffix.slice(0, 6)}`,
        countryOfBirthId: demoCountry.id,
        status: 'ACTIVE',
        isDemo: true,
      },
    });
    fixture.demoHorseId = demoHorse.id;
    const demoEvent = await prisma.competitionEvent.create({
      data: {
        title: `Demo Hidden Event ${suffix.slice(0, 8)}`,
        slug: fixture.demoEventSlug,
        startDate: new Date('2025-07-01T00:00:00.000Z'),
        endDate: new Date('2025-07-02T00:00:00.000Z'),
        countryId: demoCountry.id,
        status: 'ACTIVE',
        publicationStatus: 'PUBLISHED',
        publishedAt: new Date(Date.now() - 10_000),
        isDemo: true,
      },
    });
    fixture.demoEventId = demoEvent.id;
    const demoClass = await prisma.competitionClass.create({
      data: {
        competitionEventId: demoEvent.id,
        disciplineId: demoDiscipline.id,
        title: `Demo Hidden Class ${suffix.slice(0, 8)}`,
        status: 'ACTIVE',
        isDemo: true,
      },
    });
    fixture.demoClassId = demoClass.id;
    const demoResult = await prisma.competitionResult.create({
      data: {
        competitionClassId: demoClass.id,
        athleteId: demoAthlete.id,
        horseId: demoHorse.id,
        rank: 1,
        publicationStatus: 'PUBLISHED',
        publishedAt: new Date(Date.now() - 5_000),
        isDemo: true,
      },
    });
    fixture.demoResultId = demoResult.id;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const config = moduleRef.get(AppConfigService);
    const [configuredCorsOrigin] = config.corsAllowedOrigins;
    if (configuredCorsOrigin === undefined) {
      throw new Error('CORS_ALLOWED_ORIGINS must contain a test origin');
    }
    allowedCorsOrigin = configuredCorsOrigin;
    app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false });
    configureHttpApplication(app, config);
    await app.init();
    adminRequest = await createAdminTestClient(app);
  });

  afterAll(async () => {
    await prisma.resultMetric.deleteMany({
      where: {
        competitionResultId: {
          in: [
            ...validIds(
              fixture.rankedResultId,
              fixture.statusOnlyResultId,
              fixture.draftResultId,
              fixture.demoResultId,
            ),
          ],
        },
      },
    });
    await prisma.competitionResult.deleteMany({
      where: {
        id: {
          in: validIds(
            fixture.rankedResultId,
            fixture.statusOnlyResultId,
            fixture.draftResultId,
            fixture.demoResultId,
          ),
        },
      },
    });
    await prisma.athleteClubMembership.deleteMany({
      where: { id: { in: validIds(fixture.membershipId) } },
    });
    await prisma.competitionClass.deleteMany({
      where: { id: { in: validIds(fixture.classId, fixture.demoClassId) } },
    });
    await prisma.competitionEvent.deleteMany({
      where: {
        id: { in: validIds(fixture.eventId, fixture.draftEventId, fixture.demoEventId) },
      },
    });
    await prisma.resultStatus.deleteMany({
      where: { id: { in: validIds(fixture.statusId) } },
    });
    await prisma.club.deleteMany({ where: { id: { in: validIds(fixture.clubId) } } });
    await prisma.athlete.deleteMany({
      where: { id: { in: validIds(fixture.athleteId, fixture.demoAthleteId) } },
    });
    await prisma.horse.deleteMany({
      where: { id: { in: validIds(fixture.horseId, fixture.demoHorseId) } },
    });
    await prisma.nationalFederation.deleteMany({
      where: { id: { in: validIds(fixture.federationId) } },
    });
    await prisma.discipline.deleteMany({
      where: { id: { in: validIds(fixture.disciplineId, fixture.demoDisciplineId) } },
    });
    await prisma.country.deleteMany({
      where: { id: { in: validIds(fixture.countryId, fixture.demoCountryId) } },
    });
    await app.close();
    await prisma.$disconnect();
  });

  it('serves every public resource without authentication and without internal fields', async () => {
    const paths = [
      '/api/v1/public/ro/countries',
      '/api/v1/public/ro/disciplines',
      '/api/v1/public/ro/clubs',
      `/api/v1/public/ro/clubs/${fixture.clubId}`,
      '/api/v1/public/ro/athletes',
      `/api/v1/public/ro/athletes/${fixture.athleteId}`,
      '/api/v1/public/ro/horses',
      `/api/v1/public/ro/horses/${fixture.horseId}`,
      '/api/v1/public/ro/competitions',
      `/api/v1/public/ro/competitions/${fixture.eventSlug}`,
      '/api/v1/public/ro/competition-classes',
      `/api/v1/public/ro/competition-classes/${fixture.classId}`,
      '/api/v1/public/ro/results',
      `/api/v1/public/ro/results/${fixture.rankedResultId}`,
    ];

    for (const path of paths) {
      const response = await request(app.getHttpServer())
        .get(path)
        .set('Cookie', 'fem_admin_session=invalid-public-cookie')
        .expect(200);
      expect(response.headers['set-cookie']).toBeUndefined();
      expect(response.headers['content-language']).toBe('ro');
      expect(response.headers['cache-control']).toContain('public');
      expect(collectForbiddenKeys(response.body as unknown)).toEqual([]);
    }
  });

  it('returns separate strict public projections and decimal strings', async () => {
    const country = await request(app.getHttpServer())
      .get('/api/v1/public/ru/countries')
      .query({ search: 'Public Country', limit: 100 })
      .expect(200);
    const countryData = listEnvelopeSchema
      .parse(country.body)
      .data.find((entry) => entry.id === fixture.countryId);
    expect(countryData).toBeDefined();
    expectExactKeys(countryData ?? {}, ['id', 'isoAlpha2', 'isoAlpha3', 'name']);

    const discipline = await request(app.getHttpServer())
      .get('/api/v1/public/ru/disciplines')
      .query({ search: 'Public Discipline', limit: 100 })
      .expect(200);
    const disciplineData = listEnvelopeSchema
      .parse(discipline.body)
      .data.find((entry) => entry.id === fixture.disciplineId);
    expect(disciplineData).toBeDefined();
    expectExactKeys(disciplineData ?? {}, ['id', 'code', 'name', 'description']);

    const club = await request(app.getHttpServer())
      .get(`/api/v1/public/ru/clubs/${fixture.clubId}`)
      .expect(200);
    expectExactKeys(dataEnvelopeSchema.parse(club.body).data, [
      'id',
      'name',
      'country',
      'nationalFederation',
    ]);

    const athlete = await request(app.getHttpServer())
      .get(`/api/v1/public/ru/athletes/${fixture.athleteId}`)
      .expect(200);
    const athleteBody = dataEnvelopeSchema.parse(athlete.body);
    expect(Object.keys(athleteBody.data).sort()).toEqual(
      ['country', 'displayName', 'firstName', 'id', 'lastName', 'nationalFederation'].sort(),
    );

    const horse = await request(app.getHttpServer())
      .get(`/api/v1/public/ru/horses/${fixture.horseId}`)
      .expect(200);
    expectExactKeys(dataEnvelopeSchema.parse(horse.body).data, [
      'id',
      'passportName',
      'displayName',
      'birthYear',
      'sex',
      'breed',
      'color',
      'studbook',
      'countryOfBirth',
    ]);

    const competition = await request(app.getHttpServer())
      .get(`/api/v1/public/ru/competitions/${fixture.eventSlug}`)
      .expect(200);
    expectExactKeys(dataEnvelopeSchema.parse(competition.body).data, [
      'id',
      'slug',
      'title',
      'description',
      'startDate',
      'endDate',
      'location',
      'venue',
      'organizerName',
      'publishedAt',
      'country',
    ]);

    const competitionClass = await request(app.getHttpServer())
      .get(`/api/v1/public/ru/competition-classes/${fixture.classId}`)
      .expect(200);
    expectExactKeys(dataEnvelopeSchema.parse(competitionClass.body).data, [
      'id',
      'title',
      'category',
      'level',
      'competitionDate',
      'sortOrder',
      'discipline',
      'competitionEvent',
    ]);

    const result = await request(app.getHttpServer())
      .get(`/api/v1/public/ru/results/${fixture.rankedResultId}`)
      .expect(200);
    const resultBody = dataEnvelopeSchema.parse(result.body);
    expectExactKeys(resultBody.data, [
      'id',
      'rank',
      'resultDisplay',
      'penalties',
      'timeSeconds',
      'points',
      'bonus',
      'publishedAt',
      'competitionClass',
      'athlete',
      'horse',
      'status',
      'metrics',
    ]);
    expect(resultBody.data.points).toBe('10.5');
    expect(resultBody.data).not.toHaveProperty('sourceReference');
    expect(resultBody.data.metrics).toEqual([
      {
        metricCode: 'PUBLIC_METRIC',
        numericValue: '7.25',
        textValue: null,
        unit: 'points',
        sortOrder: 1,
      },
    ]);
  });

  it('filters draft and demo events and returns indistinguishable not-found errors', async () => {
    const list = await request(app.getHttpServer())
      .get('/api/v1/public/ro/competitions')
      .query({ limit: 100 })
      .expect(200);
    const body = listEnvelopeSchema.parse(list.body);
    const ids = body.data.map((row) => row.id);
    expect(ids).toContain(fixture.eventId);
    expect(ids).not.toContain(fixture.draftEventId);
    expect(ids).not.toContain(fixture.demoEventId);

    const hidden = await request(app.getHttpServer())
      .get(`/api/v1/public/ro/competitions/${fixture.draftEventSlug}`)
      .expect(404);
    const unknown = await request(app.getHttpServer())
      .get(`/api/v1/public/ro/competitions/unknown-${suffix}`)
      .expect(404);
    const hiddenError = errorSchema.parse(hidden.body);
    const unknownError = errorSchema.parse(unknown.body);
    expect({
      statusCode: hiddenError.statusCode,
      message: hiddenError.message,
      code: hiddenError.code,
    }).toEqual({
      statusCode: unknownError.statusCode,
      message: unknownError.message,
      code: unknownError.code,
    });
    expect(hidden.headers['cache-control']).toBe('no-store');
  });

  it('fails closed when any published-result ancestor becomes hidden', async () => {
    const resultPath = `/api/v1/public/ro/results/${fixture.rankedResultId}`;
    await request(app.getHttpServer()).get(resultPath).expect(200);

    await prisma.competitionEvent.update({
      where: { id: fixture.eventId },
      data: { publicationStatus: 'WITHDRAWN' },
    });
    await request(app.getHttpServer()).get(resultPath).expect(404);
    await prisma.competitionEvent.update({
      where: { id: fixture.eventId },
      data: { publicationStatus: 'PUBLISHED' },
    });

    await prisma.competitionClass.update({
      where: { id: fixture.classId },
      data: { status: 'DRAFT' },
    });
    await request(app.getHttpServer()).get(resultPath).expect(404);
    await prisma.competitionClass.update({
      where: { id: fixture.classId },
      data: { status: 'ACTIVE' },
    });

    await prisma.athlete.update({
      where: { id: fixture.athleteId },
      data: { archivedAt: new Date() },
    });
    await request(app.getHttpServer()).get(resultPath).expect(404);
    await prisma.athlete.update({
      where: { id: fixture.athleteId },
      data: { archivedAt: null },
    });

    await prisma.horse.update({
      where: { id: fixture.horseId },
      data: { publicationStatus: 'WITHDRAWN' },
    });
    await request(app.getHttpServer()).get(resultPath).expect(404);
    await prisma.horse.update({
      where: { id: fixture.horseId },
      data: { publicationStatus: 'PUBLISHED' },
    });

    await prisma.resultStatus.update({
      where: { id: fixture.statusId },
      data: { archivedAt: new Date() },
    });
    await request(app.getHttpServer())
      .get(`/api/v1/public/ro/results/${fixture.statusOnlyResultId}`)
      .expect(404);
    await prisma.resultStatus.update({
      where: { id: fixture.statusId },
      data: { archivedAt: null },
    });
    await request(app.getHttpServer()).get(resultPath).expect(200);
  });

  it('does not allow a generic update to bypass competition withdrawal controls', async () => {
    const response = await adminRequest
      .patch(`/api/v1/admin/competitions/${fixture.eventId}`)
      .send({ status: 'DRAFT' });
    try {
      expect(response.status).toBe(409);
      expect(errorSchema.parse(response.body).code).toBe(
        'PUBLISHED_EVENT_STATUS_REQUIRES_WITHDRAWAL',
      );
    } finally {
      await prisma.competitionEvent.update({
        where: { id: fixture.eventId },
        data: { status: 'ACTIVE' },
      });
    }
  });

  it('refuses publication when a result dependency is not publicly visible', async () => {
    const result = await prisma.competitionResult.create({
      data: {
        competitionClassId: fixture.classId,
        athleteId: fixture.athleteId,
        horseId: fixture.horseId,
        rank: 9,
        statusId: fixture.statusId,
      },
    });

    const expectBlockedWhile = async (
      hide: () => Promise<unknown>,
      restore: () => Promise<unknown>,
    ): Promise<void> => {
      await hide();
      const response = await adminRequest.patch(`/api/v1/admin/results/${result.id}/publish`);
      await restore();
      expect(response.status).toBe(409);
      expect(errorSchema.parse(response.body).code).toBe('PUBLICATION_DEPENDENCY_INVALID');
    };

    try {
      await expectBlockedWhile(
        () =>
          prisma.discipline.update({
            where: { id: fixture.disciplineId },
            data: { publicationStatus: 'WITHDRAWN' },
          }),
        () =>
          prisma.discipline.update({
            where: { id: fixture.disciplineId },
            data: { publicationStatus: 'PUBLISHED' },
          }),
      );
      await expectBlockedWhile(
        () =>
          prisma.country.update({
            where: { id: fixture.countryId },
            data: { publicationStatus: 'WITHDRAWN' },
          }),
        () =>
          prisma.country.update({
            where: { id: fixture.countryId },
            data: { publicationStatus: 'PUBLISHED' },
          }),
      );
      await expectBlockedWhile(
        () =>
          prisma.nationalFederation.update({
            where: { id: fixture.federationId },
            data: { archivedAt: new Date() },
          }),
        () =>
          prisma.nationalFederation.update({
            where: { id: fixture.federationId },
            data: { archivedAt: null },
          }),
      );
      await expectBlockedWhile(
        () =>
          prisma.competitionClass.update({
            where: { id: fixture.classId },
            data: { status: 'DRAFT' },
          }),
        () =>
          prisma.competitionClass.update({
            where: { id: fixture.classId },
            data: { status: 'ACTIVE' },
          }),
      );
      await expectBlockedWhile(
        () =>
          prisma.athlete.update({
            where: { id: fixture.athleteId },
            data: { publicationStatus: 'WITHDRAWN' },
          }),
        () =>
          prisma.athlete.update({
            where: { id: fixture.athleteId },
            data: { publicationStatus: 'PUBLISHED' },
          }),
      );
      await expectBlockedWhile(
        () =>
          prisma.horse.update({
            where: { id: fixture.horseId },
            data: { publicationStatus: 'WITHDRAWN' },
          }),
        () =>
          prisma.horse.update({
            where: { id: fixture.horseId },
            data: { publicationStatus: 'PUBLISHED' },
          }),
      );
      await expectBlockedWhile(
        () =>
          prisma.resultStatus.update({
            where: { id: fixture.statusId },
            data: { archivedAt: new Date() },
          }),
        () =>
          prisma.resultStatus.update({
            where: { id: fixture.statusId },
            data: { archivedAt: null },
          }),
      );
    } finally {
      await prisma.country.update({
        where: { id: fixture.countryId },
        data: { archivedAt: null, publicationStatus: 'PUBLISHED' },
      });
      await prisma.nationalFederation.update({
        where: { id: fixture.federationId },
        data: { archivedAt: null },
      });
      await prisma.discipline.update({
        where: { id: fixture.disciplineId },
        data: { archivedAt: null, publicationStatus: 'PUBLISHED' },
      });
      await prisma.competitionClass.update({
        where: { id: fixture.classId },
        data: { status: 'ACTIVE' },
      });
      await prisma.athlete.update({
        where: { id: fixture.athleteId },
        data: { status: 'ACTIVE', publicationStatus: 'PUBLISHED' },
      });
      await prisma.horse.update({
        where: { id: fixture.horseId },
        data: { status: 'ACTIVE', publicationStatus: 'PUBLISHED' },
      });
      await prisma.resultStatus.update({
        where: { id: fixture.statusId },
        data: { archivedAt: null },
      });
      await prisma.competitionResult.delete({ where: { id: result.id } });
    }
  });

  it('requires cache revalidation and rejects one-character public searches', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/public/ro/athletes')
      .expect(200);
    expect(response.headers['cache-control']).toBe(
      'public, max-age=0, s-maxage=0, must-revalidate',
    );

    await request(app.getHttpServer())
      .get('/api/v1/public/ro/athletes')
      .query({ search: 'a' })
      .expect(400);
  });

  it('publishes and withdraws through protected, audited admin commands', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/public/ro/competitions/${fixture.draftEventSlug}`)
      .expect(404);
    await adminRequest
      .patchWithVersion(`/api/v1/admin/competitions/${fixture.draftEventId}/publish`, 1)
      .expect(400);
    await prisma.country.update({
      where: { id: fixture.countryId },
      data: { publicationStatus: 'WITHDRAWN' },
    });
    const hiddenCountryPublish = await adminRequest.patch(
      `/api/v1/admin/competitions/${fixture.draftEventId}/publish`,
    );
    expect(hiddenCountryPublish.status).toBe(409);
    expect(errorSchema.parse(hiddenCountryPublish.body).code).toBe(
      'PUBLICATION_DEPENDENCY_INVALID',
    );
    await prisma.country.update({
      where: { id: fixture.countryId },
      data: { publicationStatus: 'PUBLISHED' },
    });
    const publishEvent = await adminRequest
      .patch(`/api/v1/admin/competitions/${fixture.draftEventId}/publish`)
      .expect(200);
    const publishedEvent = dataEnvelopeSchema.parse(publishEvent.body);
    expect(publishedEvent.data).toMatchObject({ publicationStatus: 'PUBLISHED' });
    await request(app.getHttpServer())
      .get(`/api/v1/public/ro/competitions/${fixture.draftEventSlug}`)
      .expect(200);
    await adminRequest
      .patch(`/api/v1/admin/competitions/${fixture.draftEventId}/publish`)
      .expect(409);
    await adminRequest
      .patch(`/api/v1/admin/competitions/${fixture.draftEventId}`)
      .send({ slug: `changed-${fixture.draftEventSlug}` })
      .expect(409);
    await adminRequest
      .patch(`/api/v1/admin/competitions/${fixture.draftEventId}/withdraw`)
      .expect(200);
    await request(app.getHttpServer())
      .get(`/api/v1/public/ro/competitions/${fixture.draftEventSlug}`)
      .expect(404);

    await request(app.getHttpServer())
      .get(`/api/v1/public/ro/results/${fixture.draftResultId}`)
      .expect(404);
    await adminRequest.patch(`/api/v1/admin/results/${fixture.draftResultId}/publish`).expect(200);
    await request(app.getHttpServer())
      .get(`/api/v1/public/ro/results/${fixture.draftResultId}`)
      .expect(200);
    await adminRequest
      .patch(`/api/v1/admin/results/${fixture.draftResultId}`)
      .send({ rank: 3 })
      .expect(409);
    await adminRequest.patch(`/api/v1/admin/results/${fixture.draftResultId}/withdraw`).expect(200);
    await request(app.getHttpServer())
      .get(`/api/v1/public/ro/results/${fixture.draftResultId}`)
      .expect(404);
    await adminRequest
      .patch(`/api/v1/admin/results/${fixture.draftResultId}`)
      .send({ rank: 3 })
      .expect(200);
    await adminRequest
      .post(`/api/v1/admin/results/${fixture.draftResultId}/metrics`)
      .send({ metricCode: 'CORRECTION', textValue: 'Reviewed correction', sortOrder: 2 })
      .expect(201);
    await adminRequest.patch(`/api/v1/admin/results/${fixture.draftResultId}/publish`).expect(200);
    const corrected = await request(app.getHttpServer())
      .get(`/api/v1/public/ro/results/${fixture.draftResultId}`)
      .expect(200);
    expect(dataEnvelopeSchema.parse(corrected.body).data.rank).toBe(3);
    await adminRequest.patch(`/api/v1/admin/results/${fixture.draftResultId}/withdraw`).expect(200);

    const audit = await prisma.auditLog.findMany({
      where: {
        OR: [
          { entityType: 'CompetitionEvent', entityId: fixture.draftEventId },
          { entityType: 'CompetitionResult', entityId: fixture.draftResultId },
        ],
      },
      select: { action: true, reason: true },
    });
    expect(audit.map((entry) => entry.action)).toEqual(
      expect.arrayContaining(['PUBLISH', 'WITHDRAW']),
    );
    expect(audit.every((entry) => typeof entry.reason === 'string')).toBe(true);
  });

  it('requires an explicit publication decision for every public profile type', async () => {
    const cases = [
      {
        adminPath: `/api/v1/admin/countries/${fixture.countryId}`,
        publicPath: '/api/v1/public/ro/countries',
        search: 'Public Country',
        id: fixture.countryId,
        update: { name: `Public Country ${suffix.slice(0, 8)}` },
      },
      {
        adminPath: `/api/v1/admin/disciplines/${fixture.disciplineId}`,
        publicPath: '/api/v1/public/ro/disciplines',
        search: 'Public Discipline',
        id: fixture.disciplineId,
        update: { name: `Public Discipline ${suffix.slice(0, 8)}` },
      },
      {
        adminPath: `/api/v1/admin/clubs/${fixture.clubId}`,
        publicPath: '/api/v1/public/ro/clubs',
        search: 'Public Club',
        id: fixture.clubId,
        update: { name: `Public Club ${suffix.slice(0, 8)}` },
      },
      {
        adminPath: `/api/v1/admin/athletes/${fixture.athleteId}`,
        publicPath: '/api/v1/public/ro/athletes',
        search: 'Public Athlete',
        id: fixture.athleteId,
        update: { displayName: `Public Athlete ${suffix.slice(0, 6)}` },
      },
      {
        adminPath: `/api/v1/admin/horses/${fixture.horseId}`,
        publicPath: '/api/v1/public/ro/horses',
        search: 'Public Horse',
        id: fixture.horseId,
        update: { displayName: `Public Horse ${suffix.slice(0, 6)}` },
      },
    ];

    for (const profile of cases) {
      const blockedUpdate = await adminRequest.patch(profile.adminPath).send(profile.update);
      expect(blockedUpdate.status).toBe(409);
      expect(errorSchema.parse(blockedUpdate.body).code).toBe('PUBLISHED_RESOURCE_IMMUTABLE');

      await adminRequest.patch(`${profile.adminPath}/withdraw`).expect(200);
      const hidden = await request(app.getHttpServer())
        .get(profile.publicPath)
        .query({ search: profile.search, limit: 100 })
        .expect(200);
      expect(listEnvelopeSchema.parse(hidden.body).data.map((entry) => entry.id)).not.toContain(
        profile.id,
      );

      await adminRequest.patch(`${profile.adminPath}/publish`).expect(200);
      const visible = await request(app.getHttpServer())
        .get(profile.publicPath)
        .query({ search: profile.search, limit: 100 })
        .expect(200);
      expect(listEnvelopeSchema.parse(visible.body).data.map((entry) => entry.id)).toContain(
        profile.id,
      );
    }
  });

  it('keeps inactive historical profiles visible while excluding draft profiles', async () => {
    await prisma.athlete.update({
      where: { id: fixture.athleteId },
      data: { status: 'INACTIVE' },
    });
    await request(app.getHttpServer())
      .get(`/api/v1/public/ro/athletes/${fixture.athleteId}`)
      .expect(200);
    await request(app.getHttpServer())
      .get(`/api/v1/public/ro/results/${fixture.rankedResultId}`)
      .expect(200);

    await prisma.athlete.update({
      where: { id: fixture.athleteId },
      data: { status: 'DRAFT' },
    });
    await request(app.getHttpServer())
      .get(`/api/v1/public/ro/athletes/${fixture.athleteId}`)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/api/v1/public/ro/results/${fixture.rankedResultId}`)
      .expect(404);
    await prisma.athlete.update({
      where: { id: fixture.athleteId },
      data: { status: 'ACTIVE' },
    });
  });

  it('supports public filters, stable pagination and nulls-last result ordering', async () => {
    const athletes = await request(app.getHttpServer())
      .get('/api/v1/public/ro/athletes')
      .query({ clubId: fixture.clubId, search: 'public athlete', limit: 1 })
      .expect(200);
    const athleteList = listEnvelopeSchema.parse(athletes.body);
    expect(athleteList.data.map((row) => row.id)).toContain(fixture.athleteId);
    expect(athleteList.meta).toMatchObject({ page: 1, limit: 1 });

    const results = await request(app.getHttpServer())
      .get('/api/v1/public/ro/results')
      .query({
        competitionClassId: fixture.classId,
        athleteId: fixture.athleteId,
        horseId: fixture.horseId,
        sortBy: 'rank',
        sortOrder: 'asc',
      })
      .expect(200);
    const resultList = listEnvelopeSchema.parse(results.body);
    expect(resultList.data.map((row) => row.id)).toEqual([
      fixture.rankedResultId,
      fixture.statusOnlyResultId,
    ]);

    const withoutRank = await request(app.getHttpServer())
      .get('/api/v1/public/ro/results')
      .query({ competitionClassId: fixture.classId, hasRank: 'false' })
      .expect(200);
    const withoutRankBody = listEnvelopeSchema.parse(withoutRank.body);
    expect(withoutRankBody.data.map((row) => row.id)).toEqual([fixture.statusOnlyResultId]);

    const beyond = await request(app.getHttpServer())
      .get('/api/v1/public/ro/results')
      .query({ competitionClassId: fixture.classId, page: 999, limit: 1 })
      .expect(200);
    expect(listEnvelopeSchema.parse(beyond.body)).toMatchObject({
      data: [],
      meta: { page: 999, limit: 1, total: 2, totalPages: 2 },
    });

    const combinedResultFilters = await request(app.getHttpServer())
      .get('/api/v1/public/ro/results')
      .query({
        competitionSlug: `not-${fixture.eventSlug}`,
        disciplineId: fixture.disciplineId,
      })
      .expect(200);
    expect(listEnvelopeSchema.parse(combinedResultFilters.body).meta.total).toBe(0);

    const boundedClasses = await request(app.getHttpServer())
      .get('/api/v1/public/ro/competition-classes')
      .query({
        competitionSlug: fixture.eventSlug,
        dateFrom: '2025-05-11',
        dateTo: '2025-05-11',
      })
      .expect(200);
    expect(listEnvelopeSchema.parse(boundedClasses.body).data.map((row) => row.id)).toEqual([
      fixture.classId,
    ]);

    const impossibleCompetitionRange = await request(app.getHttpServer())
      .get('/api/v1/public/ro/competitions')
      .query({ upcoming: 'true', dateTo: '2024-01-01' })
      .expect(200);
    expect(listEnvelopeSchema.parse(impossibleCompetitionRange.body).meta.total).toBe(0);
  });

  it('rejects unsupported locale, invalid UUID, unknown query fields and excessive limits', async () => {
    const responses = await Promise.all([
      request(app.getHttpServer()).get('/api/v1/public/en/athletes').expect(400),
      request(app.getHttpServer()).get('/api/v1/public/ro/athletes/not-a-uuid').expect(400),
      request(app.getHttpServer())
        .get('/api/v1/public/ro/athletes')
        .query({ internal: '1' })
        .expect(400),
      request(app.getHttpServer())
        .get('/api/v1/public/ro/athletes')
        .query({ limit: 101 })
        .expect(400),
      request(app.getHttpServer()).get('/api/v1/public/ro/athletes').query({ page: 0 }).expect(400),
    ]);
    for (const response of responses) {
      expect(errorSchema.parse(response.body)).toMatchObject({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      });
      expect(response.headers['cache-control']).toBe('no-store');
    }
  });

  it('emits representation ETags and honors If-None-Match', async () => {
    const first = await request(app.getHttpServer())
      .get(`/api/v1/public/ro/results/${fixture.rankedResultId}`)
      .expect(200);
    const etag = first.headers.etag;
    expect(etag).toBeDefined();
    if (!etag) return;

    const notModified = await request(app.getHttpServer())
      .get(`/api/v1/public/ro/results/${fixture.rankedResultId}`)
      .set('If-None-Match', etag)
      .expect(304);
    expect(notModified.text).toBe('');
    expect(notModified.headers.etag).toBe(etag);
    expect(notModified.headers['cache-control']).toContain('public');
    expect(notModified.headers['content-language']).toBe('ro');
  });

  it('uses the public rate-limit contour without an accidental default ceiling', async () => {
    await prisma.rateLimitBucket.deleteMany({
      where: { throttlerName: { in: ['default', 'public'] } },
    });
    await request(app.getHttpServer()).get('/api/v1/public/ro/countries').expect(200);
    const buckets = await prisma.rateLimitBucket.groupBy({
      by: ['throttlerName'],
      where: { throttlerName: { in: ['default', 'public'] } },
      _count: true,
    });
    expect(buckets).toEqual([{ throttlerName: 'public', _count: 1 }]);
  });

  it('applies the stricter search contour to public list searches', async () => {
    await prisma.rateLimitBucket.deleteMany({
      where: { throttlerName: { in: ['default', 'public', 'search'] } },
    });
    await request(app.getHttpServer())
      .get('/api/v1/public/ro/athletes')
      .query({ search: 'Pu' })
      .expect(200);
    const buckets = await prisma.rateLimitBucket.groupBy({
      by: ['throttlerName'],
      where: { throttlerName: { in: ['default', 'public', 'search'] } },
      _count: true,
      orderBy: { throttlerName: 'asc' },
    });
    expect(buckets).toEqual([
      { throttlerName: 'public', _count: 1 },
      { throttlerName: 'search', _count: 1 },
    ]);
  });

  it('allows frontend conditional requests through CORS preflight', async () => {
    const response = await request(app.getHttpServer())
      .options('/api/v1/public/ro/athletes')
      .set('Origin', allowedCorsOrigin)
      .set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Headers', 'If-None-Match,X-Request-Id')
      .expect(204);
    expect(response.headers['access-control-allow-origin']).toBe(allowedCorsOrigin);
    expect(response.headers['access-control-allow-headers']).toContain('If-None-Match');
  });
});
