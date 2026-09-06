-- Tabel `tesis` — area kontributor beralih dari unggah tangkapan layar ke
-- tesis yang dinilai MESIN.
--
-- Asal: Johan, 5 Sep 2026 — *"sekarang kan tidak perlu lagi ada kurasi, setor
-- orderbook, deepdive yang butuh data broker panjang"* · *"artinya tidak ada
-- lagi upload broker summary yaa, cukup buat tesis ?"*, lalu pemicu
-- *"kerjakan #3"* (6 Sep 2026). Spek lengkap:
-- `docs/spek-dev-papan/tesis-kontributor.md`.
--
-- Empat keputusan Johan yang membentuk berkas ini:
--   1. Visibilitas **publik** — halaman publik boleh membaca isi tesis.
--   2. Beku-karena-absen dimatikan sementara sampai formulir tesis tayang.
--   3. Penyebut akurasi = tesis yang horizonnya sudah lewat (yang masih
--      berjalan tidak menghukum penyetor yang rajin).
--   4. Horizon 5 · 10 · 20 hari bursa.
--
-- `setoran` TIDAK disentuh sama sekali: riwayat lama tetap utuh, dan tabel ini
-- berdiri sendiri. Tak ada satu baris pun yang dipindahkan atau dihapus.
--
-- DITERAPKAN 6 September 2026 (pemicu Johan "kerjakan #3"). Berkas ini adalah
-- salinan sah dari apa yang berdiri di basis data; dua perbaikan menyusul
-- setelah diuji dan sudah ikut di sini: `search_path` `batas_batal_tesis`
-- dikunci, dan pengenal hakim juga membaca peran sesi.
--
-- Diperiksa sesudah diterapkan: 4 policy, RLS nyala, 1 pemicu, advisor
-- keamanan NOL error; tujuh penjaga diuji satu per satu dengan baris nyata
-- yang dihapus lagi sesudahnya.

-- ── Tabel ───────────────────────────────────────────────────────────────────

create table if not exists public.tesis (
  id             uuid primary key default gen_random_uuid(),
  penyetor       uuid not null references public.profil(id) on delete cascade,
  kode           text not null check (kode = upper(btrim(kode)) and length(kode) between 2 and 10),
  arah           text not null check (arah in ('naik','turun')),
  -- Hari bursa terakhir yang barnya sudah FINAL saat setor. Hari sinyal tidak
  -- ikut dinilai — jendela mulai hari bursa berikutnya (keputusan hakim #1).
  tanggal_sinyal date not null,
  masuk_bawah    numeric not null check (masuk_bawah > 0),
  masuk_atas     numeric not null check (masuk_atas  > 0),
  target         numeric not null check (target > 0),
  stop           numeric not null check (stop   > 0),
  horizon_hari   smallint not null check (horizon_hari in (5,10,20)),
  alasan         text not null check (length(btrim(alasan)) between 20 and 280),
  lampiran       text,
  status         text not null default 'menunggu'
                 check (status in ('menunggu','menang','kalah','tak_masuk','menggantung','batal')),
  -- Target DAN stop tersentuh di hari yang sama = kalah, ditandai di sini
  -- supaya besarnya pilihan itu kelihatan, bukan tersembunyi di angka akhir
  -- (keputusan hakim #2).
  ambigu         boolean not null default false,
  dinilai_pada   timestamptz,
  harga_akhir    numeric,
  hari_terpakai  smallint,
  dibuat_pada    timestamptz not null default now(),

  constraint tesis_area_urut check (masuk_bawah <= masuk_atas),
  -- `turun` adalah CERMIN, bukan kasus khusus: target di bawah area masuk,
  -- stop di atasnya. Ditegakkan basis data supaya tesis yang mustahil dinilai
  -- tak pernah bisa lahir.
  constraint tesis_arah_harga check (
    (arah = 'naik'  and target > masuk_atas  and stop < masuk_bawah) or
    (arah = 'turun' and target < masuk_bawah and stop > masuk_atas)
  )
);

comment on table public.tesis is
  'Tesis kontributor yang dinilai MESIN (scripts/riset/nilai_tesis.py), bukan dikurasi tangan. Sekali tulis: isinya tak pernah bisa disunting, hanya dibatalkan sebelum bursa berikutnya buka. Antrean #3, 6 Sep 2026.';
comment on column public.tesis.tanggal_sinyal is
  'Hari bursa yang barnya sudah final saat setor. Hari sinyal TIDAK ikut dinilai; jendela mulai hari bursa berikutnya.';
comment on column public.tesis.status is
  'menunggu -> menang/kalah/tak_masuk/menggantung (ditulis hakim) atau batal (oleh penyetor, sebelum bursa berikutnya buka).';

create index if not exists tesis_penyetor_idx on public.tesis (penyetor, dibuat_pada desc);
create index if not exists tesis_nilai_idx    on public.tesis (status, tanggal_sinyal);

-- ── Batas pembatalan ────────────────────────────────────────────────────────
-- 09:00 WIB pada hari KERJA berikutnya sesudah setor.
--
-- Kalender libur bursa tidak ada di basis data, dan menambahkannya di sini
-- berarti merawat dua kalender. Hari kerja membuat jendelanya lebih PENDEK
-- dari kenyataan saat ada libur — arah yang aman untuk catatan sekali-tulis:
-- yang salah paling banter membuat pembatalan ditolak lebih awal, bukan
-- membuka pembatalan sesudah harganya diketahui.
-- `search_path` dikunci: fungsi tanpa itu memakai jalur pencarian PEMANGGIL.
-- Fungsi ini cuma memakai built-in, jadi jalur kosong sudah cukup.
create or replace function public.batas_batal_tesis(dibuat timestamptz)
returns timestamptz language sql immutable set search_path = '' as $$
  select min(t) from (
    select ((d::date + time '09:00') at time zone 'Asia/Jakarta') as t
    from generate_series((dibuat at time zone 'Asia/Jakarta')::date,
                         (dibuat at time zone 'Asia/Jakarta')::date + 5, interval '1 day') d
    where extract(isodow from d) < 6
  ) x where t > dibuat
$$;

-- ── Sekali tulis ────────────────────────────────────────────────────────────
-- RLS saja tidak cukup, dan bedanya penting: RLS membatasi SIAPA yang boleh
-- menyunting, bukan APA yang boleh berubah. Tanpa pemicu ini, pembatalan yang
-- sah bisa dipakai menyelundupkan target baru di baris yang sama — dan baris
-- itu sudah telanjur jadi rekam jejak.
create or replace function public.tesis_jaga_sekali_tulis()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  -- Diuji 6 Sep 2026 dan versi pertamanya GAGAL: klaim JWT kosong kalau
  -- dijalankan lewat sambungan SQL langsung, jadi hakim yang sah ikut
  -- tertolak. Gagalnya ke arah aman (memblokir, bukan mengizinkan), tapi
  -- tetap salah.
  --
  -- `session_user`, BUKAN `current_user`: di dalam SECURITY DEFINER
  -- `current_user` selalu pemilik fungsinya, jadi memakainya membuat penjaga
  -- ini selalu lolos untuk siapa pun.
  layanan boolean :=
    coalesce(current_setting('request.jwt.claims', true), '') like '%service_role%'
    or session_user in ('postgres', 'supabase_admin', 'service_role');
begin
  if (new.penyetor, new.kode, new.arah, new.tanggal_sinyal, new.masuk_bawah, new.masuk_atas,
      new.target, new.stop, new.horizon_hari, new.alasan, new.dibuat_pada)
     is distinct from
     (old.penyetor, old.kode, old.arah, old.tanggal_sinyal, old.masuk_bawah, old.masuk_atas,
      old.target, old.stop, old.horizon_hari, old.alasan, old.dibuat_pada) then
    raise exception 'tesis sekali tulis: isinya tidak bisa disunting';
  end if;

  if new.status is distinct from old.status then
    if new.status = 'batal' then
      if old.status <> 'menunggu' then
        raise exception 'tesis yang sudah dinilai tidak bisa dibatalkan';
      end if;
      if now() >= public.batas_batal_tesis(old.dibuat_pada) then
        raise exception 'batas pembatalan sudah lewat (bursa berikutnya sudah buka)';
      end if;
    elsif not (layanan or public.saya_superadmin()) then
      raise exception 'vonis tesis ditulis hakim, bukan penyetor';
    end if;
  end if;

  return new;
end $$;

drop trigger if exists tesis_sekali_tulis on public.tesis;
create trigger tesis_sekali_tulis before update on public.tesis
  for each row execute function public.tesis_jaga_sekali_tulis();

-- ── Kuota harian ────────────────────────────────────────────────────────────
-- Memakai `kuota_harian` + `kuota_manual` yang sudah ada, tanpa ruas baru.
-- Ditegakkan basis data, bukan cuma layar: yang cuma dijaga layar tidak dijaga.
create or replace function public.sisa_kuota_tesis()
returns integer language sql stable security definer set search_path = public as $$
  select greatest(
    coalesce((select coalesce(p.kuota_manual, p.kuota_harian) from public.profil p where p.id = auth.uid()), 0)
    - (select count(*) from public.tesis t
       where t.penyetor = auth.uid()
         and t.status <> 'batal'
         and (t.dibuat_pada at time zone 'Asia/Jakarta')::date = (now() at time zone 'Asia/Jakarta')::date),
    0)::int
$$;

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.tesis enable row level security;

-- BACA: publik. Keputusan Johan #1 (5 Sep 2026) — "hasil penilaian jadi berkas
-- statis; halaman publik boleh membaca isi tesis". Yang terbuka: isi tesis dan
-- uuid penyetornya. Nama/alias ada di `profil`, yang TIDAK publik — jadi tesis
-- terbaca tanpa membuka identitas penyetornya.
drop policy if exists tesis_baca on public.tesis;
create policy tesis_baca on public.tesis for select using (true);

drop policy if exists tesis_tulis on public.tesis;
create policy tesis_tulis on public.tesis for insert with check (
  penyetor = auth.uid()
  and public.saya_aktif()
  and status = 'menunggu'
  and (public.saya_superadmin() or public.sisa_kuota_tesis() > 0)
);

-- UBAH: pemiliknya (untuk membatalkan) atau superadmin. Batasan APA yang boleh
-- berubah ada di pemicu di atas, bukan di sini.
drop policy if exists tesis_ubah on public.tesis;
create policy tesis_ubah on public.tesis for update
  using (penyetor = auth.uid() or public.saya_superadmin())
  with check (penyetor = auth.uid() or public.saya_superadmin());

-- HAPUS: hanya superadmin. Kontributor membatalkan, tidak menghapus — catatan
-- yang bisa dihapus penyetornya sendiri bukan rekam jejak.
drop policy if exists tesis_hapus on public.tesis;
create policy tesis_hapus on public.tesis for delete using (public.saya_superadmin());
