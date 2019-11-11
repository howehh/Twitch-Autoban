const tmi = require('tmi.js');
const config = require('./config');

// Object of banned users - maps a name to their duration and timeout object 
//
// bannedUsers = {
//    name: {
//       duration: <x seconds>,
//       timeout: <timeoutObject>
//    }
// }
const bannedUsers = {};

// The max number of seconds a user can be banned for. This is
// defined by Twitch - DON'T CHANGE
const MAX_TIMEOUT = 1209600;

// Add the given name to kill-on-sight list. After the given duration,
// they will be removed from it.
function addBannedUser(name, duration) {
   name = name.toLowerCase();
   if (name in bannedUsers) {
      let timeout = bannedUsers[name]["timeout"];
      clearTimeout(timeout);
   } else {
      bannedUsers[name] = {};
   }
   
   bannedUsers[name]["duration"] = duration;
   
   bannedUsers[name]["timeout"] = setTimeout(() => {
      removeBannedUser(name);
   }, duration * 1000);
   
   console.log(getFormattedDate() + ": Added " + name + " to the kill-on-sight list for "
               + duration + " seconds");
}

// Remove the given name from the kill-on-sight list if they are in it.
function removeBannedUser(name) {
   if (name in bannedUsers) {
      clearTimeout(bannedUsers[name]["timeout"]);
      delete bannedUsers[name];
      console.log(getFormattedDate() + ": Removed " + name + " from the kill-on-sight list");
   } else {
      console.log(name + " is not on the kill-on-sight list");
   }
}

// Returns a formatted date for timestamp purposes.
function getFormattedDate() {
   let date = new Date();
   let minutes = (date.getMinutes() < 10) ? "0" + date.getMinutes() : date.getMinutes();
   let seconds = (date.getSeconds() < 10) ? "0" + date.getSeconds() : date.getSeconds();
   let str = "[" + (date.getMonth() + 1) + "-" + date.getDate() + "-" + date.getFullYear() +
         " " +  date.getHours() + ":" + minutes + ":" + seconds + "]";

   return str;
}

// Prints a prompt for the client, listing valid commands
function prompt() {
   console.log("Enter input as either:");
   console.log(">   'timeout' [name] [seconds]");
   console.log(">   'remove'  [name]");
   console.log(">   'list'")
}

// Open the input stream and start listening for commands
function listenForCommands() {
   let stdin = process.openStdin();

   console.log("Bonjour!");
   prompt();
   stdin.addListener("data", function(d) {
      d = d.toString().trim().toLowerCase();
      
      const tokens = d.split(/\s+/);
      let command = tokens[0];
      
      if (command === "timeout" && tokens.length === 3) {
         let name = tokens[1];
         let duration = parseInt(tokens[2]);
         if (Number.isInteger(duration) && duration > 0 && duration <= MAX_TIMEOUT) {
            addBannedUser(name, duration);
         } else {
            console.log("Invalid input. Duration should be seconds between 0 and " + MAX_TIMEOUT);
         }
         
      } else if (command === "remove" && tokens.length === 2) {
         let name = tokens[1];
         removeBannedUser(name);
         
      } else if (command === "list") {
         let bannedList = Object.keys(bannedUsers);
         let result = [];
         for (let i = 0; i < bannedList.length; i++) {
            let user = bannedList[i];
            result.push(user + ": " + bannedUsers[user]["duration"]);
         }
         console.log("Haters on the kill-on-sight list:");
         console.log(result);
         
      } else {
         console.log("Invalid input.");
         prompt();
      }
   });
}

// Connect to the channels listed under config.json with the credentials
// under config.json
const client = new tmi.Client({
	options: { debug: false },
	connection: {
		secure: true,
		reconnect: true
	},
	identity: {
		username: config.username,
		password: config.password
	},
	channels: config.channels
});

client.connect();

client.on("connected", (address, port) => {
   listenForCommands();
});

// If a user in bannedUsers types, they are timed out for their
// respective duration.
client.on('chat', (channel, tags, message, self) => {
	if (self) return;
   
   let name = tags.username.toLowerCase().trim();

	if (name in bannedUsers) {
      let timeoutDuration = bannedUsers[name]["duration"];
      
		client.say(channel, "/timeout " + name + " " + timeoutDuration);
      addBannedUser(name, timeoutDuration); // reban them with the same duration
	}
});