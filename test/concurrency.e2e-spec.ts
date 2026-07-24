import { randomUUID } from 'node:crypto';

import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

import { AppModule } from '../src/app.module';
import { configureHttpApplication } from '../src/bootstrap/configure-http-application';
import { assertSafeTestDatabaseEnvironment } from '../src/common/database/database-safety';
import { AppConfigService } from '../src/config/app-config.service';
import { createAdminTestClient } from './setup/admin-test-client';
import type { AdminTestClient } from './setup/admin-test-client';

describe('Serializable write invariants (e2e)', () => {
  const prisma = new PrismaClient();
  const cleanup = {
    disciplineIds: [] as string[],
    eventIds: [] as string[],
    athleteIds: [] as string[],
    horseIds: [] as string[],
  };
  let app: NestExpressApplication;
  let adminRequest: AdminTestClient;

  beforeAll(async () => {
    assertSafeTestDatabaseEnvironment(process.env);
    await prisma.$connect();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const config = moduleRef.get(AppConfigService);
    app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false });
    configureHttpApplication(app, config);
    await app.init();
    adminRequest = await createAdminTestClient(app);
  });

  afterAll(async () => {
    await prisma.resultMetric.deleteMany({
      where: {
        competitionResult: { competitionClass: { competitionEventId: { in: cleanup.eventIds } } },
      },
    });
    await prisma.competitionResult.deleteMany({
      where: { competitionClass: { competitionEventId: { in: cleanup.eventIds } } },
    });
    await prisma.competitionClass.deleteMany({
      where: { competitionEventId: { in: cleanup.eventIds } },
    });
    await prisma.competitionEvent.deleteMany({ where: { id: { in: cleanup.eventIds } } });
    await prisma.externalIdentifier.deleteMany({
      where: { entityType: 'Athlete', entityId: { in: cleanup.athleteIds } },
    });
    await prisma.athlete.deleteMany({ where: { id: { in: cleanup.athleteIds } } });
    await prisma.horse.deleteMany({ where: { id: { in: cleanup.horseIds } } });
    await prisma.discipline.deleteMany({ where: { id: { in: cleanup.disciplineIds } } });
    await app.close();
    await prisma.$disconnect();
  });

  it('keeps class dates inside the event during concurrent shrink and create', async () => {
    for (let iteration = 0; iteration < 3; iteration += 1) {
      const suffix = randomUUID().slice(0, 8);
      const discipline = await prisma.discipline.create({
        data: { code: `CONCURRENT_${suffix}`, name: `Concurrent ${suffix}` },
      });
      cleanup.disciplineIds.push(discipline.id);
      const event = await prisma.competitionEvent.create({
        data: {
          title: `Concurrent Event ${suffix}`,
          slug: `concurrent-event-${suffix}`,
          startDate: new Date('2027-05-01T00:00:00.000Z'),
          endDate: new Date('2027-05-10T00:00:00.000Z'),
        },
      });
      cleanup.eventIds.push(event.id);

      const [shrink, createClass] = await Promise.all([
        adminRequest
          .patch(`/api/v1/admin/competitions/${event.id}`)
          .send({ endDate: '2027-05-05' }),
        adminRequest.post('/api/v1/admin/competition-classes').send({
          competitionEventId: event.id,
          disciplineId: discipline.id,
          title: `Concurrent Class ${suffix}`,
          competitionDate: '2027-05-08',
        }),
      ]);

      expect([shrink.status, createClass.status].filter((status) => status < 300)).toHaveLength(1);
      const finalEvent = await prisma.competitionEvent.findUniqueOrThrow({
        where: { id: event.id },
      });
      const invalidClassCount = await prisma.competitionClass.count({
        where: {
          competitionEventId: event.id,
          competitionDate: { not: null },
          OR: [
            { competitionDate: { lt: finalEvent.startDate } },
            { competitionDate: { gt: finalEvent.endDate } },
          ],
        },
      });
      expect(invalidClassCount).toBe(0);
    }
  });

  it('does not lose the final result outcome during concurrent PATCH and metric delete', async () => {
    const suffix = randomUUID().slice(0, 8);
    const discipline = await prisma.discipline.create({
      data: { code: `OUTCOME_${suffix}`, name: `Outcome ${suffix}` },
    });
    cleanup.disciplineIds.push(discipline.id);
    const event = await prisma.competitionEvent.create({
      data: {
        title: `Outcome Event ${suffix}`,
        slug: `outcome-event-${suffix}`,
        startDate: new Date('2027-06-01T00:00:00.000Z'),
        endDate: new Date('2027-06-02T00:00:00.000Z'),
      },
    });
    cleanup.eventIds.push(event.id);
    const competitionClass = await prisma.competitionClass.create({
      data: {
        competitionEventId: event.id,
        disciplineId: discipline.id,
        title: `Outcome Class ${suffix}`,
        competitionDate: new Date('2027-06-01T00:00:00.000Z'),
      },
    });
    const athlete = await prisma.athlete.create({
      data: { firstName: 'Concurrent', lastName: suffix, displayName: `Concurrent ${suffix}` },
    });
    cleanup.athleteIds.push(athlete.id);
    const horse = await prisma.horse.create({
      data: { displayName: `Concurrent Horse ${suffix}` },
    });
    cleanup.horseIds.push(horse.id);
    const result = await prisma.competitionResult.create({
      data: {
        competitionClassId: competitionClass.id,
        athleteId: athlete.id,
        horseId: horse.id,
        rank: 1,
        metrics: { create: { metricCode: 'concurrent', numericValue: 1 } },
      },
      include: { metrics: true },
    });
    const metric = result.metrics[0];
    if (!metric) throw new Error('Expected the concurrency fixture to contain one metric');

    const [clearRank, deleteMetric] = await Promise.all([
      adminRequest.patch(`/api/v1/admin/results/${result.id}`).send({ rank: null }),
      adminRequest.delete(`/api/v1/admin/results/${result.id}/metrics/${metric.id}`),
    ]);
    expect([clearRank.status, deleteMetric.status].filter((status) => status < 300)).toHaveLength(
      1,
    );

    const finalResult = await prisma.competitionResult.findUniqueOrThrow({
      where: { id: result.id },
      include: { metrics: true },
    });
    expect(finalResult.rank !== null || finalResult.metrics.length > 0).toBe(true);
  });

  it('maps duplicate slug and identifier races without an unexplained 500', async () => {
    const suffix = randomUUID().slice(0, 8);
    const slug = `duplicate-race-${suffix}`;
    const eventPayload = {
      title: `Duplicate Race ${suffix}`,
      slug,
      startDate: '2027-07-01',
      endDate: '2027-07-02',
    };
    const [firstEvent, secondEvent] = await Promise.all([
      adminRequest.post('/api/v1/admin/competitions').send(eventPayload),
      adminRequest.post('/api/v1/admin/competitions').send(eventPayload),
    ]);
    expect([firstEvent.status, secondEvent.status].sort()).toEqual([201, 409]);
    const event = await prisma.competitionEvent.findUniqueOrThrow({ where: { slug } });
    cleanup.eventIds.push(event.id);

    const athlete = await prisma.athlete.create({
      data: {
        firstName: 'Identifier',
        lastName: suffix,
        displayName: `Identifier ${suffix}`,
      },
    });
    cleanup.athleteIds.push(athlete.id);
    const identifierPayload = {
      identifierType: 'CONCURRENCY_TEST',
      namespace: `CONCURRENCY_${suffix}`,
      value: `VALUE_${suffix}`,
    };
    const [firstIdentifier, secondIdentifier] = await Promise.all([
      adminRequest.post(`/api/v1/admin/athletes/${athlete.id}/identifiers`).send(identifierPayload),
      adminRequest.post(`/api/v1/admin/athletes/${athlete.id}/identifiers`).send(identifierPayload),
    ]);
    expect([firstIdentifier.status, secondIdentifier.status].sort()).toEqual([201, 409]);
  });

  it('rejects one of two concurrent updates carrying the same resource version', async () => {
    const suffix = randomUUID().slice(0, 8);
    const created = await adminRequest
      .post('/api/v1/admin/disciplines')
      .send({ code: `VERSION_${suffix}`, name: `Version ${suffix}` })
      .expect(201);
    const resource = z
      .object({ data: z.object({ id: z.uuid(), version: z.literal(1) }).loose() })
      .parse(created.body).data;
    cleanup.disciplineIds.push(resource.id);

    const updates = await Promise.all([
      adminRequest
        .patchWithVersion(`/api/v1/admin/disciplines/${resource.id}`, 1)
        .send({ name: `Version A ${suffix}` }),
      adminRequest
        .patchWithVersion(`/api/v1/admin/disciplines/${resource.id}`, 1)
        .send({ name: `Version B ${suffix}` }),
    ]);
    expect(updates.map(({ status }) => status).sort()).toEqual([200, 409]);
    const persisted = await prisma.discipline.findUniqueOrThrow({
      where: { id: resource.id },
    });
    expect(persisted.version).toBe(2);
  });
});
