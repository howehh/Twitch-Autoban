const tmi = require('tmi.js');
const config = require('./config');
const Gists = require("gists");
const axios = require('axios');

const bannedUsers = {}; // { name : { "duration" : x, "timeout": y, "unbanTime": z } }
const permaBannedUsers = [];
const chatHandlers = [];

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
	channels: [config.channel]
});

// Add a permabanned user to the list. 
function addPermaBannedUser(name, channel) {
   name = name.toLowerCase();
   if (hasBannedUser(name)) {
      removeBannedUser(name);
   }
   if (!hasPermaBannedUser(name)) {
      permaBannedUsers.push(name);
   }
   client.say(channel, "/ban " + name);
   return true;
}

// Add a timed out person to the kos list and times them out for the given duration
// original duration = the time they will be rebanned for
// timeout duration = the time that they will be timed out with currently
// Returns false if unable to add user, true otherwise
function addBannedUser(name, originalDuration, timeoutDuration, channel) {
   name = name.toLowerCase();
   if (hasPermaBannedUser(name)) {
      return false;
   }
   if (name in bannedUsers) {
      let timeout = bannedUsers[name]["timeout"];
      clearTimeout(timeout);
   } else {
      bannedUsers[name] = {};
   }
   
   client.say(channel, "/unban " + name);
   setTimeout(() => {
      client.say(channel, "/timeout " + name + " " + timeoutDuration)
   }, 3000);
   
   bannedUsers[name]["duration"] = originalDuration;
   bannedUsers[name]["unbanTime"] = Date.now() + (timeoutDuration * 1000);
   
   bannedUsers[name]["timeout"] = setTimeout(() => {
      removeBannedUser(name);
   }, timeoutDuration * 1000);
   return true;
}

// Remove the given name from the kill-on-sight list. Returns true if
// they were in the list and are now removed.
function removeBannedUser(name) {
   name = name.toLowerCase();
   if (name in bannedUsers) {
      clearTimeout(bannedUsers[name]["timeout"]);
      delete bannedUsers[name];
      return true;
   } else if (hasPermaBannedUser(name)) {
      let index = permaBannedUsers.indexOf(name);
      permaBannedUsers.splice(index, 1);
      return true;
   }
   return false;
}

function hasBannedUser(name) {
   return name.toLowerCase() in bannedUsers;
}

function hasPermaBannedUser(name) {
   return permaBannedUsers.indexOf(name.toLowerCase()) !== -1;
}

function getBannedUsers() {
   return Object.keys(bannedUsers);
}

function getPermaBannedUsers() {
   return permaBannedUsers.slice(0);
}

function getDuration(user) {
   user = user.toLowerCase();
   if (user in bannedUsers) {
      return bannedUsers[user]["duration"];
   }
   throw new Error("User is not on the kill-on-sight list");
}

function getTimeLeft(user) {
   user = user.toLowerCase();
   if (user in bannedUsers) {
      return Math.round((bannedUsers[user]["unbanTime"] - Date.now()) / 1000); 
   }
   throw new Error("User is not on the kill-on-sight list");
}

module.exports = {
   connect: function(callback) {
      client.connect();

      client.on("connected", (address, port) => {
         
         axios.get("https://api.github.com/gists/" + config.gist.fileID)
         .then(function(response) {
            let json = JSON.parse(response.data.files.banned.content);
            for (let i = 0; i < json.timedOut.length; i++) {
               let user = json.timedOut[i];
               addBannedUser(user.name, user.duration, 
                             user.timeLeft, config.channel);
            }
            for (let i = 0; i < json.permaBanned.length; i++) {
               addPermaBannedUser(json.permaBanned[i].name, config.channel);
            }
         });
         
         callback();
      });
      
      client.on('chat', (channel, tags, message, self) => {
         if (self) return;
         chatHandlers.forEach(func => func(channel, tags, message));
      });
   },
   
   addChatHandler: function(func) {
      chatHandlers.push(func);
   },
   
   addBannedUser: addBannedUser,
   addPermaBannedUser: addPermaBannedUser,
   
   removeBannedUser: removeBannedUser,
   
   hasBannedUser: hasBannedUser,
   hasPermaBannedUser: hasPermaBannedUser,
   
   getBannedUsers: getBannedUsers,
   getPermaBannedUsers: getPermaBannedUsers,
   
   getDuration: getDuration,
   getTimeLeft: getTimeLeft
}

function getJsonString() {
   const data = {
      "timedOut": [],
      "permaBanned": []
   }
   let bannedArr = getBannedUsers();
   for (let i = 0; i < bannedArr.length; i++) {
      let currUser = bannedArr[i];
      data.timedOut.push({
         "name": bannedArr[i],
         "duration": getDuration(bannedArr[i]),
         "timeLeft": getTimeLeft(bannedArr[i])
      });
   }         
   for (let i = 0; i < permaBannedUsers.length; i++) {
      data.permaBanned.push({"name": permaBannedUsers[i]});        
   }
   return JSON.stringify(data);
}

['SIGINT', 'SIGHUP', 'SIGTERM'].forEach(signal => process.on(signal, saveGist));

process.on('uncaughtException', e => {
   console.log(e.stack);
   console.log();
   saveGist();
});

function saveGist() {
   console.log("\nSaving banned users and their remaining time to gist...");
   const gists = new Gists({
      username: config.gist.username,
      password: config.gist.password
   });
   const options = {
      "files": {
         "banned": {
            "content": getJsonString()
         }
      }
   }

   gists.edit(config.gist.fileID, options).then(() => {
      console.log("Save successful");
      process.exit(0);
   });
}