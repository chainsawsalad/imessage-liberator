#!/bin/bash

. host/make_host_docker_accessible.sh

# Start the host server the Docker container will communicate with for sending iMessages

pushd host
./server.py ${DOCKER_HOST:=10.200.10.1} ${IMESSAGE_LIBERATOR_PORT:=8999}
popd
