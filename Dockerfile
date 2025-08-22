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

# Étape 1b : Dépendances de développement (pour le stage dev)
FROM base AS dev-deps
COPY package*.json ./
RUN npm ci && \
    npm cache clean --force

# Étape dev : Image de développement avec hot-reload
FROM base AS dev
ENV NODE_ENV=development
ENV PORT=3000
ENV HOST=0.0.0.0
ENV METRICS_PORT=9100

WORKDIR /app

# Copier toutes les dépendances (dev + prod)
COPY --from=dev-deps /app/node_modules ./node_modules

# Le code sera monté via volume bind, pas besoin de COPY ici
# Créer les répertoires nécessaires  
RUN mkdir -p /app/logs /app/src /app/tests && \
    chown blindtest:nodejs /app/logs

# Changer vers l'utilisateur non-root
USER blindtest

# Health check pour dev
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider --timeout=5 --header="x-health-check: true" http://localhost:3000/health || exit 1

EXPOSE 3000 9100

# Point d'entrée pour le développement
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["npm", "run", "dev"]

# Étape 2 : Image finale optimisée
FROM base AS runner

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV METRICS_PORT=9100

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

# Health check optimisé pour Podman avec header anti-redirection HTTPS
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider --timeout=5 --header="x-health-check: true" http://localhost:3000/health || exit 1

EXPOSE 3000 9100

# Utiliser tini comme init système pour une gestion propre des signaux
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/server/index.js"]
