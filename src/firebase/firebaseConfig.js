import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBQT_5WBkHgcGjLv90jMrMLDAXqP0tefco",
  authDomain: "rp-construction-tracker-9d0eb.firebaseapp.com",
  projectId: "rp-construction-tracker-9d0eb",
  storageBucket: "rp-construction-tracker-9d0eb.appspot.com",
  messagingSenderId: "314276287594",
  appId: "1:314276287594:web:28b4e41d9ea2d9805d2613",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
