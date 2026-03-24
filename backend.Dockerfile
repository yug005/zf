# -----------------------------------
# STAGE 1: Builder
# -----------------------------------
FROM node:20-alpine AS builder

# Required by Prisma query engines
RUN apk add --no-cache openssl

WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci
COPY . .

# Generate Prisma Client & compile TS
RUN npx prisma generate
RUN npm run build

# -----------------------------------
# STAGE 2: Production execution environment
# -----------------------------------
FROM node:20-alpine
RUN apk add --no-cache openssl
WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --omit=dev --ignore-scripts
RUN npx prisma generate

# Grab the compiler artifacts and the raw prisma bounds for deployment
COPY --from=builder /app/dist ./dist

EXPOSE 3000

# Push missing schemas upon boot sequence and run the engine
CMD sh -c "npx prisma migrate deploy && npm run start:prod"
