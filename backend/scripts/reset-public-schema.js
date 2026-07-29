const { Client } = require("pg");

(async () => {
  const c = new Client({
    connectionString:
      "postgresql://dev_user:Sabari%402026@192.168.1.150:5432/nfcregistry",
  });
  await c.connect();
  await c.query(`
    DROP SCHEMA public CASCADE;
    CREATE SCHEMA public;
    GRANT ALL ON SCHEMA public TO public;
    GRANT ALL ON SCHEMA public TO CURRENT_USER;
  `);
  console.log("Schema public reset.");
  await c.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
