# Spek #231 — lima layar utama PAPAN Baru

Johan 23 Sep 2026: *"kerjakan #231 semua"*. Rancangan acuan (artboard statis
yang disetujui) di
`C:\Users\Johan\AppData\Local\Temp\claude\C--1-Johan-10--Pengembangan-IDX-Statistik--claude-worktrees-artifact-react-migration-c789ac\75a683d6-803d-4335-8426-5ff9ad855bb2\scratchpad\reimagine\project\`:
`Main.dc.html` (Layar Tanya), `Peta.dc.html` (Peta Pasar Hidup),
`Emiten.dc.html` (Emiten sebagai cerita), `Rekam.dc.html` (Rekam Jejak Jujur),
`Pagi.dc.html` (Kartu Pagi) — plus `-Tel` untuk telepon bila ada. Tiru SUSUNAN
dan isi bloknya; ANGKA di artboard hanya contoh — semua angka dihitung dari data.

Worktree `C:\tmp\wt-reimag`. Python `C:\Python314\python.exe`. JANGAN git,
JANGAN dev server/browser (pemanggil memverifikasi).

## Aturan bersama halaman (sama dengan #586)
Baca `docs/spek-dev-papan/` tidak perlu; baca kode yang ada:
- Kerangka & rute SUDAH dipasang (`App.tsx`, `views/baru/BaruLayout.tsx`,
  `views/baru/peta.ts`). Berkas halamanmu sudah ada sebagai kerangka.
- Pakai `views/baru/data.ts` (`useJson`, `useDsTerbaru`, `angka`, `bertanda`,
  `rupiah`, `tanggalPendek`), `views/baru/ui.tsx` (`Hero`, `Blok`,
  `BarisBatang`, `Ringkas`, `Arah`, `Keadaan`, `Pil`), kelas `bb-*` di
  `views/baru/baru.css` (JANGAN disunting; gaya tambahan = style inline),
  `<KakiBaru sumber="..."/>` di akhir.
- Semua angka dari data saat dimuat; kalimat narasi dirakit dari angka. Ruas
  yang tak ada: tulis "tidak tersedia", jangan mengarang.
- DILARANG di teks layar: nama berkas/jalur/endpoint/ruas mentah/nama fungsi.
- Hijau/merah hanya arah. Telepon: tak ada elemen > 390px, grid `minmax(0,1fr)`,
  kendali >= 44px, tabel lebar di `bb-tabel-wrap`.
- Verifikasi: `cd C:/tmp/wt-reimag/app && npx tsc -b` bersih.

## D. Data turunan broker (agen data)
Skrip baru `scripts/riset/ringkas_broker_harian.py` (`--uji` sintetis, `--tulis`).
Sumber TUNGGAL: `data-idx/json/broker_tahunan/<KODE>/<TAHUN>.json`
(ruas `hari[tgl].broker` = `[broker, beli_lot, beli_nilai, jual_lot, jual_nilai,
freq_beli, freq_jual, jenis]`, `hari[tgl].ringkas.accdist`, `.total_nilai`).
Net broker = beli_nilai − jual_nilai. Kelompok broker dibaca dari
`app/src/lib/dasbor/kelompokBroker.ts` (baris `XX: ['kelompok', 'Nama']`) —
jangan salin tangan; kode tak terdaftar = `lain`. Sektor dari
`data-idx/json/emiten_sektor.json` (`emiten[KODE].sektor`).
Keluaran:
1. `data-idx/json/peta_arus.json`:
   `{"tanggal": T, "n_emiten": n, "kelompok": ["asing","bumn","smart","ritel","afiliasi","lain"],
     "rentang": {"h1"|"h5"|"h20": {"mulai","akhir","n_hari",
        "total": {kelompok: net_rupiah},
        "sektor": {namaSektor: {"n_emiten": int, "nilai": total_nilai_rupiah,
                                 "porsi_nilai_pct": float, "net": {kelompok: net_rupiah}}}}}}`
   T = tanggal terakhir yang dimiliki mayoritas emiten; rentang = T dan 5/20
   hari bursa terakhir (tanggal dari data broker itu sendiri).
2. `data-idx/json/broker_puncak/<KODE>.json` (per emiten, 10 hari terakhir):
   `{"kode","hari":[{"tanggal","accdist","total_nilai",
      "beli":[[broker, net]] (3 net terbesar positif),
      "jual":[[broker, net]] (3 net terbesar negatif)}]}` urut tanggal naik.
Uji bawaan: pembagian kelompok dari kelompokBroker.ts (hitung kode terbaca),
jumlah net semua broker per emiten-hari ≈ 0 (cetak median |Σnet|/total_nilai
atas sampel 50 emiten), idempoten. Cetak cakupan: berapa emiten punya data di T.
Jangan sentuh bat/berkas lain (pemanggil yang menambahkan ke panen).

## 1. Layar Rekam — `views/baru/LayarRekam.tsx` (artboard Rekam)
Data: `data-idx/json/rapor_uji.json` (sumber redaksi/obv/rbs, h5/h20: win_rate,
pf, rata, median, acak_p50_pf, acak_p95_pf, ihsg_rata; pilihan[]),
`data-idx/json/bt_riset/ringkas.json` (arah[], riset_sebelumnya). Hero: PF
redaksi H+5 dan vonis jujur ("belum terbukti lebih baik" bila pf <= acak p95).
Kartu per sumber, kartu riset formula (lulus x dari 5 tahun), tabel pilihan
terbaru. Tautan ke `/rapor-uji` untuk rincian.

## 2. Kartu Pagi — `views/baru/LayarPagi.tsx` (artboard Pagi)
"Tiga hal sebelum bursa buka": (a) IHSG: `useDsTerbaru` (ihsg_pct, nf_today_idr)
+ kalimat; (b) watchlist berubah: daftar watchlist pembaca = sumber yang SAMA
dengan `views/baru/L5Watchlist.tsx` (baca cara ia memuat daftar, termasuk
contoh bila kosong); untuk tiap kode ambil `broker_puncak/<KODE>.json`, tandai
emiten yang pembeli terbesar kemarin kini ada di sisi jual (atau accdist
berbalik), kalimat "Pembeli terbesar dua hari lalu, XX, hari ini menjual";
(c) lonjakan: `gainers` di ds terbaru, ambil kenaikan terbesar, lalu dari
`ohlc/<KODE>.json` hitung kejadian lampau kenaikan harian >= 80% besarnya
dan return H+5 sesudahnya (n, median) — tulis "n kejadian, median H+5 x%";
kalau n < 5 tulis "terlalu sedikit untuk disimpulkan". Tautan tiap emiten ke
`ruteLayar('emiten', kode)` dari `peta.ts`.

## 3. Emiten sebagai cerita — `views/baru/LayarEmiten.tsx` (artboard Emiten)
Kode dari `useParams().kode` (default `EMITEN_BAWAAN`), pemilih emiten =
`PilihEmiten` dari `views/baru/l3-pilih.tsx` (lihat pemakaiannya di L3Berkas;
slug pemilih boleh 'harga' bila tak ada slug layar — periksa komponennya dan
sesuaikan supaya memilih emiten lain membuka /baru/emiten/<KODE>). Isi: kepala
(nama dari `kartu/<KODE>.json`, harga & perubahan terakhir), fase broker
(accdist 5 hari terakhir dari `broker_puncak` — "3 dari 5 hari terakhir
distribusi"), valuasi ringkas (PER/PBV/ROE dari `keystats_stockbit/<KODE>.json`
seperti L3Berkas), lalu CERITA berurut waktu 10 hari: tiap hari satu kalimat
berangka dari harga (`ohlc/<KODE>.json`), asing (`asing/<KODE>.json` — baca
bentuknya dulu) dan broker_puncak (pembeli/penjual terbesar + net). Tautan ke
lapisan emiten (harga, berkas, broker, broker-summary, musiman).

## 4. Peta Pasar Hidup — `views/baru/LayarPasar.tsx` (artboard Peta)
Data: `peta_arus.json`. Pil rentang hari/5 hari/20 hari. Blok utama: sektor
sebagai kotak/daftar berbobot `porsi_nilai_pct`, tiap sektor menampilkan net
kelompok yang dipilih (pil kelompok: Asing, BUMN, Institusi lokal, Ritel —
label dari `LABEL_KELOMPOK` di `lib/dasbor/kelompokBroker.ts`). Blok "Arus per
kelompok broker" (total). Catatan WAJIB di layar: "Kelompok = identitas broker
perantara, bukan kebangsaan atau jenis investor." dan cakupan (n emiten).
Hijau = net beli, merah = net jual.

## 5. Layar Tanya — `views/baru/LayarTanya.tsx` (artboard Main)
Pakai ulang mesin yang ada; JANGAN menulis mesin baru. Pelajari
`components/dasbor/TanyaPapan.tsx` (fungsi `kirim`, `ambilButuh`, pemakaian
`jawab`, `CONTOH_TANYA`, `tanyaAI` untuk yang login). Ekstrak logika tanya
(state riwayat, kirim, ambilButuh, konteks) ke hook baru
`lib/dasbor/useTanyaPapan.ts` yang dipakai KEDUA-DUANYA: panel lama
(`TanyaPapan.tsx`, perilakunya wajib identik) dan layar baru. Layar: judul
"Tanya pasar dengan bahasa biasa. Jawabannya angka, bukan opini.", kotak tanya
besar, pil contoh pertanyaan (`CONTOH_TANYA`), riwayat jawaban sebagai blok.
Uji yang ada (`lib/dasbor/*tanya*.test.ts`, `pengetahuan.test.ts`) wajib lulus:
`npx vitest run src/lib/dasbor`.
