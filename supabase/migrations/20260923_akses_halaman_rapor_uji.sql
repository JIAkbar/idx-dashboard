-- Rapor Uji (#221 opsi a, 23 Sep 2026): halaman baru didaftarkan publik
-- (sama dengan perilaku fail-open halaman yang belum terdaftar). Tingkatnya
-- bisa Johan ubah dari tab Akses. Sudah diterapkan lewat Supabase MCP
-- (akses_halaman_rapor_uji).
insert into akses_halaman (kunci, label, tingkat, urutan, min_tier, induk) values
  ('rapor-uji', 'Rapor Uji', 'publik', 205, 0, null)
on conflict (kunci) do nothing;
