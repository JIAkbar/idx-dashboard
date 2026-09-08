-- Tabel token rantai LIVE (akun kedua Stockbit) — dipakai fungsi server
-- `api/live-harga.js` (baca `access`) dan cron `api/live-refresh.js` (putar
-- pasangan). Tabelnya sudah ada di basis data sejak 28 Agu 2026 tapi tak
-- pernah punya migrasi di repo; berkas ini menuliskannya supaya repo jadi
-- sumber kebenaran dan penyiapan lingkungan baru tak menebak bentuknya.
--
-- Satu baris saja, id = 1. Isinya kredensial, jadi:
--   * RLS aktif dan SENGAJA tanpa satu pun policy — anon maupun authenticated
--     tak punya jalan baca/tulis; hanya `service_role` (yang melewati RLS)
--     bisa menyentuhnya, dan kunci itu hanya hidup di env server Vercel dan
--     di mesin Johan saat menyemai (`scripts/semai_live_token.py`).
--   * Tak ada kolom turunan, tak ada trigger: makin sedikit jalan menyentuh
--     baris ini, makin sedikit cara membocorkannya.
create table if not exists public.live_token (
  id           integer primary key,
  access       text,
  refresh      text,
  diputar_pada timestamptz
);

alter table public.live_token enable row level security;

comment on table public.live_token is
  'Pasangan token akun KEDUA Stockbit untuk proxy harga live. RLS aktif tanpa policy: hanya service_role. Disemai scripts/semai_live_token.py, diputar cron /api/live-refresh — jangan pernah diputar dari tempat lain (refresh sekali pakai).';
