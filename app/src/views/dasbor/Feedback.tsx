/** Port dari index_live.html baris 2147-2181 (panel #feedback) — statis, link wa.me. */
const TOPICS = [
  '📅 Penambahan Data Baru',
  '📊 Analisa & Visualisasi',
  '⚙️ Fitur Baru',
  '🐛 Laporan Bug',
  '💡 Ide Lainnya',
]

const WA_HREF =
  'https://wa.me/628990447098?text=Halo%20JIA%2C%20saya%20ingin%20menyampaikan%20masukan%20terkait%20IDX%20Market%20Intelligence%20Dashboard%3A%0A%0A'

export function Feedback() {
  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      <div className="card" style={{ padding: '28px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>💬</div>
        <div className="ct b" style={{ fontSize: 18, marginBottom: 6 }}>Kritik & Saran</div>
        <p style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 24, lineHeight: 1.7 }}>
          Kami terbuka untuk masukan dari Anda! Sampaikan kritik, saran, atau permintaan seputar
          dashboard ini langsung via WhatsApp.
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 28 }}>
          {TOPICS.map((t) => (
            <span
              key={t}
              style={{
                background: 'var(--green-bg)', color: 'var(--green-txt)',
                padding: '5px 14px', borderRadius: 20, fontSize: 11, fontWeight: 600,
              }}
            >
              {t}
            </span>
          ))}
        </div>

        <a
          href={WA_HREF}
          target="_blank"
          rel="noopener"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            background: '#25D366', color: '#fff', textDecoration: 'none',
            padding: '13px 28px', borderRadius: 10, fontSize: 14, fontWeight: 700,
            boxShadow: '0 4px 16px rgba(37,211,102,0.35)',
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
          Kirim via WhatsApp
        </a>

        <p style={{ fontSize: 10, color: 'var(--text3)', marginTop: 20 }}>
          📞 +62 899-0447-098 &nbsp;·&nbsp; Johan Iriawan Akbar
        </p>
      </div>
    </div>
  )
}
