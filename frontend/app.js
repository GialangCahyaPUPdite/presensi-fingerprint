// app.js — logika UI kiosk presensi

const fpWrap = document.getElementById("fpWrap");
const statusTitle = document.getElementById("statusTitle");
const statusSub = document.getElementById("statusSub");
const deviceStatus = document.getElementById("deviceStatus");
const modePill = document.getElementById("modePill");
const feedList = document.getElementById("feedList");
const simBtn = document.getElementById("simBtn");

let resetTimer = null;

// ---------------------------------------------------------------------
// Jam & tanggal kiosk
// ---------------------------------------------------------------------
function tickClock() {
  const now = new Date();
  document.getElementById("clockTime").textContent =
    now.toLocaleTimeString("id-ID");
  document.getElementById("clockDate").textContent = now.toLocaleDateString(
    "id-ID",
    {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    },
  );
}
tickClock();
setInterval(tickClock, 1000);

// ---------------------------------------------------------------------
// State machine tampilan
// ---------------------------------------------------------------------
function setState(state, { title, sub } = {}) {
  fpWrap.classList.remove("waiting", "scanning", "success", "error");
  fpWrap.classList.add(state);
  if (title !== undefined) statusTitle.textContent = title;
  if (sub !== undefined) statusSub.textContent = sub;
}

function setQuality(q) {
  fpWrap.style.setProperty("--q", q);
}

function resetToWaiting() {
  clearTimeout(resetTimer);
  setQuality(0);
  setState("waiting", {
    title: "Tempelkan jari Anda",
    sub: "Letakkan jari tepat di tengah sensor",
  });
}

function scheduleReset() {
  clearTimeout(resetTimer);
  resetTimer = setTimeout(resetToWaiting, CONFIG.RESULT_DISPLAY_MS);
}

// ---------------------------------------------------------------------
// Live feed presensi hari ini
// ---------------------------------------------------------------------
function renderFeed(rows) {
  if (!rows.length) {
    feedList.innerHTML =
      '<li class="feed-empty">Belum ada presensi hari ini.</li>';
    return;
  }
  feedList.innerHTML = rows
    .map((r) => {
      const jam = new Date(r.waktu.replace(" ", "T")).toLocaleTimeString(
        "id-ID",
        { hour: "2-digit", minute: "2-digit" },
      );
      return `
      <li class="feed-item ${r.tipe}">
        <span class="feed-dot"></span>
        <div>
          <div class="feed-name">${escapeHtml(r.nama)}</div>
          <div class="feed-meta">${jam} · ${r.tipe === "masuk" ? "Masuk" : "Keluar"}</div>
        </div>
      </li>`;
    })
    .join("");
}

function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}

async function refreshFeed() {
  try {
    const res = await fetch(`${CONFIG.API_BASE}/presensi/hari-ini`);
    if (!res.ok) return;
    renderFeed(await res.json());
  } catch (err) {
    // Backend belum jalan / belum dikonfigurasi — biarkan feed kosong, jangan ganggu UI scan
    console.warn("[app] Gagal ambil feed presensi:", err.message);
  }
}
refreshFeed();
setInterval(refreshFeed, 15000);

// ---------------------------------------------------------------------
// Kirim hasil identifikasi ke backend untuk dicatat
// ---------------------------------------------------------------------
async function logPresensi({ dp_username, score, demoName }) {
  try {
    const res = await fetch(`${CONFIG.API_BASE}/presensi`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dp_username,
        skor_kecocokan: score ?? null,
        sumber_device: CONFIG.DEVICE_LABEL,
      }),
    });
    const data = await res.json();

    if (res.status === 201) {
      setState("success", {
        title: `Halo, ${data.employee.nama}!`,
        sub: `Presensi ${data.log.tipe === "masuk" ? "masuk" : "keluar"} tercatat`,
      });
      refreshFeed();
    } else if (res.status === 409) {
      setState("error", {
        title: data.employee ? data.employee.nama : "Sudah presensi",
        sub: data.message || "Sudah presensi lengkap hari ini",
      });
    } else if (res.status === 404) {
      setState("error", {
        title: demoName || "Tidak terdaftar",
        sub: "Sidik jari dikenali tapi belum terdaftar di sistem presensi",
      });
    } else {
      setState("error", {
        title: "Gagal mencatat",
        sub: data.error || "Terjadi kesalahan",
      });
    }
  } catch (err) {
    setState("error", {
      title: demoName || "—",
      sub: "Tidak bisa hubungi server presensi (cek koneksi/backend)",
    });
  }
  scheduleReset();
}

// ---------------------------------------------------------------------
// Hubungkan event dari FingerprintBridge ke UI
// ---------------------------------------------------------------------
FingerprintBridge.on("modeReady", ({ mode }) => {
  modePill.textContent = mode === "live" ? "MODE LIVE" : "MODE SIMULASI";
  modePill.classList.toggle("live", mode === "live");
  modePill.classList.toggle("sim", mode !== "live");
  simBtn.style.display = mode === "live" ? "none" : "inline-block";
});

const reconnectBtn = document.getElementById("reconnectBtn");
if (reconnectBtn) {
  reconnectBtn.addEventListener("click", () => {
    deviceStatus.textContent = "Menghubungkan ulang...";
    reconnectBtn.style.display = "none";
    FingerprintBridge.reconnect();
  });
}

FingerprintBridge.on("deviceStatus", ({ connected, simulated, error }) => {
  if (connected) {
    deviceStatus.textContent = simulated
      ? "Reader: mode simulasi aktif"
      : "Reader terhubung";
    if (reconnectBtn) reconnectBtn.style.display = "none";
  } else {
    deviceStatus.textContent = error
      ? `Reader error: ${error}`
      : "Reader tidak terdeteksi";
    if (reconnectBtn) reconnectBtn.style.display = "inline-flex";
  }
});

FingerprintBridge.on("quality", ({ q }) => {
  setQuality(q);
  setState("scanning", {
    title: "Membaca sidik jari…",
    sub: q < 1 ? "Jangan angkat jari dulu" : "Memproses…",
  });
});

FingerprintBridge.on("scanCaptured", () => {
  setState("scanning", { title: "Mencocokkan…", sub: "Mohon tunggu sebentar" });
});

FingerprintBridge.on("identified", ({ dp_username, score, _demoName }) => {
  logPresensi({ dp_username, score, demoName: _demoName });
});

FingerprintBridge.on("noMatch", () => {
  setState("error", {
    title: "Tidak dikenali",
    sub: "Coba tempelkan jari sekali lagi",
  });
  scheduleReset();
});

FingerprintBridge.on("error", ({ message }) => {
  setState("error", { title: "Terjadi kesalahan", sub: message || "" });
  scheduleReset();
});

// Tombol simulasi (hanya tampil saat mode simulasi)
simBtn.addEventListener("click", () => {
  resetToWaiting();
  FingerprintBridge.runSimulatedScan();
});

// ---------------------------------------------------------------------
resetToWaiting();
FingerprintBridge.init();
