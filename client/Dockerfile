# GV Pathshala web app: build the React client, then serve it with Caddy
FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
# vite build only: type checking runs in CI and with "npm run typecheck"
RUN npx vite build

FROM caddy:2-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv

# If DOMAIN is empty or missing, serve plain HTTP on port 80
CMD ["sh", "-c", "export DOMAIN=\"${DOMAIN:-:80}\"; exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile"]
