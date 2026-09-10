# Argus: API + agent + built web app in one image.
FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@10 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
COPY web/package.json web/pnpm-lock.yaml ./web/
RUN pnpm install --frozen-lockfile && cd web && pnpm install --frozen-lockfile
COPY . .
RUN cd web && pnpm build && cd .. && pnpm build

FROM node:22-alpine
RUN corepack enable && corepack prepare pnpm@10 --activate
WORKDIR /app
ENV NODE_ENV=production
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod
COPY --from=build /app/dist ./dist
COPY --from=build /app/web/dist ./web/dist
EXPOSE 3100
CMD ["node", "dist/server.js"]
