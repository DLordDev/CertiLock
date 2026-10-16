// Bring in sign-in and safe-saving tools from Firebase.
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
import { doc, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";
import { auth, db } from "./firebase.js";

// Find the form, its button, and the email box.
const form = document.querySelector("#certForm");
const submitButton = form.querySelector('button[type="submit"]');
const emailInput = document.querySelector("#email");
let currentUser = null;
let accountReady = false;

// Wait for Firebase to tell us which person is signed in.
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    // Send signed-out visitors to the sign-in page.
    window.location.replace("Login.html");
    return;
  }

  // Remember the account and fill in its email.
  currentUser = user;
  emailInput.value = user.email || "";
  accountReady = true;
});

// Make text look the same even if someone uses different capital letters.
function normalize(value) {
  return value.trim().normalize("NFKC").toLocaleLowerCase("en-US");
}

// Turn certificate details into a short code for finding matching certificates.
async function makeFingerprint(certificate) {
  const fields = [
    certificate.fullName,
    certificate.registrationNumber,
    certificate.course,
    certificate.purpose,
    certificate.date
  ].map(normalize);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(fields)));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

// Put the certificate details onto a downloadable PDF page.
function makePdf(certificate) {
  if (!window.jspdf?.jsPDF) {
    throw new Error("The certificate PDF service did not load. Please refresh and try again.");
  }

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF();
  pdf.setFontSize(22);
  pdf.text("CERTILOCK - Certificate", 60, 20);
  pdf.setFontSize(16);
  pdf.text("Certificate of Clearance", 70, 35);
  pdf.setFontSize(12);
  const details = [
    `This certifies that ${certificate.fullName}`,
    `Registration No: ${certificate.registrationNumber}`,
    `Email: ${certificate.email}`,
    `Course: ${certificate.course}`,
    `Purpose: ${certificate.purpose}`,
    `Date Issued: ${certificate.date}`,
    `Certificate ID: ${certificate.certificateId}`
  ];
  let y = 60;
  // Split long details onto new lines so they fit on the page.
  for (const detail of details) {
    const lines = pdf.splitTextToSize(detail, 170);
    pdf.text(lines, 20, y);
    y += lines.length * 7;
  }
  pdf.text("Verified via CertiLock System", 20, y + 6);
  return pdf;
}

// Save the certificate when the user sends the form.
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  // Wait until Firebase has confirmed who is signed in.
  if (!accountReady || !currentUser) {
    alert("Please wait while we verify your account, then try again.");
    return;
  }

  // Let the browser point out any fields that were left blank.
  if (!form.reportValidity()) {
    return;
  }

  submitButton.disabled = true;
  // Gather the form details and add account information from Firebase.
  const certificate = {
    uid: currentUser.uid,
    fullName: document.querySelector("#fullname").value.trim(),
    registrationNumber: document.querySelector("#RegistrationNumber").value.trim(),
    email: currentUser.email || "",
    course: document.querySelector("#course").value,
    purpose: document.querySelector("#purpose").value.trim(),
    date: document.querySelector("#date").value,
    certificateId: `CERT-${crypto.randomUUID().toUpperCase()}`
  };

  try {
    // Do not allow blank details or an account without an email.
    if (!certificate.fullName || !certificate.registrationNumber || !certificate.purpose) {
      throw new Error("Please enter a name, registration number, and purpose without leaving them blank.");
    }

    if (!certificate.email) {
      throw new Error("Your account does not have an email address. Please log in with a valid account.");
    }

    // Make matching text into a code, then prepare the two saved record locations.
    const fingerprint = await makeFingerprint(certificate);
    const certificateRef = doc(db, "certificates", currentUser.uid);
    const fingerprintRef = doc(db, "certificateFingerprints", fingerprint);
    const pdf = makePdf(certificate);

    // Save both records together so neither can be saved without the other.
    await runTransaction(db, async (transaction) => {
      const existingCertificate = await transaction.get(certificateRef);
      if (existingCertificate.exists()) {
        // One account can only create one certificate.
        const error = new Error("You have already created a certificate.");
        error.code = "certificate/already-exists";
        throw error;
      }

      const duplicate = await transaction.get(fingerprintRef);
      if (duplicate.exists()) {
        // Stop two accounts from making certificates with the same details.
        const error = new Error("A certificate with the same details already exists.");
        error.code = "certificate/duplicate-details";
        throw error;
      }

      const createdAt = serverTimestamp();
      transaction.set(certificateRef, {
        ...certificate,
        fingerprint,
        createdAt
      });
      transaction.set(fingerprintRef, {
        createdAt
      });
    });

    // Download the finished PDF and return to the about page.
    pdf.save(`${certificate.fullName}_certificate.pdf`);
    alert("You have successfully generated your certificate.");
    window.location.replace("About.html");
  } catch (error) {
    // Show a clear message for a used account, duplicate details, or another problem.
    console.error("Certificate generation failed:", error);
    if (error.code === "certificate/already-exists") {
      alert("Sorry, you cannot do that. You have already created a certificate, and its details cannot be changed.");
      window.location.replace("About.html");
    } else if (error.code === "certificate/duplicate-details") {
      alert("Sorry, a certificate with the same details already exists.");
    } else {
      const errorDetails = [error.code, error.message].filter(Boolean).join(": ");
      alert(`We could not generate your certificate. Your details have not been saved.${errorDetails ? `\n\nFirebase error: ${errorDetails}` : "\n\nCheck the browser console for details."}`);
    }
  } finally {
    // Let the user press the button again if saving did not work.
    submitButton.disabled = false;
  }
});
