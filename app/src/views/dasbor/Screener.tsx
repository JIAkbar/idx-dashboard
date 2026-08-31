import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { IkonMenu, IKON_CARI, IKON_PERINGATAN } from '../../components/dasbor/IkonMenu'
import { CatatanCakupan } from '../../components/dasbor/CatatanCakupan'
import { BedaSkor } from '../../components/dasbor/BedaSkor'
import { UjiAturan } from '../../components/dasbor/UjiAturan'
import { DropdownMulti, type OpsiMulti } from '../../components/dasbor/DropdownMulti'
import { Dropdown } from '../../components/dasbor/Dropdown'
import { PemilihRentang } from '../../components/dasbor/PemilihRentang'
import { LABEL_RENTANG } from '../../lib/dasbor/periode'
import { TINGKAT_LIKUIDITAS, kodePeringkatTeratas, ujiLikuiditas } from '../../lib/dasbor/likuiditas'
import { useUrut } from '../../lib/dasbor/useUrut'
import { useLayarSempit } from '../../lib/dasbor/useLayarSempit'
import { fp } from '../../lib/dasbor/format'
import { fRingkas } from '../../lib/dasbor/stockDetailFormat'
import { keFraksi } from '../../lib/fraksiHarga'
import { MOMENTUM_HARI } from '../../lib/dasbor/skorTeknikal'
import { LABEL_POLA_KLASIK } from '../../lib/dasbor/polaKlasik'
import {
  useScreener, usePolaScreener, saring, sektorUnik, kelasSss, kelasArah, kelasPosisi, kelasPolaArah,
  fDec, ringkasLembarBertanda, labelPolaSingkat, LABEL_SSS, keBarisPreset,
  type BarisScreener, type PolaAktifScreener,
} from '../../lib/dasbor/screener'
import { useKandidatDeepDive, petaKandidat, type KandidatEmiten } from '../../lib/dasbor/kandidatDeepDive'
import { useRingkasKartu } from '../../lib/dasbor/kartuRingkas'
import {
  PRESET, jalankanPreset, deltaAsingKsei, badgeKsei,
  type HasilKriteria, type HasilPreset, type Preset, type BarisPreset,
} from '../../lib/dasbor/presetScreener'
import { muatKepemilikan } from '../../lib/dasbor/brokerProfilKsei'
import {
  useJendelaRekomendasi, usePetaBarsPreset, hasilSahamPreset, type HasilSahamRekomendasi,
} from '../../lib/dasbor/rekomendasi'
import { agregatWinRate, rataPersen, type HasilMenang, type AgregatWinRate } from '../../lib/dasbor/winRate'
import './Screener.css'

/** Tiga preset Whale saja (adendum_preset_whale.md) — Scalping/Swing di luar
 *  cakupan Paket D, biar tak diam-diam ikut tampil sebelum datanya diperiksa. */
const PRESET_WHALE = PRESET.filter((p) => p.id.startsWith('whale-'))

/** Baris screener + pola aktif digabung dari `pola_screener.json` (berkas
 *  terpisah, lihat `screener.ts`) — `pola_arah` cuma untuk sort kolom Pola
 *  lewat mekanisme teks yang sudah ada (`bandingkanBaris`), `pola` untuk
 *  tampilan sel. `dd` = entri Kandidat Deep Dive (kandidat_deepdive.json,
 *  berkas terpisah lagi) kalau kodenya ada di daftar, `dd_skor` cuma untuk
 *  sort lewat mekanisme yang sama — null otomatis jatuh ke bawah di kedua
 *  arah (bandingkanBaris), jadi non-kandidat tak perlu penanganan khusus. */
type BarisGab = BarisScreener & {
  pola: PolaAktifScreener | null
  pola_arah: 'bullish' | 'bearish' | null
  dd: KandidatEmiten | null
  dd_skor: number | null
}

type UrutState = { kunci: keyof BarisGab; arah: 'naik' | 'turun'; klik: (k: keyof BarisGab) => void }

/** Judul kolom yang bisa diklik untuk mengurutkan — pola sama TopStocks.tsx/
 *  KartuAnalisa.tsx, disalin bukan diimpor karena `keyof`-nya beda tiap tabel. */
function thSort(s: UrutState, k: keyof BarisGab, label: string, kanan = false) {
  const aktif = s.kunci === k
  return (
    <th className={kanan ? 'r' : undefined}>
      <button type="button" className="th-sort" onClick={() => s.klik(k)}>
        {label}{aktif ? (s.arah === 'naik' ? ' ▲' : ' ▼') : ''}
      </button>
    </th>
  )
}

/** Teks berwarna, BUKAN lencana berlatar — 962 baris × label berlatar penuh
 *  terbaca seperti papan peringatan. `kuat` menebalkan Strong Buy/Strong Sell
 *  lewat elemen <b>, bukan warna kedua. */
function LabelBerwarna({ teks, warna, kuat }: { teks: string; warna: 'up' | 'dn' | ''; kuat: boolean }) {
  const cls = warna || undefined
  return kuat ? <b className={cls}>{teks}</b> : <span className={cls}>{teks}</span>
}

function Panah({ posisi, label }: { posisi: 'atas' | 'bawah' | null; label: string }) {
  if (posisi == null) return <span className="muted">—</span>
  return (
    <span className={kelasPosisi(posisi)} title={`${label}: ${posisi === 'atas' ? 'di atas' : 'di bawah'}`}>
      {posisi === 'atas' ? '▲' : '▼'}
    </span>
  )
}

/**
 * Screener (`/screener`, backlog B31) — satu baris per emiten (962), seluruh
 * ruas `data-idx/json/screener.json` sekaligus. Angkanya sudah dihitung di
 * sisi Python (`scripts/riset/screener.py` — TIDAK dihitung ulang di sini);
 * berkas ini cuma saring/urut/format, lewat `lib/dasbor/screener.ts` supaya
 * logikanya bisa diuji tanpa merender React.
 *
 * 962 baris × 21 kolom sekaligus terlalu berat untuk DOM — dibatasi 100 baris
 * (25 di layar sempit) sesudah urut/saring, dengan tombol "tampilkan lebih
 * banyak", pola sama `TabelScreenerKartu` di KartuAnalisa.tsx.
 */
export function Screener() {
  const data = useScreener()
  const polaData = usePolaScreener()
  const kandidatData = useKandidatDeepDive()
  const ringkasKartu = useRingkasKartu()
  const sempit = useLayarSempit()
  const [mode, setMode] = useState<'tabel' | 'whale' | 'riwayat'>('tabel')
  const [presetId, setPresetId] = useState(PRESET_WHALE[0].id)
  const [presetRiwayat, setPresetRiwayat] = useState(PRESET[0].id)
  const [jendelaRiwayat, setJendelaRiwayat] = useState<JendelaId>('b1')
  const [definisiRiwayat, setDefinisiRiwayat] = useState<DefinisiId>('tpSl')
  const [cari, setCari] = useState('')
  const [sssAktif, setSssAktif] = useState<string[]>([])
  const [sektorAktif, setSektorAktif] = useState<string[]>([])
  const [berpolaAktif, setBerpolaAktif] = useState(false)
  const [kandidatAktif, setKandidatAktif] = useState(false)
  const [tingkatLikuiditas, setTingkatLikuiditas] = useState('semua')
  const ukuranHalaman = sempit ? 25 : 100
  const [tampil, setTampil] = useState(ukuranHalaman)
  const [tampilWhale, setTampilWhale] = useState(ukuranHalaman)

  // Baris Preset Whale — jembatan dari kartu/ringkas.json (kaya ruas broker/
  // asing) lewat keBarisPreset(), TERPISAH dari `baris` tabel utama (screener.json,
  // ruas beda). Preset aktif jatuh ke preset whale pertama kalau id-nya
  // (mustahil) tak ditemukan, biar tak pernah render kosong tanpa sebab.
  const barisPreset = useMemo(() => (ringkasKartu?.emiten ?? []).map(keBarisPreset), [ringkasKartu])
  const presetAktif: Preset = PRESET_WHALE.find((p) => p.id === presetId) ?? PRESET_WHALE[0]
  const hasilPreset = useMemo(
    () => jalankanPreset(barisPreset, presetAktif, { minLolos: 1 }),
    [barisPreset, presetAktif],
  )

  // Gabung baris screener + pola aktif per kode — dua berkas terpisah
  // (`screener.json` dari Python, `pola_screener.json` dari mesin pola),
  // digabung di sini supaya `saring`/`useUrut` tak perlu tahu soal pola sama
  // sekali.
  const petaDd = useMemo(() => petaKandidat(kandidatData), [kandidatData])
  const baris = useMemo<BarisGab[]>(() => {
    const rows = data?.emiten ?? []
    return rows.map((b) => {
      const p = polaData?.d[b.kode] ?? null
      const dd = petaDd.get(b.kode) ?? null
      return { ...b, pola: p, pola_arah: p ? p[1] : null, dd, dd_skor: dd?.skor ?? null }
    })
  }, [data, polaData, petaDd])
  const daftarSektor = useMemo(() => sektorUnik(baris), [baris])

  // Jumlah emiten per chip, untuk `title` — menjawab "sektor ini isinya
  // berapa" tanpa harus mengekliknya. Dihitung dari SELURUH baris, bukan
  // hasil saringan: title yang ikut menyusut saat difilter cuma membingungkan.
  const jumlahSss = useMemo(() => {
    const m = new Map<string, number>()
    for (const b of baris) { if (b.sss_d) m.set(b.sss_d, (m.get(b.sss_d) ?? 0) + 1) }
    return m
  }, [baris])
  const jumlahSektor = useMemo(() => {
    const m = new Map<string, number>()
    for (const b of baris) m.set(b.sektor, (m.get(b.sektor) ?? 0) + 1)
    return m
  }, [baris])
  // Opsi DropdownMulti — dihitung dari SELURUH baris (jumlahSss/jumlahSektor
  // sudah begitu, lihat komentarnya di atas), bukan hasil saringan.
  const sssOpsi = useMemo<OpsiMulti[]>(
    () => LABEL_SSS.map((lbl) => ({ nilai: lbl, label: lbl, jumlah: jumlahSss.get(lbl) ?? 0 })),
    [jumlahSss],
  )
  const sektorOpsi = useMemo<OpsiMulti[]>(
    () => daftarSektor.map((sek) => ({
      nilai: sek,
      label: sek === '-' ? 'Tanpa sektor' : sek,
      jumlah: jumlahSektor.get(sek) ?? 0,
      keterangan: sek === '-'
        ? 'Tidak ditemukan di peta sektor resmi IDX-IC'
        : undefined,
    })),
    [daftarSektor, jumlahSektor],
  )
  // Set 150-teratas dihitung dari SELURUH baris (bukan hasil saringan lain)
  // — "semesta" meniru peringkat pasar IDX sendiri, bukan sub-populasi
  // pilihan pembaca. Cuma dihitung saat tingkat itu aktif.
  const teratasLikuiditas = useMemo(
    () => (tingkatLikuiditas === 'semesta' ? kodePeringkatTeratas(baris, (b) => b.likuiditas, 150, (b) => b.kode) : null),
    [baris, tingkatLikuiditas],
  )
  const hasilSaring = useMemo(() => saring(baris, sssAktif, sektorAktif, cari), [baris, sssAktif, sektorAktif, cari])
  const hasil = useMemo(() => hasilSaring
    .filter((b) => !berpolaAktif || b.pola_arah != null)
    .filter((b) => !kandidatAktif || b.dd != null)
    .filter((b) => ujiLikuiditas(b, tingkatLikuiditas, (x) => x.likuiditas, teratasLikuiditas, (x) => x.kode)),
  [hasilSaring, berpolaAktif, kandidatAktif, tingkatLikuiditas, teratasLikuiditas])
  const s = useUrut<BarisGab>(hasil, 'kode', 'naik')

  // Saringan/cari baru = mulai dari halaman pertama lagi, bukan menyambung
  // dari batas lama (bisa lebih besar dari hasil baru).
  useEffect(() => {
    setTampil(ukuranHalaman)
  }, [sssAktif, sektorAktif, cari, berpolaAktif, kandidatAktif, tingkatLikuiditas, ukuranHalaman])
  useEffect(() => {
    setTampilWhale(ukuranHalaman)
  }, [presetId, ukuranHalaman])

  // kode -> BarisPreset, untuk sel Harga + badge KSEI (arah harian dipakai
  // di sana = tanda asing_streak, bukan dihitung ulang) di tabel hasil preset.
  const petaBarisPreset = useMemo(() => new Map(barisPreset.map((b) => [b.kode, b])), [barisPreset])

  function toggleSss(label: string) {
    setSssAktif((a) => (a.includes(label) ? a.filter((x) => x !== label) : [...a, label]))
  }
  function toggleSektor(sek: string) {
    setSektorAktif((a) => (a.includes(sek) ? a.filter((x) => x !== sek) : [...a, sek]))
  }
  const adaSaringan = sssAktif.length > 0 || sektorAktif.length > 0 || berpolaAktif || kandidatAktif || tingkatLikuiditas !== 'semua' || cari.trim() !== ''

  if (!data) {
    return (
      <div className="lantai">
        <div className="vhead"><h1>Screener</h1></div>
        <div className="panel panel-b" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <p><IkonMenu d={IKON_PERINGATAN} size={28} /></p>
          <p className="lbl">Memuat data screener…</p>
        </div>
      </div>
    )
  }

  const tampilBaris = s.urut.slice(0, tampil)
  const sisa = s.urut.length - tampilBaris.length

  return (
    <div className="lantai">
      <div className="vhead">
        <h1>Screener</h1>
        <span className="sub">{data.n} emiten, satu baris per emiten — saring, urutkan, cari.</span>
        <CatatanCakupan inline />
        <BedaSkor halaman="screener" />
      </div>

      <div className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={mode === 'tabel'} className={'tab' + (mode === 'tabel' ? ' on' : '')} onClick={() => setMode('tabel')}>
          Tabel
        </button>
        <button type="button" role="tab" aria-selected={mode === 'whale'} className={'tab' + (mode === 'whale' ? ' on' : '')} onClick={() => setMode('whale')}>
          Preset Whale
        </button>
        <button type="button" role="tab" aria-selected={mode === 'riwayat'} className={'tab' + (mode === 'riwayat' ? ' on' : '')} onClick={() => setMode('riwayat')}>
          Riwayat & Win Rate
        </button>
      </div>

      {mode === 'tabel' && (<>
      <div className="panel">
        <div className="panel-b scr-alat">
          {/* Bilah saring dirombak KEDUA KALI 21 Agu 2026 — perombakan
              pertama (label kelompok + deret chip) hari yang sama sudah
              memecahkan "tak terbaca mana rating mana sektor", tapi Johan
              lihat hasilnya lalu minta lagi: "tombol-tombol ini perlu di
              rapikan mgkn bisa di buat dropdown ceklist atau ikut
              rekomendasimu" — 5 chip Rating + 12 chip Sektor (membungkus 2
              baris) makan 4 baris tinggi. Dropdown checklist merapikan itu
              jadi satu baris, tapi dropdown MENYEMBUNYIKAN apa yang aktif —
              makanya baris "chip aktif" di bawah bilah tetap ada, bukan
              dihapus: rapi tanpa kehilangan keterlihatan. Pola tetap chip
              tunggal (satu keadaan on/off, dropdown untuk itu berlebihan). */}
          {/* Bilah kendali berkelompok — sistem tata C+A (lantai.css). Cari ·
              Saring; hasil + reset saringan di grup-kanan. */}
          <div className="bilah-kendali scr-bilah">
            <div className="grup-k">
              <span className="grup-lbl">Cari</span>
              <span className="af-cari scr-cari">
                <IkonMenu d={IKON_CARI} size={13} />
                {/* Kotak CARI CAMPURAN (bukan picker emiten) — sengaja BUKAN StockAutocomplete: menyaring lebih dari satu ruas sekaligus. Jangan "diperbaiki" jadi picker; riwayat: sweep Papan Pekerjaan #355. */}
                <input
                  className="inp" type="search" placeholder="Cari emiten…" value={cari}
                  onChange={(e) => setCari(e.target.value)}
                />
              </span>
            </div>
            <span className="pemisah-v" aria-hidden="true" />
            <div className="grup-k">
              <span className="grup-lbl">Saring</span>
              <DropdownMulti label="Rating" ariaLabel="Saring rating" opsi={sssOpsi} nilai={sssAktif} onGanti={setSssAktif} />
              <DropdownMulti label="Sektor" ariaLabel="Saring sektor" opsi={sektorOpsi} nilai={sektorAktif} onGanti={setSektorAktif} />
              <Dropdown
                opsi={TINGKAT_LIKUIDITAS.map((t) => ({ nilai: t.id, label: t.label }))}
                nilai={tingkatLikuiditas}
                onGanti={setTingkatLikuiditas}
                ariaLabel="Likuiditas"
                placeholder="Semua likuiditas"
              />
              <button
                type="button"
                className={`chip-t${berpolaAktif ? ' on' : ''}`}
                title="Hanya emiten dengan pola chart klasik yang sedang menunggu target"
                onClick={() => setBerpolaAktif((v) => !v)}
              >
                Berpola aktif
              </button>
              <button
                type="button"
                className={`chip-t${kandidatAktif ? ' on' : ''}`}
                title="Emiten yang jejak penyerapannya terbaca dari harga & volume — layak diperiksa dengan Broker Summary, bukan sinyal beli"
                onClick={() => setKandidatAktif((v) => !v)}
              >
                Kandidat Deep Dive{kandidatData ? ` · ${kandidatData.n}` : ''}
              </button>
            </div>
            <span className="pemisah-v" aria-hidden="true" />
            <div className="grup-k grup-kanan">
              <span className="grup-lbl">Aksi</span>
              {adaSaringan && (
                <button
                  type="button" className="chip-t scr-reset"
                  onClick={() => { setSssAktif([]); setSektorAktif([]); setBerpolaAktif(false); setKandidatAktif(false); setTingkatLikuiditas('semua'); setCari('') }}
                >
                  ✕ Hapus semua saringan
                </button>
              )}
              <span className="muted scr-jumlah">{hasil.length} dari {baris.length} emiten lolos</span>
            </div>
          </div>
          {(sssAktif.length > 0 || sektorAktif.length > 0 || tingkatLikuiditas !== 'semua') && (
            <div className="scr-chips-aktif">
              {sssAktif.map((lbl) => (
                <button key={`s-${lbl}`} type="button" className="chip-t on" onClick={() => toggleSss(lbl)}>
                  Rating: {lbl} ✕
                </button>
              ))}
              {sektorAktif.map((sek) => (
                <button key={`k-${sek}`} type="button" className="chip-t on" onClick={() => toggleSektor(sek)}>
                  Sektor: {sek === '-' ? 'Tanpa sektor' : sek} ✕
                </button>
              ))}
              {tingkatLikuiditas !== 'semua' && (
                <button type="button" className="chip-t on" onClick={() => setTingkatLikuiditas('semua')}>
                  Likuiditas: {TINGKAT_LIKUIDITAS.find((t) => t.id === tingkatLikuiditas)?.label} ✕
                </button>
              )}
            </div>
          )}
        </div>

        <div className="board-tbl-wrap">
          <table className="tbl scr-tbl">
            <thead>
              <tr>
                {thSort(s, 'kode', 'Kode')}
                {thSort(s, 'nama', 'Nama')}
                {thSort(s, 'sektor', 'Sektor')}
                {thSort(s, 'harga', 'Harga', true)}
                {thSort(s, 'tdm_persen', `TDM% ${MOMENTUM_HARI}H`, true)}
                {thSort(s, 'volume', 'Volume', true)}
                {thSort(s, 'rvol10', 'RVol10', true)}
                {thSort(s, 'nilai', 'Nilai', true)}
                {thSort(s, 'likuiditas', 'Likuiditas', true)}
                {thSort(s, 'sss_d', 'SSS D')}
                {thSort(s, 'sss_w', 'SSS W')}
                {thSort(s, 'sss_m', 'SSS M')}
                {thSort(s, 'free_float', 'Free Float', true)}
                {thSort(s, 'ma20_arah', 'Arah MA20')}
                {thSort(s, 'close_gap', 'Close Gap', true)}
                {thSort(s, 'chg_1d', '%chg 1D', true)}
                {thSort(s, 'chg_wtd', '%chg WTD', true)}
                {thSort(s, 'chg_mtd', '%chg MTD', true)}
                {thSort(s, 'posisi_ema5', 'vs EMA5')}
                {thSort(s, 'posisi_ma10', 'vs MA10')}
                {thSort(s, 'posisi_ma20', 'vs MA20')}
                {thSort(s, 'net_asing_lembar', 'Net Asing', true)}
                {thSort(s, 'asing_streak', 'Streak Asing', true)}
                {thSort(s, 'pola_arah', 'Pola')}
                {thSort(s, 'dd_skor', 'Deep Dive')}
              </tr>
            </thead>
            <tbody>
              {tampilBaris.map((b) => <BarisScreenerTbl key={b.kode} b={b} tanggalData={data?.tanggal ?? null} />)}
            </tbody>
          </table>
        </div>

        {tampilBaris.length === 0 && (
          <p className="muted" style={{ padding: '10px 14px' }}>Tak ada emiten cocok dengan saringan/kata cari ini.</p>
        )}

        {sisa > 0 && (
          <div className="scr-lebih">
            <button type="button" className="btn-p" onClick={() => setTampil((t) => t + ukuranHalaman)}>
              Tampilkan {Math.min(sisa, ukuranHalaman)} lagi
            </button>
          </div>
        )}
      </div>

      <div className="asal">
        Data <b>{data.tanggal}</b> · <b>{data.n}</b> emiten · diperbarui {data.diperbarui}. <b>Net Asing</b> dalam{' '}
        <b>lembar</b>, bukan rupiah — IDX tidak melaporkan aliran asing dalam rupiah. <b>Streak Asing</b> = hari
        bursa beruntun net asing resmi searah (+ beruntun masuk, − beruntun keluar). <b>TDM%</b> adalah perubahan
        harga {MOMENTUM_HARI} hari bursa terakhir. Skor SSS D/W/M menyajikan keadaan, <b>bukan saran beli atau
        jual</b>. Kolom <b>Pola</b> adalah deskripsi bentuk chart, bukan sinyal beli — backtest sapuan penuh 915
        emiten menunjukkan sebagian besar pola klasik TIDAK mengungguli peluang dasar (rincian di halaman Grafik).
        {kandidatData && (
          <> Kandidat Deep Dive = jejak penyerapan dari harga & volume (bukan bukti arus broker, bukan
          rekomendasi) · data {kandidatData.tanggal} · {kandidatData.n} emiten dari ambang skor ≥{kandidatData.ambang.skor_min} &
          likuiditas ≥ Rp{fRingkas(kandidatData.ambang.likuiditas_min)}/hari.</>
        )}
      </div>
      </>)}

      {mode === 'whale' && (
        <PanelPresetWhale
          presetAktif={presetAktif}
          presetId={presetId}
          setPresetId={setPresetId}
          hasil={hasilPreset}
          petaBaris={petaBarisPreset}
          tampil={tampilWhale}
          ukuranHalaman={ukuranHalaman}
          setTampil={setTampilWhale}
          tanggal={ringkasKartu?.diperbarui ?? null}
        />
      )}

      {mode === 'riwayat' && (
        <PanelRiwayatWinRate
          presetId={presetRiwayat}
          setPresetId={setPresetRiwayat}
          jendela={jendelaRiwayat}
          setJendela={setJendelaRiwayat}
          definisi={definisiRiwayat}
          setDefinisi={setDefinisiRiwayat}
        />
      )}
      {/* Uji Aturan di BAWAH rekam jejak harian, bukan menggantikannya: yang di
          atas catatan yang ditulis sebelum harganya terjadi, yang di bawah
          rekonstruksi atas sampel jauh lebih besar. Urutan ini disengaja —
          bukti yang lebih kuat kelasnya diletakkan lebih dulu. */}
      {mode === 'riwayat' && <UjiAturan />}
    </div>
  )
}

/**
 * Preset Whale (Paket D) — jalankanPreset() atas `barisPreset` (jembatan dari
 * kartu/ringkas.json, lihat keBarisPreset di screener.ts), satu tabel per
 * preset aktif: satu kolom per kriteria (✓ lolos/✗ gagal/– tak-terukur, lihat
 * doc presetScreener.ts), plus badge Konfirmasi KSEI khusus Whale · Asing.
 * PENYARING, bukan peringkat kelayakan beli — kalimat itu wajib tercetak,
 * sama seperti kandidat Deep Dive & Jago Papan.
 */
function PanelPresetWhale({ presetAktif, presetId, setPresetId, hasil, petaBaris, tampil, ukuranHalaman, setTampil, tanggal }: {
  presetAktif: Preset
  presetId: string
  setPresetId: (id: string) => void
  hasil: HasilPreset[]
  petaBaris: Map<string, BarisPreset>
  tampil: number
  ukuranHalaman: number
  setTampil: (fn: (t: number) => number) => void
  tanggal: string | null
}) {
  const tampilBaris = hasil.slice(0, tampil)
  const sisa = hasil.length - tampilBaris.length
  return (
    <div className="panel">
      <div className="panel-b scr-alat">
        {/* Bilah kendali berkelompok — sistem tata C+A (lantai.css). Preset;
            jumlah hasil di grup-kanan. Teks keterangan tetap di luar bilah,
            bukan kendali. */}
        <div className="bilah-kendali">
          <div className="grup-k">
            <span className="grup-lbl">Preset</span>
            <div className="tabs" role="tablist">
              {PRESET_WHALE.map((p) => (
                <button
                  key={p.id} type="button" role="tab" aria-selected={presetId === p.id}
                  className={'tab' + (presetId === p.id ? ' on' : '')}
                  onClick={() => setPresetId(p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <span className="pemisah-v" aria-hidden="true" />
          <div className="grup-k grup-kanan">
            <span className="grup-lbl">Hasil</span>
            <span className="muted scr-jumlah">{hasil.length} emiten dengan ≥1 kriteria terpenuhi{tanggal ? ` · data ${tanggal}` : ''}</span>
          </div>
        </div>
        <p className="muted" style={{ margin: '8px 0 0' }}>{presetAktif.ringkas}</p>
        {/* Satu kata dua sistem (temuan pengawas 27 Agu): "Whale" preset ini
            = ukuran transaksi; kategori perilaku broker di Broker Summary
            ("Porsi x Arah") dasarnya berbeda. Sebut sekali di panel. */}
        <p className="muted" style={{ margin: '4px 0 0', fontSize: 12 }}>
          Kata "Whale" di sini menunjuk ukuran transaksi (tiket besar / porsi asing) - bukan kategori
          perilaku broker "Porsi x Arah" di Broker Summary; dua saringan dengan dasar berbeda.
        </p>
      </div>

      <div className="board-tbl-wrap">
        <table className="tbl scr-tbl">
          <thead>
            <tr>
              <th>Kode</th>
              <th className="r">Harga</th>
              <th className="r">Skor</th>
              {presetAktif.kriteria.map((kr) => (
                <th key={kr.id} title={kr.label}>{labelKriteriaSingkat(kr.id)}</th>
              ))}
              {presetAktif.id === 'whale-asing' && <th title="Δ kepemilikan asing bulanan (KSEI) vs net asing harian">KSEI</th>}
            </tr>
          </thead>
          <tbody>
            {tampilBaris.map((h) => {
              const harga = petaBaris.get(h.kode)?.harga ?? null
              return (
                <tr key={h.kode}>
                  <td><Link to={`/grafik?kode=${h.kode}`} className="tick">{h.kode}</Link></td>
                  <td className="r num">{harga == null ? '—' : keFraksi(harga, 'dekat').toLocaleString('id-ID')}</td>
                  <td className="r num" title={`${h.lolos} dari ${h.terukur} kriteria terukur lolos${h.takTerukur ? ` (${h.takTerukur} kriteria lain belum ada datanya)` : ''}`}>
                    {h.lolos}/{h.terukur}
                  </td>
                  {h.rinci.map((r) => {
                    const top3 = r.id === 'terkonsentrasi' ? petaBaris.get(h.kode)?.top3_pct : null
                    return (
                      <td key={r.id}>
                        <GlyphKriteria h={r.hasil} />
                        {top3 != null && <span className="muted" style={{ marginLeft: 4, fontSize: 11 }}>{Math.round(top3)}%</span>}
                      </td>
                    )
                  })}
                  {presetAktif.id === 'whale-asing' && (
                    <td><SelBadgeKsei kode={h.kode} asingStreak={petaBaris.get(h.kode)?.asing_streak ?? null} /></td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {tampilBaris.length === 0 && (
        <p className="muted" style={{ padding: '10px 14px' }}>
          Tak ada emiten dengan kriteria yang terukur untuk preset ini hari ini — sebagian ruas preset Whale
          (arus broker per-emiten) baru terisi dari setoran Broker Summary kontributor, cakupannya belum penuh.
        </p>
      )}

      {sisa > 0 && (
        <div className="scr-lebih">
          <button type="button" className="btn-p" onClick={() => setTampil((t) => t + ukuranHalaman)}>
            Tampilkan {Math.min(sisa, ukuranHalaman)} lagi
          </button>
        </div>
      )}

      <div className="asal">
        Preset Whale adalah <b>penyaring</b>, bukan peringkat kelayakan beli — uji luar sampel dua Deep Dive
        terbukti (BUMI, DSSA) menaruh keduanya di paruh bawah daftar hari itu. Ambang v1, belum diuji luar sampel
        sendiri. Kriteria bertanda "–" berarti datanya belum tersedia untuk emiten itu — <b>bukan</b> gagal.
        Angka % di sebelah kriteria "Terkonsentrasi" itu konsentrasi top-3 broker dari sumbernya — basis
        pembilang/penyebutnya milik sumber, bukan persen 0-100 murni, jadi kadang bisa lewat 100%.
        {presetAktif.id === 'whale-asing' && (
          <> Kolom <b>KSEI</b> membandingkan DUA SUMBER berbeda frekuensi: net asing <b>harian</b> (transaksi
          bursa resmi, tiap hari bursa) vs Δ kepemilikan asing <b>bulanan</b> (KSEI, akhir bulan) — ✓ searah,
          ⚠ berlawanan, ≈ Δ bulanan nyaris nol (kurang dari 0,05 poin persen), — belum bisa disimpulkan.</>
        )}
      </div>
    </div>
  )
}

// ── Tab "Riwayat & Win Rate" (Tugas C, spek_preset_winrate_rekap.md) ───────

type JendelaId = 'w1' | 'b1' | 'b3'
/** w1/b1/b3 dipilih APA ADANYA dari `rentangPreset`/`PemilihRentang` (7/30/91
 *  hari) — bukan kosakata baru, cuma dibaca sebagai "berapa hari TERAKHIR
 *  dari daftar tanggal rekomendasi" (bukan snap kalender ke tanggal bursa,
 *  beda pemakaian dari `rentangPreset`, jadi dipetakan manual di sini). */
const JENDELA_OPSI: { id: JendelaId; label: string }[] = (['w1', 'b1', 'b3'] as const)
  .map((id) => ({ id, label: LABEL_RENTANG[id] }))
const JENDELA_HARI: Record<JendelaId, number> = { w1: 7, b1: 30, b3: 90 }

type DefinisiId = 'openHigh' | 'closeClose' | 'tpSl'
const DEFINISI_OPSI: { id: DefinisiId; label: string; kalimat: string }[] = [
  {
    id: 'openHigh', label: 'Open-Tinggi H+1',
    kalimat: 'Longgar, persis definisi ringkas SPLE: menang kalau harga TERTINGGI keesokan hari bursa lebih tinggi dari harga PEMBUKAANNYA sendiri hari itu — tak peduli entry beneran kena atau tidak.',
  },
  {
    id: 'closeClose', label: 'Tutup-ke-Tutup H+1',
    kalimat: 'Ketat: menang kalau harga PENUTUPAN keesokan hari bursa lebih tinggi dari penutupan hari rekomendasi. Rata-rata % perubahan dihitung dari definisi ini.',
  },
  {
    id: 'tpSl', label: 'TP/SL H+5',
    kalimat: 'Realistis — pakai target & batas rugi preset sendiri: dalam 5 hari bursa berikutnya, target (TP1) harus tersentuh SEBELUM batas rugi (SL). Kalau KEDUANYA tersentuh di hari yang sama, hasilnya "tak tentu" — data harian tak bisa membuktikan mana yang lebih dulu, jadi TIDAK diklaim menang.',
  },
]

function ambilHasil(b: HasilSahamRekomendasi, definisi: DefinisiId): HasilMenang {
  return definisi === 'openHigh' ? b.openHigh : definisi === 'closeClose' ? b.closeClose : b.tpSl
}

/** Baris hasil dua Rp+preset digabung { HariRekomendasi × HasilSahamRekomendasi[] }. */
interface BarisHari { tanggal: string; backtest: boolean; baris: HasilSahamRekomendasi[] }

function PanelRiwayatWinRate({ presetId, setPresetId, jendela, setJendela, definisi, setDefinisi }: {
  presetId: string
  setPresetId: (id: string) => void
  jendela: JendelaId
  setJendela: (j: JendelaId) => void
  definisi: DefinisiId
  setDefinisi: (d: DefinisiId) => void
}) {
  const presetAktif = PRESET.find((p) => p.id === presetId) ?? PRESET[0]
  const hariDimuat = useJendelaRekomendasi(JENDELA_HARI[jendela])
  const hari = hariDimuat ?? []
  const petaBars = usePetaBarsPreset(hari, presetId)
  const perHari = useMemo<BarisHari[]>(
    () => hari
      .map((h) => ({ tanggal: h.tanggal, backtest: h.backtest, baris: hasilSahamPreset(h, presetId, petaBars) }))
      .sort((a, b) => b.tanggal.localeCompare(a.tanggal)),
    [hari, presetId, petaBars],
  )
  const live = perHari.filter((h) => !h.backtest)
  const backtest = perHari.filter((h) => h.backtest)
  const barisLive = live.flatMap((h) => h.baris)

  if (hariDimuat === null) {
    return (
      <div className="panel">
        <div className="panel-b" style={{ textAlign: 'center', padding: '30px 20px' }}>
          <p className="lbl">Memuat jejak rekomendasi…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="panel">
      <div className="panel-b scr-alat">
        <div className="bilah-kendali">
          <div className="grup-k">
            <span className="grup-lbl">Preset</span>
            <div className="tabs" role="tablist">
              {PRESET.map((p) => (
                <button
                  key={p.id} type="button" role="tab" aria-selected={presetId === p.id}
                  className={'tab' + (presetId === p.id ? ' on' : '')}
                  onClick={() => setPresetId(p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <span className="pemisah-v" aria-hidden="true" />
          <div className="grup-k">
            <span className="grup-lbl">Jendela</span>
            <PemilihRentang opsi={JENDELA_OPSI} nilai={jendela} onGanti={setJendela} ariaLabel="Jendela hari rekomendasi" />
          </div>
          <span className="pemisah-v" aria-hidden="true" />
          <div className="grup-k grup-kanan">
            <span className="grup-lbl">Hasil</span>
            <span className="muted scr-jumlah">
              {live.length} tanggal rekomendasi{backtest.length ? ` + ${backtest.length} backtest` : ''}
            </span>
          </div>
        </div>
        <p className="muted" style={{ margin: '8px 0 0' }}>{presetAktif.ringkas}</p>
      </div>

      {live.length === 0 && backtest.length === 0 && (
        <p className="muted" style={{ padding: '10px 14px' }}>
          Belum ada jejak rekomendasi tersimpan untuk preset ini di jendela waktu ini — jejak ditulis sekali
          tiap sore lewat generator rekap; baru mulai terkumpul sejak fitur ini aktif.
        </p>
      )}

      {(live.length > 0 || backtest.length > 0) && (<>
        {/* Definisi menang — tercetak di layar, bukan cuma title (spek §Tugas C.3). */}
        <div className="panel-b" style={{ paddingTop: 0 }}>
          <table className="tbl scr-tbl">
            <thead>
              <tr>
                <th>Definisi menang</th>
                <th className="r">Menang</th>
                <th className="r">Kalah</th>
                <th className="r">Tak tentu</th>
                <th className="r">Tak terukur</th>
                <th className="r">Win rate</th>
              </tr>
            </thead>
            <tbody>
              {DEFINISI_OPSI.map((d) => {
                const ag = agregatWinRate(barisLive.map((b) => ambilHasil(b, d.id)))
                return (
                  <tr key={d.id}>
                    <td>
                      <button
                        type="button" className={`chip-t${definisi === d.id ? ' on' : ''}`}
                        style={{ marginRight: 8 }} onClick={() => setDefinisi(d.id)}
                      >
                        {d.label}
                      </button>
                    </td>
                    <RingkasAngka ag={ag} />
                  </tr>
                )
              })}
            </tbody>
          </table>
          <ul className="muted" style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 12, lineHeight: 1.6 }}>
            {DEFINISI_OPSI.map((d) => <li key={d.id}><b>{d.label}</b> — {d.kalimat}</li>)}
          </ul>
          {(() => {
            const rata = rataPersen(barisLive.map((b) => b.closeClosePersen))
            return rata != null && (
              <p className="muted" style={{ margin: '6px 0 0', fontSize: 12 }}>
                Rata-rata perubahan Tutup-ke-Tutup H+1 (yang terukur): <b className={rata >= 0 ? 'up' : 'dn'}>{rata >= 0 ? '+' : ''}{rata.toFixed(2)}%</b>
              </p>
            )
          })()}
        </div>

        {/* Tabel per tanggal — definisi aktif saja (dipilih dari tabel di atas). */}
        <div className="board-tbl-wrap">
          <table className="tbl scr-tbl">
            <thead>
              <tr>
                <th>Tanggal</th>
                <th className="r">Saham</th>
                <th className="r">Menang</th>
                <th className="r">Kalah</th>
                <th className="r">Tak tentu</th>
                <th className="r">Tak terukur</th>
                <th className="r">Win rate</th>
              </tr>
            </thead>
            <tbody>
              {live.map((h) => {
                const ag = agregatWinRate(h.baris.map((b) => ambilHasil(b, definisi)))
                return (
                  <tr key={h.tanggal}>
                    <td>{h.tanggal}</td>
                    <td className="r num">{h.baris.length}</td>
                    <RingkasAngka ag={ag} />
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {live.length === 0 && (
          <p className="muted" style={{ padding: '10px 14px' }}>Belum ada rekomendasi LIVE (non-backtest) di jendela ini.</p>
        )}

        {/* Menang/Kalah — sama besar, dua tabel identik berdampingan (spek §Tugas C.2). */}
        <div className="panel-b" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
          <DaftarSaham judul="Menang" baris={barisLive.filter((b) => ambilHasil(b, definisi) === 'menang')} definisi={definisi} />
          <DaftarSaham judul="Kalah" baris={barisLive.filter((b) => ambilHasil(b, definisi) === 'kalah')} definisi={definisi} />
        </div>

        {/* Backtest — dipisah visual + peringatan survivorship (spek §Tugas C.3). */}
        {backtest.length > 0 && (
          <div className="panel-b" style={{ borderTop: '2px dashed var(--line)', marginTop: 8, paddingTop: 12 }}>
            <p className="muted" style={{ fontSize: 12, margin: '0 0 8px' }}>
              <b>Backtest ({backtest.length} tanggal)</b> — dihitung mundur dari riwayat, TERPISAH dari
              rekomendasi live di atas. Bisa bias survivorship: daftar emiten yang dipakai adalah daftar HARI
              INI, bukan daftar yang benar-benar tersedia pada tanggal itu (emiten yang sudah delisting/
              disuspensi sejak itu tak ikut terhitung) — jangan baca angkanya sebagai jaminan hasil di masa lalu.
            </p>
            <table className="tbl scr-tbl">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th className="r">Saham</th>
                  <th className="r">Menang</th>
                  <th className="r">Kalah</th>
                  <th className="r">Tak tentu</th>
                  <th className="r">Tak terukur</th>
                  <th className="r">Win rate</th>
                </tr>
              </thead>
              <tbody>
                {backtest.map((h) => {
                  const ag = agregatWinRate(h.baris.map((b) => ambilHasil(b, definisi)))
                  return (
                    <tr key={h.tanggal}>
                      <td>{h.tanggal}</td>
                      <td className="r num">{h.baris.length}</td>
                      <RingkasAngka ag={ag} />
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </>)}

      <div className="asal">
        Sumber: jejak rekomendasi ditulis sekali tiap sore dari skor preset hari itu (harga penutupan, target,
        batas rugi) — berkas yang sudah ditulis TIDAK diedit lagi, supaya rapor menang/kalahnya jujur terhadap
        apa yang sungguh direkomendasikan saat itu. Preset adalah <b>penyaring</b>, bukan peringkat kelayakan
        beli. Win rate dihitung hanya dari hasil yang <b>terukur</b> (menang+kalah) — "tak tentu"/"tak terukur"
        dikeluarkan dari pembagi, bukan dihitung sebagai kalah. Tab ini alat bantu edukasi, bukan rekomendasi
        investasi.
      </div>
    </div>
  )
}

/** Sel Menang/Kalah/TakTentu/TakTerukur/WinRate — dipakai tabel ringkasan
 *  definisi & tabel per-tanggal, biar warnanya konsisten (up/dn/muted). */
function RingkasAngka({ ag }: { ag: AgregatWinRate }) {
  return (
    <>
      <td className="r num up">{ag.menang}</td>
      <td className="r num dn">{ag.kalah}</td>
      <td className="r num muted">{ag.takTentu}</td>
      <td className="r num muted">{ag.takTerukur}</td>
      <td className="r num">
        {ag.winRatePct == null ? <span className="muted">—</span> : `${ag.winRatePct.toFixed(1)}%`}
      </td>
    </>
  )
}

/** Satu daftar (Menang ATAU Kalah) — SAMA bentuk tabel untuk keduanya supaya
 *  "kalah" tak pernah terlihat lebih kecil/dikubur (spek §Tugas C.3). */
function DaftarSaham({ judul, baris, definisi }: { judul: string; baris: HasilSahamRekomendasi[]; definisi: DefinisiId }) {
  return (
    <div>
      <p className="muted" style={{ margin: '0 0 4px', fontWeight: 600 }}>{judul} ({baris.length})</p>
      <div className="board-tbl-wrap">
        <table className="tbl scr-tbl">
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Kode</th>
              <th className="r">Skor</th>
              {definisi === 'closeClose' && <th className="r">%</th>}
              {definisi === 'tpSl' && <th className="r">TP1</th>}
              {definisi === 'tpSl' && <th className="r">SL</th>}
            </tr>
          </thead>
          <tbody>
            {baris.length === 0 && (
              <tr><td colSpan={5} className="muted" style={{ padding: '8px 10px' }}>Tak ada baris.</td></tr>
            )}
            {baris.map((b) => (
              <tr key={`${b.tanggal}-${b.kode}`}>
                <td>{b.tanggal}</td>
                <td><Link to={`/grafik?kode=${b.kode}`} className="tick">{b.kode}</Link></td>
                <td className="r num">{b.skor == null ? '—' : b.skor.toFixed(2)}</td>
                {definisi === 'closeClose' && (
                  <td className={`r num ${b.closeClosePersen == null ? '' : b.closeClosePersen >= 0 ? 'up' : 'dn'}`}>
                    {b.closeClosePersen == null ? '—' : `${b.closeClosePersen >= 0 ? '+' : ''}${b.closeClosePersen.toFixed(2)}%`}
                  </td>
                )}
                {definisi === 'tpSl' && <td className="r num">{b.tp1 == null ? '—' : b.tp1.toLocaleString('id-ID')}</td>}
                {definisi === 'tpSl' && <td className="r num">{b.sl == null ? '—' : b.sl.toLocaleString('id-ID')}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** Header kolom kriteria — kebab-case id jadi "Kata kata", judul penuh
 *  (kalimat kriteria) tetap di `title` supaya potongannya tak buang arti. */
function labelKriteriaSingkat(id: string): string {
  const kata = id.replace(/-/g, ' ')
  return kata.charAt(0).toUpperCase() + kata.slice(1)
}

/** ✓/✗/– untuk satu kriteria preset — warna sama konvensi tabel (up/dn),
 *  "tak-terukur" TIDAK sama dengan "gagal" (lihat presetScreener.ts). */
function GlyphKriteria({ h }: { h: HasilKriteria }) {
  if (h === 'lolos') return <span className="up">✓</span>
  if (h === 'gagal') return <span className="dn">✗</span>
  return <span className="muted" title="Datanya belum tersedia untuk emiten ini">–</span>
}

/** Badge Konfirmasi KSEI (whale-asing) — fetch lazy per baris tampil lewat
 *  cache `muatKepemilikan` (brokerProfilKsei.ts, sudah dipakai StockDetail),
 *  bukan dibundel ke screener.json (962 berkas kepemilikan terlalu berat
 *  dimuat semua sementara hasil preset biasanya cuma puluhan baris). */
function SelBadgeKsei({ kode, asingStreak }: { kode: string; asingStreak: number | null }) {
  const [delta, setDelta] = useState<number | null | undefined>(undefined)
  useEffect(() => {
    let batal = false
    setDelta(undefined)
    void muatKepemilikan(kode).then((d) => {
      if (!batal) setDelta(d ? deltaAsingKsei(d.kolom, d.bulan) : null)
    })
    return () => { batal = true }
  }, [kode])
  if (delta === undefined) return <span className="muted">…</span>
  const arah: 1 | -1 | 0 | null = !asingStreak ? null : asingStreak > 0 ? 1 : -1
  const b = badgeKsei(delta, arah)
  if (b === null) {
    return <span className="muted" title="Δ kepemilikan asing bulanan atau arah net asing harian belum terukur">—</span>
  }
  const arahTeks = arah === 1 ? 'masuk' : arah === -1 ? 'keluar' : 'belum terukur'
  const deltaTeks = delta == null ? '—' : `${delta > 0 ? '+' : ''}${delta.toLocaleString('id-ID', { maximumFractionDigits: 2 })}pp`
  return (
    <span
      className={b === '✓' ? 'up' : b === '⚠' ? 'dn' : 'muted'}
      title={`Net asing harian (transaksi bursa resmi, tiap hari bursa): ${arahTeks}. Δ kepemilikan asing bulanan (KSEI, akhir bulan): ${deltaTeks}.`}
    >
      {b}
    </span>
  )
}

/** Sel kolom Pola — label singkat + panah arah, atau "—" tanpa pola aktif.
 *  `title` bawa keterangan penuh (label lengkap, arah, tanggal sinyal,
 *  target) supaya potongan label singkat tak membuang informasi. */
function SelPola({ p, tanggalData }: { p: PolaAktifScreener | null; tanggalData: string | null }) {
  if (!p) return <span className="muted">—</span>
  const [nama, arah, tanggal, target] = p
  // Usia sinyal IKUT TAMPAK begitu melewati ±sebulan bursa — audit 21 Agu
  // (#5): tanpa ini pola dua bulan lalu dan pola kemarin terlihat persis
  // sama, dan tanggal yang cuma hidup di tooltip tak menolong pembaca cepat.
  const usiaHari = tanggalData
    ? Math.round((Date.parse(tanggalData) - Date.parse(tanggal)) / 86_400_000)
    : null
  return (
    <span
      className={kelasPolaArah(arah)}
      title={`${LABEL_POLA_KLASIK[nama]} (${arah}) — sinyal ${tanggal}, target ${target.toLocaleString('id-ID')}`}
    >
      {labelPolaSingkat(nama)} {arah === 'bullish' ? '▲' : '▼'}
      {usiaHari !== null && usiaHari > 30 && <span className="muted"> ±{Math.round(usiaHari / 7)}mgg</span>}
    </span>
  )
}

/** Lencana kolom Deep Dive — `title` memuat seluruh sinyal (satu per baris)
 *  + tanggal data, supaya kolomnya tetap satu sel kecil tapi buktinya tak
 *  hilang. Non-kandidat: "—" (dd null, dd_skor null ikut naruh baris ini di
 *  bawah saat kolom diurut — lihat bandingkanBaris). */
function SelDeepDive({ dd }: { dd: KandidatEmiten | null }) {
  if (!dd) return <span className="muted">—</span>
  const title = `${dd.sinyal.map((s) => `${s.nama} — ${s.bukti}`).join('\n')}\n(data ${dd.tanggal})`
  return <span className="chip-t on" title={title}>DD · {dd.skor}</span>
}

/** Satu baris tabel — dipisah dari `Screener()` supaya badan fungsi utama
 *  tetap terbaca; tak ada state sendiri di sini (beda dari BarisWatchlist). */
function BarisScreenerTbl({ b, tanggalData }: { b: BarisGab; tanggalData: string | null }) {
  const sss = (v: BarisScreener['sss_d']) => (v == null
    ? <span className="muted">—</span>
    : <LabelBerwarna teks={v} {...kelasSss(v)} />)

  return (
    <tr>
      <td><Link to={`/grafik?kode=${b.kode}`} className="tick">{b.kode}</Link></td>
      <td className="scr-nama" title={b.nama}>{b.nama}</td>
      <td>{b.sektor}</td>
      <td className="r num">
        {b.harga == null ? '—' : keFraksi(b.harga, 'dekat').toLocaleString('id-ID')}
      </td>
      <td className={`r num ${b.tdm_persen == null ? '' : b.tdm_persen >= 0 ? 'up' : 'dn'}`}>
        {b.tdm_persen == null ? '—' : fp(b.tdm_persen)}
      </td>
      <td className="r num" title={b.volume == null ? undefined : `${b.volume.toLocaleString('id-ID')} lembar`}>
        {b.volume == null ? '—' : fRingkas(b.volume)}
      </td>
      <td className="r num">{b.rvol10 == null ? '—' : `${fDec(b.rvol10)}×`}</td>
      <td className="r num" title={`Nilai transaksi hari terakhir${b.nilai == null ? '' : `: Rp${b.nilai.toLocaleString('id-ID')}`}`}>
        {b.nilai == null ? '—' : `Rp${fRingkas(b.nilai)}`}
      </td>
      <td className="r num" title={`Median nilai transaksi 20 hari bursa${b.likuiditas == null ? '' : `: Rp${b.likuiditas.toLocaleString('id-ID')}`}`}>
        {b.likuiditas == null ? '—' : `Rp${fRingkas(b.likuiditas)}`}
      </td>
      <td>{sss(b.sss_d)}</td>
      <td>{sss(b.sss_w)}</td>
      <td>{sss(b.sss_m)}</td>
      <td className="r num">{b.free_float == null ? '—' : `${fDec(b.free_float)}%`}</td>
      <td className={kelasArah(b.ma20_arah)}>
        {b.ma20_arah == null ? <span className="muted">—</span> : b.ma20_arah}
      </td>
      {/* Close Gap = PERSEN, dan bertanda — audit 21 Agu (#3): dirender
          angka polos ia satu-satunya kolom persen yang tak bisa dibaca
          arah maupun satuannya sekilas. Format sama dengan %chg di kanan. */}
      <td className={`r num ${b.close_gap == null ? '' : b.close_gap > 0 ? 'up' : b.close_gap < 0 ? 'dn' : ''}`}>
        {b.close_gap == null ? '—' : fp(b.close_gap)}
      </td>
      <td className={`r num ${b.chg_1d == null ? '' : b.chg_1d >= 0 ? 'up' : 'dn'}`}>
        {b.chg_1d == null ? '—' : fp(b.chg_1d)}
      </td>
      <td className={`r num ${b.chg_wtd == null ? '' : b.chg_wtd >= 0 ? 'up' : 'dn'}`}>
        {b.chg_wtd == null ? '—' : fp(b.chg_wtd)}
      </td>
      <td className={`r num ${b.chg_mtd == null ? '' : b.chg_mtd >= 0 ? 'up' : 'dn'}`}>
        {b.chg_mtd == null ? '—' : fp(b.chg_mtd)}
      </td>
      <td className="r"><Panah posisi={b.posisi_ema5} label="vs EMA5" /></td>
      <td className="r"><Panah posisi={b.posisi_ma10} label="vs MA10" /></td>
      <td className="r"><Panah posisi={b.posisi_ma20} label="vs MA20" /></td>
      <td
        className={`r num ${b.net_asing_lembar == null ? '' : b.net_asing_lembar >= 0 ? 'up' : 'dn'}`}
        title={b.net_asing_lembar == null ? undefined : `${b.net_asing_lembar.toLocaleString('id-ID')} lembar`}
      >
        {ringkasLembarBertanda(b.net_asing_lembar)}
      </td>
      <td className={`r num ${!b.asing_streak ? '' : b.asing_streak > 0 ? 'up' : 'dn'}`}>
        {b.asing_streak == null ? '—' : b.asing_streak}
      </td>
      <td><SelPola p={b.pola} tanggalData={tanggalData} /></td>
      <td><SelDeepDive dd={b.dd} /></td>
    </tr>
  )
}
