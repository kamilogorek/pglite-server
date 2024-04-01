import type { PGlite } from "@electric-sql/pglite";
import * as net from "node:net";
import { parseMessage } from "./messages";
import { createMessageResponse } from "./responses";

export function createServer(db: PGlite, opts = {}) {
  const server = net.createServer(opts);

  server.on("connection", function (socket) {
    let clientBuffer = Buffer.allocUnsafe(0);
    const clientAddr = `${socket.remoteAddress}:${socket.remotePort}`;

    console.log(`Client connected: ${clientAddr}`);

    socket.on("data", async (data) => {
      clientBuffer = Buffer.concat([clientBuffer, data]);

      while (clientBuffer.length > 0) {
        const message = parseMessage(clientBuffer);

        console.log(`${"-".repeat(42)}\n`);
        console.log(`> Current buffer: ${clientBuffer.length}`);
        console.log(`> Raw:`, clientBuffer);
        console.log(`> Text: ${clientBuffer.toString()}`);
        console.log(``);
        console.log(`>> Message name: ${message.name}`);
        console.log(`>> Message length: ${message.length}`);
        console.log(`>> Message buffer raw:`, message.buffer);
        console.log(`>> Message buffer text: ${message.buffer.toString()}`);
        console.log(``);

        if (message.name === "Unknown") {
          continue;
        } else if (message.name === "Terminate") {
          socket.end();
          return;
        } else {
          const response = await createMessageResponse(message, db);
          socket.write(response);
          clientBuffer = Buffer.from(clientBuffer.subarray(message.length));
          console.log(`> Remaining buffer: ${clientBuffer.length}}`);
          console.log(`> Raw:`, clientBuffer);
          console.log(`> Text: ${clientBuffer.toString() || "<empty>"}`);
          console.log(``);
        }
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
