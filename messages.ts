// TODO: Implement all 20 (+Unknown/InsufficientData) frontend messages (F) from https://www.postgresql.org/docs/current/protocol-message-formats.html

type MessageName =
  | "SSLRequest"
  | "StartupMessage"
  | "Query"
  | "Parse"
  | "Bind"
  | "Describe"
  | "Execute"
  | "Sync"
  | "Terminate"
  | "Unknown"
  | "InsufficientData";

export interface FrontendMessage {
  name: MessageName;
  length: number;
  buffer: Buffer;
}

const IDENT_LENGTH = 1;

const IDENT_TO_MESSAGE_NAME: Record<number, MessageName> = {
  ["X".charCodeAt(0)]: "Terminate",
  ["Q".charCodeAt(0)]: "Query",
  ["P".charCodeAt(0)]: "Parse",
  ["B".charCodeAt(0)]: "Bind",
  ["D".charCodeAt(0)]: "Describe",
  ["E".charCodeAt(0)]: "Execute",
  ["S".charCodeAt(0)]: "Sync",
};

const UNKNOWN_MESSAGE: FrontendMessage = {
  name: "Unknown",
  length: 0,
  buffer: Buffer.alloc(0),
};

const INSUFFICIENT_DATA: FrontendMessage = {
  name: "Unknown",
  length: 0,
  buffer: Buffer.alloc(0),
};

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

// https://www.postgresql.org/docs/current/protocol.html
// https://www.postgresql.org/docs/current/protocol-message-formats.html
export function parseMessage(buffer: Buffer): FrontendMessage {
  if (isSSLRequest(buffer)) {
    const length = buffer.readUint32BE(0);
    return {
      name: "SSLRequest",
      length,
      buffer: Buffer.from(buffer.subarray(0, length)),
    };
  }

  if (isStartupMessage(buffer)) {
    const length = buffer.readUint32BE(0);
    return {
      name: "StartupMessage",
      length,
      buffer: Buffer.from(buffer.subarray(0, length)),
    };
  }

  const ident = buffer.at(0);

  if (!ident) {
    return UNKNOWN_MESSAGE;
  }

  const name = IDENT_TO_MESSAGE_NAME[ident];

  if (!name) {
    return UNKNOWN_MESSAGE;
  }

  const length = buffer.readUint32BE(1) + IDENT_LENGTH;

  if (buffer.length < length) {
    return INSUFFICIENT_DATA;
  }

  return {
    name,
    length,
    buffer: Buffer.from(buffer.subarray(0, length)),
  };
}
