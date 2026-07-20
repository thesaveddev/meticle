FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/shared/package*.json ./packages/shared/
RUN npm ci
COPY . .
RUN npm run build --workspace=@caredesk/api --workspace=@caredesk/shared

FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache tini
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/apps/api/package*.json ./apps/api/
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/node_modules ./node_modules
RUN mkdir -p uploads
EXPOSE 3002
ENTRYPOINT ["tini", "--"]
CMD ["node", "apps/api/dist/index.js"]
