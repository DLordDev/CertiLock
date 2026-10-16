// Bring in Firebase tools to make accounts, save names, and sign out.
import { createUserWithEmailAndPassword, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
import { auth } from "./firebase.js";

// Find the sign-up form and its button on the page.
const form = document.querySelector("#register-form");
const button = document.querySelector("#submit-btn");

// Run this when someone asks to make a new account.
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  // Stop extra clicks while Firebase is working.
  button.disabled = true;

  try {
    // Ask Firebase to make an account with the email and password.
    const { user } = await createUserWithEmailAndPassword(
      auth,
      document.querySelector("#email").value.trim(),
      document.querySelector("#password").value
    );
    let profileSaved = true;
    try {
      // Put the person's first and last name on their account.
      const firstName = document.querySelector("#firstname").value.trim();
      const lastName = document.querySelector("#lastname").value.trim();
      await updateProfile(user, { displayName: `${firstName} ${lastName}`.trim() });
    } catch (error) {
      profileSaved = false;
      // Keep a record if saving the name did not work.
      console.error("Could not save the account name:", error);
    }
    // Sign out so the new account must use the sign-in page.
    await signOut(auth);
    alert(profileSaved
      ? "Your account has been created. Please log in to continue."
      : "Your account was created, but we could not save your name. Please log in to continue.");
    window.location.href = "Login.html";
  } catch (error) {
    // Tell us and the user if making the account did not work.
    console.error("Account registration failed:", error);
    alert(error.message);
  } finally {
    // Let the button work again after Firebase is done.
    button.disabled = false;
  }
});
