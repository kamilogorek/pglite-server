import { PGlite } from "@electric-sql/pglite";
import { createServer } from "./server.ts";

const db = new PGlite();

await db.exec(`
    create table if not exists test (
      id serial primary key,
      name text
    );
    insert into test (name) values ('test');

    create schema api;

    create table api.todos (
      id serial primary key,
      done boolean not null default false,
      task text not null,
      due timestamptz
    );

    insert into api.todos (task) values ('finish tutorial 0'), ('pat self on back');

    create role web_anon nologin;

    grant usage on schema api to web_anon;
    grant select on api.todos to web_anon;

    create role authenticator noinherit login password 'mysecretpassword';
    grant web_anon to authenticator;
`);

const PORT = 5432;
const pgServer = createServer(db);

pgServer.listen(PORT, () => {
  console.log(`Server bound to port ${PORT}`);
});
