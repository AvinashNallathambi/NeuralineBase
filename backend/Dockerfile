# ── Stage 1: Build ──────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests first (layer caching)
COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* ./

# Install dependencies
RUN \
  if [ -f pnpm-lock.yaml ]; then \
    corepack enable pnpm && pnpm install --frozen-lockfile; \
  elif [ -f yarn.lock ]; then \
    yarn install --frozen-lockfile; \
  else \
    npm install; \
  fi

# Copy source code
COPY . .

# Build the NestJS application
RUN \
  if [ -f pnpm-lock.yaml ]; then \
    pnpm run build; \
  elif [ -f yarn.lock ]; then \
    yarn build; \
  else \
    npm run build; \
  fi

# ── Stage 2: Production ────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nestjs && \
    adduser -S nestjs -u 1001

# Copy dependency manifests
COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* ./

# Install production dependencies only
RUN \
  if [ -f pnpm-lock.yaml ]; then \
    corepack enable pnpm && pnpm install --frozen-lockfile --prod; \
  elif [ -f yarn.lock ]; then \
    yarn install --frozen-lockfile --production; \
  else \
    npm install --omit=dev; \
  fi

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Switch to non-root user
USER nestjs

# Expose NestJS port
EXPOSE 4000

# Start the application
CMD ["node", "dist/main.js"]
