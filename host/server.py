#!/usr/bin/env python

import sys, BaseHTTPServer, CGIHTTPServer

host = sys.argv[1]
port = int(sys.argv[2])

print "iMessage Sender running.\n\tVisit http://%s:%d/cgi-bin/contacts.py to test." % (host, port)

BaseHTTPServer.HTTPServer((host, port), CGIHTTPServer.CGIHTTPRequestHandler).serve_forever()
