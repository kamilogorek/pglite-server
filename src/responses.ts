import type { PGlite } from "@electric-sql/pglite";
import type { FrontendMessage } from "./messages.ts";

// https://www.postgresql.org/docs/current/protocol-flow.html#PROTOCOL-FLOW-SSL
// "The server then responds with a single byte containing S or N, indicating that it is willing or unwilling to perform SSL, respectively."
function createSSLRequestReponse(): Buffer {
  // SSL negotiation
  const sslNegotiation = Buffer.alloc(1);
  sslNegotiation.write("N");
  return sslNegotiation;
}

function createStartupMessageReponse(): Buffer {
  // AuthenticationOk
  const authOk = Buffer.alloc(9);
  authOk.write("R");
  authOk.writeUint32BE(8, 1);
  authOk.writeUint32BE(0, 5);

  // BackendKeyData
  const backendKeyData = Buffer.alloc(13);
  backendKeyData.write("K");
  backendKeyData.writeUint32BE(12, 1);
  backendKeyData.writeUint32BE(1, 5);
  backendKeyData.writeUint32BE(2, 9);

  // ReadyForQuery
  const readyForQuery = Buffer.alloc(6);
  readyForQuery.write("Z");
  readyForQuery.writeUint32BE(5, 1);
  readyForQuery.write("I", 5);

  return Buffer.concat([authOk, backendKeyData, readyForQuery]);
}

export async function createMessageResponse(
  message: FrontendMessage,
  db: PGlite
): Promise<Buffer> {
  switch (message.name) {
    case "CancelRequest": {
      return Buffer.alloc(0); // todo!()
    }
    case "GSSENCRequest": {
      return Buffer.alloc(0); // todo!()
    }
    case "SSLRequest": {
      return createSSLRequestReponse();
    }
    case "StartupMessage": {
      return createStartupMessageReponse();
    }
    default: {
      const result = await db.execProtocol(message.buffer);
      return Buffer.concat(result.map(([_, buffer]) => buffer));
    }
  }
}
