import net from 'node:net';
import { env } from '../config/env';

export interface ScanResult {
  clean: boolean;
  signature?: string;
}

// The EICAR standard anti-malware test string — every real scanner flags it, so it's a
// safe way to exercise the "threat detected" path without a live virus.
const EICAR = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';

/** Dev/CI scanner: flags the EICAR signature, treats everything else as clean. */
function scanWithEicarStub(data: Buffer): ScanResult {
  return data.toString('latin1').includes(EICAR)
    ? { clean: false, signature: 'Eicar-Test-Signature' }
    : { clean: true };
}

/** Production scanner: streams the bytes to clamd via the INSTREAM protocol over TCP. */
function scanWithClamd(data: Buffer): Promise<ScanResult> {
  return new Promise((resolve, reject) => {
    const socket = net.connect(env.CLAMAV_PORT, env.CLAMAV_HOST);
    const chunks: Buffer[] = [];
    socket.setTimeout(30_000, () => socket.destroy(new Error('clamd timeout')));
    socket.on('error', reject);
    socket.on('connect', () => {
      socket.write('zINSTREAM\0');
      const size = Buffer.alloc(4);
      size.writeUInt32BE(data.length, 0);
      socket.write(size);
      socket.write(data);
      const terminator = Buffer.alloc(4); // zero-length chunk ends the stream
      socket.write(terminator);
    });
    socket.on('data', (d) => chunks.push(d));
    socket.on('end', () => {
      const resp = Buffer.concat(chunks).toString('utf8');
      if (resp.includes('FOUND')) {
        resolve({ clean: false, signature: resp.match(/stream: (.+) FOUND/)?.[1]?.trim() });
      } else {
        resolve({ clean: true });
      }
    });
  });
}

export async function scanBuffer(data: Buffer): Promise<ScanResult> {
  return env.SCAN_PROVIDER === 'clamav' ? scanWithClamd(data) : scanWithEicarStub(data);
}
