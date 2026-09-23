import { useState } from 'react'
import { useJson, angka, rupiah, tanggalPendek, arah } from './data'
import { Hero, Blok, Pil, Keadaan } from './ui'
import { KakiBaru } from './KakiBaru'
import { LABEL_KELOMPOK, type KelompokBroker } from '../../lib/dasbor/kelompokBroker'

interface SektorArus {
  n_emiten: number
  nilai: number
  porsi_nilai_pct: number
  net: Partial<Record<KelompokBroker, number>>
}
interface RentangArus {
  mulai: string
  akhir: string
  n_hari: number
  total: Partial<Record<KelompokBroker, number>>
  sektor: Record<string, SektorArus>
}
interface PetaArus {
  tanggal: string
  n_emiten: number
  kelompok: KelompokBroker[]
  rentang: Partial<Record<'h1' | 'h5' | 'h20', RentangArus>>
}

type SlugRentang = 'h1' | 'h5' | 'h20'
const LABEL_RENTANG: Record<SlugRentang, string> = { h1: '1 hari', h5: '5 hari', h20: '20 hari' }
const KELOMPOK_PIL: KelompokBroker[] = ['asing', 'bumn', 'smart', 'ritel']

/** Baris arus satu kelompok: label + bar relatif + nilai bertanda. */
function BarisKelompok({ label, nilai, lebar, nada }: { label: string; nilai: string; lebar: number; nada: 'naik' | 'turun' | 'datar' }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(84px, 130px) minmax(0, 1fr) auto', gap: 10, alignItems: 'center' }}>
      <span style={{ fontSize: 13 }}>{label}</span>
      <span style={{ height: 10, borderRadius: 999, background: 'var(--bb-garis)', overflow: 'hidden', minWidth: 40 }}>
        <span style={{ display: 'block', width: `${lebar}%`, height: '100%', background: nada === 'naik' ? 'var(--bb-naik)' : nada === 'turun' ? 'var(--bb-turun)' : 'var(--bb-redup)' }} />
      </span>
      <span className={`bb-mono ${nada}`} style={{ fontSize: 13, textAlign: 'right' }}>{nilai}</span>
    </div>
  )
}

export default function LayarPasar() {
  const { data, galat } = useJson<PetaArus>('/data-idx/json/peta_arus.json')
  const [rentang, setRentang] = useState<SlugRentang>('h1')
  const [kelompok, setKelompok] = useState<KelompokBroker>('asing')

  if (!data) return <Keadaan galat={galat} />
  const r = data.rentang[rentang]
  if (!r) return <Keadaan kosong={`Data rentang ${LABEL_RENTANG[rentang].toLowerCase()} belum tersedia.`} />

  const sektor = Object.entries(r.sektor)
    .map(([nama, s]) => ({ nama, ...s, net: s.net[kelompok] ?? 0 }))
    .sort((a, b) => b.porsi_nilai_pct - a.porsi_nilai_pct)

  // Afiliasi grup belum punya anggota tetap di kurasi -> selalu 0; tak ditampilkan.
  const totalBar = data.kelompok.filter((k) => k !== 'afiliasi')
    .map((k) => ({ k, nilai: r.total[k] ?? 0 }))
    .sort((a, b) => Math.abs(b.nilai) - Math.abs(a.nilai))
  const terbesarTotal = Math.max(1, ...totalBar.map((t) => Math.abs(t.nilai)))
  const terbesarPorsi = Math.max(1, ...sektor.map((s) => s.porsi_nilai_pct))

  const netTerpilih = r.total[kelompok] ?? 0

  return (
    <div className="bb-isi">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
        <Hero
          label={`Net broker ${LABEL_KELOMPOK[kelompok]} · ${LABEL_RENTANG[rentang]} bursa`}
          angka={rupiah(netTerpilih)}
          nada={arah(netTerpilih)}
          sub={`${tanggalPendek(r.mulai)} – ${tanggalPendek(r.akhir)} · ${r.n_hari} hari bursa`}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
          <div className="bb-pils" role="group" aria-label="Kelompok broker">
            {KELOMPOK_PIL.map((k) => (
              <Pil key={k} aktif={kelompok === k} onClick={() => setKelompok(k)}>{LABEL_KELOMPOK[k]}</Pil>
            ))}
          </div>
          <div className="bb-pils" role="group" aria-label="Rentang">
            {(['h1', 'h5', 'h20'] as SlugRentang[]).map((s) => (
              <Pil key={s} aktif={rentang === s} onClick={() => setRentang(s)}>{LABEL_RENTANG[s]}</Pil>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        <div style={{ flex: '3 1 480px', minWidth: 0 }}>
          <Blok judul="Sektor · berbobot nilai transaksi" catatan={`net ${LABEL_KELOMPOK[kelompok]} per sektor`}>
            <div className="bb-kartu-grid">
              {sektor.map((s) => (
                <div key={s.nama} className="bb-kartu" style={{ borderColor: arah(s.net) === 'naik' ? 'var(--bb-naik)' : arah(s.net) === 'turun' ? 'var(--bb-turun)' : undefined }}>
                  <span className="bb-label">{s.nama} · {angka(s.porsi_nilai_pct, 1)}% nilai transaksi</span>
                  <span style={{ height: 6, borderRadius: 999, background: 'var(--bb-garis)', overflow: 'hidden', display: 'block' }}>
                    <span style={{ display: 'block', width: `${(s.porsi_nilai_pct / terbesarPorsi) * 100}%`, height: '100%', background: 'var(--bb-biru)' }} />
                  </span>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--bb-redup)' }}>{s.n_emiten} emiten</span>
                    <span className={`bb-mono ${arah(s.net)}`} style={{ fontSize: 16 }}>{rupiah(s.net)}</span>
                  </div>
                </div>
              ))}
            </div>
            {sektor.length === 0 && <Keadaan kosong="Belum ada sektor tercatat pada rentang ini." />}
          </Blok>
        </div>

        <aside style={{ flex: '1 1 300px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Blok label="Arus per kelompok broker" kelas="panel">
            <div className="bb-daftar">
              {totalBar.map((t) => (
                <BarisKelompok key={t.k} label={LABEL_KELOMPOK[t.k]} nilai={rupiah(t.nilai)} lebar={(Math.abs(t.nilai) / terbesarTotal) * 100} nada={arah(t.nilai)} />
              ))}
            </div>
          </Blok>
          <Blok kelas="panel" narasi={`Kelompok = identitas broker perantara, bukan kebangsaan atau jenis investor. Mencakup ${angka(data.n_emiten)} emiten dengan data broker per ${tanggalPendek(data.tanggal)}.`} />
        </aside>
      </div>

      <KakiBaru sumber="Arus dihitung dari arsip broker harian resmi bursa, dikelompokkan menurut kurasi identitas broker." />
    </div>
  )
}
