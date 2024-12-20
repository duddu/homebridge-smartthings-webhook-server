ARG APP_DIR=/home/node/hsws

FROM node:lts AS builder

ARG APP_DIR
WORKDIR ${APP_DIR}

RUN mkdir -p ./node_modules && chown -R node:node ./
RUN npm install -g npm @vercel/ncc

COPY package.json npm-shrinkwrap.json ./

USER node

RUN npm clean-install && npm audit signatures

COPY --chown=node:node . .

RUN npm run build:ncc

FROM node:lts-alpine AS production

ARG APP_DIR
WORKDIR ${APP_DIR}

ARG GIT_REF
ARG GIT_SHA

ENV HSWS_VERSION=${GIT_REF}
ENV HSWS_REVISION=${GIT_SHA}

COPY --from=builder --chown=node:node ${APP_DIR}/bin/entrypoint.sh /usr/bin/
COPY --from=builder --chown=node:node ${APP_DIR}/dist ${APP_DIR}/LICENSE ./

USER node

ENTRYPOINT ["entrypoint.sh"]

CMD ["node", "."]
