ARG APP_DIR=/home/node/hsws

FROM node:lts-slim as builder

ARG APP_DIR
WORKDIR ${APP_DIR}

RUN mkdir -p ./node_modules && chown -R node:node ./
RUN npm install -g npm @vercel/ncc

COPY package.json npm-shrinkwrap.json ./

USER node

RUN npm clean-install && npm audit signatures

COPY --chown=node:node . .

RUN npm run lint
RUN npm run build:ci

FROM node:lts-alpine as production

ARG APP_DIR
WORKDIR ${APP_DIR}

ARG NPM_VERSION
ARG NPM_DISPLAY_NAME

LABEL org.opencontainers.image.version ${NPM_VERSION}
LABEL org.opencontainers.image.description "${NPM_DISPLAY_NAME} (v${NPM_VERSION})"

ENV HSWS_VERSION=${NPM_VERSION}

COPY --from=builder --chown=node:node ${APP_DIR}/bin/entrypoint.sh /usr/bin/
COPY --from=builder --chown=node:node ${APP_DIR}/dist ./

USER node

ENTRYPOINT ["entrypoint.sh"]

CMD ["node", "."]