import { describe, it, expect } from 'vitest';
import { scanBuffer } from '../scanner';

const EICAR = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';

describe('scanner (eicar provider)', () => {
  it('flags the EICAR test signature as infected', async () => {
    const result = await scanBuffer(Buffer.from(EICAR));
    expect(result.clean).toBe(false);
    expect(result.signature).toContain('Eicar');
  });

  it('passes ordinary content as clean', async () => {
    const result = await scanBuffer(Buffer.from('a perfectly normal file'));
    expect(result.clean).toBe(true);
  });
});
