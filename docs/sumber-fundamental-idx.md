# Sumber fundamental resmi IDX — hasil uji langsung 16 Agustus 2026

Ditulis setelah menguji endpoint IDX **dari IP rumahan Johan** (bukan dari
runner/datacenter). Hasilnya mengubah beberapa anggapan lama.

## Ringkas

| Yang diuji | Hasil dari IP rumahan |
|---|---|
| `GetSecuritiesStock` | ✅ HTTP 200 · 132 KB |
| `GetStockSummary` | ✅ HTTP 200 · 643 KB |
| **`GetBrokerSummary`** | ✅ **HTTP 200 · 88 broker** |
| `GetCompanyProfiles` | ✅ HTTP 200 · **962 emiten** |
| **`GetFinancialReport`** | ✅ HTTP 200 · **778 emiten TW2 2026** |
| Unduh `FinancialStatement-*.xlsx` | ✅ 298 KB, terbaca penuh |

Bandingkan: dasbor SPLE memanggil endpoint broker yang sama lewat Netlify
Function dan menerima **`IDX API 403`** — IP datacenter diblokir. Jalur kita
lewat mesin rumahan justru terbuka. Ini pola yang sudah dikenal di proyek ini
(GitHub Actions diblokir, `JALANKAN_OTOMATIS.bat` lokal jalan).

---

## 1. Laporan keuangan resmi — XLSX ber-XBRL per emiten

Endpoint daftar:

```
https://www.idx.co.id/primary/ListedCompany/GetFinancialReport
  ?indexFrom=1&pageSize=1000&year=2026&reportType=rdf
  &EmitenType=s&periode=tw2&kodeEmiten=&SortColumn=KodeEmiten&SortOrder=asc
```

`periode`: `tw1` · `tw2` · `tw3` · `audit` (tahunan).

Tiap emiten mengembalikan `Attachments` berisi:

| Berkas | Isi |
|---|---|
| `FinancialStatement-<tahun>-<TW>-<KODE>.xlsx` | **Laporan lengkap ber-tag XBRL, dwibahasa** |
| `instance.zip` · `inlineXBRL.zip` | XBRL mentah untuk parsing terprogram |
| `FinancialStatement-…pdf` | Versi cetak |
| PDF laporan resmi emiten | Dokumen asli |

**Cakupan terukur (TW2 2026)**: 778 emiten, **777 punya .xlsx**, 774 punya XBRL.

### Isi berkas XLSX

Satu berkas = 47 sheet, tiap sheet satu kode taksonomi XBRL:

| Sheet | Isi |
|---|---|
| `1000000` | Informasi umum — nama, kode, **sektor/subsektor/industri/subindustri resmi IDX**, standar akuntansi, **informasi pemegang saham pengendali** |
| `4220000` | Laporan posisi keuangan (neraca) — 238 baris |
| `4312000` / `4322000` | Laba rugi & penghasilan komprehensif |
| `4410000` (+`PY`) | Perubahan ekuitas, dengan kolom tahun sebelumnya |
| `4510000` / `4520000` | Arus kas |
| `4611000`–`4695000` | Catatan atas laporan keuangan, per pos |
| `Context`, `hidden`, `Token` | Metadata XBRL |

Tiap baris dwibahasa: label Indonesia **dan** Inggris berdampingan.

### Kenapa ini lebih baik daripada Yahoo

| | Yahoo (sekarang) | IDX XLSX/XBRL |
|---|---|---|
| Asal angka | Agregator pihak ketiga | **Langsung dari emiten, resmi** |
| Cakupan | 646 emiten | **777 emiten** |
| Ruas per periode | 15 | **Ratusan** (seluruh pos + catatan) |
| Lubang data | `operating_cf` 80% kosong, `eps` 71% | Tidak ada — kalau emiten melaporkannya, ada |
| Sektor | Klasifikasi Yahoo | **IDX-IC resmi** (sektor→subindustri) |
| Bahasa | Inggris | Dwibahasa |
| Pemegang saham pengendali | ❌ | ✅ ada di sheet `1000000` |
| Kedalaman | 5 tahun / ~6 kuartal | Sejauh arsip IDX menyimpannya |

Yang Yahoo tetap unggul: rasio & metrik turunan siap pakai (PER, PBV, ROE,
Altman Z, F-Score, beta, target analis, median sektor) — itu tetap layak
dipertahankan. Rencananya bukan mengganti Yahoo, tapi **menambahkan IDX
sebagai sumber angka mentah** dan memakai Yahoo untuk turunannya.

---

## 2. Broker summary — sebagian mitos terbantah

`GetBrokerSummary?date=YYYYMMDD` mengembalikan **88 broker** dengan `IDFirm`,
`FirmName`, `Volume`, `Value`, `Frequency` untuk tanggal itu.

**Tapi**: parameter `stockCode`/`kodeEmiten` **diabaikan** — hasilnya selalu
level pasar, bukan per emiten. Jadi:

- Broker per **pasar** → tersedia lewat API (kita sudah punya juga dari PDF harian).
- Broker per **emiten** → tetap belum ketemu di endpoint publik. Dasbor SPLE
  memanggil `broker-data?kode=` dan hasilnya `rows: []` dengan error 403, jadi
  belum terbukti mereka benar-benar mendapatkannya.

Artinya #129 (bandarmologi) masih terhalang, tapi #151 berkurang cakupannya:
yang perlu dicari tinggal broker **per emiten**.

---

## 3. Profil perusahaan

`GetCompanyProfiles?start=0&length=1000&emitenType=s` → **962 emiten** dengan
alamat, BAE, industri, subindustri, email, situs, jenis efek yang diterbitkan.
Berguna untuk melengkapi metadata emiten yang sekarang diambil dari Yahoo.

---

## 4. Yang perlu diperhatikan sebelum memanen

- **Jangan dari runner/datacenter.** Terbukti diblokir. Panen wajib dari
  `JALANKAN_OTOMATIS.bat` di mesin rumahan.
- **Sopan santun sama seperti Yahoo**: satu permintaan pada satu waktu, jeda
  acak, backoff yang menghormati penolakan. 777 berkas × ~300 KB ≈ 230 MB
  sekali panen penuh — hanya perlu diulang saat ada rilis kuartalan baru,
  bukan harian.
- **Simpan hasil parse, bukan berkas mentahnya.** 230 MB XLSX tak perlu masuk
  repo; yang disimpan JSON hasil ekstraksi seperti `keuangan/<KODE>.json`
  sekarang.
- **`msoffcrypto-tool` tidak diperlukan** — XLSX IDX tidak terenkripsi.

## 5. Backlog yang lahir dari sini

| # | Tugas |
|---|---|
| 156 | Panen laporan keuangan resmi IDX (XLSX/XBRL) sebagai sumber utama, Yahoo tetap untuk rasio turunan |
| 157 | Ambil sektor/subsektor/industri/subindustri IDX-IC resmi dari sheet `1000000` — menggantikan klasifikasi Yahoo |
| 158 | Tarik "informasi pemegang saham pengendali" dari laporan resmi — pelengkap grup konglomerat (#155) yang sekarang hanya dari KSEI |
| 159 | Panen `GetBrokerSummary` harian ke JSON (88 broker) — pelengkap yang sekarang diparse dari PDF |
