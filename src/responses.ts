import type { PGlite } from "@electric-sql/pglite";
import type { FrontendMessage } from "./messages.ts";
import { GrowableOffsetBuffer } from "./write-buffer.ts";

// https://www.postgresql.org/docs/current/protocol-flow.html#PROTOCOL-FLOW-GSSAPI-ENCRYPTION
// "The server then responds with a single byte containing G or N, indicating that it is willing or unwilling to perform GSSAPI encryption, respectively."
const GSSENC_REQUEST_RESPONSE = Buffer.from("N");

// https://www.postgresql.org/docs/current/protocol-flow.html#PROTOCOL-FLOW-SSL
// "The server then responds with a single byte containing S or N, indicating that it is willing or unwilling to perform SSL, respectively."
const SSL_REQUEST_RESPONSE = Buffer.from("N");

// Pre-computed startup response: AuthenticationOk + ParameterStatus + BackendKeyData + ReadyForQuery
const STARTUP_MESSAGE_RESPONSE = buildStartupMessageResponse();

function buildStartupMessageResponse(): Buffer {
  // AuthenticationOk
  const authOk = new GrowableOffsetBuffer();
  authOk.write("R");
  authOk.writeUint32BE(8);
  authOk.writeUint32BE(0);

  // ParameterStatus
  // Some tools (eg. DBeaver and Datagrip) require `server_version` param to be announced during startup.
  // The value itself is not important, only the existence of it, as call to `SHOW server_version;`
  // which is used to display version in the UI, will be redirected to the underlying `execProtocol` anyway.
  const parameterStatus = new GrowableOffsetBuffer();
  const paramKey = "server_version";
  const paramValue = "pglite";
  parameterStatus.write("S");
  parameterStatus.writeUint32BE(6 + Buffer.byteLength(paramKey) + Buffer.byteLength(paramValue));
  parameterStatus.write(paramKey);
  parameterStatus.writeUint8(0);
  parameterStatus.write(paramValue);
  parameterStatus.writeUint8(0);

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
    parameterStatus.toBuffer(),
    backendKeyData.toBuffer(),
    readyForQuery.toBuffer(),
  ]);
}

// https://www.postgresql.org/docs/current/protocol-flow.html#PROTOCOL-FLOW-SIMPLE-QUERY
// "In the event of an error, ErrorResponse is issued followed by ReadyForQuery."
function createErrorResponse(message: string): Buffer {
  // ErrorResponse
  const errorResponse = new GrowableOffsetBuffer();
  errorResponse.write("E");
  errorResponse.writeUint32BE(7 + Buffer.byteLength(message));
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
): Promise<Buffer | null> {
  switch (message.name) {
    // https://www.postgresql.org/docs/current/protocol-flow.html#PROTOCOL-FLOW-CANCELING-REQUESTS
    // CancelRequest is sent on a separate connection and expects no response.
    // The server should simply close the connection after receiving it.
    case "CancelRequest": {
      return null;
    }
    case "GSSENCRequest": {
      return GSSENC_REQUEST_RESPONSE;
    }
    case "SSLRequest": {
      return SSL_REQUEST_RESPONSE;
    }
    case "StartupMessage": {
      return STARTUP_MESSAGE_RESPONSE;
    }
    default: {
      try {
        const result = await db.execProtocol(message.buffer);
        return Buffer.from(result.data);
      } catch (e: unknown) {
        const errorMessage =
          e instanceof Error ? e.message : "Unknown error message";
        return createErrorResponse(errorMessage);
      }
    }
  }
}
