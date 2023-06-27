import { open } from '@tauri-apps/api/shell';
import { getAuth, GoogleAuthProvider, getRedirectResult, signInWithRedirect, signInWithCredential } from 'firebase/auth';
import { invoke } from "@tauri-apps/api/tauri";
import { GoogleAuthConfig } from "../../.google-auth-config";
import { localForage } from "../../storage/forage";
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
  axios.get(url).then(() => {
    return open('https://accounts.google.com/o/oauth2/auth?' +
      'response_type=code&' +
      'access_type=offline&' +
      'state=' + randomString + '&' +
      'client_id=' + GoogleAuthConfig.clientId + '&' +
      'redirect_uri=https%3A//rwds.net/cgi-bin/token.cgi&' +
      'scope=email%20profile%20openid%20' +
      'https:%2F%2Fwww.googleapis.com%2Fauth%2Fphotoslibrary.readonly%20' +
      'https:%2F%2Fwww.googleapis.com%2Fauth%2Fphotoslibrary.appendonly&' +
      'prompt=consent'
    );
  });
};

export const openGoogleSignIn = (port) => {
  return new Promise((resolve, reject) => {
    openBrowserToConsent(port).then(resolve).catch(reject);
  });
};

export const googleSignIn = (payload) => {
  const url = new URL(payload);
  // Get `access_token` from redirect_uri param
  const params = url.searchParams;

  const jsonString = params.get('res');
  const json = JSON.parse(jsonString);

  const accessToken = json.access_token;
  const refreshToken = json.refresh_token;

  if (!accessToken) return;

  const auth = getAuth();

  const credential = GoogleAuthProvider.credential(null, accessToken);

  localForage.setItem(
    "GoogleOAuthTokens",
    {
      accessToken: accessToken,
      refreshToken: refreshToken,
    }
  ).then(() => {
  }).catch((e) => { console.log(e) })

  signInWithCredential(auth, credential)
    .catch((error) => {
      const errorCode = error.code;
      const errorMessage = error.message;
      console.error(errorCode, errorMessage);
    });
};

export const signOut = () => {
  const auth = getAuth();
  return auth.signOut();
}
