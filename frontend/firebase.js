// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey:import.meta.env.VITE_FIREBASE_APIKEY,
  authDomain: "Delicious-food-delivery.firebaseapp.com",
  projectId: "Delicious-food-delivery",
  storageBucket: "Delicious-food-delivery.firebasestorage.app",
  messagingSenderId: "693314883513",
  appId: "1:693314883513:web:4840c943ecf3fb61a33068"
};

// Initialize Firebase only when a key is configured. Without one, `getAuth` throws at
// import time and the whole app renders as a blank page; instead Google sign-in is
// simply reported as unavailable and email/password login keeps working.
let app = null
let auth = null

if (firebaseConfig.apiKey) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app)
  } catch (error) {
    console.warn("Firebase init failed:", error.message)
  }
}

export const isGoogleAuthAvailable = () => Boolean(auth)

export {app,auth}