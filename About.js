// Bring in tools to check who is signed in, read their certificate, and sign out.
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";
import { auth, db } from "./firebase.js";

// Find the status words, certificate button, and sign-out button.
const status = document.querySelector("#certificate-status");
const generateLink = document.querySelector("#generate-link");
const logoutButton = document.querySelector("#logout-btn");

// Check the account whenever Firebase tells us who is signed in.
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    // A signed-out visitor must sign in before using this page.
    window.location.replace("Login.html");
    return;
  }

  // Let the signed-in person open the form while we check their record.
  generateLink.hidden = false;

  try {
    // Look for a certificate saved under this person's account.
    const certificate = await getDoc(doc(db, "certificates", user.uid));
    if (certificate.exists()) {
      // Tell them their certificate is already made and locked.
      status.textContent = "You have already generated your certificate. Its details are locked and cannot be changed.";
      return;
    }

    // Tell a person with no saved certificate that they can make one.
    status.textContent = `Welcome${user.displayName ? `, ${user.displayName}` : ""}. Logged in as ${user.email}. You can generate one certificate for this account.`;
  } catch (error) {
    // Show the problem but leave the certificate button available.
    console.error("Could not load certificate status:", error);
    const errorDetails = 
    [error.code, error.message].filter(Boolean).join(": ");
    status.textContent = `We could not check your certificate status${errorDetails ? ` (${errorDetails})` : ""}. You can still continue, but certificate generation will be allowed only if this account has not already created one.`;
  }
});

// Sign the person out when they press the sign-out button.
logoutButton.addEventListener("click", async () => {
  logoutButton.disabled = true;
  try {
    // End the Firebase session and go to the sign-in page.
    await signOut(auth);
    window.location.replace("Login.html");
  } catch (error) {
    // Tell the person if Firebase could not sign them out.
    console.error("Logout failed:", error);
    alert("We could not log you out. Please try again.");
    logoutButton.disabled = false;
  }
});
