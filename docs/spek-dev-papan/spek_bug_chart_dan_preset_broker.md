# BUG CHART GANTI EMITEN · TATA LETAK · PRESET BROKER — (Fable, 26 Agu 2026)

> Johan, dengan tiga tangkapan layar Neo Papan: *"Audit semua chart yang gini, ketika ganti emiten harga di chart tidak refresh malah mengecil"* · *"lagi-lagi nih layout nya saling menyentuh coba perbaiki"* · *"default broker itu AK BK dan buat preset juga broker-broker asing yang aktif besar, smart money, institusi, lokal"*.

---

## 1. 🔴 BUG — sumbu harga tidak menyegarkan saat ganti emiten

### Bukti dari tangkapan layar Johan
| Emiten | Sumbu kanan (harga) | Harga sebenarnya | Nilai |
|---|---|---|---|
| MBMA | 350 → 900 | ±565 | masuk akal ✓ |
| **AADI** | **−3000 → 3000** | **±9.000–10.000** | **mustahil** ✗ |

Sumbu harga **tidak mungkin negatif**. Dan pada tangkapan AADI, **candle tidak terlihat sama sekali** — konsisten dengan candle tergambar jauh di luar layar (di 9.000+) sementara sumbunya terkunci di rentang −3000…3000.

### Cacat struktural yang PASTI (terverifikasi di kode)
`InventoryTab.tsx:189-198`:
```ts
useEffect(() => {
  const chart = chartRef.current, lilin = lilinRef.current, vol = volRef.current
  if (!chart || !lilin || !vol || !candle) return   // ← ganti emiten: candle=null → RETURN
  lilin.setData(...); vol.setData(...); chart.timeScale().fitContent()
}, [candle, lilinRentang])
```
Ganti emiten memicu `setCandle(null)` (`:58`). Efek di atas lalu **keluar lebih awal tanpa membersihkan seri** — data emiten lama tetap menempel sampai data baru tiba. Ini cacat nyata terlepas dari gejala sumbu.

**Perbaikan wajib**: saat `candle` null, **kosongkan** seri, jangan `return`:
```ts
if (!chart || !lilin || !vol) return
if (!candle) { lilin.setData([]); vol.setData([]); return }
```

### Hipotesis gejala sumbu — WAJIB dipastikan di dev server, jangan diterima mentah
Sumbu kanan menampilkan nilai negatif berarti **ada seri bernilai negatif yang mendarat di skala kanan**, atau **autoscale skala kanan tak dipicu ulang** setelah `setData`. Kandidat penyebab, urut kemungkinan:
1. Seri garis kumulatif (`priceScaleId: 'left'`, `:211`) — **net kumulatif bisa negatif**. Kalau satu seri gagal dilepas (`removeSeries`) atau sempat ditambahkan sebelum `priceScaleId` berlaku, ia akan ikut menskalakan sumbu kanan.
2. `chart.timeScale().fitContent()` hanya menyesuaikan **waktu**, bukan harga. Skala harga punya autoscale sendiri; setelah `setData` pada seri yang sebelumnya kosong, autoscale tak selalu terpicu ulang.
3. Urutan efek: garis kumulatif (`:202`) dan candle (`:189`) adalah dua efek terpisah dengan dependensi berbeda — urutan jalannya tak dijamin saat emiten berganti.

**Cara memastikan (jangan menebak):** di dev server, ganti emiten MBMA→AADI, lalu di console periksa berapa seri yang menempel di skala kanan dan nilai `priceScale('right').options()`. Kalau ada seri kumulatif di sana, penyebab 1 terbukti. Baru perbaiki sesuai penyebab yang terbukti — bukan menambal ketiganya sekaligus.

**Kriteria terima**: (a) ganti emiten berkali-kali bolak-balik, sumbu kanan **selalu** mencerminkan rentang harga emiten yang sedang dibuka; (b) tak pernah ada nilai negatif di sumbu harga; (c) tak ada candle emiten lama yang tersisa sesaat; (d) diuji minimal tiga emiten berbeda skala harga (mis. AADI ±9.000, MBMA ±565, dan satu saham gocap ±50).

### "Audit semua chart yang gini" — daftar yang wajib diperiksa
Pola yang dicari: **chart yang emitennya bisa diganti** dan menaruh lebih dari satu jenis seri di skala berbeda. Periksa masing-masing dengan uji yang sama:
1. `neo-papan/InventoryTab.tsx` (sumber temuan)
2. `neo-papan/TransaksiTab.tsx` — candle + IHSG basis-100 + volume + dua pane; **paling banyak skala**, risiko tertinggi
3. `neo-papan/CompareTab.tsx` — dua chart sekaligus
4. `WhalesPapan.tsx` — candle + primitive, ganti emiten & ganti mode TF
5. `GrafikEmiten.tsx` — chart utama, ganti emiten sangat sering
6. `BrokerSummaryV2` (VsIhsg + Overview) — rebased dua deret
7. `neo-papan/RotasiTab.tsx`, `ActivityTab.tsx` — bukan per-emiten tapi ganti mode/periode; cek pola yang sama

---

## 2. 🔴 TATA LETAK "SALING MENYENTUH"

Johan: *"lagi-lagi nih layout nya saling menyentuh"* — kata **"lagi-lagi"** menandakan ini keluhan berulang yang belum tuntas. Perlakukan sebagai masalah sistemik, bukan satu halaman.

**Terlihat di tangkapan layar:**
- Label pill nilai di tepi kiri chart Inventory (`184,08 B BK` · `94,33 B AK` · `73,21 B ZP` · `35,69 B DP` · `12,00 B RX`) **bertumpuk rapat** dan menempel sumbu; pada AADI beberapa saling menindih.
- Pill `137.59M` di kiri bawah menyentuh tepi.
- Baris kendali Stalker (BROKER / JENDELA / INVESTOR / SARING) rapat tanpa jarak nafas.

**Yang harus dikerjakan:**
1. **Pill label seri**: pakai **dodge anti-tumpuk** yang sudah kalian bangun untuk label CPR (`pitaCprChart.ts`) — garis tetap di nilainya, hanya teks yang bergeser minimal setinggi-teks. Kalau lebih rapat dari muat, gabungkan jadi satu blok ringkas (pola yang sama).
2. **Jarak baku antar-kendali**: tetapkan satu variabel jarak (mis. `--sela-kendali: 10px`) dan pakai di semua baris kendali. Sekarang tiap halaman menentukan sendiri — itu akar "saling menyentuh" yang berulang.
3. **Sapuan lintas-halaman**: periksa halaman lain yang punya pill/label di tepi chart dengan pola yang sama.
4. Ini melengkapi `spek_konsistensi_komponen.md` §1 (tinggi chart vs panel Whales). Kerjakan berurutan; keduanya keluhan tata letak dari Johan yang sudah menunggu.

---

## 3. 🟢 PRESET BROKER — kabar baik, klasifikasinya SUDAH ADA

Johan minta: *"default broker itu AK BK dan buat preset juga broker-broker asing yang aktif besar, smart money, institusi, lokal"*.

**Tak perlu membangun klasifikasi baru.** `lib/dasbor/kelompokBroker.ts` sudah memuat peta kode → kelompok + nama sekuritas, dan cukup lengkap:

| Kelompok | Isi (contoh terverifikasi di kode) |
|---|---|
| **asing** (16) | AK UBS · BK J.P. Morgan · KZ CLSA · RX Macquarie · ZP Maybank · YU CGS International · TP OCBC · AI UOB Kay Hian · DR RHB · BQ Korea Investment · XA NH Korindo · AG Kiwoom · HD KGI · GA Yuanta · DP DBS Vickers · RB Nikko |
| **bumn** (4) | CC Mandiri · NI BNI · OD BRI Danareksa · DX Bahana |
| **smart** (±35) | LG Trimegah · SQ BCA · AZ Sucor · SS Samuel · HP Henan Putihrai · MG Semesta Indovest · GR Panin · KI Ciptadana · DH Sinarmas · EP MNC · dst |
| **ritel** (6) | PD Indo Premier · YP Mirae Asset · XC Ajaib · XL Stockbit · CP Valbury · KK Phillip |
| **afiliasi** | kosong (belum dikurasi) |
| **lain** | sisanya — **sengaja tidak ditebak** (`:80`: *"Yang Lokal DIBIARKAN 'lain', bukan ditebak jadi 'smart' atau 'ritel'"*) — sikap yang benar, pertahankan |

### Preset yang dibangun
| Preset | Definisi | Catatan |
|---|---|---|
| **Default: AK BK** | UBS + J.P. Morgan | permintaan langsung Johan; jadikan bawaan Inventory & Stalker |
| **Asing aktif besar** | kelompok `asing`, **disaring aktivitas**: ambil N teratas berdasar nilai transaksi pada rentang yang sedang dipilih | "aktif besar" = relatif rentang, jadi **hitung dinamis**, jangan daftar tetap |
| **Smart Money** | kelompok `smart` | langsung dari peta |
| **Institusi** | `smart` + `bumn` | institusi = non-ritel, non-asing; **tulis definisinya di tooltip** supaya tak ditebak pemakai |
| **Lokal** | semua kecuali `asing` (= `bumn` + `smart` + `ritel` + `lain`) | tooltip menyebut bahwa `lain` ikut, dan `lain` berarti belum terklasifikasi |

**Aturan wajib (konsisten dengan seluruh spek hari ini):**
- Tiap preset menampilkan **berapa broker yang benar-benar aktif** di rentang itu, bukan jumlah anggota daftar — pola `(n aktif/n anggota)` yang sudah dipakai Activity.
- Preset yang **nol broker aktif** di rentang terpilih ditampilkan nonaktif berikut alasan di `title`, bukan tombol yang menghasilkan grafik kosong.
- Tooltip tiap preset menyebut **definisinya** dan mengingatkan bahwa klasifikasi ini **kurasi PAPAN**, bukan penggolongan resmi bursa. Ini penting: "Smart Money" adalah istilah kita, dan pemakai berhak tahu itu penilaian, bukan fakta.
- **Jangan** menampilkan `afiliasi` sebagai preset selagi isinya kosong.

### Yang perlu diperiksa sebelum dibangun
Peta ini lahir dari kurasi khusus BUMI (`:3` — *"dari KURASI/KELAS di artifact rancangan Arus Broker BUMI"*). **Pastikan cakupannya masih masuk akal untuk emiten lain**: hitung berapa dari 108 broker yang ter-track punya kelompok selain `lain`. Kalau porsi `lain` besar, preset "Lokal" akan didominasi broker tak terklasifikasi — sah, tapi **tulis apa adanya** di tooltip.

---

## 4. Urutan

1. **Bug sumbu harga** (§1) — cacat kebenaran, terlihat langsung, dan menular ke banyak chart. Pastikan penyebabnya di dev server dulu, baru perbaiki.
2. **Sapuan chart lain** (§1 daftar) dengan uji yang sama.
3. **Preset broker + default AK BK** (§3) — murah, datanya sudah ada, permintaan langsung Johan.
4. **Tata letak** (§2) + `spek_konsistensi_komponen.md` §1 — dua-duanya keluhan tata letak yang sudah menunggu.
