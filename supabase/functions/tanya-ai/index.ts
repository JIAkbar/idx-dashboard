import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

/**
 * Lapis AI Tanya PAPAN — proksi ke Gemini Flash.
 *
 * Dipanggil HANYA kalau mesin aturan (`lib/dasbor/tanyaPapan.ts`) tak
 * mengenali pertanyaannya. Kuncinya tinggal di sini, tak pernah dikirim ke
 * peramban.
 *
 * Tiga penjaga, semuanya disengaja:
 *
 * 1. SAKELAR. Kalau rahasia `TANYA_AI_AKTIF` bukan "true", fungsi ini menjawab
 *    `{ mati: true }` dan klien diam-diam kembali ke jawaban aturannya. Jadi
 *    lapis AI bisa dimatikan dari dasbor Supabase **tanpa deploy ulang** —
 *    itu syarat yang diminta Johan sebelum memasangnya.
 *
 * 2. KUOTA PER IP. Fungsi ini terbuka tanpa login (panel Tanya PAPAN memang
 *    untuk umum), jadi tanpa pembatas ia menjadi proksi Gemini terbuka yang
 *    siapa pun bisa kuras. Batas harian ditegakkan di basis data, bukan di
 *    memori — memori instance Edge hilang tiap dingin.
 *
 * 3. ANGKA TAK BOLEH DIKARANG. Model diberi konteks berisi angka hari itu dan
 *    diperintahkan tidak menyebut angka di luar konteks. Perintah saja tak
 *    cukup, jadi jawabannya DIPERIKSA: bilangan yang tak ada di konteks
 *    membuat jawaban itu dibuang, bukan ditampilkan dengan catatan kecil.
 *    Angka salah yang terlihat meyakinkan lebih berbahaya daripada tak
 *    menjawab.
 *
 * Yang TIDAK pernah dikirim ke model: apa pun tentang akun kontributor —
 * nama, alias, surel, siapa menyetor apa, jenjang siapa. Konteksnya dirakit
 * di klien dari berkas publik saja.
 */

const KUNCI = Deno.env.get('GEMINI_API_KEY') ?? ''
const AKTIF = (Deno.env.get('TANYA_AI_AKTIF') ?? '').toLowerCase() === 'true'
const BATAS_HARIAN = Number(Deno.env.get('TANYA_AI_BATAS_IP') ?? '30')
const MODEL = Deno.env.get('TANYA_AI_MODEL') ?? 'gemini-2.0-flash'

const SB_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SB_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const balas = (isi: unknown, status = 200) =>
  new Response(JSON.stringify(isi), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })

/** Semua bilangan di sebuah teks, dinormalkan supaya "6.401,89" dan "6401.89"
 *  dianggap sama. Dipakai membandingkan jawaban model dengan konteksnya. */
function bilangan(teks: string): string[] {
  return (teks.match(/\d[\d.,]*/g) ?? [])
    .map((b) => b.replace(/[.,](?=\d{3}\b)/g, '').replace(',', '.').replace(/\.0+$/, ''))
    .filter((b) => b.length > 0)
}

/**
 * Angka yang disebut jawaban tapi tak ada di konteks.
 *
 * Bilangan kecil (≤ 100) sengaja diabaikan: itu biasanya penomoran, persen
 * bulat, atau jumlah butir — melarangnya membuat kalimat wajar ikut terbuang
 * tanpa menambah keamanan. Yang dijaga angka pasar: harga, indeks, nilai
 * transaksi.
 */
function angkaAsing(jawaban: string, konteks: string): string[] {
  const punya = new Set(bilangan(konteks))
  return bilangan(jawaban).filter((b) => Number(b) > 100 && !punya.has(b))
}

async function kuotaTerpakai(ip: string): Promise<{ lolos: boolean; jumlah: number }> {
  if (!SB_URL || !SB_SERVICE) return { lolos: true, jumlah: 0 }
  try {
    const r = await fetch(`${SB_URL}/rest/v1/rpc/pakai_kuota_tanya_ai`, {
      method: 'POST',
      headers: {
        apikey: SB_SERVICE,
        Authorization: `Bearer ${SB_SERVICE}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ alamat: ip, batas: BATAS_HARIAN }),
    })
    if (!r.ok) return { lolos: true, jumlah: 0 } // pembatas rusak bukan alasan menolak pengunjung
    const baris = await r.json()
    const b = Array.isArray(baris) ? baris[0] : baris
    return { lolos: Boolean(b?.lolos), jumlah: Number(b?.jumlah ?? 0) }
  } catch {
    return { lolos: true, jumlah: 0 }
  }
}

const PERINTAH = `Kamu "Tanya PAPAN", asisten di situs data pasar saham Indonesia bernama PAPAN.

ATURAN YANG TIDAK BOLEH DILANGGAR:
1. Jawab HANYA dari KONTEKS di bawah. Kalau konteksnya tak memuat jawabannya,
   katakan terus terang bahwa PAPAN belum punya datanya — jangan menebak.
2. DILARANG menyebut angka apa pun yang tidak ada di KONTEKS. Jangan
   memperkirakan, membulatkan, atau mengingat angka dari pengetahuanmu sendiri.
3. DILARANG memberi rekomendasi beli/jual, target harga, atau saran investasi.
   PAPAN menyajikan data dan metodenya, keputusan ada di pembaca.
4. Bahasa Indonesia, ringkas, paling banyak 4 kalimat. Tanpa basa-basi
   pembuka. Tanpa emoji.
5. Kalau ditanya hal di luar pasar saham Indonesia dan situs ini, katakan itu
   di luar cakupanmu.`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return balas({ galat: 'Metode tak didukung.' }, 405)

  // Sakelar diperiksa PALING AWAL: saat mati, tak ada kuota terpakai, tak ada
  // panggilan keluar, tak ada baris tercatat.
  if (!AKTIF || !KUNCI) return balas({ mati: true })

  let badan: { pertanyaan?: string; konteks?: string }
  try {
    badan = await req.json()
  } catch {
    return balas({ galat: 'Badan permintaan bukan JSON.' }, 400)
  }

  const pertanyaan = (badan.pertanyaan ?? '').trim().slice(0, 500)
  const konteks = (badan.konteks ?? '').slice(0, 12000)
  if (!pertanyaan) return balas({ galat: 'Pertanyaan kosong.' }, 400)

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'tanpa-ip'
  const { lolos, jumlah } = await kuotaTerpakai(ip)
  if (!lolos) {
    return balas({
      batas: true,
      teks: `Batas ${BATAS_HARIAN} pertanyaan AI per hari sudah tercapai (${jumlah}). ` +
        'Pertanyaan soal angka pasar tetap dijawab dari data seperti biasa.',
    })
  }

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KUNCI },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: PERINTAH }] },
          contents: [{ role: 'user', parts: [{ text: `KONTEKS:\n${konteks}\n\nPERTANYAAN: ${pertanyaan}` }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 320 },
        }),
      },
    )
    if (!r.ok) {
      const detail = await r.text()
      console.error('Gemini menolak', r.status, detail.slice(0, 300))
      return balas({ galat: 'Lapis AI sedang tak bisa dihubungi.' }, 502)
    }
    const data = await r.json()
    const teks: string = (data?.candidates?.[0]?.content?.parts ?? [])
      .map((p: { text?: string }) => p?.text ?? '').join('').trim()
    if (!teks) return balas({ galat: 'Lapis AI tak memberi jawaban.' }, 502)

    // Penjaga terakhir — lihat catatan (3) di kepala berkas.
    const asing = angkaAsing(teks, `${konteks} ${pertanyaan}`)
    if (asing.length > 0) {
      console.warn('Jawaban dibuang, angka di luar konteks:', asing.join(', '))
      return balas({
        ditolak: true,
        alasan: 'angka-di-luar-konteks',
        teks: 'Jawaban dari lapis AI dibuang karena memuat angka yang tak ada di data PAPAN. ' +
          'Lebih baik tak menjawab daripada menyebut angka yang tak bisa ditelusuri.',
      })
    }

    return balas({ teks, model: MODEL, sisaKuota: Math.max(0, BATAS_HARIAN - jumlah) })
  } catch (e) {
    console.error('Galat memanggil Gemini', e)
    return balas({ galat: 'Lapis AI sedang tak bisa dihubungi.' }, 502)
  }
})
