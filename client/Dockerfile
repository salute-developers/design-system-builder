# Build stage
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Accept build arguments for Vite env vars
ARG VITE_PROXY_SERVER_URL
ARG DS_GENERATOR_API
ARG DS_DOCUMENTATION_GENERATOR_API

ENV VITE_PROXY_SERVER_URL=$VITE_PROXY_SERVER_URL
ENV DS_DOCUMENTATION_GENERATOR_API=$DS_DOCUMENTATION_GENERATOR_API
ENV DS_GENERATOR_API=$DS_GENERATOR_API

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine AS production

# Install curl for health checks
RUN apk add --no-cache curl

# Create nginx config
RUN echo 'server { listen 80; location / { root /usr/share/nginx/html; index index.html; try_files $uri $uri/ /index.html; } }' > /etc/nginx/conf.d/default.conf

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
