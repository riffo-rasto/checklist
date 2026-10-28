USE noc_checklist;
-- 1) Peran baru: admin (semua), noc (Checklist NOC), teknis (Teknikal). Peran lama 'petugas' menjadi 'noc'.
ALTER TABLE users MODIFY role ENUM('admin','petugas','noc','teknis') NOT NULL DEFAULT 'noc';
UPDATE users SET role = 'noc' WHERE role = 'petugas';
ALTER TABLE users MODIFY role ENUM('admin','noc','teknis') NOT NULL DEFAULT 'noc';

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
