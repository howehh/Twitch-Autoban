const tmi = require('tmi.js');
const config = require('./config');

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
	channels: config.channels
});


module.exports = {
   connect: function(callback) {
      client.connect();

      client.on("connected", (address, port) => {
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
   
   addBannedUser: function(name, duration, channel) {
      name = name.toLowerCase();
      if (name in bannedUsers) {
         let timeout = bannedUsers[name]["timeout"];
         clearTimeout(timeout);
      } else {
         bannedUsers[name] = {};
      }
      
      client.say(channel, "/unban " + name);
      client.say(channel, "/timeout " + name + " " + duration);
      
      bannedUsers[name]["duration"] = duration;
      bannedUsers[name]["unbanTime"] = Date.now() + (duration * 1000);
      
      bannedUsers[name]["timeout"] = setTimeout(() => {
         this.removeBannedUser(name);
      }, duration * 1000);
   },
   
   // Remove the given name from the kill-on-sight list if they are in it.
   removeBannedUser: function(name) {
      if (name in bannedUsers) {
         clearTimeout(bannedUsers[name]["timeout"]);
         delete bannedUsers[name];
      } else {
         throw "User is not on the kill-on-sight list";
      }
   },
   
   hasBannedUser: function(name) {
      return name in bannedUsers;
   },
   
   getBannedUsers: function() {
      return Object.keys(bannedUsers);
   },
   
   getDuration: function(user) {
      if (user in bannedUsers) {
         return bannedUsers[user]["duration"];
      }
      throw "User is not on the kill-on-sight list";
   },
   
   getTimeLeft: function(user) {
      if (user in bannedUsers) {
         return Math.round((bannedUsers[user]["unbanTime"] - Date.now()) / 1000); 
      }
      throw "User is not on the kill-on-sight list";
   }
}