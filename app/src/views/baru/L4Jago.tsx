import { useJson, angka, bertanda, rupiah, tanggalPendek } from './data'
import { Hero, Blok, BarisBatang, Keadaan, Arah } from './ui'
import { KakiBaru } from './KakiBaru'
import { ruteLapisan, EMITEN_BAWAAN } from './peta'

interface PresetTuntas { preset: string; n: number; menang: number; kalah: number; gantung: number; tak_masuk: number }
interface TanggalJejak {
  tanggal: string
  n: number
  menang: number
  kalah: number
  gantung: number
  tak_masuk: number
  menangDariTuntas: number | null
  preset: PresetTuntas[]
}
interface NilaiJejak { horizon: number; hariBursaTerakhir: string; perTanggal: TanggalJejak[] }

interface JagoEmiten {
  kode: string
  harga: number
  chg_1d: number
  value: number
  net_asing_streak: number | null
  tembus_ma20_hari_ini: boolean
}
interface JagoPapan { tanggal: string; n: number; emiten: JagoEmiten[] }

interface WinrateStat { menang: number; kalah: number; gantung: number; n: number; winRate: number | null; ekspektansi: number | null }
interface WinrateData { horizon: Record<string, { n120: WinrateStat }>; saringan: { h20: Record<string, WinrateStat> } }

const LABEL_PRESET: Record<string, string> = {
  scalping: 'Scalping',
  swing: 'Swing',
  'whale-tiket': 'Whale-tiket',
  'whale-akdis': 'Whale-akdis',
  'whale-asing': 'Whale-asing',
}

/** "2026-08-24" -> "24 Agu" (tanpa tahun, buat label sumbu yang sempit). */
function tanggalSingkat(iso: string): string {
  return tanggalPendek(iso).replace(/ \d{4}$/, '')
}

const TINGGI_BATANG = 64

export default function L4Jago() {
  const { data: nj, galat: gNj } = useJson<NilaiJejak>('/data-idx/json/nilai_jejak.json')
  const { data: jp, galat: gJp } = useJson<JagoPapan>('/data-idx/json/jago_papan/terbaru.json')
  const { data: wr, galat: gWr } = useJson<WinrateData>(`/data-idx/json/winrate/${EMITEN_BAWAAN}.json`)

  const galat = gNj ?? gJp ?? gWr
  const kaki = `Kohort dari hakim jejak otomatis, dikunci saat terbit dan dinilai H+${nj?.horizon ?? 5}. Win rate ${EMITEN_BAWAAN} dari sinyal historis per horizon.`
  if (galat) return <div className="bb-isi"><Keadaan galat={galat} /><KakiBaru sumber={kaki} /></div>
  if (!nj || !jp || !wr) return <div className="bb-isi"><Keadaan /></div>

  const perTanggal = nj.perTanggal
  const tuntas = perTanggal.filter((r) => r.menangDariTuntas !== null)
  const tr = tuntas[tuntas.length - 1] ?? null
  const maxN = Math.max(1, ...perTanggal.map((r) => r.n))

  // Agregat preset lintas tanggal tuntas: % menang dihitung dari menang+kalah,
  // bukan rata-rata harian — supaya tanggal ber-n kecil tak menyeret angkanya.
  const aggPreset = new Map<string, { menang: number; kalah: number; tak_masuk: number; n: number }>()
  for (const r of tuntas) {
    for (const p of r.preset) {
      const a = aggPreset.get(p.preset) ?? { menang: 0, kalah: 0, tak_masuk: 0, n: 0 }
      a.menang += p.menang; a.kalah += p.kalah; a.tak_masuk += p.tak_masuk; a.n += p.n
      aggPreset.set(p.preset, a)
    }
  }
  const presetRanked = [...aggPreset.entries()].map(([preset, a]) => {
    const mk = a.menang + a.kalah
    return { preset, winRate: mk > 0 ? (a.menang / mk) * 100 : null, tak: a.n > 0 ? (a.tak_masuk / a.n) * 100 : null }
  }).sort((a, b) => (b.winRate ?? -1) - (a.winRate ?? -1))
  const presetTakSering = [...presetRanked].sort((a, b) => (b.tak ?? -1) - (a.tak ?? -1))[0]

  const streakList = jp.emiten
    .filter((e): e is JagoEmiten & { net_asing_streak: number } => (e.net_asing_streak ?? 0) > 0)
    .sort((a, b) => b.net_asing_streak - a.net_asing_streak)
    .slice(0, 8)
  const maxStreak = streakList[0]?.net_asing_streak ?? 1
  const turunDariStreak = streakList.filter((e) => e.chg_1d < 0).length

  const tembusList = jp.emiten.filter((e) => e.tembus_ma20_hari_ini)
  const tembusContoh = [...tembusList].sort((a, b) => a.kode.localeCompare(b.kode)).slice(0, 5)

  const h5 = wr.horizon.h5?.n120
  const h20 = wr.horizon.h20?.n120
  const h60 = wr.horizon.h60?.n120
  const saringanTop = Object.entries(wr.saringan.h20 ?? {})
    .filter(([, v]) => v.n >= 30)
    .sort((a, b) => (b[1].winRate ?? -1) - (a[1].winRate ?? -1))
    .slice(0, 3)
  const saringanMenangTapiRugi = saringanTop.filter(([, v]) => (v.winRate ?? 0) > 50 && (v.ekspektansi ?? 0) < 0).length

  return (
    <div className="bb-isi">
      <div className="bb-dua">
        <Hero
          label={`Win rate kohort tuntas terbaru · ${tr ? tanggalPendek(tr.tanggal) : '–'}`}
          angka={tr ? `${angka(tr.menangDariTuntas, 1)}%` : '–'}
          sub={tr && (
            <span>n={tr.n} · menang {tr.menang} · kalah {tr.kalah} · gantung {tr.gantung} · tak masuk {tr.tak_masuk}</span>
          )}
        />
        {tr && (
          <Blok label={`Sebaran sinyal · ${tr.n} total`}
            narasi={`Dari ${tr.n} sinyal terkunci ${tanggalPendek(tr.tanggal)}, ${tr.menang + tr.kalah} sudah tuntas dinilai H+${nj.horizon}; sisanya ${tr.gantung} masih gantung. Dari yang tuntas, ${angka(tr.menangDariTuntas, 1)}% menang.`}>
            <div style={{ display: 'flex', height: 16, borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: `${(tr.menang / tr.n) * 100}%`, background: 'var(--bb-naik)' }} />
              <div style={{ width: `${(tr.kalah / tr.n) * 100}%`, background: 'var(--bb-turun)' }} />
              <div style={{ width: `${(tr.gantung / tr.n) * 100}%`, background: '#5B6486' }} />
              <div style={{ width: `${(tr.tak_masuk / tr.n) * 100}%`, background: '#262B3D' }} />
            </div>
            <div className="bb-mono teks-11" style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--bb-redup)' }}>
              <span>menang {tr.menang}</span><span>kalah {tr.kalah}</span><span>gantung {tr.gantung}</span><span>tak masuk {tr.tak_masuk}</span>
            </div>
          </Blok>
        )}
      </div>

      <Blok label={`${perTanggal.length} kohort harian, dari terkunci sampai tuntas`}
        catatan="hijau menang · merah kalah · abu gantung · gelap tak masuk"
        narasi="Kohort terkunci: daftar dibekukan saat terbit, dinilai H+5. Tanggal termuda paling banyak gelap/abu — belum sempat tuntas.">
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
          {perTanggal.map((r, i) => {
            const totalH = TINGGI_BATANG * (r.n / maxN)
            const hMenang = totalH * (r.menang / r.n)
            const hKalah = totalH * (r.kalah / r.n)
            const hGantung = totalH * (r.gantung / r.n)
            const hTak = totalH * (r.tak_masuk / r.n)
            const label = i % 5 === 0 || i === perTanggal.length - 1 ? tanggalSingkat(r.tanggal) : ''
            return (
              <div key={r.tanggal} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div title={`${r.tanggal} n=${r.n}`} style={{ width: '100%', display: 'flex', flexDirection: 'column-reverse', height: TINGGI_BATANG, borderRadius: 2, overflow: 'hidden', background: 'var(--bb-garis)' }}>
                  <div style={{ width: '100%', height: hTak, background: '#262B3D' }} />
                  <div style={{ width: '100%', height: hGantung, background: '#5B6486' }} />
                  <div style={{ width: '100%', height: hKalah, background: 'var(--bb-turun)' }} />
                  <div style={{ width: '100%', height: hMenang, background: 'var(--bb-naik)' }} />
                </div>
                <span className="teks-10" style={{ color: 'var(--bb-redup)', height: 12, whiteSpace: 'nowrap' }}>{label}</span>
              </div>
            )
          })}
        </div>
      </Blok>

      <div className="bb-tiga">
        <Blok label="Preset mana yang paling terbukti" catatan={`agregat ${tuntas.length} tanggal tuntas`}
          narasi={presetRanked[0] && presetTakSering ? `${LABEL_PRESET[presetRanked[0].preset] ?? presetRanked[0].preset} paling terbukti (${angka(presetRanked[0].winRate, 1)}% menang dari yang tuntas); ${LABEL_PRESET[presetTakSering.preset] ?? presetTakSering.preset} paling sering tak masuk (${angka(presetTakSering.tak, 1)}%).` : undefined}>
          <div className="bb-daftar">
            {presetRanked.map((p) => (
              <BarisBatang key={p.preset} kode={LABEL_PRESET[p.preset] ?? p.preset} lebar={p.winRate ?? 0}
                nilai={<span className="bb-mono">{angka(p.winRate, 1)}% <span style={{ color: 'var(--bb-redup)' }}>tak {angka(p.tak, 1)}%</span></span>} />
            ))}
          </div>
        </Blok>

        <Blok label="Net asing beruntun terpanjang" catatan="hari ini">
          <div className="bb-daftar">
            {streakList.map((e) => (
              <BarisBatang key={e.kode} ke={ruteLapisan('harga', e.kode)} kode={e.kode}
                lebar={(e.net_asing_streak / maxStreak) * 100}
                nilai={<span className="bb-mono">{e.net_asing_streak}h · <Arah v={e.chg_1d}>{bertanda(e.chg_1d)}%</Arah> · {rupiah(e.value)}</span>} />
            ))}
          </div>
          <p className="bb-narasi">Tembus MA20 hari ini · {tembusList.length} emiten. Contoh: {tembusContoh.map((e) => `${e.kode} ${bertanda(e.chg_1d)}%`).join(' · ')}.</p>
          {streakList.length > 0 && (
            <p className="bb-narasi">{turunDariStreak} dari {streakList.length} saham beruntun justru turun harga hari ini — arus asing mendahului harga, bukan konfirmasi.</p>
          )}
        </Blok>

        <Blok label={`${EMITEN_BAWAAN}: menang sering, untung belum tentu`} catatan="per horizon, sinyal historis terakhir">
          <div className="bb-daftar">
            {h5 && <BarisBatang kode="H+5" lebar={h5.winRate ?? 0} nilai={<span className="bb-mono"><Arah v={h5.ekspektansi}>{bertanda(h5.ekspektansi, 3)}%</Arah> · n{h5.n}</span>} nama={`${angka(h5.winRate, 1)}%`} />}
            {h20 && <BarisBatang kode="H+20" lebar={h20.winRate ?? 0} nilai={<span className="bb-mono"><Arah v={h20.ekspektansi}>{bertanda(h20.ekspektansi, 3)}%</Arah> · n{h20.n}</span>} nama={`${angka(h20.winRate, 1)}%`} />}
            {h60 && <BarisBatang kode="H+60" lebar={h60.winRate ?? 0} nilai={<span className="bb-mono"><Arah v={h60.ekspektansi}>{bertanda(h60.ekspektansi, 3)}%</Arah> · n{h60.n}</span>} nama={`${angka(h60.winRate, 1)}%`} />}
          </div>
          <p className="bb-label" style={{ marginTop: 6 }}>Saringan h20 terbaik · n≥30</p>
          <div className="bb-daftar">
            {saringanTop.map(([nama, v]) => (
              <BarisBatang key={nama} kode={nama} lebar={v.winRate ?? 0} nilai={<span className="bb-mono">{angka(v.winRate, 1)}% <Arah v={v.ekspektansi}>{bertanda(v.ekspektansi, 3)}%</Arah></span>} />
            ))}
          </div>
          {h5 && (
            <p className="bb-narasi">
              H+5 menang {angka(h5.winRate, 1)}% dengan ekspektansi {bertanda(h5.ekspektansi, 3)}% — {(h5.ekspektansi ?? 0) < 0 ? 'kerugian rata-rata lebih besar dari kemenangan' : 'ekspektansi tetap positif'}.
              {' '}{saringanMenangTapiRugi} dari {saringanTop.length} saringan h20 di atas menang lebih dari separuh kali namun ekspektansinya tetap negatif.
            </p>
          )}
        </Blok>
      </div>

      <KakiBaru sumber={kaki} />
    </div>
  )
}
