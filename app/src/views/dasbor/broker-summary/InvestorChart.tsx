import { useMemo, useState } from 'react'
import {
  PERIODE_ALIRAN, irisPeriode, ringkasAliran, useAliranInvestor,
  type IdPeriodeAliran, type KelompokAliran,
} from '../../../lib/dasbor/aliranInvestor'
import { PemilihRentang } from '../../../components/dasbor/PemilihRentang'
import { teksRentang } from '../../../components/dasbor/LabelRentang'
import { IkonMenu, IKON_OMBAK } from '../../../components/dasbor/IkonMenu'

/**
 * "Aliran Investor" — belahan asing vs domestik di tingkat pasar (B36).
 *
 * Meniru SIFAT panel Investor Chart RTI Business (`data ide/`, 21 Agu 2026):
 * satu layar yang menjawab "hari/pekan/tahun ini, uang asing masuk atau
 * keluar, dan seberapa besar porsinya dibanding domestik". Rumus &
 * kalibrasinya di `lib/dasbor/aliranInvestor.ts`.
 *
 * Yang SENGAJA berbeda dari acuannya: panel RTI mencetak tiga blok setara
 * (Volume, Turnover, Frequency) seolah ketiganya sama-sama terukur. Punya
 * kita memisahkan tingkat kepastiannya — volume nyata, rupiah taksiran,
 * frekuensi tanpa belahan sama sekali — karena menyandingkan angka terukur
 * dan angka taksiran tanpa penanda adalah cara paling halus untuk berbohong.
 */

const nf = (v: number, des = 0) =>
  v.toLocaleString('id-ID', { minimumFractionDigits: des, maximumFractionDigits: des })

/** Lembar → "44,1 miliar lembar". */
function fLembar(v: number): string {
  const a = Math.abs(v)
  if (a >= 1e12) return `${nf(v / 1e12, 2)} triliun`
  if (a >= 1e9) return `${nf(v / 1e9, 2)} miliar`
  if (a >= 1e6) return `${nf(v / 1e6, 1)} juta`
  return nf(v)
}

/** Rupiah → "Rp 5,4 T". */
function fRupiah(v: number): string {
  const a = Math.abs(v)
  const t = v < 0 ? '−' : ''
  if (a >= 1e12) return `${t}Rp ${nf(a / 1e12, 2)} T`
  if (a >= 1e9) return `${t}Rp ${nf(a / 1e9, 1)} M`
  if (a >= 1e6) return `${t}Rp ${nf(a / 1e6, 1)} jt`
  return `${t}Rp ${nf(a)}`
}

const fPersen = (v: number) => `${nf(v, 2)}%`

/**
 * Empat batang: FBuy · FSell · DBuy · DSell.
 *
 * Tingginya relatif terhadap batang TERBESAR di kelompok itu, bukan terhadap
 * 50% — dengan skala tetap, kelompok yang porsinya timpang (frekuensi asing
 * biasanya di bawah 8%) tergambar sebagai empat batang kerdil yang tak bisa
 * dibandingkan satu sama lain.
 */
function Batang({ k, format }: { k: KelompokAliran; format: (v: number) => string }) {
  const sisi = [
    { id: 'FBuy', s: k.fBeli, kelas: 'ai-f-beli', judul: 'Asing beli' },
    { id: 'FSell', s: k.fJual, kelas: 'ai-f-jual', judul: 'Asing jual' },
    { id: 'DBuy', s: k.dBeli, kelas: 'ai-d-beli', judul: 'Domestik beli' },
    { id: 'DSell', s: k.dJual, kelas: 'ai-d-jual', judul: 'Domestik jual' },
  ]
  const maks = Math.max(...sisi.map((x) => x.s.nilai), 1)
  return (
    <div className="ai-batang">
      {sisi.map((x) => (
        <div className="ai-kolom" key={x.id} title={`${x.judul} — ${format(x.s.nilai)} (${fPersen(x.s.persen)})`}>
          <span className="ai-persen">{fPersen(x.s.persen)}</span>
          <span className="ai-bar">
            <i className={x.kelas} style={{ height: `${(x.s.nilai / maks) * 100}%` }} />
          </span>
          <span className="ai-nama">{x.id}</span>
          <span className="ai-nilai">{format(x.s.nilai)}</span>
        </div>
      ))}
    </div>
  )
}

export function InvestorChart() {
  const data = useAliranInvestor()
  const [periode, setPeriode] = useState<IdPeriodeAliran>('h1')

  const ringkas = useMemo(
    () => (data ? ringkasAliran(irisPeriode(data.d, periode)) : null),
    [data, periode],
  )

  if (!data || !ringkas) return null

  const jendela = teksRentang(ringkas.mulai, ringkas.akhir, ringkas.hari)

  return (
    <section className="panel ai-panel" style={{ marginTop: 14 }}>
      <div className="panel-h">
        <span className="lbl"><IkonMenu d={IKON_OMBAK} size={13} /> Aliran Investor — Asing vs Domestik</span>
        <PemilihRentang
          opsi={PERIODE_ALIRAN}
          nilai={periode}
          onGanti={setPeriode}
          ariaLabel="Periode aliran investor"
        />
      </div>
      <div className="panel-b">
        <p className="sub ai-jendela">{jendela} · pasar reguler, {nf(data.d[data.d.length - 1][1])} emiten</p>

        <div className="ai-grup">
          <div className="ai-kepala">
            <span className="lbl">Volume (lembar)</span>
            <span className="sub">{fLembar(ringkas.volume.total)} · net asing{' '}
              <b className={ringkas.volume.net >= 0 ? 'up' : 'down'}>
                {ringkas.volume.net >= 0 ? '+' : '−'}{fLembar(Math.abs(ringkas.volume.net))}
              </b>
            </span>
          </div>
          <Batang k={ringkas.volume} format={fLembar} />
        </div>

        <div className="ai-grup">
          <div className="ai-kepala">
            <span className="lbl">
              Nilai (rupiah)
              {/* Penanda menempel pada BELAHANNYA, bukan pada seluruh baris:
                  totalnya angka IDX, dan net-nya — kalau tersedia — juga. */}
              <span className="ai-tanda" title="Belahan asing beli/jual adalah taksiran; total & net memakai angka IDX">
                belahan taksiran
              </span>
            </span>
            <span className="sub">{fRupiah(ringkas.nilai.total)} · net asing{' '}
              {ringkas.netResmi !== null ? (
                <>
                  <b className={ringkas.netResmi >= 0 ? 'up' : 'down'}>
                    {ringkas.netResmi >= 0 ? '+' : '−'}{fRupiah(Math.abs(ringkas.netResmi))}
                  </b>
                  <span className="ai-sumber"> angka resmi IDX</span>
                </>
              ) : (
                <>
                  <b className={ringkas.nilai.net >= 0 ? 'up' : 'down'}>
                    {ringkas.nilai.net >= 0 ? '+' : '−'}{fRupiah(Math.abs(ringkas.nilai.net))}
                  </b>
                  <span className="ai-sumber" title={`${ringkas.hariTanpaResmi} hari di periode ini tak punya angka resmi`}>
                    {' '}taksiran — {ringkas.hariTanpaResmi} hari tanpa angka resmi
                  </span>
                </>
              )}
            </span>
          </div>
          <Batang k={ringkas.nilai} format={fRupiah} />
        </div>

        <div className="ai-grup ai-frek">
          <div className="ai-kepala">
            <span className="lbl">Frekuensi</span>
            <span className="sub">{nf(ringkas.frekuensi)} kali</span>
          </div>
          <p className="sub">
            IDX <b>tidak</b> membelah frekuensi jadi asing dan domestik. Yang ada cuma totalnya,
            dan menaksir belahannya berarti mengarang angka yang tak pernah dilaporkan siapa pun —
            jadi baris ini berhenti di sini.
          </p>
        </div>

        <p className="sub ai-catatan">
          <b>Yang perlu diketahui sebelum membacanya.</b> Belahan asing/domestik hanya ada untuk
          <b> pasar reguler</b>. Periode ini punya {fLembar(ringkas.nonRegulerVol)} lembar di pasar
          non-reguler (negosiasi &amp; tunai) — <b>{fPersen(ringkas.nonRegulerPersen)}</b> dari seluruh
          volume papan — dan IDX tak melaporkan siapa pembelinya, jadi bagian itu tak terjawab di sini.
          {' '}<b>Belahan</b> beli/jual rupiah adalah taksiran (lembar × harga rata-rata tiap emiten):
          IDX melaporkan aliran asing dalam lembar saja. Diukur atas 138 hari yang punya angka resmi,
          arahnya cocok <b>91%</b> hari dan median hariannya <b>0,94×</b> — tapi dijumlah, kumulatifnya
          <b> 1,33×</b>: galatnya miring, bukan acak. Karena itu <b>net</b> di atas memakai angka resmi
          IDX kalau seluruh hari di periode ini punya, dan taksiran hanya menanggung bagian yang memang
          tak pernah dilaporkan siapa pun — belahan beli lawan jualnya.
        </p>
      </div>
    </section>
  )
}
