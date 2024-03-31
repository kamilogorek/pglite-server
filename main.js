import { PGlite } from "@electric-sql/pglite";
import { createServer } from "./server.js";

const db = new PGlite();
await db.exec(`
  CREATE TABLE IF NOT EXISTS test (
    id SERIAL PRIMARY KEY,
    name TEXT
  );
  INSERT INTO test (name) VALUES ('test');
`);

const PORT = 5432;
const pgServer = createServer(db);

pgServer.listen(PORT, () => {
  console.log(`Server bound to port ${PORT}`);
});
