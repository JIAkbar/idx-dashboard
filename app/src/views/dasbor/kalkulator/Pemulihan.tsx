import { useMemo, useState } from 'react'
import { fN } from '../../../lib/dasbor/format'
import { keFraksi, hariAraMinimal } from '../../../lib/fraksiHarga'
import { IkonMenu, IKON_PERINGATAN } from '../../../components/dasbor/IkonMenu'

/** Baris tabel acuan — kerugian yang lazim dipakai orang untuk mengukur diri. */
const ANAK_TANGGA = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95]

/** Kenaikan yang dibutuhkan untuk kembali ke modal setelah rugi `r` persen.
 *
 *  Rugi 50% memerlukan kenaikan 100%, bukan 50%: penyebutnya sudah menyusut.
 *  Rumusnya r/(100-r), dan itu meledak mendekati 100% — di situlah letak
 *  pelajarannya. */
function butuhNaik(rugi: number): number {
  if (rugi >= 100) return Infinity
  return (rugi / (100 - rugi)) * 100
}

/** Berapa tahun untuk pulih, kalau imbal tahunan rata-rata `cagr` persen. */
function tahunPulih(naikPersen: number, cagr: number): number | null {
  if (!isFinite(naikPersen) || cagr <= 0) return null
  return Math.log(1 + naikPersen / 100) / Math.log(1 + cagr / 100)
}

function tingkat(rugi: number): string {
  if (rugi <= 15) return 'ringan'
  if (rugi <= 50) return 'berat'
  return 'dalam'
}

/**
 * Tabel Pemulihan — berapa persen harga harus naik untuk sekadar balik modal.
 *
 * Tabel semacam ini beredar luas sebagai gambar statis, dan kelemahannya
 * selalu sama: ia berhenti di angka. Orang tahu "rugi 50% butuh naik 100%",
 * lalu tidak tahu harus berbuat apa dengan pengetahuan itu.
 *
 * Yang ditambahkan di sini:
 *
 * * **Posisi sendiri, bukan tabel umum.** Isi harga beli dan harga sekarang,
 *   barisnya menyorot posisi Anda dan menyebut harga yang harus dicapai —
 *   bukan cuma persentase.
 * * **Waktu, bukan cuma besaran.** Kenaikan 100% terdengar mungkin sampai
 *   diterjemahkan jadi "sekitar 10 tahun pada imbal 7% setahun". Kolom itu
 *   yang mengubah tabel jadi peringatan.
 * * **Batas ARA.** Bursa membatasi kenaikan harian; pemulihan besar butuh
 *   minimal sekian hari ARA berturut-turut — angka yang membuat harapan
 *   "besok balik" berhadapan dengan aturan bursa.
 */
export function Pemulihan() {
  const [kode, setKode] = useState('')
  const [lot, setLot] = useState('')
  const [avg, setAvg] = useState('')
  const [kini, setKini] = useState('')
  const [cagr, setCagr] = useState('7')

  const posisi = useMemo(() => {
    const a = parseFloat(avg) || 0
    const k = parseFloat(kini) || 0
    if (a <= 0 || k <= 0) return null
    const rugi = ((a - k) / a) * 100
    return { avg: a, kini: k, rugi }
  }, [avg, kini])

  const cagrN = Math.max(0, parseFloat(cagr) || 0)
  // Lot hanya pengali buat kolom rupiah — bukan bagian dari `posisi`, supaya
  // baris tabel umum (yang tak butuh lot) tak ikut hitung ulang tiap ketik.
  const lotN = Math.max(0, parseFloat(lot) || 0)

  return (
    <div className="grid2 kalk-pemulihan">
      <section className="panel">
        <div className="panel-h"><span className="lbl">Posisi Anda</span></div>
        <div className="panel-b" style={{ display: 'grid', gap: 12 }}>
          {/* Kode cuma label buat baca tabel/kartu vonis sendiri — tak dipakai
              cari data apa pun, jadi bebas diisi teks apa saja. */}
          <div className="field">
            <span className="lbl">Kode emiten</span>
            <input className="inp" type="text" value={kode} placeholder="BBCA" maxLength={6}
              onChange={(e) => setKode(e.target.value.toUpperCase())} />
          </div>
          <div className="field">
            <span className="lbl">Jumlah lot</span>
            <input className="inp" inputMode="numeric" value={lot} placeholder="0"
              onChange={(e) => setLot(e.target.value)} />
            <span className="v-note">1 lot = 100 saham — kosongkan kalau cuma mau lihat persentase.</span>
          </div>
          <div className="field">
            <span className="lbl">Harga beli rata-rata (Rp)</span>
            <input className="inp" inputMode="decimal" value={avg} placeholder="0"
              onChange={(e) => setAvg(e.target.value)} />
          </div>
          <div className="field">
            <span className="lbl">Harga sekarang (Rp)</span>
            <input className="inp" inputMode="decimal" value={kini} placeholder="0"
              onChange={(e) => setKini(e.target.value)} />
          </div>
          <div className="field">
            <span className="lbl">Asumsi imbal setahun (%)</span>
            <input className="inp" inputMode="decimal" value={cagr} placeholder="7"
              onChange={(e) => setCagr(e.target.value)} />
            {/* Angka bawaan 7% bukan tebakan asal: kira-kira imbal jangka
                panjang IHSG. Dibiarkan bisa diubah karena tiap orang punya
                keyakinan sendiri soal ini. */}
            <span className="v-note">Bawaan 7% — kira-kira imbal jangka panjang IHSG.</span>
          </div>

          {posisi && posisi.rugi > 0 && (
            <div className={`kalk-vonis ${tingkat(posisi.rugi)}`}>
              <span className="lbl">Posisi Anda turun</span>
              <span className="angka">{posisi.rugi.toFixed(2)}%</span>
              <p>
                Untuk balik modal, harga harus naik{' '}
                <b>{butuhNaik(posisi.rugi) === Infinity ? '∞' : `${butuhNaik(posisi.rugi).toFixed(2)}%`}</b>{' '}
                {/* Harga sekarang sekadar ditampilkan (arah 'dekat'); harga sasaran
                    dibulatkan ke ATAS karena itu titik yang harus benar-benar
                    tercapai di bursa — dibulatkan ke bawah malah mengecoh, terasa
                    tercapai padahal belum. */}
                — dari {fN(keFraksi(posisi.kini, 'dekat'))} kembali ke <b>{fN(keFraksi(posisi.avg, 'atas'))}</b>.
              </p>
              {lotN > 0 && (
                <p>
                  Modal <b>Rp {fN(posisi.avg * lotN * 100, 0)}</b>, sekarang{' '}
                  <b>Rp {fN(posisi.kini * lotN * 100, 0)}</b> — rugi{' '}
                  <b className="dn">Rp {fN((posisi.avg - posisi.kini) * lotN * 100, 0)}</b>
                  {kode ? ` di ${kode}` : ''}.
                </p>
              )}
              {(() => {
                const th = tahunPulih(butuhNaik(posisi.rugi), cagrN)
                if (th === null) return null
                return (
                  <p className="muted">
                    Pada imbal {cagrN}% setahun, itu sekitar <b>{th < 1 ? `${Math.round(th * 12)} bulan` : `${th.toFixed(1)} tahun`}</b>.
                  </p>
                )
              })()}
              <p className="muted">
                Paling cepat <b>{hariAraMinimal(keFraksi(posisi.kini, 'bawah'), butuhNaik(posisi.rugi))} hari ARA berturut-turut</b>{' '}
                — dan itu skenario paling ekstrem, bukan yang lazim.
              </p>
            </div>
          )}

          {posisi && posisi.rugi <= 0 && (
            <div className="kalk-vonis untung">
              <span className="lbl">Posisi Anda naik</span>
              <span className="angka">+{Math.abs(posisi.rugi).toFixed(2)}%</span>
              <p>Tidak ada yang perlu dipulihkan. Tabel di sebelah tetap berguna sebagai ukuran risiko sebelum menambah posisi.</p>
            </div>
          )}

          <p className="muted" style={{ fontSize: 11, lineHeight: 1.7, margin: 0 }}>
            <IkonMenu d={IKON_PERINGATAN} size={12} />{' '}
            Perhitungan ini mengabaikan fee dan dividen. Fee membuat pemulihan sedikit
            lebih berat; dividen sedikit lebih ringan.
          </p>
        </div>
      </section>

      <section className="panel">
        <div className="panel-h">
          <span className="lbl">Tabel Pemulihan</span>
          <span className="v-note">kenaikan yang dibutuhkan untuk balik modal</span>
        </div>
        <div className="panel-b" style={{ overflowX: 'auto' }}>
          <table className="tbl kalk-tbl-pulih">
            <colgroup>
              <col style={{ width: 74 }} /><col style={{ width: 96 }} />
              <col style={{ width: 96 }} /><col />
              <col style={{ width: 90 }} />
            </colgroup>
            <thead>
              <tr>
                <th>Rugi</th>
                <th className="num">Butuh naik</th>
                <th className="num">Lama pulih</th>
                <th className="num">Harga di titik itu</th>
                <th className="num">Hari ARA</th>
              </tr>
            </thead>
            <tbody>
              {ANAK_TANGGA.map((r) => {
                const naik = butuhNaik(r)
                const th = tahunPulih(naik, cagrN)
                // Baris yang paling dekat dengan kerugian nyata disorot: tabel
                // umum jadi cermin posisi sendiri tanpa perlu mencari-cari.
                const dekat = posisi && posisi.rugi > 0 &&
                  ANAK_TANGGA.reduce((a, b) => Math.abs(b - posisi.rugi) < Math.abs(a - posisi.rugi) ? b : a) === r
                // Harga acuan dibulatkan ke BAWAH: itu titik masuk/support di
                // baris ini, membulatkan ke atas menjanjikan harga yang belum
                // tentu bisa dipesan. Sasaran (avg) dibulatkan ke ATAS — alasan
                // sama seperti di kartu vonis di atas.
                const acuan = posisi ? keFraksi(posisi.avg * (1 - r / 100), 'bawah') : null
                return (
                  <tr key={r} className={`t-${tingkat(r)}${dekat ? ' sorot' : ''}`}>
                    <td><b>{r}%</b></td>
                    <td className="num">{naik.toFixed(2)}%</td>
                    <td className="num">{th === null ? '—' : th < 1 ? `${Math.round(th * 12)} bln` : `${th.toFixed(1)} thn`}</td>
                    <td className="num">
                      {posisi && acuan !== null
                        ? <>{fN(acuan)} <span className="muted">→ {fN(keFraksi(posisi.avg, 'atas'))}</span></>
                        : <span className="muted">isi harga beli</span>}
                    </td>
                    <td className="num">{acuan !== null ? hariAraMinimal(acuan, naik) : '—'}</td>
                  </tr>
                )
              })}
              <tr className="t-total">
                <td><b>100%</b></td>
                <td className="num">tidak mungkin</td>
                <td className="num">—</td>
                <td className="num muted">0 — tak bisa naik dari nol</td>
                <td className="num">—</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
