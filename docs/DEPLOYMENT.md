# DropVault — Deployment Runbook

Production topology: **Vercel** (web) · **Render** (API + worker) · **Render managed Postgres + Redis** · **AWS S3** (object storage) · **Resend** (email).

```
Browser ──HTTPS──► Vercel (Next.js)
   │  XHR /api + presigned PUT/GET
   ├──────────────► Render: dropvault-api (Express)  ──► Render Postgres
   │                         dropvault-worker (BullMQ) ─► Render Redis
   └──────────────► AWS S3 (direct upload/download via presigned URLs)
```

> Heads-up on cookies (read first): the refresh token is an httpOnly cookie. If the web
> and API are on **different registrable domains** (e.g. `*.vercel.app` + `*.onrender.com`)
> it becomes a third-party cookie (`SameSite=None`), which Safari/strict browsers block.
> **Strongly recommended:** put both on one root domain — `app.dropvault.com` (web) and
> `api.dropvault.com` (API) — so the cookie is first-party. The app already sends
> `SameSite=None; Secure` in production; same-site domains make it robust everywhere.

---

## 1. Prerequisites

- A domain you control (e.g. `dropvault.com`) — strongly recommended (see cookie note).
- Accounts: GitHub (repo pushed), Render, Vercel, AWS, Resend.
- Local: `aws` CLI configured, Node 22, `pnpm`.

---

## 2. AWS S3

```bash
export AWS_REGION=us-east-1
export BUCKET=dropvault-prod   # globally unique; change if taken (update the json files too)

# Create a private bucket
aws s3api create-bucket --bucket "$BUCKET" --region "$AWS_REGION" \
  $( [ "$AWS_REGION" = us-east-1 ] || echo --create-bucket-configuration LocationConstraint=$AWS_REGION )

# Block ALL public access
aws s3api put-public-access-block --bucket "$BUCKET" \
  --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

# Encrypt at rest (SSE-S3) + enable Versioning (protects against malicious/accidental delete)
aws s3api put-bucket-encryption --bucket "$BUCKET" \
  --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
aws s3api put-bucket-versioning --bucket "$BUCKET" --versioning-configuration Status=Enabled

# Lifecycle: abort incomplete multipart uploads after 1 day; expire temp/ after 24h
aws s3api put-bucket-lifecycle-configuration --bucket "$BUCKET" --lifecycle-configuration '{
  "Rules":[
    {"ID":"abort-mpu","Status":"Enabled","Filter":{},"AbortIncompleteMultipartUpload":{"DaysAfterInitiation":1}},
    {"ID":"expire-temp","Status":"Enabled","Filter":{"Prefix":"temp/"},"Expiration":{"Days":1}}
  ]}'

# CORS (edit docs/aws/s3-cors.json to your real web origin first)
aws s3api put-bucket-cors --bucket "$BUCKET" --cors-configuration file://docs/aws/s3-cors.json

# Enforce TLS
aws s3api put-bucket-policy --bucket "$BUCKET" --policy file://docs/aws/bucket-policy.json
```

**IAM least-privilege user** (the app's S3 credentials):

```bash
aws iam create-user --user-name dropvault-app
aws iam put-user-policy --user-name dropvault-app \
  --policy-name dropvault-s3 --policy-document file://docs/aws/iam-policy.json
aws iam create-access-key --user-name dropvault-app   # → S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY
```

> The `iam-policy.json` grants only the actions the app uses: multipart upload, get,
> delete, abort, list-parts — scoped to this one bucket. Rotate the keys periodically.

---

## 3. Generate JWT signing keys (EdDSA)

```bash
node -e "import('jose').then(async j=>{const k=await j.generateKeyPair('EdDSA',{crv:'Ed25519',extractable:true});\
console.log('JWT_PRIVATE_KEY='+Buffer.from(await j.exportPKCS8(k.privateKey)).toString('base64'));\
console.log('JWT_PUBLIC_KEY='+Buffer.from(await j.exportSPKI(k.publicKey)).toString('base64'))})"
```

Keep `JWT_PRIVATE_KEY` secret; both go into Render env. Rotate by issuing a new key with a
new `JWT_KID` (the app reads `kid` from the token header).

---

## 4. Resend (email)

1. Add and **verify your sending domain** (SPF/DKIM records) in the Resend dashboard.
2. Create an API key → `RESEND_API_KEY`.
3. Set `MAIL_FROM` to a verified address, e.g. `DropVault <no-reply@dropvault.com>`.

---

## 5. Render (API + worker + Postgres + Redis)

The repo ships [`render.yaml`](../render.yaml) (a Blueprint).

1. Render → **New → Blueprint** → select this repo. It creates: `dropvault-postgres`,
   `dropvault-redis`, `dropvault-api` (web, Docker), `dropvault-worker` (worker, Docker).
2. When prompted, fill the **secrets** (the `sync: false` vars) — paste the values from
   sections 2–4 into the `dropvault-shared` env group: `CORS_ORIGINS`, `WEB_URL`,
   `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`, `S3_*`, `RESEND_API_KEY`, `MAIL_FROM`.
   - `CORS_ORIGINS` and `WEB_URL` = your web URL, e.g. `https://app.dropvault.com`.
   - `S3_ENDPOINT` = `https://s3.<region>.amazonaws.com`, `S3_FORCE_PATH_STYLE=false`.
3. Apply. On first deploy the API's **preDeployCommand** runs `prisma migrate deploy`
   (creating the schema + the raw-SQL objects). `DATABASE_URL`/`REDIS_URL` are wired
   automatically by the Blueprint.
4. (Recommended) Map a custom domain `api.dropvault.com` to `dropvault-api`.
5. Note the API URL → you'll need it for the web app.

---

## 6. Vercel (web)

1. Vercel → **Add New → Project** → import this repo.
2. **Root Directory:** `apps/web`. Framework auto-detects **Next.js**; Vercel handles the
   pnpm workspace. (`apps/web/vercel.json` pins the framework.)
3. **Environment variable:** `NEXT_PUBLIC_API_URL = https://api.dropvault.com/api/v1`
   (your Render API URL + `/api/v1`). It's inlined at build time, so redeploy after changes.
4. Deploy. Map your custom domain `app.dropvault.com`.
5. Back in Render, make sure `CORS_ORIGINS` and `WEB_URL` exactly match this web origin.

---

## 7. CI/CD (optional, automated)

`.github/workflows/ci.yml` already runs lint/typecheck/test on every PR. For automated
deploys you have two options:

- **Blueprint auto-deploy (simplest):** Render + Vercel auto-deploy on push to `main`.
  Migrations run via the API's `preDeployCommand`. No extra secrets needed.
- **Explicit pipeline:** use `.github/workflows/cd.yml` and set the GitHub secrets it
  references (`DATABASE_URL`, `RENDER_DEPLOY_HOOK_API`/`_WORKER`, `VERCEL_*`,
  `PRODUCTION_API_URL`). Add branch protection on `main` requiring the CI checks.

---

## 8. Post-deploy smoke checklist

```bash
API=https://api.dropvault.com
curl -fsS $API/health            # {"status":"ok",...}
curl -fsS $API/health/ready      # {"status":"ready","checks":{"db":"up","redis":"up"}}
```

Then in a browser on `https://app.dropvault.com`:

- [ ] Register → verification email arrives (Resend).
- [ ] Log in, reload the page → session restores (refresh cookie works → confirms the
      cookie/domain setup).
- [ ] Upload a file (direct-to-S3 PUT succeeds → confirms S3 CORS + IAM).
- [ ] Download it.
- [ ] Create a share link → open in incognito → downloads.
- [ ] Worker: check `dropvault-worker` logs show "DropVault worker started".

---

## 9. Production hardening (from the architecture review)

These are recommended before real traffic — see `docs/ARCHITECTURE.md §13`:

- **Cookieless content domain:** serve downloads/previews via **CloudFront** (origin access
  to the private bucket, signed URLs/cookies) on a separate domain → closes the stored-XSS
  → token-theft path and makes public assets cacheable.
- **Backups / DR:** Render Postgres automated backups + **rehearse a restore**; S3 Versioning
  is already on. Define RPO/RTO.
- **Connection pooling:** add **PgBouncer** (transaction mode) in front of Postgres before
  scaling the API horizontally; cap the Prisma pool.
- **Observability:** wire Sentry + OpenTelemetry; alert on BullMQ dead-letter / stuck files.
- **Malware scanning:** run a ClamAV service (x86) reachable at `CLAMAV_HOST`, set
  `SCAN_ENABLED=true` + `SCAN_PROVIDER=clamav`; **sandbox the worker** (no egress, dropped
  caps, CPU/mem/time limits) since it decodes untrusted media.

---

## 10. Rollback

- **Code:** Render & Vercel keep previous deploys — click **Rollback** to the last good one.
- **Database:** migrations are **expand/contract** (backward-compatible), so rolling code
  back is safe within a release. For a bad migration, restore from a Postgres backup
  (point-in-time) — do not hand-edit production schema.

---

## 11. Cost (rough, hobby/starter tier)

Render starter API + worker + Postgres + Redis ≈ low-tens of \$/mo · Vercel hobby free ·
S3 pennies + egress · Resend free tier. Set **AWS budget alerts** and watch S3 egress —
fronting downloads with CloudFront reduces it significantly at scale.
