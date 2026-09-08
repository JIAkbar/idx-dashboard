-- Penghitung pengunjung PAPAN (#112 A, Johan 8 Sep 2026: "sudah kmu pasang
-- soal setiap hari pengunjung PAPAN berapa orang ?").
--
-- Satu baris = satu SIDIK per hari, bukan satu orang. Sidiknya
-- sha256(ip + user-agent + tanggal WIB + garam) yang dihitung di server dan
-- TIDAK PERNAH disimpan bahan bakunya: kolomnya cuma tanggal + sidik, jadi
-- tabel ini tak memuat satu pun data pribadi dan tak bisa dibalik jadi IP.
-- Garamnya berganti bukan per hari melainkan per pemasangan; yang membuat
-- sidik hari ini tak bisa disambung ke sidik besok adalah TANGGAL yang ikut
-- di-hash.
--
-- Kunci utama (tanggal, sidik) + `on conflict do nothing` membuat pemuatan
-- ulang di hari yang sama tak terhitung dua kali — itulah definisi "unik per
-- hari" di sini, dan batasnya jujur: perangkat+jaringan, bukan orang.
--
-- RLS aktif SENGAJA tanpa satu pun policy, sama seperti `live_token`: anon dan
-- authenticated tak punya jalan baca maupun tulis; hanya service_role (yang
-- melewati RLS) dari fungsi server yang menyentuhnya.
create table if not exists public.kunjungan_harian (
  tanggal date not null,
  sidik    text not null,
  primary key (tanggal, sidik)
);

alter table public.kunjungan_harian enable row level security;

-- Hitungan harian/bulanan selalu menyaring `tanggal`, dan kunci utama sudah
-- menaruh tanggal di depan — jadi tak ada indeks tambahan yang perlu dibuat.

comment on table public.kunjungan_harian is
  'Sidik kunjungan harian PAPAN (#112). Isi: tanggal + sha256(ip+user-agent+tanggal WIB+garam). Tanpa PII, tak bisa dibalik. RLS aktif tanpa policy: hanya service_role lewat api/kunjungan.js.';
