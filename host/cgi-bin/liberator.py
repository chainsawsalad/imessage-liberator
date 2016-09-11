#!/usr/bin/env python
import cgi, subprocess, json

arguments = cgi.FieldStorage()
body = arguments.getvalue('body', '')
senderHandle = arguments.getvalue('senderHandle', '')

exitCode = subprocess.call(['./SendImessage.applescript', senderHandle, body])

print 'Content-Type: application/json'
print ''
print json.dumps({'ok': exitCode == 0})
