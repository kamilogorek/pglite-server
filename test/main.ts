import { PGlite } from "@electric-sql/pglite";
import { Client } from "pg";
import { createServer } from "../src/server.ts";
import assert from "assert";
import type { AddressInfo } from "net";

const db = new PGlite();
await db.waitReady;
await db.exec(`
  create table if not exists test (id serial primary key, name text);
  insert into test (name) values ('foo'), ('bar'), ('baz');
`);

const pgServer = createServer(db);

pgServer.listen(async () => {
  const port = (pgServer.address() as AddressInfo).port;
  console.log(`Server bound to port ${port}`);

  const client = new Client({
    host: "localhost",
    port,
    database: "postgres",
    user: "postgres",
  });

  await client.connect();

  try {
    const res = await client.query("select * from test");
    assert.deepStrictEqual(res.rows, [
      {
        id: 1,
        name: "foo",
      },
      {
        id: 2,
        name: "bar",
      },
      {
        id: 3,
        name: "baz",
      },
    ]);
    console.log("Assertions passed!");
  } catch (err) {
    console.error(err);
    console.log("Assertions failed!");
  } finally {
    await client.end();
    await new Promise((resolve) => setTimeout(resolve)); // Wait for next tick to let client disconnect
    pgServer.close(() => process.exit(0));
  }
});
