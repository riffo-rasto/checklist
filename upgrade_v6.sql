USE noc_checklist;
-- Update tindak lanjut untuk item Warning / Down (kolom tindakan + foto setelah penanganan)
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
-- Foto milik sebuah update diberi update_id (foto biasa tetap NULL)
ALTER TABLE evidence
  ADD update_id INT NULL,
  ADD FOREIGN KEY (update_id) REFERENCES checklist_updates(id) ON DELETE CASCADE;
