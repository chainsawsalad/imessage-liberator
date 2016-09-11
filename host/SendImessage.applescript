#! /usr/bin/osascript
on run argv
  tell application "Messages"
    send (item 2 of argv) to buddy (item 1 of argv) of (service 1 whose service type is iMessage)
  end tell
end run
