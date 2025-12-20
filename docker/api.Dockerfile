# syntax=docker/dockerfile:1.6
FROM node:20-alpine AS deps
WORKDIR /app
COPY apps/api/package.json ./package.json
COPY apps/api/package-lock.json ./package-lock.json
RUN npm install

FROM node:20-alpine AS dev
WORKDIR /app
ENV NODE_ENV=development
COPY --from=deps /app/node_modules ./node_modules
COPY apps/api/package.json ./package.json
COPY apps/api/tsconfig.json ./tsconfig.json
COPY apps/api/src ./src
COPY prisma ./prisma
EXPOSE 4000
CMD ["npm", "run", "dev"]

FROM node:20-alpine AS builder
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY apps/api/package.json ./package.json
COPY apps/api/tsconfig.json ./tsconfig.json
COPY apps/api/src ./src
COPY prisma ./prisma
RUN npm run prisma:generate && npm run build && npm prune --omit=dev

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
EXPOSE 4000
CMD ["node", "dist/server.js"]
