#!/bin/sh

set -e
set -u

( : $PORT ) 
( : $LOG_LEVEL )
( : $SMART_APP_ID ) 
( : $SMART_APP_CLIENT_ID ) 
( : $SMART_APP_CLIENT_SECRET ) 

exec "$@"