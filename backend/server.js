// server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");

const employeesRouter = require("./routes/employees");
const presensiRouter = require("./routes/presensi");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors()); // aktifkan akses LAN dari kiosk manapun; batasi origin di produksi
app.use(express.json());

app.use("/api/employees", employeesRouter);
app.use("/api/presensi", presensiRouter);

app.get("/api/health", (req, res) =>
  res.json({ ok: true, waktu: new Date().toISOString() }),
);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server presensi jalan di http://0.0.0.0:${PORT}`);
  console.log(
    `Akses dari perangkat lain di LAN: http://<IP-komputer-ini>:${PORT}`,
  );
});
