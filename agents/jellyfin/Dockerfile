FROM node:22-alpine
WORKDIR /app
COPY --chown=node:node collector.mjs ./
USER node
ENTRYPOINT ["node", "collector.mjs"]
