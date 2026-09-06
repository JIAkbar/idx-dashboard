-- Jenjang dihitung dari TESIS, bukan dari setoran tangkapan layar.
--
-- Antrean #3, spek `docs/spek-dev-papan/tesis-kontributor.md` §3. Dipisah dari
-- migrasi tabelnya dengan sengaja: yang ini MENGUBAH ARTI angka yang sudah
-- dipakai orang (jenjang siapa pun bisa berubah begitu ia jalan), jadi ia
-- layak jadi keputusan tersendiri dan bisa diterapkan belakangan.
--
-- URUTAN PENERAPAN: `20260906_tesis_kontributor.sql` DULU, lalu berkas ini.
-- Menjalankan yang ini lebih dulu akan gagal — tabel `tesis` belum ada.
--
-- SESUDAH berkas ini diterapkan, label di layar wajib ikut diganti
-- ("setoran disetujui" -> "tesis tuntas") di `PanelJenjang`, `TanggaJenjang`,
-- `ModalNaikJenjang`, `BadgeRapor`, dan teks `pengetahuan.ts` id
-- `hitung-akurasi`. Selama fungsi ini BELUM diterapkan, labelnya sengaja
-- dibiarkan apa adanya: mengganti kata sementara angkanya masih menghitung
-- setoran lama akan membuat layar berbohong dengan tenang.

-- Dua ruas `jenjang` berganti MAKNA, bukan nilai — angkanya tetap
-- 10/30/75/150/300 dan 70/75/80/85/90:
--   min_disetujui -> jumlah TESIS TUNTAS (menang + kalah + tak_masuk)
--   min_akurasi   -> menang / tesis tuntas
comment on column public.jenjang.min_disetujui is
  'Sejak 6 Sep 2026 (antrean #3): jumlah TESIS TUNTAS — menang + kalah + tak_masuk. Yang masih menggantung tidak dihitung.';
comment on column public.jenjang.min_akurasi is
  'Sejak 6 Sep 2026: menang dibagi tesis TUNTAS (horizonnya sudah lewat). Keputusan Johan #3 — penyebut yang memuat tesis berjalan menghukum keaktifan, bukan ketepatan.';

-- Akurasi milik pengguna sendiri, dari tesis.
create or replace function public.akurasi_tesis_saya()
returns table(tuntas integer, menang integer, berjalan integer, sejak timestamptz)
language sql stable security definer set search_path = public as $$
  select
    count(*) filter (where t.status in ('menang','kalah','tak_masuk')
      and (p.akurasi_sejak is null or t.dinilai_pada >= p.akurasi_sejak))::int,
    count(*) filter (where t.status = 'menang'
      and (p.akurasi_sejak is null or t.dinilai_pada >= p.akurasi_sejak))::int,
    count(*) filter (where t.status in ('menunggu','menggantung'))::int,
    p.akurasi_sejak
  from public.profil p
  left join public.tesis t on t.penyetor = p.id
  where p.id = auth.uid()
  group by p.akurasi_sejak
$$;

-- Jenjang seseorang. Bentuknya sengaja sedekat mungkin dengan `hitung_jenjang`
-- yang lama supaya bedanya bisa dibaca sebaris-sebaris:
--   * penyebut akurasi = tesis TUNTAS (bukan yang dikurasi),
--   * `menggantung` dan `menunggu` tak pernah masuk penyebut,
--   * `tak_masuk` TETAP masuk — tanpanya, asal-tembak jadi gratis,
--   * jumlah tuntas sepanjang masa tak terhapus reset akurasi.
create or replace function public.hitung_jenjang_tesis(uid uuid)
returns smallint language sql stable security definer set search_path = public as $$
  with batas as (
    select akurasi_sejak from public.profil where id = uid
  ), hitung as (
    select
      count(*) filter (where t.status in ('menang','kalah','tak_masuk')) as tuntas,
      count(*) filter (
        where t.status in ('menang','kalah','tak_masuk')
          and (b.akurasi_sejak is null or t.dinilai_pada >= b.akurasi_sejak)) as tuntas_dihitung,
      count(*) filter (
        where t.status = 'menang'
          and (b.akurasi_sejak is null or t.dinilai_pada >= b.akurasi_sejak)) as menang_dihitung
    from public.tesis t, batas b
    where t.penyetor = uid
  ), akurasi as (
    select tuntas,
           case when tuntas_dihitung = 0 then 100
                else round(menang_dihitung::numeric * 100 / tuntas_dihitung) end as pct
    from hitung
  )
  select coalesce(max(j.tier), 0)::smallint
  from public.jenjang j, akurasi a
  where a.tuntas >= j.min_disetujui and a.pct >= j.min_akurasi
$$;

-- CATATAN PERALIHAN, sengaja tidak dikerjakan otomatis:
-- `hitung_jenjang(uuid)` yang lama TIDAK di-drop di sini. Selama masa
-- peralihan keduanya hidup berdampingan, dan pemanggilnya diganti satu per
-- satu dengan mata terbuka. Ingat pelajaran 22 Agu 2026: `create or replace`
-- dengan argumen berbeda MENAMBAH fungsi, bukan mengganti — jadi sesudah
-- semua pemanggil pindah, periksa `pg_get_function_identity_arguments` dan
-- DROP yang lama dalam migrasi tersendiri.
