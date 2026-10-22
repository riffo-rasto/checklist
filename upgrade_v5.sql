USE noc_checklist;
-- Putaran: "Clear" admin membuka putaran baru, data lama tetap ada di rekap
ALTER TABLE checklist_sessions
  ADD putaran INT NOT NULL DEFAULT 1,
  DROP INDEX uq_tgl_shift,
  ADD UNIQUE KEY uq_tgl_shift_put (tanggal, shift, putaran);
