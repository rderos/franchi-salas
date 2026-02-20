import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBb04TmtXXyG-9Br5lckXtVcHvVPquASDk",
  authDomain: "franchi-salas.firebaseapp.com",
  projectId: "franchi-salas",
  storageBucket: "franchi-salas.firebasestorage.app",
  messagingSenderId: "155264181498",
  appId: "1:155264181498:web:5ed4ed938ae28817f21543"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
