// JSON cannot serialize BigInt. We emit BigInt as a string (not Number) to avoid
// precision loss for values above 2^53 — file sizes and byte counters can exceed it.
// Imported once for its side effect, before the app builds responses.
declare global {
  interface BigInt {
    toJSON(): string;
  }
}

BigInt.prototype.toJSON = function toJSON(this: bigint): string {
  return this.toString();
};

export {};
