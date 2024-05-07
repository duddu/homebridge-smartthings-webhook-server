ARG APP_DIR=/home/node/server

FROM node:lts-slim as builder
ARG APP_DIR
WORKDIR ${APP_DIR}

RUN mkdir -p ./node_modules && chown -R node:node ./

COPY package.json npm-shrinkwrap.json ./

USER node

RUN npm clean-install

COPY --chown=node:node . .

RUN npm run lint && npm run build

FROM node:lts-alpine as production
ARG APP_DIR
WORKDIR ${APP_DIR}

RUN mkdir -p ./node_modules && chown -R node:node ./

COPY --from=builder --chown=node:node ${APP_DIR}/package.json ${APP_DIR}/npm-shrinkwrap.json ./

USER node

RUN npm clean-install --omit=dev --omit=optional && rm npm-shrinkwrap.json

COPY --from=builder --chown=node:node ${APP_DIR}/dist ./dist

EXPOSE 10000

CMD ["npm", "start"]

LABEL org.opencontainers.image.authors="Davide Doronzo"
LABEL org.opencontainers.image.url="https://github.com/duddu/homebridge-smartthings-webhook-server"
LABEL org.opencontainers.image.vendor="duddu"
LABEL org.opencontainers.image.licenses="MPL-2.0"
LABEL org.opencontainers.image.title="Homebridge SmartThings Webhook Server"