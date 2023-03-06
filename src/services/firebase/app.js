import { initializeApp } from 'firebase/app';
import { GoogleAuthConfig } from "../../.google-auth-config";

export const firebaseApp = initializeApp(GoogleAuthConfig.firebaseConfig);
