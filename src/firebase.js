// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBkXs7uZpKr_5hpS4YI8YoOhJYGCiKefP8",
  authDomain: "skillcheckai-6d0ca.firebaseapp.com",
  projectId: "skillcheckai-6d0ca",
  storageBucket: "skillcheckai-6d0ca.firebasestorage.app",
  messagingSenderId: "812930574313",
  appId: "1:812930574313:web:4995f454cc55b2ad3c8d78",
  measurementId: "G-G0LZPEM6DJ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

export { app, analytics };
