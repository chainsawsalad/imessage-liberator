#!/bin/bash

# In the Docker container, start the Node.js server

date=$(date +"%Y-%m-%d_%T")

if [ "$NODE_ENV" == "production" ]; then
    forever stopall
    forever start --sourceDir /home/ubuntu/iwannasee -l output-$date.log -o stdout-$date.log -e error-$date.log server.js
    forever list
    exit 0;
fi

nodemon -V -I --watch include --watch server.js --debug server.js
