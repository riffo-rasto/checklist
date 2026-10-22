# Checklist Harian NOC

Aplikasi web untuk mengisi checklist harian NOC per **tanggal dan shift**, lengkap dengan foto bukti (evidence), rekap yang bisa dilihat di web, dan unduhan CSV / Excel. Backend PHP + MySQL, frontend HTML / CSS / JavaScript biasa tanpa framework.

## Fitur

**Petugas**
- Login per user, jadi tiap item tercatat siapa yang mengisi dan kapan.
- Status per item: **OK / Warning / Down / N/A**. Jam cek terisi otomatis saat status diklik dan tidak bisa diketik.
- Status Warning / Down wajib diberi catatan atau nomor tiket.
- Tombol **Simpan** di tiap item. Setelah disimpan, item **terkunci** (abu-abu, tanda "Selesai") dan tidak bisa diubah. Checklist hari atau shift berikutnya otomatis kosong lagi.
- Foto evidence maksimal 5 per item. Foto dikecilkan otomatis di browser (maks. 1280 px). Foto hanya bisa ditambah atau dihapus **sebelum** item disimpan.
- Rekap: pilih periode, klik **Tampilkan** untuk melihat data lengkap dengan thumbnail foto (klik untuk memperbesar), filter "Hanya Warning / Down", lalu unduh **CSV**, **Excel**, atau **Cetak / PDF**.

**Admin** (tab **Setting** dan tombol tambahan)
- Kelola pengguna: tambah, ubah nama dan peran, reset password, nonaktifkan, hapus.
- Kelola item checklist: tambah, ubah, atur urutan (▲ ▼), nonaktifkan, hapus.
- Tombol **Ubah** pada item terkunci, **Clear** per kelompok, dan **Clear checklist ini** untuk mengosongkan seluruh checklist (termasuk foto) tanpa menunggu ganti hari.
- Tombol **Hapus** di rekap untuk membuang data satu tanggal dan shift beserta fotonya.

| Aksi | Petugas | Admin |
|---|:---:|:---:|
| Isi, simpan, dan upload foto sebelum disimpan | ✔ | ✔ |
| Ubah item yang sudah tersimpan | ✘ | ✔ |
| Lihat rekap dan unduh | ✔ | ✔ |
| Clear checklist, hapus rekap | ✘ | ✔ |
| Setting pengguna dan item | ✘ | ✔ |

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
├── index.html              halaman utama (login, checklist, rekap, setting)
├── assets/
│   ├── css/style.css
│   └── js/app.js           seluruh logika tampilan
├── api/
│   ├── config.php          kredensial database, zona waktu, sesi, fungsi bantu
│   ├── auth.php            login, logout, cek sesi
│   ├── checklist.php       ambil dan simpan checklist (aturan kunci item ada di sini)
│   ├── evidence.php        lihat, upload, hapus foto
│   ├── users.php           CRUD pengguna (admin)
│   ├── items.php           CRUD item checklist (admin)
│   ├── report.php          data rekap untuk tampilan web (JSON)
│   ├── lib_report.php      fungsi rekap bersama (web dan Excel)
│   ├── export.php          unduh CSV dan Excel
│   ├── xlsx.php            pembuat file Excel (tanpa library)
│   ├── admin_data.php      Clear item dan hapus rekap (admin)
│   └── create_user.php     buat user lewat terminal
├── database.sql            instalasi baru (tabel + 21 item contoh)
└── upgrade_v4.sql          menambah tabel evidence ke database lama
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
sudo mkdir -p /var/www/noc-storage/evidence
sudo chown -R www-data:www-data /var/www/noc-storage
sudo chmod -R 750 /var/www/noc-storage
```

Jika lokasinya diubah, sesuaikan konstanta `EVIDENCE_DIR` di `evidence.php`, `export.php`, dan `admin_data.php`.

### 4. Buat akun admin pertama

```bash
php /var/www/html/api/create_user.php admin "Nama Lengkap" PasswordKuat admin
```

Format: `username "Nama" password peran` (peran: `admin` atau `petugas`). User berikutnya dibuat dari tab **Setting**, yang mewajibkan password minimal 8 karakter.

### 5. Buka aplikasi

Akses `http://alamat-server/`, lalu login.

## Pengaturan yang bisa disesuaikan

| Yang diubah | Lokasi |
|---|---|
| Kredensial database | `api/config.php` (`DB_*`) |
| Zona waktu | `api/config.php` (`date_default_timezone_set`) |
| Shift otomatis saat halaman dibuka (Pagi 07–15, Siang 15–23, Malam sisanya) | `assets/js/app.js`, bagian akhir file |
| Maksimal foto per item (5) | `api/evidence.php` dan `app.js` |
| Daftar item checklist | Tab **Setting** (admin) |

## Memperbarui aplikasi

```bash
sudo rsync -a --exclude 'api/config.php' --exclude '*.sql' noc-checklist/ /var/www/html/
```

`config.php` dikecualikan supaya kredensial tidak tertimpa. Setelah mengubah `app.js` atau `style.css`, **naikkan nomor `?v=`** di `index.html` (dua baris) lalu tekan Ctrl+F5, supaya browser mengambil file baru, bukan cache lama.

## Referensi API

Semua endpoint di bawah `api/` membalas JSON (kecuali unduhan dan gambar). Perubahan data (POST) wajib membawa header `X-CSRF-Token`.

| Endpoint | Metode | Akses | Fungsi |
|---|---|---|---|
| `auth.php` | GET / POST | publik | Cek sesi, `?action=login`, `?action=logout` |
| `checklist.php` | GET / POST | login | Ambil checklist (`tanggal`, `shift`), simpan item |
| `evidence.php` | GET / POST | login | Lihat (`?id=`), upload, hapus foto |
| `report.php` | GET | login | Data rekap periode (`from`, `to`) |
| `export.php` | GET | login | Unduh `format=csv` atau `xlsx` (`foto=1/0`) |
| `users.php` | GET / POST | admin | Daftar, tambah, ubah, hapus pengguna |
| `items.php` | GET / POST | admin | Daftar, tambah, ubah, urutkan, hapus item |
| `admin_data.php` | POST | admin | `clear_items`, `delete_session` |

## Tabel database

| Tabel | Isi |
|---|---|
| `users` | akun, peran (`admin` / `petugas`), status aktif |
| `checklist_items` | daftar item, prioritas (P1–P4, END), urutan, aktif |
| `checklist_sessions` | satu baris per tanggal + shift |
| `checklist_entries` | status, catatan, jam, petugas, dan waktu isi tiap item |
| `evidence` | foto per item per sesi (file disimpan di folder storage) |

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
