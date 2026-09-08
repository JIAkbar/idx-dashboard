import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { StockAutocomplete } from '../../components/dasbor/StockAutocomplete'
import { useStockIndex } from '../../lib/dasbor/stockDetailData'
import { fN, tanggalRingkas } from '../../lib/dasbor/format'
import {
  HARI_HORIZON, HORIZON, LABEL_JENDELA, N_SARINGAN_SAH, URUTAN_SARINGAN,
  lencanaSaringan, posisi52, tickPersen, useIndexWinrate, useWinrate,
  type BerkasWinrate, type Jendela, type RingkasWinrate,
} from '../../lib/dasbor/winratePapan'
import './WinratePapan.css'

/**
 * Winrate PAPAN (#91, Johan 8 Sep 2026: "artifact nya bagus nih untuk BNBR
 * kalau dijadikan page Winrate sistem Papan … diterapkan di semua saham serta
 * ambil dari data selama ini bisa cek data per 10, 20, 60, 120, 200 hari dan
 * kalau ada teknikal lagi lebih bagus").
 *
 * Satu halaman per emiten: kalau aturan rencana dagang PAPAN diterapkan pada
 * saham ini, seberapa sering menang, berapa ekspektansinya sesudah biaya,
 * pada horizon berapa, dan pada kondisi teknikal apa. Semua angka dari batch
 * riset yang SAMA dengan kartu rencana dagang — halaman ini memformat, tak
 * menghitung. Kejujuran penyebutnya ditulis di layar: win rate dari yang
 * tuntas DAN dari seluruh sinyal, n efektif, dan lencana hanya untuk kondisi
 * yang sampelnya cukup.
 *
 * Yang sengaja TIDAK ada (lihat panel "Yang tidak ada di angka ini"):
 * rekonstruksi bukan sinyal yang benar-benar terbit, slippage, dan win rate
 * per pola chart.
 */

const DEFAULT_KODE = 'BBCA'

/** Desimal TETAP (67,0% bukan 67%): satu kolom angka harus sejajar komanya,
 *  dan "67%" di sebelah "63,4%" terbaca seperti dua ketelitian yang berbeda. */
const fx = (v: number, d: number): string =>
  v.toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d })
/** Persen bertanda, koma desimal: +1,23% · −0,41%. */
const fs = (v: number | null | undefined, d = 2): string =>
  v == null ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${fx(Math.abs(v), d)}%`
const fp = (v: number | null | undefined, d = 1): string => (v == null ? '—' : `${fx(v, d)}%`)
const arah = (v: number | null | undefined): string => (v == null ? '' : v > 0 ? 'up' : v < 0 ? 'down' : '')

/** Bar ekspektansi: panjang ∝ |nilai| sampai skala 3%, ke kanan positif, ke
 *  kiri negatif — supaya deret 6 horizon terbaca sekilas tanpa membaca angka. */
function BarEks({ v, skala = 3 }: { v: number | null; skala?: number }) {
  if (v == null) return <span className="wr-bar" aria-hidden="true" />
  const lebar = Math.min(50, (Math.abs(v) / skala) * 50)
  return (
    <span className="wr-bar" aria-hidden="true">
      <i className={v >= 0 ? 'up' : 'down'}
        style={v >= 0 ? { left: '50%', width: `${lebar}%` } : { right: '50%', width: `${lebar}%` }} />
    </span>
  )
}

function Kpi({ label, nilai, ket, kelas }: { label: string; nilai: string; ket: string; kelas?: string }) {
  return (
    <div className="tile wr-tile">
      <span className="t-name">{label}</span>
      <span className={`t-val num ${kelas ?? ''}`}>{nilai}</span>
      <span className="t-code">{ket}</span>
    </div>
  )
}

export function WinratePapan() {
  const [param, setParam] = useSearchParams()
  const kode = useMemo(() => {
    const q = (param.get('kode') ?? '').trim().toUpperCase()
    return /^[A-Z0-9]{2,6}$/.test(q) ? q : DEFAULT_KODE
  }, [param])
  const [cari, setCari] = useState(kode)
  useEffect(() => { setCari(kode) }, [kode])

  const { index: indeksEmiten } = useStockIndex()
  const { data, status } = useWinrate(kode)
  const pasar = useIndexWinrate()
  const [jendela, setJendela] = useState<Jendela>('n120')
  const [hSaring, setHSaring] = useState<'h20' | 'h60'>('h20')

  const pilih = (k: string) => {
    const bersih = k.trim().toUpperCase()
    if (bersih && bersih !== kode) setParam({ kode: bersih })
  }

  return (
    <div className="lantai wr">
      <div className="vhead">
        <h1>Winrate PAPAN</h1>
        <span className="sub">
          Aturan rencana dagang PAPAN diuji ulang pada riwayat tiap emiten: seberapa sering menang,
          ekspektansi sesudah biaya, dan kondisi teknikal yang membedakannya.
        </span>
      </div>

      <div className="panel">
        <div className="panel-b">
          <div className="bilah-kendali wr-alat">
            <div className="grup-k">
              <div className="wr-cari">
                <StockAutocomplete
                  stocks={indeksEmiten?.stocks ?? []}
                  value={cari}
                  onChange={setCari}
                  onSelect={pilih}
                  placeholder="Cari emiten: BUMI, BBCA…"
                />
              </div>
            </div>
            <span className="pemisah-v" aria-hidden="true" />
            <div className="grup-k" role="group" aria-label="Jendela sinyal">
              {(Object.keys(LABEL_JENDELA) as Jendela[]).map((j) => (
                <button key={j} type="button" className={'chip-t' + (jendela === j ? ' on' : '')}
                  aria-pressed={jendela === j} onClick={() => setJendela(j)}>
                  {LABEL_JENDELA[j]}
                </button>
              ))}
            </div>
            {data && (
              <div className="grup-kanan wr-meta">
                <b>{data.kode}</b> · Data per {tanggalRingkas(data.akhir)} · {fN(data.nBar, 0)} hari bursa sejak {data.mulai.slice(0, 4)}
                {data.rencana && <> · harga Rp {fN(data.rencana.harga, 0)}</>}
              </div>
            )}
          </div>
        </div>
      </div>

      {status === 'memuat' && <div className="panel"><div className="panel-b muted">Memuat angka {kode}…</div></div>}

      {status === 'tidak-ada' && (
        <div className="panel">
          <div className="panel-b">
            <b>{kode}</b> belum punya angka winrate. Halaman ini hanya menghitung emiten yang riwayat harganya
            cukup panjang (sedikitnya 44 hari bursa berisi) dan ada di arsip harga PAPAN — emiten baru,
            yang lama disuspensi, atau kode yang salah ketik akan jatuh ke sini. Coba kode lain lewat pencarian di atas.
          </div>
        </div>
      )}

      {data && <IsiWinrate data={data} jendela={jendela} hSaring={hSaring} setHSaring={setHSaring} pasar={pasar} />}

      <p className="muted wr-kaki">
        Angka di halaman ini <b>rekonstruksi</b>: aturan hari ini diterapkan ke masa lalu, bukan catatan sinyal
        yang benar-benar terbit. Dibaca dari arsip harga PAPAN (harga bursa, arus asing dari Stockbit), nol
        jaringan, dibangun ulang tiap panen sore. Bukan rekomendasi beli atau jual — cara membaca penyebut penuh,
        n efektif, dan sinyal menggantung ada di <Link to="/metodologi#winrate">Metodologi</Link>.
      </p>
    </div>
  )
}

function IsiWinrate({ data: e, jendela: j, hSaring, setHSaring, pasar }: {
  data: BerkasWinrate
  jendela: Jendela
  hSaring: 'h20' | 'h60'
  setHSaring: (h: 'h20' | 'h60') => void
  pasar: ReturnType<typeof useIndexWinrate>
}) {
  const h20 = e.horizon.h20[j]
  const h60 = e.horizon.h60[j]
  const p20 = e.pasar.h20
  const nPasar = pasar && 'n' in pasar.pasar.h20 ? pasar.pasar.h20.n : null
  const sar = e.saringan[hSaring]
  const lencana = useMemo(() => lencanaSaringan(sar), [sar])
  const t = e.teknikal
  const pos52 = posisi52(t.harga, t.terendah52, t.tertinggi52)
  const tick = tickPersen(t.harga)
  const tahunBeku = Object.keys(e.barBeku).sort().slice(-8)

  return (
    <>
      {/* KPI — empat angka yang menjawab pertanyaan pertama pembaca */}
      <div className="tiles wr-kpi">
        <Kpi label="Win rate · 20 hari" nilai={fp(h20.winRate)}
          kelas={(h20.winRate ?? 0) >= 60 ? 'up' : ''}
          ket={`${h20.menang} menang · ${h20.kalah} kalah · ${h20.gantung} gantung · penyebut penuh ${fp(h20.winRateSemua)}`} />
        <Kpi label="Ekspektansi sesudah biaya · 20 hari" nilai={fs(h20.ekspektansiBiaya)}
          kelas={arah(h20.ekspektansiBiaya)}
          ket={`Per sinyal · rata menang ${fs(h20.rataMenang)} vs rata kalah ${fs(h20.rataKalah)}`} />
        <Kpi label="Ekspektansi sesudah biaya · 60 hari" nilai={fs(h60.ekspektansiBiaya)}
          kelas={arah(h60.ekspektansiBiaya)}
          ket={`Win rate ${fp(h60.winRate)} · n efektif ${h60.nEfektif ?? '—'}`} />
        <Kpi label="Persentil pasar · 20 hari" nilai={p20 ? String(p20.persentilEks) : '—'}
          ket={p20
            ? `Ekspektansi terhadap ${nPasar != null ? fN(nPasar, 0) : '—'} emiten (120 sinyal) · win rate di persentil ${p20.persentilWinRate}`
            : 'Belum ada sinyal tuntas untuk dibandingkan'} />
      </div>

      {/* Tabel horizon */}
      <section className="panel">
        <div className="panel-h">
          <span className="lbl">Aturan rencana dagang · enam horizon</span>
          <span className="muted wr-sub">
            Target = tutup + 1×ATR · batas = yang lebih rendah antara tutup − 1,5×ATR dan terendah 5 hari ·
            biaya {fN(e.biayaPct, 2)}% pulang-pergi · {LABEL_JENDELA[j]}
          </span>
        </div>
        <div className="panel-b">
          <div className="board-tbl-wrap">
            <table className="tbl wr-tbl">
              <thead>
                <tr>
                  <th scope="col">Horizon</th><th scope="col" className="r">Menang</th><th scope="col" className="r">Kalah</th>
                  <th scope="col" className="r">Gantung</th><th scope="col" className="r">Win rate</th>
                  <th scope="col" className="r">Penyebut penuh</th><th scope="col">Ekspektansi sesudah biaya</th>
                  <th scope="col" className="r">Rata menang</th><th scope="col" className="r">Rata kalah</th>
                  <th scope="col" className="r">n efektif</th>
                </tr>
              </thead>
              <tbody>
                {HORIZON.map((h) => {
                  const r: RingkasWinrate = e.horizon[h][j]
                  const lemah = (r.nEfektif ?? 0) < 5
                  return (
                    <tr key={h} className={h === 'h20' ? 'wr-sorot' : ''}>
                      <td><b>{HARI_HORIZON[h]} hari</b></td>
                      <td className="r num">{r.menang}</td>
                      <td className="r num">{r.kalah}</td>
                      <td className="r num">{r.gantung}</td>
                      <td className={`r num ${(r.winRate ?? 0) >= 60 ? 'up' : ''}`}>{fp(r.winRate)}</td>
                      <td className="r num">{fp(r.winRateSemua)}</td>
                      <td><span className="wr-eks"><b className={`num ${arah(r.ekspektansiBiaya)}`}>{fs(r.ekspektansiBiaya)}</b><BarEks v={r.ekspektansiBiaya} /></span></td>
                      <td className="r num up">{fs(r.rataMenang)}</td>
                      <td className="r num down">{fs(r.rataKalah)}</td>
                      <td className={`r num ${lemah ? 'wr-redup' : ''}`} title={lemah ? 'Di bawah 5 percobaan bebas — angkanya belum bisa dipercaya' : undefined}>
                        {r.nEfektif ?? '—'}{lemah ? ' ⚠' : ''}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="muted wr-ket">
            Menang biasanya tercapai cepat (median bar ke-{h20.medianBarKe ?? '—'} di 20 hari); yang menentukan tanda
            ekspektansi adalah ukuran kalah ({fs(h20.rataKalah)}) terhadap menang ({fs(h20.rataMenang)}).
            n efektif = jumlah sinyal ÷ horizon, karena jendela sinyal yang beruntun saling beririsan — ⚠ di bawah 5
            berarti angkanya lahir dari segelintir episode.
          </p>
        </div>
      </section>

      <div className="wr-duo">
        {/* Beli lalu tahan */}
        <section className="panel">
          <div className="panel-h">
            <span className="lbl">Beli lalu tahan, tanpa target dan batas</span>
            <span className="muted wr-sub">750 hari terakhir · tutup ke tutup</span>
          </div>
          <div className="panel-b">
            <div className="board-tbl-wrap">
              <table className="tbl wr-tbl">
                <thead><tr><th scope="col">Horizon</th><th scope="col" className="r">Positif</th><th scope="col" className="r">Median</th><th scope="col" className="r">P25</th><th scope="col" className="r">P75</th><th scope="col" className="r">n efektif</th></tr></thead>
                <tbody>
                  {HORIZON.map((h) => {
                    const r = e.returnMentah[h]
                    return (
                      <tr key={h}>
                        <td><b>{HARI_HORIZON[h]} hari</b></td>
                        {r ? (
                          <>
                            <td className="r num">{fp(r.winRate)}</td>
                            <td className={`r num ${arah(r.median)}`}>{fs(r.median)}</td>
                            <td className="r num down">{fs(r.p25)}</td>
                            <td className="r num up">{fs(r.p75)}</td>
                            <td className="r num">{r.nEfektif}</td>
                          </>
                        ) : <td colSpan={5} className="muted">—</td>}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className="muted wr-ket">
              Pembanding jujur untuk aturan target/batas: kalau sekadar menahan sudah lebih baik, aturannya yang
              memotong keuntungan, bukan sahamnya.
            </p>
          </div>
        </section>

        {/* Pembanding pasar */}
        <section className="panel">
          <div className="panel-h">
            <span className="lbl">Pembanding pasar</span>
            <span className="muted wr-sub">{nPasar != null ? `${fN(nPasar, 0)} emiten · 120 sinyal · aturan yang sama` : 'memuat…'}</span>
          </div>
          <div className="panel-b">
            <div className="board-tbl-wrap">
              <table className="tbl wr-tbl">
                <thead><tr><th scope="col">Ukuran</th><th scope="col" className="r">Emiten ini</th><th scope="col" className="r">Median pasar</th><th scope="col" className="r">P25 – P75</th><th scope="col" className="r">Persentil</th></tr></thead>
                <tbody>
                  {(['h20', 'h60'] as const).map((h) => {
                    const r = e.horizon[h].n120
                    const m = pasar && 'winRateMedian' in pasar.pasar[h] ? pasar.pasar[h] : null
                    const p = e.pasar[h]
                    return (
                      <>
                        <tr key={`${h}-wr`}>
                          <td>Win rate {HARI_HORIZON[h]} hari</td>
                          <td className="r num">{fp(r.winRate)}</td>
                          <td className="r num">{m ? fp(m.winRateMedian) : '—'}</td>
                          <td className="r num wr-redup">{m ? `${fN(m.winRateP25, 1)} – ${fN(m.winRateP75, 1)}%` : '—'}</td>
                          <td className="r num">{p?.persentilWinRate ?? '—'}</td>
                        </tr>
                        <tr key={`${h}-eks`}>
                          <td>Ekspektansi sesudah biaya {HARI_HORIZON[h]} hari</td>
                          <td className={`r num ${arah(r.ekspektansiBiaya)}`}>{fs(r.ekspektansiBiaya)}</td>
                          <td className="r num">{m ? fs(m.eksMedian) : '—'}</td>
                          <td className="r num wr-redup">{m ? `${fs(m.eksP25)} – ${fs(m.eksP75)}` : '—'}</td>
                          <td className="r num">{p?.persentilEks ?? '—'}</td>
                        </tr>
                      </>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {pasar && 'pctEksPositif' in pasar.pasar.h20 && 'pctEksPositif' in pasar.pasar.h60 && (
              <p className="muted wr-ket">
                Hanya <b>{fp(pasar.pasar.h20.pctEksPositif)}</b> emiten yang ekspektansinya positif sesudah biaya di
                20 hari, dan <b>{fp(pasar.pasar.h60.pctEksPositif)}</b> di 60 hari. Win rate tinggi adalah sifat
                aturannya (target dekat, batas jauh); yang membedakan emiten adalah ekspektansinya.
              </p>
            )}
          </div>
        </section>
      </div>

      {/* Saringan teknikal */}
      <section className="panel">
        <div className="panel-h">
          <span className="lbl">Saringan teknikal di hari sinyal</span>
          <span className="ti-grup" role="group" aria-label="Horizon saringan">
            {(['h20', 'h60'] as const).map((h) => (
              <button key={h} type="button" className={'chip-t' + (hSaring === h ? ' on' : '')}
                aria-pressed={hSaring === h} onClick={() => setHSaring(h)}>
                {HARI_HORIZON[h]} hari
              </button>
            ))}
          </span>
        </div>
        <div className="panel-b">
          <div className="board-tbl-wrap">
            <table className="tbl wr-tbl">
              <thead><tr><th scope="col">Kondisi saat sinyal terbit</th><th scope="col" className="r">n</th><th scope="col" className="r">Win rate</th><th scope="col">Ekspektansi sesudah biaya</th><th scope="col" className="r">Rata menang</th><th scope="col" className="r">Rata kalah</th></tr></thead>
              <tbody>
                {URUTAN_SARINGAN.filter((k) => sar[k]).map((k) => {
                  const r = sar[k]
                  const lemah = r.n < N_SARINGAN_SAH
                  return (
                    <tr key={k} className={(k === lencana.terbaik ? 'wr-sorot ' : '') + (lemah ? 'wr-redup' : '')}>
                      <td>
                        {k}
                        {k === lencana.terbaik && <i className="wr-lencana">terbaik</i>}
                        {k === lencana.terburuk && <i className="wr-lencana">terburuk</i>}
                      </td>
                      <td className="r num" title={lemah ? 'Di bawah 30 sinyal — belum bisa dipercaya' : undefined}>{r.n}{lemah ? ' ⚠' : ''}</td>
                      <td className={`r num ${!lemah && (r.winRate ?? 0) >= 60 ? 'up' : ''}`}>{fp(r.winRate)}</td>
                      <td><span className="wr-eks"><b className={`num ${lemah ? '' : arah(r.ekspektansiBiaya)}`}>{fs(r.ekspektansiBiaya)}</b><BarEks v={r.ekspektansiBiaya} /></span></td>
                      <td className="r num">{fs(r.rataMenang)}</td>
                      <td className="r num">{fs(r.rataKalah)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="muted wr-ket">
            Jendela 500 sinyal, dihitung dari kondisi pada hari sinyalnya sendiri. Baris dengan n di bawah {N_SARINGAN_SAH}
            ditulis redup dan tak diberi lencana: satu kejadian menggeser angkanya terlalu jauh. RSI 14 hari,
            rata-rata bergerak 20/50/200 hari sederhana, volume terhadap rata 20 hari, arus asing bersih 5 hari,
            rentang harian terhadap median jendela.
          </p>
        </div>
      </section>

      <div className="wr-duo">
        {/* Rencana berjalan */}
        <section className="panel">
          <div className="panel-h">
            <span className="lbl">Rencana berjalan</span>
            {e.rencana && <span className="muted wr-sub">per {tanggalRingkas(e.rencana.tanggal)}</span>}
          </div>
          <div className="panel-b">
            {e.rencana ? (
              <table className="tbl wr-tbl wr-pasangan">
                <tbody>
                  <tr><td>Area beli</td><td className="r num">{fN(e.rencana.areaBeli[0], 0)} – {fN(e.rencana.areaBeli[1], 0)}</td></tr>
                  <tr><td>Target 1</td><td className="r num">{fN(e.rencana.tp1, 0)} <span className="muted">({fs(100 * (e.rencana.tp1 / e.rencana.harga - 1), 1)})</span></td></tr>
                  <tr><td>Target 2</td><td className="r num">{fN(e.rencana.tp2, 0)} <span className="muted">({fs(100 * (e.rencana.tp2 / e.rencana.harga - 1), 1)})</span></td></tr>
                  <tr><td>Batas rugi</td><td className="r num">{fN(e.rencana.sl, 0)} <span className="muted">({fs(100 * (e.rencana.sl / e.rencana.harga - 1), 1)})</span></td></tr>
                  <tr><td>Imbalan : risiko</td><td className={`r num ${(e.rencana.rr ?? 0) >= 1 ? 'up' : 'down'}`}>{e.rencana.rr == null ? '—' : fN(e.rencana.rr, 2)}</td></tr>
                  <tr><td>Rentang harian khas</td><td className="r num">{fN(e.rencana.atrPct, 2)}%</td></tr>
                  <tr><td>Nilai transaksi harian</td><td className="r num">{e.rencana.nilaiHarian == null ? '—' : `Rp ${fN(e.rencana.nilaiHarian / 1e9, 1)} miliar`}</td></tr>
                </tbody>
              </table>
            ) : (
              <p className="muted">Rencana dagang tidak tersedia untuk emiten ini hari ini — rentang hariannya nol atau harga terakhirnya kosong, jadi tak ada level yang bisa dibuat.</p>
            )}
          </div>
        </section>

        {/* Posisi teknikal hari ini */}
        <section className="panel">
          <div className="panel-h">
            <span className="lbl">Posisi teknikal hari ini</span>
            <span className="muted wr-sub">dari harga penutupan</span>
          </div>
          <div className="panel-b">
            <table className="tbl wr-tbl wr-pasangan">
              <tbody>
                <tr><td>Harga tutup</td><td className="r num"><b>{fN(t.harga, 0)}</b></td></tr>
                {([['MA20', t.ma20], ['MA50', t.ma50], ['MA200', t.ma200]] as const).map(([nama, ma]) => (
                  <tr key={nama}>
                    <td>{nama}</td>
                    <td className="r num">
                      {ma == null ? '—' : <>{fN(ma, 2)} <span className={t.harga > ma ? 'up' : 'down'}>{t.harga > ma ? 'di atas' : 'di bawah'}</span></>}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td>RSI 14</td>
                  <td className="r num">
                    {t.rsi14 == null ? '—' : <>{fN(t.rsi14, 1)} <span className="muted">{t.rsi14 < 30 ? 'jenuh jual' : t.rsi14 > 70 ? 'jenuh beli' : 'netral'}</span></>}
                  </td>
                </tr>
              </tbody>
            </table>
            <div className="wr-rentang52" aria-hidden="true">
              {pos52 != null && <i style={{ left: `calc(${Math.round(pos52 * 100)}% - 1px)` }} />}
            </div>
            <div className="muted num wr-ket">
              Rentang 52 minggu {fN(t.terendah52, 0)} – {fN(t.tertinggi52, 0)}
              {pos52 != null && <> · harga di {Math.round(pos52 * 100)}% rentang</>}
            </div>
          </div>
        </section>
      </div>

      <div className="wr-duo">
        {/* Bar beku */}
        <section className="panel">
          <div className="panel-h">
            <span className="lbl">Bar beku per tahun</span>
            <span className="muted wr-sub">tinggi = rendah, tutup tak berubah</span>
          </div>
          <div className="panel-b">
            <div className="board-tbl-wrap">
              <table className="tbl wr-tbl">
                <thead><tr><th scope="col">Tahun</th><th scope="col" className="r">Bar</th><th scope="col" className="r">Beku</th><th scope="col">Porsi</th></tr></thead>
                <tbody>
                  {tahunBeku.map((y) => {
                    const r = e.barBeku[y]
                    return (
                      <tr key={y}>
                        <td className="num">{y}</td>
                        <td className="r num">{fN(r.bar, 0)}</td>
                        <td className="r num">{fN(r.beku, 0)}</td>
                        <td>
                          <span className="wr-eks">
                            <b className={`num ${r.pct >= 50 ? 'down' : ''}`}>{fp(r.pct)}</b>
                            <span className="wr-bar wr-bar-kiri" aria-hidden="true"><i className={r.pct >= 50 ? 'down' : 'netral'} style={{ left: 0, width: `${r.pct}%` }} /></span>
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className="muted wr-ket">
              Tahun yang hampir seluruhnya beku menyumbang sinyal yang tak pernah bisa menang maupun kalah —
              win rate di jendela panjang ikut dibentuk olehnya.
            </p>
          </div>
        </section>

        {/* Biaya nyata + yang tidak ada */}
        <section className="panel">
          <div className="panel-h"><span className="lbl">Biaya nyata &amp; yang tidak ada di angka ini</span></div>
          <div className="panel-b">
            <p className="wr-ket">
              Satu tick fraksi bursa di harga Rp {fN(t.harga, 0)} = <b className={`num ${tick != null && tick >= 0.9 ? 'down' : ''}`}>{tick == null ? '—' : `${fN(tick, 2)}%`}</b>
              {tick != null && tick >= 0.9 && <> — di harga ini satu tick saja sudah hampir seluruh biaya pulang-pergi; target satu ATR bisa jatuh persis di tick berikutnya.</>}
            </p>
            <ul className="wr-daftar muted">
              <li><b>Rekonstruksi, bukan sinyal terbit.</b> Aturan hari ini diterapkan ke seluruh masa lalu; sinyal yang benar-benar diterbitkan PAPAN dinilai terpisah di Screener · Riwayat &amp; Win Rate.</li>
              <li><b>Tanpa slippage.</b> Masuk di harga tutup hari sinyal, keluar persis di target atau batas — di saham tipis, kenyataannya lebih buruk.</li>
              <li><b>Bukan per pola.</b> Win rate menurut pola chart (RBS, gap, breakout) belum dihitung di sini.</li>
              <li><b>Horizon 120 dan 200 hari pada 120 sinyal</b> hanya satu-dua episode — bacalah n efektifnya, bukan persentasenya.</li>
            </ul>
          </div>
        </section>
      </div>
    </>
  )
}
