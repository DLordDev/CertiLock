// Bring in tools to check who is signed in, read their certificate, and sign out.
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";
import { auth, db } from "./firebase.js";

// Find the status words, certificate button, and sign-out button.
const status = document.querySelector("#certificate-status");
const generateLink = document.querySelector("#generate-link");
const editLink = document.querySelector("#edit-link");
const logoutButton = document.querySelector("#logout-btn");

// Check the account whenever Firebase tells us who is signed in.
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    // A signed-out visitor must sign in before using this page.
    window.location.replace("Login.html");
    return;
  }

  try {
    // Look for a certificate saved under this person's account.
    const certificate = await getDoc(doc(db, "certificates", user.uid));
    if (certificate.exists()) {
      const savedData = certificate.data();
      const edited = savedData.hasEdited === true || (savedData.editCount || 0) >= 1;
      status.textContent = edited
        ? "You have already generated and edited your certificate. Further online edits are not available."
        : "You have already generated your certificate. You may edit it once; your registration number and email will stay locked.";
      editLink.hidden = edited;
      return;
    }

    // Tell a person with no saved certificate that they can make one.
    status.textContent = `Welcome${user.displayName ? `, ${user.displayName}` : ""}. Logged in as ${user.email}. You can generate one certificate for this account.`;
    generateLink.hidden = false;
  } catch (error) {
    // Do not offer a create or edit action when the existing record cannot be checked.
    console.error("Could not load certificate status:", error);
    status.textContent = "We could not check your certificate status. Please refresh the page or contact support.";
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
