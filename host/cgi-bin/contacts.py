#!/usr/bin/env python

import subprocess, json

# TODO: can't guarantee the output is valid JSON, so need to do error checks
output = subprocess.check_output(['./GetContacts.applescript'], stderr=subprocess.STDOUT)

print 'Content-Type: application/json'
print ''
# TODO: make 'ok' actually contingent on quality of output
print json.dumps({'ok': True, 'body': output})
