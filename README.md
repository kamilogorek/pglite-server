# Wire Protocol Server for PGlite

A spare-time attempt to understand Postgres Wire Protocol and expose a TCP server,
that can be used to redirect all client requests to [PGlite](https://github.com/electric-sql/pglite) instance.

This can be used to connect to a running instance via `pgsql` or in the future,
run a https://postgrest.org/ on top of said `PGlite` instance and automatically create a temporary, in-memory API endpoints.

- https://www.postgresql.org/docs/current/protocol.html
- https://www.postgresql.org/docs/current/protocol-message-formats.html

It intercepts `SSLRequest` and `StartupMessage` messages to fake authentication flow and redirects all remaining packets directly to `PGlite` instance.

## Usage

This repo uses https://bun.sh/ because I don't want to spend time fighting with Node and TypeScript tooling.

Make sure that it's available before running the server, or write your own ts-loader config, ts-node, or whatever people use these days.

```sh
bun install
bun start
```

```ts
import { PGlite } from "@electric-sql/pglite";
import { createServer } from "./server.ts";

const db = new PGlite();

await db.exec(`
  create table if not exists test (id serial primary key, name text);
  insert into test (name) values ('foo'), ('bar'), ('baz');
`);

const PORT = 5432;
const pgServer = createServer(db);

pgServer.listen(PORT, () => {
  console.log(`Server bound to port ${PORT}`);
});
```

```
$ psql -h localhost -p 5432 -U postgres
postgres=> select * from test;
postgres=> \q
```

or without `db.exec` used above

```
$ psql -h localhost -p 5432 -U postgres
postgres=> create table if not exists test (id serial primary key, name text);
postgres=> insert into test (name) values ('foo'), ('bar'), ('baz');
postgres=> select * from test;
postgres=> \q
```

## Developing

```sh
bun watch
```

## Debugging

Debugging network traffic with `tshark` - https://zignar.net/2022/09/24/using-tshark-to-monitor-pg-traffic/

```sh
brew install wireshark
```

```sh
tshark -i lo -f 'tcp port 5432' -d tcp.port==5432,pgsql -T fields -e pgsql.length -e pgsql.type -e pgsql.query
```
