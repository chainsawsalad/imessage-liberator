#!/bin/bash

# allows Docker containers to access host
# see "I want to connect from a container to a service on the host" https://docs.docker.com/docker-for-mac/networking/
# TODO: clean up with `sudo ifconfig lo0 inet "$lo0_alias/24" -alias`
lo0_alias=${DOCKER_HOST:=10.200.10.1}
sudo ifconfig lo0 alias "$lo0_alias/24"
ifconfig lo0