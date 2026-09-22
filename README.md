# omnichannel-enquiry-api

Backend for the **Omnichannel Customer Enquiry** system — NestJS modular monolith · TypeORM · PostgreSQL · Redis · RabbitMQ · S3 · Socket.IO.

- Mobile/web app: [`omnichannel-enquiry-app`](../omnichannel-enquiry-app) · Infrastructure (Terraform/AWS): [`omnichannel-enquiry-infra`](../omnichannel-enquiry-infra)
- System design: [`docs/design.md`](docs/design.md) (architecture, ER, API contract, offline sync & idempotency, omnichannel, SLA, permissions, scale & load balancing)
- UX/UI: [`docs/ux-ui.md`](docs/ux-ui.md) · Scale assumptions: [`docs/scale-assumptions.md`](docs/scale-assumptions.md)

> **Status:** project skeleton — config, database wiring (snake_case ↔ camelCase), Swagger, error format, health checks, graceful shutdown, Docker, CI/CD to AWS ECS. Feature modules are being implemented next (see [`src/modules/README.md`](src/modules/README.md)).

## Run locally

```bash
cp .env.example .env
docker compose up -d                                  # postgres, redis, rabbitmq, minio, mailpit, migrate, api, worker, traefik
docker compose up -d --scale api=3 --scale worker=2   # try horizontal scaling behind the load balancer
```

| URL | What |
|---|---|
| http://localhost:4000/api/docs | Swagger (API documentation) |
| http://localhost:4000/api/health/ready | readiness (used by the load balancer) |
| http://localhost:8080 | Traefik dashboard (see the api replicas) |
| http://localhost:15672 | RabbitMQ (omni / omni_dev_password) |
| http://localhost:9001 | MinIO console (S3 locally) |
| http://localhost:8025 | Mailpit (emails sent in dev) |

Without Docker for the app itself: start only the dependencies (`docker compose up -d postgres redis rabbitmq minio minio-init mailpit`), set `DB_HOST=localhost` etc. in `.env`, then `npm install && npm run migration:run && npm run start:dev`.

## Scripts

| Command | Purpose |
|---|---|
| `npm run start:dev` / `start:worker:dev` | API / worker with hot reload |
| `npm test` · `npm run test:cov` | unit tests (Jest) |
| `npm run lint` · `npm run format` | ESLint · Prettier |
| `npm run build` | compile to `dist/` |
| `npm run migration:generate -- src/database/migrations/AddX` | generate a migration from entity changes (**after every entity change**) |
| `npm run migration:run` · `migration:revert` | apply / roll back |

## Conventions (short version — details in `docs/design.md` and the team standard)

- **Layers per (sub-)module:** `controllers/` (routes + Swagger) → `services/` (business rules) → `repositories/` (all queries) → `dto/` (input/output + validation) · shared helpers in `common/`.
- **Modules talk through facade services or RabbitMQ events**, never another module's repository.
- **Database:** tables `snake_case`, singular, parent→child (`chat`, `chat_message`, `chat_message_attachment`); code and JSON `camelCase`. `synchronize` is always off — schema changes only via migrations.
- **Errors:** one shape (`ApiErrorDto`), `code` is an i18n key (e.g. `chat.notAssigned`).
- **Money/decimals:** `common/utils/decimal.util.ts`, never JS number math.
- **Stateless:** sessions, rate limits, dedupe keys in Redis; files in S3 → any number of replicas behind the load balancer.

## Deploy (AWS)

`.github/workflows/deploy.yml`: build ARM64 image → push to ECR → run the `migrate` task once → roll out `api` and `worker` (ECS circuit breaker rolls back on failure). `main` deploys to **dev**; **prod** is manual.

GitHub variables per environment (values from `terraform output deploy` in the infra repo): `AWS_REGION`, `AWS_DEPLOY_ROLE_ARN`, `ECR_REPOSITORY`, `ECS_CLUSTER`, `ECS_API_SERVICE`, `ECS_WORKER_SERVICE`, `ECS_MIGRATE_TASK_FAMILY`, `ECS_SUBNETS`, `ECS_SECURITY_GROUP`.

## Technical decisions (summary)

| Decision | Why |
|---|---|
| Modular monolith + sub-modules | prototype scale doesn't justify microservices; module boundaries allow extracting `webhook` first |
| PostgreSQL + unique constraints for idempotency | a retried offline sync can never create the same enquiry twice |
| Socket.IO + Redis adapter | reconnect/fallback for mobile networks, rooms, acks for delivery state, multi-instance |
| RabbitMQ | webhook fallback queue, image mirroring, outbound messages, SLA jobs off the request path |
| pg_trgm search | partial + typo-tolerant search of products, customers and messages without a separate search engine |
