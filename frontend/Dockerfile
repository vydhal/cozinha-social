FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json bun.lock* bunfig.toml* ./
RUN npm install --legacy-peer-deps

COPY . .

ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# ───────────────────────────────────────────────
FROM node:22-alpine AS production
WORKDIR /app

COPY --from=builder /app/dist ./dist

ENV PORT=3000
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/ || exit 1

CMD ["node", "dist/server/index.mjs"]
