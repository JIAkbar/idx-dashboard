# SPEK — BANDARMOLOGI C2: kategori perilaku broker + turunannya — 27 Agu 2026

> Asal perintah Johan (verbatim, 27 Agu 2026): *"bandarmologi harusnya sudah bisa sih ini harus buat spec lagi dan dikerjakan"* (menunjuk C2 antrean yang dulu terhalang data — penghalang runtuh: arsip broker per emiten Stockbit 2016→ sudah di cakram).
> Keputusan Johan 27 Agu (AskUserQuestion): kategori broker = **PERILAKU TERUKUR** — dihitung dari data (porsi nilai pasar, directionality |net|÷gross, konsistensi), BUKAN daftar tetap. Kurasi 6 kelompok identitas (`kelompokBroker.ts`) tetap hidup untuk warna/atribusi — dua sumbu berbeda, jangan digabung.
> Audit gap 27 Agu (workflow `wf_522d15ac`): overlay bandarmologi (garis avg broker + bubble) SUDAH terpasang di GrafikEmiten & Whales Papan; kurva inventori SUDAH ada di Neo. Spek ini mengisi yang BELUM: kategori perilaku + gaya broker + kuadran + opposite NEGO + posisi 6 bulan/TRAPPED + konsensus/Group Score.

## A. Fondasi data — `kategori_broker.json` (paket A)

**Skrip baru `scripts/bangun_kategori_broker.py`** (nol jaringan; masuk rantai turunan panen setelah broker):

1. Jendela: **120 hari bursa terakhir** yang tersedia di arsip `data-idx/json/broker_tahunan/<KODE>/<tahun>.json` (varian reguler; 962 emiten).
2. Agregasi per broker (level pasar, dijumlah lintas emiten per hari): `gross_nilai = Σ(beli_nilai+jual_nilai)`, `net_nilai = Σ(beli_nilai−jual_nilai)`, hari aktif, dan deret net harian.
3. Metrik per broker:
   - `share` = gross broker ÷ gross seluruh pasar (jendela penuh);
   - `directionality` = |net| ÷ gross (0 = churn dua arah, 1 = searah penuh);
   - `konsistensi` = porsi hari yang searah dengan tanda net jendela;
   - `z_vol` = z-score gross harian terhadap rata-rata broker itu sendiri (untuk label REGIME volume di UI).
4. **Kategori (4): `whale` · `smart` · `smart_ritel` · `ritel`** — ambang TIDAK DIKARANG, dipetakan dari distribusi terukur: urutkan 88+ broker menurut `share`; kuartil share × median `directionality` menjadi ambang, dan **skrip WAJIB mencetak distribusinya** (per kategori: n broker, rentang share, median directionality) ke stdout + menyimpannya di ruas `kalibrasi` dalam keluaran. Aturan pemetaan awal (diuji, boleh digeser oleh angka):
   - `whale`: share tinggi (kuartil teratas) + directionality tinggi (≥ median) — besar dan posisional;
   - `smart`: directionality tinggi, share menengah;
   - `ritel`: share tinggi tapi directionality rendah ATAU basis nasabah perorangan (XL, YP dkk akan muncul sendiri dari angka churn-nya — jangan hard-code);
   - `smart_ritel`: sisanya yang konsisten arah tapi kecil.
5. **`gaya_broker` (label perilaku per jendela)**: `akumulasi` (net>0, konsistensi tinggi) · `distribusi` (net<0, konsistensi tinggi) · `flip_beli`/`flip_jual` (tanda net 20 hari terakhir berlawanan dgn 120 hari) · `scalper` (directionality rendah) · `campuran`. Ambang konsistensi dari distribusi (median), dicetak.
6. Keluaran: `data-idx/json/kategori_broker.json` = `{dibangun, jendela:{mulai,akhir,n_hari}, kalibrasi:{...}, broker:{KODE:{kategori, gaya, share, directionality, konsistensi, net_nilai, gross_nilai, z_vol_terakhir}}}`. Satu berkas, dibaca semua halaman.
7. Swauji + idempoten. Daftarkan ke `docs/status-panen.md` (turunan, manual "Panen Lagi", disebut juga di langkah [E] task buka-laptop — TIDAK ditambahkan ke bat pada spek ini; cukup manual dulu).

**Lib TS `app/src/lib/dasbor/kategoriBroker.ts`**: tipe + loader (pola `muatSektor`-like, TTL) + `LABEL_KATEGORI`/`LABEL_GAYA` (satu rumah ejaan, aturan #170). Uji vitest parse bentuk.

## B. Turunan di halaman (paket B — BrokerSummaryV2; paket C — Neo Inventory)

1. **Quadrant v2 (aktifkan tab yang dinonaktifkan)**: pakai `titikKuadran()` yang SUDAH ada (`brokerEmitenV2.ts:96`) — X = avg broker vs VWAP (%), Y = net nilai; 4 kuadran berlabel **Akumulasi Cerdas / Beli Agresif / Jual Panik / Distribusi** (Indonesia, bukan salinan Inggris); bubble = |net|, warna kelompok identitas; toggle Nilai/Lot ikut header.
2. **NEGO Opposite Pattern**: fungsi baru di `brokerEmitenV2.ts` — silangkan per broker per hari: `nego_beli>0 && reg_net<0` → `Nego Beli → Reg Jual` (dan kebalikannya); tab Nego dapat filter `Semua / Berlawanan / Searah` + kolom pola. Pola berlawanan = kandidat distribusi terselubung — tulis keterangannya di layar.
3. **Konsensus per kategori** (Overview BSv2): untuk rentang aktif, per kategori (whale/smart/smart_ritel/ritel): n broker net-beli vs net-jual + net gabungan + **konsistensi n/5 hari** (berapa dari 5 hari terakhir kategori itu net searah). Kartu kecil di Overview.
4. **Group Score strip harian** (Neo Inventory): skor harian per kategori = tanda net kategori (+1/−1/0) × jumlah broker searah, strip D-10..D0 dengan label tanggal. Bukan komposit ajaib — hanya penjumlahan tanda, dan keterangannya menyebut itu.
5. **Posisi 6 bulan per broker (Neo Inventory, tabel baru)**: per broker (jendela 126 hari bursa): `floor` = Σbeli_nilai ÷ (Σbeli_lot×100); `pnl%` = (harga_kini − floor) ÷ floor (hanya broker net-beli); `hari` = hari sejak posisi kumulatif net terakhir berpindah tanda; status `AKUM/DIST` (tanda net jendela) + tren 10 hari (`RE-AKUM`, `MELEPAS`); **badge TRAPPED n/5** = dari 5 net-buyer terbesar, berapa yang pnl% < 0. Sparkline D-10..D0 per baris (pakai komponen `Spark` yang sudah ada di Stalker — jangan bikin baru).
6. **Wiring toggle**: prop `mode`/`ukuran` header BSv2 diteruskan ke tab Inventory & Flow (audit: sekarang cuma Overview). Sumbu Reg/All TETAP terkunci Regular (data nego punya tab sendiri) — hapus opsi mati daripada toggle bohong, ATAU beri keterangan kenapa terkunci.

## C. Batas jujur & kriteria terima

- Semua label kategori/gaya menyertakan keterangan "dihitung dari perilaku 120 hari bursa terakhir, bukan daftar tetap" + tanggal `dibangun`. Tak ada klaim prediktif tanpa BadgeRapor.
- Leak pass: nol nama endpoint/berkas/skrip di layar.
- Kriteria Terima 6 butir `pengantar_pembagian_kerja.md` per halaman + khusus: (a) angka kategori satu broker diverifikasi manual dari arsip (lampirkan hitungan); (b) TRAPPED badge dicek 1 emiten: hitung ulang floor top-5 tangan; (c) tab Quadrant aktif & terklik nyata; (d) 2 viewport × 2 tema.
- Halaman TIDAK bertambah — semua turunannya menempel di halaman yang sudah terdaftar aksesnya. (Kecuali IPO — spek terpisah.)
