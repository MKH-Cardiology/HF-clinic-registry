import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, doc, updateDoc, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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

let editingDocId = null; 

// --- AUTO CALCULATE BMI ---
const weightInput = document.getElementById('Weight');
const heightInput = document.getElementById('Height');
const bmiInput = document.getElementById('BMI');

function calculateBMI() {
    const w = parseFloat(weightInput.value);
    const h = parseFloat(heightInput.value);
    if (w > 0 && h > 0) {
        const heightInMeters = h / 100;
        const bmi = w / (heightInMeters * heightInMeters);
        bmiInput.value = bmi.toFixed(1); // Rounds to 1 decimal place
    } else {
        bmiInput.value = '';
    }
}
weightInput.addEventListener('input', calculateBMI);
heightInput.addEventListener('input', calculateBMI);

// --- Build Patient Card ---
function buildPatientCard(data, docId, isNewlySaved = false) {
    let detailsTable = '<table class="table table-sm table-bordered mt-2" style="font-size: 0.85rem;"><tbody>';
    for (let key in data) {
        if(data[key] && key !== 'timestamp' && key !== 'lastUpdated') {
            let cleanKey = key.replace(/_/g, ' '); 
            detailsTable += `<tr><th class="w-25 bg-light">${cleanKey}</th><td>${data[key]}</td></tr>`;
        }
    }
    detailsTable += '</tbody></table>';

    const borderColor = isNewlySaved ? 'border-success' : 'border-primary';
    const headerHtml = isNewlySaved 
        ? `<div class="card-header bg-success text-white fw-bold"><i class="fa-solid fa-check-circle me-2"></i>Patient Saved Successfully</div>` 
        : '';

    return `
        <div class="card border ${borderColor} mb-3 shadow">
            ${headerHtml}
            <div class="card-body" id="print-area-${docId}">
                <h4 class="text-primary border-bottom pb-2">
                    <i class="fa-solid fa-file-medical me-2"></i>${data.Name || 'Unknown Patient'}
                </h4>
                <p class="mb-1"><strong>File No:</strong> ${data.File_No} | <strong>Civil ID:</strong> ${data.Civil_ID}</p>
                <p class="mb-1"><strong>Entered By:</strong> <span class="badge bg-secondary">${data.Doctor_Name || 'Unknown'}</span></p>
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

// --- SAVE OR UPDATE DATA ---
document.getElementById('hfForm').addEventListener('submit', async (e) => {
    e.preventDefault(); 
    
    // --- LOUD VALIDATION CHECK FOR MOBILE ---
    const docName = document.getElementById('Doctor_Name').value;
    const patName = document.getElementById('Name').value;
    const civilId = document.getElementById('Civil_ID').value;
    const fileNo = document.getElementById('File_No').value;
    
    if (!docName || !patName || !civilId || !fileNo) {
        alert("⚠️ PLEASE STOP:\nYou must fill out:\n1. Doctor Name\n2. Patient Name\n3. Civil ID\n4. File No\nbefore the app will let you save!");
        return; // Stops the save process immediately
    }

    const submitBtn = document.getElementById('submitBtn');
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-2"></i>Saving...';
    submitBtn.disabled = true;

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
            const patientRef = doc(db, "patients", editingDocId);
            await updateDoc(patientRef, patientData);
            alert(`✅ Success! File No: ${patientData.File_No} has been updated.`);
            editingDocId = null;
            document.getElementById('formTitle').innerHTML = '<i class="fa-solid fa-user-plus me-2 text-danger"></i>New Patient Entry';
            document.getElementById('cancelEditBtn').classList.add('d-none');
        } else {
            patientData.timestamp = new Date().toISOString();
            dataToRender.timestamp = patientData.timestamp;
            const docRef = await addDoc(collection(db, "patients"), patientData);
            docIdToRender = docRef.id;
            alert(`✅ Success! New patient has been added to the Registry.`);
        }

        // IMMEDIATELY SHOW THE PDF BUTTON AND PATIENT FILE
        resultsDiv.innerHTML = buildPatientCard(dataToRender, docIdToRender, true);
        
        document.getElementById('hfForm').reset(); 
        submitBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up me-2"></i>Save Patient to Registry';
        submitBtn.disabled = false;
        
        // SCROLL TO TOP TO SEE PDF BUTTON
        window.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (error) {
        console.error("Error saving: ", error);
        alert("❌ Error saving data. Please check your connection.");
        submitBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up me-2"></i>Save Patient to Registry';
        submitBtn.disabled = false;
    }
});

// --- SEARCH ---
document.getElementById('searchBtn').addEventListener('click', async () => {
    const searchTerm = document.getElementById('searchInput').value;
    const resultsDiv = document.getElementById('searchResults');
    resultsDiv.innerHTML = "<div class='text-primary fw-bold'><i class='fa-solid fa-spinner fa-spin me-2'></i>Searching...</div>";

    if (!searchTerm) {
        resultsDiv.innerHTML = "<span class='text-danger'>Enter ID or File No.</span>";
        return;
    }

    try {
        const patientsRef = collection(db, "patients");
        let q = query(patientsRef, where("Civil_ID", "==", searchTerm));
        let querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            q = query(patientsRef, where("File_No", "==", searchTerm));
            querySnapshot = await getDocs(q);
        }

        if (querySnapshot.empty) {
            resultsDiv.innerHTML = "<div class='alert alert-warning fw-bold'>No patient found.</div>";
        } else {
            resultsDiv.innerHTML = "";
            querySnapshot.forEach((docSnap) => {
                resultsDiv.innerHTML += buildPatientCard(docSnap.data(), docSnap.id, false);
            });
        }
    } catch (error) {
        resultsDiv.innerHTML = "<div class='alert alert-danger'>Error searching.</div>";
    }
});

// --- ADMIN DASHBOARD ---
document.getElementById('adminBtn').addEventListener('click', async () => {
    const pin = prompt("Enter Admin PIN:");
    if (pin !== "1234") {
        alert("Incorrect PIN.");
        return;
    }

    const adminPanel = document.getElementById('adminPanel');
    const tbody = document.getElementById('adminTableBody');
    const totalSpan = document.getElementById('totalPatients');
    tbody.innerHTML = "<tr><td colspan='6' class='text-center py-4'><i class='fa-solid fa-spinner fa-spin fa-2x text-primary'></i><br>Loading Database...</td></tr>";
    adminPanel.classList.remove('d-none');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    try {
        const querySnapshot = await getDocs(collection(db, "patients"));
        tbody.innerHTML = "";
        totalSpan.innerText = querySnapshot.size; // Updates the total number of patients
        
        if(querySnapshot.empty) {
            tbody.innerHTML = "<tr><td colspan='6' class='text-center py-3'>No patients in the database yet.</td></tr>";
            return;
        }

        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const docId = docSnap.id;
            const dateStr = data.timestamp ? new Date(data.timestamp).toLocaleDateString() : 'N/A';
            
            tbody.innerHTML += `
                <tr>
                    <td class="fw-bold text-primary">${data.File_No || 'N/A'}</td>
                    <td>${data.Name || 'N/A'}</td>
                    <td>${data.Civil_ID || 'N/A'}</td>
                    <td><span class="badge bg-secondary">${data.Doctor_Name || 'Unknown'}</span></td>
                    <td>${dateStr}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary" onclick="window.editPatient('${docId}', '${encodeURIComponent(JSON.stringify(data))}')">
                            <i class="fa-solid fa-eye"></i> View
                        </button>
                    </td>
                </tr>`;
        });
    } catch(err) {
        tbody.innerHTML = "<tr><td colspan='6' class='text-danger'>Error loading database.</td></tr>";
    }
});

document.getElementById('closeAdminBtn').addEventListener('click', () => {
    document.getElementById('adminPanel').classList.add('d-none');
});

// --- GLOBAL FUNCTIONS ---
window.editPatient = function(docId, dataString) {
    const data = JSON.parse(decodeURIComponent(dataString));
    editingDocId = docId;
    
    for (let key in data) {
        if (document.getElementById(key)) {
            document.getElementById(key).value = data[key];
        }
    }
    
    document.getElementById('formTitle').innerHTML = '<i class="fa-solid fa-pen-to-square me-2 text-primary"></i>Editing Patient: ' + (data.Name || '');
    document.getElementById('submitBtn').innerHTML = '<i class="fa-solid fa-floppy-disk me-2"></i>Update Patient Data';
    document.getElementById('cancelEditBtn').classList.remove('d-none');
    document.getElementById('adminPanel').classList.add('d-none');
    document.getElementById('hfForm').scrollIntoView({ behavior: 'smooth' });
};

document.getElementById('cancelEditBtn').addEventListener('click', () => {
    editingDocId = null;
    document.getElementById('hfForm').reset();
    document.getElementById('formTitle').innerHTML = '<i class="fa-solid fa-user-plus me-2 text-danger"></i>New Patient Entry';
    document.getElementById('submitBtn').innerHTML = '<i class="fa-solid fa-cloud-arrow-up me-2"></i>Save Patient to Registry';
    document.getElementById('cancelEditBtn').classList.add('d-none');
});

window.exportPDF = function(elementId, fileNo) {
    const element = document.getElementById(elementId);
    element.classList.remove('card-body');
    const opt = {
      margin:       0.5,
      filename:     `HF_Clinic_Report_${fileNo}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2 },
      jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save().then(() => {
        element.classList.add('card-body');
    });
};
