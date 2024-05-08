ARG APP_DIR=/home/node/hsws

FROM node:lts-slim as builder

ARG APP_DIR
WORKDIR ${APP_DIR}

RUN mkdir -p ./node_modules && chown -R node:node ./
RUN npm install -g npm @vercel/ncc

COPY package.json npm-shrinkwrap.json ./

USER node

RUN npm clean-install

COPY --chown=node:node . .

RUN npm run lint
RUN npm run build:ci

FROM node:lts-alpine

ARG APP_DIR
WORKDIR ${APP_DIR}

COPY --from=builder --chown=node:node ${APP_DIR}/bin/entrypoint.sh /usr/bin/
COPY --from=builder --chown=node:node ${APP_DIR}/dist ./

USER node

ENTRYPOINT ["entrypoint.sh"]

CMD ["node", "."]