// Fungsi admin akun PAPAN — SATU-SATUNYA tempat kunci service_role dipakai.
// Kunci itu tidak boleh menyentuh aplikasi web: siapa pun bisa membacanya dari
// browser dan langsung berkuasa penuh atas basis data. Di sini ia hidup di
// server Supabase sebagai variabel lingkungan.
//
// verify_jwt sengaja dimatikan di gerbang platform karena kita memeriksa token
// sendiri di bawah (butuh pesan galat berbahasa Indonesia + cek peran
// superadmin, bukan sekadar "token valid").
import { createClient } from 'jsr:@supabase/supabase-js@2'

const URL_SB = Deno.env.get('SUPABASE_URL')!
const KUNCI_LAYANAN = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const KUNCI_ANON = Deno.env.get('SUPABASE_ANON_KEY')!

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jawab(isi: unknown, status = 200) {
  return new Response(JSON.stringify(isi), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return jawab({ galat: 'Metode tidak didukung' }, 405)

  // 1. Identitas pemanggil — token pengguna, bukan kunci admin.
  const auth = req.headers.get('Authorization') ?? ''
  const token = auth.replace(/^Bearer /i, '')
  if (!token) return jawab({ galat: 'Tidak ada sesi. Masuk dulu.' }, 401)

  const sbPengguna = createClient(URL_SB, KUNCI_ANON, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data: { user }, error: galatUser } = await sbPengguna.auth.getUser()
  if (galatUser || !user) {
    // Sebab paling sering BUKAN token palsu, melainkan token kedaluwarsa
    // (umurnya 1 jam) di tab yang lama dibuka. Kode `sesi_kedaluwarsa` dipakai
    // aplikasi untuk menyegarkan sesi lalu mencoba lagi sekali, tanpa
    // melempar penggunanya keluar.
    return jawab({
      galat: 'Sesi kedaluwarsa — muat ulang halaman lalu coba lagi.',
      sesi_kedaluwarsa: true,
    }, 401)
  }

  // 2. Gerbang peran: hanya superadmin AKTIF yang boleh mengelola akun.
  const sbAdmin = createClient(URL_SB, KUNCI_LAYANAN)
  const { data: profilPemanggil } = await sbAdmin
    .from('profil').select('peran, aktif').eq('id', user.id).single()
  if (!profilPemanggil || profilPemanggil.peran !== 'superadmin' || !profilPemanggil.aktif) {
    return jawab({ galat: 'Khusus superadmin.' }, 403)
  }

  let badan: Record<string, unknown>
  try { badan = await req.json() } catch { return jawab({ galat: 'Isi permintaan bukan JSON.' }, 400) }
  const aksi = String(badan.aksi ?? '')

  try {
    switch (aksi) {
      // Buat akun tanpa membuka Supabase. email_confirm: true = langsung bisa
      // dipakai dan TIDAK mengirim email (jalur signup biasa kena rate limit
      // email Supabase).
      case 'buat': {
        const email = String(badan.email ?? '').trim().toLowerCase()
        const sandi = String(badan.sandi ?? '')
        const alias = String(badan.alias ?? '').trim()
        if (!email || sandi.length < 8) {
          return jawab({ galat: 'Email wajib dan sandi minimal 8 karakter.' }, 400)
        }
        if (alias.length < 2) {
          return jawab({ galat: 'Alias wajib diisi (minimal 2 karakter) — dipakai sebagai kredit di PDF.' }, 400)
        }
        const { data, error } = await sbAdmin.auth.admin.createUser({
          email, password: sandi, email_confirm: true,
        })
        if (error) return jawab({ galat: error.message }, 400)
        await sbAdmin.from('profil').update({
          alias,
          kuota_manual: badan.kuota_manual === null ? null : Number(badan.kuota_manual ?? badan.kuota_harian ?? 1),
          kuota_harian: Number(badan.kuota_harian ?? 1),
          boleh_bedah: Boolean(badan.boleh_bedah ?? false),
          diubah_pada: new Date().toISOString(),
        }).eq('id', data.user!.id)
        return jawab({ ok: true, id: data.user!.id, email })
      }

      case 'reset_sandi': {
        const id = String(badan.id ?? '')
        const sandi = String(badan.sandi ?? '')
        if (!id || sandi.length < 8) return jawab({ galat: 'ID wajib dan sandi minimal 8 karakter.' }, 400)
        const { error } = await sbAdmin.auth.admin.updateUserById(id, { password: sandi })
        if (error) return jawab({ galat: error.message }, 400)
        return jawab({ ok: true })
      }

      // Ganti alamat email akun. email_confirm: true = alamat baru langsung
      // dianggap terverifikasi, tanpa surel konfirmasi — sejalan dengan cara
      // akun dibuat di sini. Kolom `profil.email` ikut diperbarui supaya
      // tampilan tidak menunjukkan alamat lama.
      case 'set_email': {
        const id = String(badan.id ?? '')
        const email = String(badan.email ?? '').trim().toLowerCase()
        if (!id) return jawab({ galat: 'ID wajib.' }, 400)
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
          return jawab({ galat: 'Alamat email tidak sah.' }, 400)
        }
        const { error } = await sbAdmin.auth.admin.updateUserById(id, {
          email, email_confirm: true,
        })
        if (error) return jawab({ galat: error.message }, 400)
        await sbAdmin.from('profil')
          .update({ email, diubah_pada: new Date().toISOString() }).eq('id', id)
        return jawab({ ok: true, email })
      }

      case 'set_profil': {
        const id = String(badan.id ?? '')
        if (!id) return jawab({ galat: 'ID wajib.' }, 400)
        const perubahan: Record<string, unknown> = { diubah_pada: new Date().toISOString() }
        if (badan.peran !== undefined) perubahan.peran = badan.peran
        if (badan.kuota_harian !== undefined) perubahan.kuota_harian = Number(badan.kuota_harian)
        // Fase 6: kuota_manual null = "ikut jenjang", angka = LANTAI kuota
        // (kuota_saya memakai greatest(manual, kuota jenjang)). null di sini
        // BERMAKNA, jadi jangan disamakan dengan "tidak dikirim".
        if (badan.kuota_manual !== undefined) {
          perubahan.kuota_manual = badan.kuota_manual === null ? null : Number(badan.kuota_manual)
        }
        // Jenjang disetel superadmin: tulis tier DAN tier_dasar sekaligus.
        // tier_dasar adalah LANTAI-nya — tanpa itu, trigger segarkan_jenjang()
        // menghitung ulang dari jumlah setoran pada perubahan setoran
        // berikutnya dan menarik orangnya kembali turun. hitung_jenjang()
        // tetap boleh menaikkan di ATAS lantai ini.
        if (badan.tier !== undefined) {
          const tier = Number(badan.tier)
          if (!Number.isInteger(tier) || tier < 0 || tier > 5) {
            return jawab({ galat: 'Jenjang harus angka 0–5.' }, 400)
          }
          perubahan.tier = tier
          perubahan.tier_dasar = tier
        }
        if (badan.beku_otomatis !== undefined) perubahan.beku_otomatis = Boolean(badan.beku_otomatis)
        if (badan.boleh_bedah !== undefined) perubahan.boleh_bedah = Boolean(badan.boleh_bedah)
        if (badan.aktif !== undefined) perubahan.aktif = Boolean(badan.aktif)
        if (badan.alias !== undefined) {
          const alias = String(badan.alias ?? '').trim()
          if (alias.length < 2) return jawab({ galat: 'Alias minimal 2 karakter.' }, 400)
          perubahan.alias = alias
        }
        // Reset akurasi (pendidikan, bukan hukuman permanen): `akurasi_sejak`
        // string ISO = mulai hitung dari sekarang, `null` = BATALKAN reset,
        // kembali ke seluruh riwayat. null di sini BERMAKNA — pola sama
        // persis dengan kuota_manual di atas, jangan disamakan dengan "tidak
        // dikirim". Jumlah setoran disetujui tidak pernah ikut berubah di
        // sini — itu dihitung sepanjang masa oleh hitung_jenjang() di basis
        // data, lepas dari jendela ini.
        if (badan.akurasi_sejak !== undefined) {
          const sejak = badan.akurasi_sejak
          if (sejak !== null && typeof sejak !== 'string') {
            return jawab({ galat: 'akurasi_sejak harus tanggal ISO atau null.' }, 400)
          }
          perubahan.akurasi_sejak = sejak
        }

        const turunSendiri = id === user.id &&
          ((perubahan.peran !== undefined && perubahan.peran !== 'superadmin') || perubahan.aktif === false)
        if (turunSendiri) {
          const { count } = await sbAdmin.from('profil')
            .select('id', { count: 'exact', head: true })
            .eq('peran', 'superadmin').eq('aktif', true)
          if ((count ?? 0) <= 1) {
            return jawab({ galat: 'Kamu superadmin aktif terakhir — angkat penggantinya dulu.' }, 400)
          }
        }
        const { error } = await sbAdmin.from('profil').update(perubahan).eq('id', id)
        if (error) return jawab({ galat: error.message }, 400)

        // Kabari kontributornya kalau BARU SAJA direset — bukan saat
        // dibatalkan (itu koreksi admin, bukan sesuatu yang perlu dirayakan).
        // Nadanya sama seperti kabari_hasil_kurasi(): pengakuan di depan,
        // keterangan teknis di belakang — bukan pemberitahuan hukuman.
        if (badan.akurasi_sejak !== undefined && badan.akurasi_sejak !== null) {
          const { error: galatNotif } = await sbAdmin.from('notifikasi').insert({
            untuk: id,
            jenis: 'fitur',
            judul: 'Akurasimu dihitung ulang',
            pesan: 'Catatan lama tidak lagi membebani — mulai sekarang, setoran berikutnya yang menentukan '
              + 'jenjangmu. Setoran yang sudah disetujui tetap dihitung penuh, sepanjang masa: itu kerja yang '
              + 'sudah diakui dan tidak pernah hilang.',
            tautan: '/admin',
          })
          // Kegagalan kirim notifikasi TIDAK membatalkan reset yang sudah
          // tersimpan — kontributornya tetap melihat efeknya di kartu
          // jenjang, cuma tanpa kabar proaktif.
          if (galatNotif) console.error('Gagal kirim notifikasi reset akurasi:', galatNotif.message)
        }

        return jawab({ ok: true })
      }

      case 'hapus': {
        const id = String(badan.id ?? '')
        if (!id) return jawab({ galat: 'ID wajib.' }, 400)
        if (id === user.id) return jawab({ galat: 'Tidak bisa menghapus akun sendiri.' }, 400)

        const { data: sasaran } = await sbAdmin
          .from('profil').select('peran, email').eq('id', id).single()
        if (!sasaran) return jawab({ galat: 'Akun tidak ditemukan.' }, 404)
        if (sasaran.peran === 'superadmin') {
          return jawab({ galat: 'Turunkan dulu perannya jadi kontributor sebelum dihapus.' }, 400)
        }

        // Pagar KETIGA: setoran yang sudah disetujui. Berbeda sifat dari dua
        // pagar di atas — dua itu melindungi SISTEM (jangan sampai admin
        // menghapus dirinya sendiri atau superadmin lain), yang ini melindungi
        // CATATAN. Karena itu ia bisa dilewati dengan sadar, sementara dua
        // yang di atas tetap mutlak.
        //
        // Johan 30 Agu 2026: "seharusnya saya tetap bisa hapus ini akun sudah
        // lama gak aktif". Menolak mutlak berarti akun terlantar tak pernah
        // bisa dibersihkan hanya karena ia pernah menyetor sekali — keputusan
        // yang seharusnya di tangan admin, bukan di kode ini.
        //
        // `paksa` WAJIB dikirim eksplisit. Tanpa itu perilakunya sama persis
        // seperti sebelumnya, jadi tak ada penghapusan yang jadi lebih mudah
        // tanpa seseorang memilihnya lebih dulu.
        const { count } = await sbAdmin.from('setoran')
          .select('id', { count: 'exact', head: true })
          .eq('penyetor', id).eq('status', 'disetujui')
        const nSetoran = count ?? 0
        if (nSetoran > 0 && badan.paksa !== true) {
          return jawab({
            galat: `Akun ini punya ${nSetoran} setoran yang sudah disetujui dan dipakai edisi — nonaktifkan saja, atau hapus paksa kalau memang mau dibuang.`,
            butuh_paksa: true,
            setoran_disetujui: nSetoran,
          }, 409)
        }

        const { error } = await sbAdmin.auth.admin.deleteUser(id)
        if (error) return jawab({ galat: error.message }, 400)
        // `setoran_terhapus` dikembalikan supaya layar bisa mengatakan berapa
        // yang ikut terbawa — angka itu tak bisa ditanyakan lagi sesudahnya.
        return jawab({ ok: true, email: sasaran.email, setoran_terhapus: nSetoran })
      }

      case 'daftar': {
        const { data: profil, error } = await sbAdmin
          .from('profil').select('*').order('dibuat_pada')
        if (error) return jawab({ galat: error.message }, 400)
        const { data: pengguna } = await sbAdmin.auth.admin.listUsers({ perPage: 200 })
        const petaLogin = new Map(pengguna.users.map((u) => [u.id, u.last_sign_in_at]))
        return jawab({
          ok: true,
          akun: (profil ?? []).map((p) => ({ ...p, terakhir_masuk: petaLogin.get(p.id) ?? null })),
        })
      }

      default:
        return jawab({ galat: `Aksi tidak dikenal: ${aksi}` }, 400)
    }
  } catch (e) {
    return jawab({ galat: e instanceof Error ? e.message : 'Galat tak terduga' }, 500)
  }
})
