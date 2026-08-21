import { IkonJenjang } from './IkonJenjang'
import type { JenjangRow } from '../../lib/jenjang'

/**
 * Kalimat penutup per jenjang.
 *
 * Bukan template "Selamat! Terus semangat!" yang sama untuk semua tingkat —
 * tiap jenjang punya arti berbeda dan kalimatnya menyebut apa yang berubah.
 * Nadanya menghargai kerja yang sudah dilakukan, bukan menagih kerja
 * berikutnya: orang yang baru naik pangkat tidak sedang butuh dorongan.
 */
const PESAN: Record<number, string> = {
  1: 'Sepuluh setoran pertama itu bagian yang paling sepi. Kamu melewatinya.',
  2: 'Tiga puluh setoran lolos kurasi — bacaan broker summary-mu sudah bisa diandalkan.',
  3: 'Emas dibuka di 75 setoran dengan akurasi 80%. Angka itu tidak bisa dikejar buru-buru.',
  4: 'Platinum: kamu sekarang boleh menyetor bahan Deep Dive, terbitan satu emiten satu edisi.',
  5: 'Diamond. Namamu masuk bulletin, dan usul emitenmu naik ke antrean prioritas.',
}

/**
 * Modal perayaan kenaikan jenjang kontributor.
 *
 * Muncul sekali per kenaikan (penanda tier di localStorage, lihat
 * lib/sambutan.ts `kunciJenjang`/`perluRayakan`) — termasuk saat kenaikannya
 * terjadi di tengah sesi karena setoran baru saja disetujui.
 *
 * Isinya menyebut yang BERUBAH, bukan cuma memberi selamat: kuota harian baru
 * dan hak yang terbuka. Ucapan tanpa isi cepat jadi gangguan yang orang
 * pelajari untuk ditutup tanpa dibaca.
 */
export function ModalNaikJenjang({
  jenjang, kuotaBaru, onTutup,
}: {
  jenjang: JenjangRow
  /** Kuota efektif SESUDAH naik — sudah memperhitungkan kuota manual. */
  kuotaBaru: number
  onTutup: () => void
}) {
  return (
    <div className="dasbor-modal-bg" onClick={onTutup}>
      <div
        className="lantai dasbor-modal"
        role="dialog" aria-modal="true" aria-label={`Naik jenjang ${jenjang.nama}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="panel njg">
          <div className="njg-kepala">
            <IkonJenjang tier={jenjang.tier} nama={jenjang.nama} size={76} />
            <span className="njg-eyebrow">Jenjang naik</span>
            <b className="njg-nama">{jenjang.nama}</b>
          </div>

          <div className="panel-b njg-isi">
            <div className="njg-angka">
              <div>
                <span className="l">Kuota harian</span>
                <b>{kuotaBaru} broker summary</b>
              </div>
              <div>
                <span className="l">Terbuka</span>
                <b>{jenjang.hak ?? '—'}</b>
              </div>
            </div>

            <p className="njg-pesan">{PESAN[jenjang.tier] ?? 'Setoranmu yang lolos kurasi membawamu ke sini.'}</p>

            <p className="njg-kaki">
              Jenjang berikutnya menunggu di setoran yang lolos kurasi berikutnya — bukan di
              lama berlangganan.
            </p>

            <button type="button" className="btn-p njg-tombol" onClick={onTutup}>Lanjut menyetor</button>
          </div>
        </div>
      </div>
    </div>
  )
}
