import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBZpFvvXNIKuZZvQyD8LjnT0QmKzwYyO9A",
  authDomain: "reader-27ca2.firebaseapp.com",
  projectId: "reader-27ca2",
  storageBucket: "reader-27ca2.firebasestorage.app",
  messagingSenderId: "261431696651",
  appId: "1:261431696651:web:a57d7ae106873673b5960e",
  measurementId: "G-JKVJFGJDN2"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);