import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBBHyCBPEZaSehB__zHoUoOtB4pdpWT0MU",
  authDomain: "tabsplit-79b94.firebaseapp.com",
  projectId: "tabsplit-79b94",
  storageBucket: "tabsplit-79b94.firebasestorage.app",
  messagingSenderId: "812059907814",
  appId: "1:812059907814:web:ab9af4aa87b9e339a00d27"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);