// TODO: Implement all frontend messages (F) from https://www.postgresql.org/docs/current/protocol-message-formats.html

import type { PGlite } from "@electric-sql/pglite";
import * as net from "node:net";

const MSG_CODE_LENGTH = 1;

type MessageName =
  | "SSLRequest"
  | "StartupMessage"
  | "Terminate"
  | "Query"
  | "Parse"
  | "Unknown";

interface FrontendMessage {
  name: MessageName;
  length: number;
  buffer: Buffer;
}

// https://www.postgresql.org/docs/current/protocol.html
// https://www.postgresql.org/docs/current/protocol-message-formats.html
function parseBuffer(buffer: Buffer): FrontendMessage {
  if (isSSLRequest(buffer)) {
    return {
      name: "SSLRequest",
      length: buffer.readUint32BE(0),
      buffer: Buffer.from(buffer.subarray(0, buffer.readUint32BE(0))),
    };
  } else if (isStartupMessage(buffer)) {
    return {
      name: "StartupMessage",
      length: buffer.readUint32BE(0),
      buffer: Buffer.from(buffer.subarray(0, buffer.readUint32BE(0))),
    };
  } else if (isTerminate(buffer)) {
    return {
      name: "Terminate",
      length: buffer.readUint32BE(1) + MSG_CODE_LENGTH,
      buffer: Buffer.from(
        buffer.subarray(0, buffer.readUint32BE(1) + MSG_CODE_LENGTH)
      ),
    };
  } else if (isQueryMessage(buffer)) {
    return {
      name: "Query",
      length: buffer.readUint32BE(1) + MSG_CODE_LENGTH,
      buffer: Buffer.from(
        buffer.subarray(0, buffer.readUint32BE(1) + MSG_CODE_LENGTH)
      ),
    };
  } else if (isParseMessage(buffer)) {
    return {
      name: "Parse",
      length: buffer.readUint32BE(1) + MSG_CODE_LENGTH,
      buffer: Buffer.from(
        buffer.subarray(0, buffer.readUint32BE(1) + MSG_CODE_LENGTH)
      ),
    };
  } else {
    return {
      name: "Unknown",
      length: 0,
      buffer: Buffer.alloc(0),
    };
  }
}

function isSSLRequest(buffer: Buffer) {
  return (
    buffer.at(4) === 0x04 &&
    buffer.at(5) === 0xd2 &&
    buffer.at(6) === 0x16 &&
    buffer.at(7) === 0x2f
  );
}

function isStartupMessage(buffer: Buffer) {
  return (
    buffer.at(4) === 0x00 &&
    buffer.at(5) === 0x03 &&
    buffer.at(6) === 0x00 &&
    buffer.at(7) === 0x00
  );
}

function isTerminate(buffer: Buffer) {
  return buffer.at(0) === 0x58; // 'X'
}

function isQueryMessage(buffer: Buffer) {
  return buffer.at(0) === 0x51; // 'Q'
}

function isParseMessage(buffer: Buffer) {
  return buffer.at(0) === 0x50; // 'P'
}

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

async function createMessageResponse(
  message: FrontendMessage,
  db: PGlite
): Promise<Buffer> {
  switch (message.name) {
    case "SSLRequest": {
      return createSSLRequestReponse();
    }
    case "StartupMessage": {
      return createStartupMessageReponse();
    }
    case "Query": {
      const result = await db.execProtocol(message.buffer);
      return Buffer.concat(result.map(([_, buffer]) => buffer));
    }
    default: {
      return Buffer.alloc(0);
    }
  }
}

export function createServer(db: PGlite, opts = {}) {
  const server = net.createServer(opts);

  server.on("connection", function (socket) {
    let clientBuffer = Buffer.allocUnsafe(0);
    const clientAddr = `${socket.remoteAddress}:${socket.remotePort}`;

    console.log(`Client connected: ${clientAddr}`);

    socket.on("data", async (data) => {
      clientBuffer = Buffer.concat([clientBuffer, data]);
      const message = parseBuffer(clientBuffer);

      console.log(`\n${"-".repeat(42)}\n`);
      console.log(`>> Message name: ${message.name}`);
      console.log(`>> Message length: ${message.length}`);
      console.log(`>> Message buffer: ${message.buffer}`);
      console.log("");
      console.log("Current buffer:");
      console.log("Raw:", clientBuffer);
      console.log("Text:", clientBuffer.toString());

      if (message.name === "Terminate") {
        socket.end();
        return;
      }

      if (message.name === "Unknown") {
        return;
      }

      const response = await createMessageResponse(message, db);
      socket.write(response);
      clientBuffer = Buffer.from(clientBuffer.subarray(message.length));
    });

    socket.on("end", () => {
      console.log(`Client disconnected: ${clientAddr}`);
    });

    socket.on("error", (err) => {
      console.log(`Client ${clientAddr} error:`, err);
      socket.end();
    });
  });

  server.on("error", (err) => {
    console.log(`Server error:`, err);
  });

  return server;
}
