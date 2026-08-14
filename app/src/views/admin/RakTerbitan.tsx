import { useBulletinList } from '../../lib/dasbor/bulletin'
import { IkonMenu, IKON_KOTAK_ARSIP } from '../../components/dasbor/IkonMenu'

/** Blok kosong seragam utk panel tanpa isi — pola fd-empty StockDetail.tsx,
 *  disalin dari UnggahHarian.tsx (dipakai 2 tab, terlalu kecil utk diekstrak
 *  jadi komponen bersama lintas modul — 4 baris). */
function PanelKosong({ ikon, pesan, petunjuk }: { ikon: string; pesan: string; petunjuk?: string }) {
  return (
    <div className="fd-empty" style={{ padding: '28px 16px' }}>
      <p style={{ marginBottom: 8 }}><IkonMenu d={ikon} size={26} /></p>
      <p>{pesan}</p>
      {petunjuk && <p style={{ fontSize: 10, marginTop: 6 }}>{petunjuk}</p>}
    </div>
  )
}

/**
 * Tab "Rak Terbitan" (/admin/terbitan) — arsip edisi bulletin (dipindah apa
 * adanya dari AdminHome.tsx lama). Changelog dipisah ke tabnya sendiri
 * (sama-sama "hal yang sudah terbit/dirilis"). Rak baca manifest publik
 * keluaran/index.json (sumber sama dengan halaman Bulletin) — BUKAN tabel
 * Supabase `edisi` (alur lama, kosong): edisi dirakit dari repo, tabel itu
 * tidak pernah diisi pipeline sekarang.
 */
export function RakTerbitan() {
  const { daftar: edisi, error: err } = useBulletinList()

  return (
    <>
      <section className="panel">
        <div className="panel-h"><span className="lbl">Rak terbitan</span></div>
        <div className="panel-b">
          <p className="muted" style={{ marginTop: 0, fontSize: 11 }}>
            Arsip edisi bulletin yang sudah dirakit dari unggahan.
          </p>
          {err && <p className="muted" style={{ color: 'var(--red)' }}>Gagal memuat daftar: {err}</p>}
          {edisi && edisi.length === 0 && (
            <PanelKosong
              ikon={IKON_KOTAK_ARSIP}
              pesan="Belum ada edisi terbit."
              petunjuk="Edisi yang sudah dirakit dari unggahan akan tampil di rak ini."
            />
          )}
          {edisi && edisi.length > 0 && (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Kode</th>
                  <th>Tanggal</th>
                  <th>Status</th>
                  <th className="r">Emiten</th>
                  <th className="r">PDF</th>
                </tr>
              </thead>
              <tbody>
                {edisi.map((r) => (
                  <tr key={r.kode}>
                    <td>
                      <span className="tick">{r.kode}</span>
                      {r.update_dari != null && r.emiten.length > r.update_dari && (
                        <span
                          className="bchip"
                          title={`Dirilis ulang: ${r.update_dari} menjadi ${r.emiten.length} emiten`}
                          style={{
                            marginLeft: 6, fontFamily: 'var(--mono)', fontWeight: 700,
                            background: 'var(--amber-dim)', color: 'var(--amber)', borderColor: 'var(--amber)',
                          }}
                        >
                          Update {r.update_dari}→{r.emiten.length}
                        </span>
                      )}
                    </td>
                    <td>{r.tanggal_id}</td>
                    <td><span className="chip up">terbit</span></td>
                    <td className="r num">{r.emiten.length}</td>
                    <td className="r">
                      <a
                        className="blt-dl"
                        href={`/arus-pasar/keluaran/${r.pdf}`}
                        target="_blank"
                        rel="noopener"
                        title={`Buka ${r.pdf}`}
                      >
                        Lihat
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </>
  )
}
