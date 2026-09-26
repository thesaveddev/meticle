FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY apps/web/package*.json ./apps/web/
COPY packages/shared/package*.json ./packages/shared/
RUN npm install
COPY . .
ARG VITE_PUBLIC_SITE_URL=https://meticlecare.com
ARG VITE_STRIPE_PUBLISHABLE_KEY
ENV VITE_PUBLIC_SITE_URL=$VITE_PUBLIC_SITE_URL
ENV VITE_STRIPE_PUBLISHABLE_KEY=$VITE_STRIPE_PUBLISHABLE_KEY
RUN npm run build --workspace=@meticle/shared
RUN npm run build --workspace=@meticle/web

FROM nginx:alpine
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
# Included by nginx.conf in the server block and in every location that declares
# its own add_header. See security-headers.conf for why.
COPY apps/web/security-headers.conf /etc/nginx/snippets/security-headers.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
