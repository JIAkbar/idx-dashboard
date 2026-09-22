-- PAPAN Baru (#586, 23 Sep 2026): /baru dan seluruh lapisannya satu kunci (publik,
-- sama dengan perilaku fail-open saat ini). Meja redaksi terpisah, superadmin,
-- berinduk papan-baru. Sudah diterapkan lewat Supabase MCP (akses_halaman_papan_baru).
insert into akses_halaman (kunci, label, tingkat, urutan, min_tier, induk) values
  ('papan-baru', 'PAPAN Baru (5 layar)', 'publik', 12, 0, null),
  ('papan-baru-redaksi', 'PAPAN Baru · Meja redaksi', 'superadmin', 13, 0, 'papan-baru')
on conflict (kunci) do nothing;
