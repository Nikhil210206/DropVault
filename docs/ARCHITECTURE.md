# DropVault — System Architecture

> Phase 1 deliverable. Status: **approved-pending**. This is the design we lock before writing code.
> Locked decisions: **Turborepo monorepo · Render (api + worker) · Resend email · MinIO local storage**.

## 0. Architecture philosophy & key bets

1. **Browser uploads/downloads go directly to S3 via presigned URLs — never through our API.**
   The Node server issues signed permissions and records metadata; it never proxies file bytes.
   This keeps the API stateless, cheap, and lets S3 absorb the bandwidth.
2. **The API is fully stateless.** All shared state (sessions, rate-limit counters, cache, job
   queues, websocket fan-out) lives in Redis/Postgres, so we can run N identical API containers.
3. **Heavy work is asynchronous.** Thumbnails, virus scanning, analytics rollups, and cleanup run
   as jobs on a Redis-backed queue processed by a separate worker process.

---

## 1. High-Level Architecture (HLD)

```
                                  ┌──────────────────────────────┐
                                  │            Clients            │
                                  │   Browser (Next.js web app)   │
                                  └───────────────┬──────────────┘
                                                  │ HTTPS
                  ┌───────────────────────────────┼───────────────────────────────┐
                  │                                │                               │
                  ▼                                ▼                               ▼
        ┌───────────────────┐          ┌────────────────────┐          ┌────────────────────┐
        │   Vercel (Edge)   │          │  Render: API (LB)   │          │      AWS S3        │
        │  Next.js 15 SSR/  │  /api    │   Express (stateless)│  signed  │  (private bucket)  │
        │  RSC + static     │─────────▶│                     │  PUT/GET │  files, thumbs,    │
        └───────────────────┘          └─────────┬──────────┘ ◀────────│  avatars           │
                  ▲                               │   ▲                 └──────────┬─────────┘
                  │ presigned URLs (from API)     │   │                            │ direct upload/
                  └───────────────────────────────┘   │                            │ download (browser↔S3)
                                                       │                            │
        ┌──────────────────────────────────────────────┴───────────────┐          │
        │                  Stateful backing services (Render)            │         │
        │  ┌────────────┐   ┌──────────────┐   ┌────────────────────┐    │         │
        │  │ PostgreSQL │   │    Redis      │   │ Worker (Render svc)│◀───┼─────────┘
        │  │ (metadata) │   │ cache/session │   │  BullMQ consumer:  │  completion ping
        │  │            │   │ rate-limit,   │   │  thumbnails, scan, │
        │  │            │   │ queues, ws    │   │  cleanup, rollups  │
        │  └────────────┘   └──────────────┘   └─────────┬──────────┘
        └──────────────────────────────────────────────────┼───────────┘
                                                            ▼
                                                  ┌──────────────────┐
                                                  │ ClamAV (scan)    │
                                                  │ Resend (email)   │
                                                  └──────────────────┘
```

**Request flows:**
- **Auth/metadata** → Vercel → API → (Redis cache → Postgres) → response.
- **Upload** → API issues presigned multipart URLs → browser PUTs chunks straight to S3 → browser
  tells API "complete" → API finalizes + enqueues thumbnail/scan jobs → worker processes → Socket.IO
  pushes "ready" to the browser.
- **Download/preview** → API issues short-lived presigned GET → browser fetches from S3 (or CloudFront).
- **Public share** → recipient hits `/s/:token` → Next.js renders → API validates token/password/expiry
  → issues a scoped presigned GET.

---

## 2. Low-Level Architecture (LLD)

Clean / layered architecture with one-directional dependencies:

```
HTTP Request
    ▼
ROUTE        URL+verb → middleware chain → controller
MIDDLEWARE   helmet · cors · requestId · logger · rateLimit · authenticate(JWT) ·
             authorize(RBAC) · validate(Zod DTO) · csrf · errorHandler (terminal)
CONTROLLER   thin: validated input → service → HTTP response. No business logic.
SERVICE      business rules, transactions, cache decisions, enqueues jobs, domain events.
REPOSITORY   the ONLY layer that talks to Prisma. Returns domain entities.
DATA/INFRA   PostgreSQL · Redis · S3 SDK · BullMQ · Resend · ClamAV
```

**Why:** repositories isolate Prisma (mockable, swappable); services own transactions (e.g. create
file + increment storage + audit must be atomic); controllers stay dumb and testable. DI via
constructor-injection + factory wiring (not heavy decorator frameworks). Zod DTO validation at the
edge means services receive trusted, typed data. Zod schemas double as OpenAPI source and shared FE/BE types.

**Module boundaries (vertical slices):** `auth`, `users`, `folders`, `files`, `uploads`, `shares`,
`analytics`. Each slice owns routes/controller/service/repository/validators on top of the shared layers.

**Worker process:** BullMQ consumer runs as its own Render service, importing the same services but
driven by jobs — CPU-heavy thumbnailing can't starve API request handling.

---

## 3. Database Design (PostgreSQL)

Principles: soft deletes (`deletedAt`) for recoverable entities; BIGINT byte sizes; hashed secrets;
append-only audit/download tables; explicit index on every FK and every filtered/sorted column.

- **users** — `id` uuid pk, `email` citext unique, `passwordHash`, `name`, `avatarKey`,
  `emailVerified`, `role` (USER/ADMIN), `storageUsed` bigint, `storageQuota` bigint, timestamps,
  `deletedAt`. `storageUsed` is a transactional denormalized counter (reconciled nightly).
- **refresh_tokens** — `id`, `userId` fk, `tokenHash` (sha-256) unique, `familyId`,
  `replacedByTokenId` self-fk, `userAgent`, `ip`, `expiresAt`, `revokedAt`. Enables rotation +
  reuse detection (reused token ⇒ revoke whole family).
- **verification_tokens** — `id`, `userId` fk, `type` (EMAIL_VERIFY/PASSWORD_RESET), `tokenHash`,
  `expiresAt`, `usedAt`.
- **folders** — `id`, `userId` fk, `parentId` self-fk (null=root), `name`, `path` (materialized),
  `deletedAt`. `unique(userId, parentId, name) where deletedAt is null`. Adjacency list +
  materialized path: simple, fast subtree prefix scans, free breadcrumbs; cost = rewrite descendant
  paths on move (transactional).
- **files** — `id`, `userId` fk, `folderId` fk (null=root), `name`, `originalName`, `mimeType`,
  `size` bigint, `storageKey`, `checksum` (sha-256), `status` (UPLOADING/SCANNING/READY/QUARANTINED/
  FAILED), `thumbnailKey`, `version`, timestamps, `deletedAt`. Downloadable/shareable only when READY.
- **upload_sessions** — `id`, `userId` fk, `fileId` fk (null until finalize), `s3UploadId`,
  `storageKey`, `fileName`, `mimeType`, `totalSize`, `chunkSize`, `totalParts`,
  `completedParts` jsonb, `status` (PENDING/IN_PROGRESS/COMPLETED/ABORTED/EXPIRED), `expiresAt`.
  Source of truth for resuming uploads.
- **shares** — `id`, `ownerId` fk, `fileId` fk?, `folderId` fk?, `token` unique, `visibility`
  (PUBLIC/PRIVATE), `passwordHash?`, `expiresAt?`, `maxDownloads?`, `downloadCount`, `oneTime`,
  `allowDownload`, `revokedAt`. `check (fileId XOR folderId)`. Encodes all six link types.
- **downloads** (append-only) — `id`, `fileId` fk, `shareId` fk?, `actorUserId` fk?, `ip` inet,
  `userAgent`, `country`, `bytesServed`, `createdAt`. Monthly-partition-friendly.
- **audit_logs** (append-only) — `id`, `actorUserId` fk?, `action`, `entityType`, `entityId`,
  `ip` inet, `userAgent`, `metadata` jsonb, `createdAt`.

**Integrity & performance:** FK `onDelete` Cascade for tokens; soft-delete/Restrict for user→files;
folder delete cascades via transactional app logic. Index every FK. Partial indexes
(`where deletedAt is null`) keep live indexes small. Append-only tables → time partitioning at scale.
Search v1 = `pg_trgm` GIN index on `files.name`; migrate to Meilisearch/OpenSearch if needed.

ER diagram and full Prisma schema are produced in Phase 2.

---

## 4. API Design

- Versioned base `/api/v1`, JSON only.
- Access token (JWT ~15m) via `Authorization: Bearer`; refresh token in
  `httpOnly; Secure; SameSite=Strict` cookie; `POST /auth/refresh` rotates it.
- Error envelope: `{ "error": { "code", "message", "details", "requestId" } }`.
- Cursor-based pagination; `Idempotency-Key` on unsafe creates; `X-Request-Id` + `X-RateLimit-*` headers.

| Module | Endpoints |
| --- | --- |
| Auth | `POST /auth/register · /login · /refresh · /logout · /verify-email · /forgot-password · /reset-password`; `GET /auth/me` |
| Users | `GET/PATCH /users/me`; `POST /users/me/avatar`; `GET /users/me/storage` |
| Folders | `POST /folders`; `GET /folders/:id`; `PATCH /folders/:id`; `DELETE /folders/:id`; `GET /folders/:id/children` |
| Files | `GET /files` (list/search); `GET /files/:id`; `PATCH /files/:id` (rename/move); `POST /files/:id/copy`; `DELETE /files/:id`; `GET /files/:id/download`; `GET /files/:id/preview` |
| Uploads | `POST /uploads` (init multipart); `GET /uploads/:id` (status/resume); `POST /uploads/:id/parts`; `POST /uploads/:id/complete`; `DELETE /uploads/:id` (abort) |
| Shares | `POST /shares`; `GET /shares`; `DELETE /shares/:id`; `GET /shares/:token`; `POST /shares/:token/verify`; `GET /shares/:token/download` |
| Analytics | `GET /analytics/overview`; `GET /files/:id/analytics` |
| Health | `GET /health`; `GET /health/ready` |

Request/response examples and error catalogs are generated via the Zod→OpenAPI pipeline and served
at `/docs` (Swagger UI) from Phase 3.

---

## 5. Folder Structure (Turborepo monorepo)

```
dropvault/
├── apps/
│   ├── web/                      # Next.js 15 frontend
│   │   └── src/{app,components,features,hooks,services,stores,lib,types,utils}/
│   └── api/                      # Express backend
│       └── src/
│           ├── modules/          # vertical slices (auth, users, files, …)
│           ├── middleware/  config/  jobs/  queues/  utils/  types/  docs/  tests/
│           ├── app.ts            # express app (middleware wiring)
│           ├── server.ts         # http + socket.io bootstrap
│           └── worker.ts         # separate BullMQ worker entrypoint
├── packages/
│   ├── shared/                   # Zod schemas + inferred TS types (DTOs) shared by web AND api
│   ├── config-eslint/  config-ts/
├── prisma/                       # schema.prisma, migrations, seed
├── docker/                       # Dockerfile.web, Dockerfile.api, compose files
├── .github/workflows/            # ci.yml, cd.yml
├── docs/                         # ARCHITECTURE.md (this), ADRs
├── turbo.json  pnpm-workspace.yaml  package.json
```

Monorepo chosen for shared DTOs/types, one CI, atomic cross-stack PRs.

---

## 6. Security Architecture (defense in depth)

- **Edge:** HTTPS + HSTS, CORS allowlist, CDN/WAF rate limiting (prod).
- **App:** helmet (CSP, no-sniff, frame-deny), Redis-backed global + per-route rate limiting,
  CSRF double-submit on cookie-auth routes, Zod input validation, output encoding, request-id correlation.
- **AuthN/Z:** argon2id passwords; JWT access (15m); rotating refresh + reuse detection; RBAC; resource
  ownership checks in every service.
- **Data:** least-privilege Postgres role; parameterized Prisma queries; secrets in env/secret store; PII minimization.
- **Storage:** private bucket (Block Public Access ON); presigned URLs scoped + short TTL; SSE at rest;
  per-user key namespacing.
- **Files:** size limits; MIME sniffing by magic bytes (not extension); extension allowlist; ClamAV scan
  → QUARANTINED until clean.
- **Audit:** append-only `audit_logs` for sensitive actions.

---

## 7. AWS / S3 Architecture

Single private bucket, prefix-namespaced:
```
s3://dropvault-{env}/
├── users/{userId}/files/{fileId}/{version}
├── users/{userId}/thumbnails/{fileId}.webp
├── users/{userId}/avatars/{userId}.webp
└── temp/{uploadSessionId}/
```
Block Public Access ON; SSE (S3 or KMS); CORS allowing PUT/GET from web origin; lifecycle rules
(abort incomplete multipart after 1 day, expire `temp/` after 24h). Versioning optional.

**Resumable multipart upload:** API `CreateMultipartUpload` → store UploadSession → presign each part →
browser PUTs parts directly to S3 → resume by asking API which parts are missing →
`CompleteMultipartUpload` → create files row + enqueue scan/thumbnail jobs.

**Download:** API verifies ownership/share → `getSignedUrl(GetObject, {expiresIn: 300})`. Optional
CloudFront + signed URLs for public/repeat assets.

**Credentials:** local dev → MinIO via `.env` (gitignored). Prod → IAM least-privilege
(`PutObject/GetObject/AbortMultipartUpload/ListMultipartUploadParts` on the bucket only).

---

## 8. Redis Strategy

| Use | Key pattern | Notes |
| --- | --- | --- |
| Cache (cache-aside) | `cache:file:{id}`, `cache:folder:{id}:children`, `cache:share:{token}` | TTL 60–300s; invalidate on write |
| Rate limiting | `rl:{ip|userId}:{route}` | sliding window, atomic INCR+EXPIRE |
| Token control | `revoked:refresh:{jti}` | force-logout denylist |
| Queues (BullMQ) | `bull:{queue}:*` | thumbnail, scan, cleanup, rollup |
| WebSocket fan-out | Socket.IO Redis adapter | any node reaches any client |

Cache-aside with explicit invalidation on write. Quota enforcement reads Postgres, not cache.
Redis treated as disposable — authoritative data lives in Postgres/S3.

---

## 9. Docker Architecture

**Local `docker-compose.yml`:** postgres, redis, **minio** (S3-compatible), **mailhog** (email
catcher), clamav, api (hot-reload), worker, web. One command brings up the whole stack offline.

**Images:** multi-stage builds (deps→build→runtime), non-root user, production-only runtime deps.
Separate `Dockerfile.api` / `Dockerfile.web`; worker reuses the api image with a different command.
`HEALTHCHECK` + readiness endpoints.

**Prod:** Render builds from Dockerfiles; real S3 + Resend instead of MinIO/Mailhog; secrets from
Render env groups.

---

## 10. CI/CD Architecture (GitHub Actions)

**ci.yml (PR & push):** install (pnpm cached) → lint → typecheck → `prisma validate` → test (vitest
unit+integration against ephemeral postgres/redis service containers) → build → docker build (no push).
Tasks parallelized via Turborepo task graph + remote cache.

**cd.yml (merge to main):** `prisma migrate deploy` (gated, first) → deploy api+worker to Render →
deploy web to Vercel → smoke test `/health/ready` → notify.

Branch protection on `main` (CI + 1 review), GitHub Environments for secrets, separate staging/prod
with manual approval on prod.

---

## 11. Scalability Considerations

| Concern | Strategy |
| --- | --- |
| API throughput | stateless containers, horizontal scale behind LB |
| Upload/download bandwidth | offloaded to S3 (direct browser↔S3) |
| Download latency/egress | CloudFront CDN in front of S3 |
| Heavy compute | dedicated worker tier scaled by queue depth |
| DB reads | connection pooling; read replicas for analytics later |
| Hot reads | Redis cache for metadata + share-token resolution |
| Big tables | append-only + time partitioning; archive cold partitions |
| Storage accounting | denormalized transactional counter, nightly reconciliation |
| Real-time | Socket.IO Redis adapter |
| Search growth | pg_trgm now → Meilisearch/OpenSearch later |
| Cleanup | scheduled jobs purge expired sessions/shares/soft-deletes |

---

## 12. Weaknesses & Improvements (honest review)

1. **Post-upload scanning gap** — file lands in S3 before ClamAV clears it; mitigated by QUARANTINED
   gate. Improve: scan from a quarantine prefix, `CopyObject` to live prefix only after clean.
2. **Logical (not physical) multi-tenant isolation** — enforced in app code; one missing ownership
   check leaks data. Improve: centralized policy guard + Postgres RLS + cross-tenant tests.
3. **No client-side / zero-knowledge encryption** — S3 encrypts at rest but DropVault can read files.
   Roadmap item.
4. **Filename-only search** — pg_trgm won't do content/ranked search. Document Meilisearch path.
5. **Folder move cost** — materialized path rewrite is heavy for huge subtrees. Improve: background job.
6. **storageUsed counter drift** — mitigate with nightly reconciliation job.
7. **ClamAV operational weight** — memory-hungry, DB updates needed. Consider SaaS scan in prod.
8. **Single-region** — no DR/multi-region in v1. Add S3 CRR + cross-region replica when needed.
9. **WebSockets not on Vercel** — sockets live on the Render api tier, never Vercel.

**Deliberately not over-engineered in v1 (correctly):** no Kubernetes, no microservices, no
event-sourcing, no multi-region. Modular monolith + worker is the right granularity for now.
