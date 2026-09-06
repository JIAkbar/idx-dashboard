import { useState } from 'react'
import { PemilihRentang } from '../../components/dasbor/PemilihRentang'
import { StockAutocomplete } from '../../components/dasbor/StockAutocomplete'
import { useStockIndex } from '../../lib/dasbor/stockDetailData'
import { TransaksiTab } from './neo-papan/TransaksiTab'
import { InventoryTab } from './neo-papan/InventoryTab'
import { CompareTab } from './neo-papan/CompareTab'
import { StalkerTab } from './neo-papan/StalkerTab'
import { BalanceTab } from './neo-papan/BalanceTab'
import { SeasonTab } from './neo-papan/SeasonTab'
import { RotasiTab } from './neo-papan/RotasiTab'
import { ActivityTab } from './neo-papan/ActivityTab'
import { OPSI_RENTANG_NP, type RentangNp } from './neo-papan/bersama'

type Tab = 'transaksi' | 'inventory' | 'compare' | 'stalker' | 'balance' | 'season' | 'rotasi' | 'activity'

const TABS: { id: Tab; label: string }[] = [
  { id: 'transaksi', label: 'Transaction Chart' },
  { id: 'inventory', label: 'Inventory Chart' },
  { id: 'compare', label: 'Compare Inventory' },
  { id: 'stalker', label: 'Broker Stalker' },
  { id: 'balance', label: 'Balance Position' },
  { id: 'season', label: 'Seasonality' },
  { id: 'rotasi', label: 'Rotation Chart' },
  { id: 'activity', label: 'Sector/Index Activity' },
]

/**
 * Neo Papan — delapan tab analisis di atas arsip PAPAN (candle/broker/KSEI/
 * sektor), diadaptasi dari prototipe komunitas `dev-kuli-neo-papan`. Lot
 * Sizing SENGAJA tidak ikut — sudah diwakili halaman Kalkulator (keputusan
 * Johan). Pola halaman sama dengan Kuli Papan: satu bilah ganti emiten,
 * kotak "Sumber:" di tiap tab, keadaan kosong yang jujur soal cakupan
 * (bukan menampilkan nol untuk data yang belum ada).
 *
 * Tiap tab memuat datanya SENDIRI saat aktif (bukan semua di top level) —
 * Broker Stalker & dua tab sektor butuh ratusan berkas, tak boleh ikut
 * terunduh cuma karena pembaca sedang melihat Transaction Chart.
 */
export function NeoPapan() {
  const { index: indeks } = useStockIndex()
  const [tab, setTab] = useState<Tab>('transaksi')
  const [kode, setKode] = useState('BBCA')
  const [ketik, setKetik] = useState('BBCA')
  const [rentang, setRentang] = useState<RentangNp>('b3')

  return (
    <div className="lantai neo-papan">
      <div className="vhead">
        <h1>Neo Papan</h1>
      </div>

      {/* Bilah kendali berkelompok — sistem tata C+A (keputusan Johan 28
          Agu). Satu kelompok EMITEN: autocomplete kanonis (Johan 26 Agu:
          "buat semua kolom emiten seperti ini ada list emiten nya") + rentang
          candle saat tab Transaction Chart aktif. Kode TIDAK diulang di
          samping input (Johan 28 Agu, Whales Papan: "kode Emiten cukup 1
          saja yang di kolom yang di tampilkan"). */}
      <div className="bilah-kendali np-atur">
        <div className="grup-k">
          <div className="np-emiten">
            <StockAutocomplete
              stocks={indeks?.stocks || []}
              value={ketik}
              onChange={setKetik}
              onSelect={(v) => { setKetik(v); setKode(v.toUpperCase()) }}
              placeholder="Ganti emiten: BUMI, BBCA…"
            />
          </div>
          {(tab === 'transaksi') && (
            <PemilihRentang opsi={OPSI_RENTANG_NP} nilai={rentang} onGanti={setRentang} ariaLabel="Rentang candle" />
          )}
        </div>
      </div>

      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id}
            className={'tab' + (tab === t.id ? ' on' : '')}
            onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {tab === 'transaksi' && <TransaksiTab kode={kode} rentang={rentang} />}
      {tab === 'inventory' && <InventoryTab kode={kode} />}
      {tab === 'compare' && <CompareTab kode={kode} />}
      {tab === 'stalker' && <StalkerTab />}
      {tab === 'balance' && <BalanceTab kode={kode} />}
      {tab === 'season' && <SeasonTab kode={kode} />}
      {tab === 'rotasi' && <RotasiTab />}
      {tab === 'activity' && <ActivityTab />}
    </div>
  )
}
