#!/bin/bash

# Called by iMessage's AppleScript handler for every incomping iMessage
# Sends the message to the Docker container

curl -X POST \
  -H "Cache-Control: no-cache" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "body=$1" \
  -d "senderImessageId=$2" \
  -d "senderHandle=$3" \
  -d "senderName=$4" \
  -d "senderImage=$5" \
  "http://127.0.0.1/message/receive"
