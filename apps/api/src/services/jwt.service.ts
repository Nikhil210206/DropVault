import { importPKCS8, importSPKI, SignJWT, jwtVerify } from 'jose';
import { env } from '../config/env';

// EdDSA (Ed25519): asymmetric, so only the issuer holds the signing key. The `kid`
// header lets us rotate keys without breaking already-issued tokens.
const ALG = 'EdDSA';

type Keys = {
  privateKey: Awaited<ReturnType<typeof importPKCS8>>;
  publicKey: Awaited<ReturnType<typeof importSPKI>>;
};

let keysPromise: Promise<Keys> | undefined;

function getKeys(): Promise<Keys> {
  keysPromise ??= (async () => {
    const privPem = Buffer.from(env.JWT_PRIVATE_KEY, 'base64').toString('utf8');
    const pubPem = Buffer.from(env.JWT_PUBLIC_KEY, 'base64').toString('utf8');
    return {
      privateKey: await importPKCS8(privPem, ALG),
      publicKey: await importSPKI(pubPem, ALG),
    };
  })();
  return keysPromise;
}

export interface AccessTokenClaims {
  sub: string;
  role: string;
  email: string;
}

export async function signAccessToken(claims: AccessTokenClaims): Promise<string> {
  const { privateKey } = await getKeys();
  return new SignJWT({ role: claims.role, email: claims.email })
    .setProtectedHeader({ alg: ALG, kid: env.JWT_KID })
    .setSubject(claims.sub)
    .setIssuer(env.JWT_ISSUER)
    .setAudience(env.JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${env.ACCESS_TOKEN_TTL}s`)
    .sign(privateKey);
}

export async function verifyAccessToken(token: string): Promise<AccessTokenClaims> {
  const { publicKey } = await getKeys();
  const { payload } = await jwtVerify(token, publicKey, {
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
  });
  return {
    sub: payload.sub ?? '',
    role: typeof payload.role === 'string' ? payload.role : 'USER',
    email: typeof payload.email === 'string' ? payload.email : '',
  };
}

const SHARE_AUDIENCE = 'dropvault-share';

/** Short-lived grant proving a share password was verified (separate audience from access tokens). */
export async function signShareGrant(shareId: string): Promise<string> {
  const { privateKey } = await getKeys();
  return new SignJWT({ sid: shareId })
    .setProtectedHeader({ alg: ALG, kid: env.JWT_KID })
    .setIssuer(env.JWT_ISSUER)
    .setAudience(SHARE_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(privateKey);
}

/** Returns the share id the grant authorizes, or '' if invalid/expired. */
export async function verifyShareGrant(token: string): Promise<string> {
  const { publicKey } = await getKeys();
  const { payload } = await jwtVerify(token, publicKey, {
    issuer: env.JWT_ISSUER,
    audience: SHARE_AUDIENCE,
  });
  return typeof payload.sid === 'string' ? payload.sid : '';
}
