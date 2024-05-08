ARG APP_DIR=/home/node/hsws

FROM node:lts-slim as builder

ARG APP_DIR
WORKDIR ${APP_DIR}

RUN mkdir -p ./node_modules && chown -R node:node ./
RUN npm install -g @vercel/ncc

COPY package.json npm-shrinkwrap.json ./

USER node

RUN npm clean-install

COPY --chown=node:node . .

RUN ncc build src/index.ts -msC --target es2022 -o dist

FROM node:lts-alpine

LABEL org.opencontainers.image.url="https://github.com/duddu/homebridge-smartthings-webhook-server"
LABEL org.opencontainers.image.title="Homebridge SmartThings Webhook Server"
LABEL org.opencontainers.image.licenses="MPL-2.0"
LABEL org.opencontainers.image.authors="duddu"

ARG APP_DIR
WORKDIR ${APP_DIR}

USER node

COPY --from=builder --chown=node:node ${APP_DIR}/dist ./

CMD ["node", "index.js"]