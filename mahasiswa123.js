// Inisialisasi Firebase
const auth = firebase.auth();
const db = firebase.firestore();

// DOM Elements
const pageTitle = document.getElementById("page-title");
const contentArea = document.getElementById("content-area");
const welcomeMessage = document.getElementById("welcomeMessage");
const logoutBtn = document.getElementById("logout-btn");

// Logout Function
logoutBtn.addEventListener("click", () => {
  auth.signOut().then(() => {
    window.location.href = "index.html";
  }).catch(error => {
    console.error("Logout error:", error);
    alert("Gagal logout. Coba lagi.");
  });
});

let currentUser = null;

// ================= AUTH STATE LISTENER =================
auth.onAuthStateChanged(async (user) => {
  console.log("[DEBUG] Auth state changed");
  
  if (!user) {
    console.log("[DEBUG] No user, redirecting to login");
    window.location.href = "index.html";
    return;
  }

  try {
    console.log(`[DEBUG] User logged in: ${user.uid}`);
    
    // Get user data from Firestore
    const userDoc = await db.collection("users").doc(user.uid).get();
    
    if (!userDoc.exists) {
      console.error("[ERROR] User document not found");
      alert("Data pengguna tidak ditemukan");
      return auth.signOut();
    }

    const userData = userDoc.data();
    console.log("[DEBUG] User data:", userData);
    
    if (userData.role !== "mahasiswa") {
      console.error(`[ERROR] Unauthorized role: ${userData.role}`);
      alert("Akses ditolak. Hanya untuk mahasiswa.");
      return auth.signOut();
    }

    // Set current user data
    currentUser = {
      id: user.uid,
      nim: userData.id,
      nama: userData.nama || "Mahasiswa",
      kelas: userData.kelas,
      role: userData.id
    };

    welcomeMessage.textContent = `Selamat datang, ${currentUser.nama}`;
    showJadwal(); // Show schedule by default
    
    console.log("[DEBUG] Auth flow completed");
  } catch (error) {
    console.error("[ERROR] Auth state error:", error);
    contentArea.innerHTML = `
      <p class="error">Terjadi kesalahan: ${error.message}</p>
      <button onclick="location.reload()">Refresh Halaman</button>
    `;
  }
});

// ================= SCHEDULE FUNCTION =================
async function showJadwal() {
  console.log("[DEBUG] Loading schedule...");

  if (!currentUser || !currentUser.kelas || !currentUser.id) {
    return showError("Data user tidak valid");
  }

  const userId = currentUser.id;
  const kelas = currentUser.kelas.toUpperCase();
  pageTitle.textContent = "Jadwal Kuliah";
  contentArea.innerHTML = "<p>Memuat jadwal...</p>";

  try {
    const lecturersSnap = await db.collection("users").where("role", "==", "dosen").get();
    const lecturersMap = {};
    lecturersSnap.forEach(doc => {
      const data = doc.data();
      lecturersMap[String(data.id).trim()] = data.nama;
    });

    const scheduleSnap = await db.collection("jadwal").where("kelas", "==", kelas).get();
    if (scheduleSnap.empty) {
      return contentArea.innerHTML = `<p>Tidak ada jadwal untuk kelas ${kelas}</p>`;
    }

    const userDoc = await db.collection("users").doc(userId).get();
    const userData = userDoc.data();
    const matkulAmbil = userData.matkulAmbil || {};
    const matkulSkip = userData.matkulSkip || {};

    const now = new Date().toISOString().split("T")[0];
    let kalenderInfoHTML = "";

    const kalenderSnap = await db.collection("kalender")
      .where("tanggalMulai", "<=", now)
      .orderBy("tanggalMulai", "desc")
      .limit(1)
      .get();

    if (!kalenderSnap.empty) {
      const k = kalenderSnap.docs[0].data();
      const mulai = new Date(k.tanggalMulai);
      const selesai = new Date(k.tanggalSelesai);
      const nowDate = new Date(now);

      if (nowDate >= mulai && nowDate <= selesai) {
        const mingguKe = k.mingguKe ? `Pertemuan ${k.mingguKe}` : "";
        kalenderInfoHTML = `
          <div style="margin-bottom: 15px; padding: 10px; background-color: #f0f0f0; border-left: 5px solid #8b0000;">
            <strong>📅 ${mingguKe || k.judul}</strong> (${k.tanggalMulai})<br/>
            <em>${k.judul !== mingguKe ? "Catatan: " + k.judul : ""}</em>
          </div>`;
      }
    }

    const dayOrder = ["senin", "selasa", "rabu", "kamis", "jumat", "sabtu", "minggu"];
    const scheduleList = scheduleSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    scheduleList.sort((a, b) => {
      const dayA = dayOrder.indexOf(a.hari.toLowerCase().trim());
      const dayB = dayOrder.indexOf(b.hari.toLowerCase().trim());
      if (dayA !== dayB) return dayA - dayB;

      const toMinutes = (timeStr) => {
        const [jam, menit] = timeStr?.replace('.', ':').split(':').map(Number);
        return (jam ?? 99) * 60 + (menit ?? 0);
      };

      const timeA = toMinutes(a.jam);
      const timeB = toMinutes(b.jam);
      return timeA - timeB;
    });

    let html = kalenderInfoHTML;
    html += `
      <div class="table-container">
        <table class="schedule-table" border="1" cellspacing="0" cellpadding="8" style="width:100%; border-collapse:collapse; background:white; color:black;">
          <thead style="background-color:#eee;">
            <tr>
              <th>Hari</th>
              <th>Jam</th>
              <th>Kode Matkul</th>
              <th>Mata Kuliah</th>
              <th>Nama Dosen</th>
              <th>Kelas</th>
            </tr>
          </thead>
          <tbody>`;

    scheduleList.forEach(schedule => {
      if (matkulAmbil[schedule.id]) {
        const jamMulai = schedule.jam?.replace('.', ':') || '-';
        const jamSelesai = schedule.jamSelesai?.replace('.', ':') || '';
        const jamTampil = jamSelesai ? `${jamMulai} - ${jamSelesai}` : jamMulai;
        const dosenId = String(schedule.dosen).trim();
        const namaDosen = lecturersMap[dosenId] || '-';

        html += `
          <tr>
            <td>${capitalizeFirstLetter(schedule.hari)}</td>
            <td>${jamTampil}</td>
            <td>${schedule.kode || '-'}</td>
            <td>${schedule.matkul}</td>
            <td>${namaDosen}</td>
            <td>${schedule.kelas}</td>
          </tr>`;
      }
    });

    html += `</tbody></table></div>`;

    const jadwalBelumDipilih = scheduleList.filter(j => {
      return !(j.id in matkulAmbil) && !(j.id in matkulSkip);
    });

    if (jadwalBelumDipilih.length > 0) {
      html += `<h3>Mata Kuliah yang Belum Dipilih</h3><ul>`;
      jadwalBelumDipilih.forEach(j => {
        html += `<li>${j.matkul} 
          <button class="ambil-btn" data-id="${j.id}" data-nama="${j.matkul}">Ambil</button> 
          <button class="skip-btn" data-id="${j.id}">Tidak Dipilih</button>
        </li>`;
      });
      html += `</ul>`;
    }

    contentArea.innerHTML = html;

    document.querySelectorAll(".ambil-btn").forEach(button => {
      button.addEventListener("click", async () => {
        const jadwalId = button.dataset.id;
        const matkulNama = button.dataset.nama;
        try {
          await db.collection("users").doc(userId).update({
            [`matkulAmbil.${jadwalId}`]: true
          });
          alert(`Berhasil ambil mata kuliah ${matkulNama}`);
          showJadwal();
        } catch (err) {
          alert("Gagal ambil mata kuliah: " + err.message);
        }
      });
    });

    document.querySelectorAll(".skip-btn").forEach(button => {
      button.addEventListener("click", async () => {
        const jadwalId = button.dataset.id;
        try {
          await db.collection("users").doc(userId).update({
            [`matkulSkip.${jadwalId}`]: true
          });
          showJadwal();
        } catch (err) {
          alert("Gagal menyembunyikan matkul: " + err.message);
        }
      });
    });

  } catch (error) {
    console.error("[ERROR] Schedule error:", error);
    showError(`Gagal memuat jadwal: ${error.message}`, showJadwal);
  }
}

function capitalizeFirstLetter(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : "";
}

// ================= GET CURRENT ACADEMIC WEEK =================
function timeToMinutes(time) {
  const [jam, menit] = time.split(':').map(Number);
  return jam * 60 + menit;
}

async function showAbsen() {
  console.log("[DEBUG] Loading attendance form...");

  if (!currentUser || !currentUser.nim || !currentUser.id) {
    return showError("Data pengguna tidak valid");
  }

  pageTitle.textContent = "Absen Hari Ini";
  contentArea.innerHTML = "<p>Memuat form absen...</p>";

  try {
    const now = new Date();
    const currentDay = now.getDay();
    const currentTime = now.toTimeString().substring(0, 5); // "HH:MM"
    const nowMinutes = timeToMinutes(currentTime);

    const dayNames = ["minggu", "senin", "selasa", "rabu", "kamis", "jumat", "sabtu"];
    const currentDayName = dayNames[currentDay];

    // Cari pertemuan aktif
    let pertemuanAktif = null;
    for (let i = 1; i <= 16; i++) {
      const doc = await db.collection("kalender").doc(`pertemuan_${i}`).get();
      if (!doc.exists) continue;

      const data = doc.data();
      const mulai = new Date(data.tanggalMulai);
      const selesai = new Date(data.tanggalSelesai);

      if (now >= mulai && now <= selesai) {
        pertemuanAktif = { mingguKe: i, ...data };
        break;
      }
    }

    if (!pertemuanAktif) {
      return contentArea.innerHTML = `
        <div class="info-box">
          <p>Tidak ada pertemuan aktif hari ini.</p>
        </div>`;
    }

    const scheduleSnap = await db.collection("jadwal")
      .where("hari", "==", currentDayName)
      .where("kelas", "==", currentUser.kelas.toUpperCase())
      .get();

    const userDoc = await db.collection("users").doc(currentUser.id).get();
    const matkulAmbil = userDoc.data().matkulAmbil || {};
    const jadwalDiambil = scheduleSnap.docs.filter(doc => matkulAmbil[doc.id]);

    if (jadwalDiambil.length === 0) {
      return contentArea.innerHTML = `<div class="info-box"><p>Anda belum mengambil mata kuliah apapun untuk hari ini.</p></div>`;
    }

    let html = `
      <div class="attendance-header" style="margin-bottom: 15px;">
        <p>📅 <strong>${formatDate(now)}</strong></p>
        <p>📚 Pertemuan ke-${pertemuanAktif.mingguKe}</p>
        <p>🗓️ Periode: ${formatDate(new Date(pertemuanAktif.tanggalMulai))} - ${formatDate(new Date(pertemuanAktif.tanggalSelesai))}</p>
      </div>
      <form id="attendance-form">`;

    let adaAbsenForm = false;
    let autoAlphaApplied = false;

    const attendancePromises = jadwalDiambil.map(async (doc) => {
      const classData = doc.data();
      const classId = doc.id;
      const startTime = classData.jam.replace('.', ':');
      const endTime = classData.jamSelesai?.replace('.', ':') || '23:59';
      const startMinutes = timeToMinutes(startTime);
      const endMinutes = timeToMinutes(endTime);

      const attendanceSnap = await db.collection("absensi")
        .where("jadwalId", "==", classId)
        .where("nim", "==", currentUser.nim)
        .where("pertemuan", "==", pertemuanAktif.mingguKe)
        .get();

      const boxStyle = `
        background: white;
        border: 1px solid #ccc;
        padding: 15px;
        border-radius: 10px;
        margin-bottom: 15px;
        box-shadow: 0 0 10px rgba(0,0,0,0.05);
      `;

      if (attendanceSnap.empty) {
        if (nowMinutes >= startMinutes && nowMinutes <= endMinutes) {
          adaAbsenForm = true;
          html += `
            <div style="${boxStyle}">
              <h3>${classData.matkul} (${startTime} - ${endTime})</h3>
              <p class="time-info">⏰ Waktu tersisa untuk absen: ${Math.max(0, endMinutes - nowMinutes)} menit</p>
              <input type="hidden" name="classId" value="${classId}">
              <input type="hidden" name="pertemuan" value="${pertemuanAktif.mingguKe}">
              <div class="form-group">
                <label>Status Kehadiran:</label>
                <select name="status" required>
                  <option value="">-- Pilih Status --</option>
                  <option value="Hadir">Hadir</option>
                  <option value="Izin">Izin</option>
                  <option value="Sakit">Sakit</option>
                  <option value="Alpha">Alpha</option>
                </select>
              </div>
              <div class="form-group">
                <label>Keterangan (opsional):</label>
                <input type="text" name="keterangan" placeholder="Alasan izin/sakit">
              </div>
            </div>`;
        } else if (nowMinutes >= endMinutes) {
          // Auto Alpha - tepat saat jam berakhir
          const absensiId = `${classId}_${currentUser.nim}_${pertemuanAktif.mingguKe}`;
          await db.collection("absensi").doc(absensiId).set({
            jadwalId: classId,
            nim: currentUser.nim,
            pertemuan: pertemuanAktif.mingguKe,
            status: "Alpha",
            keterangan: "Tidak mengisi absen tepat waktu",
            tanggal: firebase.firestore.FieldValue.serverTimestamp(),
            tanggalPertemuan: new Date(pertemuanAktif.tanggalMulai),
            autoAlpha: true
          }, { merge: true });

          autoAlphaApplied = true;
          html += `
            <div style="${boxStyle}">
              <h3>${classData.matkul} (${startTime} - ${endTime})</h3>
              <p class="attendance-status">❌ Anda tidak mengisi absen tepat waktu</p>
              <p>Status: <strong>Alpha (Auto)</strong></p>
              <p>Keterangan: Tidak mengisi absen tepat waktu</p>
              <p class="time-info">⏰ Waktu absen berakhir pada: ${endTime}</p>
            </div>`;
        }
      } else {
        const data = attendanceSnap.docs[0].data();
        const statusType = data.autoAlpha ? "Alpha (Auto)" : data.status;
        html += `
          <div style="${boxStyle}" class="attended">
            <h3>${classData.matkul} (${startTime} - ${endTime})</h3>
            <p class="attendance-status">${data.autoAlpha ? '⚠️' : '✅'} ${data.autoAlpha ? 'Absen otomatis tercatat' : 'Anda sudah absen'}</p>
            <p>Status: <strong>${statusType}</strong></p>
            ${data.keterangan ? `<p>Keterangan: ${data.keterangan}</p>` : ""}
            <p>Waktu absen: ${data.tanggal?.toDate().toLocaleString("id-ID") || '-'}</p>
          </div>`;
      }
    });

    await Promise.all(attendancePromises);

    if (autoAlphaApplied) {
      html += `<div class="info-box" style="margin-top: 15px;">
        <p>⚠️ Catatan: Absensi otomatis tercatat sebagai Alpha untuk kelas yang sudah lewat waktu absennya.</p>
      </div>`;
    }

    if (adaAbsenForm) {
      html += `<button type="submit" class="submit-btn">Kirim Absen</button>`;
    }

    html += `</form>`;
    contentArea.innerHTML = html;

    if (adaAbsenForm) {
      document.getElementById("attendance-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const form = e.target;

        try {
          const classId = form.classId.value;
          const pertemuanKe = parseInt(form.pertemuan.value);
          const status = form.status.value;
          const keterangan = form.keterangan.value || null;

          if (!status) return alert("Silakan pilih status kehadiran");

          const absensiId = `${classId}_${currentUser.nim}_${pertemuanKe}`;
          await db.collection("absensi").doc(absensiId).set({
            jadwalId: classId,
            nim: currentUser.nim,
            pertemuan: pertemuanKe,
            status,
            keterangan,
            tanggal: firebase.firestore.FieldValue.serverTimestamp(),
            tanggalPertemuan: new Date(pertemuanAktif.tanggalMulai),
            autoAlpha: false
          }, { merge: true });

          alert("Absensi berhasil dikirim!");
          showAbsen();
        } catch (error) {
          console.error("[ERROR] Attendance submission error:", error);
          alert(`Gagal menyimpan absen: ${error.message}`);
        }
      });
    }

  } catch (error) {
    console.error("[ERROR] Attendance error:", error);
    showError(`Gagal memuat form absen: ${error.message}`, showAbsen);
  }
}
/// ================= ATTENDANCE HISTORY FUNCTION =================
async function showKartu() {
  console.log("[DEBUG] Loading attendance history...");

  if (!currentUser || !currentUser.nim) {
    return showError("Data pengguna tidak valid atau NIM tidak tersedia");
  }

  pageTitle.textContent = "Kartu Kehadiran";
  contentArea.innerHTML = "<p>Memuat riwayat kehadiran...</p>";

  try {
    const attendanceSnap = await db.collection("absensi")
      .where("nim", "==", currentUser.nim) // Menggunakan nim bukan id
      .orderBy("pertemuan", "asc")
      .get();

    if (attendanceSnap.empty) {
      return contentArea.innerHTML = `
        <div class="info-box">
          <p>Belum ada riwayat kehadiran.</p>
        </div>`;
    }

    const classIds = [...new Set(attendanceSnap.docs.map(doc => doc.data().jadwalId))];
    
    // Handle case ketika tidak ada classIds
    if (classIds.length === 0) {
      return contentArea.innerHTML = `
        <div class="info-box">
          <p>Data jadwal tidak ditemukan untuk riwayat kehadiran.</p>
        </div>`;
    }

    const classesSnap = await db.collection("jadwal")
      .where(firebase.firestore.FieldPath.documentId(), "in", classIds)
      .get();

    const classesMap = {};
    classesSnap.forEach(doc => {
      classesMap[doc.id] = doc.data();
    });

    let html = `
      <div class="table-container" style="overflow-x:auto;">
        <table border="1" cellspacing="0" cellpadding="8" style="width:100%; border-collapse:collapse; background:white; color:black;">
          <thead style="background:#eee;">
            <tr>
              <th>Pertemuan</th>
              <th>Mata Kuliah</th>
              <th>Hari</th>
              <th>Jam</th>
              <th>Status</th>
              <th>Keterangan</th>
              <th>Waktu Absen</th>
            </tr>
          </thead>
          <tbody>`;

    attendanceSnap.forEach(doc => {
      const att = doc.data();
      const classData = classesMap[att.jadwalId] || {};

      html += `
        <tr>
          <td>${att.pertemuan}</td>
          <td>${classData.matkul || '-'}</td>
          <td>${capitalizeFirstLetter(classData.hari || '')}</td>
          <td>${classData.jam ? classData.jam.replace('.', ':') : '-'}</td>
          <td>${att.status}</td>
          <td>${att.keterangan || '-'}</td>
          <td>${att.tanggal?.toDate().toLocaleString("id-ID") || '-'}</td>
        </tr>`;
    });

    html += `</tbody></table></div>`;
    contentArea.innerHTML = html;

  } catch (error) {
    console.error("[ERROR] Attendance history error:", error);
    showError(`Gagal memuat riwayat kehadiran: ${error.message}`, showKartu);
  }
}
// ================= HELPER FUNCTIONS =================
async function getCurrentPertemuan() {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const snapshot = await db.collection("kalender")
      .where("mingguKe", ">=", 1)
      .orderBy("mingguKe")
      .get();

    if (snapshot.empty) {
      console.log("[DEBUG] No academic calendar found");
      return null;
    }

    for (const doc of snapshot.docs) {
      const pertemuan = doc.data();
      const startDate = new Date(pertemuan.tanggalMulai);
      const endDate = new Date(pertemuan.tanggalSelesai);
      
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);

      if (today >= startDate && today <= endDate) {
        console.log(`[DEBUG] Found current pertemuan: week ${pertemuan.mingguKe}`);
        return pertemuan;
      }
    }

    console.log("[DEBUG] No active pertemuan found");
    return null;
  } catch (error) {
    console.error("[ERROR] getCurrentPertemuan error:", error);
    return null;
  }
}

function showError(message, retryFunction = null) {
  console.error(`[UI ERROR] ${message}`);
  let errorHtml = `<div class="error-box"><p>${message}</p>`;
  
  if (retryFunction) {
    errorHtml += `<button onclick="${retryFunction.name}()">Coba Lagi</button>`;
  } else {
    errorHtml += `<button onclick="location.reload()">Refresh Halaman</button>`;
  }
  
  errorHtml += `</div>`;
  contentArea.innerHTML = errorHtml;
}

function capitalizeFirstLetter(string) {
  return string ? string.charAt(0).toUpperCase() + string.slice(1) : '';
}

function formatDate(date) {
  return date.toLocaleDateString("id-ID", {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

// ================= EVENT LISTENERS =================
document.getElementById("menu-jadwal").addEventListener("click", showJadwal);
document.getElementById("menu-absen").addEventListener("click", showAbsen);
document.getElementById("menu-riwayat").addEventListener("click", showKartu);

// Set active menu button
document.querySelectorAll("#submenu-container button").forEach(btn => {
  btn.addEventListener("click", function() {
    document.querySelectorAll("#submenu-container button").forEach(b => 
      b.classList.remove("active"));
    this.classList.add("active");
  });
});