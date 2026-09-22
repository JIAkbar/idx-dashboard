-- Negara pengunjung (#213, Johan 22 Sep 2026: "publik, kartu beranda, boleh
-- unduh. kerjakan #213").
--
-- Kode dua huruf ISO 3166-1 dari kepala `x-vercel-ip-country` yang dipasang
-- Vercel di tiap permintaan; diisi api/kunjungan.js saat POST. Boleh kosong:
-- baris sebelum kolom ini ada, dan permintaan yang kepalanya tak memuat kode
-- sah, tampil sebagai "tak diketahui". Negara bukan data pribadi dan tidak
-- membuat sidik bisa disambung lintas hari (tanggal tetap ikut di-hash).
alter table public.kunjungan_harian add column if not exists negara char(2);

-- Hitungan per negara sejak `dari`. Dipanggil service_role dari fungsi server;
-- anon dan authenticated tak diberi hak eksekusi, sama seperti tabelnya.
create or replace function public.kunjungan_per_negara(dari date)
returns table (negara char(2), n bigint)
language sql stable
set search_path = public
as $$
  select k.negara, count(*)::bigint as n
  from public.kunjungan_harian k
  where k.tanggal >= dari
  group by k.negara
  order by n desc
$$;

revoke all on function public.kunjungan_per_negara(date) from public, anon, authenticated;
grant execute on function public.kunjungan_per_negara(date) to service_role;
