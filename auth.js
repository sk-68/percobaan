let currentUser = null;
let globalCredential = null;

document.getElementById("login-form").addEventListener("submit", function (e) {
  e.preventDefault();

  const namaDepan = document.getElementById("input-id").value.trim().toLowerCase();
  const password = document.getElementById("input-password").value.trim();
  const submitBtn = document.querySelector("button[type='submit']");

  if (!namaDepan || !password) {
    alert("Nama dan password harus diisi.");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Memproses...";

  // Auto buat email dari nama depan
  const email = `${namaDepan}@gmail.com`;

  auth.signInWithEmailAndPassword(email, password)
    .then((userCredential) => {
      globalCredential = userCredential;
      const uid = userCredential.user.uid;
      return db.collection("users").doc(uid).get();
    })
    .then((doc) => {
      if (!doc.exists) {
        alert("Login gagal: Data pengguna tidak ditemukan.");
        return;
      }

      const data = doc.data();
      if (!data.aktif) {
        alert("Akun ini dinonaktifkan.");
        return;
      }

      currentUser = {
        uid: globalCredential.user.uid,
        id: data.id || "", // nim/nip opsional
        nama: data.nama || "",
        role: data.role || "",
        kelas: data.kelas || ""
      };

      console.log("[DEBUG] currentUser:", currentUser);

      // Redirect berdasarkan role
      if (data.role === "admin") {
        window.location.href = "admin.html";
      } else if (data.role === "dosen") {
        window.location.href = "dosen.html";
      } else if (data.role === "mahasiswa") {
        window.location.href = "mahasiswa.html";
      } else {
        alert("Login gagal: Role tidak dikenali.");
      }
    })
    .catch(handleAuthError)
    .finally(() => {
      submitBtn.disabled = false;
      submitBtn.textContent = "Login";
    });
});

function handleAuthError(error) {
  const code = error.code;
  console.error("Login error:", error);

  switch (code) {
    case "auth/user-disabled":
      alert("Akun ini telah dinonaktifkan oleh sistem.");
      break;
    case "auth/user-not-found":
      alert("Pengguna tidak ditemukan. Cek kembali nama depan.");
      break;
    case "auth/wrong-password":
      alert("Password salah.");
      break;
    case "auth/invalid-email":
      alert("Format email salah. (Sistem gagal membentuk email)");
      break;
    default:
      alert("Login gagal: " + error.message);
  }
}

function loginWithFirebase(namaDepan, password) {
  document.getElementById("input-id").value = namaDepan;
  document.getElementById("input-password").value = password;
  document.querySelector("button[type='submit']").click();
}
