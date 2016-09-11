#!/bin/bash

# Uninstall the iMessage Liberator scripts and configurations from the host system

sudo rm -f /etc/paths.d/imessage_liberator

rm -f ~/Library/Application\ Scripts/com.apple.iChat/Liberator.applescript

sudo ifconfig lo0 inet "$lo0_alias/24" -alias

echo -e "System configuration uninstalled."
