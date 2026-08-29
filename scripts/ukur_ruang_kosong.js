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
 * wadah yang tidak terpakai isinya. Satu ukuran menangkap keempat sebab tanpa
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

  temuan.sort((a, b) => b.kosongPx - a.kosongPx)
  const total = temuan.reduce((a, t) => a + t.kosongPx, 0)
  console.log(
    `%c${location.pathname} — ${temuan.length} wadah dengan ruang kosong ≥ ${AMBANG_PX}px` +
      ` · total ${total}px`,
    'font-weight:bold',
  )
  if (temuan.length) console.table(temuan)
  else console.log('bersih: tak ada wadah dengan ruang menganggur di atas ambang')

  if (perataan.length) {
    console.log(`%c${perataan.length} kolom yang kepala & selnya tak sejajar`, 'font-weight:bold;color:#e0a')
    console.table(perataan)
  } else {
    console.log('perataan tabel: kepala dan sel sejajar di semua kolom')
  }
  return { ruangKosong: temuan, perataan }
})()
