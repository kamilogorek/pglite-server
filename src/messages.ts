type MessageName =
  | MessageWithIdentifier
  | MessageWithoutIdentifier
  | "Unknown"
  | "InsufficientData";

type MessageWithIdentifier =
  | "Bind"
  | "Close"
  | "CopyFail"
  | "Describe"
  | "Execute"
  | "Flush"
  | "FunctionCall"
  | "GSSResponse"
  | "Parse"
  | "PasswordMessage"
  | "Query"
  | "SASLResponse" // same as "SASLInitialResponse"
  | "Sync"
  | "Terminate";

type MessageWithoutIdentifier =
  | "CancelRequest"
  | "GSSENCRequest"
  | "SSLRequest"
  | "StartupMessage";

export interface FrontendMessage {
  name: MessageName;
  length: number;
  buffer: Buffer;
}

const IDENT_LENGTH = 1;

const IDENT_TO_MESSAGE_NAME: Record<number, MessageWithIdentifier> = {
  ["B".charCodeAt(0)]: "Bind",
  ["C".charCodeAt(0)]: "Close",
  ["f".charCodeAt(0)]: "CopyFail",
  ["D".charCodeAt(0)]: "Describe",
  ["E".charCodeAt(0)]: "Execute",
  ["H".charCodeAt(0)]: "Flush",
  ["F".charCodeAt(0)]: "FunctionCall",
  ["p".charCodeAt(0)]: "GSSResponse",
  ["P".charCodeAt(0)]: "Parse",
  ["p".charCodeAt(0)]: "PasswordMessage",
  ["Q".charCodeAt(0)]: "Query",
  ["p".charCodeAt(0)]: "SASLResponse",
  ["S".charCodeAt(0)]: "Sync",
  ["X".charCodeAt(0)]: "Terminate",
};

const UNKNOWN_MESSAGE: FrontendMessage = {
  name: "Unknown",
  length: 0,
  buffer: Buffer.alloc(0),
};

const INSUFFICIENT_DATA: FrontendMessage = {
  name: "InsufficientData",
  length: 0,
  buffer: Buffer.alloc(0),
};

function isCancelRequest(buffer: Buffer): boolean {
  // 1234 5678
  return (
    buffer.at(4) === 0x04 &&
    buffer.at(5) === 0xd2 &&
    buffer.at(6) === 0x16 &&
    buffer.at(7) === 0x2e
  );
}

function isGSSENCRequest(buffer: Buffer): boolean {
  // 1234 5680
  return (
    buffer.at(4) === 0x04 &&
    buffer.at(5) === 0xd2 &&
    buffer.at(6) === 0x16 &&
    buffer.at(7) === 0x30
  );
}

function isSSLRequest(buffer: Buffer): boolean {
  // 1234 5679
  return (
    buffer.at(4) === 0x04 &&
    buffer.at(5) === 0xd2 &&
    buffer.at(6) === 0x16 &&
    buffer.at(7) === 0x2f
  );
}

function isStartupMessage(buffer: Buffer): boolean {
  // 0003 0000
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
  if (buffer.length === 0) {
    return INSUFFICIENT_DATA;
  }

  if (isCancelRequest(buffer)) {
    const length = buffer.readUint32BE(0);
    return {
      name: "CancelRequest",
      length,
      buffer: Buffer.from(buffer.subarray(0, length)),
    };
  }

  if (isGSSENCRequest(buffer)) {
    const length = buffer.readUint32BE(0);
    return {
      name: "GSSENCRequest",
      length,
      buffer: Buffer.from(buffer.subarray(0, length)),
    };
  }

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

  const name = IDENT_TO_MESSAGE_NAME[buffer.at(0)!];
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
