# ============================================
# AFS System Documentation Site
# Docusaurus Static Site Generator
# ============================================

# ============================================
# Builder Stage
# ============================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the static site
RUN npm run build

# ============================================
# Production Stage (using node + serve)
# Avoids nginx image pull issues in China
# ============================================
FROM node:20-alpine AS production

WORKDIR /app

# Install serve globally for static file hosting
RUN npm install -g serve

# Copy built static files from builder
COPY --from=builder /app/build /app/build

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:80/ || exit 1

# Start serve
CMD ["serve", "-s", "build", "-l", "80"]
