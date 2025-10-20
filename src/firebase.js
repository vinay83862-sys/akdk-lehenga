import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyDSpYZNNevWXuKHwfd1DgLtzX6FQf1oreU",
  authDomain: "manager-e49ba.firebaseapp.com",
  databaseURL: "https://manager-e49ba-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "manager-e49ba",
  storageBucket: "manager-e49ba.firebasestorage.app",
  messagingSenderId: "58249200567",
  appId: "1:58249200567:web:25f59128aa0a7648fede32",
  measurementId: "G-B3YJ9XW3V0"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);