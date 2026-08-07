# Use Node image to build the app
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package files and lockfile
COPY package.json package-lock.json ./

# Copy package.json of workspaces to install dependencies correctly
COPY shared/package.json ./shared/
COPY apps/web/package.json ./apps/web/
COPY apps/mobile/package.json ./apps/mobile/

# Install dependencies for workspaces
RUN npm ci

# Copy source code files
COPY shared ./shared
COPY apps/web ./apps/web

# Build the web app
WORKDIR /app/apps/web
# Supply build-time environment variables
ENV VITE_API_BASE_URL=http://localhost:8000
RUN npm run build

# Use Nginx to serve static files
FROM nginx:alpine

# Copy built assets
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

# Copy nginx config
COPY docker/nginx/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
