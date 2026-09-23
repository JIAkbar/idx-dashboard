import { useJson, angka, rupiah, tanggalPendek, arah } from './data'
import { Hero, Blok, Rentang, Ringkas, Keadaan } from './ui'
import { KakiBaru } from './KakiBaru'
import { GrafikBatang, GrafikBatangGanda, GrafikGaris, LabelSumbu, tglSingkat } from './l2-grafik'

interface AliranInvestor {
  mulai: string
  akhir: string
  ruas: string[]
  d: (string | number | null)[][]
}

interface Pemegang { holders: { lf: string; pct: number }[] }
interface PemegangMeta { updated: string; n_emiten: number }

export default function L2Arus() {
  const { data: ai, galat: galatAi } = useJson<AliranInvestor>('/data-idx/json/aliran_investor.json')
  const { data: peta } = useJson<Pemegang[]>('/data-idx/json/investor_map.json')
  const { data: petaMeta } = useJson<PemegangMeta>('/data-idx/json/investor_map.meta.json')

  if (!ai) return <Keadaan galat={galatAi} />

  const ix = (nama: string) => ai.ruas.indexOf(nama)
  const iTgl = ix('tanggal'), iRgVal = ix('rg_val'), iNrVal = ix('nr_val'), iNf = ix('nf_resmi')
  const iFBeli = ix('f_beli_rp'), iFJual = ix('f_jual_rp')

  const baris = ai.d.map((r) => ({
    tanggal: r[iTgl] as string,
    val: (r[iRgVal] as number) + (r[iNrVal] as number),
    nf: r[iNf] as number | null,
    fBeli: r[iFBeli] as number,
    fJual: r[iFJual] as number,
  }))

  const tahunIni = baris.filter((b) => b.tanggal >= `${ai.akhir.slice(0, 4)}-01-01`)
  const ytdTerisi = tahunIni.filter((b) => b.nf != null)
  const nfYtd = ytdTerisi.reduce((s, b) => s + (b.nf ?? 0), 0)

  const jendela20 = baris.slice(-20)
  const nf20 = jendela20.map((b) => b.nf ?? 0)
  const nfHariIni = nf20[nf20.length - 1]
  const nfMin = jendela20.reduce((a, b) => ((b.nf ?? 0) < (a.nf ?? 0) ? b : a))
  const nfMax = jendela20.reduce((a, b) => ((b.nf ?? 0) > (a.nf ?? 0) ? b : a))
  const posisi20 = (((nfHariIni) - (nfMin.nf ?? 0)) / ((nfMax.nf ?? 0) - (nfMin.nf ?? 0) || 1)) * 100
  const jualCount = nf20.filter((v) => v < 0).length
  const val20 = jendela20.map((b) => b.val / 1e9)
  const avgVal20 = val20.reduce((s, v) => s + v, 0) / val20.length
  const fBeli20 = jendela20.reduce((s, b) => s + b.fBeli, 0)
  const fJual20 = jendela20.reduce((s, b) => s + b.fJual, 0)

  const rentangNarasi = nfHariIni === (nfMin.nf ?? 0)
    ? 'Hari ini paling banyak dijual bersih dalam 20 hari terakhir.'
    : nfHariIni === (nfMax.nf ?? 0)
      ? 'Hari ini paling banyak dibeli bersih dalam 20 hari terakhir.'
      : `Hari ini di sisi ${posisi20 < 50 ? 'jual' : 'beli'} dari rentang 20 hari terakhir (${angka(posisi20, 0)}% dari dasar).`

  const judulBatang = jualCount >= 10
    ? `Asing menjual bersih ${jualCount} dari 20 hari terakhir`
    : `Asing membeli bersih ${20 - jualCount} dari 20 hari terakhir`

  // Kumulatif 60 hari
  const jendela60 = baris.slice(-60)
  let kum = 0
  const kumulatif = jendela60.map((b) => { kum += b.nf ?? 0; return { tanggal: b.tanggal, nilai: kum } })
  const puncak = kumulatif.reduce((a, b) => (b.nilai > a.nilai ? b : a))
  const dasar = kumulatif.reduce((a, b) => (b.nilai < a.nilai ? b : a))
  const kini = kumulatif[kumulatif.length - 1]

  // Pemegang saham utama: rata-rata lokal/asing/lainnya per emiten
  let rataLokal = null as number | null, rataAsing = null as number | null, rataLain = null as number | null
  if (peta && peta.length) {
    const lokalArr = peta.map((e) => e.holders.filter((h) => h.lf === 'L').reduce((s, h) => s + h.pct, 0))
    const asingArr = peta.map((e) => e.holders.filter((h) => h.lf === 'F').reduce((s, h) => s + h.pct, 0))
    const n = peta.length
    rataLokal = lokalArr.reduce((s, v) => s + v, 0) / n
    rataAsing = asingArr.reduce((s, v) => s + v, 0) / n
    rataLain = Math.max(0, 100 - rataLokal - rataAsing)
  }

  return (
    <div className="bb-isi">
      <div className="bb-tanggal" style={{ textAlign: 'right' }}>Statistik resmi bursa · {tanggalPendek(ai.akhir)} · penutupan</div>
      <div className="bb-dua">
        <div className="bb-kolom">
          <Hero label="Asing bersih · penutupan" angka={rupiah(nfHariIni * 1e9)} nada={arah(nfHariIni)} />

          <Blok kelas="polos">
            <Rentang
              kiri={`terjual ${rupiah(Math.abs(nfMin.nf ?? 0) * 1e9)} (${tglSingkat(nfMin.tanggal)})`}
              kanan={`terbeli ${rupiah(Math.abs(nfMax.nf ?? 0) * 1e9)} (${tglSingkat(nfMax.tanggal)})`}
              posisi={posisi20}
              nada={arah(nfHariIni)}
            />
            <p className="bb-narasi">{rentangNarasi}</p>
          </Blok>

          <Blok kelas="polos">
            <Ringkas items={[
              { label: 'Sejak Januari', nilai: rupiah(nfYtd * 1e9), nada: arah(nfYtd), sub: `${ytdTerisi.length} hari bursa tercatat` },
              { label: '20 hari terakhir', nilai: rupiah(nf20.reduce((s, v) => s + v, 0) * 1e9), nada: arah(nf20.reduce((s, v) => s + v, 0)), sub: `${tglSingkat(jendela20[0].tanggal)} – ${tglSingkat(jendela20[jendela20.length - 1].tanggal)}` },
              { label: 'Nilai transaksi 20 hari', nilai: rupiah(avgVal20 * 1e9), sub: 'rata-rata harian' },
              { label: 'Hari jual bersih', nilai: `${jualCount} dari 20`, sub: `asing net jual ${jualCount} dari 20 hari` },
            ]} />
          </Blok>

          {rataLokal != null && rataAsing != null && rataLain != null && (
            <Blok label="Pemegang saham utama · rata-rata per emiten" narasi={`Rata-rata dari pemegang saham utama yang tercatat resmi di ${petaMeta?.n_emiten ?? peta?.length} emiten${petaMeta ? ` per ${tanggalPendek(petaMeta.updated)}` : ''}, bukan seluruh float. Porsi ritel/institusi tidak tersedia dari sumber ini.`}>
              <div style={{ display: 'flex', width: '100%', height: 26, borderRadius: 6, overflow: 'hidden' }}>
                <div className="bb-mono" style={{ width: `${rataLokal}%`, background: 'var(--bb-redup)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--bb-latar)', fontWeight: 600 }}>{angka(rataLokal, 1)}%</div>
                <div className="bb-mono" style={{ width: `${rataAsing}%`, background: 'var(--bb-biru)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--bb-latar)', fontWeight: 600 }}>{angka(rataAsing, 1)}%</div>
                <div className="bb-mono teks-11" style={{ width: `${rataLain}%`, background: 'var(--bb-garis)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--bb-redup)' }}>{angka(rataLain, 1)}%</div>
              </div>
              <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--bb-redup)', flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--bb-redup)', display: 'inline-block' }} />Lokal</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--bb-biru)', display: 'inline-block' }} />Asing</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--bb-garis)', display: 'inline-block' }} />Lainnya</span>
              </div>
            </Blok>
          )}
        </div>

        <div className="bb-kolom">
          <Blok judul={judulBatang} catatan="batang = net asing harian · hijau beli, merah jual">
            <GrafikBatang data={nf20} tinggi={110} pusatNol />
            <LabelSumbu tanggal={jendela20.map((b) => b.tanggal)} setiap={5} />
            <p className="bb-narasi">Terbesar {rupiah(Math.abs(nfMax.nf ?? 0) * 1e9)} beli ({tglSingkat(nfMax.tanggal)}) · terkecil {rupiah(Math.abs(nfMin.nf ?? 0) * 1e9)} jual ({tglSingkat(nfMin.tanggal)}).</p>
          </Blok>

          <div className="bb-dua-rata">
            <Blok label="Kumulatif 60 hari bursa">
              <GrafikGaris data={kumulatif.map((k) => k.nilai)} tinggi={130} />
              <p className="bb-narasi">Puncak {rupiah(puncak.nilai * 1e9)} ({tglSingkat(puncak.tanggal)}), dasar {rupiah(dasar.nilai * 1e9)} ({tglSingkat(dasar.tanggal)}), kini {rupiah(kini.nilai * 1e9)}.</p>
            </Blok>
            <Blok label="Nilai transaksi 20 hari · putus = rata-rata">
              <GrafikBatang data={val20} tinggi={130} rataRata={avgVal20} />
              <LabelSumbu tanggal={jendela20.map((b) => b.tanggal)} setiap={5} />
              <p className="bb-narasi">Rata-rata {rupiah(avgVal20 * 1e9)}.</p>
            </Blok>
          </div>

          <Blok label="Taksiran beli vs jual asing · 20 hari">
            <div style={{ display: 'flex', gap: 14, fontSize: 12, color: 'var(--bb-redup)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--bb-naik)', display: 'inline-block' }} />Beli</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--bb-turun)', display: 'inline-block' }} />Jual</span>
            </div>
            <GrafikBatangGanda a={jendela20.map((b) => b.fBeli)} b={jendela20.map((b) => b.fJual)} tinggi={90} />
            <LabelSumbu tanggal={jendela20.map((b) => b.tanggal)} setiap={5} />
            <p className="bb-narasi">Taksiran dari volume &amp; harga: beli {rupiah(fBeli20)} vs jual {rupiah(fJual20)}, rasio {angka(fBeli20 / fJual20, 3)}.</p>
          </Blok>
        </div>
      </div>

      <KakiBaru sumber="Semua angka dari ringkasan resmi bursa, dijumlah per tanggal sejak 2020. Nilai dalam rupiah; T = triliun, M = miliar." />
    </div>
  )
}
