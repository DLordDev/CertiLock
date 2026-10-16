// Bring in the Firebase parts used to sign in and save certificates.
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";

// These settings tell the browser which Firebase project belongs to CertiLock.
const firebaseConfig = {
  apiKey: "AIzaSyAXetsvYrjMzO5yFMFNcHcAP-cmiAXARvk",
  authDomain: "certilock-3b496.firebaseapp.com",
  projectId: "certilock-3b496",
  storageBucket: "certilock-3b496.firebasestorage.app",
  messagingSenderId: "366297894694",
  appId: "1:366297894694:web:fe711210a6c73fdc6f7be7"
};

// Start Firebase once so the other pages can use the same connection.
const app = initializeApp(firebaseConfig);

// Share sign-in and certificate storage with the other page scripts.
export const auth = getAuth(app);
export const db = getFirestore(app);
