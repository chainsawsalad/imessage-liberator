#!/bin/bash

# Install the needed scripts and configurations on the host system

# tell the system $PATH where iMessage Liberator is via `path_helper`
sudo sh -c 'echo `pwd` > /etc/paths.d/imessage_liberator'

# install the AppleScript iMessage handler
cp Liberator.applescript ~/Library/Application\ Scripts/com.apple.iChat

# allows Docker containers to access host
# see "I want to connect from a container to a service on the host" https://docs.docker.com/docker-for-mac/networking/
# TODO: clean up with `sudo ifconfig lo0 inet "$lo0_alias/24" -alias`
lo0_alias=${DOCKER_HOST:=10.200.10.1}
sudo ifconfig lo0 alias "$lo0_alias/24"

echo -e "System configuration installed.\nTo comlpete installation select the newly installed AppleScript handler:"
echo -e "\tMessages.app > Preferences > General > AppleScript handler > Liberator.applescript"
