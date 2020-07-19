var Discord = require('discord.js');
var logger = require('winston');
var fs = require('fs');
var auth = require('./auth.json');


// Global Constants
const CHANNEL_FILE = 'channels.json'
const TERMS_FILE = 'terms.json'
const IGNORE_FILE = 'ignore.json'
const PREFS_FILE = 'prefs.json'
const CMD_PREFIX = 's!'


// Configure logger settings
logger.remove(logger.transports.Console);
logger.add(new logger.transports.Console, {
    colorize: true
});
logger.level = 'debug'; // LOGGER LEVEL

// Initialize globals
const bot = new Discord.Client();

var channelList; 
readChannelList(function(channels) {
    channelList = channels;
});

var terms;
readTerms(function(termsObject) {
    terms = termsObject;
    activateBot();
});

var ignoreList;
readIgnoreList(function(ignore) {
    ignoreList = ignore;
});


var prefs;
readObject(PREFS_FILE, {
        cooldown: 1800000
    }, function(preferences) {
        prefs = preferences;
    }
);

var cooldownTimes = {}

////
// Discord Bot
////
function activateBot() {
    // Initialize Discord Bot
    bot.login(auth.token);
}

bot.once('ready', function () {
    logger.info('Connected')
    logger.info('Logged in as: ');
    logger.info(bot.username + ' - (' + bot.id + ')');
});

bot.on('message', function (message) {
    //if (evt.author.bot) return;
    
    msgEvt = {
        user: message.member,
        userID: message.member.id,
        channelID: message.channel.id,
        message: message.content,
        evt: message
    }
    
    // For bot commands
    // Prefix will be 's!' (s for space)
    if (message.content.substring(0, CMD_PREFIX.length) == CMD_PREFIX) {
        var args = message.content.substring(CMD_PREFIX.length).split(' ');
        var cmd = args[0]; // Get cmd
        var args = args.slice(1); // Remove cmd from args
        if (args.length) { // merge args
            var merged = args.pop();
            while (args.length) {
                merged = args.pop() + ' ' + merged;
            }
        }
        else merged = "";
        
        cmdParse(cmd, merged, message); // Call command parser
    }
    else if (message.member.id != bot.user.id && channelList.includes(message.channel.id)) {
        // Message is not TERMS bot, and is in whitelisted channel
        scanMessage(message);
    }
});


////
// Term detection and printing
////

// Scans a message for a term.
function scanMessage(message) {
    var matches = [];
    Object.keys(terms).forEach(function (term) {
        if (!ignoreList.includes(term) && !isCoolingDown(term, message.channel.id)) { // Account for ignore list
            //Match if surrounded by non alphanumeric characters
            var re = new RegExp('\(\?\:\^\|\\W\)' + term + '\(\?\:\$\|\\W\)','gi');
            var match = message.content.match(re);
            if (match && match[0].length) { // Check for a match
                matches.push(term);
            }
        }
    });
    if (matches.length) {
        logger.log('debug', 'matches: ' + matches.toString());
        sendDefs(matches, message);
    }
}


// Print out definition(s) for multiple terms
function sendDefs(termList, message) {
    if (!termList.length) return;
    var msgEmbed = new Discord.MessageEmbed();    
    termList.forEach(function(term) {
        if (terms[term]) {
            // Reset term cooldown
            if (!cooldownTimes[message.channel.id]) {
                cooldownTimes[message.channel.id] = {};
            }
            cooldownTimes[message.channel.id][term] = Date.now();
            logger.log('debug', 'cooldowns changed: ' + cooldownTimes.toString());

            var defs = "";
            terms[term].forEach(function(def){
                defs += def + '\n';
            });

            // Add field to message for term
            msgEmbed.addField(term,defs);
        }
        else {
            logger.log('debug', "attempted to print non-existent term '" + term + "'");
        }
    });
    // If at least one field has been added, send message
    if (msgEmbed.fields.length) {
        message.channel.send(msgEmbed);
    }
}


// Checks if term is on cooldown
function isCoolingDown(term, channelID) {
    if (cooldownTimes[channelID] && cooldownTimes[channelID][term]) {
        if (Date.now() - cooldownTimes[channelID][term] < prefs.cooldown) {
            return true;
        } else {
            return false;
        }
    }
    else {
        return false;
    }
}

        

////
// Command Parsing and Execution
////

// Message constants
const INCORRECT_USAGE = "Incorrect Command. Usage:";
const REMOVE_HELP = CMD_PREFIX + "remove <term>[, <term>, ...]"
const ADD_HELP = CMD_PREFIX + "add <term>: <definition>";
const CLONE_HELP = CMD_PREFIX + "clone <old term>, <new term>";
const PLUS_CHANNEL_HELP = CMD_PREFIX + "+channel";
const MINUS_CHANNEL_HELP = CMD_PREFIX + "-channel";
const HELP_HELP = CMD_PREFIX + "help";
const DEFINE_HELP = CMD_PREFIX + "define <term>";
const IGNORE_HELP = CMD_PREFIX + "ignore <term>[, <term>, ...]";
const COOLDOWN_HELP = CMD_PREFIX + "cooldown [<number in minutes>]";


// Pass execution to relevant function on per command basis
function cmdParse(cmd, args, message) {
    switch(cmd) {
        case 'test':
            cmdTest(message);
            break;
        case '+channel':
            cmdPlusChannel(message);
            break;
        case '-channel':
            cmdMinusChannel(message);
            break;
        case 'add':
            cmdAdd(args, message);
            break;
        case 'remove':
            cmdRemove(args, message);
            break;
        case 'define':
            cmdDefine(args, message);
        case 'edit':
            // TODO
            break;
        case 'cooldown':
            cmdCooldown(args, message); 
            break;
        case 'ignore':
            cmdIgnore(args, message);
            break;
        case 'clone':
            cmdClone(args, message);
            break;
        case 'help':
            cmdHelp(message);
            break;
        default:
            message.channel.send("Incorrect Command, use " + CMD_PREFIX + "help to see commands.");
            break;
    }
}

// Prints definition of a term
function cmdDefine(args, message) {
    if (args) {
        args = args.trim();
        if (terms[args]) {
            sendDefs([args], message);
        }
        else {
            message.channel.send('**' + args + '** is not a defined term. You can add it using `' + ADD_HELP + '`');
        }
    }
}

// Prints command list with descriptions
function cmdHelp(message) {
    message.channel.send(
            "**Commands**\n" +
            "*define* - Defines a term!\n" +
            '`' + DEFINE_HELP + '`\n' +
            "*add* - To add a new term and definition, or to add a definition to a term\n" +
            '`' + ADD_HELP + '`\n' +
            "*remove* - To remove a term and all its definitions\n" +
            '`' + REMOVE_HELP + '`\n' +
            "*clone* - To copy the definitions from one term to make a new term\n" +
            '`' + CLONE_HELP + '`\n' +
            "*ignore* - To add or remove terms from the ignore list. Ignore list items aren't actively scanned, but can still be accessed using *define*\n" +
            '`' + IGNORE_HELP + '`\n' +
            "Whitelisting channels - to add or remove a channel from active scanning\n" +
            '`' + PLUS_CHANNEL_HELP + '`\n`' + MINUS_CHANNEL_HELP + '`\n' +
            "*cooldown* - To check cooldown or to change cooldown on auto detection\n" +
            '`' + COOLDOWN_HELP + '`\n' +
            "*help* - To see these commands anytime\n" +
            '`' + HELP_HELP + '`'
    );
}

// Prints hello world. Proves bot is working.
function cmdTest(message) {
    message.channel.send('Hello World!');
}

// Removes a channel to the whitelist
function cmdMinusChannel(message) {
    channelName = message.channel.name;

    logger.info('Attempting to remove channel from whitelist ' + channelName);

    if (channelList.includes(message.channel.id)) {
        channelList.splice(channelList.indexOf(message.channel.id), 1);
        writeChannelList();
        
        // Confirmation Message
        message.channel.send('Channel *' + channelName + '* removed from whitelist.');
    }
    else {
        // Comfirmation Message
        message.channel.send('Channel *' + channelName + '* already inactive.');
    }
}

// Adds a channel to the whitelist
function cmdPlusChannel(message) {
    channelName = message.channel.name;

    logger.info('Attempting to whitelist channel ' + channelName);

    if (!channelList.includes(message.channel.id)) {
        channelList.push(message.channel.id);
        writeChannelList();
        
        // Confirmation Message
        message.channel.send('Channel *' + channelName + '* added to whitelist.');
    }
    else {
        // Comfirmation Message
        message.channel.send('Channel *' + channelName + '* already active.');
    }
}

// Adds a new term and definition
function cmdAdd(arg, message) {
    logger.log('debug', 'arg for add: ' + arg);
    if (arg && arg.includes(':')) {
        // Split on ':', between term and definition
        args = arg.split(':');
        // Account for additional ':' after term is written
        while (args.length > 2) {
            args[1] += ':' + args[2];
            args.splice(2,1);
        }

        args[0] = args[0].trim();
        args[1] = args[1].trim();

        if (terms[args[0]]) {
            // Term exists, add another definition
            terms[args[0]].push(args[1]);

            message.channel.send('Added new definition to **' + args[0] + '**');

            logger.info('Adding new definition to term: ' + args[0]);
        }
        else {
            // Term is new, add to list
            terms[args[0]] = [args[1]];
            
            message.channel.send('Added new term: **' + args[0] + '**');
            
            logger.info('Adding new term: ' + args[0]);
        }
        // Term added, write changes to file
        writeTerms();
    }
    else {
        // Improper syntax
        logger.info("Wrong syntax on 'add' command");

        message.channel.send(INCORRECT_USAGE + '\n`' + ADD_HELP + '`');
    }
}

// Remove a term (and all definitions) from list
function cmdRemove(arg, message) {
    if (arg) { //ensure at least one term to remove.
        args = arg.split(',');
        args.forEach(function(term) {
            term = term.trim();
            if (terms[term]) { // Term exists
                count = terms[term].length
                delete terms[term]
                
                message.channel.send('Removed term **' + term + '** with ' + count + ' definitions.');
                
                logger.info('Removed term **' + term + '** with ' + count + ' definitions.');
                
                writeTerms();
            }
            else { // Term doesn't exist
                message.channel.send('Term **' + term + '** does not exist. Cannot be removed.');
                
                logger.info("Attempted to remove term that doesn't exist: '" + term + "'");
            }
        });
    }
    else {
        // Improper syntax
        logger.info("Wrong syntax on 'remove' command");

        message.channel.send(INCORRECT_USAGE + '\n`' + REMOVE_HELP + '`');
    }
}

// Clones the definitions from one term to another
function cmdClone(arg, message) {
    if (arg && arg.includes(',') && arg.split(',').length == 2) {
        args = arg.split(',');
        args[0] = args[0].trim();
        args[1] = args[1].trim();
        if (terms[args[0]] && !terms[args[1]]) {
            terms[args[1]] = terms[args[0]];
            writeTerms();
            
            message.channel.send('Successfully added **' + args[1] + '** from **' + args[0] +'**');

            logger.info("Cloned '" + args[0] + "' to create '" + args[1] + "'");
        }
        else if (args[1]) {
            message.channel.send('**' + args[1] + '** already exists, clone failed.');
        }
        else if (!args[0]) {
            message.channel.send('**' + args[0] + '** does not exist, cannot be cloned.');
        }
        else {
            logging.warn('Unkown error in determining if ' + args[0] + 
                ' can be cloned into ' + args[1]);
        }
    }
    else {
        message.channel.send(INCORRECT_USAGE + '\n`' + CLONE_HELP + '`');
        logger.info("Clone attempt failed with incorrect syntax");
    }
}

// Ignore (or stop ignoring) a term from scanned messages.
function cmdIgnore(arg, message) {
    if (arg) { //ensure at least one term to remove.
        args = arg.split(',');
        args.forEach(function(term) {
            term = term.trim();
            if (terms[term]) { // Term exists
                if (ignoreList.includes(term)) {
                    ignoreList.splice(ignoreList.indexOf(term), 1);
                
                    message.channel.send('No longer ignoring term **' + term + '**');
                
                    logger.info('Removed term **' + term + '** from ignore list.');
                }
                else {
                    ignoreList.push(term);
                
                    message.channel.send('Now ignoring term **' + term + '**');
                
                    logger.info('Added term **' + term + '** to ignore list.');
                }
                
                writeIgnoreList();
            }
            else { // Term doesn't exist
                message.channel.send('Term **' + term + '** does not exist. Cannot be ignored. You can add it using `' + ADD_HELP + '`');
                
                logger.info("Attempted to ignore term that doesn't exist: '" + term + "'");
            }
        });
    }
    else {
        // Improper syntax
        logger.info("Wrong syntax on 'ignore' command");

        message.channel.send(INCORRECT_USAGE + '\n`' + IGNORE_HELP + '`');
    }
}


// Prints or changes the cooldown time
function cmdCooldown(args, message) {
    let timeConversion = 60000;
    if (args) {
        if (!isNaN(args.trim())) {
            prefs.cooldown = Math.floor(Number(args.trim())*timeConversion);
            message.channel.send('Cooldown changed to ' + (prefs.cooldown / timeConversion).toFixed(1) + 'm');

            logger.info('Cooldown changed to ' + prefs.cooldown);
            writeObject(PREFS_FILE, prefs);
        }
        else {
            message.channel.send(args.trim() + ' is not a number. Use `' + COOLDOWN_HELP +'`');
        }

    }
    else {
        message.channel.send('Current cooldown is ' + (prefs.cooldown / timeConversion).toFixed(1) + 'm');
    }
}


////
// File Handlers
////

// Shorthands

function readChannelList(fn) {
    readObject(CHANNEL_FILE, [], fn);
}

function writeChannelList() {
    writeObject(CHANNEL_FILE, channelList);
}

function readIgnoreList(fn) {
    readObject(IGNORE_FILE, [], fn);
}

function writeIgnoreList() {
    writeObject(IGNORE_FILE, ignoreList);
}

function readTerms(fn) {
    readObject(TERMS_FILE, {}, fn);
}

function writeTerms() {
    writeObject(TERMS_FILE, terms);
}

// Reads object from file and passes to callback function (fn)
function readObject(filename, empty, fn) {
    fs.exists(filename, function(exists) {
        if (exists) {
            fs.readFile(filename, 'utf8', function readFileCallback(err, data){
                if (err) {
                    logger.error(err);
                }
                fn(JSON.parse(data));
                logger.info("Object loaded from file: " + filename);
            });
        }
        else {
            fn(empty);
            logger.info("File ("+ filename +") does not exist, creating empty object.");
        }
    });
}

// Writes object to JSON file
function writeObject(filename, object) {
    var json = JSON.stringify(object, null, 4);
    fs.writeFile(filename, json, 'utf8', function() {
        logger.info(filename +" updated")
    });
}



