# Spek Auto Chart Patterns TradingView — hasil pembacaan langsung

Dibaca 21 Agu 2026 dari Help Center TradingView (Chrome Johan, artikel
"All Chart Patterns", "Chart Pattern Double Top" 43000653211, "Chart
Pattern Triangle" 43000653217), atas permintaan Johan: *"kmu kan bisa buka
chart trading view di remote chrome coba kmu pelajari spec detail nya"*.

## Daftar pola mereka (16)

Bullish/Bearish Flag · Bullish/Bearish Pennant · Double Top/Bottom ·
Triple Top/Bottom · Head & Shoulders (+Inverse) · Rising/Falling Wedge ·
Triangle · Rectangle · Cup & Handle (+Inverted).

PAPAN per hari ini: 9 reversal sudah jalan, 7 continuation sedang
dikerjakan. Selisih tersisa terhadap TradingView: **Rectangle** dan
**Cup & Handle** (dua-duanya belum diminta).

## Yang SAMA dengan mesin kita (memvalidasi keputusan yang sudah diambil)

- **Pivot 5/5** — "no higher highs 5 bars kiri & kanan". Persis
  `jendela: 5` bawaan kita.
- **Patahan pakai CLOSE**, bukan sumbu intraday. Persis `cariTembus`.
- **Leher Double Top = garis datar di lembah antara**. Persis.
- Jendela pencarian mereka 600 lilin terakhir; kita seluruh deret.

## Yang mereka punya dan kita BELUM — bahan gelombang berikut

1. **Target harga**: tinggi pola diproyeksikan dari patahan.
   - Double/Triple/H&S: tinggi = puncak (kepala) − leher; target =
     leher(iSinyal) ∓ tinggi.
   - Triangle/Wedge: tinggi = ALAS pola (jarak dua garis di awal pola);
     target = harga patahan ± tinggi searah patahan.
2. **Empat status** per pola, hidup mengikuti lilin baru:
   - *Awaiting* — belum sampai target, belum lewat level pembatal.
   - *Reached* — target tersentuh.
   - *Failed* — close melewati level pembatal sebelum target (DT: di atas
     puncak kedua; Triangle: melewati titik terakhir sisi berlawanan).
   - *Indefinable* — tak bisa diputuskan (kita tak perlu meniru ini).
3. **Gate integritas** (Triangle): antara titik 1 dan 5, CLOSE tidak boleh
   memotong garis polanya — pola yang bocor di tengah bukan pola.
4. **Trend Height** (Double Top): tinggi tren pendahulu relatif terhadap
   tinggi pola — setara syarat `tiang` kita untuk flag, tapi mereka juga
   memasangnya di pola puncak.
5. **Permissible Deviation** mereka berbasis PERSEN terhadap tinggi pola;
   kita berbasis ATR. Punya kita lebih cocok untuk papan IDX yang fraksi
   harganya bertingkat — dipertahankan, bukan diganti.
6. Resolusi pola bertumpuk: yang berstatus Awaiting menang; kalau seri,
   yang puncaknya paling setara (DT) / yang lebih besar (Triangle).
   Kita memakai klaim pivot (`terpakai`) — lebih sederhana, hasil serupa.

## Konvensi gambar mereka

Price Line = kerangka pivot (persis garis pertama kita); Neck/garis pola
solid; TARGET = garis putus-putus horizontal dari patahan ke kanan sampai
statusnya berubah, dengan label harga.
