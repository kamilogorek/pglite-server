import { PGlite } from "@electric-sql/pglite";
import { createServer } from "./server.ts";

const db = new PGlite();

await db.exec(`
    create table if not exists test (
      id serial primary key,
      name text
    );
    insert into test (name) values ('test');
`);

const PORT = 5432;
const pgServer = createServer(db);

pgServer.listen(PORT, () => {
  console.log(`Server bound to port ${PORT}`);
});
