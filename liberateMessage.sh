#!/bin/bash

curl -X POST \
  -H "Cache-Control: no-cache" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "body=$1" \
  -d "senderHandle=$2" \
  -d "senderName=$3" \
  -d "senderImage=$4" \
  "http://127.0.0.1/message/receive"
