import * as net from "node:net";
import type { PGlite } from "@electric-sql/pglite";
import { parseMessage } from "./messages.ts";
import { createMessageResponse } from "./responses.ts";
import { Logger, LogLevel } from "./logger.ts";

type ServerOptions = net.ServerOpts & {
  logLevel: LogLevel;
};

export function createServer(
  db: PGlite,
  options: Partial<ServerOptions> = { logLevel: LogLevel.Info }
) {
  const server = net.createServer(options);

  server.on("connection", function (socket) {
    let clientBuffer = Buffer.allocUnsafe(0);
    const clientAddr = `${socket.remoteAddress}:${socket.remotePort}`;
    const logger = new Logger(options.logLevel, clientAddr);

    logger.info(`Client connected`);

    socket.on("data", async (data: Buffer) => {
      clientBuffer = Buffer.concat([clientBuffer, data]);

      while (clientBuffer.length > 0) {
        const message = parseMessage(clientBuffer);

        logger.debug(`${"-".repeat(42)}\n`);
        logger.debug(`> Current buffer`);
        logger.debug(`> Length: ${clientBuffer.length}`);
        logger.debug(`> Raw:`, clientBuffer);
        logger.debug(`> Text: ${clientBuffer.toString()}`);
        logger.debug(``);
        logger.debug(`>> Message name: ${message.name}`);
        logger.debug(`>> Message length: ${message.length}`);
        logger.debug(`>> Message buffer raw:`, message.buffer);
        logger.debug(`>> Message buffer text: ${message.buffer.toString()}`);
        logger.debug(``);

        if (message.name === "InsufficientData") {
          break;
        }

        if (message.name === "Unknown" || message.name === "Terminate") {
          socket.end();
          return;
        }

        const response = await createMessageResponse(message, db);
        socket.write(response);
        clientBuffer = Buffer.from(clientBuffer.subarray(message.length));
        logger.debug(`> Remaining buffer`);
        logger.debug(`> Length: ${clientBuffer.length}`);
        logger.debug(`> Raw:`, clientBuffer);
        logger.debug(`> Text: ${clientBuffer.toString() || "<empty>"}`);
        logger.debug(``);
      }
    });

    socket.on("end", () => {
      logger.info(`Client disconnected`);
    });

    socket.on("error", (err) => {
      logger.error(`Client error:`, err);
      socket.end();
    });
  });

  server.on("error", (err) => {
    throw err;
  });

  return server;
}
