import { randomUUID } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

import { AppModule } from '../src/app.module';
import { configureHttpApplication } from '../src/bootstrap/configure-http-application';
import { AppConfigService } from '../src/config/app-config.service';
import { assertSafeTestDatabaseEnvironment } from '../src/common/database/database-safety';
import { createAdminTestClient } from './setup/admin-test-client';
import type { AdminTestClient } from './setup/admin-test-client';

interface DemoReferences {
  athleteId: string;
  horseId: string;
  clubId: string;
  ownerId: string;
  classId: string;
  eventId: string;
  disciplineId: string;
  countryId: string;
  statusId: string;
}

const resourceResponseSchema = z.object({
  data: z
    .object({
      id: z.uuid(),
      isDemo: z.boolean().optional(),
    })
    .loose(),
});

const listResponseSchema = z.object({
  data: z.array(z.object({ rank: z.number().nullable().optional() }).loose()),
  meta: z.object({ total: z.number().int().nonnegative() }).loose(),
});

const hexToLetters = (value: string): string =>
  Array.from(value, (character) => String.fromCharCode(65 + Number.parseInt(character, 16))).join(
    '',
  );

describe('Stabilization invariants (e2e)', () => {
  const prisma = new PrismaClient();
  const cleanup = {
    athleteIds: [] as string[],
    horseIds: [] as string[],
    clubIds: [] as string[],
    countryIds: [] as string[],
    disciplineIds: [] as string[],
    eventIds: [] as string[],
    classIds: [] as string[],
    resultIds: [] as string[],
    membershipIds: [] as string[],
    ownershipIds: [] as string[],
    relationIds: [] as string[],
    identifierIds: [] as string[],
    documentIds: [] as string[],
  };
  let app: NestExpressApplication;
  let adminRequest: AdminTestClient;
  let demo: DemoReferences;

  beforeAll(async () => {
    assertSafeTestDatabaseEnvironment(process.env);
    await prisma.$connect();
    const [athlete, horse, club, owner, competitionClass, status, country] = await Promise.all([
      prisma.athlete.findFirstOrThrow({ where: { isDemo: true, archivedAt: null } }),
      prisma.horse.findFirstOrThrow({ where: { isDemo: true, archivedAt: null } }),
      prisma.club.findFirstOrThrow({ where: { isDemo: true, archivedAt: null } }),
      prisma.owner.findFirstOrThrow({ where: { isDemo: true, archivedAt: null } }),
      prisma.competitionClass.findFirstOrThrow({ where: { isDemo: true, archivedAt: null } }),
      prisma.resultStatus.findFirstOrThrow({
        where: { code: 'DEMO_STATUS_ONLY', archivedAt: null },
      }),
      prisma.country.findFirstOrThrow({ where: { isDemo: true, archivedAt: null } }),
    ]);
    demo = {
      athleteId: athlete.id,
      horseId: horse.id,
      clubId: club.id,
      ownerId: owner.id,
      classId: competitionClass.id,
      eventId: competitionClass.competitionEventId,
      disciplineId: competitionClass.disciplineId,
      countryId: country.id,
      statusId: status.id,
    };

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const config = moduleRef.get(AppConfigService);
    app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false });
    configureHttpApplication(app, config);
    await app.init();
    adminRequest = await createAdminTestClient(app);
  });

  afterAll(async () => {
    await prisma.externalIdentifier.deleteMany({
      where: { id: { in: cleanup.identifierIds } },
    });
    await prisma.resultMetric.deleteMany({
      where: {
        competitionResult: {
          OR: [{ id: { in: cleanup.resultIds } }, { athleteId: { in: cleanup.athleteIds } }],
        },
      },
    });
    await prisma.competitionResult.deleteMany({
      where: {
        OR: [{ id: { in: cleanup.resultIds } }, { athleteId: { in: cleanup.athleteIds } }],
      },
    });
    await prisma.athleteClubMembership.deleteMany({
      where: { id: { in: cleanup.membershipIds } },
    });
    await prisma.horseOwnership.deleteMany({ where: { id: { in: cleanup.ownershipIds } } });
    await prisma.athleteHorseRelation.deleteMany({
      where: { id: { in: cleanup.relationIds } },
    });
    await prisma.competitionClass.deleteMany({ where: { id: { in: cleanup.classIds } } });
    await prisma.competitionEvent.deleteMany({ where: { id: { in: cleanup.eventIds } } });
    await prisma.athlete.deleteMany({ where: { id: { in: cleanup.athleteIds } } });
    await prisma.horse.deleteMany({ where: { id: { in: cleanup.horseIds } } });
    await prisma.club.deleteMany({ where: { id: { in: cleanup.clubIds } } });
    await prisma.discipline.deleteMany({ where: { id: { in: cleanup.disciplineIds } } });
    await prisma.document.deleteMany({ where: { id: { in: cleanup.documentIds } } });
    await prisma.country.deleteMany({ where: { id: { in: cleanup.countryIds } } });
    await app.close();
    await prisma.$disconnect();
  });

  it('applies false boolean filters as false at HTTP level', async () => {
    const [allResults, withoutRank, allCompetitions, notUpcoming] = await Promise.all([
      adminRequest.get('/api/v1/admin/results').query({ limit: 100 }).expect(200),
      adminRequest.get('/api/v1/admin/results').query({ hasRank: 'false', limit: 100 }).expect(200),
      adminRequest.get('/api/v1/admin/competitions').query({ limit: 100 }).expect(200),
      adminRequest
        .get('/api/v1/admin/competitions')
        .query({ upcoming: 'false', limit: 100 })
        .expect(200),
    ]);

    const allResultsRaw: unknown = allResults.body;
    const withoutRankRaw: unknown = withoutRank.body;
    const allCompetitionsRaw: unknown = allCompetitions.body;
    const notUpcomingRaw: unknown = notUpcoming.body;
    const allResultsBody = listResponseSchema.parse(allResultsRaw);
    const withoutRankBody = listResponseSchema.parse(withoutRankRaw);
    const allCompetitionsBody = listResponseSchema.parse(allCompetitionsRaw);
    const notUpcomingBody = listResponseSchema.parse(notUpcomingRaw);

    expect(withoutRankBody.meta.total).toBeLessThan(allResultsBody.meta.total);
    expect(withoutRankBody.data.every((row) => row.rank === null)).toBe(true);
    expect(notUpcomingBody.meta.total).toBe(allCompetitionsBody.meta.total);
  });

  it('rejects shrinking an event around an existing class', async () => {
    const suffix = randomUUID().slice(0, 8);
    const disciplineResponse = await adminRequest
      .post('/api/v1/admin/disciplines')
      .send({ code: `STAB_${suffix}`, name: `Stabilization ${suffix}` })
      .expect(201);
    const disciplineRaw: unknown = disciplineResponse.body;
    const disciplineBody = resourceResponseSchema.parse(disciplineRaw);
    cleanup.disciplineIds.push(disciplineBody.data.id);

    const eventResponse = await adminRequest
      .post('/api/v1/admin/competitions')
      .send({
        title: `Stabilization Event ${suffix}`,
        slug: `stabilization-event-${suffix}`,
        startDate: '2026-08-01',
        endDate: '2026-08-10',
      })
      .expect(201);
    const eventRaw: unknown = eventResponse.body;
    const eventId = resourceResponseSchema.parse(eventRaw).data.id;
    cleanup.eventIds.push(eventId);

    const classResponse = await adminRequest
      .post('/api/v1/admin/competition-classes')
      .send({
        competitionEventId: eventId,
        disciplineId: disciplineBody.data.id,
        title: `Stabilization Class ${suffix}`,
        competitionDate: '2026-08-08',
      })
      .expect(201);
    const classRaw: unknown = classResponse.body;
    cleanup.classIds.push(resourceResponseSchema.parse(classRaw).data.id);

    await adminRequest
      .patch(`/api/v1/admin/competitions/${eventId}`)
      .send({ endDate: '2026-08-05' })
      .expect(400);
    await expect(
      prisma.competitionEvent.findUniqueOrThrow({ where: { id: eventId } }),
    ).resolves.toMatchObject({
      endDate: new Date('2026-08-10T00:00:00.000Z'),
    });
  });

  it('does not restore a class beneath an archived event', async () => {
    const suffix = randomUUID().slice(0, 8);
    const disciplineResponse = await adminRequest
      .post('/api/v1/admin/disciplines')
      .send({ code: `RESTORE_${suffix}`, name: `Restore ${suffix}` })
      .expect(201);
    const disciplineId = resourceResponseSchema.parse(disciplineResponse.body as unknown).data.id;
    cleanup.disciplineIds.push(disciplineId);
    const eventResponse = await adminRequest
      .post('/api/v1/admin/competitions')
      .send({
        title: `Restore Event ${suffix}`,
        slug: `restore-event-${suffix}`,
        startDate: '2026-09-01',
        endDate: '2026-09-03',
      })
      .expect(201);
    const eventId = resourceResponseSchema.parse(eventResponse.body as unknown).data.id;
    cleanup.eventIds.push(eventId);
    const classResponse = await adminRequest
      .post('/api/v1/admin/competition-classes')
      .send({
        competitionEventId: eventId,
        disciplineId,
        title: `Restore Class ${suffix}`,
        competitionDate: '2026-09-02',
      })
      .expect(201);
    const classId = resourceResponseSchema.parse(classResponse.body as unknown).data.id;
    cleanup.classIds.push(classId);

    await adminRequest.patch(`/api/v1/admin/competition-classes/${classId}/archive`).expect(200);
    await adminRequest.patch(`/api/v1/admin/competitions/${eventId}/archive`).expect(200);
    await adminRequest.patch(`/api/v1/admin/competition-classes/${classId}/restore`).expect(400);
  });

  it('does not restore a primary entity beneath an archived reference', async () => {
    let suffix = randomUUID().slice(0, 8);
    while (
      await prisma.country.findFirst({
        where: {
          OR: [
            { isoAlpha2: hexToLetters(suffix.slice(0, 2)) },
            { isoAlpha3: hexToLetters(suffix.slice(0, 3)) },
          ],
        },
        select: { id: true },
      })
    ) {
      suffix = randomUUID().slice(0, 8);
    }
    const countryResponse = await adminRequest
      .post('/api/v1/admin/countries')
      .send({
        isoAlpha2: hexToLetters(suffix.slice(0, 2)),
        isoAlpha3: hexToLetters(suffix.slice(0, 3)),
        name: `Restore Country ${suffix}`,
      })
      .expect(201);
    const countryId = resourceResponseSchema.parse(countryResponse.body as unknown).data.id;
    cleanup.countryIds.push(countryId);
    const athleteResponse = await adminRequest
      .post('/api/v1/admin/athletes')
      .send({
        firstName: 'Restore',
        lastName: suffix,
        displayName: `Restore ${suffix}`,
        countryId,
      })
      .expect(201);
    const athleteId = resourceResponseSchema.parse(athleteResponse.body as unknown).data.id;
    cleanup.athleteIds.push(athleteId);

    await adminRequest.patch(`/api/v1/admin/athletes/${athleteId}/archive`).expect(200);
    await adminRequest.patch(`/api/v1/admin/athletes/${athleteId}/archive`).expect(200);
    await adminRequest.patch(`/api/v1/admin/countries/${countryId}/archive`).expect(200);
    await adminRequest.patch(`/api/v1/admin/athletes/${athleteId}/restore`).expect(400);
    await adminRequest.patch(`/api/v1/admin/countries/${countryId}/restore`).expect(200);
    await adminRequest.patch(`/api/v1/admin/countries/${countryId}/restore`).expect(200);
    await adminRequest.patch(`/api/v1/admin/athletes/${athleteId}/restore`).expect(200);
    await adminRequest.patch(`/api/v1/admin/athletes/${athleteId}/restore`).expect(200);
  });

  it('inherits demo provenance for a result and blocks metrics after archive', async () => {
    const resultResponse = await adminRequest
      .post('/api/v1/admin/results')
      .send({
        competitionClassId: demo.classId,
        athleteId: demo.athleteId,
        horseId: demo.horseId,
        statusId: demo.statusId,
      })
      .expect(201);
    const resultRaw: unknown = resultResponse.body;
    const resultBody = resourceResponseSchema.parse(resultRaw);
    const resultId = resultBody.data.id;
    cleanup.resultIds.push(resultId);

    expect(resultBody.data.isDemo).toBe(true);
    await adminRequest.patch(`/api/v1/admin/results/${resultId}/archive`).expect(200);
    const nestedResults = await adminRequest
      .get(`/api/v1/admin/athletes/${demo.athleteId}/results`)
      .query({ limit: 100 })
      .expect(200);
    const nestedBody = z
      .object({ data: z.array(z.object({ id: z.uuid() }).loose()) })
      .parse(nestedResults.body as unknown);
    expect(nestedBody.data.some((result) => result.id === resultId)).toBe(false);
    await adminRequest
      .post(`/api/v1/admin/results/${resultId}/metrics`)
      .send({ metricCode: 'blocked-after-archive', numericValue: 1 })
      .expect(400);
  });

  it('does not physically delete metric evidence from a published result', async () => {
    const resultResponse = await adminRequest
      .post('/api/v1/admin/results')
      .send({
        competitionClassId: demo.classId,
        athleteId: demo.athleteId,
        horseId: demo.horseId,
        statusId: demo.statusId,
      })
      .expect(201);
    const resultId = resourceResponseSchema.parse(resultResponse.body as unknown).data.id;
    cleanup.resultIds.push(resultId);
    const metricResponse = await adminRequest
      .post(`/api/v1/admin/results/${resultId}/metrics`)
      .send({ metricCode: `published-evidence-${randomUUID().slice(0, 8)}`, numericValue: 1 })
      .expect(201);
    const metricId = resourceResponseSchema.parse(metricResponse.body as unknown).data.id;

    await prisma.competitionResult.update({
      where: { id: resultId },
      data: { publicationStatus: 'PUBLISHED', publishedAt: new Date() },
    });
    await adminRequest
      .post(`/api/v1/admin/results/${resultId}/metrics`)
      .send({ metricCode: 'late-evidence', numericValue: 2 })
      .expect(409);
    await adminRequest
      .patch(`/api/v1/admin/results/${resultId}/metrics/${metricId}`)
      .send({ numericValue: 2 })
      .expect(409);
    await adminRequest.delete(`/api/v1/admin/results/${resultId}/metrics/${metricId}`).expect(409);
    await expect(
      prisma.resultMetric.findUniqueOrThrow({ where: { id: metricId } }),
    ).resolves.toBeDefined();
  });

  it('does not move a class with results across the demo boundary', async () => {
    const suffix = randomUUID().slice(0, 8);
    const disciplineResponse = await adminRequest
      .post('/api/v1/admin/disciplines')
      .send({ code: `BOUNDARY_CLASS_${suffix}`, name: `Boundary Class ${suffix}` })
      .expect(201);
    const disciplineId = resourceResponseSchema.parse(disciplineResponse.body as unknown).data.id;
    cleanup.disciplineIds.push(disciplineId);
    const eventResponse = await adminRequest
      .post('/api/v1/admin/competitions')
      .send({
        title: `Boundary Class Event ${suffix}`,
        slug: `boundary-class-event-${suffix}`,
        startDate: '2027-03-01',
        endDate: '2027-03-03',
      })
      .expect(201);
    const eventId = resourceResponseSchema.parse(eventResponse.body as unknown).data.id;
    cleanup.eventIds.push(eventId);
    const classResponse = await adminRequest
      .post('/api/v1/admin/competition-classes')
      .send({
        competitionEventId: eventId,
        disciplineId,
        title: `Boundary Class ${suffix}`,
        competitionDate: '2027-03-02',
      })
      .expect(201);
    const classId = resourceResponseSchema.parse(classResponse.body as unknown).data.id;
    cleanup.classIds.push(classId);
    const athleteResponse = await adminRequest
      .post('/api/v1/admin/athletes')
      .send({ firstName: 'Class', lastName: suffix, displayName: `Class ${suffix}` })
      .expect(201);
    const athleteId = resourceResponseSchema.parse(athleteResponse.body as unknown).data.id;
    cleanup.athleteIds.push(athleteId);
    const horseResponse = await adminRequest
      .post('/api/v1/admin/horses')
      .send({ displayName: `Class Horse ${suffix}` })
      .expect(201);
    const horseId = resourceResponseSchema.parse(horseResponse.body as unknown).data.id;
    cleanup.horseIds.push(horseId);
    const resultResponse = await adminRequest
      .post('/api/v1/admin/results')
      .send({ competitionClassId: classId, athleteId, horseId, rank: 1 })
      .expect(201);
    cleanup.resultIds.push(resourceResponseSchema.parse(resultResponse.body as unknown).data.id);

    await adminRequest
      .patch(`/api/v1/admin/competition-classes/${classId}`)
      .send({
        competitionEventId: demo.eventId,
        disciplineId: demo.disciplineId,
        competitionDate: null,
      })
      .expect(409);
  });

  it('does not move a result with metrics across the demo boundary', async () => {
    const suffix = randomUUID().slice(0, 8);
    const disciplineResponse = await adminRequest
      .post('/api/v1/admin/disciplines')
      .send({ code: `BOUNDARY_RESULT_${suffix}`, name: `Boundary Result ${suffix}` })
      .expect(201);
    const disciplineId = resourceResponseSchema.parse(disciplineResponse.body as unknown).data.id;
    cleanup.disciplineIds.push(disciplineId);
    const eventResponse = await adminRequest
      .post('/api/v1/admin/competitions')
      .send({
        title: `Boundary Result Event ${suffix}`,
        slug: `boundary-result-event-${suffix}`,
        startDate: '2027-04-01',
        endDate: '2027-04-03',
      })
      .expect(201);
    const eventId = resourceResponseSchema.parse(eventResponse.body as unknown).data.id;
    cleanup.eventIds.push(eventId);
    const classResponse = await adminRequest
      .post('/api/v1/admin/competition-classes')
      .send({
        competitionEventId: eventId,
        disciplineId,
        title: `Boundary Result Class ${suffix}`,
        competitionDate: '2027-04-02',
      })
      .expect(201);
    const classId = resourceResponseSchema.parse(classResponse.body as unknown).data.id;
    cleanup.classIds.push(classId);
    const athleteResponse = await adminRequest
      .post('/api/v1/admin/athletes')
      .send({ firstName: 'Result', lastName: suffix, displayName: `Result ${suffix}` })
      .expect(201);
    const athleteId = resourceResponseSchema.parse(athleteResponse.body as unknown).data.id;
    cleanup.athleteIds.push(athleteId);
    const horseResponse = await adminRequest
      .post('/api/v1/admin/horses')
      .send({ displayName: `Result Horse ${suffix}` })
      .expect(201);
    const horseId = resourceResponseSchema.parse(horseResponse.body as unknown).data.id;
    cleanup.horseIds.push(horseId);
    const resultResponse = await adminRequest
      .post('/api/v1/admin/results')
      .send({
        competitionClassId: classId,
        athleteId,
        horseId,
        metrics: [{ metricCode: 'boundary', numericValue: 1 }],
      })
      .expect(201);
    const resultId = resourceResponseSchema.parse(resultResponse.body as unknown).data.id;
    cleanup.resultIds.push(resultId);

    await adminRequest
      .patch(`/api/v1/admin/results/${resultId}`)
      .send({
        competitionClassId: demo.classId,
        athleteId: demo.athleteId,
        horseId: demo.horseId,
      })
      .expect(409);
  });

  it('rejects a result whose parents cross the demo boundary', async () => {
    const suffix = randomUUID().slice(0, 8);
    const athleteResponse = await adminRequest
      .post('/api/v1/admin/athletes')
      .send({
        firstName: 'Boundary',
        lastName: suffix,
        displayName: `Boundary ${suffix}`,
      })
      .expect(201);
    const athleteRaw: unknown = athleteResponse.body;
    const athleteBody = resourceResponseSchema.parse(athleteRaw);
    cleanup.athleteIds.push(athleteBody.data.id);

    await adminRequest
      .post('/api/v1/admin/results')
      .send({
        competitionClassId: demo.classId,
        athleteId: athleteBody.data.id,
        horseId: demo.horseId,
        statusId: demo.statusId,
      })
      .expect(400);

    await adminRequest
      .patch(`/api/v1/admin/athletes/${athleteBody.data.id}`)
      .send({ countryId: demo.countryId })
      .expect(400);
    await adminRequest.patch(`/api/v1/admin/athletes/${athleteBody.data.id}/archive`).expect(200);
    await adminRequest
      .patch(`/api/v1/admin/athletes/${athleteBody.data.id}`)
      .send({ displayName: `Archived ${suffix}` })
      .expect(400);
    await adminRequest
      .post(`/api/v1/admin/athletes/${athleteBody.data.id}/identifiers`)
      .send({ identifierType: 'LOCAL', namespace: 'STABILIZATION', value: suffix })
      .expect(400);
  });

  it('derives primary entity demo provenance from active references', async () => {
    const suffix = randomUUID().slice(0, 8);
    const response = await adminRequest
      .post('/api/v1/admin/athletes')
      .send({
        firstName: 'Reference',
        lastName: suffix,
        displayName: `Reference ${suffix}`,
        countryId: demo.countryId,
      })
      .expect(201);
    const body = resourceResponseSchema.parse(response.body as unknown);
    cleanup.athleteIds.push(body.data.id);
    expect(body.data.isDemo).toBe(true);
  });

  it('inherits demo provenance for a historical club membership', async () => {
    const suffix = randomUUID().slice(0, 8);
    const clubResponse = await adminRequest
      .post('/api/v1/admin/clubs')
      .send({ name: `Stabilization Club ${suffix}`, countryId: demo.countryId })
      .expect(201);
    const clubId = resourceResponseSchema.parse(clubResponse.body as unknown).data.id;
    cleanup.clubIds.push(clubId);
    const membershipResponse = await adminRequest
      .post(`/api/v1/admin/athletes/${demo.athleteId}/clubs`)
      .send({ clubId, startDate: '2027-01-01' })
      .expect(201);
    const membershipRaw: unknown = membershipResponse.body;
    const membershipBody = resourceResponseSchema.parse(membershipRaw);
    cleanup.membershipIds.push(membershipBody.data.id);
    expect(membershipBody.data.isDemo).toBe(true);

    await adminRequest.patch(`/api/v1/admin/clubs/${clubId}/archive`).expect(200);
    try {
      await adminRequest
        .post(`/api/v1/admin/athletes/${demo.athleteId}/clubs`)
        .send({ clubId, startDate: '2028-01-01' })
        .expect(400);
    } finally {
      await adminRequest.patch(`/api/v1/admin/clubs/${clubId}/restore`).expect(200);
    }
  });

  it('inherits demo provenance for horse ownership and athlete history', async () => {
    const ownershipResponse = await adminRequest
      .post(`/api/v1/admin/horses/${demo.horseId}/owners`)
      .send({ ownerId: demo.ownerId, startDate: '2027-02-01' })
      .expect(201);
    const ownershipRaw: unknown = ownershipResponse.body;
    const ownershipBody = resourceResponseSchema.parse(ownershipRaw);
    cleanup.ownershipIds.push(ownershipBody.data.id);
    expect(ownershipBody.data.isDemo).toBe(true);

    const relationResponse = await adminRequest
      .post(`/api/v1/admin/horses/${demo.horseId}/athletes`)
      .send({ athleteId: demo.athleteId, startDate: '2027-02-01' })
      .expect(201);
    const relationRaw: unknown = relationResponse.body;
    const relationBody = resourceResponseSchema.parse(relationRaw);
    cleanup.relationIds.push(relationBody.data.id);
    expect(relationBody.data.isDemo).toBe(true);
  });

  it('owns identifier provenance and inherits the target demo boundary', async () => {
    const suffix = randomUUID().slice(0, 8);
    const response = await adminRequest
      .post(`/api/v1/admin/athletes/${demo.athleteId}/identifiers`)
      .send({
        identifierType: 'STABILIZATION_ID',
        namespace: `STABILIZATION_${suffix}`,
        value: suffix,
      })
      .expect(201);
    const raw: unknown = response.body;
    const body = z
      .object({
        data: z.object({
          id: z.uuid(),
          isDemo: z.literal(true),
          normalizationVersion: z.literal('nfkc-trim-v1'),
          verificationStatus: z.literal('UNVERIFIED'),
          isPrimary: z.literal(false),
        }),
      })
      .parse(raw);
    cleanup.identifierIds.push(body.data.id);
  });

  it('does not rewrite a verified external identifier through generic PATCH', async () => {
    const suffix = randomUUID().slice(0, 8);
    const response = await adminRequest
      .post(`/api/v1/admin/athletes/${demo.athleteId}/identifiers`)
      .send({
        identifierType: 'STABILIZATION_VERIFIED',
        namespace: `STABILIZATION_VERIFIED_${suffix}`,
        value: `before-${suffix}`,
      })
      .expect(201);
    const raw: unknown = response.body;
    const identifierId = resourceResponseSchema.parse(raw).data.id;
    cleanup.identifierIds.push(identifierId);
    await prisma.externalIdentifier.update({
      where: { id: identifierId },
      data: { verificationStatus: 'VERIFIED', verifiedAt: new Date() },
    });

    await adminRequest
      .patch(`/api/v1/admin/athletes/${demo.athleteId}/identifiers/${identifierId}`)
      .send({ value: `after-${suffix}` })
      .expect(409);
    await expect(
      prisma.externalIdentifier.findUniqueOrThrow({ where: { id: identifierId } }),
    ).resolves.toMatchObject({
      value: `before-${suffix}`,
      verificationStatus: 'VERIFIED',
    });
  });

  it('rejects archived or cross-boundary source documents', async () => {
    const suffix = randomUUID().slice(0, 8);
    const [officialDocument, archivedDemoDocument] = await Promise.all([
      prisma.document.create({
        data: { title: `Official source ${suffix}`, isDemo: false },
      }),
      prisma.document.create({
        data: {
          title: `Archived demo source ${suffix}`,
          isDemo: true,
          archivedAt: new Date(),
        },
      }),
    ]);
    cleanup.documentIds.push(officialDocument.id, archivedDemoDocument.id);

    await adminRequest
      .post('/api/v1/admin/results')
      .send({
        competitionClassId: demo.classId,
        athleteId: demo.athleteId,
        horseId: demo.horseId,
        statusId: demo.statusId,
        sourceDocumentId: officialDocument.id,
      })
      .expect(400);
    await adminRequest
      .post(`/api/v1/admin/athletes/${demo.athleteId}/identifiers`)
      .send({
        identifierType: 'ARCHIVED_SOURCE',
        namespace: `ARCHIVED_SOURCE_${suffix}`,
        value: suffix,
        sourceDocumentId: archivedDemoDocument.id,
      })
      .expect(400);
  });

  it('bounds result metric payloads and rejects a metric above the limit', async () => {
    const metrics = Array.from({ length: 100 }, (_, index) => ({
      metricCode: `bounded-${String(index).padStart(3, '0')}`,
      numericValue: index,
      sortOrder: index,
    }));
    const response = await adminRequest
      .post('/api/v1/admin/results')
      .send({
        competitionClassId: demo.classId,
        athleteId: demo.athleteId,
        horseId: demo.horseId,
        metrics,
      })
      .expect(201);
    const resultId = resourceResponseSchema.parse(response.body as unknown).data.id;
    cleanup.resultIds.push(resultId);

    const detail = await adminRequest.get(`/api/v1/admin/results/${resultId}`).expect(200);
    const detailBody = z
      .object({
        data: z.object({
          metrics: z.array(z.unknown()).max(100),
          _count: z.object({ metrics: z.literal(100) }),
        }),
      })
      .parse(detail.body as unknown);
    expect(detailBody.data.metrics).toHaveLength(100);

    const list = await adminRequest
      .get('/api/v1/admin/results')
      .query({ competitionClassId: demo.classId, limit: 100 })
      .expect(200);
    const listBody = z
      .object({
        data: z.array(
          z
            .object({
              id: z.uuid(),
              metrics: z.array(z.unknown()).max(10),
              _count: z.object({ metrics: z.number().int().nonnegative() }),
            })
            .loose(),
        ),
      })
      .parse(list.body as unknown);
    const listed = listBody.data.find((item) => item.id === resultId);
    expect(listed?.metrics).toHaveLength(10);
    expect(listed?._count.metrics).toBe(100);

    await adminRequest
      .post(`/api/v1/admin/results/${resultId}/metrics`)
      .send({ metricCode: 'bounded-overflow', numericValue: 101 })
      .expect(409);
  });

  it('returns a bounded correlated 413 for oversized JSON and stays healthy', async () => {
    const response = await adminRequest
      .post('/api/v1/admin/disciplines')
      .set('x-request-id', 'stabilization-payload-limit')
      .send({ code: 'OVERSIZED', name: 'x'.repeat(150 * 1024) })
      .expect(413);
    const raw: unknown = response.body;
    expect(
      z
        .object({
          statusCode: z.literal(413),
          code: z.literal('PAYLOAD_TOO_LARGE'),
          requestId: z.literal('stabilization-payload-limit'),
        })
        .parse(raw),
    ).toBeDefined();
    expect(response.headers['x-powered-by']).toBeUndefined();
    await adminRequest.get('/api/health').expect(200);
  });

  it('returns a standard correlated 400 for malformed JSON', async () => {
    const response = await adminRequest
      .post('/api/v1/admin/disciplines')
      .set('content-type', 'application/json')
      .set('x-request-id', 'stabilization-malformed-json')
      .send('{"broken":')
      .expect(400);
    const raw: unknown = response.body;
    expect(raw).toMatchObject({
      statusCode: 400,
      code: 'MALFORMED_JSON',
      requestId: 'stabilization-malformed-json',
    });
  });
});
