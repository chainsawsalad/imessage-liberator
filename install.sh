#!/bin/bash

# Install the needed scripts and configurations on the host system

# tell the system $PATH where iMessage Liberator is via `path_helper`
sudo sh -c 'echo `pwd` > /etc/paths.d/imessage_liberator'

# install the AppleScript iMessage handler
cp Liberator.applescript ~/Library/Application\ Scripts/com.apple.iChat

. host/make_host_docker_accessible.sh

echo -e "System configuration installed.\nTo comlpete installation select the newly installed AppleScript handler:"
echo -e "\tMessages.app > Preferences > General > AppleScript handler > Liberator.applescript"
