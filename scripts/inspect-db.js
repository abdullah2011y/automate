const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const modelNames = Object.keys(prisma).filter(k => !k.startsWith('$') && !k.startsWith('_'));
  console.log('Available models:', modelNames);

  const counts = {};
  for (const model of modelNames) {
    if (typeof prisma[model]?.count === 'function') {
      counts[model] = await prisma[model].count();
    }
  }
  console.log('DB_COUNTS:', JSON.stringify(counts, null, 2));

  if (prisma.shopifyIntegration) {
    const shopify = await prisma.shopifyIntegration.findMany({ select: { shopDomain: true, isActive: true } });
    console.log('SHOPIFY_INTEGRATIONS:', JSON.stringify(shopify));
  }

  if (prisma.user) {
    const users = await prisma.user.findMany({ select: { email: true, name: true, role: true } });
    console.log('USERS:', JSON.stringify(users));
  }

  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
