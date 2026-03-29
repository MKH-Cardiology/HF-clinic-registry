import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, doc, updateDoc, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Your exact Firebase configuration
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

// State tracking for editing
let editingDocId = null; 

// --- HELPER FUNCTION: Build the Patient Result Card ---
// We use this function for both searching AND immediately after saving
function buildPatientCard(data, docId, isNewlySaved = false) {
    let detailsTable = '<table class="table table-sm table-bordered mt-2" style="font-size: 0.85rem;"><tbody>';
    for (let key in data) {
        if(data[key] && key !== 'timestamp' && key !== 'lastUpdated') {
            let cleanKey = key.replace(/_/g, ' '); // Removes underscores for better reading
            detailsTable += `<tr><th class="w-25 bg-light">${cleanKey}</th><td>${data[key]}</td></tr>`;
        }
    }
    detailsTable += '</tbody></table>';

    // Change border color to green if it was just saved, otherwise keep it blue for search
    const borderColor = isNewlySaved ? 'border-success' : 'border-primary';
    const headerHtml = isNewlySaved 
        ? `<div class="card-header bg-success text-white fw-bold"><i class="fa-solid fa-check-circle me-2"></i>Patient Successfully Saved to Registry</div>` 
        : '';

    return `
        <div class="card border ${borderColor} mb-3 shadow">
            ${headerHtml}
            <div class="card-body" id="print-area-${docId}">
                <h4 class="text-primary border-bottom pb-2">
                    <i class="fa-solid fa-file-medical me-2"></i>${data.Name || 'Unknown Patient'}
                </h4>
                <p class="mb-1"><strong>File No:</strong> ${data.File_No} | <strong>Civil ID:</strong> ${data.Civil_ID}</p>
                <p class="mb-3 text-muted"><small>Record Date: ${data.timestamp ? new Date(data.timestamp).toLocaleDateString() : new Date().toLocaleDateString()}</small></p>
                ${detailsTable}
            </div>
            <div class="card-footer bg-white border-top-0 d-flex gap-2">
                <button class="btn btn-outline-primary fw-bold" onclick="window.editPatient('${docId}', '${encodeURIComponent(JSON.stringify(data))}')">
                    <i class="fa-solid fa-pen-to-square me-1"></i>Edit Data
                </button>
                <button class="btn btn-danger fw-bold shadow-sm" onclick="window.exportPDF('print-area-${docId}', '${data.File_No}')">
                    <i class="fa-solid fa-file-pdf me-1"></i>Download PDF Report
                </button>
            </div>
        </div>`;
}

// --- SAVE OR UPDATE PATIENT DATA ---
document.getElementById('hfForm').addEventListener('submit', async (e) => {
    e.preventDefault(); 
    
    // Change button to show loading status
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-2"></i>Saving to Cloud...';
    submitBtn.disabled = true;

    // Dynamically grab EVERY input in the form
    const patientData = {};
    const elements = document.getElementById('hfForm').elements;
    for (let i = 0; i < elements.length; i++) {
        let item = elements.item(i);
        if (item.id && item.tagName !== 'BUTTON') {
            patientData[item.id] = item.value;
        }
    }
    patientData.lastUpdated = new Date().toISOString();

    try {
        let docIdToRender = editingDocId;
        let dataToRender = { ...patientData };
        const resultsDiv = document.getElementById('searchResults');

        if (editingDocId) {
            // UPDATE EXISTING PATIENT
            const patientRef = doc(db, "patients", editingDocId);
            await updateDoc(patientRef, patientData);
            alert(`Success! File No: ${patientData.File_No} has been updated.`);
            
            // Reset UI states
            editingDocId = null;
            document.getElementById('formTitle').innerHTML = '<i class="fa-solid fa-user-plus me-2 text-danger"></i>New Patient Entry';
            document.getElementById('cancelEditBtn').classList.add('d-none');
        } else {
            // SAVE NEW PATIENT
            patientData.timestamp = new Date().toISOString();
            dataToRender.timestamp = patientData.timestamp;
            const docRef = await addDoc(collection(db, "patients"), patientData);
            docIdToRender = docRef.id;
            alert(`Success! New Patient (File No: ${patientData.File_No}) added to Registry.`);
        }

        // IMMEDIATELY SHOW THE SAVED PATIENT AND PDF BUTTON
        resultsDiv.innerHTML = buildPatientCard(dataToRender, docIdToRender, true);

        // Reset the form inputs
        document.getElementById('hfForm').reset(); 
        
        // Restore the save button
        submitBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up me-2"></i>Save Patient to Registry';
        submitBtn.disabled = false;

        // Smoothly scroll the screen back up to the top so you can see the PDF button
        window.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (error) {
        console.error("Error saving: ", error);
        alert("Error saving data. Please check your internet connection.");
        submitBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up me-2"></i>Save Patient to Registry';
        submitBtn.disabled = false;
    }
});

// Cancel Edit Button
document.getElementById('cancelEditBtn').addEventListener('click', () => {
    editingDocId = null;
    document.getElementById('hfForm').reset();
    document.getElementById('formTitle').innerHTML = '<i class="fa-solid fa-user-plus me-2 text-danger"></i>New Patient Entry';
    document.getElementById('submitBtn').innerHTML = '<i class="fa-solid fa-cloud-arrow-up me-2"></i>Save Patient to Registry';
    document.getElementById('cancelEditBtn').classList.add('d-none');
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

// --- SEARCH PATIENT DATA ---
document.getElementById('searchBtn').addEventListener('click', async () => {
    const searchTerm = document.getElementById('searchInput').value;
    const resultsDiv = document.getElementById('searchResults');
    resultsDiv.innerHTML = "<div class='text-primary fw-bold'><i class='fa-solid fa-spinner fa-spin me-2'></i>Searching database...</div>";

    if (!searchTerm) {
        resultsDiv.innerHTML = "<span class='text-danger'>Please enter a Civil ID or File No.</span>";
        return;
    }

    try {
        const patientsRef = collection(db, "patients");
        // Check Civil ID first
        let q = query(patientsRef, where("Civil_ID", "==", searchTerm));
        let querySnapshot = await getDocs(q);

        // Check File No if Civil ID is empty
        if (querySnapshot.empty) {
            q = query(patientsRef, where("File_No", "==", searchTerm));
            querySnapshot = await getDocs(q);
        }

        if (querySnapshot.empty) {
            resultsDiv.innerHTML = "<div class='alert alert-warning fw-bold'>No patient found with that ID or File No.</div>";
        } else {
            resultsDiv.innerHTML = "";
            querySnapshot.forEach((docSnap) => {
                const data = docSnap.data();
                const docId = docSnap.id;
                // Render the card normally for search results
                resultsDiv.innerHTML += buildPatientCard(data, docId, false);
            });
        }
    } catch (error) {
        console.error("Search error:", error);
        resultsDiv.innerHTML = "<div class='alert alert-danger'>Error performing search.</div>";
    }
});

// --- GLOBAL FUNCTIONS FOR BUTTONS ---
// Function to load data back into the form for editing
window.editPatient = function(docId, dataString) {
    const data = JSON.parse(decodeURIComponent(dataString));
    editingDocId = docId;
    
    // Fill all form fields dynamically
    for (let key in data) {
        if (document.getElementById(key)) {
            document.getElementById(key).value = data[key];
        }
    }
    
    // Update UI to show Editing Mode
    document.getElementById('formTitle').innerHTML = '<i class="fa-solid fa-pen-to-square me-2 text-primary"></i>Editing Patient: ' + (data.Name || '');
    document.getElementById('submitBtn').innerHTML = '<i class="fa-solid fa-floppy-disk me-2"></i>Update Patient Data';
    document.getElementById('cancelEditBtn').classList.remove('d-none');
    
    // Scroll down to the form so you can start editing
    document.getElementById('hfForm').scrollIntoView({ behavior: 'smooth' });
};

// Function to generate and download PDF
window.exportPDF = function(elementId, fileNo) {
    const element = document.getElementById(elementId);
    
    // Briefly hide the borders and shadows just for the PDF printing
    element.classList.remove('card-body');
    
    const opt = {
      margin:       0.5,
      filename:     `HF_Clinic_Report_${fileNo}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2 },
      jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
    };
    
    // Generate PDF and then restore the CSS classes
    html2pdf().set(opt).from(element).save().then(() => {
        element.classList.add('card-body');
    });
};
