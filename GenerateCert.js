import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
import { doc, getDoc, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";
import { auth, db } from "./firebase.js";

const form = document.querySelector("#certForm");
const submitButton = form.querySelector('button[type="submit"]');
const nameInput = document.querySelector("#fullname");
const registrationInput = document.querySelector("#RegistrationNumber");
const emailInput = document.querySelector("#email");
const courseInput = document.querySelector("#course");
const purposeInput = document.querySelector("#purpose");
const dateInput = document.querySelector("#date");
const formTitle = document.querySelector("#form-title");
const editMode = new URLSearchParams(window.location.search).get("edit") === "1";
const editLimitMessage = "You have already edited your receipt once. You cannot edit it again online. Kindly go to the office to solve this problem. If you have any issues, please contact support.";

let currentUser = null;
let existingCertificate = null;
let accountReady = false;

function showEditLimit() {
  alert(`Edit Limit Reached\n\n${editLimitMessage}`);
  window.location.replace("About.html");
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.replace("Login.html");
    return;
  }

  currentUser = user;
  emailInput.value = user.email || "";

  if (editMode) {
    const certificateRef = doc(db, "certificates", user.uid);
    try {
      const savedCertificate = await getDoc(certificateRef);
      if (!savedCertificate.exists()) {
        alert("No receipt was found for your account to edit.");
        window.location.replace("About.html");
        return;
      }

      existingCertificate = savedCertificate.data();
      if ((existingCertificate.editCount || 0) >= 1 || existingCertificate.hasEdited === true) {
        showEditLimit();
        return;
      }

      nameInput.value = existingCertificate.fullName || "";
      registrationInput.value = existingCertificate.registrationNumber || "";
      registrationInput.disabled = true;
      emailInput.value = existingCertificate.email || "";
      emailInput.disabled = true;
      courseInput.value = existingCertificate.course || "";
      purposeInput.value = existingCertificate.purpose || "";
      dateInput.value = existingCertificate.date || "";
      formTitle.textContent = "Edit Receipt";
      submitButton.textContent = "Generate Updated Receipt";
    } catch (error) {
      console.error("Could not load the receipt for editing:", error);
      alert("We could not load your receipt for editing. Please try again.");
      window.location.replace("About.html");
      return;
    }
  }

  accountReady = true;
});

function normalize(value) {
  return value.trim().normalize("NFKC").toLocaleLowerCase("en-US");
}

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
  for (const detail of details) {
    const lines = pdf.splitTextToSize(detail, 170);
    pdf.text(lines, 20, y);
    y += lines.length * 7;
  }
  pdf.text("Verified via CertiLock System", 20, y + 6);
  return pdf;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!accountReady || !currentUser) {
    alert("Please wait while we verify your account, then try again.");
    return;
  }

  if (!form.reportValidity()) {
    return;
  }

  submitButton.disabled = true;
  const certificate = {
    uid: currentUser.uid,
    fullName: nameInput.value.trim(),
    registrationNumber: editMode ? existingCertificate.registrationNumber : registrationInput.value.trim(),
    email: editMode ? existingCertificate.email : currentUser.email || "",
    course: courseInput.value,
    purpose: purposeInput.value.trim(),
    date: dateInput.value,
    certificateId: `CERT-${crypto.randomUUID().toUpperCase()}`
  };

  try {
    if (!certificate.fullName || !certificate.registrationNumber || !certificate.purpose) {
      throw new Error("Please enter a name, registration number, and purpose without leaving them blank.");
    }
    if (!certificate.email) {
      throw new Error("Your account does not have an email address. Please log in with a valid account.");
    }

    const fingerprint = await makeFingerprint(certificate);
    const certificateRef = doc(db, "certificates", currentUser.uid);
    const fingerprintRef = doc(db, "certificateFingerprints", fingerprint);
    const pdf = makePdf(certificate);

    await runTransaction(db, async (transaction) => {
      const savedCertificate = await transaction.get(certificateRef);

      if (editMode) {
        if (!savedCertificate.exists()) {
          throw new Error("No receipt was found for your account to edit.");
        }

        const savedData = savedCertificate.data();
        if ((savedData.editCount || 0) >= 1 || savedData.hasEdited === true) {
          const error = new Error(editLimitMessage);
          error.code = "receipt/edit-limit-reached";
          throw error;
        }
        if (savedData.uid !== currentUser.uid) {
          throw new Error("You are not allowed to edit this receipt.");
        }

        const updatedCertificate = {
          ...certificate,
          registrationNumber: savedData.registrationNumber,
          email: savedData.email,
          fingerprint,
          createdAt: savedData.createdAt,
          editCount: 1,
          hasEdited: true,
          updatedAt: serverTimestamp()
        };

        if (fingerprint !== savedData.fingerprint) {
          const duplicate = await transaction.get(fingerprintRef);
          if (duplicate.exists()) {
            const error = new Error("A certificate with the same details already exists.");
            error.code = "certificate/duplicate-details";
            throw error;
          }
          transaction.set(fingerprintRef, { createdAt: serverTimestamp() });
        }

        transaction.update(certificateRef, updatedCertificate);
        return;
      }

      if (savedCertificate.exists()) {
        const error = new Error("You have already created a certificate.");
        error.code = "certificate/already-exists";
        throw error;
      }

      const duplicate = await transaction.get(fingerprintRef);
      if (duplicate.exists()) {
        const error = new Error("A certificate with the same details already exists.");
        error.code = "certificate/duplicate-details";
        throw error;
      }

      transaction.set(certificateRef, {
        ...certificate,
        fingerprint,
        editCount: 0,
        hasEdited: false,
        createdAt: serverTimestamp()
      });
      transaction.set(fingerprintRef, { createdAt: serverTimestamp() });
    });

    pdf.save(`${certificate.fullName}_certificate.pdf`);
    alert(editMode ? "You have successfully updated your receipt." : "You have successfully generated your certificate.");
    window.location.replace("About.html");
  } catch (error) {
    console.error(editMode ? "Receipt update failed:" : "Certificate generation failed:", error);

    if (error.code === "receipt/edit-limit-reached") {
      showEditLimit();
    } else if (editMode && error.code === "permission-denied") {
      try {
        const latestCertificate = await getDoc(doc(db, "certificates", currentUser.uid));
        const latestData = latestCertificate.data();
        if (latestData && ((latestData.editCount || 0) >= 1 || latestData.hasEdited === true)) {
          showEditLimit();
          return;
        }
      } catch (statusError) {
        console.error("Could not verify the receipt edit limit:", statusError);
      }
      alert("We could not update your receipt because the change was not allowed. Please try again or contact support.");
    } else if (error.code === "certificate/already-exists") {
      alert("Sorry, you cannot generate another certificate for this account.");
      window.location.replace("About.html");
    } else if (error.code === "certificate/duplicate-details") {
      alert("Sorry, a certificate with the same details already exists.");
    } else {
      const errorDetails = [error.code, error.message].filter(Boolean).join(": ");
      alert(`We could not ${editMode ? "update your receipt" : "generate your certificate"}. Your details have not been saved.${errorDetails ? `\n\nFirebase error: ${errorDetails}` : "\n\nCheck the browser console for details."}`);
    }
  } finally {
    submitButton.disabled = false;
  }
});
