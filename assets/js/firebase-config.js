import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getDatabase,
  ref,
  set,
  update,
  onValue,
  get,
  remove,
  push,
  child
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyBRXQ1tLE-zyYWgEwF_HM21EM-ToAIZ1QM",
  authDomain: "impro-ead69.firebaseapp.com",
  databaseURL: "https://impro-ead69-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "impro-ead69",
  storageBucket: "impro-ead69.firebasestorage.app",
  messagingSenderId: "574031727979",
  appId: "1:574031727979:web:1bff48266668f3a930902e"
};

export const FIREBASE_READY = true;
export const STORAGE_BUCKET = "gs://impro-ead69.firebasestorage.app";

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const storage = getStorage(app, STORAGE_BUCKET);

export {
  app,
  db,
  storage,
  ref,
  set,
  update,
  onValue,
  get,
  remove,
  push,
  child,
  storageRef,
  uploadBytes,
  getDownloadURL
};
