# Twitch Autoban

Logs into your Twitch account and will watch channels for users on the kill-on-sight list. If they are seen, they will be timed out for a desired duration. If they sit their timeout for the full duration, they will be removed from the kill-on-sight list.
 
1. Install node.js
2. `npm install` to install node modules
3. Edit config.json with Twitch name, oauth code, and channels to watch
4. 'node index.js'

Note: you must be moderator in the channels that are specified for this program to be useful