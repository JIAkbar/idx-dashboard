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
const BATAS_HARIAN = angkaSetelan('TANYA_AI_BATAS_IP', 30)
const MODEL = rantaiModel()


/**
 * Setelan yang salah isi TIDAK BOLEH melumpuhkan lapis ini.
 *
 * Kejadian nyata 16 Agu 2026: `TANYA_AI_BATAS_IP` diisi "true" (ikut-ikutan
 * sakelar di sebelahnya), `Number("true")` jadi NaN, dan `n <= NaN` selalu
 * false -- tiap pertanyaan langsung dianggap melewati batas, lengkap dengan
 * kalimat "Batas NaN pertanyaan" yang bocor ke layar pengunjung.
 * `TANYA_AI_MODEL` pun diisi "true", yang ditolak Google sebagai nama model.
 *
 * Setelan yang tak masuk akal sekarang DIABAIKAN dan jatuh ke bawaannya.
 * Sakelar hidup/mati tetap dihormati mutlak -- yang dilonggarkan hanya dua
 * setelan opsional, karena salah isi di situ berakibat mati total sementara
 * maksudnya cuma menyetel angka.
 */
function angkaSetelan(nama: string, bawaan: number): number {
  const n = Number((Deno.env.get(nama) ?? '').trim())
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : bawaan
}

/**
 * Rantai model, dicoba berurutan sampai ada yang menjawab.
 *
 * `gemini-2.0-flash` yang dipakai versi pertama ternyata sudah ditarik Google
 * ("no longer available") dan seluruh lapis AI mati karena itu. Alias
 * `-latest` membuat penarikan model berikutnya tak mengulang pemadaman yang
 * sama. Ongkosnya: perilakunya bisa berubah tanpa pemberitahuan -- diterima,
 * karena keluaran model di sini sudah dijaga pemeriksa angka dan panjangnya
 * dibatasi.
 */
function rantaiModel(): string[] {
  const m = (Deno.env.get('TANYA_AI_MODEL') ?? '').trim()
  // Nama model Google selalu memuat tanda hubung, tak pernah kata tunggal
  // seperti "true"/"aktif".
  const sah = /^[a-z0-9.-]+$/i.test(m) && m.includes('-')
  // Daftar ini DITANYAKAN ke endpoint /v1beta/models, bukan dihafal dari
  // dokumentasi: `gemini-2.0-flash` sudah ditarik dan `gemini-2.5-flash`
  // "no longer available to new users" -- nama model yang diingat justru
  // sumber pemadamannya.
  const bawaan = ['gemini-flash-latest', 'gemini-3.5-flash', 'gemini-flash-lite-latest', 'gemini-3.1-flash-lite']
  return sah ? [m, ...bawaan.filter((b) => b !== m)] : bawaan
}

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
    const jumlah = Number(b?.jumlah ?? 0)
    // Keputusan lolos DIHITUNG ULANG di sini, bukan sekadar percaya balasan —
    // batas yang dipakai fungsi ini sudah dibersihkan `angkaSetelan()`,
    // sementara nilai mentahnya bisa saja ngawur.
    return { lolos: Number.isFinite(jumlah) ? jumlah <= BATAS_HARIAN : true, jumlah }
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

/** Coba tiap model sampai ada yang menjawab. `null` kalau semuanya gagal —
 *  pemanggil yang memutuskan cara memberitahunya. */
async function tanyaGemini(pertanyaan: string, konteks: string): Promise<{ teks: string; model: string } | null> {
  for (const model of MODEL) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KUNCI },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: PERINTAH }] },
            contents: [{ role: 'user', parts: [{ text: `KONTEKS:
${konteks}

PERTANYAAN: ${pertanyaan}` }] }],
            // `thinkingBudget: 0` WAJIB. Gemini Flash generasi baru memakai
            // jatah keluaran untuk menalar lebih dulu, dan dengan batas 320
            // token jawabannya terpotong di tengah kalimat ("Di situs PAPAN,
            // Anda dapat mengakses berbagai data" -- habis di situ). Jawaban
            // di sini pendek dan sudah ditopang konteks.
            generationConfig: { temperature: 0.2, maxOutputTokens: 700, thinkingConfig: { thinkingBudget: 0 } },
          }),
        },
      )
      if (!r.ok) {
        console.error(`Model ${model} menolak ${r.status}`, (await r.text()).slice(0, 200))
        continue
      }
      const data = await r.json()
      const teks: string = (data?.candidates?.[0]?.content?.parts ?? [])
        .map((p: { text?: string }) => p?.text ?? '').join('').trim()
      if (teks) return { teks, model }
      console.error(`Model ${model} menjawab kosong`)
    } catch (e) {
      console.error(`Model ${model} galat`, e)
    }
  }
  return null
}

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

  const hasil = await tanyaGemini(pertanyaan, konteks)
  if (!hasil) return balas({ galat: 'Lapis AI sedang tak bisa dihubungi.' }, 502)

  const asing = angkaAsing(hasil.teks, `${konteks} ${pertanyaan}`)
  if (asing.length > 0) {
    console.warn('Jawaban dibuang, angka di luar konteks:', asing.join(', '))
    return balas({
      ditolak: true,
      alasan: 'angka-di-luar-konteks',
      teks: 'Jawaban dari lapis AI dibuang karena memuat angka yang tak ada di data PAPAN. ' +
        'Lebih baik tak menjawab daripada menyebut angka yang tak bisa ditelusuri.',
    })
  }

  return balas({ teks: hasil.teks, model: hasil.model, sisaKuota: Math.max(0, BATAS_HARIAN - jumlah) })
})
