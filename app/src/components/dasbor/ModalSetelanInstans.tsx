import { useEffect, useState } from 'react'
import {
  PALET_INDIKATOR, galatInstans, salinInstans, terapkanDraf,
  type GayaPlot, type Instans, type SpekParam,
} from '../../lib/dasbor/grafikEmiten'
import { KERANGKA } from '../../lib/dasbor/kerangkaWaktu'
import { ModalKecil } from './ModalKecil'

/**
 * Setelan satu instans indikator/pola — MODAL bertransaksi, tiga tab
 * (Inputs · Style · Visibility), meniru dialog setelan indikator TradingView
 * yang jadi acuan Johan.
 *
 * Menggantikan `SetelanInstans`, panel melayang yang menerapkan tiap ketikan
 * SEKETIKA. Bedanya bukan rasa: panel itu tak punya jalan mundur sama sekali —
 * mengubah periode MA 20 jadi 200 lalu menyesal berarti harus mengingat sendiri
 * angka semula. Di sini seluruh perubahan hidup di `draf`, salinan DALAM
 * (`salinInstans`) yang baru dijahitkan ke daftar sungguhan saat `Ok` ditekan.
 * `Cancel` cukup membuang drafnya, dan karena itu ia tak bisa "lupa"
 * mengembalikan sesuatu.
 *
 * Kerangkanya `ModalKecil` + primitif `.tabs`/`.tab` yang sudah dipakai
 * seluruh aplikasi (#170) — bukan modal jenis kedua yang bentuknya asing di
 * halaman ini.
 */

type Tab = 'inputs' | 'style' | 'visibility'

const TAB: Array<[Tab, string]> = [
  ['inputs', 'Inputs'],
  ['style', 'Style'],
  ['visibility', 'Visibility'],
]

/** Gaya garis lightweight-charts yang masuk akal untuk indikator. Nilainya
 *  angka `LineStyle` apa adanya — disimpan begitu supaya template tetap JSON
 *  murni tanpa enum yang harus diterjemahkan dua arah. */
const GAYA_GARIS: Array<[number, string]> = [[0, 'Solid'], [2, 'Dashed'], [1, 'Dotted']]

const TEBAL: number[] = [1, 2, 3]

export function ModalSetelanInstans<J extends string>({
  inst, nama, param, plot, jumlahLilin, onSimpan, onTutup, onBawaan, onPratinjau,
}: {
  inst: Instans<J>
  nama: string
  param: SpekParam[]
  /** Nama tiap deret yang digambar instans ini ("BB atas", "MACD sinyal", …) —
   *  datang dari `hitungInstans` di pemanggil, bukan dihitung ulang di sini:
   *  daftar plot di tab Style wajib persis sama dengan yang benar-benar
   *  tergambar, dan dua perhitungan terpisah adalah dua kesempatan berbeda. */
  plot: string[]
  jumlahLilin: number
  onSimpan: (baru: Instans<J>) => void
  onTutup: () => void
  /** Instans "pabrik" jenis ini — isi tombol `Defaults`. */
  onBawaan: () => Instans<J>
  /** Menggambar ulang kanvas dengan draf, TANPA menyimpannya. Dipanggil tiap
   *  draf berubah supaya penilaian dilakukan dari grafiknya, bukan dari angka
   *  yang harus dibayangkan. Pemanggil WAJIB menyimpan instans aslinya dan
   *  memulihkannya saat modal ditutup tanpa `Ok` — kalau tidak, pratinjau ini
   *  berubah jadi penerapan seketika, sifat yang justru dibuang dari panel
   *  melayang lama. */
  onPratinjau?: (draf: Instans<J>) => void
}) {
  const [tab, setTab] = useState<Tab>('inputs')
  // Draf: salinan DALAM. Lihat catatan `salinInstans` — salinan dangkal
  // membuat `Cancel` berbohong tanpa satu pun galat.
  const [draf, setDraf] = useState<Instans<J>>(() => salinInstans(inst))

  // Pratinjau hidup: tiap draf berubah, kanvas digambar ulang dengan nilai itu
  // TANPA menyimpannya. Efek, bukan dipanggil di tiap setDraf — kalau ditempel
  // di tiap pemanggil, satu jalur yang lupa memanggilnya membuat pratinjau
  // diam-diam berhenti bekerja untuk sebagian kendali saja, dan itu jenis
  // kerusakan yang tak terlihat sampai ada yang mengeluh.
  useEffect(() => {
    onPratinjau?.(draf)
  }, [draf, onPratinjau])
  // Teks terpisah dari angka, aturan yang sama dengan `useDaftarInstans`:
  // kolom pasti melewati keadaan tak sah di tengah pengetikan ("", "2.", "-").
  const [teks, setTeks] = useState<Record<string, string>>(
    () => Object.fromEntries(param.map((s) => [s.kunci, String(inst.param[s.kunci])])),
  )
  const galat = galatInstans(param, teks, jumlahLilin)
  const adaGalat = Object.keys(galat).length > 0

  const gaya = (i: number): GayaPlot => draf.gaya?.[i] ?? {}
  const setGaya = (i: number, ubah: Partial<GayaPlot>) => setDraf((d) => ({
    ...d, gaya: { ...d.gaya, [i]: { ...(d.gaya?.[i] ?? {}), ...ubah } },
  }))

  const simpan = () => {
    const baru = terapkanDraf(draf, param, teks, jumlahLilin)
    // `null` = ada kolom tak sah. Modal tetap terbuka: menutupnya berarti
    // membuang perubahan tanpa memberi tahu kolom mana yang menolaknya.
    if (baru) { onSimpan(baru); onTutup() }
  }

  const kembalikanBawaan = () => {
    const b = onBawaan()
    setDraf(salinInstans({ ...b, id: draf.id, tampil: draf.tampil }))
    setTeks(Object.fromEntries(param.map((s) => [s.kunci, String(b.param[s.kunci])])))
  }

  return (
    <ModalKecil label={`Setelan ${nama}`} onClose={onTutup} className="grf-modal-setelan">
      <div className="tabs" role="tablist" aria-label={`Bagian setelan ${nama}`}>
        {TAB.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id}
            className={`tab${tab === id ? ' on' : ''}`} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {tab === 'inputs' && (
        <div className="grf-setel-isi">
          {param.length === 0 && <p className="muted">Jenis ini tak punya parameter.</p>}
          {param.map((s) => (s.pilihan ? (
            // Ruas berpilihan jadi deretan `.chip-t`, bukan kolom angka:
            // jawabannya terhingga, dan meminta orang mengetik "3" untuk Kamis
            // berarti memindahkan tabel terjemahan ke dalam kepalanya.
            <div key={s.kunci} className="grf-setel-baris" role="group" aria-label={`${s.label} ${nama}`}>
              <span className="grf-setel-lbl">{s.label}</span>
              <span className="grf-setel-pilihan">
                {s.pilihan.map((o) => (
                  <button key={o.nilai} type="button"
                    className={`chip-t${Number(teks[s.kunci]) === o.nilai ? ' on' : ''}`}
                    aria-pressed={Number(teks[s.kunci]) === o.nilai}
                    onClick={() => setTeks((t) => ({ ...t, [s.kunci]: String(o.nilai) }))}>{o.label}</button>
                ))}
              </span>
            </div>
          ) : (
            <label key={s.kunci} className="grf-setel-baris">
              <span className="grf-setel-lbl">{s.label}</span>
              <input className={`inp grf-ind-inp${galat[s.kunci] ? ' salah' : ''}`}
                inputMode="decimal" value={teks[s.kunci] ?? ''}
                aria-invalid={galat[s.kunci] ? true : undefined}
                aria-label={`${s.label} ${nama}`}
                onChange={(e) => setTeks((t) => ({ ...t, [s.kunci]: e.target.value }))} />
            </label>
          )))}
          {Object.entries(galat).map(([kunci, pesan]) => (
            <p key={kunci} className="grf-ind-galat">
              {param.find((s) => s.kunci === kunci)?.label}: {pesan}
            </p>
          ))}
        </div>
      )}

      {tab === 'style' && (
        <div className="grf-setel-isi">
          {plot.map((namaPlot, i) => (
            <div key={namaPlot + i} className="grf-setel-plot">
              <label className="grf-setel-plot-nama">
                <input type="checkbox" checked={gaya(i).tampil !== false}
                  onChange={(e) => setGaya(i, { tampil: e.target.checked })} />
                <span>{namaPlot}</span>
              </label>
              <span className="grf-setel-warna" role="group" aria-label={`Warna ${namaPlot}`}>
                {PALET_INDIKATOR.map((w) => (
                  <button key={w} type="button"
                    className={`grf-swatch${(gaya(i).warna ?? draf.warna) === w ? ' on' : ''}`}
                    style={{ background: `var(${w})` }}
                    aria-pressed={(gaya(i).warna ?? draf.warna) === w}
                    title={w.replace('--', '')} aria-label={`Warna ${w.replace('--', '')} untuk ${namaPlot}`}
                    onClick={() => setGaya(i, { warna: w })} />
                ))}
              </span>
              <span className="grf-setel-garis" role="group" aria-label={`Gaya garis ${namaPlot}`}>
                {GAYA_GARIS.map(([nilai, label]) => (
                  <button key={nilai} type="button"
                    className={`chip-t${(gaya(i).garis ?? 0) === nilai ? ' on' : ''}`}
                    aria-pressed={(gaya(i).garis ?? 0) === nilai}
                    onClick={() => setGaya(i, { garis: nilai })}>{label}</button>
                ))}
                {TEBAL.map((t) => (
                  <button key={`t${t}`} type="button"
                    className={`chip-t${(gaya(i).tebal ?? 1) === t ? ' on' : ''}`}
                    aria-pressed={(gaya(i).tebal ?? 1) === t}
                    aria-label={`Tebal ${t} piksel untuk ${namaPlot}`}
                    title={`Tebal ${t}px`}
                    onClick={() => setGaya(i, { tebal: t })}>{t}px</button>
                ))}
              </span>
            </div>
          ))}
          {plot.length === 0 && <p className="muted">Instans ini tak menggambar deret apa pun.</p>}

          <p className="grf-setel-judul">OUTPUTS</p>
          <label className="grf-setel-baris">
            <span className="grf-setel-lbl">Precision</span>
            <input className="inp grf-ind-inp" inputMode="numeric"
              value={draf.presisi ?? ''} placeholder="auto"
              aria-label={`Presisi ${nama}`}
              onChange={(e) => {
                const v = e.target.value.trim()
                // Kosong = "auto", BUKAN nol: presisi 0 itu pilihan sah
                // (bulatkan ke satuan) dan menyamakannya dengan kosong
                // membuatnya mustahil dipilih.
                setDraf((d) => ({ ...d, presisi: v === '' ? undefined : Math.max(0, Math.min(8, Number(v) || 0)) }))
              }} />
          </label>
          <label className="grf-setel-baris">
            <span className="grf-setel-lbl">Labels on price scale</span>
            <input type="checkbox" checked={draf.labelSumbu !== false}
              onChange={(e) => setDraf((d) => ({ ...d, labelSumbu: e.target.checked }))} />
          </label>
          <label className="grf-setel-baris">
            <span className="grf-setel-lbl">Values in status line</span>
            <input type="checkbox" checked={draf.nilaiStatus !== false}
              onChange={(e) => setDraf((d) => ({ ...d, nilaiStatus: e.target.checked }))} />
          </label>
        </div>
      )}

      {tab === 'visibility' && (
        <div className="grf-setel-isi">
          <p className="grf-setel-ket">
            Kerangka waktu tempat instans ini digambar. Yang dimatikan tetap ada
            di daftar — ia cuma tak muncul saat kerangka itu aktif.
          </p>
          {KERANGKA.map((k) => {
            const aktif = !(draf.sembunyiDi ?? []).includes(k.id)
            return (
              <label key={k.id} className="grf-setel-baris">
                <span className="grf-setel-lbl" title={k.judul}>{k.judul}</span>
                <input type="checkbox" checked={aktif}
                  aria-label={`Tampilkan ${nama} pada kerangka ${k.label}`}
                  onChange={(e) => setDraf((d) => {
                    const sembunyi = new Set(d.sembunyiDi ?? [])
                    if (e.target.checked) sembunyi.delete(k.id)
                    else sembunyi.add(k.id)
                    return { ...d, sembunyiDi: sembunyi.size ? [...sembunyi] : undefined }
                  })} />
              </label>
            )
          })}
        </div>
      )}

      <div className="grf-setel-kaki">
        <button type="button" className="dd-btn" onClick={kembalikanBawaan}
          title="Kembalikan seluruh parameter & gaya ke nilai pabrik jenis ini">Defaults</button>
        <span className="grf-setel-kaki-isi" />
        <button type="button" className="dd-btn" onClick={onTutup}>Cancel</button>
        <button type="button" className="btn-p" disabled={adaGalat}
          title={adaGalat ? 'Ada kolom yang belum sah' : 'Terapkan perubahan'}
          onClick={simpan}>Ok</button>
      </div>
    </ModalKecil>
  )
}
