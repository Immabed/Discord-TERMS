# Discord-TERMS
A terminology decrypter bot for discord.

*TERMS* - Terminology Encoding Reduction Machine, for Space

TERMS is a discord bot intended to help my non-space geek friends decipher some of the cryptic terminology used when discussing space missions and rocket science.
It can be used for any sort of terminology, jargon, and acronyms.

## How to Use
TERMS is a node.js based discord bot, but it isn't designed to properly handle more than one server, so if you want to use it for your own server, you will need to host it yourself.

### Prerequisites
- Node.js
- discord.io module (install using npm)
- winston module (install using npm)
- A discord account

### Setting up

Use the instructions in this [tutorial](https://medium.com/davao-js/tutorial-creating-a-simple-discord-bot-9465a2764dc0) to get node running, and to install the node modules. Instead of using the files it has you create, use the sources in this repository.

You will need to get a bot token, to do so follow [this guide](https://medium.com/davao-js/tutorial-creating-a-simple-discord-bot-9465a2764dc0). Once you have a token, create a file `auth.json` in your project directory, and add the token like so:
```
{
    "token":"YOUR TOKEN HERE"
}
```

Now that you have added the bot, you can begin using it! Activate the bot using `node bot.js` and ensure it has connected to your server. Then use `s!help` to see available commands! You can then begin populating the terminology list using the built in commands.

I recommend finding a place to host the bot 24/7 so that you can always have access to the commands and features. You could try [Heroku's](https://devcenter.heroku.com/articles/getting-started-with-nodejs) free hosting service.

## Licence
This program is provided as is, with no warranty. If you find issues you can tell me about them and I'll have a look when I get a chance, or you can just fix them yourself if feel adventurous!

