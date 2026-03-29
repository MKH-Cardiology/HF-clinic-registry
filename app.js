import { initializeApp } from “https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js”;
import { getFirestore, collection, addDoc, doc, updateDoc, deleteDoc, query, where, getDocs } from “https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js”;

var firebaseConfig = {
apiKey: “AIzaSyAQ8wAh0gLV7-_lVEXXdIzZ7LmkMnshOiE”,
authDomain: “hf-clinic-registry.firebaseapp.com”,
projectId: “hf-clinic-registry”,
storageBucket: “hf-clinic-registry.firebasestorage.app”,
messagingSenderId: “898458296631”,
appId: “1:898458296631:web:85fea7a2c6661ae0563ab2”
};

var firebaseApp = initializeApp(firebaseConfig);
var db = getFirestore(firebaseApp);

var editingDocId = null;

// Global patient data cache — avoids putting JSON in onclick attributes
window._pc = {};

// =============================================
// SUCCESS POPUP — dynamically created, never in HTML
// =============================================
function showSuccess(title, message, fileNo) {
var old = document.getElementById(“successModal”);
if (old) old.remove();

```
var overlay = document.createElement("div");
overlay.id = "successModal";
overlay.className = "success-overlay";

var fileNoHtml = fileNo ? '<p class="fw-bold text-primary">File No: ' + fileNo + "</p>" : "";

overlay.innerHTML =
    '<div class="success-box">' +
    '<div style="width:80px;height:80px;border-radius:50%;background:#28a745;color:white;font-size:40px;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;">' +
    '<i class="fa-solid fa-check"></i></div>' +
    '<h3 style="color:#28a745;font-weight:800;">' + title + "</h3>" +
    '<p style="color:#555;font-size:0.95rem;">' + message + "</p>" +
    fileNoHtml +
    '<button class="btn btn-success fw-bold px-4 py-2" style="margin-top:15px;" id="successOkBtn">OK</button>' +
    "</div>";

document.body.appendChild(overlay);

document.getElementById("successOkBtn").addEventListener("click", function () {
    overlay.remove();
});
overlay.addEventListener("click", function (e) {
    if (e.target === overlay) overlay.remove();
});
```

}

// =============================================
// BUILD PATIENT CARD
// =============================================
function buildPatientCard(data, docId, isNewlySaved) {
window._pc[docId] = data;

```
var detailsTable = '<table class="table table-sm table-bordered mt-2" style="font-size:0.85rem;"><tbody>';
for (var key in data) {
    if (data[key] && key !== "timestamp" && key !== "lastUpdated") {
        var cleanKey = key.replace(/_/g, " ");
        detailsTable += "<tr><th class='w-25 bg-light'>" + cleanKey + "</th><td>" + data[key] + "</td></tr>";
    }
}
detailsTable += "</tbody></table>";

var borderColor = isNewlySaved ? "border-success" : "border-primary";
var headerHtml = isNewlySaved
    ? '<div class="card-header bg-success text-white fw-bold"><i class="fa-solid fa-check-circle me-2"></i>Patient Saved Successfully</div>'
    : "";

var dateStr = data.timestamp ? new Date(data.timestamp).toLocaleDateString() : new Date().toLocaleDateString();
var safeFileNo = (data.File_No || "report").toString().replace(/'/g, "");

return (
    '<div class="card border ' + borderColor + ' mb-3 shadow">' +
    headerHtml +
    '<div class="card-body" id="print-area-' + docId + '">' +
    '<h4 class="text-primary border-bottom pb-2"><i class="fa-solid fa-file-medical me-2"></i>' + (data.Name || "Unknown") + "</h4>" +
    '<p class="mb-1"><strong>File No:</strong> ' + (data.File_No || "N/A") + " | <strong>Civil ID:</strong> " + (data.Civil_ID || "N/A") + "</p>" +
    '<p class="mb-1"><strong>Entered By:</strong> <span class="badge bg-secondary">' + (data.Doctor_Name || "Unknown") + "</span></p>" +
    '<p class="mb-3 text-muted"><small>Record Date: ' + dateStr + "</small></p>" +
    detailsTable +
    "</div>" +
    '<div class="card-footer bg-white border-top-0 d-flex gap-2 flex-wrap">' +
    "<button class='btn btn-outline-primary fw-bold' onclick=\"window.loadEdit('" + docId + "')\">" +
    '<i class="fa-solid fa-pen-to-square me-1"></i>Edit</button>' +
    "<button class='btn btn-danger fw-bold shadow-sm' onclick=\"window.exportPDF('print-area-" + docId + "', '" + safeFileNo + "')\">" +
    '<i class="fa-solid fa-file-pdf me-1"></i>Download PDF</button>' +
    "<button class='btn btn-outline-danger fw-bold' onclick=\"window.deletePatient('" + docId + "')\">" +
    '<i class="fa-solid fa-trash me-1"></i>Delete</button>' +
    "</div></div>"
);
```

}

// =============================================
// SAVE / UPDATE
// =============================================
document.getElementById(“hfForm”).addEventListener(“submit”, async function (e) {
e.preventDefault();

```
var docName = document.getElementById("Doctor_Name").value;
var patName = document.getElementById("Name").value;
var civilId = document.getElementById("Civil_ID").value;
var fileNo = document.getElementById("File_No").value;

if (!docName || !patName || !civilId || !fileNo) {
    alert("⚠️ REQUIRED FIELDS MISSING:\n\n1. Doctor Name\n2. Patient Name\n3. Civil ID\n4. File No\n\nPlease fill all required fields.");
    return;
}

var submitBtn = document.getElementById("submitBtn");
submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-2"></i>Saving...';
submitBtn.disabled = true;

var patientData = {};
var elements = document.getElementById("hfForm").elements;
for (var i = 0; i < elements.length; i++) {
    var item = elements.item(i);
    if (item.id && item.tagName !== "BUTTON") {
        patientData[item.id] = item.value;
    }
}
patientData.lastUpdated = new Date().toISOString();

try {
    var docIdToRender = editingDocId;
    var dataToRender = Object.assign({}, patientData);
    var resultsDiv = document.getElementById("searchResults");

    if (editingDocId) {
        var patientRef = doc(db, "patients", editingDocId);
        await updateDoc(patientRef, patientData);
        showSuccess("Updated Successfully!", "Patient \"" + patName + "\" has been updated.", fileNo);
        editingDocId = null;
        document.getElementById("formTitle").innerHTML = '<i class="fa-solid fa-user-plus me-2 text-danger"></i>New Patient Entry';
        document.getElementById("cancelEditBtn").classList.add("d-none");
    } else {
        patientData.timestamp = new Date().toISOString();
        dataToRender.timestamp = patientData.timestamp;
        var docRef = await addDoc(collection(db, "patients"), patientData);
        docIdToRender = docRef.id;
        showSuccess("Saved Successfully!", "New patient \"" + patName + "\" added to the registry.", fileNo);
    }

    resultsDiv.innerHTML = buildPatientCard(dataToRender, docIdToRender, true);
    document.getElementById("hfForm").reset();
    submitBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up me-2"></i>Save Patient to Registry';
    submitBtn.disabled = false;
    window.scrollTo({ top: 0, behavior: "smooth" });

} catch (error) {
    console.error("Save error:", error);
    alert("❌ Error saving: " + error.message);
    submitBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up me-2"></i>Save Patient to Registry';
    submitBtn.disabled = false;
}
```

});

// =============================================
// SEARCH
// =============================================
document.getElementById(“searchBtn”).addEventListener(“click”, async function () {
var searchTerm = document.getElementById(“searchInput”).value.trim();
var resultsDiv = document.getElementById(“searchResults”);
resultsDiv.innerHTML = ‘<div class="text-primary fw-bold"><i class="fa-solid fa-spinner fa-spin me-2"></i>Searching…</div>’;

```
if (!searchTerm) {
    resultsDiv.innerHTML = '<span class="text-danger">Enter a Civil ID or File No.</span>';
    return;
}

try {
    var patientsRef = collection(db, "patients");
    var q = query(patientsRef, where("Civil_ID", "==", searchTerm));
    var snapshot = await getDocs(q);

    if (snapshot.empty) {
        q = query(patientsRef, where("File_No", "==", searchTerm));
        snapshot = await getDocs(q);
    }

    if (snapshot.empty) {
        resultsDiv.innerHTML = '<div class="alert alert-warning fw-bold">No patient found.</div>';
    } else {
        resultsDiv.innerHTML = "";
        snapshot.forEach(function (docSnap) {
            resultsDiv.innerHTML += buildPatientCard(docSnap.data(), docSnap.id, false);
        });
    }
} catch (error) {
    resultsDiv.innerHTML = '<div class="alert alert-danger">Search error: ' + error.message + "</div>";
}
```

});

// =============================================
// ADMIN PANEL
// =============================================
document.getElementById(“adminBtn”).addEventListener(“click”, async function () {
var pin = prompt(“Enter Admin PIN:”);
if (pin !== “1234”) {
if (pin !== null) alert(“Incorrect PIN.”);
return;
}

```
var adminPanel = document.getElementById("adminPanel");
var tbody = document.getElementById("adminTableBody");
var totalSpan = document.getElementById("totalPatients");
tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4"><i class="fa-solid fa-spinner fa-spin fa-2x text-primary"></i><br>Loading...</td></tr>';
adminPanel.classList.remove("d-none");
window.scrollTo({ top: 0, behavior: "smooth" });

try {
    var snapshot = await getDocs(collection(db, "patients"));
    tbody.innerHTML = "";
    totalSpan.innerText = snapshot.size;

    if (snapshot.empty) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-3">No patients yet.</td></tr>';
        return;
    }

    snapshot.forEach(function (docSnap) {
        var data = docSnap.data();
        var docId = docSnap.id;
        var dateStr = data.timestamp ? new Date(data.timestamp).toLocaleDateString() : "N/A";

        window._pc[docId] = data;

        tbody.innerHTML +=
            '<tr id="admin-row-' + docId + '">' +
            '<td class="fw-bold text-primary">' + (data.File_No || "N/A") + "</td>" +
            "<td>" + (data.Name || "N/A") + "</td>" +
            "<td>" + (data.Civil_ID || "N/A") + "</td>" +
            '<td><span class="badge bg-secondary">' + (data.Doctor_Name || "Unknown") + "</span></td>" +
            "<td>" + dateStr + "</td>" +
            "<td>" +
            '<div class="btn-group btn-group-sm">' +
            "<button class='btn btn-outline-primary' title='Edit' onclick=\"window.loadEdit('" + docId + "')\"><i class='fa-solid fa-pen-to-square'></i></button>" +
            "<button class='btn btn-outline-danger' title='Delete' onclick=\"window.deletePatient('" + docId + "')\"><i class='fa-solid fa-trash'></i></button>" +
            "<button class='btn btn-outline-dark' title='PDF' onclick=\"window.exportFromCache('" + docId + "')\"><i class='fa-solid fa-file-pdf'></i></button>" +
            "</div></td></tr>";
    });
} catch (err) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-danger">Error: ' + err.message + "</td></tr>";
}
```

});

document.getElementById(“closeAdminBtn”).addEventListener(“click”, function () {
document.getElementById(“adminPanel”).classList.add(“d-none”);
});

// =============================================
// GLOBAL: LOAD EDIT FROM CACHE
// =============================================
window.loadEdit = function (docId) {
var data = window._pc[docId];
if (!data) {
alert(“❌ Patient data not found. Please search or open Admin again.”);
return;
}
editingDocId = docId;

```
for (var key in data) {
    if (document.getElementById(key)) {
        document.getElementById(key).value = data[key];
    }
}

document.getElementById("formTitle").innerHTML = '<i class="fa-solid fa-pen-to-square me-2 text-primary"></i>Editing: ' + (data.Name || "");
document.getElementById("submitBtn").innerHTML = '<i class="fa-solid fa-floppy-disk me-2"></i>Update Patient Data';
document.getElementById("cancelEditBtn").classList.remove("d-none");
document.getElementById("adminPanel").classList.add("d-none");
document.getElementById("hfForm").scrollIntoView({ behavior: "smooth" });
```

};

// =============================================
// GLOBAL: CANCEL EDIT
// =============================================
document.getElementById(“cancelEditBtn”).addEventListener(“click”, function () {
editingDocId = null;
document.getElementById(“hfForm”).reset();
document.getElementById(“formTitle”).innerHTML = ‘<i class="fa-solid fa-user-plus me-2 text-danger"></i>New Patient Entry’;
document.getElementById(“submitBtn”).innerHTML = ‘<i class="fa-solid fa-cloud-arrow-up me-2"></i>Save Patient to Registry’;
document.getElementById(“cancelEditBtn”).classList.add(“d-none”);
});

// =============================================
// GLOBAL: DELETE PATIENT
// =============================================
window.deletePatient = async function (docId) {
var data = window._pc[docId];
var patientName = data ? data.Name : “this patient”;

```
var confirmed = confirm("⚠️ DELETE PATIENT\n\nPermanently delete \"" + patientName + "\"?\n\nThis CANNOT be undone.");
if (!confirmed) return;

try {
    await deleteDoc(doc(db, "patients", docId));
    showSuccess("Deleted", "Patient \"" + patientName + "\" removed from registry.", null);

    var row = document.getElementById("admin-row-" + docId);
    if (row) row.remove();

    var totalSpan = document.getElementById("totalPatients");
    var count = parseInt(totalSpan.innerText) || 0;
    if (count > 0) totalSpan.innerText = count - 1;

    var resultsDiv = document.getElementById("searchResults");
    if (resultsDiv.innerHTML.indexOf(docId) !== -1) {
        resultsDiv.innerHTML = '<div class="alert alert-info">Patient deleted. Search again.</div>';
    }

    delete window._pc[docId];
} catch (error) {
    alert("❌ Delete error: " + error.message);
}
```

};

// =============================================
// GLOBAL: PDF FROM CARD
// =============================================
window.exportPDF = function (elementId, fileNo) {
var element = document.getElementById(elementId);
if (!element) {
alert(“❌ Cannot find patient data to export.”);
return;
}
element.classList.remove(“card-body”);
var opt = {
margin: 0.5,
filename: “HF_Clinic_Report_” + fileNo + “.pdf”,
image: { type: “jpeg”, quality: 0.98 },
html2canvas: { scale: 2 },
jsPDF: { unit: “in”, format: “letter”, orientation: “portrait” }
};
html2pdf().set(opt).from(element).save().then(function () {
element.classList.add(“card-body”);
});
};

// =============================================
// GLOBAL: PDF FROM ADMIN CACHE
// =============================================
window.exportFromCache = function (docId) {
var data = window._pc[docId];
if (!data) {
alert(“❌ Patient data not found. Reload Admin panel.”);
return;
}

```
var tempDiv = document.createElement("div");
tempDiv.style.cssText = "position:absolute;left:-9999px;top:0;width:800px;background:white;padding:20px;";

var tableRows = "";
for (var key in data) {
    if (data[key] && key !== "timestamp" && key !== "lastUpdated") {
        var cleanKey = key.replace(/_/g, " ");
        tableRows += "<tr><th style='background:#f8f9fa;width:30%;padding:6px 10px;border:1px solid #dee2e6;font-size:13px;'>" + cleanKey + "</th><td style='padding:6px 10px;border:1px solid #dee2e6;font-size:13px;'>" + data[key] + "</td></tr>";
    }
}

var dateStr = data.timestamp ? new Date(data.timestamp).toLocaleDateString() : "N/A";

tempDiv.innerHTML =
    "<div style='text-align:center;margin-bottom:20px;'>" +
    "<h2 style='color:#8b0000;margin:0;'>Mubarak Al-Kabeer Hospital</h2>" +
    "<h4 style='color:#555;margin:5px 0;'>Heart Failure Clinic — Patient Report</h4>" +
    "<hr style='border-color:#8b0000;'></div>" +
    "<h3 style='color:#0d6efd;'>" + (data.Name || "Unknown") + "</h3>" +
    "<p><strong>File No:</strong> " + (data.File_No || "N/A") + " | <strong>Civil ID:</strong> " + (data.Civil_ID || "N/A") + "</p>" +
    "<p><strong>Entered By:</strong> " + (data.Doctor_Name || "Unknown") + " | <strong>Date:</strong> " + dateStr + "</p>" +
    "<table style='width:100%;border-collapse:collapse;margin-top:15px;'>" + tableRows + "</table>";

document.body.appendChild(tempDiv);

var opt = {
    margin: 0.5,
    filename: "HF_Clinic_Report_" + (data.File_No || "unknown") + ".pdf",
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { unit: "in", format: "letter", orientation: "portrait" }
};

html2pdf().set(opt).from(tempDiv).save().then(function () {
    tempDiv.remove();
});
```

};
