import { useState } from 'react'

/**
 * Kritik & Saran — redesain full gaya Lantai Bursa (#37b). Sebelumnya satu
 * kartu tengah dengan style inline + pill topik dekoratif (tak berfungsi).
 * Sekarang: panel form sungguhan (.field/.lbl/.inp, radio topik jadi .tabs
 * aktif) yang isinya ikut terangkai ke pesan WhatsApp — bukan cuma kalimat
 * statis. WhatsApp tetap satu-satunya kanal (tak ada backend), tapi topik +
 * pesan yang diisi user ikut terkirim, bukan diketik ulang manual.
 */
const TOPIK = [
  { id: 'data', label: 'Data Baru' },
  { id: 'analisa', label: 'Analisa & Visualisasi' },
  { id: 'fitur', label: 'Fitur Baru' },
  { id: 'bug', label: 'Laporan Bug' },
  { id: 'lain', label: 'Lainnya' },
]

const NOMOR_WA = '628990447098'

export function Feedback() {
  const [topik, setTopik] = useState(TOPIK[0].id)
  const [pesan, setPesan] = useState('')

  const labelTopik = TOPIK.find((t) => t.id === topik)?.label ?? ''
  const teks =
    `Halo JIA, saya ingin menyampaikan masukan terkait PAPAN — Pusat Analisa Pasar Nusantara.\n\n` +
    `Topik: ${labelTopik}\n` +
    (pesan.trim() ? `Pesan: ${pesan.trim()}` : 'Pesan: ')
  const hrefWa = `https://wa.me/${NOMOR_WA}?text=${encodeURIComponent(teks)}`

  return (
    <div className="lantai">
      <div className="vhead">
        <h1>Kritik &amp; Saran</h1>
        <span className="sub">masukan langsung ke pengembang, dibalas via WhatsApp</span>
      </div>

      <div className="grid2">
        <div className="panel">
          <div className="panel-h"><span className="lbl">Tulis Masukan</span></div>
          <div className="panel-b" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="field">
              <span className="lbl">Topik</span>
              <div className="tabs" role="radiogroup" aria-label="Topik masukan" style={{ flexWrap: 'wrap' }}>
                {TOPIK.map((t) => (
                  <label key={t.id} className={'tab' + (topik === t.id ? ' on' : '')} style={{ cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="topik"
                      checked={topik === t.id}
                      onChange={() => setTopik(t.id)}
                      style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
                    />
                    {t.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="field">
              <span className="lbl">Pesan</span>
              <textarea
                className="inp"
                name="pesan"
                rows={5}
                placeholder="Ceritakan detailnya — mis. tanggal data yang bolong, langkah yang bikin bug muncul, atau fitur yang Anda mau…"
                value={pesan}
                onChange={(e) => setPesan(e.target.value)}
                style={{ resize: 'vertical', fontFamily: 'inherit' }}
              />
            </div>

            <a
              href={hrefWa}
              target="_blank"
              rel="noopener"
              className="btn-p"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, width: 'fit-content' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              Kirim via WhatsApp
            </a>
            <span className="muted" style={{ fontSize: 11 }}>
              Tombol membuka WhatsApp dengan topik &amp; pesan di atas sudah terisi — tinggal tinjau lalu kirim.
            </span>
          </div>
        </div>

        <div className="panel">
          <div className="panel-h"><span className="lbl">Kontak Langsung</span></div>
          <div className="panel-b" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="vcard">
              <span className="lbl">Pengembang</span>
              <span className="num" style={{ fontSize: 15 }}>Johan Iriawan Akbar</span>
              <span className="v-note">+62 899-0447-098 &middot; WhatsApp</span>
            </div>
            <p className="muted" style={{ margin: 0, fontSize: 12, lineHeight: 1.7 }}>
              PAPAN dikembangkan &amp; dirawat satu orang di luar jam kerja — respons masukan
              biasanya di hari yang sama, kadang lebih lama saat musim laporan keuangan ramai.
              Laporan bug dengan tanggal/saham/langkah reproduksi jelas paling cepat ditindaklanjuti.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
