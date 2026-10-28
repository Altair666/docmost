FROM node:26-slim AS base
LABEL org.opencontainers.image.source="https://github.com/docmost/docmost"

RUN npm install -g pnpm@11.15.1

FROM base AS builder

# Потолок кучи для сборки. Оговорка: на машине с 6 ГБ Node и сам берёт
# ровно столько (2144 МБ), так что здесь это ничего не ограничивает —
# проверено замером внутри слоя. Настоящий расход даёт не одна куча, а
# несколько параллельных процессов сборки разом, поэтому единственная
# рабочая мера — держать свободными хотя бы 4 ГБ и гасить на время
# сборки лишние контейнеры (это делает deploy/build.sh). Довод оставлен
# для машин побольше, где умолчание выше и потолок начинает работать.
# Номер нашей сборки: тот же, что в теге образа docmost-custom:vN.
# Приставка VITE_ обязательна — без неё Vite не пустит переменную
# в клиентский код.
ARG CUSTOM_BUILD=
ENV VITE_CUSTOM_BUILD=$CUSTOM_BUILD
ARG NODE_OPTIONS=--max-old-space-size=2048
ENV NODE_OPTIONS=$NODE_OPTIONS

WORKDIR /app

COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm build

FROM base AS installer

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl bash \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy apps
COPY --from=builder /app/apps/server/dist /app/apps/server/dist
COPY --from=builder /app/apps/client/dist /app/apps/client/dist
COPY --from=builder /app/apps/server/package.json /app/apps/server/package.json

# Copy packages
COPY --from=builder /app/packages/editor-ext/dist /app/packages/editor-ext/dist
COPY --from=builder /app/packages/editor-ext/package.json /app/packages/editor-ext/package.json
COPY --from=builder /app/packages/base-formula/dist /app/packages/base-formula/dist
COPY --from=builder /app/packages/base-formula/package.json /app/packages/base-formula/package.json

# Copy root package files
COPY --from=builder /app/package.json /app/package.json
COPY --from=builder /app/pnpm*.yaml /app/

# Copy patches
COPY --from=builder /app/patches /app/patches

RUN chown -R node:node /app

USER node

RUN pnpm install --frozen-lockfile --prod

RUN mkdir -p /app/data/storage

VOLUME ["/app/data/storage"]

EXPOSE 3000

CMD ["pnpm", "start"]
