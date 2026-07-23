CREATE TABLE IF NOT EXISTS employees ( 
id INTEGER PRIMARY KEY AUTOINCREMENT, 
nama TEXT NOT NULL, 
id_pegawai TEXT UNIQUE NOT NULL, 
dp_username TEXT UNIQUE NOT NULL, 
jabatan TEXT, 
template TEXT, 
aktif INTEGER NOT NULL DEFAULT 1, 
dibuat_pada TEXT NOT NULL DEFAULT (datetime('now', 'localtime')) 
); 

CREATE TABLE IF NOT EXISTS attendance_logs ( 
id INTEGER PRIMARY KEY AUTOINCREMENT, 
employee_id INTEGER NOT NULL REFERENCES employees(id), 
tipe TEXT NOT NULL CHECK (tipe IN ('masuk', 'keluar')) 
);
