# Changelog — IDX Market Intelligence (dasbor lama)

Catatan riwayat versi dasbor lama (`index_live.html`), dipindah dari halaman UI ke sini
per keputusan 2026-08-10: changelog cukup jadi catatan lokal, tidak perlu jadi menu di
dasbor React yang baru.

## v5.0 — 11 Agustus 2026 — Redesign "Lantai Bursa" selesai + Changelog admin
- Dasbor publik (10 menu) & shell (rail, pita kurs, kaki, bilah+laci mobile) sepenuhnya
  memakai token & primitif "Lantai Bursa" (ink-navy + amber); `dasbor.css` lama dihapus,
  isinya yang masih dipakai dipindah ke `lantai.css`
- Changelog kembali sebagai halaman (bukan popup) — dibaca langsung dari berkas ini, tapi
  dikunci di `/admin/changelog`, bukan menu publik (rail publik tetap 10 menu)

## v4.9 — 7 Jun 2026 — Broker Summary — UI Refresh
- Tampilan Broker Summary diperbarui: tabs Inventory, Kuadran, NEGO, Flow
- Date picker baru bergaya kalender dengan preset 1D, 1W, 1M
- Header IHSG otomatis tersembunyi saat membuka Broker Summary

## v4.8 — 7 Jun 2026 — Broker Summary (Alpha)
- Panel baru: ranking broker, kuadran aktivitas, foreign flow agregat, & top NEGO

## v4.7 — 7 Jun 2026 — Fix mobile expand fullscreen + tombol Tampilkan
- Fix: Chart & Heatmap expand kini benar-benar fullscreen di mobile
- Peta Investor: tombol Tampilkan — ketik kode saham lalu tap Tampilkan
- Animasi panel diubah agar tidak mengganggu mode fullscreen

## v4.6 — 7 Jun 2026 — Animasi perpindahan panel (scale + fade)
- Setiap pindah menu kini ada animasi halus scale + fade mirip iOS
- Durasi 220ms — cukup terasa tapi tidak mengganggu

## v4.5 — 7 Jun 2026 — Fix mobile: Heatmap title & Peta Investor search
- Fix: judul Heatmap tidak lagi muncul dua kali di mobile
- Peta Investor mobile: kolom pencarian kini full-width, mudah diketik
- Panel pemegang saham tampil di bawah grafik saat di mobile
- Autocomplete saham: respons sentuh lebih andal di mobile

## v4.4 — 7 Jun 2026 — Fix Peta Investor — klik area kosong
- Fix: klik area kosong di grafik tidak lagi me-render ulang tampilan
- Tampilan awal Peta Investor: 10 emiten terpilih (lebih ringan)
- Detail emiten & pemegang saham tetap tampil di panel kanan grafik

## v4.3 — 7 Jun 2026 — Chart & Heatmap dua section independen
- Chart Indeks dan Heatmap kini selalu tampil bersamaan — tidak perlu pindah tab
- Tombol Expand per-section: Chart dan Heatmap bisa fullscreen masing-masing
- Fix: buka heatmap tidak lagi mengecilkan chart

## v4.2 — 7 Jun 2026 — Tema adaptif & panel kanan Peta Investor
- Popup detail saham & investor mengikuti tema terang/gelap aplikasi
- Panel pemegang saham tampil di sebelah kanan grafik jaringan
- Grafik jaringan Peta Investor ikut tema terang/gelap
- Fix: pindah tab Chart ↔ Heatmap tidak lagi merusak tampilan
- Fix: Chart Indeks tidak mengecil setelah keluar dari mode expand Heatmap

## v4.1 — 7 Jun 2026 — Peta Investor Redesign + Heatmap Fix
- Heatmap expand kini benar-benar fullscreen
- Grafik Jaringan: background gelap, sidebar kanan lebih bersih & informatif
- Klik baris investor/emiten langsung buka popup detail (tidak perlu klik +N lagi)
- By Investor & By Stock: tampil 20 baris awal, filter & load-more tetap berjalan
- Klik area kosong di grafik tidak lagi mereset ke tampilan berantakan

## v4.0 — 7 Jun 2026 — Peta Investor Overhaul + Expand Fix
- Chart & Heatmap expand kini benar-benar fullscreen — tidak lagi tampil bersamaan satu layar
- By Stock & By Investor — render 50 baris awal + tombol "Tampilkan N lagi" (952 emiten / 5277 investor)
- Klik +N lagi membuka popup detail holder/saham secara inline — tidak loncat ke Grafik Jaringan
- Fix error `piShowLoadMore is not defined` di Grafik Jaringan

## v3.9 — 7 Jun 2026 — Custom Autocomplete + Fix Expand
- Stock Detail — dropdown custom autocomplete: tampil 10 hasil, filter mengetik, navigasi keyboard (↑↓ Enter Esc)
- Fix double Tutup di Chart & Heatmap expand — tombol expand hilang saat fullscreen, ESC berfungsi

## v3.8 — 7 Jun 2026 — Nav Reorder + Fix Mobile + Price Performance
- Urutan menu: Kalkulator JIA dipindah setelah Peta Investor (sidebar + mobile nav)
- Fix Price Performance — data 1D/1W/1M/3M/6M/YTD sekarang tampil di Stock Detail
- Historis keuangan: tahun terbaru tampil di kiri, scroll ke kanan untuk tahun lama
- Animasi tombol "⋯ Lainnya" di mobile nav

## v3.7 — 7 Jun 2026 — Mobile UI Overhaul
- Fix horizontal scroll di semua panel mobile — konten tidak meluber keluar layar
- Peta Investor mobile: grafik lebih compact, scroll lebih lancar
- Chart/Heatmap Expand berfungsi di mobile
- Berbagai perbaikan layout card, tabel, dan input untuk layar kecil

## v3.6 — 7 Jun 2026 — Peta Investor Views & Posisi Saham
- By Stock — tabel semua emiten: jumlah holder, % CORP/IND/OTH, daftar pemegang ≥1%
- By Investor — tabel semua investor: tipe, jumlah saham dipegang, portfolio emiten
- Klik baris tabel langsung membuka grafik jaringan emiten/investor terkait
- Posisi Saham di Profit/ARA, Risk/Reward & Dividen — auto-fill kalkulator
- Menu Changelog dipindah ke sebelum Kritik & Saran

## v3.4 — 7 Jun 2026 — Notifikasi Update Otomatis
- Popup ringkasan update muncul setiap membuka dashboard — klik tutup untuk mulai
- Tombol "Lihat Changelog Lengkap" langsung menuju panel riwayat versi

## v3.3 — 7 Jun 2026 — Kalkulator JIA — Profit, Risk/Reward & Dividen
- Kalkulator Profit & ARA/ARB — hitung net profit dengan biaya broker, plus tabel ARA/ARB T+1 hingga T+5 otomatis
- Risk / Reward Calculator — setup Entry, Stop Loss, Target Price; visualisasi bar R:R; preset 1:1 s/d 1:5
- Dividend Calculator — hitung yield, net dividen setelah pajak, BEP harga, dan skenario jika saham turun pasca-dividen
- Input fee beli/jual terpusat (default 0.15% / 0.25%), terhubung ke semua kalkulator

## v3.2 — 7 Jun 2026 — Kalender Compact + Peta Investor Focused View
- Kalender lebih compact — sel lebih kecil, hapus strip mingguan
- Sesi Bursa otomatis menyesuaikan hari Jumat (Sesi I tutup 11:30, Sesi II mulai 14:00)
- Peta Investor Focused — saat klik/cari emiten, tampil bintang: emiten di tengah → pemegang saham → cross-holdings
- Animasi graf lebih cepat settle

## v3.1 — 7 Jun 2026 — Valuasi Estimasi + Smart Search Peta Investor
- Valuasi Estimasi di Stock Detail — Graham Classic √(22.5×EPS×BV), Graham Growth EPS×(8.5+2g)×4.4/Y, NCAV/Net-Net, semua interaktif dengan input editable
- Relative Valuation vs median sektor — P/E, P/B, Net Margin, ROE dibandingkan vs median sektor otomatis
- DDM (Dividend Discount Model) — Gordon Growth Model dengan required return yang bisa diubah
- Tren Historis — tabel EPS, BV/saham, FCF, ROE 4 tahun terakhir
- Smart Search Dropdown di Peta Investor — hasil muncul seketika, badge tipe (Emiten / Investor / Direksi / Pemilik Manfaat / Individu), jumlah kepemilikan, highlight kata kunci

## v3.0 — 6 Jun 2026 — Peta Investor — Jaringan Kepemilikan Saham IDX
- Tab baru Peta Investor — network graph kepemilikan saham berbasis data KSEI
- 952 emiten · 6.728 relasi pemegang saham ≥1% · Data 29 Mei 2026
- Node berwarna: Emiten, Institusi Domestik/Asing, Individu Lokal/Asing
- Klik emiten untuk lihat jaringan koneksi · Search nama saham/investor · Zoom & drag

## v2.9 — 6 Jun 2026 — Mobile — Bottom Navigation & Header Ranking
- Mobile: navigasi pindah ke bottom bar — semua menu terlihat tanpa scroll
- Ranking ASEAN / Asia Pasifik / Dunia tampil di baris tersendiri bawah angka IHSG
- Header mobile lebih bersih, angka dan ranking tidak saling menimpa

## v2.8 — 6 Jun 2026 — Changelog — Bersihkan Info Teknis dari UI
- Changelog: semua keterangan teknis (nama script, file, library) diganti dengan deskripsi fitur yang mudah dipahami

## v2.7 — 6 Jun 2026 — Stock Detail — Redesign Layout Konsisten
- Tampilan Stock Detail menggunakan gaya kartu konsisten dengan panel lain
- Fix tampilan tengah yang berantakan akibat duplikasi blok overview
- Tab kuartalan langsung muncul saat data dimuat (tidak perlu klik ulang)
- Hapus duplikat header pada panel Stock Detail

## v2.6 — 6 Jun 2026 — Mobile Fix & Stock Detail Cleanup
- Mobile: sidebar berubah jadi menu scroll horizontal dengan ikon + label
- Header mobile: teks YTD/ASEAN/Dunia lebih besar dan mudah dibaca
- Net Foreign: label Today/YTD warna lebih kontras
- Board Indices: scroll horizontal agar tidak melebar di layar kecil
- Stock Detail: tampilan lebih bersih, hapus elemen duplikat

## v2.5 — 6 Jun 2026 — Stock Detail — Data Lengkap + Google Analytics
- Stock Detail: tambah data Beta & 52W Change% di header, tabel Riwayat Dividen per tahun
- Analitik pengunjung — tracking perangkat, browser, dan jumlah pengunjung harian

## v2.4 — 6 Jun 2026 — Stock Detail — Layout 3 Kolom RTI Style
- Redesign panel Stock Detail: layout 3 kolom seperti RTI (Current Valuation, Per Share, Solvency)
- Kolom tengah: tab Kuartalan Net Income / EPS / Revenue + Profitabilitas + Growth + Dividen
- Kolom kanan: Income Statement TTM, Balance Sheet LQ, Cash Flow TTM, Price Performance (1D–YTD)
- Info sumber data disederhanakan — hanya tampil "data delay" tanpa detail teknis

## v2.3 — 6 Jun 2026 — Tab Stock Detail — Data Fundamental Saham
- Tab baru Stock Detail — data fundamental per saham IDX (valuasi, profitabilitas, likuiditas, historis 5 tahun)

## v2.2 — 6 Jun 2026 — Kritik & Saran via WhatsApp
- Menu baru Kritik & Saran — kirim masukan langsung via WhatsApp

## v2.1 — 6 Jun 2026 — Sidebar Navigasi & UI Overhaul
- Layout berubah ke sidebar kiri menggantikan tab bar horizontal
- Toggle tema Light/Dark berubah jadi switch iOS-style di sidebar
- Kalender otomatis tersembunyi di panel Chart, Avg Down, Changelog, dan Kritik & Saran

## v2.0 — 6 Jun 2026 — Tab Chart & Heatmap IDX
- Tab baru Chart — chart interaktif TradingView real-time, semua indeks IDX
- Heatmap saham IDX per sektor berdasarkan market cap & perubahan harga

## v1.9 — 6 Jun 2026 — Navigasi Kalender & PDF Improvement
- Tombol Today + tombol cepat per bulan untuk navigasi kalender
- Simpan PDF kini mengabaikan panel Average Down & Changelog

## v1.8 — 6 Jun 2026 — Ranking IHSG & Notifikasi Kalender
- Ranking IHSG di header: ASEAN · Asia Pasifik · Dunia
- Banner notifikasi di kalender: info rentang data tersedia & peringatan bulan kosong

## v1.7 — 6 Jun 2026 — Data Historis Lengkap & Perbaikan Mobile
- Data historis lengkap Januari–Juni 2026 (92 hari perdagangan)
- Perbaikan tampilan mobile: tab bar scroll horizontal, tidak overflow

## v1.6 — 5 Jun 2026 — Average Down Calculator
- Tab baru Average Down — 5 mode: Half Loss, Loss Max, End Average, Avg Down Qty, Avg Down Value
- Harga otomatis (delay ~15 menit) atau input manual, tersimpan di browser

## v1.5 — 4 Jun 2026 — Live Website & Update Otomatis
- Dashboard live di jiakbar.github.io/idx-dashboard/
- Data pasar update otomatis setiap hari kerja jam 20:00 WIB

## v1.4 — 3 Jun 2026 — Kalender Navigator Multi-Hari
- Kalender interaktif — klik tanggal untuk lihat data hari tersebut
- Hari bursa aktif tampil hijau dengan nilai IHSG & persentase perubahan

## v1.3 — 2 Jun 2026 — Penyempurnaan Tampilan & Data
- Header IHSG: nilai, perubahan harian, ranking ASEAN / Asia Pasifik / Dunia
- Net Foreign Flow: beli & jual asing, net flow, tren saham asing terbanyak
- Market Fundamental: PER & PBV pasar keseluruhan

## v1.2 — 1 Jun 2026 — Dashboard Lengkap 4 Tab
- Indeks Dunia, Top Stocks, Top Broker & Trading, Sektor & Indeks IDX
- Dual tema Dark / Light (default Light), export PDF satu halaman panjang

## v1.1 — 30 Mei 2026 — Ekspansi Tab & Sektor
- Tab Top Broker & Trading, Sektor & Indeks IDX
- Sector heatmap 11 sektor IDX
- **Board Indices: Main Board (Papan Utama), Development Board (Papan Pengembangan), Acceleration Board (Papan Akselerasi)**
- Indeks sektoral lengkap (IDX SMC, SRI-KEHATI, Pefindo, ESG, dll)

## v1.0 — 28 Mei 2026 — Prototype Awal
- Infografis pertama: World Index Comparison & Index Performance
- Tampilan awal tema gelap
