const auth = firebase.auth();
const db = firebase.firestore();

// DOM Elements
const menuMatkul = document.getElementById("menu-matkul");
const submenuContainer = document.getElementById("submenu-container");
const pageTitle = document.getElementById("page-title");
const contentArea = document.getElementById("content-area");
const welcomeMessage = document.getElementById("welcomeMessage");
const logoutBtn = document.getElementById("logout-btn");

// Logout
logoutBtn.addEventListener("click", () => {
  auth.signOut().then(() => {
    window.location.href = "index.html";
  }).catch(error => {
    console.error("Logout error:", error);
    alert("Gagal logout. Silakan coba lagi.");
  });
});

// Auth & Load Data Dosen
auth.onAuthStateChanged((user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  db.collection("users").doc(user.uid).get()
    .then((doc) => {
      if (!doc.exists) throw new Error("Data pengguna tidak ditemukan");

      const data = doc.data();
      if (data.role !== "dosen") {
        auth.signOut();
        window.location.href = "index.html";
        return;
      }

      const nip = data.id;
      const nama = data.nama || "Dosen";
      const sapaan = nama.toLowerCase().startsWith("bu") ? "Bu" : "Pak";
      const namaPendek = nama.replace(/^bu\s?|^pak\s?/i, "");

      welcomeMessage.textContent = `Selamat datang, ${sapaan} ${namaPendek}`;
      loadMatkul(nip);
    })
    .catch((error) => {
      console.error("Error loading user data:", error);
      alert("Gagal memuat data dosen. Silakan coba lagi.");
    });
});

function loadMatkul(nip) {
  if (!nip) return;

  if (menuMatkul) {
    menuMatkul.textContent = "Dashboard";
    menuMatkul.addEventListener("click", () => generateMatkulMenu(nip));
  }

  generateMatkulMenu(nip); // panggil langsung saat login
}

function generateMatkulMenu(nip) {
  if (!nip) return;

  pageTitle.textContent = "Dashboard";
  contentArea.innerHTML = "<p>Memuat mata kuliah...</p>";

  db.collection("jadwal").where("dosen", "==", nip).get()
    .then((querySnapshot) => {
      if (querySnapshot.empty) {
        contentArea.innerHTML = "<p>Tidak ada mata kuliah ditemukan.</p>";
        return;
      }

      submenuContainer.innerHTML = "";

      // Tombol Dashboard
      const dashboardBtn = document.createElement("button");
      dashboardBtn.classList.add("matkul-item", "active-submenu");
      dashboardBtn.textContent = "Dashboard";
      dashboardBtn.addEventListener("click", () => {
        generateMatkulTable(querySnapshot);
        highlightActiveButton(dashboardBtn);
      });
      submenuContainer.appendChild(dashboardBtn);

      // Tombol-tombol Matkul
      querySnapshot.forEach((doc) => {
        const j = doc.data();
        const btn = document.createElement("button");
        btn.classList.add("matkul-item");
        btn.textContent = j.matkul;
        btn.addEventListener("click", () => {
          loadKehadiran(doc.id, j.matkul, j);
          highlightActiveButton(btn); // ✨ ini bikin tombol berubah warna
        });
        submenuContainer.appendChild(btn);
      });

      // Tampilkan Dashboard default
      generateMatkulTable(querySnapshot);
    })
    .catch((err) => {
      console.error("Gagal memuat jadwal:", err);
      contentArea.innerHTML = `<p style="color:red;">Gagal memuat data jadwal: ${err.message}</p>`;
    });
}


function generateMatkulTable(querySnapshot) {
  const hariIndex = { minggu: 0, senin: 1, selasa: 2, rabu: 3, kamis: 4, jumat: 5, sabtu: 6 };
  const jadwalList = [];

  querySnapshot.forEach((doc) => {
    const j = doc.data();
    jadwalList.push({ id: doc.id, ...j });
  });

  jadwalList.sort((a, b) => {
    const hariA = hariIndex[a.hari.toLowerCase()] || 99;
    const hariB = hariIndex[b.hari.toLowerCase()] || 99;
    const jamA = parseJam(a.jam);
    const jamB = parseJam(b.jam);
    return hariA !== hariB ? hariA - hariB : jamA - jamB;
  });

  let tableHTML = `
    <h3 style="margin-top: 1rem;">📚 Mata Kuliah yang Diampu</h3>
    <table border="1" cellspacing="0" cellpadding="6" style="width:100%; border-collapse:collapse; background:white; color:black;">
      <thead style="background-color:#eee;">
        <tr>
          <th>Hari</th>
          <th>Jam</th>
          <th>Matkul</th>
          <th>Kelas</th>
        </tr>
      </thead>
      <tbody>
  `;

  jadwalList.forEach(j => {
    const jamAwal = j.jam?.replace('.', ':') || '-';
    const jamAkhir = j.jamSelesai?.replace('.', ':') || '';
    const time = jamAkhir ? `${jamAwal} - ${jamAkhir}` : jamAwal;
    const matkul = j.matkul || '-';

    tableHTML += `
      <tr>
        <td>${capitalizeFirstLetter(j.hari)}</td>
        <td>${time}</td>
        <td>${matkul}</td>
        <td>${j.kelas}</td>
      </tr>
    `;
  });

  tableHTML += `</tbody></table>`;
  contentArea.innerHTML = tableHTML;
}

// Util: Konversi jam ke float
function parseJam(jamStr) {
  if (!jamStr) return 99;
  const [jam, menit] = jamStr.split(".").map(Number);
  return jam + (menit ? menit / 60 : 0);
}

// Util: Capitalize
function capitalizeFirstLetter(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : "";
}
function highlightActiveButton(activeBtn) {
  const allBtns = document.querySelectorAll(".matkul-item");
  allBtns.forEach(btn => btn.classList.remove("active-submenu"));
  activeBtn.classList.add("active-submenu");
}


// NOTE: Fungsi `loadKehadiran(...)` dan fungsi bantu lainnya tetap digunakan dari versi kamu yang sudah benar dan tidak perlu diubah, cukup paste setelah script ini.
async function loadKehadiran(jadwalId, matkulNama, jadwal) {
  if (!jadwalId || !matkulNama || !jadwal || !jadwal.kelas || !jadwal.hari) {
    alert("Data jadwal tidak lengkap.");
    return;
  }

  const kelasJadwal = jadwal.kelas;
  const hariKuliah = jadwal.hari;
  const today = new Date().toISOString().split("T")[0];
  pageTitle.textContent = `Kehadiran - ${matkulNama}`;
  contentArea.innerHTML = "<p>Memuat data kehadiran...</p>";

  try {
    const kalSnap = await db.collection("kalender")
      .where("tanggalMulai", "<=", today)
      .orderBy("tanggalMulai", "desc")
      .limit(5)
      .get();

    let infoKalender = "", mingguAktif = null;
    const nowDate = new Date(today);
    for (const doc of kalSnap.docs) {
      const k = doc.data();
      const mulai = new Date(k.tanggalMulai);
      const selesai = new Date(k.tanggalSelesai);
      if (nowDate >= mulai && nowDate <= selesai) {
        mingguAktif = k.mingguKe || null;
        infoKalender = `
          <div style="margin-bottom: 10px; background:#f5f5dc; padding:10px; border-left: 5px solid #8b0000;">
            <strong>📌 ${k.mingguKe ? "Pertemuan " + k.mingguKe : k.judul}</strong> (${k.tanggalMulai})
            ${k.judul !== `Pertemuan ${k.mingguKe}` ? `<br>📝 Catatan: ${k.judul}` : ""}
          </div>`;
        break;
      }
    }

    const kalenderMap = {};
    const kalenderDocs = await Promise.all(
      Array.from({ length: 16 }, (_, i) =>
        db.collection("kalender").doc(`pertemuan_${i + 1}`).get()
      )
    );
    kalenderDocs.forEach((doc, i) => {
      if (doc.exists) {
        kalenderMap[i + 1] = doc.data().tanggalMulai;
      }
    });

    const absenSnap = await db.collection("absensi")
      .where("jadwalId", "==", jadwalId)
      .get();

    const absensiMap = {};
    absenSnap.forEach((doc) => {
      const d = doc.data();
      if (!absensiMap[d.nim]) absensiMap[d.nim] = {};
      absensiMap[d.nim][d.pertemuan] = {
        status: d.status,
        keterangan: d.keterangan || "",
        docId: doc.id
      };
    });

    const mhsSnap = await db.collection("users")
      .where("role", "==", "mahasiswa")
      .where("kelas", "==", kelasJadwal)
      .get();

    let html = `<h3>${matkulNama} - Kelas ${kelasJadwal}</h3>${infoKalender}`;
    html += `
      <form id='form-absen'>
        <div class="table-container" style="overflow-x:auto; overflow-y: visible; max-width: 100vw;">
          <table border="1" cellspacing="0" cellpadding="6" 
            style="min-width: 100%; width: max-content; border-collapse: collapse; background: white; color: black; table-layout: fixed; font-size: 14px;">
            <thead><tr>
              <th style="min-width: 180px;">Nama</th>`;

    for (let i = 1; i <= 16; i++) {
      const tanggalObj = getTanggalPertemuan(kalenderMap[i], hariKuliah);
      const tanggal = tanggalObj
        ? tanggalObj.toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" })
        : "-";
      const highlight = i === mingguAktif ? "background: #fffa87;" : "";
      html += `<th style="${highlight}; min-width: 180px;">P${i}<br><small>${tanggal}</small></th>`;
    }

    html += `
        <th>Hadir</th>
        <th>Izin</th>
        <th>Sakit</th>
        <th>Alpha</th>
        <th style="min-width: 180px;">Nama</th>
      </tr></thead><tbody>`;

    mhsSnap.forEach((mhsDoc) => {
      const mhs = mhsDoc.data();
      if (!mhs.matkulAmbil || !mhs.matkulAmbil[jadwalId]) return;

      const nim = mhs.id;
      const absen = absensiMap[nim] || {};
      let h = 0, i = 0, s = 0, a = 0;

      for (let p = 1; p <= 16; p++) {
        const status = absen[p]?.status || "";
        if (status === "Hadir") h++;
        else if (status === "Izin") i++;
        else if (status === "Sakit") s++;
        else if (status === "Alpha") a++;
      }

      html += `<tr><td style="min-width: 180px;">${mhs.nama}</td>`;

      for (let p = 1; p <= 16; p++) {
        const data = absen[p] || { status: "", keterangan: "" };
        const bg = getStatusColorStyle(data.status);
        const isNow = p === mingguAktif ? "background: #fffa87;" : "";

        html += `
        <td style="min-width: 180px; padding: 4px; font-size: 0.9em; ${bg}${isNow}">
          <div style="display: flex; flex-direction: column; gap: 4px; padding-right: 4px;">
            <select name="${nim}-p${p}-status"
              style="width: 100%; max-width: 170px; font-size: 0.9em; padding: 4px; border: 1px solid #ccc;">
              <option value="">-</option>
              <option value="Hadir" ${data.status === "Hadir" ? "selected" : ""}>Hadir</option>
              <option value="Izin" ${data.status === "Izin" ? "selected" : ""}>Izin</option>
              <option value="Sakit" ${data.status === "Sakit" ? "selected" : ""}>Sakit</option>
              <option value="Alpha" ${data.status === "Alpha" ? "selected" : ""}>Alpha</option>
            </select>
            <input type="text" name="${nim}-p${p}-ket"
              value="${escapeHtml(data.keterangan)}"
              placeholder="Keterangan"
              style="width: 100%; max-width: 170px; font-size: 0.9em; padding: 4px; border: 1px solid #ccc;" />
          </div>
        </td>`;
      }

      html += `
        <td style="background-color: #d4edda; color:#155724;">${h}</td>
        <td style="background-color: #e6ccff; color:#4b0082;">${i}</td>
        <td style="background-color: #ffe5b4; color:#7f5200;">${s}</td>
        <td style="background-color: #f5c6cb; color:#721c24;">${a}</td>
        <td style="min-width: 180px;">${mhs.nama}</td>
      </tr>`;
    });

    html += `</tbody></table></div>
    <br>
    <button type='submit' style="padding: 8px 16px; background-color: #8b0000; color: white; border: none; border-radius: 4px; cursor: pointer;">
      Simpan Perubahan
    </button>
    </form>`;

    contentArea.innerHTML = html;

    document.getElementById("form-absen").addEventListener("submit", async (e) => {
      e.preventDefault();
      const form = e.target;
      const submitBtn = form.querySelector("button[type='submit']");
      submitBtn.disabled = true;
      submitBtn.textContent = "Menyimpan...";

      try {
        const updates = [];
        const formData = new FormData(form);

        mhsSnap.forEach((mhsDoc) => {
          const mhs = mhsDoc.data();
          const nim = mhs.id;
          if (!mhs.matkulAmbil || !mhs.matkulAmbil[jadwalId]) return;

          for (let p = 1; p <= 16; p++) {
            const status = formData.get(`${nim}-p${p}-status`);
            const keterangan = formData.get(`${nim}-p${p}-ket`) || "";

            if (status) {
              const docId = `${jadwalId}_${nim}_${p}`;
              updates.push(
                db.collection("absensi").doc(docId).set({
                  jadwalId,
                  nim,
                  pertemuan: p,
                  status,
                  keterangan,
                  diisiOleh: "dosen",
                  lastUpdate: new Date()
                }, { merge: true })
              );
            }
          }
        });

        await Promise.all(updates);
        alert("Absensi berhasil disimpan.");
        loadKehadiran(jadwalId, matkulNama, jadwal);
      } catch (err) {
        console.error("Gagal menyimpan absensi:", err);
        alert("Gagal menyimpan absensi.");
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Simpan Perubahan";
      }
    });

  } catch (err) {
    console.error("Gagal load data kehadiran:", err);
    alert("Gagal memuat data.");
  }
}

// Warna status
function getStatusColorStyle(status) {
  switch (status) {
    case "Hadir": return "background-color:#d4edda; color:#155724;";
    case "Izin": return "background-color:#e6ccff; color:#4b0082;";
    case "Sakit": return "background-color:#ffe5b4; color:#7f5200;";
    case "Alpha": return "background-color:#f5c6cb; color:#721c24;";
    default: return "";
  }
}

// Escape input
function escapeHtml(unsafe) {
  if (!unsafe) return "";
  return unsafe.replace(/&/g, "&amp;")
               .replace(/</g, "&lt;")
               .replace(/>/g, "&gt;")
               .replace(/"/g, "&quot;")
               .replace(/'/g, "&#039;");
}

// Hitung tanggal sesuai hari kuliah
function getTanggalPertemuan(baseDateStr, hariKuliah) {
  if (!baseDateStr || !hariKuliah) return null;
  const baseDate = new Date(baseDateStr);
  const hariTarget = ["minggu", "senin", "selasa", "rabu", "kamis", "jumat", "sabtu"].indexOf(hariKuliah.toLowerCase());
  const selisih = (hariTarget - baseDate.getDay() + 7) % 7;
  baseDate.setDate(baseDate.getDate() + selisih);
  return baseDate;
}
