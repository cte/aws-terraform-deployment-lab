# Ember Migration Lab App

Small verification app for the Terraform environment in this repository.

It uses:

- Vite + React + TanStack Router for the UI
- shadcn/ui + Tailwind 4 for the front-end shell
- Fastify + Zod for the API
- BullMQ + Redis for background work
- Postgres for job metadata
- S3 for source files and processed results

## Runtime Shape

One codebase and one Docker image support two modes:

- `web`: serves the built front-end and the API on port `3000`
- `worker`: processes BullMQ jobs privately

## Local Development

The workspace root now owns AWS credentials through a `dotenvx`-managed `.env`
file, with only the AWS secret access key encrypted.
This package still uses `packages/app/.env` for local app config.

1. Copy `packages/app/.env.example` to `packages/app/.env` and adjust values.
2. Start local Postgres and Redis:

```bash
docker compose -f packages/app/docker-compose.yml up -d
```

3. Verify the workspace AWS credentials:

```bash
pnpm aws:whoami
```

4. Run the UI and API together from the workspace root:

```bash
pnpm dev
```

5. Run the worker in a second shell from the workspace root:

```bash
pnpm dev:worker
```

These root scripts use the repo-managed AWS env path by default. If you want to
run the app against AWS using SSO instead, log in with `aws sso login` and use
package-level commands without the root `dotenvx` wrappers.

## Production-Style Run

Build the client bundle:

```bash
cd packages/app
pnpm build
```

Start the web process:

```bash
cd packages/app
pnpm start
```

Start the worker process:

```bash
cd packages/app
pnpm start:worker
```

## Container Image

The Dockerfile now expects the workspace root as the build context:

```bash
docker build -f packages/app/Dockerfile -t ember-migration-lab .
```

The worker uses the same image with a different command:

```bash
docker run --rm ember-migration-lab node --import tsx server/worker.ts
```
