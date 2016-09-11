#!/usr/bin/env python

import sys, BaseHTTPServer, CGIHTTPServer

host = sys.argv[1]
port = int(sys.argv[2])

BaseHTTPServer.HTTPServer((host, port), CGIHTTPServer.CGIHTTPRequestHandler).serve_forever()
