import { PGlite } from "@electric-sql/pglite";
import { Client } from "pg";
import { createServer } from "../src/server.ts";
import assert from "assert";
import type { AddressInfo } from "net";
import { green, red } from "./colors.ts";

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

  let exitCode = 0;
  try {
    await client.query("invalid command;");
    console.log(red("Assertions failed!"));
    exitCode = 1;
  } catch (err: unknown) {
    try {
      assert.strictEqual(
        (err as Error).message,
        'syntax error at or near "invalid"'
      );
      console.log(green("Assertions passed!"));
    } catch (err: unknown) {
      console.error(err);
      console.log(red("Assertions failed!"));
      exitCode = 1;
    }
  } finally {
    await client.end();
    await new Promise((resolve) => setTimeout(resolve)); // Wait for next tick to let client disconnect
    pgServer.close(() => process.exit(exitCode));
  }
});
