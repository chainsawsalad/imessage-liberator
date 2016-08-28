#!/bin/bash

curl -X POST \
  -H "Cache-Control: no-cache" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "body=$1" \
  -d "sender=$2" \
  -d "senderImage=$3" \
  "http://127.0.0.1/message/receive"