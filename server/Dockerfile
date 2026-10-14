# GV Pathshala API
FROM node:20-bookworm-slim

# Prisma needs OpenSSL; ca-certificates lets the server call the AI provider over HTTPS
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install packages first so Docker can reuse this layer when only source code changes
COPY package.json ./
RUN npm install

COPY prisma ./prisma
RUN npx prisma generate

COPY . .

ENV NODE_ENV=production
ENV UPLOAD_DIR=/app/uploads
EXPOSE 4000

# On every start: bring the database tables up to date, then run the API.
# "db push" refuses changes that would delete data, so it is safe to run repeatedly.
# tsx runs the TypeScript directly, so type warnings never block a start (run "npm run typecheck" separately).
CMD ["sh", "-c", "npx prisma db push --skip-generate && npx tsx src/server.ts"]
