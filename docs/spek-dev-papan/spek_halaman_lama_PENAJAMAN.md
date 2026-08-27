> **Verifikasi pengawas (Fable, 26 Agu 2026):** temuan 1.1, 1.2, 1.3 sudah kucek ulang sendiri ke kode dan **TERKONFIRMASI**.
> Catatan jujur: pengecekanku SEBELUM audit ini sempat menyatakan `VsIhsg.tsx` "bersih dari hardcode BUMI" — **itu salah**, karena grep-ku hanya mencari `'BUMI'` berkutip sedangkan keempat instansinya adalah teks JSX tanpa kutip. Audit ini menemukan apa yang verifikasiku lewatkan.
> Temuan 1.4 dan 1.5 belum kuverifikasi ulang secara mandiri — keduanya lolos verifikator workflow, tapi perlakukan sebagai **kuat, belum final** sampai pelaksana mengeceknya saat memperbaiki.

---

# Penajaman Spek — Halaman PAPAN yang Sudah Ada (audit kejujuran data, Fable 26 Agu 2026)

## 0. Ringkas

| Halaman | Temuan | Tingkat |
|---|---|---|
| IndeksDunia.tsx | Net Foreign & Market PER/PBV render "0" untuk data yang hilang | 🔴 |
| BrokerSummaryV2.tsx (VsIhsg.tsx + Overview.tsx) | String "BUMI" hardcode tampil untuk emiten apa pun | 🔴 |
| Screener.tsx | Tooltip "tak masuk peta sektor resmi" salah untuk 46 emiten, filter sektor rusak | 🔴 |
| KuliPapan.tsx (Kalkulator) | Alasan "P/B kosong" selalu menyalahkan mata uang, salah untuk ≥20 emiten | 🔴 |
| Seasonality.tsx / SeasonalityHarian.tsx | Hitungan hari bursa IHSG di-hardcode, sudah basi 14 hari (terus melebar) | 🟡 |
| KartuAnalisa.tsx | Stop-loss fallback 5% arbitrer tak ditandai ke pembaca; rumus musiman terduplikasi Python/TS | 🟡 |
| SektorIndeks, TopStocks, StatistikBerkala, TopBroker | Bersih pada apa yang dicek, tapi kelas 7/8 belum diverifikasi mendalam | ✅* |
| StockDetail.tsx, GrafikEmiten.tsx | Bersih | ✅ |
| PetaInvestor.tsx, BrokerSummary.tsx (v1) | Bersih | ✅ |
| AliranAsing.tsx | Bersih pada apa yang dicek, kelas 4 belum diverifikasi mendalam | ✅* |
| Radar.tsx, Watchlist.tsx | Bersih | ✅ |
| Bulletin.tsx, Kabar.tsx, ForumRuang.tsx, Metodologi.tsx, Glosarium | Bersih | ✅ |
| Trader Papan | **Tidak diaudit sama sekali** | ⬜ |
| Chart | **Tidak diaudit sama sekali** (identitas vs GrafikEmiten belum dikonfirmasi) | ⬜ |

## 1. Temuan 🔴 MENYESATKAN

### 1.1 `IndeksDunia.tsx:627-638, 658, 662` — Ruas kosong dicetak sebagai angka nol berwarna hijau
`fmtNF(hari.nf_today_idr ?? 0)` dan tiga saudaranya (`nf_today_usd`, `nf_ytd_idr`, `nf_ytd_usd`) mencetak `"+0,00"` dengan className `up` (hijau) begitu ruasnya `null`. Sama untuk `mkt_per`/`mkt_pbv` (`.toFixed(2)` pada fallback 0). **Bukti**: dicek ke 147 berkas `ds_*.json` — persis 8 hari kehilangan ruas net-foreign (`ds_260120`, `ds_260126`, `ds_260414`, `ds_260507`, `ds_260703`, `ds_260720`, `ds_260721`, `ds_260824`), persis 1 hari (`ds_260824`) kehilangan `mkt_per/mkt_pbv/usd_idr`. Komponen `PapanIhsg` di file yang sama (baris 502-508) sudah benar pakai `?? '—'` untuk ruas opsional serupa — dua standar berbeda dalam satu file.
**Dampak**: pembaca melihat "Net Foreign +0,00 (billion IDR)" hijau dan "Market PER 0.00" seolah data resmi net-zero, padahal artinya "belum ada data".
**Perbaikan**: pakai pola `meta` yang sudah ada — `hari.nf_today_idr == null ? '—' : fmtNF(...)`, tanpa className warna saat null; sama untuk `mkt_per`/`mkt_pbv`.

### 1.2 `broker-summary-v2/VsIhsg.tsx:109, 114, 136, 144` — "BUMI" hardcode di tab vs IHSG untuk emiten apa pun
Empty-state ("Tak cukup irisan tanggal **BUMI** vs IHSG"), caption legenda ("■ BUMI ■ IHSG"), dan dua label metrik ("Return BUMI", "Volatilitas BUMI") tetap literal string, walau dataset chart (baris 63) sudah dinamis (`label: kode`) dan komentar baris 39-40 mengklaim bug ini sudah diperbaiki ("temuan sweep #355"). Prop `kode` tersedia di scope tapi tidak dipakai di keempat tempat ini.
**Dampak**: buka tab "vs IHSG" untuk TLKM — kartu metrik tetap berbunyi "Return BUMI: +x%" dengan angka TLKM sungguhan; pembaca yang scan kartu (bukan chart) bisa salah kira sedang melihat BUMI.
**Perbaikan**: ganti keempat literal `'BUMI'` dengan `{kode}`.

### 1.3 `lib/dasbor/kelompokBroker.ts:33`, dirender di `broker-summary-v2/Overview.tsx:212` — deskripsi "Afiliasi" hardcode BUMI untuk semua emiten
`KETERANGAN_KELOMPOK.afiliasi = 'satu grup usaha dengan emiten — BUMI: belum ada yang terkurasi'` dipakai apa adanya di kartu Broker Analysis untuk emiten mana pun. Klasifikasi "afiliasi" per-desain berbeda per emiten, jadi menyebut BUMI di teks universal salah subjek, bukan cuma salah kata.
**Dampak**: buka Broker Analysis TLKM/BBCA — baris "Afiliasi grup/bandar" tetap menyebut BUMI, emiten yang sedang tidak dibuka.
**Perbaikan**: ganti jadi `'satu grup usaha dengan emiten — belum ada yang terkurasi'` (hapus nama emiten, konstannya memang belum per-emiten di implementasi saat ini).

> Catatan pola: dua hardcode BUMI ini (1.2 + 1.3) ditemukan independen di dua berkas berbeda — sesuai pelajaran proyek (`feedback_fix-instance-bukan-sistemik.md`), **wajib `grep -rn "'BUMI'" app/src` sekali lagi** sebelum menutup temuan ini untuk memastikan tidak ada instance ketiga yang belum tertangkap 6 auditor.

### 1.4 `app/scripts/bangun-screener.mjs:178` + `Screener.tsx:132-134` — Tooltip sektor salah untuk 46 emiten, filter rusak
`screener.json` mengambil `sektor: fund?.sector ?? '-'` (dari data fundamental), **bukan** dari `emiten_sektor.json` (peta IDX-IC resmi, 962/962 emiten terklasifikasi penuh). Tooltip UI mengklaim emiten `sektor:'-'` "tak masuk peta sektor resmi" — **salah**. **Bukti**: 46 emiten di screener.json ber-`sektor:'-'`; 20 sampel dicek ke `emiten_sektor.json` — semuanya punya sektor lengkap (mis. ARMY = "Properti & Real Estat", ENVY = "Teknologi").
**Dampak**: (a) pembaca percaya 46 emiten ini belum diklasifikasi BEI padahal datanya ada dan dipakai halaman lain; (b) filter Sektor Screener kehilangan 46 baris dari kelompok sektor yang benar (4/20 sampel salah kelompok).
**Perbaikan**: join `sektor` dari `emiten_sektor.json` di `bangun-screener.mjs` (fallback `fund?.sector ?? sektorResmi[kode] ?? '-'`), perbaiki teks tooltip begitu join benar.

### 1.5 `lib/dasbor/kuliPapanData.ts:99-103` — Alasan "P/B kosong" selalu menyalahkan mata uang
`alasanPbKosong` selalu berbunyi "laporan keuangannya dalam mata uang selain rupiah" begitu `pbTahunan` kosong, padahal `hitung_valuasi_historis.py` punya ≥4 jalur berbeda yang membuat emiten absen. **Bukti terverifikasi ulang**: 10 dari 14 emiten (BACH, EMMI, JECX, JELI, JMAS, KBRI, NUSA, PRDL, RANS, GOTOM) **tidak punya berkas `keuangan_idx/*.json` sama sekali**; COWL/GLOB/INTA/OCAP/TELE murni IDR tapi ekuitas negatif tiap tahun (bukan soal mata uang, `eq > 0` gagal).
**Dampak**: ≥20 emiten mendapat diagnosa salah ("laporan USD") padahal sebenarnya "rugi terus" atau "belum pernah dipanen" — bisa menyesatkan interpretasi fundamental.
**Perbaikan**: `hitung_valuasi_historis.py` menulis alasan spesifik per-kode (`non_idr`|`rugi`|`rasio_ekstrem`|`tak_ada_data`) ke `valuasi_historis.json`; `kuliPapanData.ts` membaca alasan itu, bukan menebak satu alasan generik.

## 2. Temuan 🟡 Perlu Diperjelas

### 2.1 `Seasonality.tsx:172` (+ komentar `SeasonalityHarian.tsx:56,101`) — hitungan hari bursa hardcode, basi 14 hari
Teks tab terkunci menyebut "**8.848** hari bursa IHSG sejak 1990" — data nyata (`ihsg_harian.json`) sekarang 8.862 hari dan terus bertambah tiap hari bursa. `SeasonalityHarian.tsx` sudah menghitung `tglTersedia.length` yang benar; `Seasonality.tsx` tidak memakainya.
**Perbaikan**: interpolasi dari `tglTersedia.length` / panjang `ihsg_harian.json`, atau ganti jadi frasa non-presisi ("ribuan hari bursa").

### 2.2 `scripts/riset/kartu_analisa.py:679-680` — Stop-loss fallback 5% tak ditandai ke pembaca
Kalau `sr()` (deteksi klaster support) balik kosong, `stop = harga × 0.95` dipakai diam-diam sebagai basis seluruh tabel first-passage (p_kena/p_stop/median hari) — angka arbitrer, bukan level historis, tanpa penanda ke UI.
**Perbaikan**: tulis `stop_asal: 'klaster'|'fallback5pct'` ke JSON, tampilkan catatan singkat di `KartuAnalisa.tsx` kalau fallback dipakai.

### 2.3 `kartu_analisa.py:561,592` vs `lib/seasonality.ts:80-101` — Rumus musiman terduplikasi (risiko, bukan bug aktif)
Rumus shrinkage (α=6) dan interval Wilson diimplementasi dua kali independen (Python untuk Kartu Analisa, TypeScript untuk Stock Detail). Saat ini identik — jadi bukan bug hidup — tapi tak ada mekanisme yang memaksa sinkron kalau salah satu direvisi.
**Perbaikan**: opsional — dokumentasikan silang eksplisit di kedua file agar revisi salah satu memicu pengecekan yang lain; tak mendesak.

### 2.4 (Sudah terselesaikan — jangan dikerjakan ulang) Dropdown "Market: Nego" di `BrokerSummaryV2.tsx`
Auditor sempat menandai dropdown ini sebagai kontrol mati (kelas 1/5). Verifikasi ke kode live menemukan opsi `nego` **sudah** diberi `nonaktif: true` + label "belum tersedia" + komentar yang justru mendeskripsikan bug ini — sudah diperbaiki sebelum sesi ini berjalan. Dicatat di sini supaya tidak "diperbaiki" lagi.

## 3. Pola Lintas-Halaman

1. **Hardcode BUMI berulang** (temuan 1.2 + 1.3) — ditemukan independen di dua modul berbeda oleh auditor yang sama. Jalankan satu `grep -rn "'BUMI'"` menyeluruh atas seluruh `app/src` sebelum menutup kategori ini.
2. **Rumus musiman terduplikasi Python↔TypeScript** (2.3) — pola risiko drift yang sama berpotensi terjadi di tempat lain; belum ada auditor yang menugaskan pencarian lintas-grup untuk kelas 6.
3. **Net-foreign/foreign-flow dihitung independen di ≥3 grup** (pasar: `nf_today_idr` IndeksDunia; aliran: BrokerSummary/AliranAsing; emiten: `PanelAliranAsing` StockDetail) — **belum diverifikasi** apakah ketiganya memanggil fungsi bersama atau menghitung ulang sendiri-sendiri dengan basis/pembulatan berbeda. Perlu pass lintas-grup khusus.
4. **Standar kelas 3 (BadgeRapor) tak dikonfirmasi seragam** — Radar/Watchlist/Screener diverifikasi ketat tunduk adendum BadgeRapor; `PanelSkor` di StockDetail dinyatakan lolos tapi tak eksplisit dicek terhadap standar yang sama.
5. **Gating kelas 7/8 belum ditugaskan eksplisit** untuk SektorIndeks/TopStocks/StatistikBerkala/TopBroker (agregasi sektor, sampel-periode-pendek) dan kelas 4 untuk BrokerSummaryV2/AliranAsing (skala persen top-N ganda-hitung) — ringkasan grup "pasar" dan "aliran" terpotong sebelum sampai ke bagian ini secara eksplisit.

## 4. Halaman BERSIH — jangan diutak-atik tanpa alasan

`SektorIndeks.tsx`, `TopStocks.tsx`, `StatistikBerkala.tsx`, `TopBroker.tsx`, `StockDetail.tsx`, `GrafikEmiten.tsx` (panel analitik), `PetaInvestor.tsx`, `BrokerSummary.tsx` (v1), `AliranAsing.tsx`, `Radar.tsx`, `Watchlist.tsx`, `Bulletin.tsx`, `Kabar.tsx`, `ForumRuang.tsx`/`Forum.tsx`, `Metodologi.tsx`, `Glosarium` — semua diverifikasi adversarial dan klaim "bersih"-nya dicek langsung ke kode/data, bukan diterima mentah. `KartuAnalisa.tsx` bersih di luar 2 catatan minor pada §2.

## 5. Urutan Kerja + Kriteria Terima

**Prioritas 1 — perbaiki 5 temuan 🔴** (semua berdampak langsung ke pembaca):
1. IndeksDunia.tsx §1.1 — Kriteria terima: 8 hari uji (`ds_260120` dkk) menampilkan `—` bukan `+0,00` hijau; `mkt_per`/`mkt_pbv` sama untuk `ds_260824`.
2. VsIhsg.tsx §1.2 — Kriteria terima: buka tab vs IHSG untuk TLKM/BBCA, tak ada satu pun literal "BUMI" tersisa di 4 lokasi.
3. kelompokBroker.ts §1.3 — Kriteria terima: teks Afiliasi tak menyebut nama emiten apa pun.
4. Screener.tsx §1.4 — Kriteria terima: `emiten_sektor.json` di-join, jumlah emiten `sektor:'-'` turun dari 46 mendekati 0 (sisa genuinely tak terklasifikasi), tooltip tak lagi klaim "tak masuk peta resmi" untuk emiten yang sektornya ada.
5. KuliPapan.tsx §1.5 — Kriteria terima: `valuasi_historis.json` punya alasan per-kode, 20 emiten sampel di atas menampilkan alasan yang benar (bukan "mata uang" untuk yang faktanya rugi/tak ada data).

**Prioritas 2 — 🟡 §2.1-2.2** (kecil, cepat): hitungan hari bursa dinamis; tandai `stop_asal` di Kartu Analisa.

**Prioritas 3 — tutup gap cakupan** (belum diaudit sama sekali):
- Audit **Trader Papan** dan **Chart** dari nol dengan checklist 8 kelas yang sama.
- Selesaikan kelas 7/8 untuk grup pasar (SektorIndeks/TopStocks/StatistikBerkala/TopBroker) dan kelas 4 untuk BrokerSummaryV2/AliranAsing.
- Satu pass lintas-grup khusus kelas 6: grep seluruh `lib/dasbor/*.ts` pemanggil rumus net-foreign/skor untuk memastikan tak ada duplikasi rumus antar halaman.