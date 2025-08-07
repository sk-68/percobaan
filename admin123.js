// === Inisialisasi Firebase ===

const db = window.db;
const auth = window.auth;


// === Real-Time Jam ===

setInterval(() => {
  const now = new Date();
  const tanggal = now.toLocaleDateString("id-ID", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  });

  const waktu = now.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });

  document.getElementById("datetime").textContent = `${tanggal} • ${waktu}`;
}, 1000);


// === Navigasi Menu ===
const pageTitle = document.getElementById("page-title");
const contentArea = document.getElementById("content-area");

// Fungsi untuk aktifkan menu yang diklik
function setActiveMenu(clickedId) {
  document.querySelectorAll(".sidebar button").forEach((el) => {
    el.classList.remove("active-submenu");
  });
  document.getElementById(clickedId).classList.add("active-submenu");
}

// Event Listener Menu
document.getElementById("menu-dashboard").addEventListener("click", () => {
  pageTitle.textContent = "Dashboard";
  setActiveMenu("menu-dashboard");
  showDashboard();
});

document.getElementById("menu-akun").addEventListener("click", () => {
  pageTitle.textContent = "Manajemen Akun";
  setActiveMenu("menu-akun");
  showAkun();
});

document.getElementById("menu-jadwal").addEventListener("click", () => {
  pageTitle.textContent = "Jadwal Kuliah";
  setActiveMenu("menu-jadwal");
  showJadwal();
});

document.getElementById("menu-kalender").addEventListener("click", () => {
  pageTitle.textContent = "Kalender Akademik";
  setActiveMenu("menu-kalender");
  showKalender();
});

// === Show Dashboard ===
function showDashboard() {
  contentArea.innerHTML = `<p>Memuat data...</p>`;
  Promise.all([
    db.collection("users").where("role", "==", "mahasiswa").get(),
    db.collection("users").where("role", "==", "dosen").get(),
    db.collection("jadwal").get(),
    db.collection("kalender").get()
  ])
  .then(([mhs, dosen, jadwal, kalender]) => {
    contentArea.innerHTML = `
      <h2>Selamat Datang Admin!</h2>
      <div style="display:grid;gap:15px;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));margin-top:20px;">
        <div style="background:#eee;padding:15px;border-radius:10px"><h3>Mahasiswa</h3><p>${mhs.size}</p></div>
        <div style="background:#eee;padding:15px;border-radius:10px"><h3>Dosen</h3><p>${dosen.size}</p></div>
        <div style="background:#eee;padding:15px;border-radius:10px"><h3>Jadwal</h3><p>${jadwal.size}</p></div>
        <div style="background:#eee;padding:15px;border-radius:10px"><h3>Kalender</h3><p>${kalender.size}</p></div>
      </div>
    `;
  })
  .catch(error => {
    contentArea.innerHTML = `<p>Error memuat data: ${error.message}</p>`;
  });
}

// === Show Akun ===
function showAkun() {
  contentArea.innerHTML = `
    <h2>Tambah Akun</h2>
    <form id="akun-form">
      <input type="text" id="nama" placeholder="Nama Lengkap" required />
      <input type="text" id="id" placeholder="ID / NIM / NIP" required />
      <input type="email" id="email" placeholder="Email (contoh: user@gmail.com)" required />
      <input type="password" id="password" placeholder="Password" required />
      <select id="role" required>
        <option value="">Pilih Role</option>
        <option value="admin">Admin</option>
        <option value="dosen">Dosen</option>
        <option value="mahasiswa">Mahasiswa</option>
      </select>
      <div id="kelas-container" style="display:none">
        <input type="text" id="kelas" placeholder="Kelas (contoh: IH1)" />
      </div>
      <button type="submit">Tambah Akun</button>
    </form>

    <h2>Daftar Akun</h2>
    <table border="1" cellpadding="6" style="width:100%;margin-top:10px;">
      <thead>
        <tr>
          <th>Nama</th><th>ID</th><th>Email</th><th>Role</th><th>Status</th><th>Kelas</th><th>Aktivasi</th><th>Edit</th>
        </tr>
      </thead>
      <tbody id="akun-list"></tbody>
    </table>
  `;

  const form = document.getElementById("akun-form");
  const tbody = document.getElementById("akun-list");
  const roleSelect = document.getElementById("role");
  const kelasContainer = document.getElementById("kelas-container");

  roleSelect.addEventListener("change", () => {
    kelasContainer.style.display = roleSelect.value === "mahasiswa" ? "block" : "none";
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const email = form.email.value.trim().toLowerCase();
      const password = form.password.value;
      const role = form.role.value;
      const nama = form.nama.value.trim();
      const id = form.id.value.trim();

      if (!id) {
        alert("ID tidak boleh kosong!");
        return;
      }

      const { user } = await auth.createUserWithEmailAndPassword(email, password);
      
      const userData = {
        nama: nama,
        id: id,
        email: email,
        role: role,
        aktif: true,
        kelas: role === "mahasiswa" ? form.kelas.value.trim() : null
      };
      
      await db.collection("users").doc(user.uid).set(userData);
      alert("Akun berhasil ditambahkan!");
      form.reset();
      kelasContainer.style.display = "none";
      loadAkun();
    } catch (error) {
      alert(`Gagal menambahkan akun: ${error.message}`);
    }
  });

  async function loadAkun() {
    tbody.innerHTML = "<tr><td colspan='8'>Memuat data...</td></tr>";
    try {
      const snapshot = await db.collection("users").get();
      if (snapshot.empty) {
        tbody.innerHTML = "<tr><td colspan='8'>Tidak ada data akun</td></tr>";
        return;
      }

      const users = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));

      users.sort((a, b) => {
        const roleOrder = { admin: 1, dosen: 2, mahasiswa: 3 };
        const rA = roleOrder[a.role] || 99;
        const rB = roleOrder[b.role] || 99;
        return rA - rB || a.email.localeCompare(b.email);
      });

      tbody.innerHTML = "";
      users.forEach(user => {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${user.nama}</td>
          <td>${user.id || "-"}</td>
          <td>${user.email}</td>
          <td>${user.role}</td>
          <td>${user.aktif ? "Aktif" : "Nonaktif"}</td>
          <td>${user.role === "mahasiswa" ? (user.kelas || "-") : "-"}</td>
          <td><button data-action="toggle" data-uid="${user.uid}" data-status="${user.aktif}">${
            user.aktif ? "Nonaktifkan" : "Aktifkan"
          }</button></td>
          <td>${
            user.role === "mahasiswa"
              ? `<button data-action="edit-kelas" data-uid="${user.uid}" data-kelas="${user.kelas || ""}">Edit</button>`
              : "-"
          }</td>
        `;
        tbody.appendChild(row);
      });
    } catch (error) {
      tbody.innerHTML = `<tr><td colspan='8'>Error: ${error.message}</td></tr>`;
    }
  }

  contentArea.addEventListener("click", async (e) => {
    if (e.target.dataset.action === "toggle") {
      const { uid, status } = e.target.dataset;
      try {
        await db.collection("users").doc(uid).update({ aktif: status === "true" ? false : true });
        loadAkun();
      } catch (error) {
        alert(`Gagal mengubah status: ${error.message}`);
      }
    } else if (e.target.dataset.action === "edit-kelas") {
      const { uid, kelas } = e.target.dataset;
      const kelasBaru = prompt("Masukkan kelas baru:", kelas || "");
      if (kelasBaru === null) return;
      if (!kelasBaru.trim()) {
        alert("Kelas tidak boleh kosong.");
        return;
      }
      try {
        await db.collection("users").doc(uid).update({ kelas: kelasBaru.trim() });
        alert("Kelas berhasil diubah!");
        loadAkun();
      } catch (error) {
        alert(`Gagal mengubah kelas: ${error.message}`);
      }
    }
  });

  loadAkun();
}


// === Show Jadwal ===
function showJadwal() {
  contentArea.innerHTML = `
    <h2>Tambah Jadwal Kuliah</h2>
    <form id="jadwal-form">
      <input type="text" id="kode" placeholder="Kode Matkul" required />
      <input type="text" id="matkul" placeholder="Nama Mata Kuliah" required />
      <input type="text" id="kelas" placeholder="Kelas" required />
      <input type="text" id="dosen" placeholder="Nama Dosen" required />
      <input type="text" id="hari" placeholder="Hari (Senin, Selasa, ...)" required />
      <input type="text" id="jam" placeholder="Jam Mulai (misal 08.00)" required />
      <input type="text" id="jamSelesai" placeholder="Jam Selesai (misal 09.40)" required />
      <button type="submit">Simpan</button>
    </form>

    <h2>Daftar Jadwal</h2>
    <table border="1" cellpadding="6" style="width:100%;margin-top:10px;">
      <thead>
        <tr>
          <th>Kode</th><th>Matkul</th><th>Kelas</th><th>Dosen</th><th>Hari</th><th>Jam</th><th>Aksi</th>
        </tr>
      </thead>
      <tbody id="jadwal-list"></tbody>
    </table>
  `;

  const form = document.getElementById("jadwal-form");
  const tbody = document.getElementById("jadwal-list");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const data = {
        kode: form.kode.value.toUpperCase(), // Biar konsisten kapital
        matkul: form.matkul.value,
        kelas: form.kelas.value.toUpperCase(),
        dosen: form.dosen.value,
        hari: form.hari.value.toLowerCase(), // Biar bisa dicocokkan sama script lain
        jam: form.jam.value,
        jamSelesai: form.jamSelesai.value,
      };
      await db.collection("jadwal").add(data);
      alert("Jadwal ditambahkan!");
      form.reset();
      loadJadwal();
    } catch (error) {
      alert(`Gagal menambahkan jadwal: ${error.message}`);
    }
  });

  async function loadJadwal() {
    tbody.innerHTML = "<tr><td colspan='7'>Memuat data...</td></tr>";
    try {
      const snapshot = await db.collection("jadwal").orderBy("kode").get(); // 🔥 Sort berdasarkan kode
      tbody.innerHTML = "";

      if (snapshot.empty) {
        tbody.innerHTML = "<tr><td colspan='7'>Tidak ada data jadwal</td></tr>";
        return;
      }

      snapshot.forEach(doc => {
        const j = doc.data();
        const jamDisplay = j.jam && j.jamSelesai ? `${j.jam} - ${j.jamSelesai}` : "-";
        const row = document.createElement("tr");

        row.innerHTML = `
          <td class="editable" data-id="${doc.id}" data-field="kode">${j.kode || "-"}</td>
          <td class="editable" data-id="${doc.id}" data-field="matkul">${j.matkul}</td>
          <td class="editable" data-id="${doc.id}" data-field="kelas">${j.kelas}</td>
          <td class="editable" data-id="${doc.id}" data-field="dosen">${j.dosen}</td>
          <td class="editable" data-id="${doc.id}" data-field="hari">${j.hari}</td>
          <td class="editable" data-id="${doc.id}" data-field="jam">${jamDisplay}</td>
          <td><button data-action="hapus-jadwal" data-id="${doc.id}">Hapus</button></td>
        `;
        tbody.appendChild(row);
      });
    } catch (error) {
      tbody.innerHTML = `<tr><td colspan='7'>Error: ${error.message}</td></tr>`;
    }
  }

  // Event delegation untuk hapus & edit
  contentArea.addEventListener("click", async (e) => {
    // 🔴 HAPUS
    if (e.target.dataset.action === "hapus-jadwal") {
      if (!confirm("Yakin ingin menghapus jadwal ini?")) return;
      try {
        await db.collection("jadwal").doc(e.target.dataset.id).delete();
        loadJadwal();
      } catch (error) {
        alert(`Gagal menghapus jadwal: ${error.message}`);
      }
    }

    // ✏️ EDIT (pakai prompt manual)
    if (e.target.classList.contains("editable")) {
      const docId = e.target.dataset.id;
      const field = e.target.dataset.field;
      const current = e.target.innerText.trim();
      const input = prompt(`Edit ${field.toUpperCase()}:`, current);
      if (!input) return;
      try {
        const updateData = {};

        if (field === "jam") {
          const parts = input.split("-");
          if (parts.length === 2) {
            updateData["jam"] = parts[0].trim();
            updateData["jamSelesai"] = parts[1].trim();
          } else {
            updateData["jam"] = input.trim();
          }
        } else {
          updateData[field] = input.trim();
        }

        await db.collection("jadwal").doc(docId).update(updateData);
        loadJadwal();
      } catch (error) {
        alert(`Gagal update: ${error.message}`);
      }
    }
  });

  loadJadwal();
}


// === Show Kalender ===

function showKalender() {
  contentArea.innerHTML = `
    <h2>Tambah Kalender Akademik</h2>
    <form id="kalender-form">
      <select id="tipe-kalender">
        <option value="pertemuan">Pertemuan Mingguan</option>
        <option value="lain">Kalender Lain (UAS, Libur, dll)</option>
      </select><br><br>

      <div id="pertemuan-options" style="margin-bottom:10px;">
        <label>Jumlah Pertemuan:</label>
        <input type="number" id="jumlahPertemuan" min="1" max="20" value="16" required /><br><br>
      </div>

      <input type="text" id="judul" placeholder="Judul (misal: UAS, Libur Nasional)" required />
      <input type="date" id="tanggalMulai" required />
      <input type="date" id="tanggalSelesai" style="display:none;" />
      <button type="submit">Simpan</button>
    </form>

    <h2>Daftar Kalender</h2>
    <div style="overflow-x:auto;">
      <table border="1" cellpadding="6" style="width:100%;margin-top:10px;">
        <thead>
          <tr>
            <th>Judul</th>
            <th>Mulai</th>
            <th>Selesai</th>
            <th>Minggu Ke</th>
            <th>Aksi</th>
          </tr>
        </thead>
        <tbody id="kalender-list"></tbody>
      </table>
    </div>

    <!-- Modal for editing -->
    <div id="editModal" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:1000;justify-content:center;align-items:center;">
      <div style="background:white;padding:20px;border-radius:10px;width:80%;max-width:500px;">
        <h3>Edit Pertemuan</h3>
        <form id="edit-form">
          <input type="hidden" id="edit-id">
          <input type="hidden" id="edit-mingguKe">
          <div style="margin-bottom:15px;">
            <label>Judul:</label>
            <input type="text" id="edit-judul" style="width:100%" required>
          </div>
          <div style="margin-bottom:15px;">
            <label>Tanggal Mulai:</label>
            <input type="date" id="edit-tanggalMulai" style="width:100%" required>
          </div>
          <div style="display:flex;justify-content:space-between;margin-top:20px;">
            <button type="button" id="cancel-edit" style="padding:8px 15px;">Batal</button>
            <button type="submit" style="padding:8px 15px;">Simpan Perubahan</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const form = document.getElementById("kalender-form");
  const tbody = document.getElementById("kalender-list");
  const tipe = document.getElementById("tipe-kalender");
  const selesai = document.getElementById("tanggalSelesai");
  const editModal = document.getElementById("editModal");
  const editForm = document.getElementById("edit-form");
  const cancelEdit = document.getElementById("cancel-edit");

  tipe.addEventListener("change", () => {
    const isPertemuan = tipe.value === "pertemuan";
    document.getElementById("pertemuan-options").style.display = isPertemuan ? "block" : "none";
    selesai.style.display = isPertemuan ? "none" : "inline-block";
    selesai.required = !isPertemuan;
  });
  tipe.dispatchEvent(new Event("change"));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const judul = form.judul.value.trim();
      const mulai = new Date(form.tanggalMulai.value);

      if (tipe.value === "pertemuan") {
        const jumlahPertemuan = parseInt(form.jumlahPertemuan.value);
        if (!jumlahPertemuan || jumlahPertemuan < 1) return alert("Jumlah pertemuan tidak valid");

        const batch = db.batch();
        for (let i = 1; i <= jumlahPertemuan; i++) {
          const pertemuanMulai = new Date(mulai);
          pertemuanMulai.setDate(pertemuanMulai.getDate() + (i - 1) * 7);

          const pertemuanSelesai = new Date(pertemuanMulai);
          pertemuanSelesai.setDate(pertemuanSelesai.getDate() + 6);

          const tanggalMulaiStr = pertemuanMulai.toISOString().split("T")[0];
          const tanggalSelesaiStr = pertemuanSelesai.toISOString().split("T")[0];

          const ref = db.collection("kalender").doc(`pertemuan_${i}`);
          batch.set(ref, {
            judul: `Pertemuan ${i}`,
            tanggalMulai: tanggalMulaiStr,
            tanggalSelesai: tanggalSelesaiStr,
            mingguKe: i,
            tipe: "pertemuan"
          });
        }

        await batch.commit();
        alert(`Pertemuan 1-${jumlahPertemuan} berhasil dibuat.`);

      } else {
        if (!selesai.value) return alert("Tanggal selesai wajib diisi");
        await db.collection("kalender").add({
          judul,
          tanggalMulai: form.tanggalMulai.value,
          tanggalSelesai: selesai.value,
          tipe: "lain"
        });
        alert("Kalender non-pertemuan berhasil ditambahkan.");
      }

      form.reset();
      tipe.dispatchEvent(new Event("change"));
      loadKalender();

    } catch (err) {
      console.error("[ERR] Gagal simpan kalender:", err);
      alert("Gagal menyimpan kalender: " + err.message);
    }
  });

  async function loadKalender() {
    tbody.innerHTML = "<tr><td colspan='5'>Memuat...</td></tr>";
    try {
      const snapshot = await db.collection("kalender")
        .orderBy("tipe")
        .orderBy("mingguKe")
        .orderBy("tanggalMulai")
        .get();
      tbody.innerHTML = "";

      if (snapshot.empty) {
        tbody.innerHTML = "<tr><td colspan='5'>Belum ada kalender.</td></tr>";
        return;
      }

      snapshot.forEach(doc => {
        const k = doc.data();
        const isPertemuan = k.tipe === "pertemuan";
        tbody.innerHTML += `
          <tr>
            <td>${k.judul}</td>
            <td>${k.tanggalMulai}</td>
            <td>${k.tanggalSelesai || "-"}</td>
            <td>${k.mingguKe || "-"}</td>
            <td>
              ${isPertemuan ? `<button data-id="${doc.id}" data-mingguke="${k.mingguKe}" class="btn-edit">Edit</button>` : ''}
              <button data-id="${doc.id}" class="btn-hapus">Hapus</button>
            </td>
          </tr>`;
      });

    } catch (err) {
      tbody.innerHTML = `<tr><td colspan='5'>Error: ${err.message}</td></tr>`;
    }
  }

  // Handle edit button click
  contentArea.addEventListener("click", async (e) => {
    if (e.target.classList.contains("btn-edit")) {
      try {
        const doc = await db.collection("kalender").doc(e.target.dataset.id).get();
        if (!doc.exists) return;
        
        const data = doc.data();
        document.getElementById("edit-id").value = e.target.dataset.id;
        document.getElementById("edit-mingguKe").value = data.mingguKe;
        document.getElementById("edit-judul").value = data.judul;
        document.getElementById("edit-tanggalMulai").value = data.tanggalMulai;
        
        editModal.style.display = "flex";
      } catch (err) {
        alert("Gagal memuat data untuk edit: " + err.message);
      }
    }
    
    if (e.target.classList.contains("btn-hapus")) {
      if (!confirm("Hapus entri ini?")) return;
      try {
        await db.collection("kalender").doc(e.target.dataset.id).delete();
        loadKalender();
      } catch (err) {
        alert("Gagal hapus: " + err.message);
      }
    }
  });

  // Handle edit form submission
  editForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const id = editForm["edit-id"].value;
      const mingguKe = parseInt(editForm["edit-mingguKe"].value);
      const newJudul = editForm["edit-judul"].value.trim();
      const newTanggalMulai = new Date(editForm["edit-tanggalMulai"].value);
      
      if (!newJudul || !newTanggalMulai) return alert("Data tidak valid");

      // Get all meetings after the edited one
      const meetingsAfter = await db.collection("kalender")
        .where("tipe", "==", "pertemuan")
        .where("mingguKe", ">", mingguKe)
        .orderBy("mingguKe")
        .get();

      const batch = db.batch();
      
      // Update the edited meeting
      batch.update(db.collection("kalender").doc(id), {
        judul: newJudul,
        tanggalMulai: newTanggalMulai.toISOString().split("T")[0],
        tanggalSelesai: new Date(newTanggalMulai.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
      });

      // Shift all subsequent meetings
      let currentStartDate = new Date(newTanggalMulai);
      currentStartDate.setDate(currentStartDate.getDate() + 7); // Start from next week

      meetingsAfter.forEach(doc => {
        const data = doc.data();
        const newStart = new Date(currentStartDate);
        const newEnd = new Date(newStart);
        newEnd.setDate(newEnd.getDate() + 6);

        batch.update(db.collection("kalender").doc(doc.id), {
          tanggalMulai: newStart.toISOString().split("T")[0],
          tanggalSelesai: newEnd.toISOString().split("T")[0]
        });

        currentStartDate.setDate(currentStartDate.getDate() + 7); // Move to next week
      });

      await batch.commit();
      alert("Pertemuan berhasil diupdate dan pertemuan berikutnya telah disesuaikan!");
      editModal.style.display = "none";
      loadKalender();
    } catch (err) {
      console.error("Gagal update pertemuan:", err);
      alert("Gagal update pertemuan: " + err.message);
    }
  });

  // Cancel edit
  cancelEdit.addEventListener("click", () => {
    editModal.style.display = "none";
  });

  loadKalender();
}

// Tampilkan dashboard default saat pertama
showDashboard();
setActiveMenu("menu-dashboard");

// Logout
document.getElementById("logout-btn").addEventListener("click", () => {
  auth.signOut().then(() => {
    window.location.href = "index.html";
  }).catch(error => {
    alert(`Gagal logout: ${error.message}`);
  });
});