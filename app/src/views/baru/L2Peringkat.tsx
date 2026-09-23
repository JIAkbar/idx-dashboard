import { useState } from 'react'
import { useDsTerbaru, useJson, angka, tanggalPendek } from './data'
import { Hero, Blok, BarisBatang, Pil, Keadaan } from './ui'
import { KakiBaru } from './KakiBaru'

interface ItemSaham { c: string; v: number; p: number }
interface ItemBroker { cd: string; nm: string; v: number; p: number }

interface DsPeringkat {
  date_iso: string
  freq_today: number
  top_val: ItemSaham[]
  top_vol: ItemSaham[]
  top_freq: ItemSaham[]
  broker_val: ItemBroker[]
  broker_freq: ItemBroker[]
}

interface BrokerRentang {
  mulai: string
  akhir: string
  n_hari: number
  broker_val: ItemBroker[]
}

/** Baris peringkat saham: kode + bar + persen. Baris 01 emas, sisanya biru. */
function DaftarSaham({ item, terbesar }: { item: ItemSaham[]; terbesar: number }) {
  return (
    <div className="bb-daftar">
      {item.map((x, i) => (
        <BarisBatang key={x.c} kode={x.c} lebar={(x.p / terbesar) * 100} nilai={`${angka(x.p, 1)}%`} warna={i === 0 ? 'emas' : 'biru'} />
      ))}
    </div>
  )
}

/** Baris peringkat broker: kode + nama + bar + persen. */
function DaftarBroker({ item, terbesar }: { item: ItemBroker[]; terbesar: number }) {
  return (
    <div className="bb-daftar">
      {item.map((x, i) => (
        <BarisBatang key={x.cd} kode={x.cd} nama={x.nm} lebar={(x.p / terbesar) * 100} nilai={`${angka(x.p, 1)}%`} warna={i === 0 ? 'emas' : 'biru'} />
      ))}
    </div>
  )
}

export default function L2Peringkat() {
  const { data: d, tanggal, galat } = useDsTerbaru<DsPeringkat>()
  // #230: pil rentang dulu mati (tanpa onClick). Data rentang hanya ada untuk
  // broker, jadi pilihnya duduk di blok broker: 5 hari, 1 bulan, 3 bulan.
  const [rentang, setRentang] = useState<'w1' | 'b1' | 'b3'>('w1')
  const { data: w1 } = useJson<BrokerRentang>(`/data-idx/json/broker_rentang/${rentang}.json`)

  if (!d || !tanggal) return <Keadaan galat={galat} />

  const konsentrasi = d.top_val.reduce((s, x) => s + x.p, 0)
  const top3Nilai = d.top_val.slice(0, 3)
  const sumTop3Nilai = top3Nilai.reduce((s, x) => s + x.p, 0)
  const top3Broker = d.broker_val.slice(0, 3)
  const sumTop3Broker = top3Broker.reduce((s, x) => s + x.p, 0)

  return (
    <div className="bb-isi">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
        <Hero
          label="Konsentrasi nilai transaksi"
          angka={`${angka(konsentrasi, 1)}%`}
          sub={`${d.top_val.length} saham teratas memegang ${angka(konsentrasi, 1)}% nilai transaksi hari ini, ${tanggalPendek(tanggal)}.`}
        />
      </div>

      <div className="bb-tiga">
        <Blok judul="Top saham · nilai" catatan="% dari total nilai hari ini" narasi={`${top3Nilai.map((x) => x.c).join('-')} menyerap ${angka(sumTop3Nilai, 1)}% nilai transaksi hari ini.`}>
          <DaftarSaham item={d.top_val} terbesar={d.top_val[0].p} />
        </Blok>
        <Blok judul="Top broker · nilai" catatan="% dari total nilai transaksi" narasi={`Tiga broker teratas menyerap ${angka(sumTop3Broker, 1)}% nilai hari ini.`}>
          <DaftarBroker item={d.broker_val} terbesar={d.broker_val[0].p} />
        </Blok>
        {w1 ? (
          <Blok judul={`Broker pasar · ${w1.n_hari} hari bursa`} catatan={`${tanggalPendek(w1.mulai)} – ${tanggalPendek(w1.akhir)} · % dari nilai transaksi periode`} narasi={`Tiga broker teratas menyerap ${angka(w1.broker_val.slice(0, 3).reduce((s, x) => s + x.p, 0), 1)}% dari total periode ${w1.n_hari} hari.`}>
            <div className="bb-pils" role="group" aria-label="Rentang">
              <Pil aktif={rentang === 'w1'} onClick={() => setRentang('w1')}>5 hari</Pil>
              <Pil aktif={rentang === 'b1'} onClick={() => setRentang('b1')}>1 bulan</Pil>
              <Pil aktif={rentang === 'b3'} onClick={() => setRentang('b3')}>3 bulan</Pil>
            </div>
            <DaftarBroker item={w1.broker_val} terbesar={w1.broker_val[0].p} />
          </Blok>
        ) : (
          <Blok judul="Broker pasar"><Keadaan /></Blok>
        )}
      </div>

      <div className="bb-tiga">
        <Blok judul="Top saham · volume" catatan="% dari volume hari ini" narasi={`${d.top_vol[0].c} sendiri ${angka(d.top_vol[0].p, 1)}% dari seluruh lembar yang berpindah hari ini.`}>
          <DaftarSaham item={d.top_vol.slice(0, 5)} terbesar={d.top_vol[0].p} />
        </Blok>
        <Blok judul="Top saham · frekuensi" catatan="% dari frekuensi hari ini" narasi={`Lima saham teratas memegang ${angka(d.top_freq.slice(0, 5).reduce((s, x) => s + x.p, 0), 1)}% dari ${angka(d.freq_today / 1000, 2)} juta transaksi hari ini.`}>
          <DaftarSaham item={d.top_freq.slice(0, 5)} terbesar={d.top_freq[0].p} />
        </Blok>
        <Blok judul="Top broker · frekuensi" catatan="% dari frekuensi hari ini" narasi={`${d.broker_freq[0].cd} mencatat ${angka(d.broker_freq[0].p, 1)}% dari seluruh frekuensi transaksi hari ini.`}>
          <DaftarBroker item={d.broker_freq.slice(0, 5)} terbesar={d.broker_freq[0].p} />
        </Blok>
      </div>

      <KakiBaru sumber="Peringkat dari ringkasan harian resmi bursa. Broker 5 hari dari rekap resmi periode berjalan. Nilai dalam rupiah; M = miliar." />
    </div>
  )
}
