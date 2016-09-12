# iMessage Liberator
Send and receive Apple iMessages with Slack (and maybe other platforms someday).

This project was inspired by the solution for iMessage on Android offered by [PieMessage](https://github.com/bboyairwreck/PieMessage). The goal is to rely on the fleshed out features of existing, cross-platform messaging clients.

## Requirements
* iCloud account
* OS X 10.11+
* [Docker for Mac](https://docs.docker.com/docker-for-mac/) (not Docker Toolbox!)
* A dedicated [Slack](https://slack.com/) team

## Installation and Setup
For this tool to be practical, you will need an always-on installation of Mac OS X 10.11+. Future versions will include support and instructions for use with a Mac OS X virtual machine, but for this guide it will be assumed the installation is on certified Apple hardware.

1. When your operating system is set up, launch `Messages.app` and log into iMessage via your Apple ID.
1. Ensure iCloud Contacts are synced with the OS

   Because iMessage accesses your iCloud Contacts when populating your buddy list, we can't get away with only signing into iMessage via `Messages.app` with your Apple ID. Ensure that your iCloud account is signed in (`System Preferences > iCloud`) and that `Contacts` is being synced. No other iCloud features need to be enabled, and if this is being run on a dedicated server, it is recommended to disable them.

1. Install [Docker for Mac](https://docs.docker.com/docker-for-mac/)
1. Clone this repository onto your machine
1. Open `Terminal.app` and run the installation script

   ```
   imessage-liberator$ ./install.sh
   ```

1. Set the AppleScript handler for `Messages.app` to the newly installed `Liberator.applescript`
   1. Launch `Messages.app` and open `Preferences > General`
   1. At the `AppleScript handler` menu, select `Liberator.applescript`

1. Create a new [Slack](https://slack.com/) team

   * During the team creation process, ensure you select `Skip for now` at the `Send Invitations` step. You will be skipping this step permanently.

   Slack will be the replacement client for iMessage on any platform you'd care to use. You need a dedicated Slack team for this, one that **NO ONE** else has access to. This Slack team should be treated as preciously as your login to iCloud. By the end of this installation, when a buddy iMessages you, you will receive it in a Slack channel dedicated to that buddy. When you respond in the buddy's Slack channel, it will be forwarded along to them via iMessage.

1. Generate a Slack authentication token for your newly created team
   1. Navigate to https://api.slack.com/docs/oauth-test-tokens
   1. Locate the line item for your newly created team on the Test Token Generator table and click the create token button.

      Your authentication token will generate. This is what iMessage Liberator uses to make API calls to Slack on your behalf.

      This token will enable all admin actions on your team via the Slack API, so it is extremely important it is kept **PRIVATE**. Should this key ever be compromised, immediately return to the page and click the re-issue token button.

1. Copy your Slack authentication token and enter the following command into your terminal:
   ```
   export SLACK_OAUTH_TOKEN=<YOUR_SLACK_AUTHENTICATION_TOKEN>
   ```
   Replace `<YOUR_SLACK_AUTHENTICATION_TOKEN>` with your real token.

   This sets the `SLACK_OAUTH_TOKEN` environment variable in this terminal session. You can make it globally available for all future terminal sessions by adding it to your `.bashrc` file or some other method.

1. Run the Docker container installation:
   ```
   imessage-liberator$ docker-compose build
   imessage-liberator$ docker-compose up
   ```

1. Open another terminal window and start the host messaging server:
   ```
   imessage-liberator$ ./start_servers.sh
   ```

You are now up and running.


## Debugging
If something is going wrong with your installation, it can be difficult to debug due to the number of moving parts.

### Check Messages.app AppleScript Handler Logging in Console.app
The AppleScript handler set in Messages.app logs messages to `~/Library/logs/iMessageLiberator.log`. Open `Console.app` and view that file to see if anything is going wrong. If the log file is missing, it means the `Messages.app` iMessage AppleScript handler was not selected properly.

### Verify sending iMessages via HTTP works
When the Docker container receives a Slack message sent by you, it looks up which buddy it should be forwarded to and then notifies the host server, which sends the iMessage via AppleScript. You can test that the host-side of this chain is working by entering into your browser:
```
http://10.200.10.1:8999/cgi-bin/liberator.py?body=success&senderHandle=<IMESSAGE_BUDDY_HANDLE>
```
Replace `<IMESSAGE_BUDDY_HANDLE>` with a buddy iMessage handle, probably best to use your own, e.g. `you@your.apple.id.com`.

If you changed the IP address or port from the defaults, replace them in the example above as well.

If all is well, this will result in an iMessage being sent to `<IMESSAGE_BUDDY_HANDLE>`.