#!/usr/bin/env python

from os.path import expanduser
from time import sleep
import cgi, subprocess, json, sys, os

messagesDbPath = '%s/Library/Messages/chat.db' % expanduser('~')

arguments = cgi.FieldStorage()
body = arguments.getvalue('body', '')
messageTo = arguments.getvalue('messageTo', '')
payload = {'body': body, 'messageTo': messageTo}

sendExitCode = subprocess.call(['./SendImessage.applescript', messageTo, body])

verificationError = None

# monitor send status of message
if sendExitCode == 0:
  iterations = 0
  whereClause = 'handle.id = "%s" AND message.text = "%s"' % (messageTo, body)
  query = 'SELECT message.ROWID, message.error, message.is_delivered, datetime(message.date + 978307200, "unixepoch", "localtime") FROM message JOIN handle ON message.handle_id = handle.ROWID WHERE %s ORDER BY message.date DESC LIMIT 1'
  chatId = None
  while iterations < 5:
    if chatId is not None:
      builtQuery = query % ('message.ROWID = %s' % chatId)
    else:
      builtQuery = query % whereClause
    #builtQuery = 'select * from message limit 1'
    try:
      output = subprocess.check_output(['sqlite3', messagesDbPath, builtQuery], stderr=subprocess.STDOUT)
      #print >> sys.stderr, builtQuery
      #print >> sys.stderr, output
    except subprocess.CalledProcessError as e:
      print >> sys.stderr, e.output
      verificationError = e.output
      break

    if output:
      chatId, verificationError, isDelivered, date = output.split('|')

      verificationError = int(verificationError)
      if int(isDelivered) == 1 or verificationError != 0:
        break
    iterations += 1
    sleep(1)

payload['ok'] = sendExitCode == 0 and verificationError == 0
if payload['ok'] is False:
  if verificationError == 22:
    payload['error'] = 'invalid handle'
  elif sendExitCode != 0:
    payload['error'] = 'message not sent'
  else:
    payload['error'] = 'imessage error `%d`' % verificationError

print 'Content-Type: application/json'
print ''
print json.dumps(payload)
