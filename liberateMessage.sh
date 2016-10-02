#!/bin/bash

# Called by iMessage's AppleScript handler for every incomping iMessage
# Sends the message to the Docker container

curl -X POST \
  -H "Cache-Control: no-cache" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "body=$1" \
  --data-urlencode "senderImessageId=$2" \
  --data-urlencode "senderHandle=$3" \
  --data-urlencode "senderName=$4" \
  --data-urlencode "senderImage=$5" \
  "http://127.0.0.1/message/receive"
