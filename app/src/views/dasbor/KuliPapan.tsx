import { useEffect, useMemo, useState } from 'react'
import { hitungTarget, hitungPbv, avgBeli } from '../../lib/dasbor/kuliPapan'
import {
  muatAntrean, muatBrokerTerakhir, muatFundamental, rataPb,
  type Antrean, type BrokerHari, type Fundamental,
} from '../../lib/dasbor/kuliPapanData'
import { fraksi } from '../../lib/fraksiHarga'
import { StockAutocomplete } from '../../components/dasbor/StockAutocomplete'
import { useStockIndex } from '../../lib/dasbor/stockDetailData'

type Tab = 'target' | 'pbv'

const RIWAYAT_MAKS = 20

interface BarisRiwayat { teks: string; waktu: string }

function bacaRiwayat(kunci: string): BarisRiwayat[] {
  try {
    return JSON.parse(localStorage.getItem(kunci) || '[]') as BarisRiwayat[]
  } catch {
    return []
  }
}

function simpanRiwayat(kunci: string, teks: string): BarisRiwayat[] {
  const baris = [{ teks, waktu: new Date().toLocaleString('id-ID') }, ...bacaRiwayat(kunci)]
    .slice(0, RIWAYAT_MAKS)
  try { localStorage.setItem(kunci, JSON.stringify(baris)) } catch { /* kuota penuh: riwayat boleh hilang */ }
  return baris
}

const rp = (n: number, d = 0) =>
  'Rp ' + n.toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d })
const num = (n: number, d = 0) =>
  n.toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d })

function Sumber({ children }: { children: React.ReactNode }) {
  return <p className="kp-sumber"><b>Sumber:</b> {children}</p>
}

function Riwayat({ baris }: { baris: BarisRiwayat[] }) {
  if (!baris.length) return <div className="kp-kosong">Belum ada perhitungan tersimpan.</div>
  return (
    <div className="kp-hist">
      {baris.map((b, i) => (
        <div key={i}><span>{b.teks}</span><span className="kp-waktu">{b.waktu}</span></div>
      ))}
    </div>
  )
}

export function KuliPapan() {
  const [tab, setTab] = useState<Tab>('target')
  const [kode, setKode] = useState('BBCA')
  const [ketik, setKetik] = useState('BBCA')
  // Daftar emiten yang sama dipakai Stock Detail — kotak teks polos tanpa
  // saran memaksa pengguna hafal kodenya, dan itu bukan alat bantu.
  const { index: indeks } = useStockIndex()

  const [antrean, setAntrean] = useState<{ tanggal: string; a: Antrean } | null>(null)
  const [brokerHari, setBrokerHari] = useState<BrokerHari | null>(null)
  const [fund, setFund] = useState<Fundamental | null>(null)
  const [muat, setMuat] = useState(true)

  useEffect(() => {
    let batal = false
    setMuat(true)
    Promise.all([muatAntrean(kode), muatBrokerTerakhir(kode), muatFundamental(kode)])
      .then(([a, b, f]) => {
        if (batal) return
        setAntrean(a); setBrokerHari(b); setFund(f); setMuat(false)
      })
    return () => { batal = true }
  }, [kode])

  // ── Target Realistis ────────────────────────────────────────────────────
  const [brokerPilih, setBrokerPilih] = useState('')
  const [buyAvg, setBuyAvg] = useState(0)
  const [buyLot, setBuyLot] = useState(0)
  const [bid, setBid] = useState(0)
  const [offer, setOffer] = useState(0)
  const [totalBid, setTotalBid] = useState(0)
  const [totalOffer, setTotalOffer] = useState(0)
  const [tick, setTick] = useState(1)
  const [baselinePersen, setBaselinePersen] = useState(5)
  const [agresif, setAgresif] = useState(false)
  const [barisManual, setBarisManual] = useState(70)
  const [histTarget, setHistTarget] = useState<BarisRiwayat[]>(() => bacaRiwayat('kuli_target'))

  // Diurut NET (beli lot - jual lot), bukan lot beli kotor.
  //
  // Bedanya bukan kosmetik: pada BUMI 21 Agu 2026 broker dengan lot BELI
  // terbesar adalah XL (7.065.990 lot) — tapi XL juga menjual 7.933.220 lot,
  // jadi netnya MINUS 867.230. Ia penjual bersih, bukan bandar yang
  // mengakumulasi. Mengurutkan secara kotor menyodorkan penjual terbesar
  // sebagai pilihan bawaan, lalu menghitung target BELI dari situ.
  // Yang benar TP: net +1.380.272 lot pada avg 200.
  const daftarBroker = useMemo(
    () => (brokerHari?.broker || [])
      .map((b) => ({ kode: b[0], beliLot: b[1], beliNilai: b[2], netLot: b[1] - b[3] }))
      .filter((b) => b.netLot > 0)
      .sort((x, y) => y.netLot - x.netLot),
    [brokerHari],
  )

  // Nilai awal diisi ulang tiap ganti emiten — bukan dipertahankan, karena
  // angka broker emiten lain tak berarti apa-apa di sini.
  useEffect(() => {
    const b = daftarBroker[0]
    setBrokerPilih(b ? b.kode : '')
    setBuyAvg(b ? Math.round(avgBeli(b.beliLot, b.beliNilai)) : 0)
    // Rumus aslinya meminta lot bandar NET, bukan lot beli kotor.
    setBuyLot(b ? b.netLot : 0)
    const a = antrean?.a
    setBid(a?.bid || 0)
    setOffer(a?.offer || 0)
    setTotalBid(a?.bidLot || 0)
    setTotalOffer(a?.offerLot || 0)
    setTick(fraksi(a?.close || 0) || 1)
  }, [daftarBroker, antrean])

  function gantiBroker(k: string) {
    setBrokerPilih(k)
    const b = daftarBroker.find((x) => x.kode === k)
    if (b) { setBuyAvg(Math.round(avgBeli(b.beliLot, b.beliNilai))); setBuyLot(b.netLot) }
  }

  const hasilTarget = hitungTarget({
    buyAvg, buyLot, bid, offer,
    totalBidLot: totalBid, totalOfferLot: totalOffer,
    tick, baselinePersen, agresif, barisManual,
  })

  // ── PBV Band ────────────────────────────────────────────────────────────
  const [harga, setHarga] = useState(0)
  const [bvps, setBvps] = useState(0)
  const [band, setBand] = useState(0)
  const [histPbv, setHistPbv] = useState<BarisRiwayat[]>(() => bacaRiwayat('kuli_pbv'))

  useEffect(() => {
    setHarga(antrean?.a.close || 0)
    setBvps(fund?.bvps || 0)
    // Dibulatkan 4 desimal: rata-rata P/B keluar sebagai pecahan penuh
    // (0,8527142857142858) dan angka sepanjang itu di kolom isian terbaca
    // seperti galat, bukan seperti nilai yang boleh disunting.
    const b = fund ? (rataPb(fund.pbTahunan) ?? fund.pbvKini ?? 0) : 0
    setBand(b ? Math.round(b * 1e4) / 1e4 : 0)
  }, [antrean, fund])

  const hasilPbv = hitungPbv(harga, bvps, band)
  const pbRata = fund ? rataPb(fund.pbTahunan) : null

  return (
    <div className="lantai kuli-papan">
      <div className="vhead">
        <h1>Kuli Papan</h1>
      </div>

      <div className="kp-bar">
        <div className="kp-cari">
          <StockAutocomplete
            stocks={indeks?.stocks || []}
            value={ketik}
            onChange={setKetik}
            onSelect={(v) => { setKetik(v); setKode(v.toUpperCase()) }}
            placeholder="Cari emiten: BUMI, BBCA…"
          />
        </div>
        <span className="kp-kode">{kode}</span>
        {muat && <span className="kp-muat">memuat…</span>}
      </div>

      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'target'}
          className={'tab' + (tab === 'target' ? ' on' : '')}
          onClick={() => setTab('target')}>Target Realistis</button>
        <button role="tab" aria-selected={tab === 'pbv'}
          className={'tab' + (tab === 'pbv' ? ' on' : '')}
          onClick={() => setTab('pbv')}>PBV Band</button>
      </div>

      {tab === 'target' && (
        <section className="panel kp-panel">
          <h2>Target Realistis</h2>
          <p className="kp-sub">
            {agresif
              ? 'Mode agresif — Target = Buy Avg + (Papan Terdorong × Tick), tanpa baseline'
              : 'Target = Buy Avg + Baseline + (Papan Terdorong × Tick)'}
          </p>

          <div className="kp-mode" role="group" aria-label="Mode perhitungan">
            <button className={'tab' + (agresif ? '' : ' on')} onClick={() => setAgresif(false)}>
              Standar
            </button>
            <button className={'tab' + (agresif ? ' on' : '')} onClick={() => setAgresif(true)}>
              Agresif
            </button>
            <span className="kp-mode-ket">
              {agresif
                ? 'Tanpa baseline; jumlah baris papan diisi sendiri dari orderbook.'
                : 'Baseline 5% ditambahkan; jumlah baris dihitung dari rentang Bid–Offer.'}
            </span>
          </div>

          {!brokerHari && !muat && (
            <div className="kp-peringatan">
              Rincian broker <b>{kode}</b> belum ada di arsip. Kalkulatornya tetap bisa dipakai
              dengan mengisi Buy Avg dan Buy Lot sendiri.
            </div>
          )}

          <div className="kp-grid">
            <label className="kp-field kp-field-lebar">
              <span>Broker</span>
              <select className="inp" value={brokerPilih} onChange={(e) => gantiBroker(e.target.value)}>
                {daftarBroker.length === 0 && <option value="">— tak ada broker net beli —</option>}
                {daftarBroker.map((b) => (
                  <option key={b.kode} value={b.kode}>
                    {b.kode} · avg {num(avgBeli(b.beliLot, b.beliNilai), 0)} · net {num(b.netLot)} lot
                  </option>
                ))}
              </select>
            </label>
            <label className="kp-field">
              <span>Buy Avg</span>
              <input className="inp" type="number" inputMode="decimal" value={buyAvg || ''}
                onChange={(e) => setBuyAvg(+e.target.value)} />
            </label>
            <label className="kp-field">
              <span>Lot bandar (net)</span>
              <input className="inp" type="number" inputMode="decimal" value={buyLot || ''}
                onChange={(e) => setBuyLot(+e.target.value)} />
            </label>
            <label className="kp-field">
              <span>Bid</span>
              <input className="inp" type="number" inputMode="decimal" value={bid || ''}
                onChange={(e) => setBid(+e.target.value)} />
            </label>
            <label className="kp-field">
              <span>Offer</span>
              <input className="inp" type="number" inputMode="decimal" value={offer || ''}
                onChange={(e) => setOffer(+e.target.value)} />
            </label>
            <label className="kp-field">
              <span>Tick</span>
              <input className="inp" type="number" inputMode="decimal" value={tick || ''}
                onChange={(e) => setTick(+e.target.value)} />
            </label>
            <label className="kp-field kp-manual">
              <span>Total Bid (lot) <em>isi sendiri</em></span>
              <input className="inp" type="number" inputMode="decimal" value={totalBid || ''}
                onChange={(e) => setTotalBid(+e.target.value)} />
            </label>
            <label className="kp-field kp-manual">
              <span>Total Offer (lot) <em>isi sendiri</em></span>
              <input className="inp" type="number" inputMode="decimal" value={totalOffer || ''}
                onChange={(e) => setTotalOffer(+e.target.value)} />
            </label>
            {agresif ? (
              <label className="kp-field kp-manual">
                <span>Jumlah baris <em>isi sendiri</em></span>
                <input className="inp" type="number" inputMode="decimal" value={barisManual || ''}
                  onChange={(e) => setBarisManual(+e.target.value)} />
              </label>
            ) : (
              <label className="kp-field">
                <span>Baseline (%)</span>
                <input className="inp" type="number" inputMode="decimal" step="0.5" value={baselinePersen}
                  onChange={(e) => setBaselinePersen(+e.target.value)} />
              </label>
            )}
          </div>

          <div className="kp-catatan">
            Angka Total Bid/Offer yang terisi otomatis hanya antrean pada <b>level harga terbaik</b>
            saat penutupan — bukan seluruh antrean orderbook, yang tidak tersedia di sumber mana pun
            yang kita punya. Untuk hasil sesuai maksud rumusnya, isi kedua kolom itu dari orderbook
            aplikasi sekuritasmu.
          </div>

          {hasilTarget ? (
            <>
              <div className="kp-hasil">
                <div className="kp-kv"><span>Jumlah papan</span><b>{num(hasilTarget.papan)}</b></div>
                <div className="kp-kv"><span>Rata per papan</span><b>{num(hasilTarget.rataPerPapan, 2)} lot</b></div>
                <div className="kp-kv"><span>Terdorong HIGH / LOW</span><b>{num(hasilTarget.dorongHigh, 2)} / {num(hasilTarget.dorongLow, 2)}</b></div>
                <div className="kp-kv"><span>Baseline</span><b>{num(hasilTarget.baselinePoin, 2)} poin</b></div>
              </div>
              <div className="kp-target">
                <div className="kp-t"><span>TARGET LOW</span><b>{rp(hasilTarget.targetLow, 2)}</b></div>
                <div className="kp-t kp-t-hi"><span>TARGET HIGH</span><b>{rp(hasilTarget.targetHigh, 2)}</b></div>
              </div>
              <button className="btn-p" onClick={() => setHistTarget(simpanRiwayat(
                'kuli_target',
                `${kode} · ${brokerPilih} → LOW ${num(hasilTarget.targetLow, 2)} / HIGH ${num(hasilTarget.targetHigh, 2)}`,
              ))}>Simpan ke riwayat</button>
            </>
          ) : (
            <div className="kp-kosong">Isi Buy Avg, Bid, Offer, dan Tick untuk menghitung.</div>
          )}

          <details className="kp-tutor">
            <summary>Cara pakai</summary>
            <ol>
              <li>
                <b>Broker, Buy Avg, Lot bandar, Bid, Offer, Tick</b> terisi otomatis dari rincian
                broker harian dan antrean penutupan bursa begitu emiten dipilih — ganti broker di
                dropdown kalau mau lihat bandar lain.
              </li>
              <li>
                <b>Total Bid (lot) dan Total Offer (lot) wajib diisi tangan</b> dari orderbook
                aplikasi sekuritasmu. Yang terisi otomatis hanya antrean di level harga terbaik
                saat tutup — bukan seluruh antrean, karena itu tidak tersedia publik di sumber
                mana pun.
              </li>
              <li>
                <b>Target Low/High</b> itu hasil rumus di atas (Buy Avg + Baseline + dorongan
                papan × tick) — hitungan mekanis, bukan rekomendasi beli/jual.
              </li>
              <li>
                Hati-hati kalau: <b>Baseline (%)</b> disetel terlalu besar (target ikut melar),
                atau rincian broker yang dipakai masih <b>data kemarin (D-1)</b> — cek tanggal di
                keterangan Sumber di bawah sebelum dipakai.
              </li>
            </ol>
          </details>

          <Sumber>
            Buy Avg &amp; Buy Lot dari rincian broker harian
            {brokerHari ? ` (${brokerHari.tanggal})` : ''}, pasar reguler seluruh investor.
            Bid/Offer dari antrean penutupan yang dilaporkan bursa
            {antrean ? ` (${antrean.tanggal})` : ''}. Tick dari jenjang fraksi harga bursa.
          </Sumber>
          <Riwayat baris={histTarget} />
        </section>
      )}

      {tab === 'pbv' && (
        <section className="panel kp-panel">
          <h2>PBV Band</h2>
          <p className="kp-sub">Harga wajar = BVPS × rata-rata P/B tahunan</p>

          {fund?.alasanPbKosong && (
            <div className="kp-peringatan">{fund.alasanPbKosong}</div>
          )}

          <div className="kp-grid">
            <label className="kp-field">
              <span>Harga pasar</span>
              <input className="inp" type="number" inputMode="decimal" value={harga || ''}
                onChange={(e) => setHarga(+e.target.value)} />
            </label>
            <label className="kp-field">
              <span>BVPS</span>
              <input className="inp" type="number" inputMode="decimal" value={bvps || ''}
                onChange={(e) => setBvps(+e.target.value)} />
            </label>
            <label className="kp-field">
              <span>P/B band (×)</span>
              <input className="inp" type="number" inputMode="decimal" step="0.01" value={band || ''}
                onChange={(e) => setBand(+e.target.value)} />
            </label>
          </div>

          {fund && Object.keys(fund.pbTahunan).length > 0 && (
            <div className="kp-catatan">
              P/B tahunan:{' '}
              {Object.entries(fund.pbTahunan).sort().map(([t, v]) => `${t} ${num(v, 2)}×`).join(' · ')}
              {pbRata !== null && <> → rata-rata <b>{num(pbRata, 3)}×</b></>}
              {fund.pbvKini !== null && <> · PBV kini {num(fund.pbvKini, 2)}×</>}
            </div>
          )}

          {hasilPbv ? (
            <>
              <div className="kp-hasil">
                <div className="kp-kv"><span>Harga wajar</span><b>{rp(hasilPbv.hargaWajar)}</b></div>
                <div className="kp-kv"><span>Harga pasar</span><b>{rp(harga)}</b></div>
                <div className="kp-kv">
                  <span>Selisih</span>
                  <b className={hasilPbv.upsidePersen >= 0 ? 'up' : 'dn'}>
                    {hasilPbv.upsidePersen >= 0 ? '+' : ''}{num(hasilPbv.upsidePersen, 2)}%
                  </b>
                </div>
                <div className="kp-kv">
                  <span>Status</span>
                  <b>{hasilPbv.status} <small className="muted">(±10% dari harga wajar)</small></b>
                </div>
              </div>
              <h3 className="kp-h3">
                Margin of safety <em>area beli bertahap</em>
              </h3>
              <div className="kp-mos">
                {hasilPbv.mos.map((m) => (
                  <div key={m.persen} className="kp-kv kp-mos-kv">
                    <span>MOS {m.persen}%</span><b>{rp(m.harga)}</b>
                  </div>
                ))}
              </div>
              <div className="kp-catatan">
                Kalkulator ini alat bantu edukasi, bukan rekomendasi investasi.
              </div>
              <button className="btn-p" onClick={() => setHistPbv(simpanRiwayat(
                'kuli_pbv',
                `${kode} · BVPS ${num(bvps, 2)} × ${num(band, 2)}× → ${rp(hasilPbv.hargaWajar)}`,
              ))}>Simpan ke riwayat</button>
            </>
          ) : (
            <div className="kp-kosong">Isi harga, BVPS, dan P/B band untuk menghitung.</div>
          )}

          <details className="kp-tutor">
            <summary>Cara pakai</summary>
            <ol>
              <li>
                <b>Harga pasar, BVPS, P/B band</b> terisi otomatis dari harga penutupan dan
                ringkasan rasio keuangan emiten begitu dipilih — boleh diubah tangan untuk
                simulasi skenario lain.
              </li>
              <li>
                <b>Harga wajar</b> = BVPS × P/B band. <b>MOS (margin of safety)</b> menandai
                beberapa harga di bawah harga wajar sebagai area beli bertahap — bukan sinyal beli.
              </li>
              <li>
                Hati-hati kalau: P/B band dipakai apa adanya tanpa cek keterangan P/B tahunan di
                bawah — kalau tahunnya cuma sedikit atau menyimpang jauh dari PBV kini, rata-ratanya
                gampang menyesatkan.
              </li>
            </ol>
          </details>

          <Sumber>
            BVPS dan PBV berjalan dari ringkasan rasio keuangan emiten. P/B tahunan dari
            perhitungan valuasi historis PAPAN, dihitung pada basis jumlah saham hari ini
            supaya sepadan dengan deret harga yang sudah disesuaikan aksi korporasi.
          </Sumber>
          <Riwayat baris={histPbv} />
        </section>
      )}
    </div>
  )
}
