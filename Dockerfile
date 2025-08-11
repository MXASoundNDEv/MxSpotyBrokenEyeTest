# Build multi-stage sécurisé avec image Chainguard (vise 0 vulnérabilité connue)
# Étape deps (récupération dépendances)
FROM cgr.dev/chainguard/node:20-dev AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev && npm cache clean --force
COPY src ./src

# Étape tests (inclut devDependencies)
FROM cgr.dev/chainguard/node:20-dev AS test
WORKDIR /app
ENV NODE_ENV=test
COPY package*.json ./
RUN npm install && npm cache clean --force
COPY src ./src
COPY tests ./tests
# Commande par défaut pour cette étape (utilisée via target test)
CMD ["npm", "test"]

# Étape finale runtime minimal
FROM cgr.dev/chainguard/node:20 AS runner
ENV NODE_ENV=production PORT=3000
WORKDIR /app
# Copier uniquement le nécessaire
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/src ./src
COPY --from=deps /app/package*.json ./
# L'image tourne déjà en user non-root
EXPOSE 3000
CMD ["src/server/index.js"]
