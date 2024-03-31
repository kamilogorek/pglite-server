Wire Protocol Server for PGlite - https://github.com/electric-sql/pglite

## Usage

```js
import { PGlite } from "@electric-sql/pglite";
import { createServer } from "./server.js";

const db = new PGlite();
const PORT = 5432;
const pgServer = createServer(db);

pgServer.listen(PORT, () => {
  console.log(`Server bound to port ${PORT}`);
});
```

## Developing

```sh
npm install
npm watch
```

## Debugging

Debugging network traffic with `tshark` - https://zignar.net/2022/09/24/using-tshark-to-monitor-pg-traffic/

```sh
brew install wireshark
```

```sh
tshark -i lo -f 'tcp port 5432' -d tcp.port==5432,pgsql -T fields -e pgsql.length -e pgsql.type -e pgsql.query
```
