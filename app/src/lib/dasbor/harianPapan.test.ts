import { describe, expect, it } from 'vitest'
import {
  bangunBarisHarianPapan, barisUntukTab, hitungCloseGap, hitungChg1d, hitungChgPeriode,
  hitungFreeFloat, hitungMa20Arah, hitungNbsf000, hitungRvol10, keCsvHarianPapan,
  posisiHarga, sektorUnikHarianPapan, skorPapan,
  type BarOhlcvStockbit, type BarisHarianPapan,
} from './harianPapan'
import type { BarisOhlc } from './ihsgOhlc'
// Arsip mentah diimpor sebagai modul JSON (resolveJsonModule, sama seperti
// gaya `src/` lain — bukan node:fs/path yang tak dikenal tsconfig.app.json,
// itu punya sengaja hanya types browser). Ini regresi terhadap DATA NYATA,
// bukan fixture yang diketik ulang — "berjangkar pada mentahnya".
import antmRaw from '../../../../data-idx/json/ohlcv_stockbit/ANTM.json'
import mdiaRaw from '../../../../data-idx/json/ohlcv_stockbit/MDIA.json'

// ── Nilai acuan regresi (spek §Bukti verifikasi, tanggal uji 18 Agu 2026) ──
//
// Spek cuma mencatat JUMLAH kecocokan sesi verifikasi sebelumnya ("NBSF
// 22/22 persis"), bukan daftar angkanya — sesi itu tak meninggalkan berkas
// yang bisa dibaca ulang di sini. Yang PUNYA angka eksplisit di teks spek
// cuma Temuan 1 (ANTM) dan Temuan 3 (MDIA volume nol) — dijadikan acuan di
// bawah, dihitung ULANG langsung dari arsip `ohlcv_stockbit/` (bukan disalin
// dari teks spek: angka spek "69.012.970 rb" dibulatkan penyedia lain,
// arsip kita sendiri yang jadi wasit — "berjangkar pada mentahnya").
function bacaBar(raw: unknown): BarOhlcvStockbit[] {
  return (raw as { bar: BarOhlcvStockbit[] }).bar
}

function sampaiTanggal(bar: BarOhlcvStockbit[], tanggal: string): BarOhlcvStockbit[] {
  const idx = bar.findIndex((b) => b[0] === tanggal)
  if (idx < 0) throw new Error(`tanggal ${tanggal} tak ada di arsip`)
  return bar.slice(0, idx + 1)
}

describe('bangunBarisHarianPapan — acuan regresi arsip 18 Agu 2026', () => {
  const antm = bacaBar(antmRaw)
  const antmSampai18 = sampaiTanggal(antm, '2026-08-18')
  const baris = bangunBarisHarianPapan('ANTM', 'Aneka Tambang Tbk.', 'Energi', 35, antmSampai18)

  it('NBSF (000) ANTM 18 Agu 2026 — Temuan 1 spek: tanda net BELI, bukan minus borongan', () => {
    // beli 135.500.688.000, jual 66.487.785.000 (kolom foreignbuy/foreignsell
    // arsip) → net +69.012.903 ribu rupiah. Spek Temuan 1 menyebut penyedia
    // lain SALAH mencetak minus di tabel "Net Sell" mereka walau nilainya net
    // beli — baris ini membuktikan tanda kita benar (positif).
    expect(baris?.nbsf_000).toBeCloseTo(69012903, 0)
    expect(baris!.nbsf_000!).toBeGreaterThan(0)
  })

  it('harga, chg_1d, close_gap, RVol(10) — dihitung ulang independen dari arsip', () => {
    expect(baris?.harga).toBe(3100)
    expect(baris?.chg_1d).toBeCloseTo(0.9771986970684043, 6)
    expect(baris?.close_gap).toBeCloseTo(2.6058631921824116, 6)
    expect(baris?.rvol10).toBeCloseTo(0.8772697457394932, 6)
    expect(baris?.chg_wtd).toBeCloseTo(0.9771986970684043, 6) // 14 Agu = hari bursa terakhir pekan lalu SEKALIGUS kemarin (17 Agu libur)
  })

  it('TDM% tetap month-to-date walau chg_b1 rolling — dua ruas, dua arti', () => {
    // Regresi 29 Agu 2026 (commit 6ed9d3580): `tdm_persen` menumpang variabel
    // `chgMtd`, jadi saat return bulanan diubah jadi rolling atas keputusan
    // Johan, TDM% ikut berubah tanpa diminta — sementara speknya
    // (`spek_harian_papan.md:20`) tetap mendefinisikannya month-to-date.
    // Kolomnya sudah tak tampil di layar, tapi ruasnya ikut ke CSV dan dibaca
    // Screener, jadi tak ada yang menyadarinya.
    //
    // Uji ini mengunci keduanya BERBEDA. Kalau nanti sama lagi, salah satunya
    // sedang menumpang yang lain.
    expect(baris).not.toBeNull()
    expect(baris!.tdm_persen).not.toBeNull()
    expect(baris!.chg_b1).not.toBeNull()
    expect(baris!.tdm_persen).not.toBeCloseTo(baris!.chg_b1!, 6)
  })

  it('return bulanan ROLLING, bukan month-to-date (ketetapan Johan 29 Agu 2026)', () => {
    // Dihitung ulang dari arsip, bukan disalin dari keluaran:
    //   21 hari bursa lalu = 2026-07-17, tutup 3.070 → 3.100/3.070 − 1
    //   42 hari bursa lalu = 2026-06-18, tutup 3.170
    //   63 hari bursa lalu = 2026-05-12, tutup 3.570
    //
    // Sebelum perubahan ini `tdm_persen` berarti month-to-date dan bernilai
    // 7,64% (sejak penutupan Juli). Angkanya beda karena pertanyaannya beda,
    // bukan karena ada yang rusak.
    expect(baris?.chg_b1).toBeCloseTo(0.9771986970684, 6)
    expect(baris?.chg_2m).toBeCloseTo(-2.2082018927445, 6)
    expect(baris?.chg_3m).toBeCloseTo(-13.1652661064426, 6)

    // Kebetulan yang layak disebut supaya angka kembar di bawah tak dikira
    // salah salin: 21 hari bursa lalu jatuh di 17 Juli yang tutupnya 3.070 —
    // sama persis dengan tutup kemarin dan tutup akhir pekan lalu. Tiga
    // kolom berbeda karena itu menunjukkan angka yang sama pada hari ini saja.
    expect(baris?.chg_b1).toBeCloseTo(baris!.chg_1d!, 9)
  })

  it('free float diteruskan apa adanya dari pemanggil (100 − 65% pengendali PT MIND)', () => {
    expect(baris?.free_float).toBe(35)
  })

  it('ANTM 18 Agu 2026 diperdagangkan normal (volume > 0)', () => {
    expect(baris?.tidak_diperdagangkan).toBe(false)
  })
})

describe('tidakDiperdagangkanHariIni — Temuan 3 spek (MDIA volume nol 13/14/18 Agu 2026)', () => {
  const mdia = bacaBar(mdiaRaw)

  it('MDIA 18 Agu 2026: volume nol → tidak diperdagangkan', () => {
    const sampai18 = sampaiTanggal(mdia, '2026-08-18')
    const baris = bangunBarisHarianPapan('MDIA', 'Media Nusantara Citra Tbk.', '-', null, sampai18)
    expect(baris?.volume).toBe(0)
    expect(baris?.tidak_diperdagangkan).toBe(true)
  })

  it('barisUntukTab mengeluarkan emiten tidak-diperdagangkan HANYA dari tab gainer', () => {
    const sampai18 = sampaiTanggal(mdia, '2026-08-18')
    const bekuBaris = bangunBarisHarianPapan('MDIA', 'MDIA', '-', null, sampai18)!
    const hidupBaris = bangunBarisHarianPapan(
      'ANTM', 'ANTM', 'Energi', 35, sampaiTanggal(bacaBar(antmRaw), '2026-08-18'),
    )!
    const semua = [bekuBaris, hidupBaris]
    expect(barisUntukTab(semua, 'gainer').map((b) => b.kode)).toEqual(['ANTM'])
    expect(barisUntukTab(semua, 'net-buy').map((b) => b.kode).sort()).toEqual(['ANTM', 'MDIA'])
    expect(barisUntukTab(semua, 'net-sell').map((b) => b.kode).sort()).toEqual(['ANTM', 'MDIA'])
  })
})

describe('fungsi murni — unit', () => {
  it('hitungNbsf000: tanda apa adanya, bukan nilai absolut', () => {
    expect(hitungNbsf000(1000, 400)).toBe(0.6)
    expect(hitungNbsf000(400, 1000)).toBe(-0.6)
  })

  it('hitungCloseGap & hitungChg1d: null kalau kemarin <= 0', () => {
    expect(hitungCloseGap(110, 100)).toBeCloseTo(10, 6)
    expect(hitungChg1d(110, 100)).toBeCloseTo(10, 6)
    expect(hitungCloseGap(110, 0)).toBeNull()
    expect(hitungChg1d(110, 0)).toBeNull()
  })

  it('hitungChgPeriode: bandingkan ke elemen -2 (periode SEBELUMNYA, bukan yang berjalan)', () => {
    const rakit: BarisOhlc[] = [
      ['2026-06', 0, 0, 0, 100, 0],
      ['2026-07', 0, 0, 0, 110, 0], // periode sebelumnya (dasar)
      ['2026-08', 0, 0, 0, 121, 0], // periode berjalan, TAK dipakai sbg dasar
    ]
    expect(hitungChgPeriode(121, rakit)).toBeCloseTo(10, 6)
    expect(hitungChgPeriode(121, rakit.slice(0, 1))).toBeNull() // <2 elemen
  })

  it('hitungRvol10: butuh 11 titik penuh (10 dasar + hari ini), null kalau kurang', () => {
    const cukup = [...Array.from({ length: 10 }, () => 100), 250]
    expect(hitungRvol10(cukup)).toBeCloseTo(2.5, 6)
    expect(hitungRvol10([100, 100])).toBeNull() // cuma 2 titik, jauh dari 11
  })

  it('hitungMa20Arah & posisiHarga', () => {
    const naik20 = Array.from({ length: 22 }, (_, i) => i) // MA20 hari ini > MA20 kemarin
    expect(hitungMa20Arah(naik20)).toBe('naik')
    expect(hitungMa20Arah(Array.from({ length: 5 }, () => 1))).toBeNull() // <21 titik
    expect(posisiHarga(100, 90)).toBe('atas')
    expect(posisiHarga(100, 110)).toBe('bawah')
    expect(posisiHarga(100, 100)).toBeNull()
    expect(posisiHarga(100, null)).toBeNull()
  })

  it('hitungFreeFloat: daftar berisi tapi NOL pengendali → null, bukan 100%', () => {
    // Bentuk data BBRI 28 Agu 2026: pemegang mayoritas ada, flag pengendali
    // kosong. Versi pertama mengembalikan 100% — klaim bahwa seluruh saham
    // beredar bebas, untuk emiten yang 52,656%-nya dipegang satu pihak.
    // Terukur 42 dari 960 emiten, termasuk BBNI, BMRI, BBTN, ADHI.
    expect(
      hitungFreeFloat([
        { persen: 52.656, pengendali: false },  // PT Danantara Asset Management
        { persen: 46.2231, pengendali: false }, // Masyarakat Non Warkat
      ]),
    ).toBeNull()
  })

  it('hitungFreeFloat: 100 − jumlah persen pengendali, diklip [0,100], null kalau kosong', () => {
    expect(hitungFreeFloat([{ persen: 65, pengendali: true }, { persen: 35, pengendali: false }])).toBe(35)
    expect(hitungFreeFloat([{ persen: 105, pengendali: true }])).toBe(0) // diklip, bukan negatif
    expect(hitungFreeFloat([])).toBeNull()
    expect(hitungFreeFloat(null)).toBeNull()
  })

  it('keCsvHarianPapan: header + satu baris per emiten, koma-pisah', () => {
    const contoh: BarisHarianPapan[] = [{
      kode: 'BBCA', nama: 'Bank BCA', sektor: 'Keuangan', harga: 10000, tdm_persen: 1, volume: 100,
      rvol10: 1, nilai: 1000000, nbsf_000: 5, free_float: 50, ma20_arah: 'naik', close_gap: 0.5,
      chg_1d: 1, chg_wtd: 2, chg_b1: 3, posisi_ema5: 'atas', posisi_ma10: 'atas', posisi_ma20: 'atas',
      chg_2m: 1, chg_3m: 2, skor_d: 'Buy', skor_w: 'Buy', skor_m: 'Neutral', tidak_diperdagangkan: false, bar5: [], form_skor: 3,
    }]
    const csv = keCsvHarianPapan(contoh)
    const baris = csv.split('\n')
    expect(baris).toHaveLength(2)
    expect(baris[0]).toMatch(/^kode,nama,sektor/)
    expect(baris[1]).toMatch(/^BBCA,Bank BCA,Keuangan,10000/)
  })

  it('sektorUnikHarianPapan: unik + urut abjad id-ID', () => {
    const contoh = ['Energi', 'Keuangan', 'Energi', '-'].map((sektor) => ({ sektor }) as BarisHarianPapan)
    expect(sektorUnikHarianPapan(contoh)).toEqual(['-', 'Energi', 'Keuangan'])
  })
})

describe('skorPapan — mekanisme rumus (bukan reproduksi 45/83 benchmark, lihat catatan laporan)', () => {
  // 250 bar naik monoton murni: SELURUH MA di bawah harga (bias +1 semua) DAN
  // RSI/Stoch/CCI di ambang bullish (uptrend tanpa jeda mendorong ketiganya
  // ke ekstrem atas) DAN MACD > 0 (tren naik berkelanjutan) → skor MA=+1,
  // osilator=+1, skor akhir = 1.0 >= AMBANG_KUAT (0.5) → Strong Buy. Menguji
  // ARAH bukti (tren naik = skor positif) dan bahwa ambang ±0,5/±0,1 dari
  // spek benar-benar dipakai, bukan reproduksi benchmark 83-label (data
  // aslinya tak tersimpan di berkas mana pun yang bisa diuji ulang).
  it('tren naik monoton murni → Strong Buy (skor mendekati +1)', () => {
    const naik: BarisOhlc[] = Array.from({ length: 250 }, (_, i) => {
      const c = 100 + i * 2
      return [`d${i}`, c - 1, c + 1, c - 1, c, 1000] as BarisOhlc
    })
    const hasil = skorPapan(naik)
    expect(hasil).not.toBeNull()
    expect(hasil!.skor).toBeGreaterThanOrEqual(0.5)
    expect(hasil!.label).toBe('Strong Buy')
  })

  it('tren turun monoton murni → Strong Sell (skor mendekati −1)', () => {
    const turun: BarisOhlc[] = Array.from({ length: 250 }, (_, i) => {
      const c = 1000 - i * 2
      return [`d${i}`, c + 1, c + 1, c - 1, c, 1000] as BarisOhlc
    })
    const hasil = skorPapan(turun)
    expect(hasil).not.toBeNull()
    expect(hasil!.skor).toBeLessThanOrEqual(-0.5)
    expect(hasil!.label).toBe('Strong Sell')
  })

  it('kurang dari 30 bar → null (sama ambang skorTeknikal.ts)', () => {
    const pendek: BarisOhlc[] = Array.from({ length: 10 }, (_, i) => [`d${i}`, 100, 100, 100, 100, 1] as BarisOhlc)
    expect(skorPapan(pendek)).toBeNull()
  })
})

describe('keCsvHarianPapan — penanda taksiran', () => {
  it('mengganti nama kolom nbsf saat isinya taksiran', () => {
    const csv = keCsvHarianPapan([], true)
    expect(csv.split('\n')[0]).toContain('nbsf_000_taksiran')
    expect(csv.split('\n')[0]).not.toContain(',nbsf_000,')
  })
  it('memakai nama biasa saat angkanya dilaporkan bursa', () => {
    expect(keCsvHarianPapan([]).split('\n')[0]).toContain('nbsf_000')
  })
})
