CREATE DATABASE IF NOT EXISTS noc_checklist CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE noc_checklist;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  nama VARCHAR(100) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin','noc','teknis') NOT NULL DEFAULT 'noc',
  aktif TINYINT(1) NOT NULL DEFAULT 1
);

CREATE TABLE checklist_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nama_item VARCHAR(255) NOT NULL,
  prioritas ENUM('P1','P2','P3','P4','END') NOT NULL,
  urutan INT NOT NULL,
  aktif TINYINT(1) NOT NULL DEFAULT 1
);

CREATE TABLE checklist_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tanggal DATE NOT NULL,
  shift ENUM('Pagi','Siang','Malam') NOT NULL,
  user_id INT NOT NULL,
  putaran INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_tgl_shift_put (tanggal, shift, putaran),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE checklist_entries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id INT NOT NULL,
  item_id INT NOT NULL,
  status ENUM('OK','Warning','Down','N/A') NULL,
  catatan TEXT NULL,
  jam_cek TIME NULL,
  user_id INT NULL,
  diisi_pada DATETIME NULL,
  UNIQUE KEY uq_sess_item (session_id, item_id),
  FOREIGN KEY (session_id) REFERENCES checklist_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES checklist_items(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Evidence (gambar) per item per sesi checklist
CREATE TABLE IF NOT EXISTS checklist_updates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  entry_id INT NOT NULL,
  user_id INT NOT NULL,
  tindakan TEXT NOT NULL,
  selesai TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL,
  FOREIGN KEY (entry_id) REFERENCES checklist_entries(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS evidence (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id INT NOT NULL,
  item_id INT NOT NULL,
  file VARCHAR(64) NOT NULL,
  mime VARCHAR(30) NOT NULL,
  user_id INT NULL,
  update_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES checklist_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES checklist_items(id),
  FOREIGN KEY (update_id) REFERENCES checklist_updates(id) ON DELETE CASCADE
);

-- 2) Aplikasi Teknikal
CREATE TABLE IF NOT EXISTS tek_kategori (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nama VARCHAR(60) NOT NULL UNIQUE,
  aktif TINYINT(1) NOT NULL DEFAULT 1
);
INSERT IGNORE INTO tek_kategori (nama) VALUES ('TRANSFORMATOR'),('GENERATOR'),('SET'),('PANEL'),('UPS'),('RECTIFIER'),('BATTERE'),('GROUNDING'),('INTERKONEKSI');

CREATE TABLE IF NOT EXISTS tek_laporan (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tanggal DATE NOT NULL,
  lokasi VARCHAR(150) NOT NULL,
  kategori_id INT NULL,
  jenis ENUM('Preventive','Corrective','Instalasi','Survey','Lainnya') NOT NULL DEFAULT 'Corrective',
  judul VARCHAR(200) NOT NULL,
  uraian TEXT NULL,
  tindakan TEXT NULL,
  status ENUM('Open','In Progress','Selesai') NOT NULL DEFAULT 'Open',
  user_id INT NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NULL,
  KEY idx_tgl (tanggal),
  KEY idx_status (status),
  FOREIGN KEY (kategori_id) REFERENCES tek_kategori(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS tek_foto (
  id INT AUTO_INCREMENT PRIMARY KEY,
  laporan_id INT NOT NULL,
  jenis ENUM('Sebelum','Sesudah','Lainnya') NOT NULL DEFAULT 'Lainnya',
  file VARCHAR(64) NOT NULL,
  mime VARCHAR(30) NOT NULL,
  user_id INT NULL,
  created_at DATETIME NOT NULL,
  FOREIGN KEY (laporan_id) REFERENCES tek_laporan(id) ON DELETE CASCADE
);

INSERT INTO checklist_items (prioritas, urutan, nama_item) VALUES
('P1',1,'Ping upstream (primary & backup): catat latency & packet loss'),
('P1',2,'Cek status BGP/routing session ke upstream'),
('P1',3,'Cek traffic PRTG Gov (drop / flat / spike tidak wajar)'),
('P1',4,'Cek traffic PRTG Corp (drop / flat / spike tidak wajar)'),
('P1',5,'Cek link backbone utama / core router'),
('P2',6,'Ping semua POP (catat yang RTO / latency tinggi)'),
('P2',7,'Cek sensor PRTG Down / Warning / Unusual'),
('P2',8,'Cek utilisasi bandwidth upstream'),
('P2',9,'Cek status OLT (uplink, PON port, ONU offline)'),
('P2',10,'Cek tiket/gangguan open dari shift sebelumnya'),
('P3',11,'Cek CPU, RAM, suhu perangkat inti'),
('P3',12,'Cek interface error / CRC / flapping switch distribusi'),
('P3',13,'Cek DNS resolver & DHCP'),
('P3',14,'Cek power/UPS/genset di POP'),
('P3',15,'Cek log perangkat (login gagal, reboot tak terduga)'),
('P4',16,'Pastikan backup config perangkat berjalan'),
('P4',17,'Cek kapasitas disk/log server monitoring'),
('P4',18,'Cek sertifikat/layanan internal (speedtest, website)'),
('P4',19,'Review pending maintenance / jadwal perubahan'),
('END',20,'Rekap temuan & tiket yang belum selesai'),
('END',21,'Serah terima ke shift berikutnya (handover note)');
