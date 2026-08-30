/**
 * Ukur ruang kosong di halaman PAPAN — tempel ke konsol peramban.
 *
 * Asal (Johan, 29 Agu 2026): *"ini sudah saya bilang bnyk area kosong perlu di
 * re-layouting ini page"* — permintaan kedua, yang menurut aturan proyek
 * mewajibkan memperbaiki CARA MENCARINYA lebih dulu, bukan tempat yang
 * ditunjuk.
 *
 * ## Kenapa bukan grep CSS
 *
 * Percobaan pertama mencari pola `repeat(auto-fit, minmax(...))` di berkas CSS
 * dan melaporkan "nol peregangan". Itu keliru arah: ruang kosong di PAPAN
 * lahir dari SETIDAKNYA empat sebab berbeda, dan grep itu hanya melihat satu.
 *
 *   1. `align-items: stretch` — kartu pendek diregangkan setinggi tetangganya
 *   2. baris bertumpuk untuk isi yang muat satu baris
 *   3. satu kartu selebar layar untuk dua kalimat
 *   4. dua kolom tetap yang panjang isinya tak seimbang  ← yang Johan tunjuk
 *
 * Sebab 2, 3, dan 4 tak memakai grid auto-fit sama sekali, jadi grep itu tak
 * akan pernah menemukannya betapapun rapi dijalankan.
 *
 * Alat ini mengukur GEJALANYA, bukan sebabnya: berapa banyak tinggi sebuah
 * wadah yang tidak terpakai isinya. Sejak 30 Agu 2026 ia juga memeriksa dua
 * hal lain yang sama-sama tak pernah tertangkap sampai Johan menunjuknya:
 * perataan kepala-vs-sel tabel, dan kendali yang keluar dari layar ponsel. Satu ukuran menangkap keempat sebab tanpa
 * perlu tahu sebabnya lebih dulu — dan menangkap sebab kelima yang belum
 * kita temukan.
 *
 * ## Pakai
 *
 *   1. buka halaman di lebar yang biasa dipakai (1536 atau 1920)
 *   2. tempel seluruh berkas ini ke konsol
 *   3. baca tabelnya — makin besar `kosongPx`, makin banyak ruang terbuang
 *
 * Ambangnya sengaja rendah (60px): lebih baik memeriksa beberapa temuan yang
 * ternyata sah daripada melewatkan yang nyata. Wadah yang isinya memang
 * seragam akan mengukur nol dan tak muncul sama sekali.
 */
(() => {
  const AMBANG_PX = 60

  /** Sampai mana isi sebuah wadah benar-benar berhenti (tepi bawah anak
   *  terjauh), bukan setinggi apa wadahnya diregangkan. `scrollHeight` tak
   *  bisa dipakai: div yang diregangkan grid melaporkan tinggi yang sama
   *  dengan kotaknya, jadi ia selalu terlihat penuh. */
  const isiBerhentiDi = (el) => {
    const kotak = el.getBoundingClientRect()
    let bawah = kotak.top
    for (const anak of el.children) {
      const b = anak.getBoundingClientRect()
      if (b.height > 0) bawah = Math.max(bawah, b.bottom)
    }
    return bawah - kotak.top
  }

  const nama = (el) => {
    const kelas = (el.className || '').toString().trim().split(/\s+/)[0]
    return kelas ? `.${kelas}` : el.tagName.toLowerCase()
  }

  const temuan = []
  for (const el of document.querySelectorAll('.lantai *')) {
    if (el.children.length < 2) continue
    const kotak = el.getBoundingClientRect()
    if (kotak.height < 120 || kotak.width < 200) continue
    const cs = getComputedStyle(el)
    if (cs.overflowY === 'auto' || cs.overflowY === 'scroll') continue
    // Tata letak berposisi absolut TIDAK diukur dengan cara ini: kuadran
    // scatter, label sudut, penanda titik — semuanya sengaja punya ruang
    // "kosong" karena ruang itulah isinya. Percobaan pertama melaporkan empat
    // label sudut kuadran sebagai 89% terbuang; ruang di bawah label itu area
    // plotnya sendiri.
    if (cs.position === 'absolute' || cs.position === 'fixed') continue
    const adaAnakMengambang = [...el.children].some((c) => {
      const p = getComputedStyle(c).position
      return p === 'absolute' || p === 'fixed'
    })
    if (adaAnakMengambang) continue

    const isi = isiBerhentiDi(el)
    const kosong = Math.round(kotak.height - isi)
    if (kosong < AMBANG_PX) continue

    // Wadah yang kekosongannya cuma diwarisi dari anaknya tidak dihitung dua
    // kali — yang dilaporkan wadah TERDALAM yang benar-benar punya ruang
    // menganggur, karena di situlah perbaikannya.
    const punyaAnakBermasalah = [...el.children].some((c) => {
      const b = c.getBoundingClientRect()
      return b.height >= 120 && b.height - isiBerhentiDi(c) >= AMBANG_PX
    })
    if (punyaAnakBermasalah) continue

    temuan.push({
      wadah: nama(el),
      lebar: Math.round(kotak.width),
      tinggi: Math.round(kotak.height),
      isiSampai: Math.round(isi),
      kosongPx: kosong,
      porsiKosong: `${Math.round((kosong / kotak.height) * 100)}%`,
      anak: el.children.length,
    })
  }

  // ── Perataan tabel ────────────────────────────────────────────────────
  // Ditambahkan 30 Agu 2026 sesudah Johan berkata "masih loncat tuh kolom
  // header volume total". Perbaikan pertama atas tabel yang sama (29 Agu)
  // memeriksa LEBAR saja — kolom melar, kolom terpotong, badan menggulir —
  // dan sel rata-kiri di kolom berjudul rata-kanan lolos ketiganya. Ia tidak
  // melar, tidak terpotong, tidak menggulir; ia cuma tak berbaris.
  //
  // Diukur dari tepi kanan KOTAKNYA, bukan dari nilai `text-align`: dua
  // aturan bisa sama-sama berbunyi "right" sementara salah satunya kalah oleh
  // aturan lain yang lebih spesifik.
  const perataan = []
  for (const tabel of document.querySelectorAll('table')) {
    const th = [...tabel.querySelectorAll('thead th')]
    const baris1 = tabel.querySelector('tbody tr')
    if (!th.length || !baris1) continue
    const td = [...baris1.querySelectorAll('td')]
    th.forEach((h, i) => {
      if (!td[i]) return
      const ah = getComputedStyle(h).textAlign
      const at = getComputedStyle(td[i]).textAlign
      const sama = (x) => (x === 'start' || x === 'left' ? 'kiri' : x === 'end' || x === 'right' ? 'kanan' : x)
      if (sama(ah) !== sama(at)) {
        perataan.push({
          tabel: nama(tabel), kolom: i + 1, judul: h.textContent.trim().slice(0, 24),
          kepala: sama(ah), sel: sama(at),
        })
      }
    })
  }

  // ── Kendali yang keluar dari layar ───────────────────────────────────
  // Ditambahkan 30 Agu 2026 sesudah Johan mengirim tangkapan layar ponsel:
  // "tombol gini di mobile gak rapi kok gak terdeteksi ya? harus ada masukkan
  // dari saya ya?"
  //
  // Jawabannya: tidak terdeteksi karena tak ada yang menanyakannya. Verifikasi
  // ponsel yang berjalan beberapa menit sebelumnya cuma bertanya "apakah
  // paragraf meluber" dan "apakah BADAN menggulir mendatar" — dan badan memang
  // tidak, karena tabelnya menggulir di dalam wadahnya sendiri. Kotak cari yang
  // menonjol 7px dan tab yang terpotong 3px lolos keduanya.
  //
  // Yang diukur: tepi kendali terhadap lebar viewport. Elemen di dalam wadah
  // yang memang bergulir mendatar DIKECUALIKAN — kepala tabel lebar yang
  // menggulir itu rancangan, bukan cacat, dan tanpa pengecualian ini alatnya
  // melaporkan puluhan positif palsu (terukur: 21 dari 23 temuan pertama).
  //
  // (Kodenya ada di bawah blok "celah antar-section" — lihat `const KENDALI`.)

  // ── Celah antar-section yang tak seragam ─────────────────────────────
  // Ditambahkan 30 Agu 2026, dan sebabnya patut dicatat: alat ini dijalankan
  // ke beranda SESUDAH Johan mengeluh "ada area kosong di hapus saja", dan ia
  // melaporkan NOL — padahal keluhannya benar. Yang diukur dua pemeriksa di
  // atas adalah ruang DI DALAM sebuah wadah; yang Johan lihat adalah jarak
  // ANTAR section, dan tak ada satu pun wadah yang memuatnya.
  //
  // Bentuknya waktu itu: gap flex 16px + margin-bawah 24px + margin-atas 26px
  // = 66px di satu sambungan, 28px di dua sambungan, 16px di sisanya. Tak ada
  // satu pun yang "besar" secara mutlak — yang membuatnya terlihat kosong
  // justru KETIDAKSERAGAMANNYA.
  //
  // Karena itu yang diukur di sini bukan besar celahnya, melainkan sebarannya:
  // sambungan yang menyimpang dari celah yang paling sering dipakai halaman.
  const celah = []
  for (const wadah of document.querySelectorAll('.lantai, .dasbor-main')) {
    const anak = [...wadah.children].filter((c) => c.getBoundingClientRect().height > 0)
    if (anak.length < 3) continue
    const jarak = []
    for (let i = 0; i < anak.length - 1; i++) {
      const a = anak[i].getBoundingClientRect()
      const b = anak[i + 1].getBoundingClientRect()
      jarak.push({ i, px: Math.round(b.top - a.bottom), dari: nama(anak[i]), ke: nama(anak[i + 1]) })
    }
    if (jarak.length < 2) continue
    // Modus, bukan rata-rata: satu sambungan yang jauh melenceng menggeser
    // rata-rata dan membuat dirinya sendiri terlihat wajar.
    const hitung = new Map()
    for (const j of jarak) hitung.set(j.px, (hitung.get(j.px) ?? 0) + 1)
    const lazim = [...hitung.entries()].sort((x, y) => y[1] - x[1])[0][0]
    for (const j of jarak) {
      if (Math.abs(j.px - lazim) >= 8) {
        celah.push({ wadah: nama(wadah), sambungan: `${j.dari} → ${j.ke}`, celahPx: j.px, lazimPx: lazim, selisih: j.px - lazim })
      }
    }
  }
  celah.sort((a, b) => Math.abs(b.selisih) - Math.abs(a.selisih))

  const KENDALI = 'input, button, select, textarea, .chip-t, .dd-btn, .inp'
  const dalamWadahBergulir = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const ox = getComputedStyle(p).overflowX
      if (ox === 'auto' || ox === 'scroll') return true
    }
    return false
  }
  const keluar = []
  for (const el of document.querySelectorAll(KENDALI)) {
    const b = el.getBoundingClientRect()
    if (b.width === 0 || b.height === 0) continue
    if (dalamWadahBergulir(el)) continue
    const lewat = Math.round(Math.max(b.right - window.innerWidth, -b.left))
    if (lewat > 0) {
      keluar.push({
        kendali: nama(el),
        teks: (el.textContent || el.placeholder || '').trim().slice(0, 28),
        kiri: Math.round(b.left),
        kanan: Math.round(b.right),
        lewatPx: lewat,
      })
    }
  }
  keluar.sort((a, b) => b.lewatPx - a.lewatPx)

  temuan.sort((a, b) => b.kosongPx - a.kosongPx)
  const total = temuan.reduce((a, t) => a + t.kosongPx, 0)
  console.log(
    `%c${location.pathname} — ${temuan.length} wadah dengan ruang kosong ≥ ${AMBANG_PX}px` +
      ` · total ${total}px`,
    'font-weight:bold',
  )
  if (temuan.length) console.table(temuan)
  else console.log('bersih: tak ada wadah dengan ruang menganggur di atas ambang')

  if (celah.length) {
    console.log(
      `%c${celah.length} sambungan antar-section yang celahnya menyimpang`,
      'font-weight:bold;color:#e0a',
    )
    console.table(celah)
  } else {
    console.log('celah antar-section: seragam')
  }

  if (keluar.length) {
    console.log(
      `%c${keluar.length} kendali keluar dari layar ${window.innerWidth}px`,
      'font-weight:bold;color:#e0a',
    )
    console.table(keluar)
  } else {
    console.log(`kendali: semuanya di dalam layar ${window.innerWidth}px`)
  }

  if (perataan.length) {
    console.log(`%c${perataan.length} kolom yang kepala & selnya tak sejajar`, 'font-weight:bold;color:#e0a')
    console.table(perataan)
  } else {
    console.log('perataan tabel: kepala dan sel sejajar di semua kolom')
  }
  return { ruangKosong: temuan, perataan, kendaliKeluar: keluar, celahAntarSection: celah }
})()
