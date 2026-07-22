import { createHash } from 'node:crypto';

import {
  ImportBatchStatus,
  PrismaClient,
  PublicationStatus,
  RankingCalculationStatus,
  RankingSubjectType,
  RecordStatus,
} from '@prisma/client';

const prisma = new PrismaClient();

const DEMO_SEED_VERSION = 'database-v1';

function demoId(key: string): string {
  const hex = createHash('sha256').update(`fem:${DEMO_SEED_VERSION}:${key}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function date(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function requiredAt<T>(items: readonly T[], index: number, label: string): T {
  const item = items[index];
  if (item === undefined) {
    throw new Error(`Missing ${label} at index ${index}`);
  }
  return item;
}

export interface SeedSummary {
  countries: number;
  federations: number;
  disciplines: number;
  clubs: number;
  athletes: number;
  horses: number;
  owners: number;
  events: number;
  classes: number;
  results: number;
  rankingSnapshots: number;
}

export async function seedDatabase(client: PrismaClient): Promise<SeedSummary> {
  const countryInput = [
    ['MD', 'MDA', 'Moldova'],
    ['RO', 'ROU', 'Romania'],
    ['UA', 'UKR', 'Ukraine'],
    ['PL', 'POL', 'Poland'],
    ['DE', 'DEU', 'Germany'],
  ] as const;

  for (const [isoAlpha2, isoAlpha3, name] of countryInput) {
    await client.country.upsert({
      where: { isoAlpha2 },
      update: { isoAlpha3, name, isDemo: true, archivedAt: null },
      create: { id: demoId(`country:${isoAlpha2}`), isoAlpha2, isoAlpha3, name, isDemo: true },
    });
  }

  const moldova = await client.country.findUniqueOrThrow({ where: { isoAlpha2: 'MD' } });
  const federationId = demoId('federation:moldova');
  await client.nationalFederation.upsert({
    where: { id: federationId },
    update: {
      countryId: moldova.id,
      name: 'National Equestrian Federation of Moldova — Demo Record',
      shortName: 'FEM DEMO',
      status: RecordStatus.DRAFT,
      isDemo: true,
      archivedAt: null,
    },
    create: {
      id: federationId,
      countryId: moldova.id,
      name: 'National Equestrian Federation of Moldova — Demo Record',
      shortName: 'FEM DEMO',
      status: RecordStatus.DRAFT,
      isDemo: true,
    },
  });

  const disciplineInput = [
    ['DEMO_DRESSAGE', 'Demo Dressage'],
    ['DEMO_JUMPING', 'Demo Jumping'],
    ['DEMO_EVENTING', 'Demo Eventing'],
  ] as const;
  for (const [code, name] of disciplineInput) {
    await client.discipline.upsert({
      where: { code },
      update: { name, status: RecordStatus.DRAFT, isDemo: true, archivedAt: null },
      create: {
        id: demoId(`discipline:${code}`),
        code,
        name,
        status: RecordStatus.DRAFT,
        isDemo: true,
      },
    });
  }
  const disciplines = await client.discipline.findMany({
    where: { code: { in: disciplineInput.map(([code]) => code) } },
    orderBy: { code: 'asc' },
  });

  const clubIds: string[] = [];
  for (let index = 1; index <= 3; index += 1) {
    const id = demoId(`club:${index}`);
    clubIds.push(id);
    await client.club.upsert({
      where: { id },
      update: {
        name: `Demo Equestrian Club ${index}`,
        countryId: moldova.id,
        nationalFederationId: federationId,
        status: RecordStatus.DRAFT,
        isDemo: true,
        archivedAt: null,
      },
      create: {
        id,
        name: `Demo Equestrian Club ${index}`,
        countryId: moldova.id,
        nationalFederationId: federationId,
        status: RecordStatus.DRAFT,
        isDemo: true,
      },
    });
  }

  const athleteIds: string[] = [];
  for (let index = 1; index <= 10; index += 1) {
    const id = demoId(`athlete:${index}`);
    athleteIds.push(id);
    const suffix = index.toString().padStart(2, '0');
    await client.athlete.upsert({
      where: { id },
      update: {
        firstName: 'Demo',
        lastName: `Rider ${suffix}`,
        displayName: `Demo Rider ${suffix}`,
        countryId: moldova.id,
        nationalFederationId: federationId,
        status: RecordStatus.DRAFT,
        isDemo: true,
        archivedAt: null,
      },
      create: {
        id,
        firstName: 'Demo',
        lastName: `Rider ${suffix}`,
        displayName: `Demo Rider ${suffix}`,
        countryId: moldova.id,
        nationalFederationId: federationId,
        status: RecordStatus.DRAFT,
        isDemo: true,
      },
    });
    await client.athleteClubMembership.upsert({
      where: { id: demoId(`membership:${index}`) },
      update: {
        athleteId: id,
        clubId: requiredAt(clubIds, (index - 1) % clubIds.length, 'club'),
        startDate: date('2026-01-01'),
        endDate: null,
        membershipType: null,
        isDemo: true,
        archivedAt: null,
      },
      create: {
        id: demoId(`membership:${index}`),
        athleteId: id,
        clubId: requiredAt(clubIds, (index - 1) % clubIds.length, 'club'),
        startDate: date('2026-01-01'),
        isDemo: true,
      },
    });
  }

  const horseIds: string[] = [];
  for (let index = 1; index <= 12; index += 1) {
    const id = demoId(`horse:${index}`);
    horseIds.push(id);
    const suffix = index.toString().padStart(2, '0');
    await client.horse.upsert({
      where: { id },
      update: {
        passportName: null,
        displayName: `Demo Horse ${suffix}`,
        birthYear: 2012 + (index % 8),
        countryOfBirthId: moldova.id,
        status: RecordStatus.DRAFT,
        isDemo: true,
        archivedAt: null,
      },
      create: {
        id,
        displayName: `Demo Horse ${suffix}`,
        birthYear: 2012 + (index % 8),
        countryOfBirthId: moldova.id,
        status: RecordStatus.DRAFT,
        isDemo: true,
      },
    });
    await client.athleteHorseRelation.upsert({
      where: { id: demoId(`athlete-horse:${index}`) },
      update: {
        athleteId: requiredAt(athleteIds, (index - 1) % athleteIds.length, 'athlete'),
        horseId: id,
        relationType: null,
        disciplineId: null,
        startDate: date('2026-01-01'),
        endDate: null,
        isDemo: true,
        archivedAt: null,
      },
      create: {
        id: demoId(`athlete-horse:${index}`),
        athleteId: requiredAt(athleteIds, (index - 1) % athleteIds.length, 'athlete'),
        horseId: id,
        startDate: date('2026-01-01'),
        isDemo: true,
      },
    });
  }

  const ownerIds: string[] = [];
  for (let index = 1; index <= 5; index += 1) {
    const id = demoId(`owner:${index}`);
    ownerIds.push(id);
    await client.owner.upsert({
      where: { id },
      update: {
        displayName: `Demo Owner ${index.toString().padStart(2, '0')}`,
        countryId: moldova.id,
        status: RecordStatus.DRAFT,
        isDemo: true,
        archivedAt: null,
      },
      create: {
        id,
        displayName: `Demo Owner ${index.toString().padStart(2, '0')}`,
        countryId: moldova.id,
        status: RecordStatus.DRAFT,
        isDemo: true,
      },
    });
  }
  for (let index = 1; index <= horseIds.length; index += 1) {
    await client.horseOwnership.upsert({
      where: { id: demoId(`ownership:${index}`) },
      update: {
        horseId: requiredAt(horseIds, index - 1, 'horse'),
        ownerId: requiredAt(ownerIds, (index - 1) % ownerIds.length, 'owner'),
        startDate: date('2026-01-01'),
        endDate: null,
        ownershipShare: null,
        isDemo: true,
        archivedAt: null,
      },
      create: {
        id: demoId(`ownership:${index}`),
        horseId: requiredAt(horseIds, index - 1, 'horse'),
        ownerId: requiredAt(ownerIds, (index - 1) % ownerIds.length, 'owner'),
        startDate: date('2026-01-01'),
        isDemo: true,
      },
    });
  }

  const statusInput = [
    ['DEMO_FINISHED', 'Demo finished', true],
    ['DEMO_STATUS_ONLY', 'Demo status only', false],
  ] as const;
  for (let index = 0; index < statusInput.length; index += 1) {
    const [code, label, isRankEligible] = requiredAt(statusInput, index, 'result status');
    await client.resultStatus.upsert({
      where: { code },
      update: { label, isRankEligible, sortOrder: index, status: RecordStatus.DRAFT, isDemo: true },
      create: {
        id: demoId(`result-status:${code}`),
        code,
        label,
        isRankEligible,
        sortOrder: index,
        status: RecordStatus.DRAFT,
        isDemo: true,
      },
    });
  }
  const finishedStatus = await client.resultStatus.findUniqueOrThrow({
    where: { code: 'DEMO_FINISHED' },
  });
  const statusOnly = await client.resultStatus.findUniqueOrThrow({
    where: { code: 'DEMO_STATUS_ONLY' },
  });

  const classIds: string[] = [];
  const eventIds: string[] = [];
  for (let eventIndex = 1; eventIndex <= 3; eventIndex += 1) {
    const eventId = demoId(`event:${eventIndex}`);
    eventIds.push(eventId);
    const eventDate = `2026-0${eventIndex + 5}-1${eventIndex}`;
    await client.competitionEvent.upsert({
      where: { slug: `demo-event-${eventIndex}` },
      update: {
        title: `Demo Competition Event ${eventIndex}`,
        startDate: date(eventDate),
        endDate: date(eventDate),
        countryId: moldova.id,
        organizerName: 'Demo Organizer',
        status: RecordStatus.DRAFT,
        publicationStatus: PublicationStatus.DRAFT,
        publishedAt: null,
        isDemo: true,
        archivedAt: null,
      },
      create: {
        id: eventId,
        title: `Demo Competition Event ${eventIndex}`,
        slug: `demo-event-${eventIndex}`,
        startDate: date(eventDate),
        endDate: date(eventDate),
        countryId: moldova.id,
        organizerName: 'Demo Organizer',
        status: RecordStatus.DRAFT,
        publicationStatus: PublicationStatus.DRAFT,
        isDemo: true,
      },
    });
    const classCount = eventIndex === 3 ? 2 : 3;
    for (let classIndex = 1; classIndex <= classCount; classIndex += 1) {
      const id = demoId(`class:${eventIndex}:${classIndex}`);
      classIds.push(id);
      await client.competitionClass.upsert({
        where: { id },
        update: {
          competitionEventId: eventId,
          title: `Demo Class ${eventIndex}.${classIndex}`,
          disciplineId: requiredAt(
            disciplines,
            (eventIndex + classIndex - 2) % disciplines.length,
            'discipline',
          ).id,
          category: null,
          level: null,
          competitionDate: date(eventDate),
          sortOrder: classIndex - 1,
          status: RecordStatus.DRAFT,
          isDemo: true,
          archivedAt: null,
        },
        create: {
          id,
          competitionEventId: eventId,
          title: `Demo Class ${eventIndex}.${classIndex}`,
          disciplineId: requiredAt(
            disciplines,
            (eventIndex + classIndex - 2) % disciplines.length,
            'discipline',
          ).id,
          competitionDate: date(eventDate),
          sortOrder: classIndex - 1,
          status: RecordStatus.DRAFT,
          isDemo: true,
        },
      });
    }
  }

  const resultIdsByAthlete = new Map<string, string[]>();
  const resultIds: string[] = [];
  for (let index = 1; index <= 36; index += 1) {
    const athleteId = requiredAt(athleteIds, (index - 1) % athleteIds.length, 'athlete');
    const resultId = demoId(`result:${index}`);
    resultIds.push(resultId);
    const isStatusOnly = index % 9 === 0;
    await client.competitionResult.upsert({
      where: { id: resultId },
      update: {
        competitionClassId: requiredAt(
          classIds,
          (index - 1) % classIds.length,
          'competition class',
        ),
        athleteId,
        horseId: requiredAt(horseIds, (index - 1) % horseIds.length, 'horse'),
        rank: isStatusOnly ? null : ((index - 1) % 6) + 1,
        statusId: isStatusOnly ? statusOnly.id : finishedStatus.id,
        resultDisplay: isStatusOnly ? 'DEMO STATUS ONLY' : `Demo result ${index}`,
        penalties: null,
        timeSeconds: isStatusOnly ? null : 60 + index,
        points: null,
        bonus: null,
        publicationStatus: PublicationStatus.DRAFT,
        publishedAt: null,
        approvedAt: null,
        approvedById: null,
        isDemo: true,
        archivedAt: null,
      },
      create: {
        id: resultId,
        competitionClassId: requiredAt(
          classIds,
          (index - 1) % classIds.length,
          'competition class',
        ),
        athleteId,
        horseId: requiredAt(horseIds, (index - 1) % horseIds.length, 'horse'),
        rank: isStatusOnly ? null : ((index - 1) % 6) + 1,
        statusId: isStatusOnly ? statusOnly.id : finishedStatus.id,
        resultDisplay: isStatusOnly ? 'DEMO STATUS ONLY' : `Demo result ${index}`,
        timeSeconds: isStatusOnly ? null : 60 + index,
        publicationStatus: PublicationStatus.DRAFT,
        isDemo: true,
      },
    });
    const existing = resultIdsByAthlete.get(athleteId) ?? [];
    existing.push(resultId);
    resultIdsByAthlete.set(athleteId, existing);
  }

  const definitionId = demoId('ranking-definition');
  const periodId = demoId('ranking-period');
  const ruleSetId = demoId('ranking-rule-set');
  const snapshotId = demoId('ranking-snapshot');
  await client.rankingDefinition.upsert({
    where: { code: 'DEMO_ATHLETE_RANKING' },
    update: {
      name: 'Demo Athlete Ranking Storage',
      subjectType: RankingSubjectType.ATHLETE,
      status: RecordStatus.DRAFT,
      isDemo: true,
      archivedAt: null,
    },
    create: {
      id: definitionId,
      code: 'DEMO_ATHLETE_RANKING',
      name: 'Demo Athlete Ranking Storage',
      subjectType: RankingSubjectType.ATHLETE,
      status: RecordStatus.DRAFT,
      isDemo: true,
    },
  });
  await client.rankingRuleSet.upsert({
    where: { id: ruleSetId },
    update: {
      rankingDefinitionId: definitionId,
      version: 1,
      name: 'Demo storage configuration — no official formula',
      calculationMethod: 'DEMO',
      configuration: { notice: 'No formula or coefficients are defined.' },
      configurationSchemaVersion: 'demo-storage-v1',
      status: RecordStatus.DRAFT,
      isDemo: true,
      archivedAt: null,
    },
    create: {
      id: ruleSetId,
      rankingDefinitionId: definitionId,
      version: 1,
      name: 'Demo storage configuration — no official formula',
      calculationMethod: 'DEMO',
      configuration: { notice: 'No formula or coefficients are defined.' },
      configurationSchemaVersion: 'demo-storage-v1',
      status: RecordStatus.DRAFT,
      isDemo: true,
    },
  });
  await client.rankingPeriod.upsert({
    where: { id: periodId },
    update: {
      rankingDefinitionId: definitionId,
      code: 'DEMO_2026',
      label: 'Demo 2026 Period',
      status: RecordStatus.DRAFT,
      isDemo: true,
      archivedAt: null,
    },
    create: {
      id: periodId,
      rankingDefinitionId: definitionId,
      code: 'DEMO_2026',
      label: 'Demo 2026 Period',
      status: RecordStatus.DRAFT,
      isDemo: true,
    },
  });
  await client.rankingSnapshot.upsert({
    where: { id: snapshotId },
    update: {
      rankingPeriodId: periodId,
      rankingRuleSetId: ruleSetId,
      revision: 1,
      snapshotAt: date('2026-07-01'),
      calculationMethod: 'DEMO',
      calculationStatus: RankingCalculationStatus.FROZEN,
      publicationStatus: PublicationStatus.DRAFT,
      calculatedAt: date('2026-07-01'),
      publishedAt: null,
      notes: 'Fictional demo snapshot. No official calculation.',
      isDemo: true,
      archivedAt: null,
    },
    create: {
      id: snapshotId,
      rankingPeriodId: periodId,
      rankingRuleSetId: ruleSetId,
      revision: 1,
      snapshotAt: date('2026-07-01'),
      calculationMethod: 'DEMO',
      calculationStatus: RankingCalculationStatus.FROZEN,
      publicationStatus: PublicationStatus.DRAFT,
      calculatedAt: date('2026-07-01'),
      notes: 'Fictional demo snapshot. No official calculation.',
      isDemo: true,
    },
  });

  for (let index = 0; index < athleteIds.length; index += 1) {
    const athleteId = requiredAt(athleteIds, index, 'ranking athlete');
    const sourceIds = (resultIdsByAthlete.get(athleteId) ?? []).slice(0, 2);
    const entryId = demoId(`ranking-entry:${index + 1}`);
    await client.rankingEntry.upsert({
      where: { id: entryId },
      update: {
        rankingSnapshotId: snapshotId,
        subjectType: RankingSubjectType.ATHLETE,
        athleteId,
        horseId: null,
        rank: index + 1,
        previousRank: null,
        points: null,
        countedResultCount: sourceIds.length,
        droppedResultCount: 0,
      },
      create: {
        id: entryId,
        rankingSnapshotId: snapshotId,
        subjectType: RankingSubjectType.ATHLETE,
        athleteId,
        rank: index + 1,
        countedResultCount: sourceIds.length,
        droppedResultCount: 0,
      },
    });
    for (let sourceIndex = 0; sourceIndex < sourceIds.length; sourceIndex += 1) {
      await client.rankingEntryResult.upsert({
        where: { id: demoId(`ranking-source:${index + 1}:${sourceIndex + 1}`) },
        update: {
          rankingEntryId: entryId,
          competitionResultId: requiredAt(sourceIds, sourceIndex, 'ranking source result'),
          isCounted: true,
          pointsContribution: null,
          decisionReason: 'Demo evidence link; no official rule applied.',
          sortOrder: sourceIndex,
        },
        create: {
          id: demoId(`ranking-source:${index + 1}:${sourceIndex + 1}`),
          rankingEntryId: entryId,
          competitionResultId: requiredAt(sourceIds, sourceIndex, 'ranking source result'),
          isCounted: true,
          decisionReason: 'Demo evidence link; no official rule applied.',
          sortOrder: sourceIndex,
        },
      });
    }
  }

  const batchId = demoId('import-batch');
  await client.importBatch.upsert({
    where: { id: batchId },
    update: {
      entityType: 'DEMO_ONLY',
      sourceType: 'SEED',
      filename: 'generated-demo-seed',
      checksum: demoId('seed-checksum').replaceAll('-', ''),
      status: ImportBatchStatus.COMPLETED,
      totalRows: 0,
      successRows: 0,
      failedRows: 0,
      isDemo: true,
      completedAt: date('2026-07-01'),
    },
    create: {
      id: batchId,
      entityType: 'DEMO_ONLY',
      sourceType: 'SEED',
      filename: 'generated-demo-seed',
      checksum: demoId('seed-checksum').replaceAll('-', ''),
      status: ImportBatchStatus.COMPLETED,
      isDemo: true,
      completedAt: date('2026-07-01'),
    },
  });

  const [
    countries,
    federations,
    disciplineCount,
    clubs,
    athletes,
    horses,
    owners,
    events,
    classes,
    results,
    rankingSnapshots,
  ] = await Promise.all([
    client.country.count({
      where: { id: { in: countryInput.map(([isoAlpha2]) => demoId(`country:${isoAlpha2}`)) } },
    }),
    client.nationalFederation.count({ where: { id: federationId } }),
    client.discipline.count({ where: { code: { in: disciplineInput.map(([code]) => code) } } }),
    client.club.count({ where: { id: { in: clubIds } } }),
    client.athlete.count({ where: { id: { in: athleteIds } } }),
    client.horse.count({ where: { id: { in: horseIds } } }),
    client.owner.count({ where: { id: { in: ownerIds } } }),
    client.competitionEvent.count({ where: { id: { in: eventIds } } }),
    client.competitionClass.count({ where: { id: { in: classIds } } }),
    client.competitionResult.count({ where: { id: { in: resultIds } } }),
    client.rankingSnapshot.count({ where: { id: snapshotId } }),
  ]);

  return {
    countries,
    federations,
    disciplines: disciplineCount,
    clubs,
    athletes,
    horses,
    owners,
    events,
    classes,
    results,
    rankingSnapshots,
  };
}

async function main(): Promise<void> {
  const summary = await seedDatabase(prisma);
  console.log('Demo seed completed:', summary);
}

if (require.main === module) {
  void main()
    .catch((error: unknown) => {
      console.error('Demo seed failed:', error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
