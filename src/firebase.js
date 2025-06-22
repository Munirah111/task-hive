import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyC15cH0Dvq1f_H1RrifxRW97bCMN8uPdCY",
  authDomain: "taskhive-d63e7.firebaseapp.com",
  projectId: "taskhive-d63e7",
  storageBucket: "taskhive-d63e7.firebasestorage.app",
  messagingSenderId: "434624415612",
  appId: "1:434624415612:web:478a4362a604a7a772c6f9"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);