# Multi-stage build pour optimiser la taille de l'image
FROM node:20-alpine AS base

# Installer les outils système nécessaires
RUN apk add --no-cache \
    wget \
    curl \
    tini

# Créer l'utilisateur non-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S blindtest -u 1001

WORKDIR /app

# Étape 1 : Installation des dépendances
FROM base AS deps
COPY package*.json ./
RUN npm ci --omit=dev --production && \
    npm cache clean --force

# Étape 2 : Image finale optimisée
FROM base AS runner

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

WORKDIR /app

# Copier les dépendances depuis l'étape précédente
COPY --from=deps /app/node_modules ./node_modules

# Copier le code source avec les bonnes permissions
COPY --chown=blindtest:nodejs . .

# Créer les répertoires nécessaires
RUN mkdir -p /app/logs && \
    chown blindtest:nodejs /app/logs

# Changer vers l'utilisateur non-root
USER blindtest

# Health check intégré
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

EXPOSE 3000

# Utiliser tini comme init système pour une gestion propre des signaux
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/server/index.js"]
