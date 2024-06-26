#!/bin/sh

set -e
set -u

( : "$TZ" )
( : "$NODE_ENV" )
( : "$HSWS_PORT" )
( : "$HSWS_VERSION" )
( : "$HSWS_REVISION" )
( : "$HSWS_LOG_LEVEL" )
( : "$HSWS_REDIS_HOST" )
( : "$HSWS_REDIS_PORT" )
( : "$HSWS_REDIS_PASSWORD" )
( : "$STSA_SMART_APP_ID" )
( : "$STSA_SMART_APP_CLIENT_ID" )
( : "$STSA_SMART_APP_CLIENT_SECRET" )

exec "$@"