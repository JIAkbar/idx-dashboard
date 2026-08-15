# Pedoman harga BEI — fraksi & auto rejection

Berlaku untuk **semua** angka harga yang dihasilkan PAPAN: target, support,
resistance, sasaran pemulihan, harga bedah, apa pun. Kodenya di
[`app/src/lib/fraksiHarga.ts`](../app/src/lib/fraksiHarga.ts), diuji di berkas
test sebelahnya.

## Kenapa ini wajib

Harga saham di BEI tidak bisa sembarang angka. "Resistance 1.237" adalah harga
yang **tak pernah bisa terjadi** — pada rentang Rp 500–2.000 fraksinya Rp 5,
jadi yang mungkin cuma 1.235 atau 1.240. Angka yang tak bisa dipesan di bursa
membuat seluruh analisisnya terbaca seperti dihitung tanpa melihat pasar.

## Fraksi harga (tick size)

| Rentang harga | Fraksi |
|---|---|
| < Rp 200 | Rp 1 |
| Rp 200 – 500 | Rp 2 |
| Rp 500 – 2.000 | Rp 5 |
| Rp 2.000 – 5.000 | Rp 10 |
| > Rp 5.000 | Rp 25 |

**Batas atasnya inklusif.** Harga tepat 2.000 masih fraksi Rp 5; mulai 2.001
baru Rp 10. Titik batas inilah yang paling sering salah dipakai.

## Auto rejection

| Harga acuan | ARA |
|---|---|
| ≤ Rp 200 | 35% |
| Rp 200 – 5.000 | 25% |
| > Rp 5.000 | 20% |

**ARB seragam 15%** untuk semua rentang, berlaku sejak **5 Juni 2023**
(sebelumnya 7% dan bertingkat).

## Cara pakai

```ts
import { keFraksi, hariAraMinimal } from '../lib/fraksiHarga'

keFraksi(1237, 'atas')   // 1240 — untuk target/resistance
keFraksi(1237, 'bawah')  // 1235 — untuk support/stop
hariAraMinimal(100, 100) // minimal hari ARA untuk naik 100%
```

Arah pembulatan bukan detail kosmetik: membulatkan target ke BAWAH berarti
menjanjikan harga yang lebih dekat dari yang sebenarnya, dan membulatkan
support ke ATAS berarti memasang jaring lebih tinggi dari yang bisa dipesan.

`hariAraMinimal` menghitung **bertingkat** — begitu harga melewati 200 atau
5.000, batas ARA-nya ikut berubah. Memakai satu batas untuk seluruh perjalanan
memberi angka yang terlalu optimis.

## Kalau BEI mengubah aturannya

Sunting `app/src/lib/fraksiHarga.ts` saja — seluruh halaman ikut. Jangan
menyalin angka fraksi ke komponen mana pun.

Sumber: [IDX press release](https://www.idx.co.id/en/news/press-release/518)
(mengembalikan 403 untuk pengambil otomatis — angkanya dirangkum dari
ringkasan publik, dan **perlu dicocokkan ulang ke dokumen resmi** sebelum
dipakai untuk keputusan yang mengikat).
