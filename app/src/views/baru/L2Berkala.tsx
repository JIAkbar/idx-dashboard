import { useEffect, useState } from 'react'
import { useJson, angka, bertanda, arah, tanggalPendek } from './data'
import { Hero, Blok, BarisBatang, Ringkas, Pil, Keadaan } from './ui'
import { KakiBaru } from './KakiBaru'
import { ruteLapisan } from './peta'
import { KODE_SEKTOR_BULANAN, labelSektor } from './l2b-sektor'

interface IndeksMingguan { minggu: { stem: string; tanggal_edisi_iso: string; rentang_minggu: string }[] }
interface IndeksBulanan { bulan: { stem: string; periode: string; periode_id: string }[] }
interface StatDeret { minggu_lalu: number; minggu_ini: number; perubahan: number; persen: number }
interface TopItem { kode: string; nama?: string; nilai: number; persen: number }
interface WsData {
  tanggal_edisi_iso: string
  rentang_minggu: string
  rata_rata_harian: Record<string, StatDeret>
  ihsg: { penutupan: StatDeret; terendah: StatDeret; tertinggi: StatDeret }
  net_asing: { minggu_ini: { arah: string; miliar_idr: number }; minggu_lalu: { arah: string; miliar_idr: number } }
  top_saham: { value: TopItem[] }
  top_broker: { value: TopItem[] }
  indeks_global: { negara: string; persen: number }[]
}
interface RingkasanItem { bulan_ini: number; bulan_lalu: number; mom: number | null }
interface MsTop { kode: string; nama?: string; bulan_ini: number; mom: number }
interface MsData {
  periode_id: string
  ringkasan_pasar: Record<string, RingkasanItem>
  top_saham: { value: MsTop[] }
  top_broker: { value: MsTop[] }
  indeks_kinerja: { kode: string; m1: number }[]
}

const RP_KAP = 'stock_market_trading_summary_market_capitalization_tr_idr'
const RP_NILAI = 'stock_market_trading_summary_total_value_b_idr'
const RP_VOL = 'stock_market_trading_summary_total_volume_m_shares'
const RP_FREK = 'stock_market_trading_summary_total_frequency_th_times'
const RP_RATA_NILAI = 'stock_market_trading_summary_avg_daily_value_b_idr'

/** Negara pilihan untuk perbandingan indeks global (bursa tetangga + AS),
 *  Indonesia diberi warna emas seperti artboard. Nama Indonesianya di sini. */
const NEGARA_PILIHAN: [string, string][] = [
  ['Indonesia', 'Indonesia'], ['Korea', 'Korea'], ['Singapore', 'Singapura'], ['Japan', 'Jepang'], ['US', 'AS'], ['Hong Kong', 'Hong Kong'],
]

/** true di bawah 860px — breakpoint yang sama dengan `.bb-dua-rata` di
 *  baru.css, dipakai supaya pil Mingguan/Bulanan cuma menyembunyikan salah
 *  satu kolom saat keduanya memang tak muat berdampingan. */
/** `arah()` punya nilai 'datar' yang tak dikenal `BarisBatang.warna` (cuma
 *  'biru'/'emas'/'naik'/'turun'/'abu') — 'datar' dipetakan ke 'abu'. */
function warnaArah(v: number | null | undefined): 'naik' | 'turun' | 'abu' {
  const a = arah(v)
  return a === 'datar' ? 'abu' : a
}

function useSempit(): boolean {
  const [sempit, setSempit] = useState(() => (typeof window !== 'undefined' ? window.matchMedia('(max-width: 859px)').matches : false))
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 859px)')
    const cb = () => setSempit(mq.matches)
    mq.addEventListener('change', cb)
    return () => mq.removeEventListener('change', cb)
  }, [])
  return sempit
}

export default function L2Berkala() {
  const [aktif, setAktif] = useState<'mingguan' | 'bulanan'>('mingguan')
  const sempit = useSempit()

  const idxW = useJson<IndeksMingguan>('/data-idx/json/index_weekly.json')
  const stemW = idxW.data ? idxW.data.minggu[idxW.data.minggu.length - 1]?.stem ?? null : null
  const ws = useJson<WsData>(stemW ? `/data-idx/json/${stemW}.json` : null)

  const idxM = useJson<IndeksBulanan>('/data-idx/json/index_monthly.json')
  const stemM = idxM.data ? idxM.data.bulan[idxM.data.bulan.length - 1]?.stem ?? null : null
  const ms = useJson<MsData>(stemM ? `/data-idx/json/${stemM}.json` : null)

  const galat = idxW.galat ?? idxM.galat ?? ws.galat ?? ms.galat
  if (galat) return <Keadaan galat={galat} />
  if (!ws.data || !ms.data) return <Keadaan />

  const w = ws.data, m = ms.data
  const RP = m.ringkasan_pasar
  const kap = RP[RP_KAP]

  const sektorBulanan = m.indeks_kinerja
    .filter((it) => it.kode in KODE_SEKTOR_BULANAN)
    .map((it) => ({ id: KODE_SEKTOR_BULANAN[it.kode], m1: it.m1 }))
    .sort((a, b) => b.m1 - a.m1)
  const naikSektor = sektorBulanan.filter((s) => s.m1 >= 0).length

  const globalPilihan = NEGARA_PILIHAN
    .map(([negara, label]) => { const g = w.indeks_global.find((it) => it.negara === negara); return g ? { label, persen: g.persen } : null })
    .filter((g): g is { label: string; persen: number } => g !== null)
  const globalMaxAbs = Math.max(1, ...globalPilihan.map((g) => Math.abs(g.persen)))

  const tampilMingguan = !sempit || aktif === 'mingguan'
  const tampilBulanan = !sempit || aktif === 'bulanan'

  return (
    <div className="bb-isi">
      {sempit && (
        <div className="bb-pils">
          <Pil aktif={aktif === 'mingguan'} onClick={() => setAktif('mingguan')}>Mingguan</Pil>
          <Pil aktif={aktif === 'bulanan'} onClick={() => setAktif('bulanan')}>Bulanan</Pil>
        </div>
      )}

      <div className="bb-dua-rata">
        {tampilMingguan && (
          <div className="bb-kolom">
            <Blok label={`Mingguan · ${w.rentang_minggu || tanggalPendek(w.tanggal_edisi_iso)}`}>
              <Hero
                label="IHSG penutupan minggu"
                angka={angka(w.ihsg.penutupan.minggu_ini, 2)}
                nada={arah(w.ihsg.penutupan.persen)}
                sub={`${bertanda(w.ihsg.penutupan.perubahan, 2)} (${bertanda(w.ihsg.penutupan.persen, 2)}%) vs ${angka(w.ihsg.penutupan.minggu_lalu, 2)} minggu lalu`}
              />
              <p className="bb-narasi">Rentang minggu {angka(w.ihsg.terendah.minggu_ini, 2)}–{angka(w.ihsg.tertinggi.minggu_ini, 2)}.</p>
            </Blok>

            <Ringkas items={[
              { label: 'Rata² nilai/hari', nilai: `Rp ${angka(w.rata_rata_harian.nilai_miliar_idr.minggu_ini, 0)} M`, sub: `${bertanda(w.rata_rata_harian.nilai_miliar_idr.persen, 2)}% vs minggu lalu`, nada: arah(w.rata_rata_harian.nilai_miliar_idr.persen) },
              { label: 'Rata² volume/hari', nilai: `${angka(w.rata_rata_harian.volume_juta_lembar.minggu_ini, 0)} juta`, sub: `${bertanda(w.rata_rata_harian.volume_juta_lembar.persen, 2)}% vs minggu lalu`, nada: arah(w.rata_rata_harian.volume_juta_lembar.persen) },
              { label: 'Rata² frekuensi/hari', nilai: `${angka(w.rata_rata_harian.frekuensi_ribu_kali.minggu_ini, 0)} rb`, sub: `${bertanda(w.rata_rata_harian.frekuensi_ribu_kali.persen, 2)}% vs minggu lalu`, nada: arah(w.rata_rata_harian.frekuensi_ribu_kali.persen) },
              { label: 'Kapitalisasi', nilai: `Rp ${angka(w.rata_rata_harian.kapitalisasi_triliun_idr.minggu_ini, 0)} T`, sub: `${bertanda(w.rata_rata_harian.kapitalisasi_triliun_idr.persen, 2)}% vs minggu lalu`, nada: arah(w.rata_rata_harian.kapitalisasi_triliun_idr.persen) },
            ]} />

            <Blok label="Asing bersih minggu ini" narasi={`Minggu lalu ${w.net_asing.minggu_lalu.arah} Rp ${angka(Math.abs(w.net_asing.minggu_lalu.miliar_idr), 1)} M.`}>
              <span className={`bb-mono ${w.net_asing.minggu_ini.arah === 'jual' ? 'turun' : 'naik'}`} style={{ fontSize: 20 }}>
                Rp {angka(Math.abs(w.net_asing.minggu_ini.miliar_idr), 1)} M {w.net_asing.minggu_ini.arah}
              </span>
            </Blok>

            <Blok label="Top 5 saham nilai transaksi minggu">
              <div className="bb-daftar">
                {w.top_saham.value.slice(0, 5).map((it, i) => (
                  <BarisBatang key={it.kode} kode={it.kode} lebar={(it.nilai / w.top_saham.value[0].nilai) * 100} nilai={`Rp ${angka(it.nilai, 0)} M`} warna={i === 0 ? 'emas' : 'biru'} ke={ruteLapisan('harga', it.kode)} />
                ))}
              </div>
            </Blok>

            <Blok label="Top 5 broker nilai transaksi minggu">
              <div className="bb-daftar">
                {w.top_broker.value.slice(0, 5).map((it, i) => (
                  <BarisBatang key={it.kode} kode={it.kode} lebar={(it.nilai / w.top_broker.value[0].nilai) * 100} nilai={`Rp ${angka(it.nilai, 0)} M`} warna={i === 0 ? 'emas' : 'biru'} />
                ))}
              </div>
            </Blok>

            <Blok label="Indeks global · perubahan minggu">
              <div className="bb-daftar">
                {globalPilihan.map((g) => (
                  <BarisBatang key={g.label} kode={g.label} lebar={(Math.abs(g.persen) / globalMaxAbs) * 100} nilai={bertanda(g.persen, 2)} nada={arah(g.persen)} warna={g.label === 'Indonesia' ? 'emas' : warnaArah(g.persen)} />
                ))}
              </div>
            </Blok>
          </div>
        )}

        {tampilBulanan && (
          <div className="bb-kolom">
            <Blok label={`Bulanan · ${m.periode_id}`}>
              <Hero
                label={`Kapitalisasi pasar akhir ${m.periode_id.split(' ')[0]}`}
                angka={angka(kap.bulan_ini, 0)}
                satuan="T"
                nada={arah(kap.mom ?? 0)}
                sub={`${bertanda(kap.mom, 2)}% vs ${angka(kap.bulan_lalu, 0)} T bulan lalu`}
              />
              <p className="bb-narasi">
                Kapitalisasi {(kap.mom ?? 0) >= 0 ? 'naik' : 'turun'} {angka(Math.abs(kap.mom ?? 0), 2)}% dibanding bulan lalu;
                {' '}nilai transaksi {(RP[RP_NILAI].mom ?? 0) >= 0 ? 'naik' : 'turun'} {angka(Math.abs(RP[RP_NILAI].mom ?? 0), 2)}%.
              </p>
            </Blok>

            <Ringkas items={[
              { label: 'Nilai transaksi bulan', nilai: `Rp ${angka(RP[RP_NILAI].bulan_ini / 1000, 1)} T`, sub: `${bertanda(RP[RP_NILAI].mom, 2)}% mom`, nada: arah(RP[RP_NILAI].mom ?? 0) },
              { label: 'Volume bulan', nilai: `${angka(RP[RP_VOL].bulan_ini / 1000, 1)} miliar lbr`, sub: `${bertanda(RP[RP_VOL].mom, 2)}% mom`, nada: arah(RP[RP_VOL].mom ?? 0) },
              { label: 'Frekuensi bulan', nilai: `${angka(RP[RP_FREK].bulan_ini / 1000, 2)} juta`, sub: `${bertanda(RP[RP_FREK].mom, 2)}% mom`, nada: arah(RP[RP_FREK].mom ?? 0) },
              { label: 'Rata² nilai/hari', nilai: `Rp ${angka(RP[RP_RATA_NILAI].bulan_ini / 1000, 1)} T`, sub: `${bertanda(RP[RP_RATA_NILAI].mom, 2)}% mom`, nada: arah(RP[RP_RATA_NILAI].mom ?? 0) },
            ]} />

            <Blok label="Top 5 saham nilai transaksi bulan" narasi={`${m.top_saham.value[0]?.kode ?? '–'} memimpin nilai transaksi bulan ini (${bertanda(m.top_saham.value[0]?.mom ?? null, 1)}% mom).`}>
              <div className="bb-daftar">
                {m.top_saham.value.slice(0, 5).map((it, i) => (
                  <BarisBatang key={it.kode} kode={it.kode} lebar={(it.bulan_ini / m.top_saham.value[0].bulan_ini) * 100} nilai={`Rp ${angka(it.bulan_ini, 0)} M`} warna={i === 0 ? 'emas' : 'biru'} ke={ruteLapisan('harga', it.kode)} />
                ))}
              </div>
            </Blok>

            <Blok label="Top 5 broker nilai transaksi bulan">
              <div className="bb-daftar">
                {m.top_broker.value.slice(0, 5).map((it, i) => (
                  <BarisBatang key={it.kode} kode={it.kode} lebar={(it.bulan_ini / m.top_broker.value[0].bulan_ini) * 100} nilai={`Rp ${angka(it.bulan_ini, 0)} M`} warna={i === 0 ? 'emas' : 'biru'} />
                ))}
              </div>
            </Blok>

            <Blok label="Sektor · perubahan indeks sebulan" narasi={`${naikSektor} dari ${sektorBulanan.length} sektor naik dalam sebulan terakhir.`}>
              <div className="bb-daftar">
                {sektorBulanan.map((s) => (
                  <BarisBatang key={s.id} kode={labelSektor(s.id)} lebar={(Math.abs(s.m1) / Math.max(1, ...sektorBulanan.map((x) => Math.abs(x.m1)))) * 100} nilai={bertanda(s.m1, 2)} nada={arah(s.m1)} warna={warnaArah(s.m1)} />
                ))}
              </div>
            </Blok>
          </div>
        )}
      </div>

      <KakiBaru sumber={`Mingguan: statistik resmi bursa ${tanggalPendek(w.tanggal_edisi_iso)}. Bulanan: statistik resmi bursa ${m.periode_id}. Top saham/broker bulanan diambil dari 15 peringkat teratas laporan resmi.`} />
    </div>
  )
}
