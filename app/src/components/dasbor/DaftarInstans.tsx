import { useCallback, useMemo, useState } from 'react'
import {
  buatInstans, galatInstans, type Instans, type SpekParam,
} from '../../lib/dasbor/grafikEmiten'
import { IkonMenu, IKON_MATA, IKON_MATA_CORET, IKON_TONG } from './IkonMenu'

/**
 * Daftar instans berparameter — dipakai DUA KALI di Grafik Emiten: sekali
 * untuk indikator, sekali untuk pola. Keduanya persis sama kelakuannya
 * (tambah dari dropdown, ubah parameter, sembunyikan sementara, hapus,
 * simpan ke template), yang berbeda cuma spek parameternya; menuliskannya
 * dua kali berarti dua tempat yang harus diperbaiki tiap kali aturan
 * validasinya bergeser.
 */

/** Kunci gabungan id instans + nama ruas untuk menyimpan teks yang sedang
 *  diketik. */
const kunciTeks = (id: string, kunci: string) => `${id}:${kunci}`

/** Id instans baru. `crypto.randomUUID` ada di seluruh peramban yang
 *  didukung; jam + acak sebagai jaring pengaman kalau halaman dibuka lewat
 *  konteks tak-aman (http polos), di mana API itu tak tersedia. */
function idBaru(): string {
  return globalThis.crypto?.randomUUID?.() ?? `i${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export interface DaftarInstans<J extends string> {
  daftar: Array<Instans<J>>
  /** Ganti seluruh daftar sekaligus (dipakai saat memuat template). Teks yang
   *  sedang diketik ikut dibuang — ia milik instans yang barusan digantikan. */
  gantiSemua: (baru: Array<Instans<J>>) => void
  tambah: (jenis: string) => void
  hapus: (id: string) => void
  sakelarTampil: (id: string) => void
  /** Teks yang harus TERLIHAT di kolom: yang sedang diketik kalau ada, kalau
   *  tidak angka yang tersimpan di instans. */
  teksInstans: (inst: Instans<J>) => Record<string, string>
  /** Galat per instans, per kunci ruas. */
  galat: Record<string, Record<string, string>>
  gantiParam: (inst: Instans<J>, spek: SpekParam, nilai: string) => void
  paramSpek: (jenis: J) => SpekParam[]
}

/**
 * State + aturan sebuah daftar instans.
 *
 * Yang paling menentukan di sini: TEKS yang sedang diketik disimpan terpisah
 * dari ANGKA yang tersimpan di instans. Kolom teks pasti melewati keadaan tak
 * sah di tengah pengetikan (kosong, "2.", "-"), dan angka yang dipakai
 * menghitung tak boleh ikut melewatinya — periode 0 atau periode lebih
 * panjang dari jumlah lilin membuat seluruh deret hasilnya `null` dan
 * garisnya lenyap dari kanvas tanpa satu pun galat. Jadi: teks selalu
 * tersimpan (kalau tidak, kolomnya tak bisa diketik sampai selesai), angka
 * cuma ikut berubah kalau lolos validasi.
 */
export function useDaftarInstans<J extends string>(
  paramSpek: (jenis: J) => SpekParam[],
  jumlahLilin: number,
  /**
   * Batasi satu instans per jenis. Dipakai POLA, tidak dipakai indikator, dan
   * bedanya mendasar: `MA 20` + `MA 200` dua garis berbeda yang berguna
   * bersamaan, sedangkan dua Double Bottom cuma menggambar hal yang sama dua
   * kali di atas dirinya sendiri — daftar temuannya tercetak dobel, penanda
   * di kanvas dobel, garis lehernya dobel. Johan 17 Agu 2026, setelah
   * melihatnya di layar: "untuk pola hanya bisa masukin 1x saja, tapi untuk
   * indikator boleh berkali-kali".
   */
  satuPerJenis = false,
): DaftarInstans<J> {
  const [daftar, setDaftar] = useState<Array<Instans<J>>>([])
  const [teks, setTeks] = useState<Record<string, string>>({})

  const gantiSemua = useCallback((baru: Array<Instans<J>>) => {
    // Template lama bisa memuat lebih dari satu instans sejenis (disimpan
    // sebelum batas ini ada). Disaring di sini juga, bukan cuma di `tambah` —
    // kalau tidak, batasnya bisa dilangkahi lewat pintu belakang template.
    setDaftar(satuPerJenis
      ? baru.filter((x, i) => baru.findIndex((y) => y.jenis === x.jenis) === i)
      : baru)
    setTeks({})
  }, [satuPerJenis])

  const tambah = useCallback((jenis: string) => {
    setDaftar((list) => (satuPerJenis && list.some((x) => x.jenis === jenis)
      ? list
      : [...list, buatInstans(jenis as J, paramSpek(jenis as J), idBaru(), list.length)]))
  }, [paramSpek, satuPerJenis])

  const hapus = useCallback((id: string) => {
    setDaftar((list) => list.filter((x) => x.id !== id))
    // Teks milik instans yang sudah tak ada ikut dibuang — kalau tidak, ia
    // menempel pada instans berikutnya yang kebetulan sama id-nya.
    setTeks((t) => Object.fromEntries(Object.entries(t).filter(([k]) => !k.startsWith(`${id}:`))))
  }, [])

  const sakelarTampil = useCallback((id: string) => {
    setDaftar((list) => list.map((x) => (x.id === id ? { ...x, tampil: !x.tampil } : x)))
  }, [])

  const teksInstans = useCallback((inst: Instans<J>): Record<string, string> => Object.fromEntries(
    paramSpek(inst.jenis).map((s) => [s.kunci, teks[kunciTeks(inst.id, s.kunci)] ?? String(inst.param[s.kunci])]),
  ), [teks, paramSpek])

  const galat = useMemo(() => {
    const peta: Record<string, Record<string, string>> = {}
    for (const inst of daftar) peta[inst.id] = galatInstans(paramSpek(inst.jenis), teksInstans(inst), jumlahLilin)
    return peta
  }, [daftar, teksInstans, jumlahLilin, paramSpek])

  const gantiParam = useCallback((inst: Instans<J>, spek: SpekParam, nilai: string) => {
    setTeks((t) => ({ ...t, [kunciTeks(inst.id, spek.kunci)]: nilai }))
    const param = paramSpek(inst.jenis)
    const g = galatInstans(param, { ...teksInstans(inst), [spek.kunci]: nilai }, jumlahLilin)
    if (g[spek.kunci]) return
    setDaftar((list) => list.map(
      (x) => (x.id === inst.id ? { ...x, param: { ...x.param, [spek.kunci]: Number(nilai) } } : x),
    ))
  }, [teksInstans, jumlahLilin, paramSpek])

  return { daftar, gantiSemua, tambah, hapus, sakelarTampil, teksInstans, galat, gantiParam, paramSpek }
}

interface BarisProps<J extends string> {
  kelola: DaftarInstans<J>
  label: (inst: Instans<J>) => string
}

/** Baris-baris daftar instans: swatch warna, nama berikut parameternya, kolom
 *  masukan tiap ruas, sakelar sembunyi, dan tombol hapus. */
export function BarisInstans<J extends string>({ kelola, label }: BarisProps<J>) {
  if (kelola.daftar.length === 0) return null
  return (
    <ul className="grf-ind-daftar">
      {kelola.daftar.map((inst) => {
        const param = kelola.paramSpek(inst.jenis)
        const teks = kelola.teksInstans(inst)
        const galat = kelola.galat[inst.id] ?? {}
        const nama = label(inst)
        return (
          <li key={inst.id} className={'grf-ind-baris' + (inst.tampil ? '' : ' redup')}
            style={{ '--ind-warna': `var(${inst.warna})` } as React.CSSProperties}>
            <span className="grf-ind-warna" aria-hidden="true" />
            <span className="grf-ind-nama">{nama}</span>
            {param.map((s) => (
              <label key={s.kunci} className="grf-ind-param">
                <span className="grf-ind-param-lbl">{s.label}</span>
                <input className={'inp grf-ind-inp' + (galat[s.kunci] ? ' salah' : '')}
                  inputMode="decimal" value={teks[s.kunci]}
                  aria-invalid={galat[s.kunci] ? true : undefined}
                  aria-label={`${s.label} ${nama}`}
                  onChange={(e) => kelola.gantiParam(inst, s, e.target.value)} />
              </label>
            ))}
            <button type="button" className="dd-btn grf-ind-aksi"
              aria-pressed={inst.tampil}
              title={inst.tampil ? 'Sembunyikan sementara' : 'Tampilkan lagi'}
              onClick={() => kelola.sakelarTampil(inst.id)}>
              <IkonMenu d={inst.tampil ? IKON_MATA : IKON_MATA_CORET} size={12} />
            </button>
            <button type="button" className="dd-btn grf-ind-aksi"
              title={`Hapus ${nama}`}
              onClick={() => kelola.hapus(inst.id)}>
              <IkonMenu d={IKON_TONG} size={12} />
            </button>
            {/* Alasan tolakan ditulis DI BARIS ITU SENDIRI, bukan di satu kotak
                galat bersama: dengan beberapa instans hidup bersamaan, pesan
                yang menggantung jauh dari kolomnya tak memberi tahu kolom mana
                yang harus diperbaiki. */}
            {Object.entries(galat).map(([kunci, pesan]) => (
              <p key={kunci} className="grf-ind-galat">
                {param.find((s) => s.kunci === kunci)?.label}: {pesan}
              </p>
            ))}
          </li>
        )
      })}
    </ul>
  )
}
