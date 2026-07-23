// db/index.js
// Setup database SQLite untuk data karyawan/peserta + log presensi.
// CATATAN: Template sidik jari TIDAK disimpan di sini. Pencocokan biometrik
// sepenuhnya ditangani oleh DigitalPersona Authentication Server (DPAM).
// Database ini hanya menyimpan identitas & histori kehadiran.

const path = require("path");
const Database = require("better-sqlite3");

const dbPath = path.join(__dirname, "presensi.db");
const db = new Database(dbPath);

db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nama TEXT NOT NULL,
  id_pegawai TEXT UNIQUE NOT NULL,      -- NIP / ID internal
  dp_username TEXT UNIQUE NOT NULL,     -- username/identitas di DigitalPersona AD/LDS
  jabatan TEXT,
  template TEXT,                        -- template biometrik asli dari sensor
  aktif INTEGER NOT NULL DEFAULT 1,
  dibuat_pada TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS attendance_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employees(id),
  tipe TEXT NOT NULL CHECK (tipe IN ('masuk', 'keluar')),
  waktu TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  skor_kecocokan REAL,                  -- match score dari DPAM, jika tersedia
  sumber_device TEXT,                   -- info kiosk/device asal
  catatan TEXT
);

CREATE INDEX IF NOT EXISTS idx_logs_employee ON attendance_logs(employee_id);
CREATE INDEX IF NOT EXISTS idx_logs_waktu ON attendance_logs(waktu);
`);

try {
  db.exec(`ALTER TABLE employees ADD COLUMN template TEXT;`);
} catch (e) {}

module.exports = db;
