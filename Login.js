// Bring in Firebase's tool for signing in and our saved app connection.
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
import { auth } from "./firebase.js";

// Find the form and button so this script can use them.
const form = document.querySelector("#login-form");
const button = document.querySelector("#login-btn");

// Check the email and password when the form is sent.
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  // Stop the button being pressed twice while we check.
  button.disabled = true;

  try {
    // Ask Firebase to sign in the person.
    await signInWithEmailAndPassword(
      auth,
      document.querySelector("#email").value.trim(),
      document.querySelector("#password").value
    );
    // Show the short welcome page after a successful sign-in.
    window.location.href = "Welcome.html";
  } catch (error) {
    // Tell us what went wrong and show a simple message.
    console.error("Login failed:", error);
    alert("Unable to log in. Check your email and password, then try again.");
  } finally {
    // Make the button usable again if the user needs another try.
    button.disabled = false;
  }
});
