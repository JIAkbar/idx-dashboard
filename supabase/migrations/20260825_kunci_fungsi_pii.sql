-- Tutup dua fungsi SECURITY DEFINER yang terbuka untuk pemanggil anonim.
--
-- Audit 25 Agu 2026, atas permintaan Johan ("bisa gak kita buat lapisan
-- keamanan untuk menutupi itu semua kecuali yang memang harus publik tau?").
--
-- CATATAN JUJUR TENTANG LUAS TEMUANNYA: laporan awal audit ini menyebut lima
-- fungsi bocor. Itu KELIRU — dinilai dari tanda tangan fungsi (ruas `email`
-- dan `ip` di RETURNS TABLE) tanpa membaca badannya. Setelah dibaca,
-- ringkasan_keaktifan(), kontributor_hampir_beku(), dan sinyal_bruteforce()
-- ternyata SUDAH memuat penjaga `public.saya_superadmin()` di dalam badannya;
-- pemanggil biasa menerima hasil KOSONG. Ketiganya tidak diubah migrasi ini.
--
-- Yang benar-benar terbuka tinggal dua, dan keduanya nyata:
--
-- 1. bekukan_tidak_aktif() — TANPA penjaga, dan ia MENULIS:
--      update public.profil set aktif = false ... returning pr.id, pr.email
--    Pemanggil anonim bisa (a) membekukan massal setiap kontributor yang
--    melewati ambang diam, dan (b) memanen alamat email mereka lewat
--    klausa returning. Tulis tanpa autentikasi + data pribadi sekaligus.
--
-- 2. pangkas_jejak_akses() — TANPA penjaga, dan ia MENGHAPUS baris
--    public.jejak_akses berumur >90 hari. Orang asing bisa mengikis catatan
--    audit.
--
-- Nama fungsi terbaca dari bundel JS publik, jadi "tak ada yang tahu namanya"
-- bukan perlindungan.
--
-- Pola penjaganya MENGIKUTI yang sudah dipakai di basis data ini
-- (`public.saya_superadmin()`), bukan pola baru — supaya satu tempat saja
-- yang menentukan siapa superadmin.
--
-- Diperiksa 25 Agu 2026: nol pemanggilan kedua fungsi ini dari kode aplikasi,
-- jadi mengunci keduanya tidak mematikan fitur apa pun.

begin;

-- 1) Penjaga DI DALAM fungsi (lapis utama — tetap menutup walau hak execute
--    suatu saat diberikan lagi tanpa sengaja).
create or replace function public.bekukan_tidak_aktif()
returns table(id uuid, email text, hari integer)
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not public.saya_superadmin() then
    raise exception 'hanya superadmin' using errcode = '42501';
  end if;
  return query
  with acuan as (
    select p.id, p.email,
           coalesce((select max(s.dibuat_pada) from public.setoran s
                      where s.penyetor = p.id), p.dibuat_pada) as terakhir,
           coalesce(j.hari_beku, 5) as ambang
    from public.profil p
    left join public.jenjang j on j.tier = p.tier
    where p.peran = 'kontributor' and p.aktif and p.beku_otomatis
  )
  update public.profil pr
     set aktif = false, diubah_pada = now()
    from acuan a
   where pr.id = a.id and public.hari_kerja_sejak(a.terakhir) >= a.ambang
  returning pr.id, pr.email, public.hari_kerja_sejak(a.terakhir);
end $function$;

create or replace function public.pangkas_jejak_akses()
returns integer
language sql
security definer
set search_path to 'public'
as $function$
  with hapus as (
    delete from public.jejak_akses
     where public.saya_superadmin()
       and waktu < now() - interval '90 days'
    returning 1
  ) select count(*)::int from hapus
$function$;

-- 2) Cabut hak execute (lapis kedua). `authenticated` ikut dicabut karena
--    peran itu mencakup SETIAP kontributor berakun, bukan cuma admin.
revoke execute on function public.bekukan_tidak_aktif()  from anon, authenticated;
revoke execute on function public.pangkas_jejak_akses()  from anon, authenticated;

-- 3) Fungsi TRIGGER tak perlu hak execute bagi siapa pun — trigger berjalan
--    sebagai pemilik tabel. Grant ke anon murni sisa yang tak berguna, dan
--    permukaan serang yang tak dibayar manfaat apa pun.
revoke execute on function public.buat_profil_otomatis() from anon, authenticated;
revoke execute on function public.kabari_tak_terpakai()  from anon, authenticated;
revoke execute on function public.segarkan_jenjang()     from anon, authenticated;
revoke execute on function public.tambah_laporan()       from anon, authenticated;

commit;
