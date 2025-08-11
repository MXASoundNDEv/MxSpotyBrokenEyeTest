# Étape 1 : Install deps
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .

# Étape 2 : Image finale
FROM node:20-alpine AS runner
ENV NODE_ENV=production
ENV PORT=3000
WORKDIR /app
COPY --from=deps /app ./
EXPOSE 3000

# Démarre ton serveur
CMD ["node", "src/server/index.js"]
