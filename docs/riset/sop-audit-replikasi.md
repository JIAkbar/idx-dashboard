# SOP — Audit & Replikasi Halaman Pihak Ketiga

Johan 22–23 Agu 2026: *"gunakan kemampuan SOP untuk cek detail by detail page
yang perlu di replikasi"* · *"tambah audit juga untuk tradersaham.com dan
whales.id ... replikasi total seperti apa"*.

Lahir dari kesalahan 22 Agu: bongkar pasif tradersaham menyimpulkan "broker
summary cuma teaser" karena hanya bundle tanpa login yang dibaca. SOP ini
memaksa tiap langkah ditulis berikut buktinya, supaya kesimpulan "tidak ada"
tak lahir dari "tidak dilihat".

## Langkah (berurutan, tiap langkah punya keluaran tertulis)

| # | Langkah | Alat | Keluaran |
|---|---|---|---|
| 1 | **Infrastruktur** — DNS, CDN, header, framework, bundle, host API, auth | `nslookup`, `curl -I`, grep bundle | tabel lapis |
| 2 | **Peta fitur dari UI** — tiap menu/tab/tombol/dialog dibuka & disnapshot, termasuk yang butuh login (minta Johan login) | chrome-devtools `take_snapshot`, screenshot | daftar fitur per halaman |
| 3 | **Endpoint nyata** — tab Network saat tiap fitur dipakai, bukan tebakan dari bundle | `list_network_requests`, `curl` ulang endpoint publik | URL + parameter + bentuk balasan |
| 4 | **Sumber data** — dari bentuk balasan, tentukan data hulunya (IDX/KSEI/broker feed/tick intraday) | bedah JSON, decode payload | satu kalimat per fitur: "butuh data X pada granularitas Y" |
| 5 | **Peta ke bahan baku kita** — sudah ada / bisa dipanen / mustahil | `docs/status-panen.md`, inventaris Stockbit | tabel fitur × status bahan |
| 6 | **Keputusan replikasi** — total / sebagian / tidak, dengan alasannya | Johan | baris di `antrean.md` |
| 7 | **Desain versi kita** — apa yang lebih dari referensi, bukan cuma sama | mockup artifact | template di `docs/desain/` |

Aturan tambahan (Johan 23 Agu 2026): **tiap menu wajib diturunkan sampai
habis** — submenu, tab, dialog, tombol, sakelar, preset, dan fungsi di
baliknya; halaman berbayar diaudit SESUDAH berlangganan, bukan ditebak dari
versi terkunci. Keluaran langkah 2 berbentuk pohon: menu → submenu → fitur →
kendali, masing-masing dengan bukti (snapshot/teks).

Aturan: **kesimpulan negatif wajib menyebut langkah mana yang menghasilkannya**
("tak terlihat di bundle publik" ≠ "tidak ada"). Langkah 2 tanpa login hanya
memetakan pintu masuk; fitur berbayar baru terlihat sesudah Johan login.

## Mekanika langkah 2 — dua jebakan yang membatalkan seluruh audit

Keduanya terjadi pada audit premium tradersaham 23 Agu 2026 dan menghasilkan
kesimpulan "isinya sama semua" untuk enam mode yang sebenarnya berbeda total.

1. **Klik lewat `ref` bisa hanya MENYOROT, bukan memindahkan.** Tab tampak
   aktif di tangkapan layar sementara URL tak berubah dan isinya tetap tab
   sebelumnya. **Klik dengan koordinat** dari tangkapan layar, lalu
   **verifikasi URL berubah** sebelum membaca isi. URL adalah buktinya, bukan
   sorotan tab.
2. **Overlay pemuatan menahan isi jauh lebih lama dari yang terlihat.**
   tradersaham menampilkan "Scanning Stocks / CALCULATING SIGNALS…" 20+ detik;
   pembacaan cepat menangkap DOM lama dan terbaca sebagai "kontennya identik".
   Beri **jeda ≥20 detik** sesudah tiap masukan, dan pastikan penanda muatnya
   hilang sebelum membaca.

Gejala khas dua-duanya sama — "semua tab isinya sama" — dan itu hampir selalu
kesalahan alat, bukan temuan tentang situsnya.

## Audit yang sudah dijalankan dengan SOP ini

- tradersaham.com — `docs/riset/tradersaham-bongkar.md` (langkah 1–5; audit
  premium ulang 23 Agu 2026 dengan jeda per klik, 15 menu diturunkan habis).
- whales.id — `docs/riset/whales-bongkar.md` (langkah 1–5 lengkap; API publik
  terbaca tanpa login).
