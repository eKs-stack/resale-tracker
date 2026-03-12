import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCyjc4MxY_mgNACKKS6theUZYrKV_RS-p8",
  authDomain: "resale-tracker-ef981.firebaseapp.com",
  projectId: "resale-tracker-ef981",
  storageBucket: "resale-tracker-ef981.firebasestorage.app",
  messagingSenderId: "96388844687",
  appId: "1:96388844687:web:e12e92182a48137f3cf4fa",
  measurementId: "G-36Q6HR4ZG1"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
