import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import {
  daftarContohOrderbook,
  unggahContoh,
  tambahContohOrderbook,
  hapusContohOrderbook,
  type ContohOrderbook,
} from '../../lib/contohOrderbook'
import { urlScreenshots } from '../../lib/supabaseEdisi'
import { IkonMenu, IKON_PERLUAS, IKON_TAMBAH, IKON_TONG, IKON_PERINGATAN } from '../../components/dasbor/IkonMenu'
import { LightboxGambar, type GambarLightbox } from '../../components/dasbor/LightboxGambar'
import { ModalKecil } from '../../components/dasbor/ModalKecil'
import { pesanGalat } from '../../lib/pesanGalat'

/**
 * Panel "Cara screenshot orderbook" (Fase 5) — panduan teks + galeri contoh
 * `contoh_orderbook`, dipasang di tab Unggah dekat form Tambah Emiten.
 * Dilipat/dibuka (`buka` state lokal); nilai awal ditentukan pemanggil lewat
 * `defaultBuka` (UnggahHarian.tsx: terbuka utk akun yang belum pernah
 * menyetor, tertutup kalau sudah — lihat komentar di sana).
 *
 * Pengelola contoh (superadmin) SENGAJA ditaruh di sini, bukan tab lain
 * (Akses/Akun/dst) — kontennya cuma dipakai panel ini, jadi menaruhnya di
 * mana pun selain sini berarti superadmin harus lompat tab buat mengelola
 * sesuatu yang efeknya cuma terlihat di tab Unggah.
 */
export function PanduanScreenshot({ superadmin, defaultBuka }: { superadmin: boolean; defaultBuka: boolean }) {
  const [buka, setBuka] = useState(defaultBuka)
  const [contoh, setContoh] = useState<ContohOrderbook[] | null>(null)
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [muat, setMuat] = useState(0)
  const [lightbox, setLightbox] = useState<{ items: GambarLightbox[]; index: number } | null>(null)
  const [tambahBuka, setTambahBuka] = useState(false)
  const [hapusSibuk, setHapusSibuk] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<{ ok: boolean; pesan: string } | null>(null)

  useEffect(() => {
    let batal = false
    daftarContohOrderbook()
      .then((rows) => !batal && setContoh(rows))
      .catch(() => !batal && setContoh([]))
    return () => {
      batal = true
    }
  }, [muat])

  useEffect(() => {
    if (!contoh || contoh.length === 0) {
      setUrls({})
      return
    }
    let batal = false
    urlScreenshots(contoh.map((c) => c.path))
      .then((u) => !batal && setUrls(u))
      .catch(() => {})
    return () => {
      batal = true
    }
  }, [contoh])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  function bukaLightbox(indexAsli: number) {
    if (!contoh) return
    const target = contoh[indexAsli]
    const dgnUrl = contoh.filter((c) => urls[c.path])
    const items = dgnUrl.map((c) => ({ src: urls[c.path], keterangan: `${c.judul || c.path} · ${c.benar ? 'Benar' : 'Terpotong — jangan begini'}` }))
    setLightbox({ items, index: Math.max(0, dgnUrl.findIndex((c) => c.path === target.path)) })
  }

  async function hapus(path: string) {
    setHapusSibuk((s) => new Set(s).add(path))
    try {
      await hapusContohOrderbook(path)
      setMuat((m) => m + 1)
    } catch (e) {
      setToast({ ok: false, pesan: pesanGalat(e, 'Gagal menghapus contoh.') })
    } finally {
      setHapusSibuk((s) => {
        const q = new Set(s)
        q.delete(path)
        return q
      })
    }
  }

  return (
    <section className="panel af-panduan">
      <button type="button" className="af-panduan-h" onClick={() => setBuka((v) => !v)} aria-expanded={buka}>
        <span className="lbl"><IkonMenu d={IKON_PERLUAS} size={14} /> Cara screenshot broker summary</span>
        <span className="af-panduan-chevron" aria-hidden="true">{buka ? '▲' : '▼'}</span>
      </button>
      {buka && (
        <div className="panel-b">
          <ul className="af-panduan-list">
            <li>
              <b>Ambil dalam mode layar penuh</b> (F11, atau tombol layar penuh aplikasi broker) — bukan sekadar saran:
              emiten ramai broker seperti <b>DSSA</b> terpotong di jendela biasa, sementara emiten sepi seperti{' '}
              <b>MCAS</b> muat tanpa masalah. Tanpa layar penuh, baris broker paling bawah bisa hilang tanpa terlihat hilang.
            </li>
            <li>
              Wajib terlihat: <b>kode emiten</b>, <b>tanggal</b>, kolom <b>bid/offer beserta antriannya</b>,{' '}
              <b>total volume</b>, dan <b>seluruh baris broker sampai bawah</b>.
            </li>
            <li>Jangan memotong atau menyunting gambar, jangan menutupi angka.</li>
            {/* Contoh di bawah kebetulan semuanya dari Stockbit, dan itu
                terbaca seperti syarat. Yang dibutuhkan transkripsi cuma
                angkanya — aplikasi mana pun boleh, asal isinya lengkap. */}
            <li>
              <b>Aplikasi bebas.</b> Broker summary dari sekuritas mana pun diterima — Stockbit, IPOT,
              Mirae, Ajaib, BNI Bions, dan lainnya. Contoh di bawah kebetulan memakai Stockbit;
              yang dinilai isinya, bukan aplikasinya.
            </li>
          </ul>

          {contoh === null && <p className="muted" style={{ fontSize: 11 }}>Memuat contoh…</p>}

          {contoh && contoh.length > 0 && (
            <div className="af-galeri-grid">
              {contoh.map((c, i) => (
                <div key={c.path} className={`af-galeri-item ${c.benar ? 'benar' : 'salah'}`}>
                  <button
                    type="button"
                    className="af-galeri-gambar"
                    onClick={() => bukaLightbox(i)}
                    title={c.judul || (c.benar ? 'Contoh benar' : 'Contoh terpotong')}
                  >
                    {urls[c.path] ? <img src={urls[c.path]} alt={c.judul || c.path} /> : <span className="muted">…</span>}
                  </button>
                  <span className={`af-galeri-tag ${c.benar ? 'up' : 'dn'}`}>{c.benar ? 'Benar' : 'Terpotong — jangan begini'}</span>
                  {c.judul && <span className="af-galeri-judul">{c.judul}</span>}
                  {superadmin && (
                    <button
                      type="button"
                      className="af-galeri-hapus"
                      title="Hapus contoh ini"
                      aria-label={`Hapus contoh ${c.judul || c.path}`}
                      disabled={hapusSibuk.has(c.path)}
                      onClick={() => hapus(c.path)}
                    >
                      <IkonMenu d={IKON_TONG} size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {contoh && contoh.length === 0 && superadmin && (
            <p className="af-panduan-kosong">
              Belum ada contoh terunggah — kontributor lain akan lebih cepat paham dengan gambar dibanding teks saja.
              <button type="button" className="dd-btn" style={{ marginLeft: 8 }} onClick={() => setTambahBuka(true)}>
                <IkonMenu d={IKON_TAMBAH} size={12} /> Tambah contoh pertama
              </button>
            </p>
          )}

          {superadmin && contoh && contoh.length > 0 && (
            <button type="button" className="dd-btn" style={{ marginTop: 10 }} onClick={() => setTambahBuka(true)}>
              <IkonMenu d={IKON_TAMBAH} size={12} /> Tambah contoh
            </button>
          )}
        </div>
      )}

      {lightbox && (
        <LightboxGambar
          items={lightbox.items}
          index={lightbox.index}
          onIndex={(i) => setLightbox((lb) => (lb ? { ...lb, index: i } : lb))}
          onClose={() => setLightbox(null)}
        />
      )}

      {tambahBuka && (
        <FormTambahContoh
          urutanAwal={contoh?.length ?? 0}
          onClose={() => setTambahBuka(false)}
          onSukses={() => {
            setTambahBuka(false)
            setMuat((m) => m + 1)
          }}
        />
      )}

      {toast && (
        <div className={`lantai af-toast${toast.ok ? '' : ' gagal'}`} role="status">
          <IkonMenu d={IKON_PERINGATAN} size={15} />
          <span>{toast.pesan}</span>
        </div>
      )}
    </section>
  )
}

function FormTambahContoh({ urutanAwal, onClose, onSukses }: { urutanAwal: number; onClose: () => void; onSukses: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [judul, setJudul] = useState('')
  const [keterangan, setKeterangan] = useState('')
  const [benar, setBenar] = useState(true)
  const [urutan, setUrutan] = useState(urutanAwal)
  const [kirim, setKirim] = useState(false)
  const [err, setErr] = useState('')

  function pilihFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    if (f && !f.type.startsWith('image/')) {
      setErr('Berkas harus berupa gambar.')
      return
    }
    setErr('')
    setFile(f)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!file) {
      setErr('Pilih gambar contoh dulu.')
      return
    }
    setKirim(true)
    setErr('')
    try {
      const path = await unggahContoh(file)
      await tambahContohOrderbook({ path, judul: judul.trim() || null, keterangan: keterangan.trim() || null, benar, urutan })
      onSukses()
    } catch (e) {
      setErr(pesanGalat(e, 'Gagal menambah contoh.'))
    } finally {
      setKirim(false)
    }
  }

  return (
    <ModalKecil label="Tambah contoh broker summary" onClose={() => { if (!kirim) onClose() }}>
      <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
        <div className="field">
          <span className="lbl">Gambar</span>
          <input type="file" accept="image/*" className="inp" onChange={pilihFile} required />
        </div>
        <div className="field">
          <span className="lbl">Judul (opsional)</span>
          <input className="inp" type="text" value={judul} onChange={(e) => setJudul(e.target.value)} placeholder="mis. Broker summary layar penuh — benar" />
        </div>
        <div className="field">
          <span className="lbl">Keterangan (opsional)</span>
          <input className="inp" type="text" value={keterangan} onChange={(e) => setKeterangan(e.target.value)} placeholder="Apa yang perlu diperhatikan dari contoh ini" />
        </div>
        <div className="field">
          <span className="lbl">Jenis contoh</span>
          <div style={{ display: 'flex', gap: 14, fontSize: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <input type="radio" name="benar" checked={benar} onChange={() => setBenar(true)} /> Benar
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <input type="radio" name="benar" checked={!benar} onChange={() => setBenar(false)} /> Terpotong (contoh salah)
            </label>
          </div>
        </div>
        <div className="field">
          <span className="lbl">Urutan</span>
          <input className="inp" type="number" style={{ width: 80 }} value={urutan} onChange={(e) => setUrutan(Number(e.target.value) || 0)} />
        </div>
        <button type="submit" className="btn-p" disabled={kirim}>{kirim ? 'Mengunggah…' : 'Tambah'}</button>
        {err && <p className="af-err" style={{ margin: 0 }}>{err}</p>}
      </form>
    </ModalKecil>
  )
}
