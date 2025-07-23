import { open } from '@tauri-apps/plugin-shell';
import { getAuth, GoogleAuthProvider, getRedirectResult, signInWithRedirect, signInWithCredential } from 'firebase/auth';
import { invoke } from "@tauri-apps/api/core";
import { GoogleAuthConfig } from "../../.google-auth-config";
import { localForage } from "../../storage/forage";
import { logger } from "../LoggerService.js";
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
    return open('https://accounts.google.com/o/oauth2/auth?',
      'response_type=code&',
      'access_type=offline&',
      'state=' + randomString + '&',
      'client_id=' + GoogleAuthConfig.clientId + '&',
      'redirect_uri=https%3A//rwds.net/cgi-bin/token.cgi&',
      'scope=https:%2F%2Fwww.googleapis.com%2Fauth%2Fphotoslibrary.readonly%20',
      'https:%2F%2Fwww.googleapis.com%2Fauth%2Fphotoslibrary.appendonly&',
      'prompt=consent'
    );
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

    const auth = getAuth();
    const credential = GoogleAuthProvider.credential(null, accessToken);

    // Store tokens securely using our TokenStorageService
    try {
      await invoke('store_google_tokens', {
        accessToken: accessToken,
        refreshToken: refreshToken,
        expiresIn: expiresIn
      });
      logger.info('GoogleAuth', 'tokens_stored', 'Tokens stored securely in keyring');
    } catch (tokenError) {
      logger.error('GoogleAuth', 'token_storage_error', 'Failed to store tokens securely', {
        error: tokenError.toString()
      });
      // Continue with Firebase auth even if secure storage fails
    }

    // Also keep the old localForage storage for backward compatibility (for now)
    try {
      await localForage.setItem(
        "GoogleOAuthTokens",
        {
          accessToken: accessToken,
          refreshToken: refreshToken,
        }
      );
      logger.debug('GoogleAuth', 'legacy_storage', 'Tokens also stored in legacy localForage');
    } catch (legacyError) {
      logger.warn('GoogleAuth', 'legacy_storage_error', 'Failed to store in localForage', {
        error: legacyError.toString()
      });
    }

    // Proceed with Firebase authentication
    await signInWithCredential(auth, credential);
    logger.info('GoogleAuth', 'firebase_signin_success', 'Firebase authentication successful');

  } catch (error) {
    const errorCode = error.code || 'unknown';
    const errorMessage = error.message || error.toString();
    logger.error('GoogleAuth', 'signin_error', 'Google Sign In failed', {
      errorCode,
      errorMessage
    });
  }
};

export const signOut = () => {
  const auth = getAuth();
  return auth.signOut();
}
