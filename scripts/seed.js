// Explicit seeder — runs once to populate a fresh database.
// Usage: npm run seed
// This does NOT run automatically on `npm run deploy` so deleted records stay deleted.
const cds = require('@sap/cds');

async function main() {
  // Point CAP's data discovery at db/init instead of the default db/data / db/csv
  cds.env.requires.db = { ...cds.env.requires.db, data: ['db/init'] };

  const model = await cds.load('db').then(cds.minify);
  const db = await cds.connect.to('db');
  await cds.deploy(model).to(db);
  console.log('\nSeed complete.');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
