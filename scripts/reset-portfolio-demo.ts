import * as argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';

const TARGET_DATABASE = 'fem_showcase';
const CONFIRMATION = 'RESET_FEM_PORTFOLIO_SEED_20260821';

const DOMAIN_TABLES = [
  'RankingEntryResult',
  'RankingEntry',
  'RankingSnapshot',
  'RankingPeriod',
  'RankingRuleSet',
  'RankingDefinition',
  'ResultMetric',
  'CompetitionResult',
  'CompetitionClass',
  'CompetitionEvent',
  'HorseOwnership',
  'AthleteHorseRelation',
  'AthleteClubMembership',
  'ExternalIdentifier',
  'Owner',
  'Horse',
  'Athlete',
  'Club',
  'ResultStatus',
  'Discipline',
  'NationalFederation',
  'Country',
  'ImportRow',
  'ImportBatch',
  'Document',
  'MediaFile',
  'IdempotencyRecord',
  'AdminRecoveryCode',
  'RateLimitBucket',
] as const;

function requireSafeTarget(): URL {
  if (process.env.ALLOW_PORTFOLIO_RESET !== 'true') {
    throw new Error(
      'Set ALLOW_PORTFOLIO_RESET=true for this one-time destructive local/portfolio operation.',
    );
  }
  if (process.env.PORTFOLIO_RESET_CONFIRMATION !== CONFIRMATION) {
    throw new Error(`Set PORTFOLIO_RESET_CONFIRMATION=${CONFIRMATION} to confirm the exact reset.`);
  }
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error('DATABASE_URL is required.');
  const url = new URL(raw);
  if (url.protocol !== 'postgresql:') throw new Error('DATABASE_URL must use postgresql://.');
  const database = decodeURIComponent(url.pathname).replace(/^\/+/, '');
  if (database !== TARGET_DATABASE) {
    throw new Error(`Refusing reset: target database must be ${TARGET_DATABASE}.`);
  }
  return url;
}

async function main(): Promise<void> {
  const url = requireSafeTarget();
  const email = (process.env.PORTFOLIO_DEMO_EMAIL ?? 'admin1@fem.local').trim().toLowerCase();
  const password = process.env.PORTFOLIO_DEMO_PASSWORD ?? '123';
  if (!email || !password) throw new Error('Portfolio demo email and password must be non-empty.');

  const prisma = new PrismaClient();
  try {
    const before = await prisma.athlete.findMany({
      where: { isDemo: false },
      select: { id: true, displayName: true },
      orderBy: { displayName: 'asc' },
    });
    console.log(`Reset target: ${url.hostname}/${TARGET_DATABASE}`);
    console.log(`Non-demo athletes to remove: ${before.length}`);
    for (const athlete of before) console.log(`- ${athlete.displayName} (${athlete.id})`);

    const passwordHash = await argon2.hash(password);
    await prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { email } });
      const current = await tx.user.findFirst({ where: { email: 'demo.admin@fem.local' } });
      if (existing && existing.id !== current?.id) {
        throw new Error(`Refusing reset: ${email} already belongs to another user.`);
      }
      for (const table of DOMAIN_TABLES) {
        await tx.$executeRawUnsafe(`TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE`);
      }
      await tx.adminSession.updateMany({
        data: { revokedAt: new Date(), revokeReason: 'portfolio-reset' },
      });
      if (!current)
        throw new Error('Expected demo administrator demo.admin@fem.local was not found.');
      await tx.user.update({
        where: { id: current.id },
        data: {
          email,
          displayName: 'FEM Portfolio Viewer',
          status: 'ACTIVE',
          archivedAt: null,
          isDemo: true,
        },
      });
      await tx.userCredential.update({
        where: { userId: current.id },
        data: {
          passwordHash,
          failedLoginAttempts: 0,
          lockedUntil: null,
          lastTotpStep: null,
          passwordChangedAt: new Date(),
        },
      });
    }, { timeout: 60_000 });
    console.log(
      'Portfolio reset completed. Run `pnpm prisma:seed` next with the explicit demo-seed safety flags.',
    );
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error('Portfolio reset failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
