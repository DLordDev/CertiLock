// Listen for Firebase to tell us who is signed in.
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
import { auth } from "./firebase.js";

// Find the words that will greet the person.
const welcomeMessage = document.querySelector("#welcome-message");

// Only show this page to someone who signed in.
onAuthStateChanged(auth, (user) => {
  if (!user) {
    // Send anyone who is signed out to the sign-in page.
    window.location.replace("Login.html");
    return;
  }

  // Use their name, or the part before @ in their email if no name was saved.
  const name = user.displayName?.trim() || user.email?.split("@")[0] || "there";
  welcomeMessage.textContent = `Welcome to CertiLock, ${name}!`;

  // Take them to the about page after five seconds.
  window.setTimeout(() => {
    window.location.replace("About.html");
  }, 5000);
});
