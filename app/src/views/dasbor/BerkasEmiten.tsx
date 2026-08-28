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

  const tahun = r ? tahunTerbaru(r) : []
  const maksTahun = Math.max(1, ...tahun.map((t) => Math.abs(t[1].tangkap_naik)))

  return (
    <div className="lantai be">
      <div className="bilah-kendali">
        <div className="grup-k">
          <span className="grup-lbl">Emiten</span>
          <div className="be-cari">
            <StockAutocomplete
              stocks={indeks?.stocks || []}
              value={ketik}
              onChange={setKetik}
              onSelect={(v) => { setKetik(v); setParams({ kode: v.toUpperCase() }) }}
              placeholder="Cari emiten: BBRI, BBCA…"
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

          <div className="be-utama">
            <div>
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

              {r.hari_terburuk.length > 0 && (
                <>
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
                </>
              )}
            </div>

            <div>
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

              {tahun.length > 0 && (
                <>
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
                </>
              )}
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

      {/* Blok C–G menyusul — rancangannya sudah tetap, datanya sudah dipanen. */}
      <div className="be-nanti">
        <div><b>C · Aliran asing</b>net, streak, dibagi free float</div>
        <div><b>D · Likuiditas</b>volume, hari sepi, porsi negosiasi</div>
        <div><b>E · Probabilitas</b>P(R1/R2/S1), win rate, riwayat rekomendasi</div>
        <div><b>F · Teknikal &amp; fundamental</b>pivot, pola, rasio</div>
        <div><b>G · Bendera risiko</b>notasi khusus, konsentrasi broker</div>
      </div>
    </div>
  )
}
