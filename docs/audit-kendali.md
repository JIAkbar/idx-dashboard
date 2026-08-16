# Audit kendali PAPAN — #170 Tahap 1

Audit baca-saja, 17 Agustus 2026. Tidak ada kode diubah. Metode: lima sesi
paralel baca-penuh (bukan grep) atas seluruh halaman `app/src/views/dasbor/`
dan `app/src/views/admin/` yang didaftar di `docs/spek-kendali.md`, disintesis
di sini. Setiap baris punya `file:baris` — kalau meleset karena baris bergeser
sesudah audit ini, cari nama kelas/fungsi yang disebut, bukan nomor baris.

Rujukan mengikat: `docs/spek-kendali.md` (sepuluh keluhan K1–K10 + prinsip).

---

## 0. Koreksi atas dugaan awal spek

Spek menulis enam dugaan yang perlu diverifikasi. Hasilnya:

| Dugaan spek | Status | Kenyataan |
|---|---|---|
| "Beranda / Indeks: `YTD·1T·5T·10T·Semua`" | **Perlu diluruskan** | Kendali ini fisiknya ada di `IndeksDunia.tsx:41-47` (`IhsgYtdChart`), BUKAN di `Beranda.tsx`. Beranda.tsx sendiri **tidak punya satu pun** pemilih rentang/tanggal/dropdown/kotak cari — halaman itu murni kartu navigasi + berita. Beranda cuma ikut MENAMPILKAN chart itu lewat komponen bersama `PapanIhsg`. |
| "Lima bentuk pemilih rentang" | **Kurang dari kenyataan** | Ditemukan **sembilan** mekanisme/kosakata berbeda untuk "pilih rentang waktu", bukan lima — lihat §3.1. |
| PilRow.tsx dicurigai sebagai pemilih rentang | **Salah, dikonfirmasi** | `PilRow.tsx`/`.bchip` adalah lajur chip kepemilikan saham (Peta Investor), sama sekali bukan time-range selector. Tak satu pun dari lima sesi audit menemukan dia dipakai sebagai pemilih rentang. Yang justru terjadi: `.bchip` dipakai berulang kali di LUAR maksud aslinya sebagai tombol klik — lihat §3.1.5. |
| K7 "Radar belum kesentuh sama sekali" | **Perlu diluruskan** | Radar.tsx **sudah** punya navigasi edisi nyata: `.rdr-arsip` (angka tanggal telanjang) + `.rdr-stepper` (panah ‹›) di `Radar.tsx:277-294`, dan enam tab (`Radar.tsx:298-311`). Yang benar dari K7: jalur MASUK datanya manual/arsip Gmail (di luar cakupan file tampilan yang diaudit) — itu murni soal pipa data, bukan berarti UI-nya belum ada. UI-nya ADA tapi kena masalah target-sentuh yang sama dengan K1. |
| K9 "default di 1Y saja" | **Tidak terbukti** | `SeasonalityHarian.tsx:63` default `'Semua'`, `Seasonality.tsx:35` default `sejak=0` (="Semua" juga). Tak satu pun default ke 1 tahun di dua berkas ini. Klaim mungkin merujuk kondisi kode sebelumnya (sudah diperbaiki) atau halaman lain — perlu dikonfirmasi ke Johan sebelum dijadikan dasar perbaikan, JANGAN diasumsikan benar. |
| Usulan 5 komponen kanonis di spek | **Kurang dari kebutuhan nyata** | Realitasnya butuh minimal 6 kelompok (§3.6), dan salah satu dugaan (`Chip` tunggal untuk K10) perlu dipecah karena `.bchip` sedang menanggung 4 tugas berbeda yang secara fungsi memang beda. |

Yang **terbukti benar** persis seperti dugaan: K1 (panah kalender kecil), K3 (Export XLS Peta Investor menulis ulang pola dropdown sendiri), K4 (Grup Konglomerat nol kendali rentang), K5 (Broker Summary pil + dua kalender terpisah), K6 (radius/ukuran chip broker berbeda dari halaman lain), K9-bagian-kosakata (label Seasonality persis `Semua·MTD·YTD·1 thn·2 thn·3 thn·5 thn·10 thn·20 thn`), K10 (IHSG kotak vs BUMI bulat, dua kelas CSS berbeda sama sekali).

---

## 1. Komponen bersama yang sudah ada (baseline sebelum masuk ke halaman)

| Komponen/kelas | Fungsi | Ukuran kendali klik |
|---|---|---|
| `Dropdown.tsx` → `.dd`/`.dd-btn`/`.dd-menu`/`.dd-it` | dropdown generik | `.dd-btn` tinggi 32px (lantai.css:1541-1549) |
| `DatePicker.tsx` → `.dpk-btn`/`.dpk-nav`/`.dpk-step` | date picker satu tanggal | `.dpk-nav` (nav bulan) **24×24px**; `.dpk-step` (stepper hari ber-data) **26×32px** — **kendali kanonis sendiri sudah di bawah target 44px** (lantai.css:22-28, 54-63) |
| `ModalKecil.tsx` | kerangka modal | — |
| `StockAutocomplete.tsx` | cari-emiten dengan saran | — |
| `PilRow.tsx` → `.bchip`/`.pil-row` | lajur chip kepemilikan (BUKAN pemilih) | — |
| `.tabs`/`.tab` | tab bar | wadah 32px, tab 26px (lantai.css:856-859, 1555-1564) |
| `.chip-t` | pil pilihan/toggle, radius **99px** (token bukan dipakai — nilai mentah) | tinggi 32px |
| `.chip` | indikator status naik/turun/warn — **bukan** untuk dipilih | — |
| `.bchip` | chip kepemilikan saham, radius **4px mentah** (bukan token `--r`/`--r-kecil`) | — |
| `.inp` | input teks | tinggi 32px |
| `.btn-p` | tombol aksi utama (amber) | tinggi 32px |
| `.af-cari` | wadah kotak cari (ikon + input) | — |
| Token radius proyek | `--r:12px` (panel/tombol besar), `--r-kecil:8px` (chip/badge/ikon kecil) — lantai.css:646 | `.chip-t` (99px) dan `.bchip` (4px) sama sekali tidak memakai token ini, keduanya nilai mentah |

---

## 2. Inventaris per halaman

### 2.1 Beranda, Indeks Dunia (+ Kalender Bursa), Top Stocks, Top Broker, Sektor & Indeks, Chart

**Komponen bersama `Kalender.tsx`** (dirender langsung oleh IndeksDunia, TopStocks, TopBroker, SektorIndeks — bukan halaman sendiri):

| Kendali | Jenis | file:baris | Kelas CSS | Label verbatim | Catatan |
|---|---|---|---|---|---|
| Dropdown bulan (`ddBulan`) | dropdown | `Kalender.tsx:434-446` | `Dropdown.tsx` kanonis | mis. `Agustus 2026` | Reuse penuh. |
| Tombol "Hari Ini" | tombol aksi kecil | `Kalender.tsx:450-460` | `.csb-more` | `Hari Ini` | Custom, tinggi 32px (lantai.css:1066). |
| **Panah hari bursa sebelumnya/berikutnya (`hariNav`, varian penuh)** | panah langkah | `Kalender.tsx:463-486` | `.dd-btn` (BUKAN `.dpk-nav`/`.dpk-step`) | tanpa teks, SVG panah | **Ini K1** — reuse `.dd-btn` (≈34×32px), **di bawah 44px**. |
| Sel tanggal grid bulan | pemilih tanggal | `Kalender.tsx:509-527` | `.cg.ada` | angka hari + IHSG% | `min-height:44px` (lantai.css:1023) — **sudah** 44px, kontras dengan panah di atasnya. |
| Panah hari bursa (varian strip, TopStocks/TopBroker/SektorIndeks) | panah langkah | `Kalender.tsx:638-648, 681-692` | `.dd-btn` | sama seperti di atas | Kode ditulis dua kali (blok terpisah dari `hariNav`) untuk pola identik. |
| 5 chip hari (varian strip) | pemilih tanggal (chip) | `Kalender.tsx:665-679` | `.csb-d` | nama hari + tanggal + % | `min-width:44px` (lantai.css:1055) — **memenuhi** target. |
| Toggle mode Hari/Rentang | tab | `Kalender.tsx:695-700` | `.tabs.mode-tgl`/`.tab` | `Hari` · `Rentang` | Reuse kanonis, ukuran diperkecil lokal (10px font). |
| **Preset rentang (`cal-rentang-bar`)** | pemilih rentang waktu | `Kalender.tsx:705-728` | `.chip-t` | `1 Minggu` · `1 Bulan` · `3 Bulan` · `YTD` (dari `lib/dasbor/periode.ts:48-53`) | Reuse kanonis — **contoh yang benar**: satu sumber (`PRESET_RENTANG`) dipakai TopStocks & SektorIndeks sekaligus. |

**Beranda.tsx** — tidak punya kendali rentang/tanggal/dropdown/cari. Kendali yang ada murni navigasi: `.brd-kartu` (kartu menu, `Beranda.tsx:254-271`), `.brd-kartu.brd-kartu-aksi` (tombol Masuk / Area Kontributor, `Beranda.tsx:276-301` — **bukan** `.btn-p`), `.brd-chip` (chip nada pasar, radius 999px, mirip tapi bukan `.chip-t`, `Beranda.tsx:109`), `.brd-semua` (link "Semua kabar/edisi →", `Beranda.tsx:138,186`).

**IndeksDunia.tsx**: pemilih rentang chart IHSG `.chip-t` `YTD·1T·5T·10T·Semua` (`IndeksDunia.tsx:266-281`, data `41-47`). Kalender Bursa dipanggil **tanpa** `onRentang` (`IndeksDunia.tsx:412,595,613`) — tidak ada toggle Hari/Rentang di halaman ini.

**TopStocks.tsx**: kalender strip + rentang (lihat tabel Kalender.tsx). Enam tabel dengan header urut-klik pakai `style={thBtn}` **inline** (`TopStocks.tsx:20`, dipakai 6×) — bukan kelas CSS, direplikasi identik di TopBroker.

**TopBroker.tsx**: kalender strip **tanpa** rentang (`onRentang` tak diteruskan). Header urut-klik: `thBtn` (`TopBroker.tsx:19`) — definisi disalin ulang persis sama dari TopStocks, bukan diimpor dari satu sumber.

**SektorIndeks.tsx**: kalender strip + rentang. **Tab periode Performa Sektor** (`.tabs.sek-periode-tabs`, `SektorIndeks.tsx:374-400`, data `14-19`) — kosakata KE-6 yang berbeda: `Hari Ini · 1 Bulan · 3 Bulan · YTD · Rentang` (tab kelima "Rentang" bukan pilihan tapi trigger buka mode Rentang Kalender). Tile sektor `.tile` (`SektorIndeks.tsx:305-332`) dengan `style={{ background: color-mix(...) }}` inline dinamis (wajar, nilai dari data). Tombol "Tutup" panel saham pakai `.tab` **lepas dari `.tabs`** (`SektorIndeks.tsx:343`) — penyimpangan pola.

**ChartIndeks.tsx**: Tab Grup Indeks `.tabs`/`.tab` (`Featured·Co-Branding·Syariah·Sektoral`, `ChartIndeks.tsx:211-223`). Chip simbol per grup pakai **`.bchip`** sebagai pemilih (`ChartIndeks.tsx:225-240`) — di luar peruntukan aslinya, state aktif lewat `style={{ borderColor, color }}` **inline** (`ChartIndeks.tsx:233`), bukan kelas `.on`. Tombol Layar Penuh (2×) juga pakai **`.bchip`** sebagai tombol ikon (`ChartIndeks.tsx:89-100`) — pemakaian ketiga berbeda untuk kelas yang sama, dengan `style={{ display:'inline-flex',... }}` inline karena `.bchip` dasarnya bukan flex.

### 2.2 Stock Detail, Peta Investor (4 tab), Broker Summary (4 tab)

**StockDetail.tsx**: tombol cari ikon `.btn-p` + inline `{padding:'7px 12px'}` (`101-107`); tombol "Tampilkan" `.btn-p` (`126`); chip saham populer `.chip-t` `BBCA·BBRI·TLKM·ASII·AMMN·TPIA` (`129-131`) — **reuse benar**; chip "terakhir dilihat" `.chip-r` (`138-140`, target sentuh nyaris nol — teks-underline saja); tab Statistik/Valuasi `.tabs`/`.tab` (`225-240`); link "Diskusi {ticker}" pakai **`.bchip`** + inline `cursor:pointer` (`220-222`) — kelas status dipakai sebagai link, bukan `.chip-t`.

Subkomponen: tab metrik Net Income/EPS/Revenue (`KolomKuartalan.tsx:99-112`, `.tabs`/`.tab`, reuse); tab Kuartalan/Tahunan + Laba Rugi/Neraca/Arus Kas (`PanelLaporanKeuangan.tsx:124-158`, reuse); lima input angka valuasi interaktif (`PanelValuasiInteraktif.tsx:136-225`, `.inp` + width inline per field — wajar untuk field numerik sempit).

**PetaInvestor.tsx**: tab 4 tampilan `.tabs`/`.tab` (`Grafik Jaringan·By Stock·By Investor·Grup Konglomerat`, `140-153`). Tombol "Tampilkan" pakai kelas custom **`.pi-search-go`** (`155`) — BUKAN `.btn-p`, walau fungsinya sama dengan tombol "Tampilkan" StockDetail.tsx yang justru pakai `.btn-p`. **Dropdown "Export XLS" menulis ulang pola sendiri** — pakai kelas `.dd`/`.dd-btn`/`.dd-menu`/`.dd-it` langsung TANPA memanggil komponen `Dropdown.tsx` (`156-194`), lengkap dengan `style={{position:'relative'}}` dan `style={{display:'block',right:0,left:'auto'}}` inline untuk posisi menu — **ini K3, dikonfirmasi persis**. Tombol Layar Penuh tab Grafik Jaringan pakai kelas custom **`.pi-fs-btn`** (`212-223`) — beda total dari implementasi "Layar Penuh" di ChartIndeks (`.bchip`+inline) dan Quadrant (`.bchip`+inline juga, tapi ditulis terpisah).

`GrupKonglomerat.tsx` (dibaca sebagai bukti K4, di luar daftar tugas formal): chip anggota grup `.gk-chip` (`73-87`, radius `--r-kecil`=8px — beda dari `.chip-t` 99px). **Tidak ada satu pun kendali rentang waktu di file ini** — K4 dikonfirmasi kosong total.

`ByStock.tsx`/`ByInvestor.tsx`: kotak cari `.inp` + dropdown filter tipe holder **memanggil komponen `Dropdown.tsx` langsung** (`ByStock.tsx:69`, `ByInvestor.tsx:53`) — reuse benar, kontras dengan PetaInvestor.tsx induknya yang justru tidak. Tombol "Tampilkan N lagi" pakai **`.bchip`** + inline `cursor:pointer` (`ByStock.tsx:131-133`, `ByInvestor.tsx:102-104`).

`PetaInvestorSearch.tsx`: input cari pakai kelas custom **`.pi-search`** (BUKAN `.inp`, `77-88`, height 32px tapi radius `--r-kecil` bukan `--r`, plus `text-transform:uppercase`); tombol hapus `.pi-search-x` glyph `✕` **tanpa width/height** (`90`, target sentuh ~14×14px); item hasil `.pi-drop-item` (bukan `.dd-it`, wajar beda fungsi).

`DetailPanel.tsx`: tombol tutup panel `.pi-panel-close` glyph `×`, tanpa ukuran eksplisit, ditentukan padding+font saja (`32`, `108`).

**BrokerSummary.tsx**: tab 4 halaman `.tabs`/`.tab` (`156-169`) — 3 dari 4 label pakai sistem ikon `IkonMenu`, TAPI label "Kuadran" pakai glyph Unicode `⊞` literal — dua sistem ikon beda dalam satu baris tab. Toggle Harian/Rentang `.tabs`/`.tab` (`184-187`). **Pil preset rentang `.chip-t`** `1 Minggu·1 Bulan·3 Bulan·6 Bulan·YTD·1 Tahun` (`189-200`, dari `PRESET_BROKER` — array TERPISAH dari `PRESET_RENTANG` milik Kalender.tsx, bukan sumber sama). **DUA `<DatePicker>` terpisah** untuk rentang bebas (mulai `208`, akhir `210`) dipisah label statis "s.d." (`209`), plus satu `<DatePicker>` lagi untuk mode Harian (`213-219`) — **ini K5, dikonfirmasi persis**: "pil + dua kalender terpisah".

`Quadrant.tsx`: tombol Layar Penuh pakai **`.bchip`** + inline flex/gap (`199-211`) — fungsi identik dengan `.pi-fs-btn` Peta Investor tapi kelas 100% berbeda. `Inventory.tsx`/`Nego.tsx`/`Flow.tsx`: tidak ada kendali interaktif (tabel statis / chart Chart.js).

### 2.3 Kalkulator (6 tab), Radar Watchlist, Seasonality (2 tab)

**KalkulatorJia.tsx**: tab 5 kalkulator `.tabs`/`.tab` (`36-48`, reuse penuh).

Enam sub-kalkulator (AvgDown/Dividen/Pemulihan/ProfitAra/RiskReward, + `PosisiBar.tsx` yang dipakai tiga di antaranya): semua input angka pakai `.inp` reuse konsisten, lebar per field lewat `style={{width:N}}` inline (wajar untuk field numerik sempit — bukan pelanggaran). Temuan menonjol:
- `AvgDown.tsx:283-293` — 5 kartu strategi pakai kelas custom `.pilih`/`.pilih-k`, bukan `.chip-t`/`.tabs` — wajar (kartu radio berdeskripsi, beda kebutuhan visual dari chip/tab biasa).
- `PosisiBar.tsx:35` — tombol "↩ Isi Kalkulator" pakai `.btn-p` tapi **override ukuran lewat inline** `{fontSize:11,padding:'7px 14px'}`, bukan varian kelas.
- `ProfitAra.tsx:131-136`, `RiskReward.tsx:104-108` — toggle ARA▲/ARB▼ dan preset R:R 1:1…1:5 **memakai kelas `.tab`** sebagai toggle/preset-picker, BUKAN sebagai tab navigasi — dua tempat menyalahgunakan kelas yang sama untuk maksud berbeda dari tab bar.
- `Dividen.tsx:112-115` — satu-satunya checkbox native tanpa kelas kanonis di seluruh cluster ini.

**Radar.tsx**: tab 6 bagian `.tabs`/`.tab` (`298-311`, reuse). **Pemilih edisi = angka tanggal telanjang** `.rdr-arsip` (`277-289`, label cuma dua digit hari: `03·06·10·12·13`) — sama sekali tidak memakai `DatePicker.tsx`. **Stepper edisi** `.rdr-stepper` glyph `‹`/`›` (`290-294`) — CSS `padding:7px 11px;font-size:13px` **tanpa width/height eksplisit** (lantai.css:1848), jauh di bawah target 44px, dan sama sekali tidak memakai `.dpk-nav`/`.dpk-step` kanonis. **Tiga kelas "bar" berbeda** untuk elemen dekoratif (bukan kendali klik, tapi ini bukti K8): `.rdr-bar` tinggi 7px (Mingguan/Bulanan, `387-389`,`418-419`), `.rdr-skor i` lebar tetap 52px tinggi 4px (tabel harian, `140`).

**Seasonality.tsx** (tab Bulanan): kotak cari `.sea-cari` (BUKAN `.af-cari`, `162-169`) + daftar saran `.sea-saran`/`.sea-saran-it` (bukan `Dropdown.tsx`, bukan `StockAutocomplete.tsx` yang dipakai Kalkulator — pola KETIGA untuk "cari emiten"). Chip emiten terpilih `.sea-chip` (`186-190`, radius 99px). **Pemilih "Mulai dari"** `.bchip.bchip-klik` (`194-200`): `Semua·2010·2015·2020` — tahun MENTAH, radius 4px kotak.

**SeasonalityHarian.tsx**: **chip sumber "IHSG"** `.bchip.bchip-klik` (`111-112`, radius 4px, font-size 10.5px) bersebelahan dengan **chip emiten terpilih (mis. "BUMI")** `.sea-chip` (`114-116`, radius **99px**, font-size 11px, latar amber) — **ini K10, dikonfirmasi persis sampai ke angka font-size**. **Pemilih "Rentang" 9 opsi** `.bchip.bchip-klik` (`151-156`, data `11-19`): `Semua·MTD·YTD·1 thn·2 thn·3 thn·5 thn·10 thn·20 thn` — persis dugaan spek. Kotak cari `.sea-cari.sea-cari-hari` (pola sama non-kanonis dengan tab Bulanan).

**SeasonalityKomparasi.tsx**: tidak ada kendali kustom — murni chart Chart.js.

Catatan kosakata: **dalam SATU halaman Seasonality**, dua tabnya punya dua pemilih rentang dengan dua vokabuler berbeda sama sekali (tahun mentah vs "X thn") DAN dua-duanya memakai kelas yang sama (`.bchip.bchip-klik`) yang aslinya bukan untuk ini.

### 2.4 Kabar Pasar, Bulletin, Forum, Kritik & Saran (Feedback)

**Kabar.tsx**: tab sumber `.tabs`/`.tab` (`96-102`, reuse). Dropdown "Saring bulan" **memanggil `Dropdown.tsx`** (`115-125`, reuse — dengan override CSS bertarget kelas di `Kabar.css:24-27`, bukan inline). Kotak cari `.af-cari`+`.inp` (`126-130`, **reuse kanonis benar**). Panah paginasi "‹ Lebih baru"/"Lebih lama ›" pakai `.dd-btn` dengan glyph teks di dalam label (`193-197`) — bukan ikon SVG terpisah seperti `.dpk-nav`.

**Bulletin.tsx**: tab tipe edisi `.tabs`/`.tab` `Semua·Harian·Mingguan·Bulanan·Bedah` (`176-189`, reuse). Kotak cari pakai kelas custom **`.blt-cari`** (BUKAN `.af-cari`, `192-200`) — pola KEDUA untuk kotak cari. Tombol X hapus cari `.blt-cari-x` **24×24px** (`201-211`, lantai.css:1412). Tombol reset `.blt-reset` (`224-233`, bukan `.btn-p`/`.dd-btn`). Chip emiten per baris pakai **`.bchip`** (`288-298`) sebagai kendali klik-untuk-filter. Tombol "Prob"/"Tutup"/"Lihat"/link unduh "PDF" semua pakai kelas custom **`.blt-dl`** (`308-341`) — state aktif "Prob" terbuka diwarnai lewat `style={{color,borderColor}}` **inline** (`318`) padahal `.chip-t.on` kanonis sudah punya pola state-aktif berbasis kelas. Tombol tutup modal pratinjau `.blt-modal-x` **32×32px** (`459-461`, lantai.css:1801) — **beda ukuran** dari `.blt-cari-x` (24×24px) padahal sama-sama "tombol X" di halaman yang sama.

**Forum.tsx**: kotak cari pakai `.inp` **polos tanpa wadah apa pun** (`63-66`) — pola KETIGA untuk kotak cari, tanpa ikon kaca pembesar. Item navigasi ruang `.forum-rel-item` (`94-108`) — pola sendiri mirip tab tapi bukan `.tabs`/`.tab`.

**ForumRuang.tsx**: tombol info `.forum-info` **24×24px** (`210-213`) — pola & ukuran ke-3 untuk "tombol X/info kecil". Tombol Balas/Laporkan/Hapus/Batal/Buat-akun semua pakai **`.bchip.bchip-klik`** + `style={{cursor:'pointer'}}` **inline berulang** (`219,245,392,393,395-398`) — inline ini **murni duplikat**, karena `.bchip-klik` sudah `cursor:pointer` di CSS-nya sendiri (lantai.css:821-822). Tombol kirim `.btn-p` (reuse benar). Modal Hapus/Lapor pakai `ModalKecil`+`.dd-btn`(Batal)+`.btn-p`(submit) — reuse benar.

**Feedback.tsx**: grup radio "Topik" ditampilkan sebagai `.tabs`/`.tab` (`44-58`) TAPI secara ARIA ini `role="radiogroup"` dengan `<input type="radio">` disembunyikan (`opacity:0`) — beda semantik dari tab sungguhan (`role="tablist"/"tab"`) yang dipakai Kabar/Bulletin/dll meski visualnya identik. Tautan "Kirim via WhatsApp" pakai `.btn-p` pada elemen `<a>` (`74-85`, reuse wajar).

### 2.5 Seluruh tab Admin

**AdminLayout.tsx**: tombol Keluar `.dd-btn` (`233`); tab bar shell `.tabs.admin-tabbar`/`.tab` 9 tab (`237-245`); tombol modal beku/sambutan/konfirmasi-keluar semua `.btn-p`/`.dd-btn` reuse — beberapa dengan inline `{flex:1}`/`{width:'100%'}` untuk layout (wajar).

**AksesAdmin.tsx**: 3 dropdown per baris + 3 dropdown modal **semua memanggil `Dropdown.tsx`** (reuse benar, `170-354`). Input "Urutan" `.inp`+inline `{width:78,textAlign:'right'}` (`206-220`). Tombol Tambah/Hapus pakai `.btn-p`/`.dd-btn.merah` (reuse).

**AktivitasAdmin.tsx**: kotak cari `.af-cari`+`.inp` (**reuse kanonis benar**, `182-192`). Paginasi Keaktifan "‹ Sebelumnya"/"Berikutnya ›" (`265-277`) VS paginasi Jejak "‹ Lebih baru"/"Lebih lama ›" (`374-386`) — **dua label berbeda untuk fungsi identik di halaman yang sama**, keduanya `.dd-btn`. Dropdown "Jendela waktu" **memanggil `Dropdown.tsx`**: `15 menit terakhir·1 jam terakhir·24 jam terakhir` (`287`) — ini pemilih rentang waktu jenis KE-10 (relatif-ke-sekarang, beda total dari semua pola lain).

**BedahTab.tsx**: tanpa kendali (guard akses saja).

**BedahUnggah.tsx**: tombol "Pilih gambar…" `.dd-btn.af-pilih` (2×, `78-80`,`348-349`). Tombol "buang" file `.buang` — padding 4px, **±20×20px** (`86-96`). Tombol "+Tambah Emiten" `.btn-p.af-tambah` (`310-312`). `<DatePicker>` reuse (`337`). Tombol label arsip **`.dd-btn` + inline `{fontSize:10.5,padding:'4px 8px'}`** (`396-403`) dan tombol hapus arsip **`.dd-btn` + inline `{color:'var(--red)',borderColor:'var(--red)'}`** (`404-413`) — **ini seharusnya cukup pakai modifier `.merah` yang sudah ada** (dipakai di KurasiSetoran/UnggahHarian/AksesAdmin), bukan inline — pelanggaran konkret prinsip #3 spek.

**ChangelogAdmin.tsx**: tanpa kendali (baca-saja).

**KurasiSetoran.tsx**: tombol "Salin daftar" `.dd-btn` (`224-226`). `<DatePicker>` reuse (`232`). Tab status `.tabs`/`.tab` **tanpa** modifier tambahan (`233-246`: `Menunggu·Perlu revisi·Disetujui·Dihapus·Semua`) — beda dari RakTerbitan yang pakai modifier `.blt-tabs` untuk tab serupa. Tombol bulk (Setujui/Revisi/Hapus) `.dd-btn`(`.merah` untuk Hapus). Checkbox `.af-cek` (reuse). Toggle "Di edisi"/"Di luar edisi" pakai `.dd-btn.ks-dimuat` (`325-330`) — bukan `.chip-t` walau fungsinya toggle dua-state. `TolakModal` diekspor & dipakai ulang di UnggahHarian — **contoh reuse lintas file yang baik**.

**PanduanScreenshot.tsx** (dirender di tab Unggah & Bedah): tombol lipat/buka header **bespoke** meniru `.panel-h` manual (`159-162`, disengaja per komentar kode). Tombol hapus contoh `.af-galeri-hapus` **22×22px eksplisit** (`184-193`, AdminShared.css). Dua radio native polos "Benar"/"Terpotong" (`304,307`) — **satu-satunya radio native tanpa kelas** di seluruh admin (beda pola dari Feedback.tsx yang menyembunyikan radio di balik `.tab`).

**PanelJenjang.tsx**: tanpa kendali (tabel acuan baca-saja).

**RadarUnggah.tsx**: `SlotBerkas` **disalin ulang** dari BedahUnggah.tsx (bukan diimpor — komentar kode mengonfirmasi ini sengaja per instruksi lama, `52-71`). `<DatePicker>` reuse (`148`). Satu-satunya slot unggah PDF (bukan gambar) di seluruh admin (`163-169`).

**RakTerbitan.tsx**: tab tipe edisi `.tabs.blt-tabs`/`.tab` (`60-73`) — modifier `blt-tabs` (didefinisikan di lantai.css, dipakai lintas Bulletin & di sini) TAPI KurasiSetoran punya tab serupa TANPA modifier ini. Kotak cari `.af-cari` (**reuse benar**, `74-84`). Link "Lihat" PDF pakai `.blt-dl` pada `<a>` (`145-153`) — bukan `.dd-btn`/`.btn-p` kanonis untuk aksi. Paginasi `.dd-btn` "‹ Lebih baru"/"Lebih lama ›" (`167-170`) — label SAMA dengan paginasi Jejak AktivitasAdmin (konsisten satu sama lain, beda dari paginasi Keaktifan AktivitasAdmin yang pakai "Sebelumnya/Berikutnya").

**UnggahHarian.tsx** (file terbesar, 103 elemen berkelas): tombol bulk (`Setujui terpilih`/`Minta revisi terpilih`/`Tolak terpilih`/`Hapus`, `1058-1075`) — **label "Tolak" di sini vs label "Hapus" di KurasiSetoran.tsx:267 untuk AKSI YANG SAMA PERSIS** (memanggil `kurasiSetoran(paths,'dihapus',...)` identik). `StatusAksi` (trigger status + menu aksi cepat, `293-336`) memakai kelas `.dd`/`.dd-menu`/`.dd-it` TAPI trigger & logic klik-luar ditulis manual, bukan memanggil komponen `Dropdown` — **disengaja dan dijelaskan di komentar kode** (Dropdown = pilih NILAI, ini = pemicu AKSI) — beda dari kasus PetaInvestor Export XLS yang TIDAK punya justifikasi serupa. Tombol ikon "Ubah"(pensil) `.af-ubah` **±19×19px** (`1211-1225`) dan "Hapus" `.af-hapus` **±20×20px** (`1226-1235`). Tiga implementasi berbeda untuk "pilih & unggah berkas": `SlotBerkas`×2 (disalin dari BedahUnggah) + `PilihGambar` sendiri (`198-284`, dengan heuristik preview tambahan) — tiga pola untuk fungsi serupa.

**AkunAdmin.tsx**: kotak cari **`.aa-cari`** (AkunAdmin.css:42-47) — **duplikat nyaris identik dari `.af-cari`** yang sudah dipakai AktivitasAdmin & RakTerbitan (`267-274`) — pelanggaran konkret prinsip #1 spek ("yang sudah ada dipakai ulang, bukan ditulis ulang"). Lima dropdown **semua memanggil `Dropdown.tsx`** (reuse benar). **Sakelar `.aa-sakelar`** (toggle switch, role="switch", **34×19px eksplisit**, `139-156`/`392-414`) — satu-satunya kendali jenis "toggle switch" sungguhan di seluruh aplikasi, bespoke tapi wajar (tak ada padanan kanonis untuk boolean switch). Empat tombol ikon aksi (`Ubah email`/`Atur ulang sandi`/`Reset akurasi`/`Hapus akun`) pakai `.dd-btn.aa-ikon` **30×30px eksplisit** (`423-460`) — **ukuran ketiga** untuk "tombol ikon kecil" (beda dari `.af-ubah`/`.af-hapus` ±19-20px UnggahHarian, beda dari `.af-galeri-hapus` 22×22px PanduanScreenshot). Tombol salin email `.aa-salin` ±21×21px (`98-120`).

---

## 3. Analisis lintas halaman

### 3.1 Kelompok kendali yang sebenarnya satu jenis

#### 3.1.1 Pemilih rentang waktu — SEMBILAN pola berbeda, bukan lima

| # | Sumber | Halaman | Label verbatim | Kelas |
|---|---|---|---|---|
| 1 | `IhsgYtdChart` | Beranda (via PapanIhsg), IndeksDunia | `YTD · 1T · 5T · 10T · Semua` | `.chip-t` |
| 2 | `PRESET_RENTANG` (periode.ts, **shared, contoh baik**) | Kalender Bursa, TopStocks, SektorIndeks | `1 Minggu · 1 Bulan · 3 Bulan · YTD` | `.chip-t` |
| 3 | Toggle mode Kalender | TopStocks, SektorIndeks, (IndeksDunia tak pakai) | `Hari · Rentang` | `.tabs`/`.tab` |
| 4 | Tab Performa Sektor | SektorIndeks | `Hari Ini · 1 Bulan · 3 Bulan · YTD · Rentang` | `.tabs.sek-periode-tabs`/`.tab` |
| 5 | `PRESET_BROKER` (array terpisah, sendiri) | Broker Summary | `1 Minggu · 1 Bulan · 3 Bulan · 6 Bulan · YTD · 1 Tahun` | `.chip-t` |
| 6 | "Mulai dari" | Seasonality (tab Bulanan) | `Semua · 2010 · 2015 · 2020` (tahun mentah) | `.bchip.bchip-klik` |
| 7 | "Rentang" | SeasonalityHarian | `Semua · MTD · YTD · 1 thn · 2 thn · 3 thn · 5 thn · 10 thn · 20 thn` | `.bchip.bchip-klik` |
| 8 | Pemilih edisi | Radar | angka tanggal telanjang (`03·06·10·12·13`) + panah `‹›` | `.rdr-arsip` + `.rdr-stepper` |
| 9 | "Jendela waktu" | Aktivitas Admin | `15 menit terakhir · 1 jam terakhir · 24 jam terakhir` | `Dropdown.tsx` |
| — | Grup Konglomerat | Peta Investor | **tidak ada** (K4) | — |

Baris 2 (`PRESET_RENTANG`) adalah SATU-SATUNYA yang benar-benar dipakai bersama lewat satu sumber data (`periode.ts`) — model yang seharusnya ditiru untuk lainnya. Baris 5 (`PRESET_BROKER`) menduplikasi 3 dari 4 kata baris 2 (`1 Minggu`,`1 Bulan`,`3 Bulan`,`YTD`) tapi didefinisikan terpisah, bukan diimpor.

#### 3.1.2 Panah langkah maju/mundur — lima implementasi, tak satu pun konsisten satu sama lain

| Lokasi | Kelas | Ukuran CSS |
|---|---|---|
| `DatePicker.tsx` nav bulan (komponen kanonis sendiri) | `.dpk-nav` | 24×24px |
| `DatePicker.tsx` stepper hari ber-data (komponen kanonis sendiri) | `.dpk-step` | 26×32px |
| Kalender.tsx hari bursa (K1) | `.dd-btn` | ≈34×32px |
| Radar edisi | `.rdr-stepper button` | padding 7px 11px, tanpa width/height eksplisit (≈29×30px) |
| Kabar/AktivitasAdmin(×2)/RakTerbitan paginasi | `.dd-btn` (glyph teks dalam label) | 32px tinggi, lebar mengikuti teks |

Bahkan komponen KANONIS `DatePicker.tsx` sendiri punya dua ukuran berbeda (24px vs 26×32px) untuk dua jenis panahnya sendiri — masalah ini bukan cuma "kendali lama belum migrasi", tapi juga ada di titik yang seharusnya jadi rujukan.

#### 3.1.3 Kotak cari — enam wadah berbeda untuk fungsi yang sama

| Kelas wadah | Halaman | Catatan |
|---|---|---|
| `.af-cari` (kanonis) | Kabar, Aktivitas Admin, Rak Terbitan | **Reuse benar**, 3 pemakaian identik. |
| `.blt-cari` | Bulletin | Duplikat `.af-cari`, X-button sendiri 24×24px. |
| `.sea-cari` | Seasonality (2 tab) | Duplikat lagi, saran dropdown sendiri (bukan `Dropdown.tsx`). |
| `.inp` polos (tanpa wadah) | Forum | Tanpa ikon kaca pembesar sama sekali. |
| `.aa-cari` | Akun Admin | Duplikat nyaris identik `.af-cari` (AkunAdmin.css:42-47). |
| `.pi-search` | Peta Investor (toolbar cari) | height sama (32px) tapi radius beda token + uppercase. |

Ditambah tiga pola "cari emiten dengan saran" yang TIDAK saling memakai: `StockAutocomplete.tsx` (Kalkulator, BedahUnggah, UnggahHarian), `Dropdown.tsx` (ByStock/ByInvestor pakai untuk filter, bukan cari-emiten), dan `.sea-saran`/`.sea-saran-it` custom (Seasonality, dua tab).

#### 3.1.4 Tombol ikon kecil (close/remove/edit/delete/copy/info) — sembilan ukuran berbeda, semua di bawah 44px

| Kelas | Lokasi | Ukuran |
|---|---|---|
| `.pi-search-x` | Peta Investor Search | tanpa width/height, glyph ~14×14px |
| `.af-ubah` | UnggahHarian (edit) | padding 3px, ≈19×19px |
| `.buang` | BedahUnggah/RadarUnggah/UnggahHarian (×3, hapus file terpilih) | padding 4px, ≈20×20px |
| `.af-hapus` | UnggahHarian (hapus baris) | padding 3px, ≈20×20px |
| `.aa-salin` | AkunAdmin (salin email) | padding 4px+ikon 13px, ≈21×21px |
| `.af-galeri-hapus` | PanduanScreenshot | **22×22px eksplisit** |
| `.blt-cari-x` | Bulletin (hapus cari) | **24×24px eksplisit** |
| `.forum-info` | ForumRuang | **24×24px eksplisit** |
| `.aa-ikon` | AkunAdmin (4 tombol aksi) | **30×30px eksplisit** |
| `.blt-modal-x` | Bulletin (tutup modal) | **32×32px eksplisit** |
| `.pi-panel-close` | Peta Investor DetailPanel | tanpa ukuran, padding 5px 10px + font 14px |

Rentang 14px–32px, sembilan kelas berbeda, nol yang mencapai 44px. Bahkan dua tombol "X" di halaman yang SAMA (Bulletin: `.blt-cari-x` 24px vs `.blt-modal-x` 32px) tidak seragam satu sama lain.

#### 3.1.5 `.bchip` dipakai untuk minimal empat maksud berbeda, di luar fungsi aslinya

`.bchip` didefinisikan (lantai.css:817) sebagai chip kepemilikan saham non-interaktif milik `PilRow.tsx`. Ditemukan dipakai sebagai:

1. **Chip pemilihan (selectable)** — ChartIndeks simbol chart (`225-240`), Seasonality "Mulai dari" (`194-200`), SeasonalityHarian "Rentang" & chip "IHSG" (`111-156`).
2. **Tombol aksi ikon** — ChartIndeks Layar Penuh (`89-100`), Quadrant Layar Penuh (`199-211`).
3. **Tombol aksi teks** — ByStock/ByInvestor "Tampilkan N lagi" (`131-133`/`102-104`), Bulletin chip-filter-emiten (`288-298`), ForumRuang Balas/Laporkan/Hapus/Batal/Buat-akun (5 tombol).
4. **Link navigasi bergaya chip** — StockDetail "Diskusi {ticker}" (`220-222`).

Setiap pemakaian di luar maksud (1)-(4) butuh `style={{cursor:'pointer'}}` **inline** untuk menandainya bisa diklik — total **≥9 titik** inline `cursor:pointer` yang murni menambal makna kelas yang sudah salah sasaran (empat di antaranya, ForumRuang, malah duplikat murni karena `.bchip-klik` sudah `cursor:pointer` di CSS-nya).

#### 3.1.6 Tombol "Layar Penuh" — tiga implementasi berbeda untuk fungsi identik

| Halaman | Kelas |
|---|---|
| ChartIndeks (Chart & Heatmap) | `.bchip` + inline flex/gap |
| Peta Investor (Grafik Jaringan) | `.pi-fs-btn` (kelas CSS murni) |
| Broker Summary — Quadrant | `.bchip` + inline flex/gap (ditulis terpisah dari ChartIndeks walau pola sama persis) |

#### 3.1.7 `.tab` dipakai di luar tab bar

`SektorIndeks.tsx:343` (tombol "Tutup" lepas dari `.tabs`), `ProfitAra.tsx:131-136` (toggle ARA▲/ARB▼), `RiskReward.tsx:104-108` (preset R:R 1:1…1:5) — tiga tempat memakai kelas `.tab` sebagai toggle/preset-picker biner atau tunggal, bukan sebagai anggota tab-bar navigasi.

#### 3.1.8 "Pilih satu dari beberapa" — empat mekanisme berbeda untuk hal serupa

`role="tablist"`/`.tab` sungguhan (Kabar, Bulletin, KurasiSetoran, RakTerbitan, Radar, PetaInvestor, BrokerSummary, StockDetail, KalkulatorJia, Seasonality, AdminLayout) vs `role="radiogroup"` dengan radio disembunyikan di balik `.tab` visual (Feedback.tsx) vs `.tab` dipakai sebagai toggle biner (ProfitAra/RiskReward, §3.1.7) vs radio native polos tanpa kelas (PanduanScreenshot "Benar"/"Terpotong").

#### 3.1.9 Header kolom tabel bisa-diurut — inline object diduplikasi persis

`TopStocks.tsx:20` dan `TopBroker.tsx:19` masing-masing mendefinisikan `thBtn = {font:'inherit',color:'inherit',background:'none',border:'none',cursor:'pointer',padding:0}` — objek identik, disalin bukan diimpor, dipakai di 6 tabel per halaman (12 titik total).

### 3.2 Kosakata tak konsisten (maksud → bentuk → di mana)

| Maksud | Bentuk yang dipakai | Di mana |
|---|---|---|
| "1 tahun" | `1T` | IndeksDunia (chart IHSG) |
| | `1 Tahun` | Broker Summary |
| | `1 thn` | SeasonalityHarian |
| "5 tahun" | `5T` | IndeksDunia |
| | `5 thn` | SeasonalityHarian |
| "10 tahun" | `10T` | IndeksDunia |
| | `10 thn` | SeasonalityHarian |
| "Seluruh riwayat" | `Semua` | IndeksDunia, SeasonalityHarian, Seasonality (tab Bulanan) — **konsisten**, satu-satunya kata yang seragam di semua tempat |
| "Titik awal historis" | tahun mentah `2010·2015·2020` | Seasonality tab Bulanan |
| | relatif+satuan `1 thn…20 thn` | SeasonalityHarian (tab sebelahnya!) |
| "Hari ini/sekarang" | `Hari` (mode toggle) | Kalender Bursa, TopStocks, SektorIndeks |
| | `Hari Ini` (tab periode) | SektorIndeks (tab lain di halaman sama) |
| "Tolak/hapus setoran" (aksi backend identik `kurasiSetoran(...,'dihapus',...)`) | `Hapus terpilih` | KurasiSetoran |
| | `Tolak terpilih` | UnggahHarian |
| "Kembali ke halaman sebelumnya (paginasi)" | `‹ Sebelumnya` / `Berikutnya ›` | AktivitasAdmin (tab Keaktifan) |
| | `‹ Lebih baru` / `Lebih lama ›` | AktivitasAdmin (tab Jejak, halaman SAMA), Kabar, Rak Terbitan |
| "Tombol X tutup/hapus kecil" | 14px – 32px, 9 kelas beda | lihat §3.1.4 |
| Ikon tab | sistem `IkonMenu` (SVG) | 3 dari 4 tab Broker Summary |
| | glyph Unicode `⊞` literal | tab ke-4 "Kuadran", Broker Summary (halaman SAMA) |

### 3.3 Gaya inline yang berulang / menambal makna kelas

Gaya inline `style={{...}}` pada kendali (bukan pada elemen dekoratif/layout, yang wajar) yang **seharusnya jadi kelas/varian CSS**:

| file:baris | Kendali | Isi inline | Kenapa seharusnya kelas |
|---|---|---|---|
| `Bulletin.tsx:318` | tombol `.blt-dl` "Prob" state aktif | `{color:'var(--amber)',borderColor:'var(--amber)'}` | `.chip-t.on` sudah punya pola state-aktif berbasis kelas — ini menulis ulang manual. |
| `ChartIndeks.tsx:233` | chip simbol `.bchip` aktif | `{borderColor:'var(--amber)',color:'var(--amber)'}` | Sama — semua selector lain (`.tab.on`,`.tile.on`,`.chip-t.on`) pakai kelas. |
| `BedahUnggah.tsx:407` | tombol hapus arsip `.dd-btn` | `{color:'var(--red)',borderColor:'var(--red)'}` | **Modifier `.merah` sudah ada** dan dipakai di KurasiSetoran/UnggahHarian/AksesAdmin — ini murni lupa pakai yang sudah tersedia. |
| `ForumRuang.tsx:219,245,392,393,395` | 5 tombol `.bchip.bchip-klik` | `{cursor:'pointer'}` | **Duplikat murni** — `.bchip-klik` sudah `cursor:pointer` di CSS (lantai.css:821-822). |
| `PetaInvestor.tsx:156,167` | wadah/menu Export XLS | `{position:'relative'}`, `{display:'block',right:0,left:'auto'}` | Tak perlu kalau memanggil `Dropdown.tsx` (yang sudah menangani ini secara internal). |
| `PetaInvestor.tsx:172,185` | item `.dd-it` disabled | `{opacity:0.45,cursor:'not-allowed'}` | Kandidat aturan `.dd-it:disabled` di CSS, bukan per-pemakaian. |
| `BedahUnggah.tsx:399` | tombol label arsip `.dd-btn` | `{fontSize:10.5,padding:'4px 8px'}` | Override ukuran — kandidat varian `.dd-btn-kecil`. |
| `PosisiBar.tsx:35` | tombol `.btn-p` "Isi Kalkulator" | `{fontSize:11,padding:'7px 14px'}` | Override ukuran — kandidat varian `.btn-p-kecil`. |

Inline yang **wajar dan BUKAN pelanggaran** (lebar field numerik sempit, custom property animasi `--i`, nilai dinamis dari data seperti warna heatmap/lebar bar): tersebar di seluruh kalkulator, Beranda, SektorIndeks, Radar — tidak didaftar ulang di sini, sudah ditandai per halaman di §2.

### 3.4 Target sentuh di bawah 44px (kendali yang bisa diklik)

Ringkasan dari §3.1.2 dan §3.1.4, diurutkan dari terkecil:

`.pi-search-x` (~14px) < `.rdr-arsip button` (~23px, padding 6px 10px font 11px) < `.af-ubah` (~19px) < `.buang`/`.af-hapus` (~20px) < `.aa-salin` (~21px) < `.af-galeri-hapus` (22px) < `.blt-cari-x`/`.forum-info` (24px) < `.dpk-nav` (24px) < `.rdr-stepper button` (~29-30px) < `.dpk-step`/`.aa-ikon` (26×32px / 30px) < `.dd-btn`-sebagai-panah (K1, ≈34×32px) < `.blt-modal-x` (32px).

**Tidak satu pun** kendali arrow/step/ikon-kecil yang diaudit mencapai 44px. Yang SUDAH memenuhi 44px justru kendali yang lebih besar dan tidak disebut di keluhan: `.cg.ada` (sel grid kalender bulan, min-height 44px) dan `.csb-d` (chip hari strip kalender, min-width 44px).

### 3.5 Komponen kanonis yang seharusnya dipakai tapi tidak

| Lokasi | Menulis ulang | Seharusnya pakai |
|---|---|---|
| `PetaInvestor.tsx:156-194` (Export XLS) | `.dd`/`.dd-btn`/`.dd-menu`/`.dd-it` manual + inline posisi | `Dropdown.tsx` (dipakai benar oleh ByStock/ByInvestor di halaman ANAK yang sama) |
| `AkunAdmin.tsx:267-274` + `AkunAdmin.css:42-47` (`.aa-cari`) | Wadah cari sendiri | `.af-cari` (dipakai benar 3× di halaman admin lain) |
| `Bulletin.tsx:192-200` (`.blt-cari`) | Wadah cari sendiri | `.af-cari` |
| `Seasonality.tsx`/`SeasonalityHarian.tsx` (`.sea-cari`) | Wadah cari sendiri (2×) | `.af-cari` |
| `Forum.tsx:63-66` | `.inp` polos tanpa wadah | `.af-cari` |
| `PetaInvestorSearch.tsx:77-88` (`.pi-search`) | Input custom | `.inp` (dengan wrapper `.af-cari` kalau perlu ikon) |
| `RadarUnggah.tsx:52-71` (`SlotBerkas`) | Disalin ulang dari BedahUnggah.tsx | Komponen bersama (ekstrak sekali, impor di kedua tempat) |
| `TopStocks.tsx:20` / `TopBroker.tsx:19` (`thBtn`) | Objek style disalin identik | Kelas CSS bersama `.th-sort` atau util satu sumber |
| `PRESET_BROKER` (BrokerSummary) vs `PRESET_RENTANG` (periode.ts) | Dua daftar preset terpisah, tumpang tindih 4 kata | Satu sumber preset dengan opsi tambahan per konteks |
| `Seasonality.tsx:194-200`, `SeasonalityHarian.tsx:151-156` (`.bchip.bchip-klik` sebagai pemilih rentang) | `.bchip` dipakai di luar peruntukan | `.chip-t` (kelas yang memang untuk pemilihan) |
| `Kalender.tsx:463-486,638-692` (`hariNav`/`csb-hari`, K1) | `.dd-btn` dipakai sebagai panah nav | Komponen langkah baru ber-target 44px (`.dpk-step` yang ada pun masih kurang) |

### 3.6 Usulan komponen kanonis

Dugaan awal spek (5 komponen) kurang dari kebutuhan nyata. Berdasarkan bukti di atas, diusulkan:

1. **`PemilihRentang`** — bungkus `.chip-t` group dengan state `.on`/disabled seragam. Menggantikan pola 1, 2, 4, 5, 6, 7 di §3.1.1 (enam dari sembilan). **Tidak** menggantikan pola 8 (Radar, kebutuhan beda: memilih EDISI diskrit, bukan rentang kontinu) dan pola 9 (Aktivitas Admin, kebutuhan beda: jendela waktu relatif-ke-sekarang, bukan rentang kalender). Kosakata final: keputusan Johan (prinsip #4 spek), tapi datanya sudah siap di §3.2.

2. **`LangkahTanggal`** — panah prev/next bertarget ≥44px, menggantikan `.dpk-nav`/`.dpk-step` (kanonis sendiri masih kurang!), `hariNav`/`csb-hari` Kalender.tsx (K1), `.rdr-stepper` Radar, dan paginasi `.dd-btn` (Kabar/AktivitasAdmin/RakTerbitan) — kalau paginasi teks-panjang ("‹ Lebih baru") tetap dianggap beda kebutuhan dari panah-ikon-murni, itu SAH dipisah asal disepakati eksplisit, bukan default karena lupa.

3. **`KalenderRentang`** — dua endpoint tanggal. K5 secara literal minta ini untuk Broker Summary (ganti dua `<DatePicker>` terpisah). Perlu diputuskan: apakah reuse mode-Rentang Kalender.tsx (klik 2 tanggal di grid) yang sudah ada, atau tetap dua DatePicker tapi disatukan visual — dua UX model berbeda untuk masalah sama, harus dipilih satu.

4. **`KotakCari`** — `.af-cari` sudah kanonis dan benar dipakai 3×; tinggal migrasi `.blt-cari`, `.sea-cari` (×2), `.aa-cari`, `.pi-search`, dan `.inp` polos Forum ke situ. Bukan komponen baru — cukup disiplin pakai yang sudah ada.

5. **`TombolIkon`** — satu ukuran ≥44px (ikon di dalam boleh tetap kecil visual, area klik yang wajib 44px, prinsip #5 spek eksplisit menyebut ini). Menggantikan 9 kelas di §3.1.4: `.buang`, `.af-ubah`, `.af-hapus`, `.aa-ikon`, `.aa-salin`, `.af-galeri-hapus`, `.blt-cari-x`, `.blt-modal-x`, `.forum-info`, `.pi-search-x`, `.pi-panel-close`.

6. **Disiplin `.bchip`** (bukan komponen baru, kebijakan pemakaian) — `.bchip` HANYA untuk badge kepemilikan non-interaktif (tugas aslinya). Migrasi 9+ titik pemakaian-di-luar-maksud (§3.1.5) ke: `.chip-t` kalau itu memang chip terpilih (ChartIndeks simbol, Seasonality "Mulai dari"/"Rentang", SeasonalityHarian "IHSG"), atau `.dd-btn`/`.btn-p` kalau itu sebenarnya tombol aksi (ForumRuang 5 tombol, ByStock/ByInvestor "Tampilkan lagi", StockDetail "Diskusi", Bulletin chip-filter).

7. **`TombolLayarPenuh`** — satu komponen untuk 3 implementasi identik-secara-fungsi (`.bchip`+inline ChartIndeks, `.pi-fs-btn` PetaInvestor, `.bchip`+inline Quadrant).

**Yang TIDAK diusulkan diseragamkan** (prinsip #6 spek — beda kebutuhan sah): `.aa-sakelar` (satu-satunya toggle switch, tak ada kebutuhan serupa di tempat lain saat ini); `.pilih`/`.pilih-k` kartu strategi AvgDown (kartu berdeskripsi, beda dari chip/tab polos); `.tile` sektor heatmap (kebutuhan visual spesifik warna-dinamis); `.blt-dl` link unduh langsung vs dropdown Export XLS (dua tugas beda: satu link-unduh-langsung, satu menu-pilihan-format).

### 3.7 `Chip` (K10) — kenapa satu komponen saja tidak cukup

Dugaan spek "komponen `Chip` untuk menyeragamkan sudut & tinggi" perlu dipecah, karena investigasi menunjukkan ada **empat kebutuhan fungsional berbeda** yang semuanya sekarang memakai kelas ber-"chip" tapi tidak sama maksudnya:

| Kelas sekarang | Maksud sebenarnya | Rekomendasi |
|---|---|---|
| `.chip` | Indikator status (naik/turun/peringatan), non-klik | Biarkan, sudah benar & konsisten. |
| `.chip-t` | Pil terpilih/toggle, radius 99px | Jadikan SATU-SATUNYA kelas untuk "pilih salah satu dari beberapa pil" — migrasi `.sea-chip` dan pemakaian `.bchip`-sebagai-pemilih ke sini. |
| `.bchip` | Badge kepemilikan non-interaktif (PilRow) | Kembalikan ke tugas asli SAJA — lihat §3.6.6. |
| `.gk-chip` | Chip anggota grup konglomerat (link ke StockDetail, radius `--r-kecil`) | Beda kebutuhan (bukan pilihan, bukan status — ini link navigasi dengan indikator naik/turun terpasang) — kandidat digabung ke pola `.chip` + link, bukan ke `.chip-t`. |

Kalau langsung dipaksa satu komponen `Chip` generik, risikonya sama seperti `.bchip` sekarang: satu kelas menanggung >1 tugas dan tiap pemakaian menambal bedanya lewat inline. K10 spesifiknya (IHSG vs BUMI) selesai begitu SeasonalityHarian berhenti mencabangkan className manual (`kode==='IHSG' ? bchip : sea-chip`, `SeasonalityHarian.tsx:111-116`) dan memakai satu `.chip-t` dengan prop `active`/`selected` — itu levelnya perbaikan satu file, bukan alasan untuk komponen chip universal.

---

## 4. Ringkasan angka untuk Tahap 2

- **9** pola/kosakata pemilih rentang waktu berbeda (bukan 5 dugaan awal).
- **5** implementasi panah langkah berbeda, termasuk DI DALAM komponen kanonis `DatePicker.tsx` sendiri (24px vs 26×32px).
- **6** wadah kotak cari berbeda untuk fungsi identik.
- **9** ukuran tombol-ikon-kecil berbeda, **nol** yang ≥44px.
- **≥9** titik pemakaian `.bchip` di luar maksud aslinya, **≥4** di antaranya inline `cursor:pointer` yang murni duplikat kelas yang sudah ada.
- **3** implementasi berbeda untuk tombol "Layar Penuh" yang fungsinya identik.
- **8** temuan inline-style yang seharusnya jadi kelas/varian (§3.3), satu di antaranya (`BedahUnggah.tsx:407`) mengabaikan modifier `.merah` yang SUDAH ADA dan dipakai di 3 tempat lain.
- **2** klaim spek yang tidak terverifikasi dari kode saat ini (K9 default 1Y; "Beranda" sebagai lokasi literal K2's contoh) — perlu konfirmasi Johan sebelum Tahap 2 mulai membongkar kode berdasarkan asumsi itu.
