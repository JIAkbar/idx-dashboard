# Produksi edisi Arus Pasar — prosedur baku

Untuk dipanggil di sesi Claude Code. Ditulis supaya langkahnya tak perlu
diingat ulang tiap kali, dan supaya urutannya sama tiap edisi.

Terakhir diperbarui: 16 Agustus 2026.

## Cara kerjanya — dua bagian, jangan tertukar

```
screenshot broker summary  ──[ TRANSKRIPSI: Claude membaca gambar ]──▶  edisi/<tgl>.json
                                                                              │
                                                        [ PERAKITAN: Python ] │
                                                                              ▼
                                                                    keluaran/*.html + *.pdf
```

**Transkripsi** butuh mata — dilakukan Claude di dalam sesi. **Perakitan** murni
Python, tak menyentuh gambar sama sekali; `build.py` hanya membaca JSON yang
isinya sudah berupa angka.

Keputusan Johan (16 Agu 2026): **tetap manual** (opsi A). Transkripsi tidak
dipindah ke API berbayar dan tidak dibebankan ke kontributor — konsekuensinya,
tiap edisi butuh satu sesi. Lihat #143 kalau keputusan itu ditinjau ulang.

---

## 1 · Harian (daily)

```bash
cd "C:/1-Johan/10. Pengembangan/IDX Statistik/arus-pasar"
python build.py 2026-08-14
```

`--tanpa-pdf` melewatkan render Playwright — dipakai saat mengecek HTML-nya
saja, jauh lebih cepat.

### Gerbang kredit (#181) — wajib diisi, kalau tidak ia diam

```bash
python build.py 2026-08-18 \
  "--disetujui=ADRO:Agitama;INET:Erika Julianti;TINS:Erika Julianti" \
  "--tak-terpakai=INET:rentang tanggalnya lebih dari satu hari;TINS:sama"
```

`--disetujui=` adalah SELURUH setoran yang lolos kurasi tanggal itu (salin dari
`/admin/kurasi`), bukan cuma yang dirakit. Build **berhenti** kalau ada yang
disetujui tapi tak jadi emiten edisi, dan menyebut nama penyetor + tickernya —
itulah gunanya. Alasan di `--tak-terpakai=` ikut tercetak di kolofon dan
tersalin ke `keluaran/<EDISI>.tak-terpakai.sql`; jalankan berkas itu sebagai
superadmin supaya pemicu `setoran_kabari_dimuat` mengabari penyetornya.

Pemisah pasangannya `;` (bukan `,` seperti `--kecuali=`) karena alasannya
kalimat dan koma di dalamnya wajar. Daftarnya boleh juga ditaruh di
`masuk/kredit-<EDISI>.json` ruas `"disetujui"`. **Tanpa salah satu dari
keduanya gerbangnya MATI** — ia mencetak peringatan lalu membiarkan build
jalan, supaya perakitan tetap mungkin tanpa kredensial (aturan yang sama
dengan `--kecuali=` di #138).

**Syarat sebelum dijalankan:** `edisi/2026-08-14.json` harus sudah ada. Itu
hasil transkripsi, bukan dibuat skrip.

Bentuk `edisi/<tgl>.json` — kunci atas: `edisi`, `tanggal`, `tanggal_id`,
`tanggal_flow`, `ihsg_baris`, `catatan_verifikasi`, `peran_broker`, `emiten`.
Tiap entri `emiten`: `ticker`, `nama`, `ohlc_hari`, `ema50`, `pivot`,
`pivot_ragu`, `beli`, `jual`, `slider_pct`, `label`, `arah`, `target`.

Keluaran: `keluaran/AP-<ddmmyy>-E01.html` + `.pdf` + `.meta.json`.

## 2 · Mingguan (weekly)

```bash
python build_weekly.py 2026-08-10 2026-08-14
```

Membaca **semua** `edisi/<tgl>.json` dalam rentang itu, menghitung ulang skor
tiap emiten per hari, lalu dedupe per ticker — kemunculan **terakhir** yang
jadi posisi terkini. Jadi edisi harian dalam rentang itu harus sudah jadi
lebih dulu.

Keluaran: `AP-W<ddmmyy akhir rentang>-E01`.

## 3 · Bulanan (monthly)

```bash
python build_monthly.py 2026-08
```

Bukan sekadar gabungan. Tiap pick dievaluasi terhadap **target dan
invalidation yang ditulis di edisi pertamanya**, memakai bar OHLC nyata
sesudah tanggal pick. Vonisnya: TARGET TERCAPAI / INVALID / BERJALAN / TANPA
DATA.

`TANPA DATA` bukan kegagalan — itu jawaban jujur saat harga sesudah pick belum
tersedia. Jangan "diperbaiki" dengan menebak.

Keluaran: `AP-M<mmyy>-E01`.

## 4 · Bedah single-saham

```bash
python build_bedah.py DSSA-2026-08-14
```

Sumbernya beda: bahan bedah disetor lewat tab Bedah (bukan setoran harian),
dan hanya kontributor Platinum ke atas yang boleh menyetorkannya.

Keluaran: `BA-<TICKER>-<ddmmyy>-E01`.

---

## Urutan lengkap satu edisi harian

1. **Kurasi** — buka `/admin/kurasi`, periksa setoran hari itu. Setujui yang
   benar, minta revisi yang perlu diperbaiki.
2. **Transkripsi** — minta Claude membaca screenshot yang disetujui dan
   menuliskan `edisi/<tgl>.json`. Ini langkah yang butuh sesi.
3. **Rakit** — `python build.py <tgl> --disetujui=... [--tak-terpakai=...]`
   (gerbang #181 di atas; tanpa `--disetujui=` ia tak memeriksa apa pun)
4. **Periksa PDF** — buka `keluaran/AP-<ddmmyy>-E01.pdf`. Yang paling sering
   salah: angka yang tak cocok dengan screenshot-nya.
5. **Unggah ke rak** lewat `/admin/terbitan`.
6. **Paket rilis WA** kalau ada yang perlu diumumkan — lihat aturan di
   `docs/rencana-berjalan.md`.

## Yang sering jadi masalah

| Gejala | Penyebab biasanya |
|---|---|
| `FileNotFoundError: edisi/<tgl>.json` | transkripsi belum dilakukan — langkah 2 terlewat |
| PDF kosong / chart tak muncul | Playwright menunggu `window.__chartsDone`; jalankan ulang tanpa `--tanpa-pdf` |
| Weekly melewatkan satu hari | `edisi/<tgl>.json` hari itu belum ada; weekly membaca yang ada saja, tanpa mengeluh |
| Angka di PDF tak cocok screenshot | salah transkripsi — perbaiki JSON-nya, jangan tambal di template |

## Catatan yang gampang terlupa

- Edisi bertanda `UJI-` membuat kode keluaran ikut berprefiks `UJI-`, supaya
  hasil uji tak menyamar sebagai edisi sungguhan.
- `build_weekly.py` mengimpor fungsi skor dari `build.py` — satu sumber rumus.
  Mengubah rumus di satu tempat mengubah keduanya, dan itu memang disengaja.
- Istilah **"orderbook" di kode dan UI sebenarnya BROKER SUMMARY** (#144).
  Jangan menambah pemakaian baru istilah lama.
