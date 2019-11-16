const tmi = require('tmi.js');
const config = require('./config');
const Gists = require("gists");
const axios = require('axios');

const bannedUsers = {}; // { name : { "duration" : x, "timeout": y, "unbanTime": z } }
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

function addBannedUser(name, originalDuration, timeoutDuration, channel) {
   name = name.toLowerCase();
   if (name in bannedUsers) {
      let timeout = bannedUsers[name]["timeout"];
      clearTimeout(timeout);
   } else {
      bannedUsers[name] = {};
   }
   
   client.say(channel, "/unban " + name);
   client.say(channel, "/timeout " + name + " " + timeoutDuration);
   
   bannedUsers[name]["duration"] = originalDuration;
   bannedUsers[name]["unbanTime"] = Date.now() + (timeoutDuration * 1000);
   
   bannedUsers[name]["timeout"] = setTimeout(() => {
      removeBannedUser(name);
   }, timeoutDuration * 1000);
}

// Remove the given name from the kill-on-sight list if they are in it.
function removeBannedUser(name) {
   if (name in bannedUsers) {
      clearTimeout(bannedUsers[name]["timeout"]);
      delete bannedUsers[name];
   } else {
      throw "User is not on the kill-on-sight list";
   }
}

function hasBannedUser(name) {
   return name.toLowerCase() in bannedUsers;
}

function getBannedUsers() {
   return Object.keys(bannedUsers);
}

function getDuration(user) {
   user = user.toLowerCase();
   if (user in bannedUsers) {
      return bannedUsers[user]["duration"];
   }
   throw "User is not on the kill-on-sight list";
}

function getTimeLeft(user) {
   user = user.toLowerCase();
   if (user in bannedUsers) {
      return Math.round((bannedUsers[user]["unbanTime"] - Date.now()) / 1000); 
   }
   throw "User is not on the kill-on-sight list";
}

module.exports = {
   connect: function(callback) {
      client.connect();

      client.on("connected", (address, port) => {
         
         axios.get("https://api.github.com/gists/" + config.gist.fileID)
         .then(function(response) {
            let json = JSON.parse(response.data.files.banned.content);
            for (let i = 0; i < json.users.length; i++) {
               addBannedUser(json.users[i].name, json.users[i].duration, 
                             json.users[i].timeLeft, config.channel);
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
   removeBannedUser: removeBannedUser,
   hasBannedUser: hasBannedUser,
   getBannedUsers: getBannedUsers,
   getDuration: getDuration,
   getTimeLeft: getTimeLeft
}

function getJsonString() {
   let content = "{\"users\": [";
   const bannedArr = getBannedUsers();
   if (bannedArr.length > 0) {
      content += "{\"name\": \"" + bannedArr[0] + "\", \"duration\": " + getDuration(bannedArr[0]) +
                 ", \"timeLeft\":" + getTimeLeft(bannedArr[0]) + "}";
      for (let i = 1; i < bannedArr.length; i++) {
         let currUser = bannedArr[i];
         content += ", {\"name\": \"" + bannedArr[i] + "\", \"duration\": " + getDuration(bannedArr[i]) +
                    ", \"timeLeft\":" + getTimeLeft(bannedArr[i]) + "}";
      }         
   }
   content += "]}";
   return content;
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