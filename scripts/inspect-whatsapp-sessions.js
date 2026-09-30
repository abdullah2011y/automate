const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const sessions = await prisma.whatsAppSession.findMany({
    where: { sessionId: 'default' },
    select: { key: true, updatedAt: true }
  });

  console.log(`Total session keys in DB: ${sessions.length}`);
  const matching = sessions.filter(s => 
    s.key.includes('923391112202') || 
    s.key.includes('113847184707652') || 
    s.key.includes('263763068502145')
  );
  console.log(`Matching keys for test user/lid: ${matching.length}`);
  matching.forEach(m => console.log(`- ${m.key} (updated: ${m.updatedAt})`));

  console.log('\nAll keys summary:');
  const types = {};
  sessions.forEach(s => {
    const prefix = s.key.split('_')[0] || s.key.split('-')[0] || 'other';
    types[prefix] = (types[prefix] || 0) + 1;
  });
  console.log(types);

  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
