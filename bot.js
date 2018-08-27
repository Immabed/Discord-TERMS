var Discord = require('discord.io');
var logger = require('winston');
var fs = require('fs');
var auth = require('./auth.json');


// Global Constants
const CHANNEL_FILE = 'channels.json'
const TERMS_FILE = 'terms.json'
const CMD_PREFIX = 's!'


// Configure logger settings
logger.remove(logger.transports.Console);
logger.add(new logger.transports.Console, {
    colorize: true
});
logger.level = 'debug';

// Initialize globals
var bot;

var channelList; 
readChannelList(function(channels) {
    channelList = channels;
});

var terms;
readTerms(function(termsObject) {
    terms = termsObject;
    activateBot();
});

////
// Discord Bot
////
function activateBot() {
    // Initialize Discord Bot
    bot = new Discord.Client({
        token: auth.token,
        autorun: true
    });
    bot.on('ready', function (evt) {
        logger.info('Connected')
        logger.info('Logged in as: ');
        logger.info(bot.username + ' - (' + bot.id + ')');
    });
    bot.on('message', function (user, userID, channelID, message, evt) {
        //if (evt.author.bot) return;
        
        msgEvt = {
            user: user,
            userID: userID,
            channelID: channelID,
            message: message,
            evt: evt
        }
        
        // For bot commands
        // Prefix will be 's!' (s for space)
        if (message.substring(0, CMD_PREFIX.length) == CMD_PREFIX) {
            var args = message.substring(CMD_PREFIX.length).split(' ');
            var cmd = args[0]; // Get cmd
            var args = args.slice(1); // Remove cmd from args
            if (args.length) { // merge args
                var merged = args.pop();
                while (args.length) {
                    merged = args.pop() + ' ' + merged;
                }
            }
            else merged = "";
            logger.log('debug', merged);
            
            cmdParse(cmd, merged, msgEvt); // Call command parser
        }
        else {
            // TODO - Call acronym parser
        }
    });
}

////
// Term detection and printing
////


// Print out definition(s) for a term
function sendDefs(term, msg) {
    if (terms[term]) {
        var defs = "";
        terms[term].forEach(function(def){
            defs += def + '\n';
        });
        bot.sendMessage({
            to: msg.channelID,
            embed: {
                fields: [{
                    name: term,
                    value: defs
                }]
            }
        });
    }
    else {
        logging.log('debug', 'attempted to print non-existent term');
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


// Pass execution to relevant function on per command basis
function cmdParse(cmd, args, msg) {
    switch(cmd) {
        case 'test':
            cmdTest(msg);
            break;
        case '+channel':
            cmdPlusChannel(msg);
            break;
        case '-channel':
            cmdMinusChannel(msg);
            break;
        case 'add':
            cmdAdd(args, msg);
            break;
        case 'remove':
            cmdRemove(args, msg);
            break;
        case 'define':
            cmdDefine(args, msg);
        case 'edit':
            break;
        case 'ignore':
            break;
        case 'clone':
            cmdClone(args, msg);
            break;
        case 'help':
            cmdHelp(msg);
            break;
        default:
            bot.sendMessage({
                to: msg.channelID,
                message: "Incorrect Command, use " + CMD_PREFIX + "help to see commands."
            });
            break;
    }
}

// Prints definition of a term
function cmdDefine(args, msg) {
    if (args) {
        args = args.trim();
        if (terms[args]) {
            sendDefs(args, msg);
        }
    }
}



// Prints command list with descriptions
function cmdHelp(msg) {
    bot.sendMessage({
        to:msg.channelID,
        message:
            "**Commands**\n" +
            "*define* - Defines a term!\n" +
            '`' + DEFINE_HELP + '`' +
            "*add* - To add a new term and definition, or to add a definition to a term\n" +
            '`' + ADD_HELP + '`\n' +
            "*remove* - To remove a term and all its definitions\n" +
            '`' + REMOVE_HELP + '`\n' +
            "*clone* - To copy the definitions from one term to make a new term\n" +
            '`' + CLONE_HELP + '`\n' +
            "Whitelisting channels - to add or remove a channel from active scanning" +
            '`' + PLUS_CHANNEL_HELP + '`\n`' + MINUS_CHANNEL_HELP + '`\n' +
            "*help* - To see these commands anytime\n" +
            '`' + HELP_HELP + '`'
    });
}

// Prints hello world. Proves bot is working.
function cmdTest(msg) {
    bot.sendMessage({
        to: msg.channelID,
        message: 'Hello World!'
    });
}

// Removes a channel to the whitelist
function cmdMinusChannel(msg) {
    channelName = bot.channels[msg.channelID].name;

    logger.info('Attempting to remove channel from whitelist ' + channelName);

    if (channelList.includes(msg.channelID)) {
        channelList.splice(channelList.indexOf(msg.channelID), 1);
        writeChannelList();
        
        // Confirmation Message
        bot.sendMessage({
            to: msg.channelID,
            message: 'Channel *' + channelName + '* removed from whitelist.'
        });
    }
    else {
        // Comfirmation Message
        bot.sendMessage({
            to: msg.channelID,
            message: 'Channel *' + channelName + '* already inactive.'
        });
    }
}

// Adds a channel to the whitelist
function cmdPlusChannel(msg) {
    channelName = bot.channels[msg.channelID].name;

    logger.info('Attempting to whitelist channel ' + channelName);

    if (!channelList.includes(msg.channelID)) {
        channelList.push(msg.channelID);
        writeChannelList();
        
        // Confirmation Message
        bot.sendMessage({
            to: msg.channelID,
            message: 'Channel *' + channelName + '* added to whitelist.'
        });
    }
    else {
        // Comfirmation Message
        bot.sendMessage({
            to: msg.channelID,
            message: 'Channel *' + channelName + '* already active.'
        });
    }
}

// Adds a new term and definition
function cmdAdd(arg, msg) {
    logger.log('debug', 'arg for add: ' + arg);
    if (arg && arg.includes(':')) {
        // Split on ':', between term and definition
        args = arg.split(':');
        // Account for additional ':' after term is written
        while (args.split > 2) {
            args[1] += ':' + args[2];
            args.splice(2,1);
        }

        args[0] = args[0].trim();
        args[1] = args[1].trim();

        if (terms[args[0]]) {
            // Term exists, add another definition
            terms[args[0]].push(args[1]);

            bot.sendMessage({
                to: msg.channelID,
                message: 'Added new definition to **' + args[0] + '**'
            });

            logger.info('Adding new definition to term: ' + args[0]);
        }
        else {
            // Term is new, add to list
            terms[args[0]] = [args[1]];
            
            bot.sendMessage({
                to: msg.channelID,
                message: 'Added new term: **' + args[0] + '**'
            });
            
            logger.info('Adding new term: ' + args[0]);
            
        }
        // Term added, write changes to file
        writeTerms();
    }
    else {
        // Improper syntax
        logger.info("Wrong syntax on 'add' command");

        bot.sendMessage({
            to: msg.channelID,
            message: INCORRECT_USAGE + '\n`' + ADD_HELP + '`'
        });
    }
}

// Remove a term (and all definitions) from list
function cmdRemove(arg, msg) {
    if (arg) { //ensure at least one term to remove.
        args = arg.split(',');
        args.forEach(function(term) {
            term = term.trim();
            if (terms[term]) { // Term exists
                count = terms[term].length
                delete terms[term]
                
                bot.sendMessage({
                    to: msg.channelID,
                    message:'Removed term **' + term + '** with ' + count + ' definitions.'
                });
                
                logger.info('Removed term **' + term + '** with ' + count + ' definitions.');
                
                writeTerms();
            }
            else { // Term doesn't exist
                bot.sendMessage({
                    to: msg.channelID,
                    message:'Term **' + term + '** does not exist. Cannot be removed.'
                });
                
                logger.info("Attempted to remove term that doesn't exist: '" + term + "'");
            }
        });
    }
    else {
        // Improper syntax
        logger.info("Wrong syntax on 'remove' command");

        bot.sendMessage({
            to: msg.channelID,
            message: INCORRECT_USAGE + '\n`' + REMOVE_HELP + '`'
        });
    }
}

// Clones the definitions from one term to another
function cmdClone(arg, msg) {
    if (arg && arg.includes(',') && arg.split(',').length == 2) {
        args = arg.split(',');
        args[0] = args[0].trim();
        args[1] = args[1].trim();
        if (terms[args[0]] && !terms[args[1]]) {
            terms[args[1]] = terms[args[0]];
            writeTerms();
            
            bot.sendMessage({
                to: msg.channelID,
                message: 'Successfully added **' + args[1] + '** from **' + args[0] +'**'
            });

            logger.info("Cloned '" + args[0] + "' to create '" + args[1] + "'");
        }
        else if (args[1]) {
            bot.sendMessage({
                to: msg.channelID,
                message: '**' + args[1] + '** already exists, clone failed.'
            });
        }
        else if (!args[0]) {
            bot.sendMessage({
                to: msg.channelID,
                message: '**' + args[0] + '** does not exist, cannot be cloned.'
            });
        }
        else {
            logging.warn('Unkown error in determining if ' + args[0] + 
                ' can be cloned into ' + args[1]);
        }
    }
    else {
        bot.sendMessage({
            to: msg.channelID,
            message: INCORRECT_USAGE + '\n`' + CLONE_HELP + '`'
        });
        logger.info("Clone attempt failed with incorrect syntax");
    }
}


////
// File Handlers
////

// Reads channel list from file and passes list to callback function (fn)
function readChannelList(fn) {
    fs.exists(CHANNEL_FILE, function(exists) {
        if (exists) {
            fs.readFile(CHANNEL_FILE, 'utf8', function readFileCallback(err, data){
                if (err) {
                    logger.error(err);
                }
                fn(JSON.parse(data));
                logger.info("Channel whitelist loaded from file.");
            });
        }
        else {
            fn([]);
            logger.info("Channel whitelist file ("+ CHANNEL_FILE +") does not exist, creating empty whitelist.");
        }
    });
}

// Writes channelList to file
function writeChannelList() {
    var json = JSON.stringify(channelList, null, 4);
    fs.writeFile(CHANNEL_FILE, json, 'utf8', function() {
        logger.info(CHANNEL_FILE +" updated")
    });
}


// Reads terms object from file and passes list to callback function (fn)
function readTerms(fn) {
    fs.exists(TERMS_FILE, function(exists) {
        if (exists) {
            fs.readFile(TERMS_FILE, 'utf8', function readFileCallback(err, data){
                if (err) {
                    logger.error(err);
                }
                fn(JSON.parse(data));
                logger.info("Terms loaded from file.");
            });
        }
        else {
            fn({});
            logger.info("Terms file ("+ TERMS_FILE +") does not exist, creating empty terms object.");
        }
    });
}

// Writes terms to file
function writeTerms() {
    var json = JSON.stringify(terms, null, 4);
    fs.writeFile(TERMS_FILE, json, 'utf8', function() {
        logger.info(TERMS_FILE + " updated")
    });
}

