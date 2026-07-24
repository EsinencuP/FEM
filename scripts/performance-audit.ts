import { randomUUID } from 'node:crypto';

import { PrismaClient, PublicationStatus } from '@prisma/client';

import { assertSafeTestDatabaseEnvironment } from '../src/common/database/database-safety';

const prisma = new PrismaClient();
const runToken = randomUUID().replaceAll('-', '').slice(0, 12);
const prefix = `PERF_${runToken}`;

function elapsedMs(start: bigint): number {
  return Number(process.hrtime.bigint() - start) / 1_000_000;
}

function requiredAt(values: string[], index: number): string {
  const value = values[index];
  if (!value) throw new Error(`Missing deterministic fixture reference at index ${String(index)}`);
  return value;
}

async function createFixtures(): Promise<void> {
  const disciplineId = randomUUID();
  const clubIds = Array.from({ length: 100 }, () => randomUUID());
  const athleteIds = Array.from({ length: 50_000 }, () => randomUUID());
  const horseIds = Array.from({ length: 1_000 }, () => randomUUID());
  const eventIds = Array.from({ length: 100 }, () => randomUUID());
  const classIds = Array.from({ length: 1_000 }, () => randomUUID());

  await prisma.discipline.create({
    data: { id: disciplineId, code: prefix, name: `${prefix} Discipline`, isDemo: true },
  });
  await prisma.club.createMany({
    data: clubIds.map((id, index) => ({
      id,
      name: `${prefix} Club ${String(index).padStart(3, '0')}`,
      isDemo: true,
    })),
  });
  await prisma.athlete.createMany({
    data: athleteIds.map((id, index) => ({
      id,
      firstName: 'Performance',
      lastName: `${prefix}_${String(index).padStart(4, '0')}`,
      displayName: `${prefix} Athlete ${String(index).padStart(4, '0')}`,
      isDemo: true,
      archivedAt: index % 20 === 0 ? new Date() : null,
    })),
  });
  await prisma.horse.createMany({
    data: horseIds.map((id, index) => ({
      id,
      displayName: `${prefix} Horse ${String(index).padStart(4, '0')}`,
      birthYear: 2000 + (index % 25),
      isDemo: true,
      archivedAt: index % 20 === 0 ? new Date() : null,
    })),
  });
  await prisma.competitionEvent.createMany({
    data: eventIds.map((id, index) => ({
      id,
      title: `${prefix} Event ${String(index).padStart(3, '0')}`,
      slug: `${prefix.toLowerCase()}-event-${String(index).padStart(3, '0')}`,
      startDate: new Date('2027-01-01T00:00:00.000Z'),
      endDate: new Date('2027-12-31T00:00:00.000Z'),
      publicationStatus: index % 10 === 0 ? PublicationStatus.PUBLISHED : PublicationStatus.DRAFT,
      publishedAt: index % 10 === 0 ? new Date('2027-01-01T00:00:00.000Z') : null,
      isDemo: true,
      archivedAt: index % 20 === 0 ? new Date() : null,
    })),
  });
  await prisma.competitionClass.createMany({
    data: classIds.map((id, index) => ({
      id,
      competitionEventId: requiredAt(eventIds, index % eventIds.length),
      disciplineId,
      title: `${prefix} Class ${String(index).padStart(4, '0')}`,
      competitionDate: new Date('2027-06-01T00:00:00.000Z'),
      sortOrder: index % 20,
      isDemo: true,
    })),
  });
  await prisma.athleteClubMembership.createMany({
    data: athleteIds.map((athleteId, index) => ({
      athleteId,
      clubId: requiredAt(clubIds, index % clubIds.length),
      startDate: new Date('2020-01-01T00:00:00.000Z'),
      endDate: index % 3 === 0 ? new Date('2023-12-31T00:00:00.000Z') : null,
      isDemo: true,
    })),
  });
  await prisma.externalIdentifier.createMany({
    data: athleteIds.map((entityId, index) => ({
      entityType: 'Athlete',
      entityId,
      identifierType: 'PERFORMANCE_ID',
      namespace: prefix,
      value: String(index),
      normalizedValue: String(index),
      normalizationVersion: 'performance-v1',
      isDemo: true,
    })),
  });

  for (let offset = 0; offset < 10_000; offset += 1_000) {
    await prisma.competitionResult.createMany({
      data: Array.from({ length: 1_000 }, (_, localIndex) => {
        const index = offset + localIndex;
        const published = index % 10 === 0;
        return {
          competitionClassId: requiredAt(classIds, index % classIds.length),
          athleteId: requiredAt(athleteIds, index % athleteIds.length),
          horseId: requiredAt(horseIds, (index * 7) % horseIds.length),
          rank: (index % 50) + 1,
          points: index % 1_000,
          publicationStatus: published ? PublicationStatus.PUBLISHED : PublicationStatus.DRAFT,
          publishedAt: published ? new Date('2027-06-02T00:00:00.000Z') : null,
          isDemo: true,
          archivedAt: index % 25 === 0 ? new Date() : null,
        };
      }),
    });
  }
}

async function measure(): Promise<void> {
  await prisma.$executeRawUnsafe('ANALYZE "Athlete"');
  const listStart = process.hrtime.bigint();
  const results = await prisma.competitionResult.findMany({
    where: {
      isDemo: true,
      archivedAt: null,
      competitionClass: { title: { startsWith: prefix } },
    },
    take: 100,
    orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    select: {
      id: true,
      rank: true,
      points: true,
      athlete: { select: { id: true, displayName: true } },
      horse: { select: { id: true, displayName: true } },
      competitionClass: { select: { id: true, title: true } },
    },
  });
  const listMs = elapsedMs(listStart);

  const countStart = process.hrtime.bigint();
  const total = await prisma.competitionResult.count({
    where: { competitionClass: { title: { startsWith: prefix } } },
  });
  const countMs = elapsedMs(countStart);

  const searchStart = process.hrtime.bigint();
  const search = await prisma.athlete.findMany({
    where: { displayName: { contains: '9999', mode: 'insensitive' } },
    take: 20,
    orderBy: [{ displayName: 'asc' }, { id: 'asc' }],
    select: { id: true, displayName: true },
  });
  const searchMs = elapsedMs(searchStart);
  const searchPlanRows = await prisma.$queryRaw<{ 'QUERY PLAN': string }[]>`
    EXPLAIN (ANALYZE, BUFFERS)
    SELECT "id"
    FROM "Athlete"
    WHERE "displayName" ILIKE ${'%9999%'}
    LIMIT 20
  `;
  const searchPlan = searchPlanRows.map((row) => row['QUERY PLAN']).join('\n');
  const forcedSearchPlanRows = await prisma.$transaction(async (transaction) => {
    await transaction.$executeRawUnsafe('SET LOCAL enable_seqscan = off');
    return transaction.$queryRaw<{ 'QUERY PLAN': string }[]>`
      EXPLAIN (ANALYZE, BUFFERS)
      SELECT "id"
      FROM "Athlete"
      WHERE "displayName" ILIKE ${'%9999%'}
      LIMIT 20
    `;
  });
  const forcedSearchPlan = forcedSearchPlanRows.map((row) => row['QUERY PLAN']).join('\n');

  process.stdout.write(
    `${JSON.stringify({
      fixtureCounts: {
        athletes: 50_000,
        horses: 1_000,
        clubs: 100,
        events: 100,
        classes: 1_000,
        results: total,
      },
      measurements: {
        resultListMs: Number(listMs.toFixed(2)),
        resultCountMs: Number(countMs.toFixed(2)),
        athleteSearchMs: Number(searchMs.toFixed(2)),
        resultPayloadBytes: Buffer.byteLength(JSON.stringify(results)),
        searchRows: search.length,
        athleteSearchUsesTrigramIndex: /(?:Bitmap|Index) (?:Heap|Scan)/u.test(searchPlan),
        athleteSearchPlan: searchPlan.split('\n')[0] ?? 'unavailable',
        forcedAthleteSearchUsesTrigramIndex: /(?:Bitmap|Index) (?:Heap|Scan)/u.test(
          forcedSearchPlan,
        ),
        forcedAthleteSearchPlan: forcedSearchPlan.split('\n')[0] ?? 'unavailable',
      },
    })}\n`,
  );
}

async function cleanup(): Promise<void> {
  await prisma.externalIdentifier.deleteMany({ where: { namespace: prefix } });
  await prisma.competitionResult.deleteMany({
    where: { competitionClass: { title: { startsWith: prefix } } },
  });
  await prisma.athleteClubMembership.deleteMany({
    where: { athlete: { displayName: { startsWith: prefix } } },
  });
  await prisma.competitionClass.deleteMany({ where: { title: { startsWith: prefix } } });
  await prisma.competitionEvent.deleteMany({
    where: { slug: { startsWith: prefix.toLowerCase() } },
  });
  await prisma.athlete.deleteMany({ where: { displayName: { startsWith: prefix } } });
  await prisma.horse.deleteMany({ where: { displayName: { startsWith: prefix } } });
  await prisma.club.deleteMany({ where: { name: { startsWith: prefix } } });
  await prisma.discipline.deleteMany({ where: { code: prefix } });
}

async function main(): Promise<void> {
  assertSafeTestDatabaseEnvironment(process.env);
  if (process.env.RUN_PERFORMANCE_AUDIT !== 'true') {
    throw new Error('Performance audit requires RUN_PERFORMANCE_AUDIT=true');
  }
  await prisma.$connect();
  try {
    await createFixtures();
    await measure();
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
}

void main();
