# IdeaPulse — production image
# Node 22.5+ is required for the built-in node:sqlite module.
FROM node:22-alpine

WORKDIR /app

# Install dependencies first (better layer caching).
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --no-audit --no-fund

# Copy the application.
COPY src ./src
COPY public ./public
COPY tests ./tests

ENV NODE_ENV=production
ENV DATA_DIR=/app/data

# Persist the SQLite database here.
VOLUME ["/app/data"]

EXPOSE 3000

CMD ["node", "src/server.js"]
