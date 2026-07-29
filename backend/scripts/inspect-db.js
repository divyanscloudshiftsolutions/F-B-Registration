const { Client } = require("pg");

(async () => {
  const c = new Client({
    connectionString:
      "postgresql://dev_user:Sabari%402026@192.168.1.150:5432/nfcregistry",
  });
  await c.connect();
  const r = await c.query(`
    SELECT table_schema, table_name
    FROM information_schema.tables
    WHERE table_schema NOT IN ('pg_catalog','information_schema')
    ORDER BY 1,2
  `);
  console.log("tables:", r.rows);
  try {
    const m = await c.query(
      `SELECT migration_name, finished_at FROM _prisma_migrations`
    );
    console.log("migrations:", m.rows);
  } catch (e) {
    console.log("migrations error:", e.message);
  }
  await c.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
