import { open } from '@tauri-apps/plugin-shell';
import { invoke } from "@tauri-apps/api/core";
import { GoogleAuthConfig } from "../.google-auth-config";
import { localForage } from "../storage/forage";
import { logger } from "./LoggerService.js";
import axios from "axios";

const openBrowserToConsent = (port) => {

  let chars = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  for (let i = 97; i < 122; i++) {
    chars.push(String.fromCharCode(i));
  }
  for (let i = 65; i < 91; i++) {
    chars.push(String.fromCharCode(i));
  }
  const randomString = Array.from({ length: 50 }, () => chars[parseInt(Math.random() * chars.length)]).join('');
  const url = 'https://www.rwds.net/cgi-bin/token.cgi?state=' + randomString + '&url=http%3A%2F%2Flocalhost%3A' + port;
  return axios.get(url).then(() => {
    // Build complete OAuth URL as a single string
    const oauthUrl = 'https://accounts.google.com/o/oauth2/auth?' +
      'response_type=code&' +
      'access_type=offline&' +
      'state=' + randomString + '&' +
      'client_id=' + GoogleAuthConfig.clientId + '&' +
      'redirect_uri=https%3A//rwds.net/cgi-bin/token.cgi&' +
      'scope=https:%2F%2Fwww.googleapis.com%2Fauth%2Fphotoslibrary.readonly%20' +
      'https:%2F%2Fwww.googleapis.com%2Fauth%2Fphotoslibrary.appendonly&' +
      'prompt=consent';

    logger.debug('GoogleAuth', 'open_browser', 'Opening browser with OAuth URL', {
      randomString,
      port
    });

    return open(oauthUrl);
  });
};

export const openGoogleSignIn = (port) => {
  return new Promise((resolve, reject) => {
    openBrowserToConsent(port).then(resolve).catch(reject);
  });
};

export const googleSignIn = async (payload) => {
  logger.info('GoogleAuth', 'signin_start', 'Starting Google Sign In process', { payload });
 
  try {
    const url = new URL(payload);
    // Get `access_token` from redirect_uri param
    const params = url.searchParams;

    const jsonString = params.get('res');
    const json = JSON.parse(jsonString);

    const accessToken = json.access_token;
    const refreshToken = json.refresh_token;
    const expiresIn = json.expires_in || 3600; // Default to 1 hour if not provided

    if (!accessToken) {
      logger.error('GoogleAuth', 'signin_error', 'No access token received');
      return;
    }

    logger.info('GoogleAuth', 'tokens_received', 'OAuth tokens received successfully');

    // Older versions mirrored the tokens into localForage in plaintext. Drop
    // that entry first: nothing reads it any more, and doing it after the
    // keyring write would skip it on the one path that matters - a machine
    // whose keyring is unavailable, where the plaintext refresh token would
    // otherwise sit in IndexedDB forever.
    try {
      await localForage.removeItem("GoogleOAuthTokens");
    } catch (cleanupError) {
      logger.warn('GoogleAuth', 'legacy_cleanup_error', 'Failed to remove legacy localForage tokens', {
        error: cleanupError.toString()
      });
    }

    // Tokens live only in the OS keyring. Consumers read them through the Rust
    // side (is_google_authenticated), never from JS.
    try {
      await invoke('store_google_tokens', {
        accessToken: accessToken,
        refreshToken: refreshToken,
        expiresIn: expiresIn
      });
      logger.info('GoogleAuth', 'tokens_stored', 'Tokens stored securely in keyring');
    } catch (tokenError) {
      logger.error('GoogleAuth', 'signin_error', 'Sign In failed: could not store tokens in keyring', {
        error: tokenError.toString()
      });
      return;
    }

    logger.info('GoogleAuth', 'signin_success', 'Google Sign In completed');

  } catch (error) {
    const errorCode = error.code || 'unknown';
    const errorMessage = error.message || error.toString();
    logger.error('GoogleAuth', 'signin_error', 'Google Sign In failed', {
      errorCode,
      errorMessage
    });
  }
};
