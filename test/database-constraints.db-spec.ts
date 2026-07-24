import { randomUUID } from 'node:crypto';

import {
  PrismaClient,
  PublicationStatus,
  RankingCalculationStatus,
  RankingSubjectType,
  RecordStatus,
} from '@prisma/client';
import { ConfigService } from '@nestjs/config';

import { demoId, seedDatabase } from '../prisma/seed';
import { assertSafeTestDatabaseEnvironment } from '../src/common/database/database-safety';
import { AppConfigService } from '../src/config/app-config.service';
import { type Environment, validateEnvironment } from '../src/config/environment.schema';
import { PrismaService } from '../src/database/prisma.service';

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
    athleteHorseRelation: randomUUID(),
    identifier: randomUUID(),
    audit: randomUUID(),
    approver: randomUUID(),
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
    assertSafeTestDatabaseEnvironment(process.env);
    await prisma.$connect();

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
    await prisma.athleteHorseRelation.deleteMany({ where: { id: ids.athleteHorseRelation } });
    await prisma.athleteClubMembership.deleteMany({
      where: { id: { in: [ids.membershipOne, ids.membershipTwo] } },
    });
    await prisma.owner.deleteMany({ where: { id: ids.owner } });
    await prisma.horse.deleteMany({ where: { id: ids.horse } });
    await prisma.athlete.deleteMany({ where: { id: { in: [ids.athleteOne, ids.athleteTwo] } } });
    await prisma.user.deleteMany({ where: { id: ids.approver } });
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
    expect(
      await prisma.externalIdentifier.count({
        where: { entityType: 'Athlete', entityId: { in: [ids.athleteOne, ids.athleteTwo] } },
      }),
    ).toBe(0);
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

  it('creates a horse without passport, microchip or FEI identifiers', async () => {
    const horse = await prisma.horse.create({
      data: {
        id: ids.horse,
        displayName: 'Constraint Demo Horse',
        countryOfBirthId: countryId,
        status: RecordStatus.DRAFT,
      },
    });
    expect(horse.passportName).toBeNull();
    expect(
      await prisma.externalIdentifier.count({
        where: { entityType: 'Horse', entityId: ids.horse },
      }),
    ).toBe(0);
  });

  it('stores athlete-horse relation history', async () => {
    const relation = await prisma.athleteHorseRelation.create({
      data: {
        id: ids.athleteHorseRelation,
        athleteId: ids.athleteOne,
        horseId: ids.horse,
        disciplineId,
        relationType: 'TEST_RELATION',
        startDate: new Date('2025-01-01T00:00:00.000Z'),
      },
    });
    expect(relation.endDate).toBeNull();
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
      prisma.resultMetric.create({
        data: {
          competitionResultId: ids.result,
          metricCode: 'INVALID_DEMO_BOUNDARY',
          textValue: 'must be rejected',
          isDemo: true,
        },
      }),
    ).rejects.toThrow(/demo boundary/u);
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

  it('enforces explicit, non-demo publication state for public profiles', async () => {
    const profileCountryId = randomUUID();
    await prisma.country.create({
      data: {
        id: profileCountryId,
        isoAlpha2: 'XZ',
        isoAlpha3: 'XZZ',
        name: 'Constraint publication country',
      },
    });
    try {
      await expect(
        prisma.country.update({
          where: { id: profileCountryId },
          data: { publicationStatus: PublicationStatus.PUBLISHED },
        }),
      ).rejects.toThrow(/Country_published_timestamp_check/u);

      await prisma.country.update({
        where: { id: profileCountryId },
        data: { isDemo: true },
      });
      await expect(
        prisma.country.update({
          where: { id: profileCountryId },
          data: {
            publicationStatus: PublicationStatus.PUBLISHED,
            publishedAt: new Date(),
          },
        }),
      ).rejects.toThrow(/Country_demo_publication_check/u);

      const constraints = await prisma.$queryRaw<{ constraintName: string }[]>`
        SELECT conname AS "constraintName"
        FROM pg_constraint
        WHERE conname IN (
          'Country_published_timestamp_check',
          'Country_demo_publication_check',
          'Discipline_published_timestamp_check',
          'Discipline_demo_publication_check',
          'Club_published_timestamp_check',
          'Club_demo_publication_check',
          'Athlete_published_timestamp_check',
          'Athlete_demo_publication_check',
          'Horse_published_timestamp_check',
          'Horse_demo_publication_check'
        )
        ORDER BY conname
      `;
      expect(constraints).toHaveLength(10);
    } finally {
      await prisma.country.delete({ where: { id: profileCountryId } });
    }
  });

  it('installs the measured trigram search indexes', async () => {
    const extensions = await prisma.$queryRaw<{ extensionName: string }[]>`
      SELECT extname AS "extensionName"
      FROM pg_extension
      WHERE extname = 'pg_trgm'
    `;
    expect(extensions).toEqual([{ extensionName: 'pg_trgm' }]);

    const indexes = await prisma.$queryRaw<{ indexName: string }[]>`
      SELECT indexname AS "indexName"
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname IN (
          'Club_public_search_name_trgm_idx',
          'Athlete_public_search_firstName_trgm_idx',
          'Athlete_public_search_lastName_trgm_idx',
          'Athlete_public_search_displayName_trgm_idx',
          'Horse_public_search_passportName_trgm_idx',
          'Horse_public_search_displayName_trgm_idx',
          'Horse_public_search_breed_trgm_idx',
          'Horse_public_search_color_trgm_idx',
          'CompetitionEvent_public_search_title_trgm_idx',
          'CompetitionEvent_public_search_description_trgm_idx',
          'CompetitionEvent_public_search_location_trgm_idx',
          'CompetitionEvent_public_search_venue_trgm_idx',
          'CompetitionClass_public_search_title_trgm_idx',
          'CompetitionClass_public_search_category_trgm_idx',
          'CompetitionClass_public_search_level_trgm_idx'
        )
    `;
    expect(indexes).toHaveLength(15);
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

  it('archives a horse and event without deleting their results', async () => {
    const archivedAt = new Date();
    await prisma.horse.update({ where: { id: ids.horse }, data: { archivedAt } });
    await prisma.competitionEvent.update({ where: { id: ids.event }, data: { archivedAt } });

    expect(await prisma.competitionResult.count({ where: { horseId: ids.horse } })).toBe(2);
    expect(
      await prisma.competitionResult.count({
        where: { competitionClass: { competitionEventId: ids.event } },
      }),
    ).toBe(2);
    await expect(prisma.horse.delete({ where: { id: ids.horse } })).rejects.toMatchObject({
      code: 'P2003',
    });
    await expect(
      prisma.competitionEvent.delete({ where: { id: ids.event } }),
    ).rejects.toMatchObject({ code: 'P2003' });
  });

  it('restricts deletion of an approval actor so approval evidence remains valid', async () => {
    await prisma.user.create({
      data: {
        id: ids.approver,
        email: `approver-${ids.approver}@example.test`,
        displayName: 'Constraint Approval Actor',
      },
    });
    await prisma.competitionResult.update({
      where: { id: ids.result },
      data: { approvedAt: new Date(), approvedById: ids.approver },
    });

    await expect(prisma.user.delete({ where: { id: ids.approver } })).rejects.toMatchObject({
      code: 'P2003',
    });

    await prisma.competitionResult.update({
      where: { id: ids.result },
      data: { approvedAt: null, approvedById: null },
    });
  });

  it('enforces administrator credential, session and audit correlation constraints', async () => {
    const userId = randomUUID();
    await prisma.user.create({
      data: {
        id: userId,
        email: `security-${userId}@example.invalid`,
        displayName: 'Security Constraint Fixture',
        isDemo: true,
      },
    });
    await prisma.userCredential.create({
      data: {
        userId,
        passwordHash: 'test-only-password-hash',
        totpSecretEncrypted: 'test-only-encrypted-secret',
        twoFactorEnabledAt: new Date(),
      },
    });
    const sessionBase = {
      userId,
      tokenHash: 'a'.repeat(64),
      csrfTokenHash: 'b'.repeat(64),
      expiresAt: new Date(Date.now() + 60_000),
      idleExpiresAt: new Date(Date.now() + 30_000),
    };
    try {
      await expect(
        prisma.userCredential.update({
          where: { userId },
          data: { lastTotpStep: -1n },
        }),
      ).rejects.toThrow('UserCredential_lastTotpStep_check');
      await expect(
        prisma.adminSession.create({
          data: { ...sessionBase, secondFactorMethod: 'UNSUPPORTED' },
        }),
      ).rejects.toThrow('AdminSession_secondFactorMethod_check');
      await expect(
        prisma.adminSession.create({
          data: {
            ...sessionBase,
            secondFactorMethod: 'RECOVERY',
            pendingTotpSecretEncrypted: 'missing-expiry',
          },
        }),
      ).rejects.toThrow('AdminSession_pendingTotp_pair_check');
      await expect(
        prisma.adminSession.create({
          data: {
            ...sessionBase,
            secondFactorMethod: 'TOTP',
            previousTokenHash: sessionBase.tokenHash,
            previousTokenExpiresAt: new Date(Date.now() + 5_000),
          },
        }),
      ).rejects.toThrow('AdminSession_previousTokenHash_check');
      await expect(
        prisma.auditLog.create({
          data: {
            action: 'INVALID_SESSION_REFERENCE',
            entityType: 'User',
            entityId: userId,
            sessionId: randomUUID(),
          },
        }),
      ).rejects.toMatchObject({ code: 'P2003' });
    } finally {
      await prisma.adminSession.deleteMany({ where: { userId } });
      await prisma.userCredential.delete({ where: { userId } });
      await prisma.user.delete({ where: { id: userId } });
    }
  });

  it('enforces optimistic versions and restrictive permission assignments', async () => {
    await expect(
      prisma.country.update({
        where: { id: countryId },
        data: { version: 0 },
      }),
    ).rejects.toThrow('Country_version_check');

    const permission = await prisma.permission.create({
      data: {
        code: `CONSTRAINT_${randomUUID()}`,
        name: 'Constraint-only permission',
        isSystem: false,
      },
    });
    const role = await prisma.role.create({
      data: {
        code: `CONSTRAINT_${randomUUID()}`,
        name: 'Constraint-only role',
        isSystem: false,
        isDemo: true,
      },
    });
    const assignment = await prisma.rolePermission.create({
      data: { roleId: role.id, permissionId: permission.id },
    });
    try {
      await expect(
        prisma.rolePermission.create({
          data: { roleId: role.id, permissionId: permission.id },
        }),
      ).rejects.toMatchObject({ code: 'P2002' });
      await expect(
        prisma.permission.delete({ where: { id: permission.id } }),
      ).rejects.toMatchObject({ code: 'P2003' });
    } finally {
      await prisma.rolePermission.delete({ where: { id: assignment.id } });
      await prisma.permission.delete({ where: { id: permission.id } });
      await prisma.role.delete({ where: { id: role.id } });
    }
  });

  it('keeps the real runtime database role non-owner and audit append-only', async () => {
    const suffix = randomUUID().replaceAll('-', '');
    const roleName = `fem_runtime_test_${suffix}`;
    const password = `Runtime-${suffix}!`;
    const ownerUrl = process.env.DATABASE_URL;
    if (!ownerUrl) throw new Error('DATABASE_URL is required by the test safety guard');
    const runtimeUrl = new URL(ownerUrl);
    runtimeUrl.username = roleName;
    runtimeUrl.password = password;
    const runtime = new PrismaClient({ datasourceUrl: runtimeUrl.toString() });
    const revokedPublicConnectDatabases: string[] = [];
    const [capability] = await prisma.$queryRaw<{ name: string }[]>`
      SELECT 'fem_runtime_' || substring(md5(current_database()), 1, 16) AS name
    `;
    if (!capability) throw new Error('Database-scoped runtime capability role is missing');
    await prisma.$executeRawUnsafe(
      `CREATE ROLE "${roleName}" LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION`,
    );
    await prisma.$executeRawUnsafe(
      `GRANT "${capability.name}" TO "${roleName}" ` + 'WITH ADMIN FALSE, INHERIT TRUE, SET FALSE',
    );
    const otherDatabases = await prisma.$queryRaw<{ name: string }[]>`
      SELECT datname AS name
      FROM pg_database
      WHERE datallowconn = true
        AND datname <> current_database()
        AND has_database_privilege(${roleName}, oid, 'CONNECT')
      ORDER BY datname
    `;
    for (const database of otherDatabases) {
      const safeDatabaseName = database.name.replaceAll('"', '""');
      await prisma.$executeRawUnsafe(
        `REVOKE CONNECT ON DATABASE "${safeDatabaseName}" FROM PUBLIC`,
      );
      revokedPublicConnectDatabases.push(database.name);
    }
    try {
      await runtime.$connect();
      const [identity] = await runtime.$queryRaw<
        {
          isSuperuser: boolean;
          ownsPublicObject: boolean;
          canCreateDatabaseObjects: boolean;
        }[]
      >`
        SELECT
          role.rolsuper AS "isSuperuser",
          has_database_privilege(current_user, current_database(), 'CREATE')
            AS "canCreateDatabaseObjects",
          EXISTS (
            SELECT 1
            FROM pg_class owned_class
            JOIN pg_namespace owned_namespace
              ON owned_namespace.oid = owned_class.relnamespace
            WHERE owned_namespace.nspname = 'public'
              AND owned_class.relowner = role.oid
          ) AS "ownsPublicObject"
        FROM pg_roles role
        WHERE role.rolname = current_user
      `;
      expect(identity).toEqual({
        isSuperuser: false,
        ownsPublicObject: false,
        canCreateDatabaseObjects: false,
      });

      const domainTables = new Set([
        'ImportBatch',
        'ImportRow',
        'MediaFile',
        'Document',
        'ExternalIdentifier',
        'Country',
        'NationalFederation',
        'Discipline',
        'Club',
        'ResultStatus',
        'Athlete',
        'Horse',
        'Owner',
        'AthleteClubMembership',
        'AthleteHorseRelation',
        'HorseOwnership',
        'CompetitionEvent',
        'CompetitionClass',
        'CompetitionResult',
        'ResultMetric',
        'RankingDefinition',
        'RankingRuleSet',
        'RankingPeriod',
        'RankingSnapshot',
        'RankingEntry',
        'RankingEntryResult',
      ]);
      const readOnlySecurityTables = new Set([
        'User',
        'Role',
        'Permission',
        'RolePermission',
        'UserRole',
      ]);
      const tablePrivileges = await prisma.$queryRaw<
        {
          tableName: string;
          select: boolean;
          insert: boolean;
          update: boolean;
          delete: boolean;
          truncate: boolean;
          references: boolean;
          trigger: boolean;
        }[]
      >`
        SELECT
          table_name AS "tableName",
          has_table_privilege(${roleName}, format('%I.%I', table_schema, table_name), 'SELECT')
            AS "select",
          has_table_privilege(${roleName}, format('%I.%I', table_schema, table_name), 'INSERT')
            AS "insert",
          has_table_privilege(${roleName}, format('%I.%I', table_schema, table_name), 'UPDATE')
            AS "update",
          has_table_privilege(${roleName}, format('%I.%I', table_schema, table_name), 'DELETE')
            AS "delete",
          has_table_privilege(${roleName}, format('%I.%I', table_schema, table_name), 'TRUNCATE')
            AS "truncate",
          has_table_privilege(${roleName}, format('%I.%I', table_schema, table_name), 'REFERENCES')
            AS "references",
          has_table_privilege(${roleName}, format('%I.%I', table_schema, table_name), 'TRIGGER')
            AS "trigger"
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `;
      for (const privilege of tablePrivileges) {
        const domain = domainTables.has(privilege.tableName);
        const readOnlySecurity = readOnlySecurityTables.has(privilege.tableName);
        const expected = {
          select:
            domain ||
            readOnlySecurity ||
            [
              'UserCredential',
              'AdminSession',
              'AdminRecoveryCode',
              'RateLimitBucket',
              'IdempotencyRecord',
              'AuditLog',
            ].includes(privilege.tableName),
          insert:
            domain ||
            [
              'AdminSession',
              'AdminRecoveryCode',
              'RateLimitBucket',
              'IdempotencyRecord',
              'AuditLog',
            ].includes(privilege.tableName),
          update:
            domain ||
            [
              'UserCredential',
              'AdminSession',
              'AdminRecoveryCode',
              'RateLimitBucket',
              'IdempotencyRecord',
            ].includes(privilege.tableName),
          delete:
            privilege.tableName === 'ResultMetric' ||
            ['AdminRecoveryCode', 'RateLimitBucket', 'IdempotencyRecord'].includes(
              privilege.tableName,
            ),
          truncate: false,
          references: false,
          trigger: false,
        };
        expect(privilege).toEqual({ tableName: privilege.tableName, ...expected });
      }
      expect(tablePrivileges.map(({ tableName }) => tableName)).toContain('_prisma_migrations');

      const runtimeEnvironment = validateEnvironment({
        ...process.env,
        NODE_ENV: 'production',
        DATABASE_URL: runtimeUrl.toString(),
        CORS_ALLOWED_ORIGINS: 'https://admin.example.test',
        SWAGGER_ENABLED: 'false',
        HSTS_ENABLED: 'false',
      });
      const createRuntimeService = (): PrismaService =>
        new PrismaService(
          new AppConfigService(new ConfigService<Environment, true>(runtimeEnvironment)),
        );
      const runtimeService = createRuntimeService();
      await expect(runtimeService.onModuleInit()).resolves.toBeUndefined();
      await runtimeService.onModuleDestroy();

      const adjacentDatabase = otherDatabases.find((database) => database.name === 'postgres');
      if (!adjacentDatabase) {
        throw new Error('The local PostgreSQL test cluster must contain the postgres database');
      }
      await prisma.$executeRawUnsafe(`GRANT CONNECT ON DATABASE "postgres" TO PUBLIC`);
      try {
        const crossDatabaseService = createRuntimeService();
        await expect(crossDatabaseService.onModuleInit()).rejects.toThrow(
          'restricted database-scoped runtime role',
        );
        await crossDatabaseService.onModuleDestroy();
      } finally {
        await prisma.$executeRawUnsafe(`REVOKE CONNECT ON DATABASE "postgres" FROM PUBLIC`);
      }

      await prisma.$executeRawUnsafe(
        `ALTER ROLE "${roleName}" SET session_replication_role = 'replica'`,
      );
      try {
        const replicaSettingService = createRuntimeService();
        await expect(replicaSettingService.onModuleInit()).rejects.toThrow(
          'restricted database-scoped runtime role',
        );
        await replicaSettingService.onModuleDestroy();
      } finally {
        await prisma.$executeRawUnsafe(`ALTER ROLE "${roleName}" RESET session_replication_role`);
      }

      await prisma.$executeRawUnsafe(`GRANT "${capability.name}" TO "${roleName}" WITH ADMIN TRUE`);
      try {
        const delegatingMembershipService = createRuntimeService();
        await expect(delegatingMembershipService.onModuleInit()).rejects.toThrow(
          'restricted database-scoped runtime role',
        );
        await delegatingMembershipService.onModuleDestroy();
      } finally {
        await prisma.$executeRawUnsafe(
          `GRANT "${capability.name}" TO "${roleName}" ` +
            'WITH ADMIN FALSE, INHERIT TRUE, SET FALSE',
        );
      }

      await prisma.$executeRawUnsafe(
        `REVOKE ALL PRIVILEGES ON TABLE "Athlete" FROM "${capability.name}"`,
      );
      try {
        const missingGrantService = createRuntimeService();
        await expect(missingGrantService.onModuleInit()).rejects.toThrow(
          'restricted database-scoped runtime role',
        );
        await missingGrantService.onModuleDestroy();
      } finally {
        await prisma.$executeRawUnsafe(
          `GRANT SELECT, INSERT, UPDATE ON TABLE "Athlete" TO "${capability.name}"`,
        );
      }

      for (const [grantAttribute, revokeAttribute] of [
        ['CREATEDB', 'NOCREATEDB'],
        ['CREATEROLE', 'NOCREATEROLE'],
        ['REPLICATION', 'NOREPLICATION'],
        ['BYPASSRLS', 'NOBYPASSRLS'],
      ] as const) {
        await prisma.$executeRawUnsafe(`ALTER ROLE "${roleName}" ${grantAttribute}`);
        const unsafeService = createRuntimeService();
        await expect(unsafeService.onModuleInit()).rejects.toThrow(
          'restricted database-scoped runtime role',
        );
        await unsafeService.onModuleDestroy();
        await prisma.$executeRawUnsafe(`ALTER ROLE "${roleName}" ${revokeAttribute}`);
      }

      await prisma.$executeRawUnsafe(`GRANT UPDATE ON TABLE "Permission" TO "${roleName}"`);
      try {
        const excessGrantService = createRuntimeService();
        await expect(excessGrantService.onModuleInit()).rejects.toThrow(
          'restricted database-scoped runtime role',
        );
        await excessGrantService.onModuleDestroy();
      } finally {
        await prisma.$executeRawUnsafe(`REVOKE UPDATE ON TABLE "Permission" FROM "${roleName}"`);
      }

      await prisma.$executeRawUnsafe(`GRANT DELETE ON TABLE "Athlete" TO "${roleName}"`);
      try {
        const destructiveGrantService = createRuntimeService();
        await expect(destructiveGrantService.onModuleInit()).rejects.toThrow(
          'restricted database-scoped runtime role',
        );
        await destructiveGrantService.onModuleDestroy();
      } finally {
        await prisma.$executeRawUnsafe(`REVOKE DELETE ON TABLE "Athlete" FROM "${roleName}"`);
      }

      await prisma.$executeRawUnsafe(
        `GRANT SELECT ON TABLE "Athlete" TO "${roleName}" WITH GRANT OPTION`,
      );
      try {
        const tableGrantOptionService = createRuntimeService();
        await expect(tableGrantOptionService.onModuleInit()).rejects.toThrow(
          'restricted database-scoped runtime role',
        );
        await tableGrantOptionService.onModuleDestroy();
      } finally {
        await prisma.$executeRawUnsafe(`REVOKE SELECT ON TABLE "Athlete" FROM "${roleName}"`);
      }

      await prisma.$executeRawUnsafe(
        `GRANT UPDATE ("description") ON TABLE "Permission" TO "${roleName}"`,
      );
      try {
        const columnGrantService = createRuntimeService();
        await expect(columnGrantService.onModuleInit()).rejects.toThrow(
          'restricted database-scoped runtime role',
        );
        await columnGrantService.onModuleDestroy();
      } finally {
        await prisma.$executeRawUnsafe(
          `REVOKE UPDATE ("description") ON TABLE "Permission" FROM "${roleName}"`,
        );
      }

      await prisma.$executeRawUnsafe(
        `GRANT USAGE ON SCHEMA public TO "${roleName}" WITH GRANT OPTION`,
      );
      try {
        const schemaGrantOptionService = createRuntimeService();
        await expect(schemaGrantOptionService.onModuleInit()).rejects.toThrow(
          'restricted database-scoped runtime role',
        );
        await schemaGrantOptionService.onModuleDestroy();
      } finally {
        await prisma.$executeRawUnsafe(`REVOKE USAGE ON SCHEMA public FROM "${roleName}"`);
      }

      const databaseName = new URL(ownerUrl).pathname.slice(1);
      await prisma.$executeRawUnsafe(
        `GRANT CONNECT ON DATABASE "${databaseName}" TO "${roleName}" WITH GRANT OPTION`,
      );
      try {
        const databaseGrantOptionService = createRuntimeService();
        await expect(databaseGrantOptionService.onModuleInit()).rejects.toThrow(
          'restricted database-scoped runtime role',
        );
        await databaseGrantOptionService.onModuleDestroy();
      } finally {
        await prisma.$executeRawUnsafe(
          `REVOKE CONNECT ON DATABASE "${databaseName}" FROM "${roleName}"`,
        );
      }

      const loginOwnedType = `RuntimeOwnedType${suffix.slice(0, 12)}`;
      await prisma.$executeRawUnsafe(`CREATE TYPE "${loginOwnedType}" AS ENUM ('ACTIVE')`);
      await prisma.$executeRawUnsafe(`ALTER TYPE "${loginOwnedType}" OWNER TO "${roleName}"`);
      try {
        const loginOwnershipService = createRuntimeService();
        await expect(loginOwnershipService.onModuleInit()).rejects.toThrow(
          'restricted database-scoped runtime role',
        );
        await loginOwnershipService.onModuleDestroy();
      } finally {
        await prisma.$executeRawUnsafe(`ALTER TYPE "${loginOwnedType}" OWNER TO CURRENT_USER`);
        await prisma.$executeRawUnsafe(`DROP TYPE "${loginOwnedType}"`);
      }

      await prisma.$executeRawUnsafe(
        `ALTER DEFAULT PRIVILEGES GRANT SELECT ON TABLES TO "${roleName}"`,
      );
      try {
        const loginDefaultAclService = createRuntimeService();
        await expect(loginDefaultAclService.onModuleInit()).rejects.toThrow(
          'restricted database-scoped runtime role',
        );
        await loginDefaultAclService.onModuleDestroy();
      } finally {
        await prisma.$executeRawUnsafe(
          `ALTER DEFAULT PRIVILEGES REVOKE SELECT ON TABLES FROM "${roleName}"`,
        );
      }

      const migrationView = `RuntimeMigrationView${suffix.slice(0, 10)}`;
      await prisma.$executeRawUnsafe(
        `CREATE VIEW "${migrationView}" AS SELECT "migration_name" FROM "_prisma_migrations"`,
      );
      await prisma.$executeRawUnsafe(`GRANT SELECT ON "${migrationView}" TO "${roleName}"`);
      try {
        const migrationViewService = createRuntimeService();
        await expect(migrationViewService.onModuleInit()).rejects.toThrow(
          'restricted database-scoped runtime role',
        );
        await migrationViewService.onModuleDestroy();
      } finally {
        await prisma.$executeRawUnsafe(`REVOKE SELECT ON "${migrationView}" FROM "${roleName}"`);
        await prisma.$executeRawUnsafe(`DROP VIEW "${migrationView}"`);
      }

      const unexpectedSchema = `runtime_schema_${suffix.slice(0, 10)}`;
      await prisma.$executeRawUnsafe(`CREATE SCHEMA "${unexpectedSchema}"`);
      await prisma.$executeRawUnsafe(
        `GRANT USAGE ON SCHEMA "${unexpectedSchema}" TO "${roleName}"`,
      );
      try {
        const unexpectedSchemaService = createRuntimeService();
        await expect(unexpectedSchemaService.onModuleInit()).rejects.toThrow(
          'restricted database-scoped runtime role',
        );
        await unexpectedSchemaService.onModuleDestroy();
      } finally {
        await prisma.$executeRawUnsafe(
          `REVOKE USAGE ON SCHEMA "${unexpectedSchema}" FROM "${roleName}"`,
        );
        await prisma.$executeRawUnsafe(`DROP SCHEMA "${unexpectedSchema}"`);
      }

      await prisma.$executeRawUnsafe(`GRANT SELECT ON "UserCredential" TO PUBLIC`);
      try {
        const publicCredentialGrantService = createRuntimeService();
        await expect(publicCredentialGrantService.onModuleInit()).rejects.toThrow(
          'restricted database-scoped runtime role',
        );
        await publicCredentialGrantService.onModuleDestroy();
      } finally {
        await prisma.$executeRawUnsafe(`REVOKE SELECT ON "UserCredential" FROM PUBLIC`);
      }

      await prisma.$executeRawUnsafe(`GRANT INSERT ON "AuditLog" TO PUBLIC`);
      try {
        const publicAuditGrantService = createRuntimeService();
        await expect(publicAuditGrantService.onModuleInit()).rejects.toThrow(
          'restricted database-scoped runtime role',
        );
        await publicAuditGrantService.onModuleDestroy();
      } finally {
        await prisma.$executeRawUnsafe(`REVOKE INSERT ON "AuditLog" FROM PUBLIC`);
      }

      await prisma.$executeRawUnsafe(
        `GRANT EXECUTE ON FUNCTION pg_catalog.pg_read_file(text) TO "${roleName}"`,
      );
      try {
        const systemFunctionGrantService = createRuntimeService();
        await expect(systemFunctionGrantService.onModuleInit()).rejects.toThrow(
          'restricted database-scoped runtime role',
        );
        await systemFunctionGrantService.onModuleDestroy();
      } finally {
        await prisma.$executeRawUnsafe(
          `REVOKE EXECUTE ON FUNCTION pg_catalog.pg_read_file(text) FROM "${roleName}"`,
        );
      }

      await prisma.$executeRawUnsafe(
        `GRANT EXECUTE ON FUNCTION pg_catalog.pg_read_file(text) TO PUBLIC`,
      );
      try {
        const publicSystemFunctionService = createRuntimeService();
        await expect(publicSystemFunctionService.onModuleInit()).rejects.toThrow(
          'restricted database-scoped runtime role',
        );
        await publicSystemFunctionService.onModuleDestroy();
      } finally {
        await prisma.$executeRawUnsafe(
          `REVOKE EXECUTE ON FUNCTION pg_catalog.pg_read_file(text) FROM PUBLIC`,
        );
      }

      await prisma.$executeRawUnsafe(`GRANT SELECT ON pg_catalog.pg_authid TO PUBLIC`);
      try {
        const publicSystemRelationService = createRuntimeService();
        await expect(publicSystemRelationService.onModuleInit()).rejects.toThrow(
          'restricted database-scoped runtime role',
        );
        await publicSystemRelationService.onModuleDestroy();
      } finally {
        await prisma.$executeRawUnsafe(`REVOKE SELECT ON pg_catalog.pg_authid FROM PUBLIC`);
      }

      const [largeObject] = await prisma.$queryRaw<{ oid: number }[]>`
        SELECT lo_create(0) AS oid
      `;
      if (!largeObject) throw new Error('Large object ownership fixture was not created');
      await prisma.$executeRawUnsafe(
        `ALTER LARGE OBJECT ${largeObject.oid} OWNER TO "${roleName}"`,
      );
      try {
        const largeObjectOwnerService = createRuntimeService();
        await expect(largeObjectOwnerService.onModuleInit()).rejects.toThrow(
          'restricted database-scoped runtime role',
        );
        await largeObjectOwnerService.onModuleDestroy();
      } finally {
        await prisma.$executeRawUnsafe(
          `ALTER LARGE OBJECT ${largeObject.oid} OWNER TO CURRENT_USER`,
        );
        await prisma.$queryRawUnsafe(`SELECT lo_unlink(${largeObject.oid})`);
      }

      const [publicLargeObject] = await prisma.$queryRaw<{ oid: number }[]>`
        SELECT lo_create(0) AS oid
      `;
      if (!publicLargeObject) throw new Error('Public large object fixture was not created');
      await prisma.$executeRawUnsafe(
        `GRANT SELECT ON LARGE OBJECT ${publicLargeObject.oid} TO PUBLIC`,
      );
      try {
        const publicLargeObjectService = createRuntimeService();
        await expect(publicLargeObjectService.onModuleInit()).rejects.toThrow(
          'restricted database-scoped runtime role',
        );
        await publicLargeObjectService.onModuleDestroy();
      } finally {
        await prisma.$executeRawUnsafe(
          `REVOKE SELECT ON LARGE OBJECT ${publicLargeObject.oid} FROM PUBLIC`,
        );
        await prisma.$queryRawUnsafe(`SELECT lo_unlink(${publicLargeObject.oid})`);
      }

      await prisma.$executeRawUnsafe(`GRANT SET ON PARAMETER session_replication_role TO PUBLIC`);
      try {
        const publicParameterService = createRuntimeService();
        await expect(publicParameterService.onModuleInit()).rejects.toThrow(
          'restricted database-scoped runtime role',
        );
        await publicParameterService.onModuleDestroy();
      } finally {
        await prisma.$executeRawUnsafe(
          `REVOKE SET ON PARAMETER session_replication_role FROM PUBLIC`,
        );
      }

      const extraRole = `fem_runtime_extra_${suffix}`;
      await prisma.$executeRawUnsafe(
        `CREATE ROLE "${extraRole}" NOLOGIN CREATEROLE NOSUPERUSER NOCREATEDB NOREPLICATION`,
      );
      await prisma.$executeRawUnsafe(`GRANT "${extraRole}" TO "${roleName}"`);
      try {
        const extraMembershipService = createRuntimeService();
        await expect(extraMembershipService.onModuleInit()).rejects.toThrow(
          'restricted database-scoped runtime role',
        );
        await extraMembershipService.onModuleDestroy();
      } finally {
        await prisma.$executeRawUnsafe(`REVOKE "${extraRole}" FROM "${roleName}"`);
        await prisma.$executeRawUnsafe(`DROP ROLE "${extraRole}"`);
      }

      const inheritedRole = `fem_runtime_inherited_${suffix}`;
      await prisma.$executeRawUnsafe(
        `CREATE ROLE "${inheritedRole}" NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION`,
      );
      await prisma.$executeRawUnsafe(`GRANT "${inheritedRole}" TO "${capability.name}"`);
      try {
        const inheritedMembershipService = createRuntimeService();
        await expect(inheritedMembershipService.onModuleInit()).rejects.toThrow(
          'restricted database-scoped runtime role',
        );
        await inheritedMembershipService.onModuleDestroy();
      } finally {
        await prisma.$executeRawUnsafe(`REVOKE "${inheritedRole}" FROM "${capability.name}"`);
        await prisma.$executeRawUnsafe(`DROP ROLE "${inheritedRole}"`);
      }

      const additionalLogin = `fem_runtime_additional_${suffix}`;
      await prisma.$executeRawUnsafe(
        `CREATE ROLE "${additionalLogin}" LOGIN PASSWORD '${password}x' ` +
          'NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS',
      );
      await prisma.$executeRawUnsafe(`GRANT "${capability.name}" TO "${additionalLogin}"`);
      try {
        const additionalMembershipService = createRuntimeService();
        await expect(additionalMembershipService.onModuleInit()).rejects.toThrow(
          'restricted database-scoped runtime role',
        );
        await additionalMembershipService.onModuleDestroy();
      } finally {
        await prisma.$executeRawUnsafe(`REVOKE "${capability.name}" FROM "${additionalLogin}"`);
        await prisma.$executeRawUnsafe(`DROP ROLE "${additionalLogin}"`);
      }

      const capabilityOwnedTable = `CapabilityOwned${suffix.slice(0, 12)}`;
      await prisma.$executeRawUnsafe(
        `CREATE TABLE "${capabilityOwnedTable}" ("id" integer NOT NULL)`,
      );
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "${capabilityOwnedTable}" OWNER TO "${capability.name}"`,
      );
      try {
        const ownerReachabilityService = createRuntimeService();
        await expect(ownerReachabilityService.onModuleInit()).rejects.toThrow(
          'restricted database-scoped runtime role',
        );
        await ownerReachabilityService.onModuleDestroy();
      } finally {
        await prisma.$executeRawUnsafe(`DROP TABLE "${capabilityOwnedTable}"`);
      }

      await prisma.$executeRawUnsafe(
        `ALTER DEFAULT PRIVILEGES GRANT SELECT ON TABLES TO "${capability.name}"`,
      );
      try {
        const defaultAclService = createRuntimeService();
        await expect(defaultAclService.onModuleInit()).rejects.toThrow(
          'restricted database-scoped runtime role',
        );
        await defaultAclService.onModuleDestroy();
      } finally {
        await prisma.$executeRawUnsafe(
          `ALTER DEFAULT PRIVILEGES REVOKE SELECT ON TABLES FROM "${capability.name}"`,
        );
      }

      const ownerEnvironment = validateEnvironment({
        ...process.env,
        NODE_ENV: 'production',
        DATABASE_URL: ownerUrl,
        CORS_ALLOWED_ORIGINS: 'https://admin.example.test',
        SWAGGER_ENABLED: 'false',
        HSTS_ENABLED: 'false',
      });
      const ownerService = new PrismaService(
        new AppConfigService(new ConfigService<Environment, true>(ownerEnvironment)),
      );
      await expect(ownerService.onModuleInit()).rejects.toThrow(
        'restricted database-scoped runtime role',
      );
      await ownerService.onModuleDestroy();

      const bucketKey = `runtime-role-${suffix}`;
      await runtime.rateLimitBucket.create({
        data: {
          key: bucketKey,
          throttlerName: 'test',
          windowStartedAt: new Date(),
          expiresAt: new Date(Date.now() + 60_000),
          totalHits: 1,
        },
      });
      await runtime.rateLimitBucket.delete({ where: { key: bucketKey } });

      const audit = await runtime.auditLog.create({
        data: {
          action: 'RUNTIME_ROLE_TEST',
          entityType: 'DatabaseRole',
          entityId: randomUUID(),
        },
      });
      await expect(
        runtime.auditLog.update({
          where: { id: audit.id },
          data: { reason: 'must fail' },
        }),
      ).rejects.toThrow(/permission denied/i);
      await expect(runtime.auditLog.delete({ where: { id: audit.id } })).rejects.toThrow(
        /permission denied/i,
      );
      await expect(runtime.$executeRawUnsafe('TRUNCATE TABLE "AuditLog"')).rejects.toThrow(
        /permission denied/i,
      );
      await expect(
        runtime.$executeRawUnsafe(
          'ALTER TABLE "AuditLog" DISABLE TRIGGER "AuditLog_prevent_update_delete"',
        ),
      ).rejects.toThrow(/must be owner|permission denied/i);
      await expect(
        runtime.$executeRawUnsafe('DROP TRIGGER "AuditLog_prevent_update_delete" ON "AuditLog"'),
      ).rejects.toThrow(/must be owner|permission denied/i);
      const migrationHistoryStatements = [
        'SELECT * FROM "_prisma_migrations"',
        `INSERT INTO "_prisma_migrations" ("id", "checksum", "migration_name", "started_at", "applied_steps_count") VALUES ('${randomUUID()}', 'blocked', 'blocked', CURRENT_TIMESTAMP, 0)`,
        'UPDATE "_prisma_migrations" SET "checksum" = \'blocked\'',
        'DELETE FROM "_prisma_migrations"',
        'TRUNCATE TABLE "_prisma_migrations"',
      ];
      for (const statement of migrationHistoryStatements) {
        await expect(runtime.$executeRawUnsafe(statement)).rejects.toThrow(/permission denied/i);
      }
      await expect(
        runtime.permission.updateMany({ data: { description: 'must fail' } }),
      ).rejects.toThrow(/permission denied/i);

      const futureTable = `RuntimeFuture${suffix.slice(0, 16)}`;
      const futureSequence = `RuntimeFutureSequence${suffix.slice(0, 8)}`;
      await prisma.$executeRawUnsafe(`CREATE TABLE "${futureTable}" ("id" integer NOT NULL)`);
      await prisma.$executeRawUnsafe(`CREATE SEQUENCE "${futureSequence}"`);
      try {
        await expect(runtime.$queryRawUnsafe(`SELECT * FROM "${futureTable}"`)).rejects.toThrow(
          /permission denied/i,
        );
        await prisma.$executeRawUnsafe(
          `GRANT SELECT ON TABLE "${futureTable}" TO "${capability.name}"`,
        );
        await expect(runtime.$queryRawUnsafe(`SELECT * FROM "${futureTable}"`)).resolves.toEqual(
          [],
        );
        await expect(
          runtime.$queryRawUnsafe(`SELECT nextval('"${futureSequence}"')`),
        ).rejects.toThrow(/permission denied/i);
        await prisma.$executeRawUnsafe(
          `GRANT USAGE ON SEQUENCE "${futureSequence}" TO "${capability.name}"`,
        );
        await expect(
          runtime.$queryRawUnsafe(`SELECT nextval('"${futureSequence}"')`),
        ).resolves.toHaveLength(1);
      } finally {
        await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "${futureTable}"`);
        await prisma.$executeRawUnsafe(`DROP SEQUENCE IF EXISTS "${futureSequence}"`);
      }
    } finally {
      await runtime.$disconnect();
      await prisma.$executeRawUnsafe(`REVOKE "${capability.name}" FROM "${roleName}"`);
      await prisma.$executeRawUnsafe(`DROP ROLE IF EXISTS "${roleName}"`);
      for (const databaseName of revokedPublicConnectDatabases) {
        const safeDatabaseName = databaseName.replaceAll('"', '""');
        await prisma.$executeRawUnsafe(`GRANT CONNECT ON DATABASE "${safeDatabaseName}" TO PUBLIC`);
      }
    }
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
    await expect(
      prisma.auditLog.update({
        where: { id: ids.audit },
        data: { reason: 'Mutation must fail' },
      }),
    ).rejects.toThrow('AuditLog is append-only');
    await expect(prisma.auditLog.delete({ where: { id: ids.audit } })).rejects.toThrow(
      'AuditLog is append-only',
    );
  });

  it('runs the demo seed twice without changing stable counts', async () => {
    const first = await seedDatabase(prisma);
    const second = await seedDatabase(prisma);
    expect(second).toEqual(first);
    expect(second).toMatchObject({
      athletes: 16,
      horses: 16,
      events: 3,
      results: 60,
      rankingSnapshots: 1,
    });
  });

  it('creates presentation-ready linked demo records without official identifiers', async () => {
    const [classes, identifiers, templateAthletes, templateHorses] = await Promise.all([
      prisma.competitionClass.findMany({
        where: { isDemo: true },
        select: { category: true, level: true, sortOrder: true },
      }),
      prisma.externalIdentifier.findMany({
        where: {
          isDemo: true,
          namespace: 'FEM_DEMO',
          identifierType: 'DEMO_RECORD_CODE',
        },
        select: { entityType: true, value: true, verificationStatus: true },
      }),
      prisma.athlete.count({ where: { isDemo: true, displayName: { startsWith: 'Demo Rider' } } }),
      prisma.horse.count({ where: { isDemo: true, displayName: { startsWith: 'Demo Horse' } } }),
    ]);

    expect(classes).toHaveLength(12);
    expect(classes.every((item) => item.category && item.level && item.sortOrder >= 0)).toBe(true);
    expect(new Set(classes.map((item) => item.category)).size).toBe(4);
    expect(identifiers).toHaveLength(32);
    expect(
      identifiers.every(
        (item) =>
          ['Athlete', 'Horse'].includes(item.entityType) &&
          /^(ATH|HRS)-\d{3}$/.test(item.value) &&
          item.verificationStatus === 'UNVERIFIED',
      ),
    ).toBe(true);
    expect(templateAthletes).toBe(0);
    expect(templateHorses).toBe(0);
  });

  it('retries concurrent serializable seed runs without partial failure', async () => {
    const [first, second] = await Promise.all([seedDatabase(prisma), seedDatabase(prisma)]);
    expect(second).toEqual(first);
  });

  it('rejects a non-demo natural-key collision without changing the row', async () => {
    const original = await prisma.country.findUniqueOrThrow({ where: { isoAlpha2: 'MD' } });
    const sentinelName = 'Protected non-demo Moldova';

    await prisma.country.update({
      where: { id: original.id },
      data: { name: sentinelName, isDemo: false },
    });

    try {
      await expect(seedDatabase(prisma)).rejects.toThrow(/Demo seed collision/);
      await expect(
        prisma.country.findUniqueOrThrow({ where: { id: original.id } }),
      ).resolves.toMatchObject({
        name: sentinelName,
        isDemo: false,
        archivedAt: original.archivedAt,
      });
    } finally {
      await prisma.country.update({
        where: { id: original.id },
        data: {
          isoAlpha3: original.isoAlpha3,
          name: original.name,
          isDemo: original.isDemo,
          archivedAt: original.archivedAt,
        },
      });
    }
  });

  it('rejects a non-demo deterministic-ID collision without changing the row', async () => {
    const id = demoId('club:1');
    const original = await prisma.club.findUniqueOrThrow({ where: { id } });
    const sentinelName = 'Protected deterministic identifier';
    await prisma.club.update({
      where: { id },
      data: { name: sentinelName, isDemo: false },
    });

    try {
      await expect(seedDatabase(prisma)).rejects.toThrow(/deterministic identifiers/);
      await expect(prisma.club.findUniqueOrThrow({ where: { id } })).resolves.toMatchObject({
        name: sentinelName,
        isDemo: false,
      });
    } finally {
      await prisma.club.update({
        where: { id },
        data: { name: original.name, isDemo: original.isDemo },
      });
    }
  });

  it('rolls back earlier seed writes when a later model fails', async () => {
    const original = await prisma.country.findUniqueOrThrow({ where: { isoAlpha2: 'MD' } });
    const sentinelName = 'Seed rollback sentinel';

    await prisma.country.update({ where: { id: original.id }, data: { name: sentinelName } });
    await prisma.$executeRaw`
      CREATE OR REPLACE FUNCTION fail_demo_event_seed_for_test()
      RETURNS trigger AS $$
      BEGIN
        IF NEW.slug = 'demo-event-1' THEN
          RAISE EXCEPTION 'forced demo seed failure';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `;
    await prisma.$executeRaw`
      CREATE TRIGGER fail_demo_event_seed_for_test
      BEFORE UPDATE ON "CompetitionEvent"
      FOR EACH ROW EXECUTE FUNCTION fail_demo_event_seed_for_test()
    `;

    try {
      await expect(seedDatabase(prisma)).rejects.toThrow();
      await expect(
        prisma.country.findUniqueOrThrow({ where: { id: original.id } }),
      ).resolves.toMatchObject({
        name: sentinelName,
        isDemo: true,
      });
    } finally {
      await prisma.$executeRaw`
        DROP TRIGGER IF EXISTS fail_demo_event_seed_for_test ON "CompetitionEvent"
      `;
      await prisma.$executeRaw`DROP FUNCTION IF EXISTS fail_demo_event_seed_for_test()`;
      await prisma.country.update({
        where: { id: original.id },
        data: {
          isoAlpha3: original.isoAlpha3,
          name: original.name,
          isDemo: original.isDemo,
          archivedAt: original.archivedAt,
        },
      });
    }
  });
});
