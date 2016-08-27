#!/bin/bash

# tell the system $PATH where iMessage Liberator is via `path_helper`
sudo sh -c 'echo `pwd` > /etc/paths.d/imessage_liberator'

# install the AppleScript iMessage handler
cp *.applescript ~/Library/Application\ Scripts/com.apple.iChat

echo -e "System configuration installed.\nTo comlpete installation select the newly installed AppleScript handler:"
echo -e "\tMessages.app > Preferences > General > AppleScript handler > Liberator.applescript"
