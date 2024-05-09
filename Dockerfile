ARG APP_DIR=/home/node/hsws

FROM node:lts-slim as builder

ARG APP_DIR
WORKDIR ${APP_DIR}

RUN mkdir -p ./node_modules && chown -R node:node ./
RUN npm install -g npm @vercel/ncc

COPY package.json npm-shrinkwrap.json ./

USER node

RUN npm clean-install --ignore-scripts

COPY --chown=node:node . .

RUN npm run build:publish

FROM node:lts-alpine as production

ARG APP_DIR
WORKDIR ${APP_DIR}

ARG GIT_LATEST_TAG
ARG GIT_REV_SHORT

ENV HSWS_VERSION=${GIT_LATEST_TAG}
ENV HSWS_REVISION=${GIT_REV_SHORT}

COPY --from=builder --chown=node:node ${APP_DIR}/bin/entrypoint.sh /usr/bin/
COPY --from=builder --chown=node:node ${APP_DIR}/dist ./

USER node

ENTRYPOINT ["entrypoint.sh"]

CMD ["node", "."]