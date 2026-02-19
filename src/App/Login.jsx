import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { auth } from '../services/firebase';
const { openGoogleSignIn, googleSignIn, signOut } = auth;
import { localForage as _localForage } from "../storage/forage";
import { logger } from "../services/LoggerService.js";

function loginGoogle() {
    logger.info('Login', 'oauth_start', 'Starting Google OAuth flow');
    
    listen('oauth://url', (data) => {
        logger.info('Login', 'oauth_callback', 'Received OAuth callback', { payload: data.payload });
        googleSignIn(data.payload);
    });

    invoke('plugin:oauth|start', {
        config: {
            response: `<!DOCTYPE html>
              <html lang="en">
              <head>
                <meta charset="UTF-8">
                <meta http-equiv="X-UA-Compatible" content="IE=edge">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link rel="preconnect" href="https://fonts.googleapis.com">
                <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
                <link href="https://fonts.googleapis.com/css2?family=Open+Sans&display=swap" rel="stylesheet">
                <title>PhotoClove</title>
                <style>
                  body {
                    font-family: 'Open Sans', sans-serif;
                    margin: auto;
                    max-width: 640px;
                    text-align: center;
                  }
                </style>
              </head>
              <body>
                <h1>PhotoClove</h1>
                <h2>Successfully Singin to Google. You can close this window.</h2>
              </body>
              </html>
              `
        }
    }).then((port) => {
        logger.info('Login', 'oauth_server_started', 'OAuth server started', { port });
        openGoogleSignIn(port);
    }).catch((e) => {
        logger.error('Login', 'oauth_start_error', 'Failed to start OAuth flow', { error: e.toString() });
    })
}


export default loginGoogle;