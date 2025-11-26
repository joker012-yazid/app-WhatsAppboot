# syntax=docker/dockerfile:1.6
FROM node:20-alpine AS deps
WORKDIR /app
COPY apps/web/package.json ./package.json
COPY apps/web/package-lock.json ./package-lock.json
RUN npm install

FROM node:20-alpine AS dev
WORKDIR /app
ENV NODE_ENV=development
COPY --from=deps /app/node_modules ./node_modules
COPY apps/web/package.json ./package.json
COPY apps/web/tsconfig.json ./tsconfig.json
COPY apps/web/next.config.mjs ./next.config.mjs
COPY apps/web/postcss.config.cjs ./postcss.config.cjs
COPY apps/web/tailwind.config.ts ./tailwind.config.ts
COPY apps/web/public ./public
COPY apps/web/src ./src
EXPOSE 3000
CMD ["npm", "run", "dev"]

FROM node:20-alpine AS builder
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY apps/web/package.json ./package.json
COPY apps/web/tsconfig.json ./tsconfig.json
COPY apps/web/next.config.mjs ./next.config.mjs
COPY apps/web/postcss.config.cjs ./postcss.config.cjs
COPY apps/web/tailwind.config.ts ./tailwind.config.ts
COPY apps/web/public ./public
COPY apps/web/src ./src
RUN npm run build && npm prune --omit=dev

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY apps/web/public ./public
EXPOSE 3000
CMD ["npm", "run", "start"]
