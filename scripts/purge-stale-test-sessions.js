const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const result = await prisma.whatsAppSession.deleteMany({
    where: {
      sessionId: 'default',
      OR: [
        { key: { contains: '923391112202' } },
        { key: { contains: '113847184707652' } },
        { key: { contains: '263763068502145' } }
      ]
    }
  });
  console.log(`Deleted ${result.count} stale session records!`);

  const remaining = await prisma.whatsAppSession.findMany({
    where: { sessionId: 'default' },
    select: { key: true }
  });
  console.log(`Remaining session keys in DB: ${remaining.length}`);
  const remainingSessions = remaining.filter(r => r.key.startsWith('session_'));
  console.log('Remaining sessions:', remainingSessions);

  await prisma.$disconnect();
}

run().catch(console.error);
