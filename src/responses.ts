import type { PGlite } from "@electric-sql/pglite";
import type { FrontendMessage } from "./messages.ts";
import { GrowableOffsetBuffer } from "./write-buffer.ts";

function createCancelRequest(): Buffer {
  return new GrowableOffsetBuffer().toBuffer(); // todo!()
}

function createGSSENCRequest(): Buffer {
  return new GrowableOffsetBuffer().toBuffer(); // todo!()
}

// https://www.postgresql.org/docs/current/protocol-flow.html#PROTOCOL-FLOW-SSL
// "The server then responds with a single byte containing S or N, indicating that it is willing or unwilling to perform SSL, respectively."
function createSSLRequestReponse(): Buffer {
  // SSL negotiation
  const sslNegotiation = new GrowableOffsetBuffer();
  sslNegotiation.write("N");
  return sslNegotiation.toBuffer();
}

function createStartupMessageReponse(): Buffer {
  // AuthenticationOk
  const authOk = new GrowableOffsetBuffer();
  authOk.write("R");
  authOk.writeUint32BE(8);
  authOk.writeUint32BE(0);

  // BackendKeyData
  const backendKeyData = new GrowableOffsetBuffer();
  backendKeyData.write("K");
  backendKeyData.writeUint32BE(12);
  backendKeyData.writeUint32BE(1);
  backendKeyData.writeUint32BE(2);

  // ReadyForQuery
  const readyForQuery = new GrowableOffsetBuffer();
  readyForQuery.write("Z");
  readyForQuery.writeUint32BE(5);
  readyForQuery.write("I");

  return Buffer.concat([
    authOk.toBuffer(),
    backendKeyData.toBuffer(),
    readyForQuery.toBuffer(),
  ]);
}

// https://www.postgresql.org/docs/current/protocol-flow.html#PROTOCOL-FLOW-SIMPLE-QUERY
// "In the event of an error, ErrorResponse is issued followed by ReadyForQuery."
function createErrorReponse(message: string): Buffer {
  // ErrorResponse
  const errorResponse = new GrowableOffsetBuffer();
  errorResponse.write("E");
  errorResponse.writeUint32BE(7 + message.length);
  errorResponse.write("M");
  errorResponse.write(message);
  errorResponse.writeUint8(0);
  errorResponse.writeUint8(0);

  // ReadyForQuery
  const readyForQuery = new GrowableOffsetBuffer();
  readyForQuery.write("Z");
  readyForQuery.writeUint32BE(5);
  readyForQuery.write("I");

  return Buffer.concat([errorResponse.toBuffer(), readyForQuery.toBuffer()]);
}

export async function createMessageResponse(
  message: FrontendMessage,
  db: PGlite
): Promise<Buffer> {
  switch (message.name) {
    case "CancelRequest": {
      return createCancelRequest();
    }
    case "GSSENCRequest": {
      return createGSSENCRequest();
    }
    case "SSLRequest": {
      return createSSLRequestReponse();
    }
    case "StartupMessage": {
      return createStartupMessageReponse();
    }
    default: {
      try {
        const result = await db.execProtocol(message.buffer);
        return Buffer.concat(result.map(([_, buffer]) => buffer));
      } catch (e: unknown) {
        const message =
          e instanceof Error ? e.message : "Unknown error message";
        return createErrorReponse(message);
      }
    }
  }
}
