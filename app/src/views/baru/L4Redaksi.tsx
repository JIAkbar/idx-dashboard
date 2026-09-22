import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { daftarJenjang, type JenjangRow } from '../../lib/jenjang'
import { todayIsoJakarta } from '../../lib/tanggalBursa'
import { Hero, Blok, Ringkas, Keadaan } from './ui'
import { angka } from './data'
import { KakiBaru } from './KakiBaru'

interface SetoranRingkas {
  tanggal: string
  ticker: string
  jenis: string
  status: string
  penyetor: string
  dikurasi_pada: string | null
  dibuat_pada: string
  dimuat: boolean
}
interface ProfilRingkas { id: string; tier: number | null; peran: string; aktif: boolean }

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const LABEL_JENIS: Record<string, string> = { broksum: 'Broker summary', chart: 'Chart', bedah: 'Bedah' }

function median(xs: number[]): number | null {
  if (xs.length === 0) return null
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/** Dua kartu ilustrasi (tak diambil dari antrean nyata) — cuma menunjukkan
 *  BENTUK kartu kurasi; ticker nyata, alias generik, berlabel "contoh kartu". */
const CONTOH_ANTREAN = [
  { alias: 'Kontributor A', ticker: 'BUMI', jenis: 'Broker summary', catatan: 'Akumulasi asing tiga hari beruntun, share top3 naik.' },
  { alias: 'Kontributor B', ticker: 'ARCI', jenis: 'Bedah', catatan: 'Pola akumulasi jelang aksi korporasi, sudah dicek ke bandarmologi.' },
]

export default function L4Redaksi() {
  const [setoran, setSetoran] = useState<SetoranRingkas[] | null>(null)
  const [profil, setProfil] = useState<ProfilRingkas[] | null>(null)
  const [jenjang, setJenjang] = useState<JenjangRow[] | null>(null)
  const [notifKurasi, setNotifKurasi] = useState<number | null>(null)
  const [galat, setGalat] = useState<string | null>(null)

  useEffect(() => {
    let hidup = true
    Promise.all([
      supabase.from('setoran').select('tanggal,ticker,jenis,status,penyetor,dikurasi_pada,dibuat_pada,dimuat'),
      supabase.from('profil').select('id,tier,peran,aktif'),
      daftarJenjang(),
      supabase.from('notifikasi').select('id', { count: 'exact', head: true }).eq('jenis', 'kurasi'),
    ]).then(([s, p, j, n]) => {
      if (!hidup) return
      if (s.error) throw s.error
      if (p.error) throw p.error
      setSetoran((s.data ?? []) as SetoranRingkas[])
      setProfil((p.data ?? []) as ProfilRingkas[])
      setJenjang(j)
      setNotifKurasi(n.count ?? 0)
    }).catch((e: unknown) => { if (hidup) setGalat(e instanceof Error ? e.message : String(e)) })
    return () => { hidup = false }
  }, [])

  const kaki = 'Angka agregat dari basis data kontributor; nama & email tidak ditampilkan.'
  if (galat) return <div className="bb-isi"><Keadaan galat={galat} /><KakiBaru sumber={kaki} /></div>
  if (!setoran || !profil || !jenjang || notifKurasi === null) return <div className="bb-isi"><Keadaan /></div>

  const total = setoran.length
  const disetujui = setoran.filter((s) => s.status === 'disetujui')
  const dihapus = setoran.filter((s) => s.status === 'dihapus').length
  const revisi = setoran.filter((s) => s.status === 'revisi').length
  const menunggu = setoran.filter((s) => s.status === 'menunggu').length
  const dimuatBelum = disetujui.filter((s) => !s.dimuat).length
  const pctDisetujui = total > 0 ? (disetujui.length / total) * 100 : 0
  const pctDihapus = total > 0 ? (dihapus / total) * 100 : 0
  const pctSisa = total > 0 ? (100 - pctDisetujui - pctDihapus) : 0

  const jamKurasi = setoran
    .filter((s) => s.dikurasi_pada)
    .map((s) => (new Date(s.dikurasi_pada as string).getTime() - new Date(s.dibuat_pada).getTime()) / 3600000)
    .filter((j) => Number.isFinite(j) && j >= 0)
  const medianJam = median(jamKurasi)

  const perJenis = new Map<string, number>()
  for (const s of setoran) perJenis.set(s.jenis, (perJenis.get(s.jenis) ?? 0) + 1)
  const perJenisRanked = [...perJenis.entries()].sort((a, b) => b[1] - a[1])
  const maxJenis = Math.max(1, ...perJenisRanked.map(([, c]) => c))

  const perBulan = new Map<string, number>()
  for (const s of setoran) {
    const kunci = s.tanggal.slice(0, 7)
    perBulan.set(kunci, (perBulan.get(kunci) ?? 0) + 1)
  }
  const perBulanRanked = [...perBulan.entries()].sort((a, b) => a[0].localeCompare(b[0]))

  const perHari = new Map<string, number>()
  for (const s of setoran) perHari.set(s.tanggal, (perHari.get(s.tanggal) ?? 0) + 1)
  const hariTerpadat = [...perHari.entries()].sort((a, b) => b[1] - a[1])[0] ?? null
  const hariTop2 = [...perHari.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2)
  const maxHari = Math.max(1, ...hariTop2.map(([, c]) => c))

  const penyetorCount = new Map<string, number>()
  for (const s of setoran) penyetorCount.set(s.penyetor, (penyetorCount.get(s.penyetor) ?? 0) + 1)
  const jumlahPenyetor = penyetorCount.size
  const medianPerPenyetor = median([...penyetorCount.values()])
  const kontributorAktif = profil.filter((p) => p.peran === 'kontributor').length
  const superadminAktif = profil.filter((p) => p.peran === 'superadmin').length

  const jenjangUrut = [...jenjang].sort((a, b) => a.tier - b.tier)
  const akunPerTier = new Map<number, number>()
  for (const p of profil) akunPerTier.set(p.tier ?? 0, (akunPerTier.get(p.tier ?? 0) ?? 0) + 1)
  const maxAkunTier = Math.max(1, ...jenjangUrut.map((j) => akunPerTier.get(j.tier) ?? 0))

  const hariIni = todayIsoJakarta()
  const setoranHariIni = setoran.filter((s) => s.tanggal === hariIni)
  const menungguHariIni = setoranHariIni.filter((s) => s.status === 'menunggu').length
  const revisiHariIni = setoranHariIni.filter((s) => s.status === 'revisi').length

  return (
    <div className="bb-isi">
      <div className="bb-dua">
        <Hero
          label="Setoran disetujui & dimuat"
          angka={disetujui.length - dimuatBelum}
          satuan={`dari ${total} (${angka(pctDisetujui, 0)}%)`}
          sub={
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
              <div style={{ display: 'flex', height: 10, borderRadius: 999, overflow: 'hidden', maxWidth: 480 }}>
                <div style={{ width: `${pctDisetujui}%`, background: 'var(--bb-naik)' }} />
                <div style={{ width: `${pctDihapus}%`, background: 'var(--bb-turun)' }} />
                <div style={{ width: `${pctSisa}%`, background: 'var(--bb-biru)' }} />
              </div>
              <span style={{ fontSize: 13, color: 'var(--bb-redup)', fontFamily: 'inherit' }}>
                {disetujui.length} disetujui{dimuatBelum > 0 ? ` (${dimuatBelum} belum dimuat)` : ' & dimuat'}, {dihapus} dihapus, {revisi} perlu revisi, {menunggu} menunggu — dari {total} setoran total.
              </span>
              <Ringkas items={[
                { label: 'Median kurasi', nilai: medianJam != null ? `${angka(medianJam, 1)} jam` : '–', sub: 'setor → diputuskan' },
                { label: 'Notifikasi terkirim', nilai: notifKurasi, sub: 'hasil kurasi ke kontributor' },
              ]} />
            </div>
          }
        />

        <Blok label="Antrean kurasi" catatan={`antrean nyata hari ini: ${menungguHariIni} menunggu, ${revisiHariIni} revisi`}>
          <div className="bb-kartu-grid">
            {CONTOH_ANTREAN.map((c) => (
              <div key={c.ticker} className="bb-kartu">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span className="bb-mono" style={{ fontWeight: 600, fontSize: 15 }}>{c.alias} · {c.ticker}</span>
                  <span className="bb-lencana">contoh kartu</span>
                </div>
                <span style={{ fontSize: 12, color: 'var(--bb-redup)' }}>{c.jenis}</span>
                <span style={{ fontSize: 13 }}>&ldquo;{c.catatan}&rdquo;</span>
                <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                  <span className="bb-tombol utama" style={{ flex: 1, fontSize: 13, opacity: 0.6, pointerEvents: 'none' }}>Setujui</span>
                  <span className="bb-tombol" style={{ flex: 1, fontSize: 13, opacity: 0.6, pointerEvents: 'none' }}>Minta revisi</span>
                </div>
              </div>
            ))}
          </div>
        </Blok>
      </div>

      <div className="bb-tiga">
        <Blok label="Setoran harian · dua titik teramai">
          <div className="bb-daftar">
            {hariTop2.map(([tgl, c]) => (
              <div key={tgl} style={{ display: 'grid', gridTemplateColumns: '70px minmax(0,1fr) 30px', columnGap: 10, alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'var(--bb-redup)' }}>{tgl.slice(8, 10)}/{tgl.slice(5, 7)}</span>
                <div style={{ height: 14, borderRadius: 3, background: 'var(--bb-garis)', overflow: 'hidden' }}>
                  <div style={{ width: `${(c / maxHari) * 100}%`, height: 14, background: 'var(--bb-biru)' }} />
                </div>
                <span className="bb-mono" style={{ textAlign: 'right' }}>{c}</span>
              </div>
            ))}
          </div>
          <p className="bb-narasi">
            {perBulanRanked.map(([b, c]) => `${BULAN[Number(b.slice(5, 7)) - 1]} ${b.slice(0, 4)} ${c}`).join(' · ')}. Rincian harian lain tidak ditampilkan.
          </p>
        </Blok>

        <Blok label="Jenis setoran">
          <div className="bb-daftar">
            {perJenisRanked.map(([j, c]) => (
              <div key={j} style={{ display: 'grid', gridTemplateColumns: '100px minmax(0,1fr) 34px', columnGap: 10, alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'var(--bb-redup)' }}>{LABEL_JENIS[j] ?? j}</span>
                <div style={{ height: 14, borderRadius: 3, background: 'var(--bb-garis)', overflow: 'hidden' }}>
                  <div style={{ width: `${(c / maxJenis) * 100}%`, height: 14, background: 'var(--bb-biru)' }} />
                </div>
                <span className="bb-mono" style={{ textAlign: 'right' }}>{c}</span>
              </div>
            ))}
          </div>
          {perJenisRanked.length >= 2 && (
            <p className="bb-narasi">{LABEL_JENIS[perJenisRanked[0][0]] ?? perJenisRanked[0][0]} {angka(perJenisRanked[0][1] / Math.max(1, perJenisRanked[perJenisRanked.length - 1][1]), 1)}× lebih banyak dari {LABEL_JENIS[perJenisRanked[perJenisRanked.length - 1][0]] ?? perJenisRanked[perJenisRanked.length - 1][0]}.</p>
          )}
        </Blok>

        <Blok label="Kontributor">
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>
            {profil.length} akun aktif ({kontributorAktif} kontributor + {superadminAktif} superadmin). {jumlahPenyetor} pernah menyetor{medianPerPenyetor != null ? `, median ${angka(medianPerPenyetor, 0)} setoran per penyetor` : ''}.
          </p>
          {hariTerpadat && <p className="bb-narasi">Hari terpadat {hariTerpadat[0]} = {hariTerpadat[1]} setoran.</p>}
        </Blok>
      </div>

      <Blok label="Jenjang kontributor · akun per jenjang">
        <div className="bb-tabel-wrap">
          <table className="bb-tabel">
            <thead>
              <tr><th>Jenjang</th><th className="kanan">Min ✓</th><th className="kanan">Akurasi</th><th className="kanan">Kuota/hr</th><th className="kanan">Beku</th><th>Hak</th><th>Akun</th></tr>
            </thead>
            <tbody>
              {jenjangUrut.map((j) => {
                const n = akunPerTier.get(j.tier) ?? 0
                return (
                  <tr key={j.tier}>
                    <td>{j.tier} · {j.nama}</td>
                    <td className="kanan bb-mono">{j.min_disetujui}</td>
                    <td className="kanan bb-mono">{j.min_akurasi ?? 0}%</td>
                    <td className="kanan bb-mono">{j.kuota}</td>
                    <td className="kanan bb-mono">{j.hari_beku ?? '–'}h</td>
                    <td style={{ fontSize: 12, color: 'var(--bb-redup)' }}>{j.hak ?? '–'}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 70, height: 10, borderRadius: 3, background: 'var(--bb-garis)', overflow: 'hidden' }}>
                          <div style={{ width: `${(n / maxAkunTier) * 100}%`, height: 10, background: 'var(--bb-emas)' }} />
                        </div>
                        <span className="bb-mono">{n}</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="bb-narasi">Batang = akun per jenjang. {akunPerTier.get(jenjangUrut[0]?.tier ?? 0) ?? 0} dari {profil.length} akun masih di jenjang {jenjangUrut[0]?.nama ?? '–'}.</p>
      </Blok>

      <Blok label="Nada ke kontributor · contoh pesan hasil kurasi">
        <div style={{ padding: '13px 18px', background: 'var(--bb-panel)', borderLeft: '3px solid var(--bb-emas)', borderRadius: '0 10px 10px 0' }}>
          <span style={{ fontSize: 14, lineHeight: 1.5 }}>
            &ldquo;Terima kasih sudah menyetor — kontribusimu membantu pembaca lain melihat arus pasar hari ini. Kami muat di edisi terbaru dengan sedikit rapian format.&rdquo; <span className="bb-catatan">(contoh)</span>
          </span>
        </div>
      </Blok>

      <KakiBaru sumber={kaki} />
    </div>
  )
}
