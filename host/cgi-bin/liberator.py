#!/usr/bin/env python

import cgi, subprocess, json

arguments = cgi.FieldStorage()
body = arguments.getvalue('body', '')
messageTo = arguments.getvalue('messageTo', '')

exitCode = subprocess.call(['./SendImessage.applescript', messageTo, body])

print 'Content-Type: application/json'
print ''
print json.dumps({'ok': exitCode == 0, 'body': body, 'messageTo': messageTo})
