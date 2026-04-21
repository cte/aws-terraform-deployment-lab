FROM node:22-bookworm-slim

WORKDIR /repo

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV NODE_ENV=production

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages/app/package.json packages/app/package.json
RUN pnpm install --frozen-lockfile

COPY packages/app packages/app

RUN pnpm --filter @ember-migration/app build

WORKDIR /repo/packages/app

EXPOSE 3000

CMD ["node", "--import", "tsx", "server/index.ts"]
