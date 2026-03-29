import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, doc, updateDoc, deleteDoc, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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
let editingId = null;

// BMI CALCULATION
function calcBMI() {
    const w = parseFloat(document.getElementById('Weight').value);
    const h = parseFloat(document.getElementById('Height').value);
    if (w > 0 && h > 0) document.getElementById('BMI').value = (w / ((h/100)**2)).toFixed(1);
}
document.getElementById('Weight').oninput = calcBMI;
document.getElementById('Height').oninput = calcBMI;

// SAVE DATA
document.getElementById('hfForm').onsubmit = async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submitBtn');
    btn.disabled = true; btn.innerText = "Saving...";

    const data = {};
    const elements = document.getElementById('hfForm').elements;
    for (let el of elements) { if (el.id) data[el.id] = el.value; }
    data.lastUpdated = new Date().toISOString();

    try {
        if (editingId) {
            await updateDoc(doc(db, "patients", editingId), data);
            alert("✅ Data Updated Successfully!");
            editingId = null;
            document.getElementById('formTitle').innerText = "New Entry";
        } else {
            data.timestamp = new Date().toISOString();
            await addDoc(collection(db, "patients"), data);
            alert("✅ Data Saved Successfully!");
        }
        document.getElementById('hfForm').reset();
        btn.disabled = false; btn.innerText = "SAVE DATA";
    } catch (err) { alert("Error saving"); btn.disabled = false; }
};

// ADMIN PANEL
document.getElementById('adminBtn').onclick = async () => {
    if (prompt("Enter PIN:") !== "1234") return alert("Wrong PIN");
    const panel = document.getElementById('adminPanel');
    const tbody = document.getElementById('adminTableBody');
    panel.classList.remove('d-none');
    tbody.innerHTML = "Loading...";
    
    const snap = await getDocs(collection(db, "patients"));
    document.getElementById('totalPatients').innerText = snap.size;
    tbody.innerHTML = "";
    snap.forEach(s => {
        const d = s.data();
        const row = `<tr><td>${d.File_No}</td><td>${d.Name}</td><td>${d.Doctor_Name}</td>
        <td><button class="btn btn-sm btn-primary" onclick="window.editP('${s.id}')">Edit</button>
        <button class="btn btn-sm btn-danger" onclick="window.delP('${s.id}')">Del</button></td></tr>`;
        tbody.innerHTML += row;
    });
};

window.editP = async (id) => {
    editingId = id;
    const snap = await getDocs(query(collection(db, "patients"))); 
    snap.forEach(s => { if(s.id === id) {
        const d = s.data();
        for(let k in d) { if(document.getElementById(k)) document.getElementById(k).value = d[k]; }
    }});
    document.getElementById('formTitle').innerText = "Editing Patient";
    document.getElementById('adminPanel').classList.add('d-none');
    window.scrollTo(0, 500);
};

window.delP = async (id) => {
    if (confirm("Delete forever?")) {
        await deleteDoc(doc(db, "patients", id));
        alert("Deleted");
        document.getElementById('adminBtn').click();
    }
};

document.getElementById('closeAdminBtn').onclick = () => document.getElementById('adminPanel').classList.add('d-none');
