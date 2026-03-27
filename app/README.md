# Ember Migration Lab

Small verification app for the Terraform environment in this repository.

It uses:

- Vite + React + TanStack Router for the UI
- shadcn/ui + Tailwind 4 for the front-end shell
- Fastify + Zod for the API
- BullMQ + Redis for background work
- Postgres for job metadata
- S3 for source files and processed results

## Runtime shape

One codebase and one Docker image support two modes:

- `web`: serves the built front-end and the API on port `3000`
- `worker`: processes BullMQ jobs privately

## Local development

1. Copy `.env.example` to `.env` and adjust values.
2. Start local Postgres and Redis:

```bash
docker compose up -d
```

3. Log into AWS if you want to use the real S3 bucket from the test account:

```bash
aws sso login --profile my-test-account
```

4. Run the UI and API together:

```bash
pnpm dev
```

5. Run the worker in a second shell:

```bash
pnpm dev:worker
```

## Production-style run

Build the client bundle:

```bash
pnpm build
```

Start the web process:

```bash
pnpm start
```

Start the worker process:

```bash
pnpm start:worker
```

## Container image

The Dockerfile builds the Vite client and starts the Fastify web process by
default:

```bash
docker build -t ember-migration-lab .
```

The worker uses the same image with a different command:

```bash
docker run --rm ember-migration-lab node --import tsx server/worker.ts
```
