FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY src/ ./src/

# All agency ports
EXPOSE 8000 8080 8090 8095 8101 8110 8120 8130 8140 8150

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:8000/health || exit 1

CMD ["node", "src/index.js"]
