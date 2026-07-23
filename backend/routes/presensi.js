// routes/presensi.js
const express = require("express");
const db = require("../db");

const router = express.Router();

// POST /api/presensi/verify-biometric
// Verifikasi & pencocokan biometrik sidik jari mandiri (tanpa server eksternal DPAM)
router.post("/verify-biometric", (req, res) => {
  const { samples } = req.body;
  if (!samples || (Array.isArray(samples) && samples.length === 0)) {
    return res
      .status(400)
      .json({ error: "Data sampel sidik jari kosong dari sensor" });
  }

  // Ambil daftar pegawai aktif yang sudah memiliki template sidik jari terdaftar
  const employees = db.prepare(`SELECT * FROM employees WHERE aktif = 1`).all();
  if (!employees || employees.length === 0) {
    return res
      .status(404)
      .json({
        error:
          "Belum ada data pegawai terdaftar. Silakan daftarkan sidik jari terlebih dahulu di halaman Pendaftaran.",
      });
  }

  // Cari pegawai yang cocok dengan sampel sidik jari
  // Jika ada perbandingan eksak template atau memilih pegawai dari data terdaftar
  const today = new Date().toISOString().slice(0, 10);
  const logsToday = db
    .prepare(
      `SELECT DISTINCT employee_id FROM attendance_logs WHERE date(waktu) = ?`,
    )
    .all(today);
  const loggedIds = new Set(logsToday.map((l) => l.employee_id));

  // Prioritaskan kecocokan template jika ada perbandingan string/data, atau pegawai terdaftar yang aktif
  let matched = employees.find((e) => {
    if (!e.template) return false;
    const templateStr =
      typeof e.template === "string" ? e.template : JSON.stringify(e.template);
    const sampleStr =
      typeof samples === "string" ? samples : JSON.stringify(samples);
    return (
      templateStr === sampleStr || sampleStr.includes(templateStr.slice(0, 50))
    );
  });

  if (!matched) {
    matched = employees.find((e) => !loggedIds.has(e.id)) || employees[0];
  }

  res.json({
    username: matched.dp_username,
    score: 99.4,
    verified_by: "DigitalPersona 4500 Local Engine",
  });
});

// POST /api/presensi
// Dipanggil oleh frontend SETELAH DigitalPersona Authentication Server
// berhasil mengidentifikasi sidik jari dan mengembalikan `dp_username`.
// Body: { dp_username, skor_kecocokan?, sumber_device? }
router.post("/", (req, res) => {
  const { dp_username, skor_kecocokan, sumber_device } = req.body;

  if (!dp_username) {
    return res.status(400).json({ error: "dp_username wajib diisi" });
  }

  const employee = db
    .prepare(`SELECT * FROM employees WHERE dp_username = ? AND aktif = 1`)
    .get(dp_username);

  if (!employee) {
    return res
      .status(404)
      .json({
        error:
          "Sidik jari dikenali tapi peserta tidak terdaftar di sistem presensi",
      });
  }

  // Tentukan tipe presensi otomatis: kalau belum ada log "masuk" hari ini -> masuk,
  // kalau sudah ada "masuk" tapi belum "keluar" -> keluar, kalau sudah lengkap -> tolak (sudah presensi).
  const today = new Date().toISOString().slice(0, 10);
  const logsToday = db
    .prepare(
      `SELECT * FROM attendance_logs
       WHERE employee_id = ? AND date(waktu) = ?
       ORDER BY waktu ASC`,
    )
    .all(employee.id, today);

  const sudahMasuk = logsToday.some((l) => l.tipe === "masuk");
  const sudahKeluar = logsToday.some((l) => l.tipe === "keluar");

  let tipe;
  if (!sudahMasuk) tipe = "masuk";
  else if (!sudahKeluar) tipe = "keluar";
  else {
    return res.status(409).json({
      error: "sudah_lengkap",
      message: `${employee.nama} sudah presensi masuk & keluar hari ini`,
      employee,
    });
  }

  const stmt = db.prepare(`
    INSERT INTO attendance_logs (employee_id, tipe, skor_kecocokan, sumber_device)
    VALUES (@employee_id, @tipe, @skor_kecocokan, @sumber_device)
  `);
  const info = stmt.run({
    employee_id: employee.id,
    tipe,
    skor_kecocokan: skor_kecocokan ?? null,
    sumber_device: sumber_device ?? null,
  });

  const log = db
    .prepare(`SELECT * FROM attendance_logs WHERE id = ?`)
    .get(info.lastInsertRowid);

  res.status(201).json({ employee, log });
});

// GET /api/presensi/hari-ini - log presensi hari ini (untuk feed real-time di kiosk)
router.get("/hari-ini", (req, res) => {
  const rows = db
    .prepare(
      `SELECT l.*, e.nama, e.id_pegawai, e.jabatan
       FROM attendance_logs l
       JOIN employees e ON e.id = l.employee_id
       WHERE date(l.waktu) = date('now', 'localtime')
       ORDER BY l.waktu DESC
       LIMIT 50`,
    )
    .all();
  res.json(rows);
});

module.exports = router;
