# Arus Pasar — Desain Ujicoba Terbitan (2026-08-10)

Metodologi lengkap: `METODOLOGI-ANALISA.md` (akar repo). Dokumen ini hanya keputusan desain
ujicoba yang sudah disetujui user.

## Keputusan

| Hal | Keputusan |
|---|---|
| Nama terbitan | **Arus Pasar**, kode edisi `AP-DDMMYY-Enn` |
| Emiten ujicoba | ARCI, MBMA, VKTR (chart TradingView + orderbook Stockbit dari user, `data emiten/`) |
| Keluaran | PDF A4, dibangun HTML → cetak headless Chrome/Edge |
| Identitas visual | Disetujui via mockup artifact `52949aaa`: dasar biru-laut `#0B1220`, aksen teal arus `#2DD4BF`, masthead serif `≋ ARUS PASAR`, `tabular-nums`; dua tema (gelap layar, terang untuk cetak) |
| Sumber OHLC | yfinance dari mesin lokal (runner GitHub diblokir utk `history()`) |
| Big Money Flow | Tangkapan layar Stockbit → kubaca lewat penglihatan → JSON terstruktur → **wajib verifikasi user** |
| Level S/R | Pivot Points dari chart TradingView user (bukan Fibonacci referensi) |
| Skor | Model §7 metodologi: Technical 35 + Flow 30 + RR 20 + Liquidity 10 + IHSG sens 5; data hilang → penalti §8 |
| React | Template HTML mandiri; refactor React nanti port byte-per-byte (workflow §169) |

## Struktur berkas

```
arus-pasar/
  template.html        — halaman A4 print-ready (cover + emiten + ranking), CSS var dua tema
  build.py             — fetch OHLC yfinance, hitung indikator+skor, injeksi data → keluaran HTML
  edisi/2026-08-10.json — data edisi: flow hasil transkripsi, pivot, narasi analis
  keluaran/            — AP-100826.html + AP-100826.pdf (gitignore? tidak — hasil kecil, ikut repo)
```

## Halaman ujicoba

1. Sampul (masthead + daftar isi edisi)
2. 3× halaman emiten (struktur §4 metodologi)
3. Peringkat (model §7, tabel skor + rationale)

Halaman IHSG & Flow Asing ditunda — data `ds_*.json` berhenti 5 Juni; menyusul setelah
pipeline hidup.

## Alur harian (setelah ujicoba)

```
user: screenshot chart TV + orderbook Stockbit → data emiten/
claude: transkripsi flow (verifikasi user) → build.py → PDF
```
