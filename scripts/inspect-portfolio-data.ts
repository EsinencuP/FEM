import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const [users, athletes, horses, clubs, events, results] = await Promise.all([
    prisma.user.findMany({ select: { email: true, displayName: true, isDemo: true }, orderBy: { email: 'asc' } }),
    prisma.athlete.findMany({ where: { isDemo: false }, select: { id: true, displayName: true }, orderBy: { displayName: 'asc' } }),
    prisma.horse.count({ where: { isDemo: false } }),
    prisma.club.count({ where: { isDemo: false } }),
    prisma.competitionEvent.count({ where: { isDemo: false } }),
    prisma.competitionResult.count({ where: { isDemo: false } }),
  ]);
  console.log(JSON.stringify({ users, nonDemo: { athletes, horses, clubs, events, results } }, null, 2));
}

void main().catch((error: unknown) => {
  console.error('Portfolio inspection failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
}).finally(async () => prisma.$disconnect());
