// routes/employees.js
const express = require("express");
const db = require("../db");

const router = express.Router();

// GET /api/employees - daftar semua peserta/karyawan
router.get("/", (req, res) => {
  const rows = db.prepare(`SELECT * FROM employees ORDER BY nama ASC`).all();
  res.json(rows);
});

// POST /api/employees - daftarkan peserta baru beserta template biometrik asli
router.post("/", (req, res) => {
  const { nama, id_pegawai, dp_username, jabatan, template } = req.body;

  if (!nama || !id_pegawai) {
    return res.status(400).json({
      error: "nama dan id_pegawai wajib diisi",
    });
  }

  const usernameToUse = dp_username || id_pegawai;
  const templateStr =
    typeof template === "object" ? JSON.stringify(template) : template || null;

  try {
    const stmt = db.prepare(`
      INSERT INTO employees (nama, id_pegawai, dp_username, jabatan, template)
      VALUES (@nama, @id_pegawai, @dp_username, @jabatan, @template)
    `);
    const info = stmt.run({
      nama,
      id_pegawai,
      dp_username: usernameToUse,
      jabatan: jabatan || null,
      template: templateStr,
    });
    const created = db
      .prepare(`SELECT * FROM employees WHERE id = ?`)
      .get(info.lastInsertRowid);
    res.status(201).json(created);
  } catch (err) {
    if (err.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return res
        .status(409)
        .json({ error: "id_pegawai atau username sidik jari sudah terdaftar" });
    }
    res
      .status(500)
      .json({ error: "Gagal menyimpan data peserta", detail: err.message });
  }
});

// POST /api/employees/enroll - alias pendaftaran sidik jari mandiri
router.post("/enroll", (req, res) => {
  const { nama, id_pegawai, dp_username, jabatan, template } = req.body;
  if (!nama || !id_pegawai || !template) {
    return res
      .status(400)
      .json({
        error:
          "nama, id_pegawai, dan hasil tangkapan sidik jari (template) wajib diisi",
      });
  }

  const usernameToUse = dp_username || id_pegawai;
  const templateStr =
    typeof template === "object" ? JSON.stringify(template) : template;

  try {
    const stmt = db.prepare(`
      INSERT INTO employees (nama, id_pegawai, dp_username, jabatan, template)
      VALUES (@nama, @id_pegawai, @dp_username, @jabatan, @template)
    `);
    const info = stmt.run({
      nama,
      id_pegawai,
      dp_username: usernameToUse,
      jabatan: jabatan || null,
      template: templateStr,
    });
    const created = db
      .prepare(`SELECT * FROM employees WHERE id = ?`)
      .get(info.lastInsertRowid);
    res.status(201).json(created);
  } catch (err) {
    if (err.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return res
        .status(409)
        .json({ error: "ID Pegawai tersebut sudah terdaftar" });
    }
    res
      .status(500)
      .json({ error: "Gagal mendaftarkan sidik jari", detail: err.message });
  }
});

// DELETE /api/employees/reset - hapus semua data pegawai dan log presensi (reset bersih)
router.delete("/reset", (req, res) => {
  try {
    db.exec(`DELETE FROM attendance_logs; DELETE FROM employees;`);
    res.json({
      ok: true,
      message: "Semua data pegawai dan presensi berhasil dihapus bersih",
    });
  } catch (err) {
    res
      .status(500)
      .json({ error: "Gagal menghapus data", detail: err.message });
  }
});

// DELETE /api/employees/:id - hapus pegawai tertentu
router.delete("/:id", (req, res) => {
  try {
    db.prepare(`DELETE FROM attendance_logs WHERE employee_id = ?`).run(
      req.params.id,
    );
    const info = db
      .prepare(`DELETE FROM employees WHERE id = ?`)
      .run(req.params.id);
    if (info.changes === 0)
      return res.status(404).json({ error: "Pegawai tidak ditemukan" });
    res.json({ ok: true });
  } catch (err) {
    res
      .status(500)
      .json({ error: "Gagal menghapus pegawai", detail: err.message });
  }
});

// PATCH /api/employees/:id/nonaktifkan - nonaktifkan peserta (soft delete)
router.patch("/:id/nonaktifkan", (req, res) => {
  const info = db
    .prepare(`UPDATE employees SET aktif = 0 WHERE id = ?`)
    .run(req.params.id);
  if (info.changes === 0)
    return res.status(404).json({ error: "Peserta tidak ditemukan" });
  res.json({ ok: true });
});

module.exports = router;
