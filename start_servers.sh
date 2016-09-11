#!/bin/bash

pushd host
./server.py ${DOCKER_HOST:=10.200.10.1} ${IMESSAGE_LIBERATOR_PORT:=8999}
popd
