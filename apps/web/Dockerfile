FROM node:24-slim AS builder
RUN npm install -g pnpm@11
WORKDIR /app

COPY . .
RUN --mount=type=cache,target=/pnpm-store pnpm install --store-dir /pnpm-store

ARG VITE_SERVER_URL
ENV VITE_SERVER_URL=${VITE_SERVER_URL}
ENV NODE_ENV=production
RUN cd apps/web && pnpm run build

FROM nginx:alpine AS runner
RUN apk add --no-cache gettext
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf.template /etc/nginx/templates/default.conf.template

ENV PORT=80
EXPOSE 80
# nginx:alpine already runs /docker-entrypoint.d/20-envsubst-on-templates.sh
CMD ["nginx", "-g", "daemon off;"]
