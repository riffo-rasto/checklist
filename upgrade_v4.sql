USE noc_checklist;
-- Evidence (gambar) per item per sesi checklist
CREATE TABLE IF NOT EXISTS evidence (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id INT NOT NULL,
  item_id INT NOT NULL,
  file VARCHAR(64) NOT NULL,
  mime VARCHAR(30) NOT NULL,
  user_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES checklist_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES checklist_items(id)
);
