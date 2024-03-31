import * as net from "node:net";

function isSSLRequest(buffer) {
  return (
    buffer.at(4) === 0x04 &&
    buffer.at(5) === 0xd2 &&
    buffer.at(6) === 0x16 &&
    buffer.at(7) === 0x2f
  );
}

function isStartupMessage(buffer) {
  return (
    buffer.at(4) === 0x00 &&
    buffer.at(5) === 0x03 &&
    buffer.at(6) === 0x00 &&
    buffer.at(7) === 0x00
  );
}

function isExitMessage(buffer) {
  return buffer.at(0) === 0x58; // 'X'
}

function isQueryMessage(buffer) {
  return buffer.at(0) === 0x51; // 'Q'
}

export function createServer(db, opts = {}) {
  const server = net.createServer(opts);

  server.on("connection", function (socket) {
    const clientAddr = `${socket.remoteAddress}:${socket.remotePort}`;

    console.log(`Client connected: ${clientAddr}`);

    // https://www.postgresql.org/docs/current/protocol-message-formats.html
    socket.on("data", async (data) => {
      if (isSSLRequest(data)) {
        // SSL negotiation
        const sslNegotiation = Buffer.alloc(1);
        sslNegotiation.write("N");
        socket.write(sslNegotiation);
      } else if (isStartupMessage(data)) {
        // AuthenticationOk
        const authOk = Buffer.alloc(9);
        authOk.write("R"); // 'R' for AuthenticationOk
        authOk.writeInt8(8, 4); // Length
        authOk.writeInt8(0, 7); // AuthenticationOk

        // BackendKeyData
        const backendKeyData = Buffer.alloc(13);
        backendKeyData.write("K"); // Message type
        backendKeyData.writeInt8(12, 4); // Message length
        backendKeyData.writeInt16BE(1234, 7); // Process ID
        backendKeyData.writeInt16BE(5679, 11); // Secret key

        // ReadyForQuery
        const readyForQuery = Buffer.alloc(6);
        readyForQuery.write("Z"); // 'Z' for ReadyForQuery
        readyForQuery.writeInt8(5, 4); // Length
        readyForQuery.write("I", 5); // Transaction status indicator, 'I' for idle

        socket.write(Buffer.concat([authOk, backendKeyData, readyForQuery]));
      } else if (isExitMessage(data)) {
        socket.end();
      } else if (isQueryMessage(data)) {
        const result = await db.execProtocol(data);
        socket.write(Buffer.concat(result.map(([_, buffer]) => buffer)));
      } else {
        console.log("Unknown message:", data);
      }
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
