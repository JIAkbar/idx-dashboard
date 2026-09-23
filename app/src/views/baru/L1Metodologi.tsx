import { useDsTerbaru, useJson, angka, rupiah, tanggalPendek, arah } from './data'
import { Hero, Blok, Keadaan } from './ui'
import { KakiBaru } from './KakiBaru'
import { Link } from 'react-router-dom'

interface Ds { nf_today_idr: number; trading_day: number }
type AliranRow = [string, number, number, number, number, number, number, number, number, number, number, number, number]
interface AliranInvestor { mulai: string; akhir: string; n: number; d: AliranRow[] }

export default function L1Metodologi({ sisip = false }: { sisip?: boolean } = {}) {
  const ds = useDsTerbaru<Ds>()
  const aliran = useJson<AliranInvestor>('/data-idx/json/aliran_investor.json')

  if (!ds.data || !aliran.data) return <Keadaan galat={ds.galat ?? aliran.galat} />
  const d = ds.data
  const baris = aliran.data.d[aliran.data.d.length - 1]
  const jumlahEmiten = baris[1]
  const beliRp = baris[10]
  const jualRp = baris[11]
  const resmiMiliar = baris[12]
  const taksiranMiliar = (beliRp - jualRp) / 1e9
  const selisihPersen = resmiMiliar !== 0 ? Math.abs((taksiranMiliar - resmiMiliar) / resmiMiliar) * 100 : 0
  const jualBeli = d.nf_today_idr < 0 ? 'jual' : 'beli'

  return (
    <div className="bb-isi">
      <Blok kelas="polos" catatan={`Statistik resmi bursa · ${tanggalPendek(ds.tanggal)} · penutupan`}>
        <span className="bb-label">Angka yang diklik</span>{' '}
        <span className={`bb-mono ${arah(d.nf_today_idr)}`}>asing bersih {rupiah(d.nf_today_idr * 1e9)}</span>
      </Blok>

      <div className="bb-tiga">
        <div className="bb-kolom">
          <Hero label="Asing bersih · hari ini" angka={rupiah(d.nf_today_idr * 1e9)} nada={arah(d.nf_today_idr)}
            sub={`${tanggalPendek(ds.tanggal)} · net ${jualBeli}, papan reguler + negosiasi + tunai.`} />

          <Blok label="Definisi" narasi="Asing bersih = nilai beli investor asing dikurangi nilai jual, dijumlah dari papan reguler, negosiasi, dan tunai, dilaporkan bursa dalam rupiah." />
          <Blok label="Sumber" narasi="Statistik harian resmi bursa." />
          <Blok label="Cakupan" narasi={`${angka(jumlahEmiten)} emiten hari ini. IHSG tidak termasuk — indeks tak punya rincian aliran asing sendiri.`} />
          <Blok label="Diverifikasi"
            narasi={`Diperiksa silang: taksiran lembar × harga rata-rata ${rupiah(taksiranMiliar * 1e9)} vs angka resmi ${rupiah(resmiMiliar * 1e9)} — selisih ${angka(selisihPersen, 0)}% hari ini. Yang tampil di layar angka resmi, bukan taksiran.`}>
            <span style={{ fontSize: 14 }}>Dipanen {tanggalPendek(ds.tanggal)}, baris ke-{angka(aliran.data.n)} sejak {tanggalPendek(aliran.data.mulai)}.</span>
          </Blok>
          <Blok label="Batas" narasi="Taksiran per emiten (lembar × harga) bisa meleset jauh, kadang beberapa kali lipat sehari. Angka resmi hanya tersedia untuk total pasar, bukan per emiten." />
        </div>

        <div className="bb-kolom">
          <Blok judul="Rantai angka" catatan="dari bursa sampai layar, empat langkah" />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
            <div className="bb-blok panel" style={{ width: '100%', paddingTop: 18 }}>
              <div className="bb-blok-kepala"><span className="bb-label" style={{ color: 'var(--bb-emas)' }}>01</span><span style={{ fontSize: 15, fontWeight: 600 }}>Bursa menerbitkan ringkasan harian</span></div>
              <span className="bb-mono bb-catatan">{tanggalPendek(ds.tanggal)} · hari bursa ke-{d.trading_day} tahun ini</span>
              <p className="bb-narasi">Statistik penutupan, termasuk net asing pasar, dirilis bursa sesudah sesi tutup.</p>
            </div>
            <span aria-hidden style={{ padding: '4px 0', color: 'var(--bb-redup)' }}>↓</span>
            <div className="bb-blok panel" style={{ width: '100%', paddingTop: 18 }}>
              <div className="bb-blok-kepala"><span className="bb-label" style={{ color: 'var(--bb-emas)' }}>02</span><span style={{ fontSize: 15, fontWeight: 600 }}>Dipanen tiap sore</span></div>
              <span className="bb-mono bb-catatan">{tanggalPendek(ds.tanggal)} · baris ke-{angka(aliran.data.n)}</span>
              <p className="bb-narasi">Rekaman harian ditambahkan ke deret yang sudah berjalan sejak {tanggalPendek(aliran.data.mulai)}, per emiten dan per papan.</p>
            </div>
            <span aria-hidden style={{ padding: '4px 0', color: 'var(--bb-redup)' }}>↓</span>
            <div className="bb-blok panel" style={{ width: '100%', paddingTop: 18, borderColor: 'var(--bb-emas)' }}>
              <div className="bb-blok-kepala"><span className="bb-label" style={{ color: 'var(--bb-emas)' }}>03</span><span style={{ fontSize: 15, fontWeight: 600 }}>Diperiksa silang</span></div>
              <span className="bb-mono bb-catatan">taksiran {rupiah(taksiranMiliar * 1e9)} vs resmi {rupiah(resmiMiliar * 1e9)} · selisih {angka(selisihPersen, 0)}%</span>
              <p className="bb-narasi">Dua cara hitung dibandingkan tiap hari. Kalau beda jauh, yang dipakai selalu angka resmi bursa, bukan taksiran.</p>
            </div>
            <span aria-hidden style={{ padding: '4px 0', color: 'var(--bb-redup)' }}>↓</span>
            <div className="bb-blok panel" style={{ width: '100%', paddingTop: 18, borderColor: 'var(--bb-naik)' }}>
              <div className="bb-blok-kepala"><span className="bb-label" style={{ color: 'var(--bb-naik)' }}>04</span><span style={{ fontSize: 15, fontWeight: 600 }}>Tampil di layar</span></div>
              <span className={`bb-mono ${arah(d.nf_today_idr)}`} style={{ fontSize: 13 }}>{rupiah(d.nf_today_idr * 1e9)} · per {tanggalPendek(ds.tanggal)}</span>
              <p className="bb-narasi">Angka yang sama muncul di Layar Tanya, Peta Pasar, dan tiap Deep Dive yang menyebut asing.</p>
            </div>
          </div>
        </div>

        <div className="bb-kolom">
          <Blok label="Forum · angka ini" catatan="contoh utas — forum belum berjalan">
            <div className="bb-daftar">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingBottom: 12, borderBottom: '1px solid var(--bb-garis)' }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>Kontributor Pemula</span>
                <span className="bb-catatan" style={{ fontSize: 13, lineHeight: 1.45 }}>Kok selisih taksiran sama resmi bisa jauh banget?</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingBottom: 12, borderBottom: '1px solid var(--bb-garis)' }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>Kontributor Diamond</span>
                <span className="bb-catatan" style={{ fontSize: 13, lineHeight: 1.45 }}>Taksiran itu per emiten, gampang meleset sehari. Angka resmi pasar yang dipakai buat kesimpulan.</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>Redaksi</span>
                <span className="bb-catatan" style={{ fontSize: 13, lineHeight: 1.45 }}>Betul, taksiran hanya bantu lihat pola per saham — total pasar selalu pakai angka resmi bursa.</span>
              </div>
            </div>
          </Blok>
          <Link to="/feedback" className="bb-tombol utama">Jawaban ini salah? Laporkan</Link>
          <Link to="/feedback" className="bb-tombol">Tanya di forum</Link>
        </div>
      </div>

      {!sisip && <KakiBaru sumber="Metode ini berlaku untuk semua angka asing di PAPAN, bukan cuma yang di layar ini." />}
    </div>
  )
}
