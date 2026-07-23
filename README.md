<div align="center">
  <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQZuv2vdB3IHmUQKBDWxn3CGTRNktlo6GnzReA-aCZssg&s=10" alt="Presensi Sidik Jari" width="300"/>
  <br/>
  <h1>Presensi Sidik Jari DigitalPersona</h1>
</div>

Presensi Sidik Jari DigitalPersona adalah aplikasi antarmuka presensi modern yang dirancang dengan arsitektur Separation of Concerns tanpa ketergantungan library berat di frontend. Dilengkapi dengan integrasi sensor biometrik fisik DigitalPersona U.are.U 4500, pendaftaran pegawai instan, mode simulasi otomatis, serta desain responsif bertema Dark Mode.

### Informasi
Aplikasi web ini dibuat untuk memudahkan perusahaan/instansi dalam menerapkan sistem presensi berbasis sidik jari yang estetis, cepat, dan andal. Kode terbagi secara modular—frontend statis murni (Vanilla JS/CSS) dan backend Express.js + SQLite—sehingga sangat mudah dimodifikasi dan diintegrasikan ke dalam infrastruktur LAN atau cloud yang sudah ada.

### Uji Coba Langsung (Live Demo)
Anda dapat mengecek dan mencoba interaktivitas antarmuka form presensi, feed real-time, beserta alur pendaftaran pegawai secara langsung. 
**Catatan:** Uji coba langsung ini hanya berupa simulasi tampilan halaman saja agar Anda bisa merasakan pengalaman interaksinya, dan **tidak bisa terhubung langsung ke alat fisik pembaca sidik jari**.
*(Jalankan `npx serve .` di folder frontend lalu buka `http://localhost:3000` di browser Anda)*

### Fitur Unggulan!
- **Integrasi Hardware Langsung (WebSDK)**: Membaca sensor sidik jari fisik secara *real-time* langsung dari peramban (tanpa perlu Java Applet atau ActiveX yang sudah usang).
- **Pendaftaran Otomatis & Tampilan Sidik Jari Asli**: Halaman pendaftaran (`daftar.html`) akan menangkap format gambar presisi tinggi (PNG) dan langsung menyalin serta mendaftarkan sidik jari ke *database* secara otomatis begitu disentuh.
- **Kiosk Mode Interaktif**: Halaman presensi (`index.html`) yang terus bersiaga melacak koneksi *reader* dan menampilkan *feed log* presensi masuk/pulang hari ini dengan animasi halus.
- **Deteksi Cerdas & Mode Simulasi**: Jika driver alat tidak tersambung, aplikasi mendeteksinya tanpa merusak UI dan otomatis mengalihkan ke *Mode Simulasi Tes* agar Anda tetap dapat menguji desain antarmuka.
- **Standar ES6 Modules**: JavaScript dipisah secara modular dan rapi (contoh: `fingerprint-bridge.js`), memudahkan untuk menyambungkannya ke REST API pencocokan biometrik mana pun.

### Instalasi
Petunjuk cara mengatur dan menjalankan aplikasi ini secara lokal di komputer Anda:

```bash
# 1. Jalankan Backend (Database SQLite)
cd backend
npm install
npm start

# 2. Buka terminal baru dan Jalankan Frontend UI
cd ../frontend
npx serve .
```
**Catatan Penting Alat Fisik (Driver & Software Tambahan)**: 
Agar alat sidik jari fisik dapat terbaca dan berkomunikasi dengan browser Anda, Anda diwajibkan untuk mengunduh dan menginstal peranti lunak (driver / Lite Client) resmi terlebih dahulu melalui tautan berikut:
 [Unduh HID Authentication Device Client (Lite Client)](https://crossmatch.hid.gl/lite-client/)

### Memperbarui
Untuk menarik pembaruan kode terbaru dari repositori GitHub:

```bash
git pull origin main
```

### Penyelesaian Masalah & Integrasi API
Jika Anda ingin menghubungkan algoritma pencocokan presensi (identifikasi 1:N) langsung ke DigitalPersona Authentication Server (DPAM) orisinal milik Anda, Anda hanya perlu mengubah satu fungsi utama di `frontend/fingerprint-bridge.js`:

```javascript
// Buka file: frontend/fingerprint-bridge.js
// Ganti logika simulasi dengan koneksi fetch/axios ke endpoint server DPAM Anda:

async function identifyViaDpam(samples) {
  const response = await fetch('https://API-DPAM-ANDA/identify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ samples })
  });
  return await response.json();
}
```
Struktur status *Reader*, validasi absen masuk/pulang, dan notifikasi pop-up (Toast) akan bekerja secara otomatis mengikuti hasil dari fungsi tersebut. Jika Anda mendapatkan error **Communication failure.**, jalankan langsung aplikasi `DPAgent.exe` menggunakan klik ganda di Windows Explorer agar sesi keamanan browser mengenali perizinannya.

### Lisensi
Halaman web/aplikasi ini dapat digunakan secara bebas untuk proyek pribadi, edukasi, maupun komersial Anda. (Harap patuhi EULA dan lisensi resmi dari SDK HID Global / DigitalPersona untuk penggunaan algoritmanya).

Besar harapan saya akan apresiasi dari Anda dengan bersedia mem-follow akun GitHub ini sebagai bentuk dukungan terhadap pengembangan proyek ini:

<a href="https://github.com/GialangCahyaPUPdite" target="_blank">
  <img src="https://img.shields.io/badge/FOLLOW%20GITHUB-GIALANGCAHYAPUPDITE-black?style=for-the-badge&logo=github" alt="Follow GitHub">
</a>

Terima kasih!
