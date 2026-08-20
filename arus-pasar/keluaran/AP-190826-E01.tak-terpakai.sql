-- #181 - setoran disetujui yang tak terpakai di edisi ini.
-- Edisi AP-190826-E01 (2026-08-19). Jalankan sebagai superadmin.
-- Pemicu setoran_kabari_dimuat yang mengirim notifikasinya.
update public.setoran set dimuat = false, catatan_kurator = 'tangkapan layarnya ternyata tabel screener (kolom Sector, RVol, SSS Score, NBSF), bukan orderbook Broker Summary yang dipakai edisi ini'
 where tanggal = '2026-08-19' and upper(ticker) = 'BBCA' and jenis = 'orderbook' and status = 'disetujui' and dimuat;
