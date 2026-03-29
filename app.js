import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAQ8wAh0gLV7-_lVEXXdIzZ7LmkMnshOiE",
  authDomain: "hf-clinic-registry.firebaseapp.com",
  projectId: "hf-clinic-registry",
  storageBucket: "hf-clinic-registry.firebasestorage.app",
  messagingSenderId: "898458296631",
  appId: "1:898458296631:web:85fea7a2c6661ae0563ab2"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- SAVE PATIENT DATA ---
document.getElementById('hfForm').addEventListener('submit', async (e) => {
    e.preventDefault(); 
    
    // Grabs every input from the HTML
    const patientData = {
        name: document.getElementById('name').value,
        civilId: document.getElementById('civilId').value,
        fileNo: document.getElementById('fileNo').value,
        age: document.getElementById('age').value,
        gender: document.getElementById('gender').value,
        nationality: document.getElementById('nationality').value,
        mobile: document.getElementById('mobile').value,
        hfType: document.getElementById('hfType').value,
        advancedHf: document.getElementById('advancedHf').value,
        ef: document.getElementById('ef').value,
        nyha: document.getElementById('nyha').value,
        otherCardio: document.getElementById('otherCardio').value,
        valveDisease: document.getElementById('valveDisease').value,
        dryWeight: document.getElementById('dryWeight').value,
        device: document.getElementById('device').value,
        admissions: document.getElementById('admissions').value,
        lastAdmission: document.getElementById('lastAdmission').value,
        los: document.getElementById('los').value,
        lbbb: document.getElementById('lbbb').value,
        qrs: document.getElementById('qrs').value,
        arrhythmia: document.getElementById('arrhythmia').value,
        ecg: document.getElementById('ecg').value,
        echo: document.getElementById('echo').value,
        cmr: document.getElementById('cmr').value,
        dm: document.getElementById('dm').value,
        htn: document.getElementById('htn').value,
        ihd: document.getElementById('ihd').value,
        af: document.getElementById('af').value,
        smoker: document.getElementById('smoker').value,
        ckd: document.getElementById('ckd').value,
        cva: document.getElementById('cva').value,
        pci: document.getElementById('pci').value,
        cabg: document.getElementById('cabg').value,
        dyslip: document.getElementById('dyslip').value,
        quad: document.getElementById('quad').value,
        triple: document.getElementById('triple').value,
        mortality: document.getElementById('mortality').value,
        timestamp: new Date().toISOString()
    };

    try {
        await addDoc(collection(db, "patients"), patientData);
        alert("Success! Patient data saved to Mubarak Al-Kabeer Registry.");
        document.getElementById('hfForm').reset(); 
    } catch (error) {
        console.error("Error adding document: ", error);
        alert("Error saving data. Check console for details.");
    }
});

// --- SEARCH PATIENT DATA ---
document.getElementById('searchBtn').addEventListener('click', async () => {
    const searchTerm = document.getElementById('searchInput').value;
    const resultsDiv = document.getElementById('searchResults');
    resultsDiv.innerHTML = "Searching...";

    if (!searchTerm) {
        resultsDiv.innerHTML = "<span class='text-danger'>Please enter a Civil ID or File No.</span>";
        return;
    }

    try {
        const patientsRef = collection(db, "patients");
        // Search by Civil ID first
        let q = query(patientsRef, where("civilId", "==", searchTerm));
        let querySnapshot = await getDocs(q);

        // If no Civil ID matches, try File No
        if (querySnapshot.empty) {
            q = query(patientsRef, where("fileNo", "==", searchTerm));
            querySnapshot = await getDocs(q);
        }

        if (querySnapshot.empty) {
            resultsDiv.innerHTML = "<div class='alert alert-warning'>No patient found with that ID or File No.</div>";
        } else {
            resultsDiv.innerHTML = "";
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                resultsDiv.innerHTML += `
                    <div class="alert alert-success">
                        <strong>Patient Found:</strong> ${data.name} (File: ${data.fileNo})<br>
                        <strong>HF Type:</strong> ${data.hfType} | <strong>EF:</strong> ${data.ef}% | <strong>NYHA:</strong> ${data.nyha}<br>
                        <small class="text-muted">Record created: ${new Date(data.timestamp).toLocaleDateString()}</small>
                    </div>`;
            });
        }
    } catch (error) {
        console.error("Search error:", error);
        resultsDiv.innerHTML = "<div class='alert alert-danger'>Error performing search.</div>";
    }
});
