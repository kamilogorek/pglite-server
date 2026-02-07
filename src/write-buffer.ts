export class GrowableOffsetBuffer {
  #buffer = Buffer.alloc(16);
  #offset = 0;

  write(data: string) {
    const byteLength = Buffer.byteLength(data);
    this.updateCapacity(byteLength);
    this.#buffer.write(data, this.#offset);
    this.#offset += byteLength;
  }

  writeUint8(data: number) {
    this.updateCapacity(1);
    this.#buffer.writeUint8(data, this.#offset);
    this.#offset += 1;
  }

  writeUint32BE(data: number) {
    this.updateCapacity(4);
    this.#buffer.writeUint32BE(data, this.#offset);
    this.#offset += 4;
  }

  updateCapacity(chunkLength: number) {
    while (this.#buffer.byteLength < this.#offset + chunkLength) {
      const newBuffer = Buffer.alloc(this.#buffer.byteLength * 2);
      this.#buffer.copy(newBuffer, 0, 0, this.#offset);
      this.#buffer = newBuffer;
    }
  }

  toBuffer(): Buffer {
    return Buffer.from(this.#buffer.subarray(0, this.#offset));
  }
}
