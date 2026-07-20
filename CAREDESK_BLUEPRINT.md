# CareDesk MVP Product Blueprint

## Version 0.1 — Internal Product Specification

*(Saved as canonical reference per conversation)*

## Infrastructure Status (updated 2026-07-05)

| Item | Status | Details |
|------|--------|---------|
| Rate limiting | ✅ | In-memory + Redis fallback; 10/min login, 5/min register, 3/min forgot-password, 200/min general |
| Redis | ✅ | Client module at `src/shared/redis/` — auto-fallback to in-memory when unavailable |
| Docker | ✅ | Dev `docker-compose.yml` (postgres + redis + api + web); prod `docker-compose.prod.yml`; API `Dockerfile` (multi-stage); Web `Dockerfile` (nginx); `nginx.conf` with API proxy; `.dockerignore` |
| CI/CD | ✅ | `.github/workflows/ci.yml` — lint, typecheck, build, test API + web on push/PR to main |
| HTTPS | ✅ | Conditional via `HTTPS=true` env var; `scripts/generate-certs.ts` for self-signed certs; `getHttpsOptions()` in `src/shared/https/` |
| OpenAPI/Swagger | ✅ | `src/shared/swagger/` — auto-discovers route/controller JSDoc; available at `/docs` and `/docs.json` |
| MFA | ✅ | TOTP with speakeasy + QR code; `mfa_enabled` + `mfa_secret` on users table; login flow returns `mfaRequired` + challenge token when enabled; routes at `/mfa/*` and `/auth/mfa/verify-login` |
| Tests | ✅ | Vitest + supertest; 6 test files, 27+ tests; rate limit, MFA TOTP, JWT, password, schema validation, HTTPS config, Redis client, health check |
| Virus scanning | ✅ | `src/shared/virus-scan/` — blocks executable extensions, validates magic bytes; no ClamAV dependency |
| OCR | ✅ | `src/shared/ocr/` — lazy-loads tesseract.js; `recognizeImage()` and `recognizeBuffer()` |

See conversation with opencode for the full document. Key sections relevant to ongoing development:

### MVP Modules (numbered 1-10)
1. Authentication ✓ (login, register, forgot-password, refresh tokens, JWT, RBAC)
2. Organisation Management ✓ (multi-tenant, locations, departments)
3. Staff Management ✓ (profiles, qualifications, emergency contacts, employment history)
4. Compliance Management ✓ (DBS, passport, visa, right-to-work, training, expiry tracking, traffic lights, scores)
5. Document Management ✓ (upload, download, preview, versioning, categories)
6. Staff Scheduling ✓ (shifts, recurring shifts, templates, drag-drop planner, leave, conflict detection, overtime)
7. Workforce Marketplace ✓ (open shifts, publish, apply, approve, complete)
8. Dashboard ✓ (manager dashboard, worker dashboard, compliance %, open shifts, etc.)
9. Notifications ✓ (email, in-app, socket.io push; SMS-ready)
10. Reporting ✓ (compliance, staffing, shifts, marketplace, documents, incidents)

### Technology Stack (Section 9)
- Frontend: React, TypeScript, MUI, React Router, React Query — ✓
- Backend: Node.js, Express, TypeScript — ✓
- Database: PostgreSQL — ✓
- ORM: Raw SQL (not Prisma as suggested)
- Cache: Redis — ✗ (not implemented)
- Storage: Local filesystem (not Cloudflare R2)
- Auth: JWT, Refresh Tokens, RBAC — ✓
- Infrastructure: Docker — ✗, GitHub Actions — ✗, Nginx — ✗

### Architecture (Section 10)
- Modular Monolith ✓ — modules under `apps/api/src/modules/`
- Each module: controller, service, repository, routes, types — mostly ✓

### Security Requirements (Section 12)
- Password hashing ✓, JWT access+refresh ✓, RBAC ✓
- HTTPS — ✗ (not configured), rate limiting — ✗, input validation — partial
- OWASP Top 10 — partial, MFA — ✗, audit logs ✓

### Still To Build (gaps vs blueprint)
- Rate limiting middleware
- OpenAPI/Swagger docs
- Tests (unit/integration)
- Docker setup
- GitHub Actions CI/CD
- Redis caching
- HTTPS configuration
- File virus scanning
- OCR for documents
- MFA
- Full service-user/resident management
- Full incident management (CQC-specific fields)
- Training/LMS module
- SMS notifications
- Agency integration (marketplace)
- AI features
