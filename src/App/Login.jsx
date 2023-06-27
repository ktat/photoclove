import React, { useState, useEffect } from "react";
import { invoke, convertFileSrc } from "@tauri-apps/api/tauri";
import { listen } from "@tauri-apps/api/event";
import { auth } from '../services/firebase';
const { openGoogleSignIn, googleSignIn, signOut } = auth;
import { localForage } from "../storage/forage";

function Login(props) {

    function login() {
        listen('oauth://url', (data) => {
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
            openGoogleSignIn(port);
        }).catch((e) => {
            console.log("error: " + e);
        })
    }

    return (
        <div id="login-container">
            <h1>Login to Other Service</h1>
            <ul>
                <li>
                    <a href="#" onClick={(e) => { login() }}>Login to Google</a> ... to upload photos to Google Photos
                </li>
            </ul>
        </div>
    )
}

export default Login;
