import { randomUUID } from 'node:crypto';

import {
  PrismaClient,
  PublicationStatus,
  RankingCalculationStatus,
  RankingSubjectType,
  RecordStatus,
} from '@prisma/client';

import { seedDatabase } from '../prisma/seed';

const prisma = new PrismaClient();

describe('Database v1 PostgreSQL constraints', () => {
  const ids = {
    athleteOne: randomUUID(),
    athleteTwo: randomUUID(),
    horse: randomUUID(),
    owner: randomUUID(),
    event: randomUUID(),
    competitionClass: randomUUID(),
    result: randomUUID(),
    resultStatusOnly: randomUUID(),
    membershipOne: randomUUID(),
    membershipTwo: randomUUID(),
    ownershipOne: randomUUID(),
    ownershipTwo: randomUUID(),
    identifier: randomUUID(),
    audit: randomUUID(),
    rankingSnapshot: randomUUID(),
    rankingEntry: randomUUID(),
    rankingEntryResult: randomUUID(),
  };

  let countryId: string;
  let clubId: string;
  let disciplineId: string;
  let resultStatusId: string;
  let rankingPeriodId: string;

  beforeAll(async () => {
    expect(process.env.NODE_ENV).toBe('test');
    await prisma.$connect();
    const databaseRows = await prisma.$queryRaw<{ current_database: string }[]>`
      SELECT current_database()
    `;
    expect(databaseRows[0]?.current_database).toBe('equestrian_federation_test');

    await seedDatabase(prisma);
    const [country, club, discipline, resultStatus, period] = await Promise.all([
      prisma.country.findUniqueOrThrow({ where: { isoAlpha2: 'MD' } }),
      prisma.club.findFirstOrThrow({ where: { isDemo: true } }),
      prisma.discipline.findFirstOrThrow({ where: { isDemo: true } }),
      prisma.resultStatus.findUniqueOrThrow({ where: { code: 'DEMO_STATUS_ONLY' } }),
      prisma.rankingPeriod.findFirstOrThrow({ where: { isDemo: true } }),
    ]);
    countryId = country.id;
    clubId = club.id;
    disciplineId = discipline.id;
    resultStatusId = resultStatus.id;
    rankingPeriodId = period.id;
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { id: ids.audit } });
    await prisma.externalIdentifier.deleteMany({
      where: { entityId: { in: [ids.athleteOne, ids.athleteTwo] } },
    });
    await prisma.rankingEntryResult.deleteMany({ where: { rankingEntryId: ids.rankingEntry } });
    await prisma.rankingEntry.deleteMany({ where: { rankingSnapshotId: ids.rankingSnapshot } });
    await prisma.rankingSnapshot.deleteMany({ where: { id: ids.rankingSnapshot } });
    await prisma.competitionResult.deleteMany({
      where: { id: { in: [ids.result, ids.resultStatusOnly] } },
    });
    await prisma.competitionClass.deleteMany({ where: { id: ids.competitionClass } });
    await prisma.competitionEvent.deleteMany({ where: { id: ids.event } });
    await prisma.horseOwnership.deleteMany({
      where: { id: { in: [ids.ownershipOne, ids.ownershipTwo] } },
    });
    await prisma.athleteClubMembership.deleteMany({
      where: { id: { in: [ids.membershipOne, ids.membershipTwo] } },
    });
    await prisma.owner.deleteMany({ where: { id: ids.owner } });
    await prisma.horse.deleteMany({ where: { id: ids.horse } });
    await prisma.athlete.deleteMany({ where: { id: { in: [ids.athleteOne, ids.athleteTwo] } } });
    await prisma.$disconnect();
  });

  it('creates an athlete with an internal UUID', async () => {
    const athlete = await prisma.athlete.create({
      data: {
        id: ids.athleteOne,
        firstName: 'Constraint',
        lastName: 'Athlete One',
        displayName: 'Constraint Athlete One',
        countryId,
        status: RecordStatus.DRAFT,
      },
    });
    const second = await prisma.athlete.create({
      data: {
        id: ids.athleteTwo,
        firstName: 'Constraint',
        lastName: 'Athlete Two',
        displayName: 'Constraint Athlete Two',
        countryId,
        status: RecordStatus.DRAFT,
      },
    });
    expect(athlete.id).toBe(ids.athleteOne);
    expect(second.id).toBe(ids.athleteTwo);
  });

  it('stores an external FEI identifier and keeps it unique after archive', async () => {
    const identifier = await prisma.externalIdentifier.create({
      data: {
        id: ids.identifier,
        entityType: 'Athlete',
        entityId: ids.athleteOne,
        identifierType: 'FEI_ID',
        namespace: 'FEI_TEST_NAMESPACE',
        value: 'TEST-FEI-001',
        normalizedValue: 'TEST-FEI-001',
        normalizationVersion: 'test-v1',
      },
    });
    expect(identifier.entityId).toBe(ids.athleteOne);
    await prisma.externalIdentifier.update({
      where: { id: ids.identifier },
      data: { archivedAt: new Date() },
    });

    await expect(
      prisma.externalIdentifier.create({
        data: {
          entityType: 'Athlete',
          entityId: ids.athleteTwo,
          identifierType: 'FEI_ID',
          namespace: 'FEI_TEST_NAMESPACE',
          value: 'TEST-FEI-001',
          normalizedValue: 'TEST-FEI-001',
          normalizationVersion: 'test-v1',
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('creates a horse without an FEI identifier', async () => {
    await prisma.horse.create({
      data: {
        id: ids.horse,
        displayName: 'Constraint Demo Horse',
        countryOfBirthId: countryId,
        status: RecordStatus.DRAFT,
      },
    });
    expect(
      await prisma.externalIdentifier.count({
        where: { entityType: 'Horse', entityId: ids.horse },
      }),
    ).toBe(0);
  });

  it('preserves club membership history', async () => {
    await prisma.athleteClubMembership.createMany({
      data: [
        {
          id: ids.membershipOne,
          athleteId: ids.athleteOne,
          clubId,
          startDate: new Date('2024-01-01T00:00:00.000Z'),
          endDate: new Date('2024-12-31T00:00:00.000Z'),
        },
        {
          id: ids.membershipTwo,
          athleteId: ids.athleteOne,
          clubId,
          startDate: new Date('2025-01-01T00:00:00.000Z'),
        },
      ],
    });
    expect(await prisma.athleteClubMembership.count({ where: { athleteId: ids.athleteOne } })).toBe(
      2,
    );
  });

  it('preserves horse ownership history', async () => {
    await prisma.owner.create({
      data: {
        id: ids.owner,
        displayName: 'Constraint Demo Owner',
        countryId,
        status: RecordStatus.DRAFT,
      },
    });
    await prisma.horseOwnership.createMany({
      data: [
        {
          id: ids.ownershipOne,
          horseId: ids.horse,
          ownerId: ids.owner,
          startDate: new Date('2024-01-01T00:00:00.000Z'),
          endDate: new Date('2024-12-31T00:00:00.000Z'),
        },
        {
          id: ids.ownershipTwo,
          horseId: ids.horse,
          ownerId: ids.owner,
          startDate: new Date('2025-01-01T00:00:00.000Z'),
        },
      ],
    });
    expect(await prisma.horseOwnership.count({ where: { horseId: ids.horse } })).toBe(2);
  });

  it('creates an informational event and class', async () => {
    await prisma.competitionEvent.create({
      data: {
        id: ids.event,
        title: 'Constraint Demo Event',
        slug: `constraint-demo-${ids.event}`,
        startDate: new Date('2026-08-01T00:00:00.000Z'),
        endDate: new Date('2026-08-02T00:00:00.000Z'),
        status: RecordStatus.DRAFT,
        publicationStatus: PublicationStatus.DRAFT,
      },
    });
    const competitionClass = await prisma.competitionClass.create({
      data: {
        id: ids.competitionClass,
        competitionEventId: ids.event,
        disciplineId,
        title: 'Constraint Demo Class',
        sortOrder: 0,
        status: RecordStatus.DRAFT,
      },
    });
    expect(competitionClass.competitionEventId).toBe(ids.event);
  });

  it('creates results with athlete and horse, including a status-only result without rank', async () => {
    const ranked = await prisma.competitionResult.create({
      data: {
        id: ids.result,
        competitionClassId: ids.competitionClass,
        athleteId: ids.athleteOne,
        horseId: ids.horse,
        rank: 1,
        resultDisplay: 'Constraint result',
        publicationStatus: PublicationStatus.DRAFT,
      },
    });
    const statusOnly = await prisma.competitionResult.create({
      data: {
        id: ids.resultStatusOnly,
        competitionClassId: ids.competitionClass,
        athleteId: ids.athleteTwo,
        horseId: ids.horse,
        rank: null,
        statusId: resultStatusId,
        resultDisplay: 'Constraint status only',
        publicationStatus: PublicationStatus.DRAFT,
      },
    });
    expect(ranked.athleteId).toBe(ids.athleteOne);
    expect(ranked.horseId).toBe(ids.horse);
    expect(statusOnly.rank).toBeNull();
    expect(statusOnly.statusId).toBe(resultStatusId);
  });

  it('rejects a result without a competition class at PostgreSQL level', async () => {
    const invalidId = randomUUID();
    await expect(
      prisma.$executeRaw`
        INSERT INTO "CompetitionResult" (
          "id", "athleteId", "horseId", "publicationStatus", "isDemo", "createdAt", "updatedAt"
        ) VALUES (
          ${invalidId}::uuid, ${ids.athleteOne}::uuid, ${ids.horse}::uuid,
          'DRAFT'::"PublicationStatus", false, now(), now()
        )
      `,
    ).rejects.toThrow();
  });

  it('stores a draft demo ranking snapshot and enforces entry subject shape', async () => {
    await prisma.rankingSnapshot.create({
      data: {
        id: ids.rankingSnapshot,
        rankingPeriodId,
        revision: 2,
        snapshotAt: new Date('2026-08-01T00:00:00.000Z'),
        calculationMethod: 'DEMO',
        calculationStatus: RankingCalculationStatus.DRAFT,
        publicationStatus: PublicationStatus.DRAFT,
        isDemo: true,
      },
    });
    await expect(
      prisma.rankingEntry.create({
        data: {
          rankingSnapshotId: ids.rankingSnapshot,
          subjectType: RankingSubjectType.ATHLETE,
          countedResultCount: 0,
          droppedResultCount: 0,
        },
      }),
    ).rejects.toThrow();
    await prisma.rankingEntry.create({
      data: {
        id: ids.rankingEntry,
        rankingSnapshotId: ids.rankingSnapshot,
        subjectType: RankingSubjectType.ATHLETE,
        athleteId: ids.athleteOne,
        countedResultCount: 1,
        droppedResultCount: 0,
      },
    });
    await expect(
      prisma.rankingEntry.create({
        data: {
          rankingSnapshotId: ids.rankingSnapshot,
          subjectType: RankingSubjectType.ATHLETE,
          athleteId: ids.athleteOne,
          countedResultCount: 0,
          droppedResultCount: 0,
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
    await prisma.rankingEntryResult.create({
      data: {
        id: ids.rankingEntryResult,
        rankingEntryId: ids.rankingEntry,
        competitionResultId: ids.result,
        isCounted: true,
      },
    });
    await expect(
      prisma.rankingEntryResult.create({
        data: {
          rankingEntryId: ids.rankingEntry,
          competitionResultId: ids.result,
          isCounted: true,
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
    const stored = await prisma.rankingSnapshot.findUniqueOrThrow({
      where: { id: ids.rankingSnapshot },
    });
    expect(stored.publicationStatus).toBe(PublicationStatus.DRAFT);
  });

  it('rejects invalid intervals, metric shapes, approval pairs and duplicate revisions', async () => {
    await expect(
      prisma.athleteClubMembership.create({
        data: {
          athleteId: ids.athleteTwo,
          clubId,
          startDate: new Date('2026-12-31T00:00:00.000Z'),
          endDate: new Date('2026-01-01T00:00:00.000Z'),
        },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.resultMetric.create({
        data: {
          competitionResultId: ids.result,
          metricCode: 'INVALID_XOR',
          numericValue: 1,
          textValue: 'also set',
        },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.competitionResult.create({
        data: {
          competitionClassId: ids.competitionClass,
          athleteId: ids.athleteTwo,
          horseId: ids.horse,
          approvedAt: new Date(),
        },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.rankingSnapshot.create({
        data: {
          rankingPeriodId,
          revision: 2,
          snapshotAt: new Date('2026-08-02T00:00:00.000Z'),
          calculationStatus: RankingCalculationStatus.DRAFT,
          publicationStatus: PublicationStatus.DRAFT,
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('uses soft delete and retains the athlete row', async () => {
    const archivedAt = new Date();
    await prisma.athlete.update({ where: { id: ids.athleteOne }, data: { archivedAt } });
    const athlete = await prisma.athlete.findUniqueOrThrow({ where: { id: ids.athleteOne } });
    expect(athlete.archivedAt?.getTime()).toBe(archivedAt.getTime());
    await expect(prisma.athlete.delete({ where: { id: ids.athleteOne } })).rejects.toMatchObject({
      code: 'P2003',
    });
  });

  it('stores a redacted audit record', async () => {
    const audit = await prisma.auditLog.create({
      data: {
        id: ids.audit,
        action: 'TEST_SOFT_DELETE',
        entityType: 'Athlete',
        entityId: ids.athleteOne,
        newData: { archived: true },
        reason: 'Database constraint test',
        requestId: `test-${ids.audit}`,
      },
    });
    expect(audit.entityId).toBe(ids.athleteOne);
  });

  it('runs the demo seed twice without changing stable counts', async () => {
    const first = await seedDatabase(prisma);
    const second = await seedDatabase(prisma);
    expect(second).toEqual(first);
    expect(second).toMatchObject({
      athletes: 10,
      horses: 12,
      events: 3,
      results: 36,
      rankingSnapshots: 1,
    });
  });
});
