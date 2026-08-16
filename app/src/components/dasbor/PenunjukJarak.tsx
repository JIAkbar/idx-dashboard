import type { JarakJenjang } from '../../lib/jarakJenjang'

/**
 * Kalimat "tinggal berapa lagi" untuk halaman/tab yang terkunci jenjang.
 *
 * Satu sumber kalimat supaya tab Seasonality dan halaman penuh (Radar dkk)
 * tidak menjelaskan syarat yang sama dengan dua bunyi berbeda — `className`
 * dibiarkan dipilih pemanggil karena bingkainya memang beda (kartu penjaga
 * vs panel tab).
 */
export function PenunjukJarak({ jarak, className }: { jarak: JarakJenjang; className: string }) {
  return (
    <p className={className}>
      {jarak.kurangSetoran > 0
        ? <><b>{jarak.kurangSetoran} setoran broker summary lagi</b> yang disetujui untuk mencapai {jarak.nama}.</>
        : <>Jumlah setoranmu sudah cukup untuk {jarak.nama}.</>}
      {jarak.akurasiKurang !== null && (
        <> Akurasimu juga perlu naik <b>{jarak.akurasiKurang} poin</b> — keduanya harus terpenuhi bersamaan.</>
      )}
    </p>
  )
}
