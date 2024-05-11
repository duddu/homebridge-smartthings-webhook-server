#!/bin/sh

set -e
set -u

( : $TZ )
( : $NODE_ENV )
( : $HSWS_PORT )
( : $HSWS_VERSION )
( : $HSWS_REVISION )
( : $HSWS_LOG_LEVEL )
( : $STSA_SMART_APP_ID )
( : $STSA_SMART_APP_CLIENT_ID )
( : $STSA_SMART_APP_CLIENT_SECRET )

exec "$@"