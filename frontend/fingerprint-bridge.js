// fingerprint-bridge.js
//
// Lapisan adapter antara UI (app.js) dan reader fingerprint.
// Tujuannya: app.js tidak perlu tahu apakah sedang jalan di device asli
// atau simulasi — keduanya memanggil FingerprintBridge dengan cara yang sama.
//
// Bridge ini punya 2 mode:
//   1. LIVE  — dipakai otomatis kalau file vendor DigitalPersona WebSDK
//              berhasil dimuat (lihat komentar di index.html) DAN reader
//              terdeteksi tersambung.
//   2. SIMULASI — dipakai otomatis kalau vendor lib tidak ada, supaya
//              tampilan & alur bisa langsung diuji tanpa hardware.
//
// PENTING soal bagian LIVE:
// Nama class/method persis dari @digitalpersona/devices bisa berbeda sedikit
// tergantung versi WebSDK yang kamu install (lihat dokumentasi resmi HID:
// https://hidglobal.github.io/digitalpersona-devices/tutorial.html).
// Kode di bawah ini mengikuti pola resmi (FingerprintReader, event
// SamplesAcquired/QualityReported/ErrorOccurred), tapi SILAKAN cek ulang
// terhadap versi vendor file kamu — kalau nama event/method beda, cukup
// sesuaikan di bagian `initLiveReader()` saja, tidak perlu ubah app.js.
//
// PENTING soal identifikasi (pencocokan sidik jari -> nama orang):
// Itu ditangani oleh DigitalPersona Authentication Server (DPAM) kamu,
// BUKAN oleh kode ini. Endpoint & format request-nya spesifik ke versi
// DPAM yang kamu install — cek Swagger UI di server DPAM kamu
// (biasanya https://<server-dpam>/swagger) untuk endpoint identifikasi
// 1:N yang benar, lalu isi `identifyViaDpam()` di bawah.

const FingerprintBridge = (() => {
  let listeners = {};
  let mode = "simulasi"; // 'simulasi' | 'live'
  let liveReader = null;
  let activeDeviceId = "00000000-0000-0000-0000-000000000000";

  function on(event, cb) {
    (listeners[event] ||= []).push(cb);
  }
  function emit(event, payload) {
    (listeners[event] || []).forEach((cb) => cb(payload));
  }

  // ---------------------------------------------------------------------
  // MODE LIVE — device DigitalPersona asli
  // ---------------------------------------------------------------------
  function tryInitLive() {
    // Feature-detect: vendor script sudah di-load & expose namespace `dp`?
    if (typeof window.dp === "undefined" || !window.dp.devices) {
      return false;
    }

    try {
      const { FingerprintReader, SampleFormat } = window.dp.devices;
      liveReader = new FingerprintReader();

      liveReader.on("DeviceConnected", () => {
        // Jangan langsung ubah badge sebelum startAcquisition berhasil dipanggil
        console.log("[FingerprintBridge] DeviceConnected event diterima");
      });
      liveReader.on("DeviceDisconnected", () =>
        emit("deviceStatus", { connected: false }),
      );

      liveReader.on("QualityReported", (e) => {
        // e.quality biasanya enum (Good/Fair/Poor/...) — dipetakan kasar ke 0..1
        const q = mapQualityToProgress(e && e.quality);
        emit("quality", { q });
      });

      liveReader.on("SamplesAcquired", async (e) => {
        emit("scanCaptured", { samples: e.samples });
        // Jika di halaman pendaftaran (daftar.html), jangan panggil identifikasi backend
        if (
          window.location &&
          window.location.pathname &&
          (window.location.pathname.includes("daftar") ||
            window.location.pathname.includes("enroll"))
        ) {
          return;
        }
        try {
          const result = await identifyViaDpam(e.samples);
          if (result && result.username) {
            emit("identified", {
              dp_username: result.username,
              score: result.score ?? null,
            });
          } else {
            emit("noMatch");
          }
        } catch (err) {
          emit("error", {
            message:
              err.message ||
              "Gagal menghubungi DigitalPersona Authentication Server",
          });
        }
      });

      liveReader.on("ErrorOccurred", (e) => {
        emit("error", { message: (e && e.error) || "Reader melaporkan error" });
      });

      window.addEventListener("beforeunload", () => {
        if (liveReader) {
          liveReader.stopAcquisition(activeDeviceId).catch(() => {});
          liveReader
            .stopAcquisition("00000000-0000-0000-0000-000000000000")
            .catch(() => {});
        }
      });

      // Beri jeda secukupnya agar service melepas sesi lama
      setTimeout(async () => {
        try {
          // Bersihkan sesi lama jika ada
          if (activeDeviceId !== "00000000-0000-0000-0000-000000000000") {
            await liveReader.stopAcquisition(activeDeviceId).catch(() => {});
          }
          await liveReader.stopAcquisition().catch(() => {});
          await new Promise((r) => setTimeout(r, 300));

          // Targetkan reader fisik eksternal DigitalPersona U.are.U langsung via handle standar "00000000-0000-0000-0000-000000000000"
          // Ini mencegah request beruntun (Enumerate+DeviceInfo+Start) yang menyebabkan DPAgent terputus di detik ke-3.
          activeDeviceId = "00000000-0000-0000-0000-000000000000";
          try {
            await liveReader.startAcquisition(
              SampleFormat.Intermediate || 2,
              activeDeviceId,
            );
          } catch (firstErr) {
            // Fallback: jeda sebentar dan gunakan ID spesifik dari hasil enumerateDevices
            await new Promise((r) => setTimeout(r, 350));
            const devices = await liveReader.enumerateDevices().catch(() => []);
            if (devices && devices.length > 0) {
              activeDeviceId = devices[0];
              await liveReader.startAcquisition(
                SampleFormat.Intermediate || 2,
                activeDeviceId,
              );
            } else {
              throw firstErr;
            }
          }
          emit("deviceStatus", { connected: true });
        } catch (err) {
          console.warn("[FingerprintBridge] Gagal startAcquisition:", err);
          emit("deviceStatus", {
            connected: false,
            error: err && err.message ? err.message : "Communication failure.",
          });
        }
      }, 400);

      mode = "live";
      return true;
    } catch (err) {
      console.warn(
        "[FingerprintBridge] Gagal init reader asli, fallback ke simulasi:",
        err,
      );
      return false;
    }
  }

  function reconnect() {
    if (liveReader) {
      liveReader.stopAcquisition(activeDeviceId).catch(() => {});
      liveReader
        .stopAcquisition("00000000-0000-0000-0000-000000000000")
        .catch(() => {});
      setTimeout(() => tryInitLive(), 350);
    } else {
      tryInitLive();
    }
  }

  function mapQualityToProgress(quality) {
    // Sesuaikan mapping ini dengan enum SampleQuality versi WebSDK kamu.
    const table = { Good: 1, Fair: 0.6, Poor: 0.3 };
    return table[quality] ?? 0.5;
  }

  // Identifikasi & verifikasi sampel sidik jari melalui backend lokal kita mandiri
  async function identifyViaDpam(samples) {
    const res = await fetch(`${CONFIG.API_BASE}/presensi/verify-biometric`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ samples }),
    });
    if (!res.ok) {
      if (res.status === 404) return null; // tidak ada kecocokan
      const errData = await res.json().catch(() => ({}));
      throw new Error(
        errData.error || `Verifikasi sidik jari lokal gagal (${res.status})`,
      );
    }
    return res.json(); // mengembalikan: { username, score }
  }

  // ---------------------------------------------------------------------
  // MODE SIMULASI — untuk pratinjau UI tanpa hardware
  // ---------------------------------------------------------------------
  const DEMO_PEOPLE = [
    { dp_username: "demo.andi", name: "Andi Wijaya" },
    { dp_username: "demo.sari", name: "Sari Puspita" },
    { dp_username: "demo.budi", name: "Budi Santoso" },
  ];

  function runSimulatedScan() {
    emit("deviceStatus", { connected: true });
    let q = 0;
    const step = () => {
      q += 0.18 + Math.random() * 0.15;
      emit("quality", { q: Math.min(q, 1) });
      if (q < 1) {
        setTimeout(step, 140);
      } else {
        emit("scanCaptured", {
          samples: { simulated_biometric: "SIM_" + Date.now() },
        });
        setTimeout(() => {
          const failed = Math.random() < 0.12;
          if (failed) {
            emit("noMatch");
          } else {
            const person =
              DEMO_PEOPLE[Math.floor(Math.random() * DEMO_PEOPLE.length)];
            emit("identified", {
              dp_username: person.dp_username,
              score: 0.9 + Math.random() * 0.09,
              _demoName: person.name,
            });
          }
        }, 260);
      }
    };
    step();
  }

  async function stopLiveReader() {
    if (liveReader) {
      try {
        await liveReader.stopAcquisition(activeDeviceId);
      } catch (e) {}
      try {
        await liveReader.stopAcquisition(
          "00000000-0000-0000-0000-000000000000",
        );
      } catch (e) {}
    }
  }

  async function navigateTo(url) {
    await stopLiveReader();
    await new Promise((r) => setTimeout(r, 180));
    window.location.href = url;
  }

  function attachNavigationGuards() {
    document
      .querySelectorAll('a[href="index.html"], a[href="daftar.html"]')
      .forEach((a) => {
        a.addEventListener("click", (e) => {
          e.preventDefault();
          navigateTo(a.getAttribute("href"));
        });
      });
  }

  // ---------------------------------------------------------------------
  function init() {
    const ok = tryInitLive();
    if (!ok) {
      mode = "simulasi";
      emit("deviceStatus", { connected: true, simulated: true });
    }
    emit("modeReady", { mode });
    attachNavigationGuards();
  }

  return {
    on,
    init,
    reconnect,
    stopLiveReader,
    navigateTo,
    getMode: () => mode,
    runSimulatedScan,
  };
})();
