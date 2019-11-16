const config = require('./config');
const backend = require('./backend');

const MAX_TIMEOUT = 1209600;

// Prints a prompt for the client, listing valid commands
function prompt() {
   console.log("Enter input as either:");
   console.log(">   'timeout' [name] [seconds]");
   console.log(">   'remove'  [name]");
   console.log(">   'list'")
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

// Open the input stream and start listening for commands
backend.connect(function() {
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
            backend.addBannedUser(name, duration, duration, config.channel);
            console.log(getFormattedDate() + ": Added " + name + " to the kill-on-sight list for "
                        + duration + " seconds");
         } else {
            console.log("Invalid input. Duration should be seconds between 0 and " + MAX_TIMEOUT);
         }
         
      } else if (command === "remove" && tokens.length === 2) {
         try {
            let name = tokens[1];
            backend.removeBannedUser(name);
            console.log(getFormattedDate() + ": Removed " + name + " from the kill-on-sight list");
         } catch (ex) {
            console.log(ex);
         }
         
      } else if (command === "list") {
         let result = [];
         backend.getBannedUsers().forEach(function(user) {
            result.push(user + ": " + backend.getTimeLeft(user));
         });
         console.log("Haters on the kill-on-sight list / Time left on timeout:");
         console.log(result);
         
      } else {
         console.log("Invalid input.");
         prompt();
      }
   });
});

backend.addChatHandler(function(channel, tags, message) {
   let name = tags.username.toLowerCase().trim();

   if (backend.hasBannedUser(name)) {
      let timeoutDuration = backend.getDuration(name);
      
      // reban them with same duration and reset timeLeft
      backend.addBannedUser(name, timeoutDuration, timeoutDuration, channel); 
      console.log(getFormattedDate() + ": timed out " + name + " again for "
                  + timeoutDuration + " seconds. Their message was \"" + message + "\"");
   }
});