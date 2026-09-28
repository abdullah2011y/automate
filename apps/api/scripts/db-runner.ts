import EmbeddedPostgres from 'embedded-postgres';
import fs from 'fs';
import path from 'path';

const dataDir = path.resolve(__dirname, '../.postgres-data');

async function main() {
  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    port: 5432,
    user: 'postgres',
    password: 'password',
    persistent: true,
  });

  if (!fs.existsSync(dataDir)) {
    console.log('🐘 Initializing new PostgreSQL cluster at:', dataDir);
    await pg.initialise();
  }

  console.log('🐘 Starting PostgreSQL on port 5432...');
  await pg.start();
  console.log('✅ PostgreSQL is ready at postgresql://postgres:password@localhost:5432/byteforge_omnicommerce');

  try {
    await pg.createDatabase('byteforge_omnicommerce');
  } catch (err) {
    // Database might already exist, ignore
  }

  const shutdown = async () => {
    console.log('\n🛑 Stopping PostgreSQL...');
    await pg.stop();
    console.log('✅ PostgreSQL stopped cleanly.');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Keep process alive
  setInterval(() => {}, 10000);
}

main().catch((err) => {
  console.error('❌ Failed to run embedded PostgreSQL:', err);
  process.exit(1);
});
