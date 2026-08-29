/**
 * Berkas Emiten — satu kode, semua yang PAPAN tahu tentang emiten itu.
 *
 * Asal (Johan, 28 Agu 2026): *"ada page khusus buat superadmin dimana hanya
 * memangil 1 emiten saja muncul semua data terkait emiten tersebut … apapun
 * itu"*. Rancangan penuh delapan blok ada di artifact "Berkas Emiten";
 * halaman ini memulai dengan **blok A — rezim pasar**, yang dipilih Johan
 * lebih dulu karena menjawab pertanyaan intinya ("potensi dia naik atau turun
 * di saat market bearish or bullish") dan seluruh bahannya sudah tersimpan.
 *
 * Tingkat akses `superadmin` (terdaftar di PETA_MENU_KUNCI DAN di tabel
 * `akses_halaman` pada hari yang sama — aturan dua tempat).
 */
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { StockAutocomplete } from '../../components/dasbor/StockAutocomplete'
import { CatatanCakupan } from '../../components/dasbor/CatatanCakupan'
import { InfoIndikator, type ItemInfoIndikator } from '../../components/dasbor/InfoIndikator'
import { useStockIndex } from '../../lib/dasbor/stockDetailData'
import { useBrokerTahunan } from '../../lib/dasbor/brokerTahunanData'
import { ringkasPemegang, bacaKonsentrasi } from '../../lib/dasbor/berkasPemegang'
import { ringkasAsing, bacaAliran, bacaPorsi } from '../../lib/dasbor/berkasAsing'
import { ringkasLikuid, labelLikuiditas } from '../../lib/dasbor/berkasLikuiditas'
import { susunBendera, TANPA_BENDERA, type Bendera, type BahanBendera } from '../../lib/dasbor/berkasBendera'
import { useKartu } from '../../lib/dasbor/kartuAnalisa'
import { susunRasio, muatRasio, NAMA_CADANGAN } from '../../lib/dasbor/berkasRasio'
import {
  muatRekam, muatRekomendasi, muatProb, layakSinyal, MIN_SAMPEL_PERSEN,
  type RekamStrategi, type RekomendasiEmiten, type ProbEmiten, type EvaluasiProb,
} from '../../lib/dasbor/berkasRekam'
import { muatCandle, type DataCandle } from '../../lib/dasbor/candleStockbit'
import { fetchAsing, type AsingData } from '../../lib/dasbor/stockDetailData'
import { LABEL_KELOMPOK, KETERANGAN_KELOMPOK, warnaBrokerCanvas, namaBroker } from '../../lib/dasbor/kelompokBroker'
import {
  ARTI_WATAK, bacaHariMerah, muatRezim, tahunTerbaru,
  type BerkasRezim, type RezimEmiten,
} from '../../lib/dasbor/rezimPasar'
import './BerkasEmiten.css'

const INFO: ItemInfoIndikator[] = [
  {
    nama: 'Tangkap saat naik / saat turun',
    isi: 'Rata-rata gerak emiten dibagi rata-rata gerak IHSG, dihitung terpisah untuk hari-hari IHSG naik dan hari-hari IHSG turun. 1,45× saat naik berarti: ketika IHSG naik 1%, emiten ini rata-rata naik 1,45%.',
  },
  {
    nama: 'Asimetri',
    isi: 'Tangkap saat naik dibagi tangkap saat turun. Di atas 1 berarti ikut naik lebih kencang daripada ikut jatuh — condong menguntungkan. Di bawah 1 kebalikannya.',
  },
  {
    nama: 'Empat watak',
    isi: 'Ideal = ikut naik, tahan jatuh. Pengungkit = kencang dua arah. Defensif = pelan di kedua arah. Perangkap = tak ikut naik tapi ikut jatuh. Label ini ringkasan; angkanya yang berlaku.',
  },
  {
    nama: 'Kenapa per tahun ikut ditampilkan',
    isi: 'Watak berubah. Ada emiten yang bertahun-tahun jadi perangkap lalu berbalik, dan angka seumur hidup menyembunyikan pembalikan itu sepenuhnya.',
  },
  {
    nama: 'Hari paling merah',
    isi: 'Rata-rata ribuan hari tak menjanjikan satu hari pun. Lima hari terburuk IHSG ditampilkan apa adanya supaya perilaku saat panik terlihat, bukan terhapus rata-rata.',
  },
  {
    nama: 'Ini bukan ramalan',
    isi: 'Semua angka di sini frekuensi historis. Perilaku bisa berubah persis setelah halaman ini dibaca — terutama setelah aksi korporasi atau pergantian pengendali.',
  },
]

/** Skala kuadran: 0–2× dipetakan ke 0–100%, di atas 2 dijepit ke tepi. */
function posisi(v: number | null): number | null {
  if (v == null) return null
  return Math.max(2, Math.min(98, (v / 2) * 100))
}

function fmtX(v: number | null): string {
  return v == null ? '—' : `${v.toFixed(2).replace('.', ',')}×`
}

export default function BerkasEmiten() {
  const [params, setParams] = useSearchParams()
  const kode = (params.get('kode') || 'BBRI').toUpperCase()
  const [ketik, setKetik] = useState(kode)
  const { index: indeks } = useStockIndex()
  const [berkas, setBerkas] = useState<BerkasRezim | null>(null)
  const [muat, setMuat] = useState(true)

  useEffect(() => { setKetik(kode) }, [kode])
  useEffect(() => {
    let batal = false
    muatRezim().then((d) => { if (!batal) { setBerkas(d); setMuat(false) } })
    return () => { batal = true }
  }, [])

  const r: RezimEmiten | null = berkas?.emiten?.[kode] ?? null

  /** Titik semua emiten untuk latar kuadran — dihitung sekali per berkas,
   *  bukan per render: 962 titik × tiap ketikan akan terasa. */
  const awan = useMemo(() => {
    if (!berkas) return []
    return Object.values(berkas.emiten)
      .map((v) => ({ x: posisi(v.tangkap_turun), y: posisi(v.tangkap_naik) }))
      .filter((p): p is { x: number; y: number } => p.x != null && p.y != null)
  }, [berkas])

  // Blok B — arsip broker emiten ini (hook yang sama dipakai Whales Papan,
  // jadi berkasnya tersinggah bersama, bukan diunduh dua kali).
  const { hari: hariBroker, muat: muatBroker } = useBrokerTahunan(kode)
  const pemegang = useMemo(() => ringkasPemegang(hariBroker, 20), [hariBroker])

  // Blok C — aliran asing. `fetchAsing` memakai cache modul yang sama dengan
  // halaman Bedah, jadi emiten yang sudah dibuka di sana tak diambil dua kali.
  const [asing, setAsing] = useState<AsingData | null>(null)
  const [muatAsing, setMuatAsing] = useState(true)
  useEffect(() => {
    let batal = false
    setMuatAsing(true)
    fetchAsing(kode).then((d) => { if (!batal) { setAsing(d); setMuatAsing(false) } })
    return () => { batal = true }
  }, [kode])
  const aliran = useMemo(() => ringkasAsing(asing?.d ?? [], 20), [asing])

  // Blok D — likuiditas. Candle dipakai untuk volume & harga beku; lot nego
  // dari arsip broker yang SUDAH dimuat blok B (nol fetch tambahan).
  const [candle, setCandle] = useState<DataCandle>({ lilin: [], volume: [] })
  useEffect(() => {
    let batal = false
    muatCandle(kode).then((d) => { if (!batal) setCandle(d) })
    return () => { batal = true }
  }, [kode])

  // Blok G — bendera risiko. Enam dari tujuh bendera dirakit dari yang SUDAH
  // dimuat blok A–D; yang benar-benar baru cuma kartu analisa (penanda
  // kualitas) — dan hook-nya sama dengan yang dipakai halaman Kartu, jadi
  // berkasnya tersinggah bersama. Blok yang paling berhak tampil duluan tak
  // boleh jadi blok yang paling lambat muncul.
  const { data: kartu } = useKartu(kode)

  // Notasi khusus bursa & status aktivitas tidak wajar — bendera paling
  // berbobot di blok G karena datang dari OTORITAS, bukan dari hitungan kita.
  // Sempat tak tersambung sama sekali: modulnya siap sejak awal, sumbernya
  // tak pernah dimuat, jadi dua dari tujuh bendera diam selamanya tanpa satu
  // pun galat.
  const [infoBursa, setInfoBursa] = useState<{ notation?: unknown[]; uma?: boolean } | null>(null)
  useEffect(() => {
    let batal = false
    setInfoBursa(null)
    fetch(`/data-idx/json/info_stockbit/${kode.toUpperCase()}.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!batal) setInfoBursa(d) })
      .catch(() => {})
    return () => { batal = true }
  }, [kode])

  const likuid = useMemo(() => {
    const negoPer = new Map(hariBroker.map((h) => [h.tanggal, h]))
    const baris = candle.lilin.map((c, i) => {
      const tgl = String(c.time)
      const hb = negoPer.get(tgl)
      return {
        tanggal: tgl,
        volume: Number(candle.volume[i]?.value ?? 0),
        close: c.close,
        regulerLot: hb?.totalLot,
        negoLot: hb?.negoLot,
      }
    })
    return ringkasLikuid(baris, 60)
  }, [candle, hariBroker])
  // Blok F — 94 rasio fundamental + tangga harga. Pemuat keystats yang sama
  // dipakai Stock Detail, jadi emiten yang sudah dibuka di sana tak diambil
  // dua kali. Tangga harga (MA/support/resistance) datang dari kartu yang
  // SUDAH dimuat blok G — nol fetch tambahan.
  const [rasioMentah, setRasioMentah] = useState<Record<string, unknown> | null>(null)
  const [rasioCadangan, setRasioCadangan] = useState<Record<string, unknown> | null>(null)
  useEffect(() => {
    let batal = false
    setRasioMentah(null); setRasioCadangan(null)
    muatRasio(kode).then((d) => { if (!batal) setRasioMentah(d) })
    // Sumber cadangan — dipakai HANYA untuk tiga ruas yang terukur setara
    // (lihat TAMBALAN di berkasRasio.ts), dan hasilnya selalu ditandai.
    fetch(`/data-idx/json/fundamental/${kode.toUpperCase()}.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!batal) setRasioCadangan(d) })
      .catch(() => {})
    return () => { batal = true }
  }, [kode])
  const rasio = useMemo(
    () => susunRasio(rasioMentah, rasioCadangan),
    [rasioMentah, rasioCadangan],
  )

  // Blok E — rekam jejak. Bukan ramalan: frekuensi historis strategi PAPAN
  // pada emiten INI, lengkap dengan kalahnya.
  const [rekam, setRekam] = useState<RekamStrategi[]>([])
  const [rekomendasi, setRekomendasi] = useState<RekomendasiEmiten[]>([])
  useEffect(() => {
    let batal = false
    setRekam([]); setRekomendasi([])
    muatRekam(kode).then((d) => { if (!batal) setRekam(d) })
    muatRekomendasi(kode).then((d) => { if (!batal) setRekomendasi(d) })
    return () => { batal = true }
  }, [kode])
  const rekamAda = useMemo(() => rekam.filter((x) => x.n > 0), [rekam])

  // Probabilitas berdiri sendiri untuk SETIAP emiten, tak lagi menumpang
  // Deep Dive (Johan 29 Agu: "biarkan dia berdiri disana sendiri").
  const [prob, setProb] = useState<ProbEmiten | null>(null)
  const [evaluasiProb, setEvaluasiProb] = useState<EvaluasiProb | null>(null)
  useEffect(() => {
    let batal = false
    setProb(null)
    muatProb(kode).then((d) => {
      if (batal) return
      setProb(d.prob)
      setEvaluasiProb(d.evaluasi)
    })
    return () => { batal = true }
  }, [kode])

  const labelLik = labelLikuiditas(likuid)

  const bendera: Bendera[] = useMemo(() => susunBendera({
    riwayat: kartu?.kualitas?.riwayat ?? null,
    likuiditas: labelLik === 'tidur' ? 'tidur' : kartu?.kualitas?.likuiditas ?? null,
    nLilin: kartu?.n ?? null,
    // `hariBeku` di blok D menghitung hari yang BERTRANSAKSI tapi harganya
    // tak bergerak; yang dicari bendera ini hari TANPA transaksi sama sekali.
    // Dua hal berbeda yang gampang tertukar karena namanya mirip.
    bekuHari: likuid.hariSepi || null,
    konsentrasi3: pemegang.konsentrasi3,
    porsiNego: likuid.porsiNego,
    notasi: (infoBursa?.notation ?? []) as BahanBendera['notasi'],
    uma: infoBursa?.uma ?? null,
  }), [kartu, labelLik, likuid, pemegang, infoBursa])

  const tahun = r ? tahunTerbaru(r) : []
  const maksTahun = Math.max(1, ...tahun.map((t) => Math.abs(t[1].tangkap_naik)))

  return (
    <div className="lantai be">
      <div className="bilah-kendali">
        <div className="grup-k">
          <div className="be-cari">
            <StockAutocomplete
              stocks={indeks?.stocks || []}
              value={ketik}
              onChange={setKetik}
              onSelect={(v) => { setKetik(v); setParams({ kode: v.toUpperCase() }) }}
              placeholder="Cari emiten: BUMI, BBCA…"
            />
          </div>
        </div>
        <div className="grup-k">
          <span className="grup-lbl">Acuan</span>
          <span className="be-statis">IHSG</span>
        </div>
        <div className="grup-kanan">
          <InfoIndikator judul={`Berkas Emiten · ${kode}`} item={INFO} />
        </div>
      </div>

      <div className="vhead">
        <h1>Berkas Emiten</h1>
        <span className="sub">{kode} — semua yang PAPAN tahu tentang satu emiten</span>
        <CatatanCakupan inline />
      </div>

      {/* BLOK G — di ATAS, bukan di urutan hurufnya. Letak itu bagian dari
          isinya: penanda kualitas yang sama sudah ada di Kartu Analisa, tapi
          di sana ia catatan kaki — pembaca sudah selesai menyimpulkan sebelum
          sampai ke situ. Di sini ia mengubah cara membaca yang di bawahnya,
          jadi ia harus dibaca lebih dulu. */}
      <section className={`be-kartu be-bendera${bendera.length === 0 ? ' be-bendera-sepi' : ''}`}>
        <div className="be-kartu-kepala">
          <span className="be-blok be-blok-g">G</span>
          <div>
            <h2>Bendera risiko</h2>
            <p className="be-ket">
              Hal yang membuat angka di bawah patut diragukan — dibaca lebih dulu, bukan sesudahnya.
            </p>
          </div>
        </div>
        {bendera.length === 0 ? (
          <p className="be-bendera-kosong">{TANPA_BENDERA}</p>
        ) : (
          <ul className="be-bendera-daftar">
            {bendera.map((b) => (
              <li key={b.kode} className={`be-bendera-item bb-${b.bobot}`}>
                <b>{b.judul}</b>
                <span>{b.isi}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {muat && <div className="be-kosong">Memuat berkas…</div>}

      {!muat && !r && (
        <div className="be-kosong">
          Belum ada hitungan rezim untuk <b>{kode}</b>.
          {berkas ? ' Emiten ini mungkin belum punya riwayat harga yang cukup.' : ' Berkas rezim belum terbangun.'}
        </div>
      )}

      {r && (
        <section className="be-kartu">
          <div className="be-kartu-kepala">
            <span className="be-blok">A</span>
            <div>
              <h2>Rezim pasar — perilaku saat IHSG naik vs turun</h2>
              <p className="be-ket">
                Seluruh riwayat dibelah dua memakai arah IHSG hari itu, lalu diukur seberapa besar
                gerak emiten dibanding gerak pasar di masing-masing rezim.
              </p>
            </div>
          </div>

          {/* Label watak HANYA dirender bila lolos uji luar sampel
              (audit 28 Agu #2). Hasil hari ini: label BETA pun bertahan
              28,3% vs tebakan buta 33,0% -> label_tayang false, jadi cabang
              pertama ini praktis mati sampai metodenya membaik — dan itu
              disengaja: kategori yang kalah dari tebakan buta tak berhak
              tampil sebagai vonis berwarna. */}
          {berkas?.uji_luar_sampel?.label_tayang && r.watak ? (
            <div className={`be-vonis w-${r.watak}`}>
              <span className="be-cap">{ARTI_WATAK[r.watak].judul}</span>
              <p>
                {ARTI_WATAK[r.watak].kalimat}
                {r.batas_tipis && <> <b>Batas tipis</b> — baca angkanya, bukan labelnya.</>}
              </p>
            </div>
          ) : (
            <div className="be-vonis w-null">
              <span className="be-cap">Tanpa label</span>
              <p>
                {r.tangkap_naik == null
                  ? (r.alasan ?? 'Sampel tak cukup.')
                  : <>Empat kategori watak <b>sengaja tidak ditampilkan</b>: diuji pada periode sesudah {berkas?.uji_luar_sampel?.batas ?? '2023'},
                      label hanya bertahan {berkas?.uji_luar_sampel?.bertahan_pct ?? '—'}% — kalah dari menebak segala emiten sebagai
                      "{berkas?.uji_luar_sampel?.modus ?? 'sama'}" ({berkas?.uji_luar_sampel?.tebakan_buta_pct ?? '—'}%).
                      Dua angka di bawah tetap fakta historis; kategorinya yang tidak stabil.</>}
              </p>
            </div>
          )}

          {/* ALIRAN KOLOM, bukan dua kolom kaku.
              Dua pembungkus kolom membuat isi terkunci di sisinya: kiri
              berisi 403px sementara kanan 793px, jadi 389px di bawah kiri
              menganga (temuan Johan 29 Agu, dengan tangkapan layar). Empat
              blok yang mengalir mengisi rapat sendiri — sama seperti kartu
              rasio di blok F. */}
          <div className="be-utama">
            <div className="be-sub">
              <div className="be-duo">
                <div className="be-sisi naik">
                  <div className="be-lbl"><span>Saat IHSG naik</span><span className="be-n">{r.n_naik.toLocaleString('id-ID')} hari</span></div>
                  <div className="be-ang">{fmtX(r.tangkap_naik)}</div>
                  <div className="be-bar"><i style={{ width: `${Math.min(100, ((r.tangkap_naik ?? 0) / 2) * 100)}%` }} /><u /></div>
                  <p className="be-exp">IHSG naik 1% → emiten rata-rata bergerak <b>{fmtX(r.tangkap_naik)}</b> gerak pasar. Garis = pasar (1,00×).</p>
                </div>
                <div className="be-sisi turun">
                  <div className="be-lbl"><span>Saat IHSG turun</span><span className="be-n">{r.n_turun.toLocaleString('id-ID')} hari</span></div>
                  <div className="be-ang">{fmtX(r.tangkap_turun)}</div>
                  <div className="be-bar"><i style={{ width: `${Math.min(100, ((r.tangkap_turun ?? 0) / 2) * 100)}%` }} /><u /></div>
                  <p className="be-exp">IHSG turun 1% → emiten rata-rata ikut turun <b>{fmtX(r.tangkap_turun)}</b>. Makin kecil makin tahan.</p>
                  {r.porsi_nol != null && r.porsi_nol > 0.25 && (
                    <p className="be-exp be-peringat">Harga diam di {Math.round(r.porsi_nol * 100)}% hari perdagangan — angka rendah di sini bisa berarti <b>tidak responsif</b>, bukan tahan banting.</p>
                  )}
                </div>
              </div>

            </div>

            {r.hari_terburuk.length > 0 && (
              <div className="be-sub">
                  <h3>Hari paling merah dalam sejarah IHSG</h3>
                  <p className="be-ket">Rata-rata menyembunyikan hari panik. Ini apa adanya.</p>
                  <div className="be-gulir">
                    <table className="be-tabel">
                      <thead><tr><th>Tanggal</th><th>IHSG</th><th>{kode}</th><th>Selisih</th><th>Bacaan</th></tr></thead>
                      <tbody>
                        {r.hari_terburuk.map((h) => {
                          const selisih = h.emiten - h.ihsg
                          return (
                            <tr key={h.tanggal}>
                              <td>{h.tanggal}</td>
                              <td className="dn">{h.ihsg.toFixed(2).replace('.', ',')}%</td>
                              <td className={h.emiten < 0 ? 'dn' : 'up'}>{h.emiten.toFixed(2).replace('.', ',')}%</td>
                              <td className={selisih >= 0 ? 'up' : 'dn'}>{selisih > 0 ? '+' : ''}{selisih.toFixed(2).replace('.', ',')}</td>
                              <td className="be-kiri">{bacaHariMerah(h)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
              </div>
            )}

            {tahun.length > 0 && (
              <div className="be-sub">
                  <h3>Berubah menurut tahun</h3>
                  <p className="be-ket">Watak tidak tetap. Batang = tangkap saat naik; merah = tahun yang jatuhnya lebih kencang daripada naiknya.</p>
                  <div className="be-thn">
                    {[...tahun].reverse().map(([th, v]) => (
                      <i key={th}
                        className={v.tangkap_turun > v.tangkap_naik ? 'buruk' : ''}
                        style={{ height: `${Math.max(4, (Math.abs(v.tangkap_naik) / maksTahun) * 100)}%` }}
                        title={`${th}: naik ${fmtX(v.tangkap_naik)} · turun ${fmtX(v.tangkap_turun)}`} />
                    ))}
                  </div>
                  <div className="be-gulir">
                    <table className="be-tabel">
                      <thead><tr><th>Tahun</th><th>Naik</th><th>Turun</th><th>Hari</th></tr></thead>
                      <tbody>
                        {tahun.map(([th, v]) => (
                          <tr key={th} className={v.tangkap_turun > v.tangkap_naik ? 'be-buruk' : ''}>
                            <td>{th}</td>
                            <td>{fmtX(v.tangkap_naik)}</td>
                            <td>{fmtX(v.tangkap_turun)}</td>
                            <td className="be-n">{v.n_naik}/{v.n_turun}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
              </div>
            )}

            <div className="be-sub">
              <h3>Posisi di antara empat watak</h3>
              <p className="be-ket">Titik terang = {kode}. Titik redup = {awan.length} emiten lain.</p>
              <div className="be-kuad-bung">
                <div className="be-kuad">
                  <div className="be-zona z1"><span>Naik kencang</span><small>turun tertahan</small></div>
                  <div className="be-zona z2"><span>Naik kencang</span><small>turun kencang</small></div>
                  <div className="be-zona z3"><span>Naik pelan</span><small>turun tertahan</small></div>
                  <div className="be-zona z4"><span>Naik pelan</span><small>turun kencang</small></div>
                  <div className="be-salib h" /><div className="be-salib v" />
                  {awan.map((p, i) => (
                    <span className="be-jejak" key={i} style={{ left: `${p.x}%`, top: `${100 - p.y}%` }} />
                  ))}
                  {posisi(r.tangkap_turun) != null && posisi(r.tangkap_naik) != null && (
                    <span className="be-titik" data-kode={kode}
                      style={{ left: `${posisi(r.tangkap_turun)}%`, top: `${100 - (posisi(r.tangkap_naik) ?? 0)}%` }} />
                  )}
                  <span className="be-sumbu x">tangkap saat turun →</span>
                  <span className="be-sumbu y">tangkap saat naik →</span>
                </div>
              </div>

            </div>
          </div>

          <div className="be-batas">
            <b>Batas yang wajib dibaca</b>
            <ul>
              <li>Ini <b>frekuensi historis</b>, bukan ramalan. Perilaku bisa berubah persis setelah halaman ini dibaca.</li>
              <li>Rata-rata dari ribuan hari <b>tidak menjanjikan satu hari pun</b> — lihat tabel hari merah.</li>
              <li>Emiten yang harganya jarang bergerak terbaca <b>defensif</b> padahal sebenarnya tidak responsif.</li>
              <li>Hari tanpa transaksi, jeda sesudah suspensi panjang, dan bar rusak arsip (gerak &gt;300%) <b>dibuang</b> dari hitungan.</li>
              <li>Angka = <b>beta per rezim</b> (kovarian), bukan rasio rata-rata — rasio terbukti mengukur drift harga, bukan perilaku terhadap pasar.</li>
            </ul>
          </div>
        </section>
      )}

      {/* ── BLOK B · SIAPA MEMEGANG ────────────────────────────────────── */}
      <section className="be-kartu" style={{ marginTop: 14 }}>
        <div className="be-kartu-kepala">
          <span className="be-blok">B</span>
          <div>
            <h2>Siapa memegang — broker penampung &amp; pelepas</h2>
            <p className="be-ket">
              {pemegang.nHari > 0
                ? <>Dijumlahkan dari {pemegang.nHari} hari bursa terakhir yang arsipnya ada
                    ({pemegang.tglMulai} – {pemegang.tglAkhir}). Urutan menurut <b>net</b> (beli
                    dikurangi jual), bukan sibuknya.</>
                : muatBroker ? 'Memuat arsip broker…' : 'Arsip broker untuk emiten ini belum tersedia.'}
            </p>
          </div>
        </div>

        {pemegang.nHari > 0 && (
          <>
            <div className="be-ringkas-b">
              {bacaKonsentrasi(pemegang.konsentrasi3) && (
                <span className="be-pil">{bacaKonsentrasi(pemegang.konsentrasi3)}</span>
              )}
              {/* Porsi asing = porsi TRANSAKSI, bukan kebangsaan brokernya.
                  Kalimatnya dicetak di layar, bukan disembunyikan di tooltip. */}
              <span className="be-pil">
                {pemegang.porsiAsingTotal == null
                  ? 'Porsi asing: belum ada di arsip periode ini'
                  : `Porsi asing ${Math.round(pemegang.porsiAsingTotal * 100)}% dari lot beli`}
              </span>
            </div>

            <div className="be-duo-b">
              {([['Menampung', pemegang.penampung, 'plus'], ['Melepas', pemegang.pelepas, 'minus']] as const)
                .map(([judul, daftar, nada]) => (
                  <div key={judul}>
                    <h3>{judul}</h3>
                    {daftar.length === 0 && <p className="be-ket">tak ada</p>}
                    {daftar.slice(0, 8).map((b) => (
                      <div className="be-brow" key={b.kode}>
                        <span className="be-bk" style={{ color: warnaBrokerCanvas(b.kode) }}
                          title={`${namaBroker(b.kode)} · ${LABEL_KELOMPOK[b.kelompok]}`}>{b.kode}</span>
                        <span className={`be-bn wp-${nada}`}>
                          {Math.abs(b.netLot).toLocaleString('id-ID')} lot
                        </span>
                        <span className="be-ba">
                          {b.avgBeli ? `avg ${Math.round(b.avgBeli).toLocaleString('id-ID')}` : '—'}
                        </span>
                        <span className="be-bf">
                          {b.porsiAsing == null ? '' : `a ${Math.round(b.porsiAsing * 100)}%`}
                        </span>
                      </div>
                    ))}
                    {daftar.length > 8 && (
                      <div className="be-ket" style={{ marginTop: 4 }}>+{daftar.length - 8} broker lain</div>
                    )}
                  </div>
                ))}
            </div>

            <h3>Net per kelompok broker</h3>
            <p className="be-ket">Kelompok menjawab "broker ini jenis apa", bukan seberapa pintar.</p>
            <div className="be-kel">
              {pemegang.perKelompok.map((k) => (
                <div className="be-krow" key={k.kelompok} title={KETERANGAN_KELOMPOK[k.kelompok]}>
                  <span>{LABEL_KELOMPOK[k.kelompok]}</span>
                  <span className={k.netLot >= 0 ? 'wp-plus' : 'wp-minus'}>
                    {k.netLot >= 0 ? '+' : ''}{k.netLot.toLocaleString('id-ID')} lot
                  </span>
                </div>
              ))}
            </div>

            <div className="be-batas">
              <b>Batas blok ini</b>
              <ul>
                <li>Angka ini <b>GROSS harian</b> — data harian tak menyimpan sisi agresor, jadi tak ada "agresif" atau "pasif" di sini.</li>
                <li>Porsi asing mengukur <b>transaksinya</b>, bukan kebangsaan brokernya: satu broker melayani asing dan domestik sekaligus.</li>
                <li>Harga rata-rata adalah <b>jangkar</b>, bukan target — ia tak menjanjikan broker itu akan mempertahankannya.</li>
              </ul>
            </div>
          </>
        )}
      </section>

      {/* ── BLOK C · ALIRAN ASING ──────────────────────────────────────── */}
      <section className="be-kartu" style={{ marginTop: 14 }}>
        <div className="be-kartu-kepala">
          <span className="be-blok">C</span>
          <div>
            <h2>Aliran asing — menumpuk atau melepas</h2>
            <p className="be-ket">
              {aliran.nHari > 0
                ? <>{aliran.nHari} hari terakhir ({aliran.tglMulai} – {aliran.tglAkhir}).
                    Dihitung dalam <b>lembar</b> — bursa tidak melaporkan aliran asing dalam rupiah.</>
                : muatAsing ? 'Memuat aliran asing…' : 'Belum ada data aliran asing untuk emiten ini.'}
            </p>
          </div>
        </div>

        {aliran.nHari > 0 && (
          <>
            <div className="be-duo">
              <div className={`be-sisi ${aliran.netLembar >= 0 ? 'naik' : 'turun'}`}>
                <div className="be-lbl">
                  <span>Net {aliran.netLembar >= 0 ? 'masuk' : 'keluar'}</span>
                  <span className="be-n">{aliran.hariNetBeli}/{aliran.nHari} hari net beli</span>
                </div>
                <div className="be-ang">
                  {Math.abs(aliran.netLembar) >= 1e9
                    ? `${(Math.abs(aliran.netLembar) / 1e9).toFixed(2).replace('.', ',')} M`
                    : Math.abs(aliran.netLembar) >= 1e6
                      ? `${(Math.abs(aliran.netLembar) / 1e6).toFixed(1).replace('.', ',')} jt`
                      : Math.abs(aliran.netLembar).toLocaleString('id-ID')}
                </div>
                <p className="be-exp">lembar. {bacaPorsi(aliran) ?? 'Porsi terhadap volume tak terhitung.'}</p>
              </div>

              <div className={`be-sisi ${aliran.streak >= 0 ? 'naik' : 'turun'}`}>
                <div className="be-lbl"><span>Beruntun</span><span className="be-n">hari berturut</span></div>
                <div className="be-ang">{aliran.streak === 0 ? '—' : Math.abs(aliran.streak)}</div>
                <p className="be-exp">
                  {aliran.streak === 0
                    ? 'Hari terakhir netral — tak ada rangkaian berjalan.'
                    : `berturut-turut net ${aliran.streak > 0 ? 'beli' : 'jual'}. Rangkaian putus begitu arahnya berbalik atau netral.`}
                </p>
              </div>
            </div>

            {/* Sparkline net harian — tinggi batang relatif terhadap hari
                terbesar di jendela ini, jadi bentuknya terbaca walau skalanya
                beda jauh antar emiten. */}
            <h3>Net harian</h3>
            <div className="be-spark">
              {aliran.deret.map((v, i) => {
                const maks = Math.max(1, ...aliran.deret.map(Math.abs))
                const tinggi = Math.max(2, (Math.abs(v) / maks) * 100)
                return (
                  <i key={i}
                    className={v >= 0 ? 'plus' : 'minus'}
                    style={{ height: `${tinggi}%`, alignSelf: v >= 0 ? 'flex-end' : 'flex-start' }}
                    title={`${aliran.deret.length === 0 ? '' : ''}${v >= 0 ? '+' : ''}${v.toLocaleString('id-ID')} lembar`} />
                )
              })}
            </div>
            <p className="be-ket" style={{ marginTop: 6 }}>{bacaAliran(aliran)}</p>

            <div className="be-batas">
              <b>Batas blok ini</b>
              <ul>
                <li>Bursa <b>tidak melaporkan</b> aliran asing dalam rupiah — semua angka di sini <b>lembar</b>.</li>
                <li>Net lembar <b>tak boleh dikalikan harga rata-rata</b> jadi rupiah: galat taksiran begitu terukur miring dan menumpuk, bukan saling meniadakan.</li>
                <li>"Asing" di sini adalah <b>jenis investor pada transaksinya</b>, bukan kebangsaan pemilik saham.</li>
              </ul>
            </div>
          </>
        )}
      </section>

      {/* ── BLOK D · LIKUIDITAS ────────────────────────────────────────── */}
      <section className="be-kartu" style={{ marginTop: 14 }}>
        <div className="be-kartu-kepala">
          <span className="be-blok">D</span>
          <div>
            <h2>Likuiditas — seberapa ramai emiten ini</h2>
            <p className="be-ket">
              {likuid.nHari > 0
                ? <>{likuid.nHari} hari bursa terakhir. Baca ini dulu sebelum blok lain:
                    saham yang jarang ditransaksikan tetap menghasilkan angka yang kelihatan rapi,
                    padahal cuma dari segelintir hari.</>
                : 'Memuat riwayat harga…'}
            </p>
          </div>
        </div>

        {likuid.nHari > 0 && (
          <>
            {labelLik && (
              <div className={`be-vonis w-${labelLik === 'likuid' ? 'ideal' : labelLik === 'tipis' ? 'defensif' : 'perangkap'}`}>
                <span className="be-cap">{labelLik === 'likuid' ? 'Likuid' : labelLik === 'tipis' ? 'Tipis' : 'Tidur'}</span>
                <p>
                  {labelLik === 'likuid'
                    ? 'Ramai hampir tiap hari dan harganya bergerak. Angka di blok lain berdiri di atas dasar yang sehat.'
                    : labelLik === 'tipis'
                      ? 'Sering sepi atau harganya jalan di tempat. Baca angka blok lain dengan hati-hati.'
                      : 'Saham tidur — sebagian besar hari tak ada transaksi sama sekali. Angka apa pun tentang emiten ini rapuh.'}
                </p>
              </div>
            )}

            <div className="be-tiga">
              <div className="be-sisi">
                <div className="be-lbl"><span>Nihil transaksi</span><span className="be-n">dari {likuid.nHari}</span></div>
                <div className="be-ang" style={{ fontSize: 26 }}>{likuid.hariSepi}</div>
                <p className="be-exp">hari tanpa satu lot pun berpindah tangan.</p>
              </div>
              <div className="be-sisi">
                <div className="be-lbl"><span>Harga flat</span><span className="be-n">dari {likuid.nHari}</span></div>
                <div className="be-ang" style={{ fontSize: 26 }}>{likuid.hariBeku}</div>
                <p className="be-exp">ada transaksi, tapi harganya tak bergerak sepeser pun.</p>
              </div>
              <div className="be-sisi">
                <div className="be-lbl"><span>Volume harian</span><span className="be-n">median, hari ramai saja</span></div>
                <div className="be-ang" style={{ fontSize: 26 }}>
                  {likuid.medianVolume == null ? '—'
                    : likuid.medianVolume >= 1e6
                      ? `${(likuid.medianVolume / 1e6).toFixed(1).replace('.', ',')} jt`
                      : likuid.medianVolume.toLocaleString('id-ID')}
                </div>
                <p className="be-exp">
                  lembar. {likuid.porsiNego == null
                    ? 'Porsi negosiasi belum ada di arsip.'
                    : `Papan negosiasi ${Math.round(likuid.porsiNego * 100)}% dari lot.`}
                </p>
              </div>
            </div>

            {likuid.peringatan.length > 0 && (
              <div className="be-batas" style={{ marginTop: 14 }}>
                <b>Baca ini sebelum memakai angka di blok lain</b>
                <ul>{likuid.peringatan.map((x) => <li key={x}>{x}</li>)}</ul>
              </div>
            )}
          </>
        )}
      </section>

      {/* BLOK E — rekam jejak, bukan ramalan. Aturan yang ditegakkan modulnya
          dan bukan di sini: persentase cuma dicetak kalau sampelnya cukup.
          Rancangan menyebutnya sebagai satu kalimat — "3 dari 4 bukan 75%" —
          dan itulah seluruh isi keputusan desain blok ini. */}
      <section className="be-kartu">
        <div className="be-kartu-kepala">
          <span className="be-blok">E</span>
          <div>
            <h2>Probabilitas &amp; rekam jejak — dengan angka kejujurannya</h2>
            <p className="be-ket">
              Bukan ramalan. Seberapa sering strategi PAPAN benar di emiten ini menurut ujinya
              sendiri, lengkap dengan seberapa sering ia meleset.
            </p>
          </div>
        </div>

        {prob && (
          <div className="be-prob">
            <span className="be-lbl">Peluang menyentuh level esok</span>
            <div className="be-tangga-baris">
              {([['R1', prob.pR1, prob.jarak?.R1], ['R2', prob.pR2, prob.jarak?.R2],
                 ['S1', prob.pS1, prob.jarak?.S1]] as const).map(([nama, p, jarak]) => (
                <span key={nama} className="be-pil">
                  {nama}
                  <b className={nama === 'S1' ? 'dn' : 'up'}>
                    {p == null ? '—' : `${(p * 100).toFixed(0)}%`}
                  </b>
                  {/* Jaraknya WAJIB ikut. "80% capai R1" tak bisa dibaca tanpa
                      tahu R1 cuma +0,9% dari harga sekarang — angka tinggi di
                      level dekat bukan kabar baik, itu aritmetika. */}
                  {jarak != null && (
                    <span className="be-prob-jarak">
                      {nama === 'S1' ? '−' : '+'}{(Math.abs(jarak) * 100).toFixed(1)}%
                    </span>
                  )}
                </span>
              ))}
            </div>

            <div className="be-prob-naik">
              <span className="be-lbl">Peluang naik dalam 5 hari</span>
              <div className="be-tangga-baris">
                <span className="be-pil">
                  emiten ini<b>{prob.p5 == null ? '—' : `${(prob.p5 * 100).toFixed(1)}%`}</b>
                </span>
                {/* Angka dasar berdiri SEJAJAR, bukan di catatan kaki: itu
                    satu-satunya cara pembaca melihat bahwa selisihnya nyaris
                    nol tanpa harus menghitung sendiri. */}
                <span className="be-pil">
                  rata-rata pasar<b>{prob.base5 == null ? '—' : `${(prob.base5 * 100).toFixed(1)}%`}</b>
                </span>
                <span className="be-pil">
                  selisih
                  <b className={(prob.lift5 ?? 0) > 0 ? 'up' : (prob.lift5 ?? 0) < 0 ? 'dn' : ''}>
                    {prob.lift5 == null ? '—' : `${prob.lift5 > 0 ? '+' : ''}${prob.lift5.toFixed(2)} pp`}
                  </b>
                </span>
                {prob.n != null && (
                  <span className="be-pil">
                    dari<b>{prob.n.toLocaleString('id-ID')} hari serupa</b>
                  </span>
                )}
              </div>
            </div>

            {/* Hasil uji penaksirnya SENDIRI, dicetak apa adanya. Kalau ia
                tak mengalahkan tebakan dasar, halaman mengatakannya — bukan
                memajang angka meyakinkan sambil menyimpan hasil ujinya. */}
            {evaluasiProb && (
              <p className={`be-prob-uji${layakSinyal(evaluasiProb) ? '' : ' be-prob-gagal'}`}>
                {layakSinyal(evaluasiProb) ? (
                  <>
                    Diuji pada {evaluasiProb.n_uji} titik di luar sampel sejak{' '}
                    {evaluasiProb.mulai_uji}: penaksir ini <b>lebih baik</b> daripada sekadar
                    memakai rata-rata pasar.
                  </>
                ) : (
                  <>
                    <b>Baca peluang 5 hari itu sebagai konteks, bukan sinyal.</b> Diuji pada{' '}
                    {evaluasiProb.n_uji} titik di luar sampel sejak {evaluasiProb.mulai_uji},
                    penaksir ini <b>tidak</b> lebih baik daripada sekadar memakai rata-rata pasar.
                    Peluang menyentuh level di atas berdiri terpisah — ia menghitung jarak, bukan
                    menebak arah.
                  </>
                )}
              </p>
            )}

            {prob.faktor && prob.faktor.length > 0 && (
              <div className="be-prob-faktor">
                <span className="be-lbl">Yang mendorong &amp; menekan hari ini</span>
                <ul>
                  {prob.faktor.slice(0, 5).map((f, i) => (
                    <li key={i}>
                      <span>{f.nama}</span>
                      <em>{f.nilai}</em>
                      <b className={f.delta_pp >= 0 ? 'up' : 'dn'}>
                        {f.delta_pp >= 0 ? '+' : ''}{f.delta_pp.toFixed(1)} pp
                      </b>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {rekamAda.length === 0 ? (
          <p className="be-bendera-kosong">
            <b>{kode}</b> belum pernah muncul di satu pun uji strategi yang tersimpan. Itu bukan
            penilaian atas emitennya — hanya berarti strategi yang diuji tak pernah memberi sinyal
            di sini.
          </p>
        ) : (
          <div className="be-rekam">
            {rekamAda.map((r) => (
              <div key={r.strategi} className="be-rekam-grup">
                <div className="be-rekam-kepala">
                  <b>{r.strategi}</b>
                  <span className={r.layakPersen ? '' : 'be-rekam-tipis'}>{r.label}</span>
                </div>
                <div className="be-rekam-angka">
                  <span className="be-pil">
                    median
                    <b className={(r.median ?? 0) >= 0 ? 'up' : 'dn'}>
                      {r.median == null ? '—' : `${(r.median * 100).toFixed(1)}%`}
                    </b>
                  </span>
                  <span className="be-pil">
                    terbaik
                    <b className="up">
                      {r.terbaik == null ? '—' : `${(r.terbaik * 100).toFixed(1)}%`}
                    </b>
                  </span>
                  {/* Terburuk SELALU dipajang sebesar terbaik. Rekam jejak yang
                      cuma menyebut kemenangan bukan rekam jejak, itu iklan. */}
                  <span className="be-pil">
                    terburuk
                    <b className="dn">
                      {r.terburuk == null ? '—' : `${(r.terburuk * 100).toFixed(1)}%`}
                    </b>
                  </span>
                </div>
              </div>
            ))}
            <p className="be-rasio-kosong">
              Tingkat menang hanya dinyatakan dalam persen bila ada minimal {MIN_SAMPEL_PERSEN} kali
              — di bawah itu satu kejadian menggeser angkanya lebih dari lima poin, dan persentase
              dari sampel sekecil itu terbaca setara dengan persentase dari dua ratus kejadian.
            </p>
          </div>
        )}

        {rekomendasi.length > 0 && (
          <div className="be-rekom">
            <span className="be-lbl">Pernah masuk daftar PAPAN</span>
            <ul className="be-rekom-daftar">
              {rekomendasi.slice(0, 6).map((r, i) => (
                <li key={i}>
                  <b>{r.preset}</b> · {r.tanggal}
                  {r.close != null && <> · harga saat itu {r.close.toLocaleString('id-ID')}</>}
                  {r.tp1 != null && <> · target {r.tp1.toLocaleString('id-ID')}</>}
                  {r.sl != null && <> · batas rugi {r.sl.toLocaleString('id-ID')}</>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* BLOK F — yang sudah dihitung halaman lain, dikumpulkan jadi satu
          layar. Tangga harga datang dari kartu yang SUDAH dimuat blok G;
          94 rasio dari berkas yang cache peramannya dibagi dengan Stock
          Detail. Halaman ini mengumpulkan, bukan menghitung ulang. */}
      <section className="be-kartu">
        <div className="be-kartu-kepala">
          <span className="be-blok">F</span>
          <div>
            <h2>Teknikal &amp; fundamental</h2>
            <p className="be-ket">
              Tangga harga dan {rasio.totalTerisi} rasio keuangan, dikelompokkan menurut
              pertanyaan yang dijawabnya.
              {rasio.totalTambalan > 0 && (
                <> {rasio.totalTambalan} di antaranya tak ada di sumber utama dan diambil dari{' '}
                <b>{NAMA_CADANGAN}</b> — ditandai pada barisnya masing-masing.</>
              )}
            </p>
          </div>
        </div>

        {kartu && (
          <div className="be-tangga">
            <div className="be-tangga-grup">
              <span className="be-lbl">Rata-rata bergerak</span>
              <div className="be-tangga-baris">
                {([['MA20', kartu.ma20], ['MA50', kartu.ma50], ['MA200', kartu.ma200]] as const).map(
                  ([nama, v]) => (
                    <span key={nama} className="be-pil">
                      {nama}
                      <b className={v == null ? 'muted' : kartu.harga > v ? 'up' : 'dn'}>
                        {v == null ? '—' : v.toLocaleString('id-ID')}
                      </b>
                    </span>
                  ),
                )}
              </div>
            </div>
            {kartu.support.length > 0 && (
              <div className="be-tangga-grup">
                <span className="be-lbl">Support</span>
                <div className="be-tangga-baris">
                  {kartu.support.slice(0, 4).map((s, i) => (
                    <span key={i} className="be-pil">
                      <b className="dn">{s.harga.toLocaleString('id-ID')}</b>
                    </span>
                  ))}
                </div>
              </div>
            )}
            {kartu.resistance.length > 0 && (
              <div className="be-tangga-grup">
                <span className="be-lbl">Resistance</span>
                <div className="be-tangga-baris">
                  {kartu.resistance.slice(0, 4).map((s, i) => (
                    <span key={i} className="be-pil">
                      <b className="up">{s.harga.toLocaleString('id-ID')}</b>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {rasio.totalTerisi === 0 ? (
          <p className="be-bendera-kosong">
            Rasio keuangan untuk <b>{kode}</b> belum tersedia di arsip.
          </p>
        ) : (
          <div className="be-rasio">
            {rasio.kelompok.filter((k) => k.baris.length > 0).map((k) => (
              <div key={k.kunci} className="be-rasio-grup">
                <h3>{k.judul}</h3>
                <dl>
                  {k.baris.map((b) => (
                    <div key={b.nama} className="be-rasio-baris">
                      <dt>
                        {b.nama}
                        {/* Sumber ditempel pada ANGKANYA, bukan disebut sekali
                            di kepala blok: pembaca yang memindai satu rasio
                            tak pernah membaca kepala bloknya. */}
                        {b.sumber && <em className="be-rasio-sumber"> · {b.sumber}</em>}
                      </dt>
                      <dd className={b.sumber ? 'be-rasio-tambal' : undefined}>{b.nilai}</dd>
                    </div>
                  ))}
                </dl>
                {/* Berapa yang sumbernya tak punya — disebut, bukan
                    disembunyikan. Kelompok yang terlihat penuh padahal
                    separuh ruasnya hilang memberi rasa lengkap yang keliru. */}
                {k.kosong > 0 && (
                  <p className="be-rasio-kosong">{k.kosong} ruas tak tersedia di sumber</p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>


    </div>
  )
}
