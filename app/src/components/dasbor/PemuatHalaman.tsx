/**
 * Pemuat halaman — kerangka panel, bukan kata "Memuat…".
 *
 * Teks statis di tengah layar kosong tak membedakan "sebentar lagi datang"
 * dari "menggantung", dan justru menarik perhatian ke penungguannya. Kerangka
 * yang berdenyut menempati bentuk yang akan diisi: mata sudah tahu di mana
 * judul dan tabelnya akan muncul, jadi pergantiannya tidak terasa seperti
 * halaman melompat.
 *
 * Sengaja dibiarkan statis (tanpa data, tanpa efek) supaya ikut masuk bundle
 * utama — pemuat yang harus diunduh dulu adalah pemuat yang datang terlambat.
 */
export function PemuatHalaman() {
  return (
    <div className="lantai pemuat" role="status" aria-label="Memuat halaman">
      <div className="pemuat-judul" />
      <div className="pemuat-panel">
        <div className="pemuat-baris" style={{ width: '38%' }} />
        <div className="pemuat-baris" style={{ width: '92%' }} />
        <div className="pemuat-baris" style={{ width: '76%' }} />
        <div className="pemuat-baris" style={{ width: '84%' }} />
      </div>
      <div className="pemuat-grid">
        <div className="pemuat-kartu" />
        <div className="pemuat-kartu" />
        <div className="pemuat-kartu" />
      </div>
    </div>
  )
}
