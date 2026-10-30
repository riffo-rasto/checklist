# Checklist Harian NOC

Aplikasi web untuk mengisi checklist harian NOC per **tanggal dan shift**, lengkap dengan foto bukti (evidence), rekap yang bisa dilihat di web, dan unduhan CSV / Excel. Backend PHP + MySQL, frontend HTML / CSS / JavaScript biasa tanpa framework.

## Fitur

**Petugas**
- Login per user, jadi tiap item tercatat siapa yang mengisi dan kapan.
- Status per item: **OK / Warning / Down / N/A**. Jam cek terisi otomatis saat status diklik dan tidak bisa diketik.
- Status Warning / Down wajib diberi catatan atau nomor tiket.
- Tombol **Simpan** di tiap item. Setelah disimpan, item **terkunci** (abu-abu, tanda "Selesai") dan tidak bisa diubah. Checklist hari atau shift berikutnya otomatis kosong lagi.
- Foto evidence maksimal 5 per item. Foto dikecilkan otomatis di browser (maks. 1280 px). Foto hanya bisa ditambah atau dihapus **sebelum** item disimpan.
- Item **Warning / Down** yang sudah disimpan punya tombol **+ Update** untuk mencatat **tindakan / penyelesaian** dan foto setelah penanganan. Bisa beberapa kali (riwayat update), dengan opsi "Masalah sudah selesai". Begitu update dengan centang selesai dikirim, tombol Update hilang (masalah ditutup); admin bisa membukanya kembali dengan menghapus update tersebut. Status dan catatan asli tidak berubah.
- Rekap: pilih periode, klik **Tampilkan** untuk melihat data lengkap dengan thumbnail foto (klik untuk memperbesar), filter "Hanya Warning / Down", lalu unduh **CSV**, **Excel**, atau **Cetak / PDF**. Rekap hanya memuat item yang sudah **disimpan**; foto dari item yang belum disimpan tidak ikut. Tampilan bisa **difilter per shift dan petugas** serta **diurutkan** (tanggal, shift, petugas); filter shift dan petugas ikut diterapkan pada unduhan CSV / Excel.

**Admin** (tab **Setting** dan tombol tambahan)
- Kelola pengguna: tambah, ubah nama dan peran, reset password, nonaktifkan, hapus.
- Kelola item checklist: tambah, ubah, atur urutan (▲ ▼), nonaktifkan, hapus.
- Tombol **Ubah** pada item terkunci, dan **Clear checklist ini** untuk mengosongkan checklist tanpa menunggu ganti hari. Clear **tidak menghapus** apa pun: data yang sudah tersimpan tetap ada di rekap (sebagai "Putaran 1"), dan checklist dibuka kembali kosong sebagai putaran berikutnya.
- Tombol **Hapus** di tiap item pada rekap untuk membuang **satu item** beserta foto dan update-nya (jadi salah isi satu item tidak perlu menghapus seluruh sesi). Jika item itu ada di checklist yang sedang dibuka, item tersebut kembali kosong dan bisa diisi ulang. Ini satu-satunya aksi yang menghapus data rekap.

| Aksi | NOC | Admin |
|---|:---:|:---:|
| Isi, simpan, dan upload foto sebelum disimpan | ✔ | ✔ |
| Ubah item yang sudah tersimpan | ✘ | ✔ |
| Lihat rekap dan unduh | ✔ | ✔ |
| Clear checklist, hapus rekap | ✘ | ✔ |
| Setting pengguna dan item | ✘ | ✔ |

## Aplikasi dan peran

Satu login, dua aplikasi yang dipilih lewat **sidebar** (bisa dilipat jadi ikon):

| Peran | Akses |
|---|---|
| **admin** | Semua: Checklist NOC, Teknikal, dan Setting (pengguna, item checklist, kategori Teknikal) |
| **noc** | Hanya Checklist NOC |
| **teknis** | Hanya aplikasi Teknikal |

Pembatasan dicek di server: pengguna `teknis` yang memanggil endpoint Checklist NOC (atau sebaliknya) akan ditolak (403).

**Teknikal**: laporan pekerjaan teknisi dengan dashboard (jumlah Open / In Progress / Selesai, laporan per kategori), daftar laporan dengan filter (tanggal, status, kategori, pencarian, laporan saya), form laporan (tanggal, lokasi, kategori, jenis pekerjaan, judul, uraian, tindakan, status), foto sebelum / sesudah, dan halaman detail. Laporan dapat diubah oleh pembuatnya atau admin; hanya admin yang menghapus. Kategori dikelola admin di **Setting**.

## Kebutuhan

- Linux dengan **Apache 2.4** (atau web server lain yang menjalankan PHP)
- **PHP 8.1+** dengan ekstensi: `pdo_mysql`, `zip`, `mbstring`, `fileinfo`, dan **`gd`** (disarankan, untuk mengecilkan foto di Excel)
- **MySQL 8 / MariaDB**

Contoh di Ubuntu:

```bash
sudo apt install apache2 php libapache2-mod-php php-mysql php-zip php-gd php-mbstring mysql-server
```

## Struktur folder

```
noc-checklist/
├── index.html              halaman utama (login, checklist, rekap, setting, Teknikal)
├── assets/
│   ├── css/style.css
│   └── js/                 script biasa (bukan ES module), urutan muatnya ada di index.html
│       ├── core/
│       │   ├── core.js         selektor $, state sesi, api(), pesan dan error
│       │   ├── images.js       perkecil foto, thumbnail, penampil foto besar
│       │   └── nav.js          sidebar, menu profil, go() (pindah tampilan), show()
│       ├── checklist/
│       │   ├── checklist.js    daftar item, status, simpan, kunci, clear
│       │   ├── evidence.js     foto evidence per item
│       │   ├── followup.js     update tindak lanjut Warning / Down
│       │   └── report.js       rekap, filter, unduh CSV / Excel, cetak
│       ├── admin/
│       │   ├── users.js        Setting: pengguna
│       │   └── items.js        Setting: item checklist
│       ├── teknikal/
│       │   ├── laporan.js      aplikasi Teknikal: dashboard, daftar, form, detail
│       │   └── kategori.js     Setting: kategori Teknikal
│       └── main.js             titik masuk: login / logout dan inisialisasi (dimuat paling akhir)
├── api/                    endpoint (URL tidak berubah, dipanggil dari JS)
│   ├── config.php          HANYA kredensial database dan zona waktu (file yang diedit saat instalasi)
│   ├── auth.php            login, logout, cek sesi
│   ├── checklist.php       ambil dan simpan checklist (aturan kunci item ada di sini)
│   ├── evidence.php        lihat, upload, hapus foto
│   ├── updates.php         update tindak lanjut item Warning/Down (tindakan + foto)
│   ├── teknikal.php        aplikasi Teknikal: laporan, foto, dashboard, kategori
│   ├── users.php           CRUD pengguna (admin)
│   ├── items.php           CRUD item checklist (admin)
│   ├── report.php          data rekap untuk tampilan web (JSON)
│   ├── export.php          unduh CSV dan Excel
│   ├── admin_data.php      Clear checklist (putaran baru) dan hapus rekap (admin)
│   └── lib/                bukan endpoint, hanya dimuat lewat require
│       ├── bootstrap.php   dimuat pertama oleh tiap endpoint: ini_set, config, lokasi foto, helper, sesi
│       ├── helpers.php     db(), out(), body(), need_login / need_csrf / need_admin
│       ├── access.php      hak akses aplikasi per peran
│       ├── checklist_session.php  mencari/membuat sesi aktif (putaran terbaru)
│       ├── report.php      fungsi rekap bersama (web dan Excel)
│       └── xlsx.php        pembuat file Excel (tanpa library)
├── bin/
│   └── create_user.php     buat user lewat terminal
├── database.sql            instalasi baru (tabel + 21 item contoh)
├── upgrade_v4.sql          menambah tabel evidence ke database lama
├── upgrade_v5.sql          menambah kolom putaran (fitur Clear tanpa menghapus data)
├── upgrade_v6.sql          tabel checklist_updates + kolom evidence.update_id (fitur Update)
└── upgrade_v7.sql          peran baru (admin / noc / teknis) + tabel aplikasi Teknikal
```

## Instalasi

### 1. Database

```sql
CREATE DATABASE noc_checklist CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'noc_user'@'localhost' IDENTIFIED BY 'PasswordKuat';
GRANT ALL PRIVILEGES ON noc_checklist.* TO 'noc_user'@'localhost';
FLUSH PRIVILEGES;
```

```bash
mysql -u noc_user -p noc_checklist < database.sql
```

> `database.sql` hanya untuk instalasi **baru**. Untuk database yang sudah berjalan, jangan di-import ulang.

### 2. Salin file dan isi kredensial

```bash
sudo rsync -a --exclude '*.sql' noc-checklist/ /var/www/html/
sudo nano /var/www/html/api/config.php     # isi DB_NAME, DB_USER, DB_PASS
```

### 3. Folder penyimpanan foto

Folder ini sengaja **di luar web root** supaya foto hanya bisa dibuka lewat `api/evidence.php` setelah login:

```bash
sudo mkdir -p /var/www/noc-storage/evidence /var/www/noc-storage/teknikal
sudo chown -R www-data:www-data /var/www/noc-storage
sudo chmod -R 750 /var/www/noc-storage
```

Jika lokasinya diubah, aktifkan baris `EVIDENCE_DIR` / `TEK_DIR` yang dikomentari di `api/config.php` (cukup di satu tempat). Defaultnya ada di `api/lib/bootstrap.php`.

### 4. Buat akun admin pertama

```bash
php /var/www/html/bin/create_user.php admin "Nama Lengkap" PasswordKuat admin
```

Format: `username "Nama" password peran` (peran: `admin`, `noc`, atau `teknis`). User berikutnya dibuat dari tab **Setting**, yang mewajibkan password minimal 8 karakter.

### 5. Buka aplikasi

Akses `http://alamat-server/`, lalu login.

## Pengaturan yang bisa disesuaikan

| Yang diubah | Lokasi |
|---|---|
| Kredensial database | `api/config.php` (`DB_*`) |
| Zona waktu | `api/config.php` (`date_default_timezone_set`) |
| Shift otomatis saat halaman dibuka (Pagi 07–15, Siang 15–23, Malam sisanya) | `assets/js/main.js` |
| Maksimal foto per item (5) | `api/evidence.php` dan `assets/js/checklist/evidence.js` |
| Daftar item checklist | Tab **Setting** (admin) |

## Memperbarui aplikasi

```bash
sudo rsync -a --exclude 'api/config.php' --exclude '*.sql' noc-checklist/ /var/www/html/
```

`config.php` dikecualikan supaya kredensial tidak tertimpa. Setelah mengubah file di `assets/js/` atau `style.css`, **naikkan nomor `?v=`** di `index.html` (semua baris `<script>` JS, atau baris CSS) lalu tekan Ctrl+F5, supaya browser mengambil file baru, bukan cache lama.

### Migrasi dari versi lama (struktur sebelum `api/lib/`)

Satu kali saja. `api/config.php` lama berisi kredensial **dan** fungsi bantu; yang baru hanya berisi kredensial. Jika `config.php` lama dibiarkan, setiap endpoint membalas error 500 "api/config.php masih versi lama".

```bash
# 1. simpan kredensial lama
sudo cp /var/www/html/api/config.php /root/config.php.lama
# 2. salin versi baru (kali ini config.php ikut), lalu isi ulang DB_HOST / DB_NAME / DB_USER / DB_PASS dari file lama
sudo rsync -a --exclude '*.sql' noc-checklist/ /var/www/html/
sudo nano /var/www/html/api/config.php
# 3. hapus file lama yang sudah dipindah / diganti (rsync tidak menghapusnya sendiri)
cd /var/www/html && sudo rm -f api/lib_access.php api/lib_session.php api/lib_report.php api/xlsx.php api/create_user.php assets/js/app.js assets/js/teknikal.js
```

Jika sebelumnya lokasi foto diubah (`EVIDENCE_DIR` / `TEK_DIR`), aktifkan barisnya di `config.php` yang baru. Setelah itu, izin `chmod 640` pada `config.php` perlu diterapkan lagi (lihat bagian Keamanan).

Jika database dibuat sebelum fitur putaran, jalankan `upgrade_v5.sql` sekali (backup dulu). Database yang dibuat dari `database.sql` terbaru sudah memilikinya. Untuk fitur Update, jalankan juga `upgrade_v6.sql` sekali. Untuk peran baru dan aplikasi Teknikal, jalankan `upgrade_v7.sql` (peran `petugas` lama otomatis menjadi `noc`).

## Referensi API

Semua endpoint di bawah `api/` membalas JSON (kecuali unduhan dan gambar). Perubahan data (POST) wajib membawa header `X-CSRF-Token`.

| Endpoint | Metode | Akses | Fungsi |
|---|---|---|---|
| `auth.php` | GET / POST | publik | Cek sesi, `?action=login`, `?action=logout` |
| `checklist.php` | GET / POST | login | Ambil checklist (`tanggal`, `shift`), simpan item |
| `evidence.php` | GET / POST | login | Lihat (`?id=`), upload, hapus foto |
| `teknikal.php` | GET / POST | admin, teknis | Dashboard, daftar, detail, simpan laporan, foto; kategori (admin) |
| `updates.php` | POST | login (hapus: admin) | Tambah update tindak lanjut (tindakan + foto), hapus update |
| `report.php` | GET | login | Data rekap periode (`from`, `to`) |
| `export.php` | GET | login | Unduh `format=csv` atau `xlsx` (`foto=1/0`) |
| `users.php` | GET / POST | admin | Daftar, tambah, ubah, hapus pengguna |
| `items.php` | GET / POST | admin | Daftar, tambah, ubah, urutkan, hapus item |
| `admin_data.php` | POST | admin | `clear_checklist`, `delete_entry`, `delete_session` |

## Tabel database

| Tabel | Isi |
|---|---|
| `users` | akun, peran (`admin` / `petugas`), status aktif |
| `checklist_items` | daftar item, prioritas (P1–P4, END), urutan, aktif |
| `checklist_sessions` | satu baris per tanggal + shift + putaran (Clear admin membuka putaran baru) |
| `checklist_entries` | status, catatan, jam, petugas, dan waktu isi tiap item |
| `evidence` | foto per item per sesi (file disimpan di folder storage); `update_id` terisi untuk foto milik sebuah update |
| `tek_laporan`, `tek_foto`, `tek_kategori` | laporan Teknikal, fotonya (file di `noc-storage/teknikal`), dan daftar kategori |
| `checklist_updates` | update tindak lanjut per item Warning / Down: tindakan, status selesai, petugas, waktu |

Pengguna atau item yang sudah punya riwayat **tidak dihapus** saat tombol Hapus ditekan, hanya dinonaktifkan, supaya riwayat checklist tetap utuh.

## Keamanan

- Gunakan **HTTPS** jika diakses lewat jaringan yang tidak sepenuhnya tepercaya (cookie sesi otomatis ditandai `secure` saat HTTPS aktif).
- Gunakan user MySQL khusus aplikasi, bukan `root`.
- Batasi `config.php`: `sudo chown root:www-data api/config.php && sudo chmod 640 api/config.php`.
- Jangan simpan file `.sql` di folder web.
- Ganti password awal segera setelah login pertama.
- Pembatasan peran dicek di **server**, bukan hanya disembunyikan di tampilan.

## Backup

```bash
mysqldump -u noc_user -p noc_checklist > backup_noc.sql
sudo tar czf backup_foto.tar.gz /var/www/noc-storage
```

Database dan folder foto harus ikut dibackup bersama, karena rekap menunjuk ke file foto.

## Pemecahan masalah

| Gejala | Penyebab dan solusi |
|---|---|
| Browser menampilkan kode PHP mentah | PHP belum aktif di web server. Pasang `libapache2-mod-php`, lalu restart Apache. |
| "Respon server bukan JSON" atau layar kosong setelah login | Lihat `sudo tail /var/log/apache2/error.log`. Biasanya kredensial database di `config.php` salah. |
| Setelah refresh kembali ke halaman login | Cache browser atau sesi PHP tidak tersimpan. Coba Incognito, dan cek izin folder sesi PHP. |
| Perubahan JS / CSS tidak terlihat | Cache browser. Naikkan `?v=` di `index.html`, lalu Ctrl+F5. |
| "Gagal menyimpan file" saat upload foto | Izin folder foto. Jalankan `sudo -u www-data touch /var/www/noc-storage/evidence/tes` untuk mengujinya. |
| Foto tidak muncul di Excel, atau file Excel sangat besar | Pasang `php-gd`, lalu restart Apache. |
| "Item ini sudah disimpan dan terkunci" | Perilaku yang disengaja. Admin bisa membuka kunci lewat tombol **Ubah** atau **Clear**. |
| CSV terbuka dalam satu kolom di Excel | Gunakan file hasil unduhan terbaru (pemisah titik koma + baris `sep=;`). |
