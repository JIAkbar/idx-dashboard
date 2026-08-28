# -*- coding: utf-8 -*-
"""Jejak Rekomendasi — generator C.1 (docs/spek-dev-papan/spek_preset_winrate_rekap.md §Tugas C).

Nol jaringan: seluruh masukan sudah di cakram — `kartu/arsip/<tgl>.json`
(ruas preset, ditulis `kartu_analisa.py --semua --tulis`) + `ohlc/<KODE>.json`
(low harian, untuk entry & SL). Menulis
`data-idx/json/rekomendasi/<YYYY-MM-DD>.json` SEKALI per tanggal — kalau
berkasnya sudah ada, TIDAK ditimpa (kejujuran backtest, spek §C.1: "Sekali
ditulis TIDAK diedit; koreksi = berkas koreksi terpisah"). Jalankan lagi hari
yang sama cuma mencetak peringatan dan keluar bersih — aman dipanggil
berulang dari bat panen.

Preset dari `app/src/lib/dasbor/presetScreener.ts` — DIPORT ke Python di
bawah (`PRESET_DEFS`) karena generator ini Python sementara presetnya
didefinisikan TypeScript untuk UI Screener. Kalau presetScreener.ts berubah
ambang/kriterianya, port ini WAJIB ikut disunting supaya jejak & UI tak
diam-diam berbeda aturan.

Jalankan dari akar repo:
    python scripts/riset/rekap_preset.py                       # tanggal bertransaksi terbaru (otomatis)
    python scripts/riset/rekap_preset.py --tanggal 2026-08-27   # tanggal tertentu (perlu kartu/arsip/<tgl>.json)
    python scripts/riset/rekap_preset.py --backtest 2026-07-24 2026-08-21   # semua tanggal arsip di rentang itu
    python scripts/riset/rekap_preset.py --uji                  # swauji tanpa I/O
"""
from __future__ import annotations

import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from kartu_analisa import _baca_ohlc, ke_fraksi, OHLC, KARTU_DIR  # noqa: E402  (reuse — jangan duplikat fraksi BEI)

AKAR = Path(__file__).resolve().parents[2]
REKOMENDASI_DIR = AKAR / "data-idx" / "json" / "rekomendasi"
ARSIP_DIR = KARTU_DIR / "arsip"

# Berapa emiten skor tertinggi per preset yang ditulis ke jejak — SPLE
# mengirim segelintir pilihan tiap sore, bukan seluruh populasi lolos (itu
# tugas tab Preset di Screener, bukan arsip win-rate yang wajib "kecil" di
# git, spek §Tugas C.1).
TOP_N = 20
# Ambang "hari ini punya data nyata" untuk pemilihan tanggal otomatis —
# snapshot intraday yang chartbit-nya belum settle punya freq/volume nol di
# hampir semua baris (harga cuma ditaruh datar = prev close), lihat
# CLAUDE.md "sumber data". >=100/962 baris berfrekuensi jadi penanda murah
# bahwa arsip hari itu sungguh sudah dari hari bursa yang tuntas.
AMBANG_HARI_TERISI = 100


# ------------------------------------------------------------- port kriteria
# Persis app/src/lib/dasbor/presetScreener.ts (baris ~108-278). `row` di sini
# = satu baris `kartu/arsip/<tgl>.json` (bentuknya sama `BarisRingkas`, ruas
# preset SUDAH ada di situ — lihat `ringkas_dari_kartu()` di kartu_analisa.py).

def num(v) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)


def dari(v):
    """`None` -> 'tak-terukur' (persis fungsi `dari()` TS)."""
    return 'tak-terukur' if v is None else ('lolos' if v else 'gagal')


def _leq(v, batas):
    return dari(v <= batas) if num(v) else 'tak-terukur'


def _geq(v, batas):
    return dari(v >= batas) if num(v) else 'tak-terukur'


def _gt(v, batas):
    return dari(v > batas) if num(v) else 'tak-terukur'


def _cmp2(a, b, ok):
    return dari(ok(a, b)) if num(a) and num(b) else 'tak-terukur'


def _accdist_null_only(row):
    """Scalping 'arus-broker': cuma `None` dianggap tak-terukur (TS: `===
    null ? null : ...`), string kosong TETAP diuji (dan gagal, karena "" tak
    mengandung 'acc')."""
    v = row.get('label_accdist')
    if v is None:
        return 'tak-terukur'
    return dari('acc' in v.lower())


def _accdist_null_or_kosong(row):
    """Whale-Akumulasi 'arus-akumulasi': `None` ATAU "" dianggap tak-terukur
    (TS: `=== null || === '' ? null : ...`) — beda dari scalping di atas."""
    v = row.get('label_accdist')
    if not v:
        return 'tak-terukur'
    return dari('acc' in v.lower())


HARGA_MIN = 50

PRESET_DEFS = [
    {
        'id': 'scalping', 'label': 'Scalping',
        'kriteria': [
            ('ramai', lambda r, c: _leq(r.get('peringkat_value'), 50)),
            ('frekuensi', lambda r, c: _geq(r.get('freq'), 10_000)),
            ('order-kecil', lambda r, c: dari(r['ukuran_order'] <= c['p25'])
                if num(r.get('ukuran_order')) and num(c.get('p25')) else 'tak-terukur'),
            ('ma-naik', lambda r, c: _cmp2(r.get('ma5'), r.get('ma20'), lambda a, b: a > b)),
            ('pita-atas', lambda r, c: _geq(r.get('posisi_bb'), 0.5)),
            ('arus-broker', lambda r, c: _accdist_null_only(r)),
            ('bukan-gocap', lambda r, c: _gt(r.get('harga'), HARGA_MIN)),
        ],
    },
    {
        'id': 'swing', 'label': 'Swing',
        'kriteria': [
            ('susunan-ma', lambda r, c: (
                dari(r['harga'] > r['ma20'] > r['ma50'])
                if num(r.get('harga')) and num(r.get('ma20')) and num(r.get('ma50')) else 'tak-terukur'
            )),
            ('di-atas-awan', lambda r, c: dari(r.get('di_atas_kumo'))),
            ('tren-regresi', lambda r, c: _geq(r.get('posisi_regresi'), 0)),
            ('asing-masuk', lambda r, c: _gt(r.get('net_asing_rp'), 0)),
        ],
    },
    {
        'id': 'whale-tiket', 'label': 'Whale · Tiket Besar',
        'kriteria': [
            ('jejak-tiket', lambda r, c: _whale_tiket_jejak(r)),
            ('ramai', lambda r, c: _leq(r.get('peringkat_value'), 200)),
            ('bukan-gocap', lambda r, c: _gt(r.get('harga'), HARGA_MIN)),
        ],
    },
    {
        'id': 'whale-akdis', 'label': 'Whale · Akumulasi',
        'kriteria': [
            ('arus-akumulasi', lambda r, c: _accdist_null_or_kosong(r)),
            ('terkonsentrasi', lambda r, c: _geq(r.get('top3_pct'), 60)),
            ('pembeli-sedikit', lambda r, c: _leq(r.get('number_broker_buysell'), 0)),
        ],
    },
    {
        'id': 'whale-asing', 'label': 'Whale · Asing',
        'kriteria': [
            ('asing-5h', lambda r, c: _gt(r.get('asing_net_5h'), 0)),
            ('asing-konsisten', lambda r, c: _geq(r.get('asing_streak'), 3)),
            ('asing-berarti', lambda r, c: _geq(r.get('porsi_asing'), 0.2)),
        ],
    },
]


def _whale_tiket_jejak(r):
    """Empat pintu ATAU (TS presetScreener.ts:204-213) — tak-terukur hanya
    kalau KEEMPAT ruasnya kosong."""
    pintu = [
        (r.get('tiket_lonjakan'), 2, _geq),
        (r.get('tiket_broker_maks'), 250_000_000, _geq),
        (r.get('bval_maks'), 5_000_000_000, _geq),
        (r.get('nego_blok_rp'), 5_000_000_000, _geq),
    ]
    hasil = [f(v, batas) for v, batas, f in pintu]
    if all(h == 'tak-terukur' for h in hasil):
        return 'tak-terukur'
    return 'lolos' if any(h == 'lolos' for h in hasil) else 'gagal'


def hitung_ukuran_order_p25(rows: list[dict]) -> float | None:
    """Persis `hitungUkuranOrderP25` TS — persentil 25 ATAS POPULASI HARI ITU
    (bukan angka tetap)."""
    v = sorted(r['ukuran_order'] for r in rows if num(r.get('ukuran_order')))
    if not v:
        return None
    return v[math.floor((len(v) - 1) * 0.25)]


def nilai_preset(row: dict, preset: dict, ctx: dict) -> dict:
    rinci = [(kid, fn(row, ctx)) for kid, fn in preset['kriteria']]
    lolos = sum(1 for _, h in rinci if h == 'lolos')
    gagal = sum(1 for _, h in rinci if h == 'gagal')
    terukur = lolos + gagal
    return {'kode': row['kode'], 'lolos': lolos, 'terukur': terukur, 'rinci': rinci, 'row': row}


def jalankan_preset(rows: list[dict], preset: dict, ctx: dict, min_lolos: int = 1) -> list[dict]:
    hasil = [nilai_preset(r, preset, ctx) for r in rows]
    hasil = [h for h in hasil if h['terukur'] > 0 and h['lolos'] >= min_lolos]
    hasil.sort(key=lambda h: (-(h['lolos'] / h['terukur']), -h['lolos'], h['kode']))
    return hasil


# ------------------------------------------------------------- entry/TP/SL
def bangun_saham(row: dict, tanggal: str) -> dict:
    """Entry/TP/SL — fallback ATR (spek §Tugas B): Target Realistis "papan
    terdorong" butuh antrean penutupan (bid/offer) yang cuma ada dari
    setoran Kuli Papan kontributor, bukan data cakram untuk 962 emiten
    sekaligus — jadi generator ini SELALU memakai jalur fallback, bukan
    memilih di antara keduanya (jangan duplikasi rumus papan di sini, itu
    tugas UI/lib TS `kuliPapan.ts` kalau nanti disambungkan)."""
    harga = row.get('harga')
    atr_pct = row.get('atr_pct')
    atr = harga * atr_pct / 100 if num(harga) and num(atr_pct) else None

    low_hari = None
    low5 = None
    d = _baca_ohlc(OHLC / f"{row['kode']}.json", sampai=tanggal)
    if d is not None and d['tgl'][-1] == tanggal:
        low_hari = d['l'][-1]
        low5 = min(d['l'][-5:])

    entry = [low_hari, harga] if low_hari is not None and num(harga) else None
    if atr is not None and num(harga):
        tp1 = ke_fraksi(harga + 1 * atr, 'atas')
        tp2 = ke_fraksi(harga + 2 * atr, 'atas')
        cand_sl = harga - 1.5 * atr
        if low5 is not None:
            cand_sl = min(low5, cand_sl)
        sl = ke_fraksi(cand_sl, 'bawah')
    else:
        tp1 = tp2 = sl = None

    return {
        'kode': row['kode'],
        'close': harga,
        'entry': entry,
        'tp1': tp1,
        'tp2': tp2,
        'sl': sl,
        'ringkas': {
            'freq': row.get('freq'),
            'ukuran_order': row.get('ukuran_order'),
            'fd': row.get('label_fd'),
            # Tugas A #7 (bandar_top1_kode/avg dari GROSS broker) belum
            # dibangun di kartu_analisa.py — None jujur, bukan tebakan dari
            # ruas lain (broker_tiket_maks_kode itu KONSEP BEDA: broker
            # bertiket rata-rata terbesar, bukan net buyer nilai terbesar).
            'bandar_top1_kode': None,
            'bandar_top1_avg': None,
            'label_accdist': row.get('label_accdist'),
        },
    }


# ------------------------------------------------------------- I/O tanggal
def muat_arsip(tanggal: str) -> dict | None:
    p = ARSIP_DIR / f"{tanggal}.json"
    if not p.exists():
        return None
    return json.loads(p.read_text(encoding='utf-8'))


def emiten_berfrekuensi(arsip: dict) -> int:
    """Berapa emiten di arsip itu yang sungguh bertransaksi hari itu."""
    return sum(1 for r in arsip.get('emiten') or [] if (r.get('freq') or 0) > 0)


def pilih_tanggal_otomatis() -> str | None:
    tanggal_tersedia = sorted(p.stem for p in ARSIP_DIR.glob('*.json'))
    for tgl in reversed(tanggal_tersedia):
        arsip = muat_arsip(tgl)
        if arsip is None:
            continue
        terisi = emiten_berfrekuensi(arsip)
        if terisi >= AMBANG_HARI_TERISI:
            return tgl
        print(f"  {tgl}: cuma {terisi} emiten berfrekuensi (< {AMBANG_HARI_TERISI}) — kemungkinan snapshot "
              f"belum settle, coba tanggal sebelumnya")
    # Dulu di sini ada fallback "pakai yang terbaru apa adanya". Dibuang 28
    # Agu 2026: sejak tulis_untuk_tanggal() memagari arsip bar hantu, tanggal
    # itu pasti ditolak juga di hilir — fallbacknya cuma menghasilkan pesan
    # ganda yang membingungkan. Tak ada tanggal layak = tak menulis apa-apa.
    return None


def perbarui_index() -> None:
    tanggal_list = sorted(p.stem for p in REKOMENDASI_DIR.glob('*.json') if p.stem != 'index')
    waktu = datetime.now(timezone.utc).isoformat(timespec='seconds')
    (REKOMENDASI_DIR / 'index.json').write_text(
        json.dumps({'diperbarui': waktu, 'tanggal': tanggal_list}, ensure_ascii=False, indent=1),
        encoding='utf-8')


def tulis_untuk_tanggal(tanggal: str, backtest: bool, top_n: int = TOP_N, rekomendasi_dir: Path | None = None,
                        ambang: int = AMBANG_HARI_TERISI) -> bool:
    """`True` kalau berkas baru ditulis, `False` kalau dilewati (sudah ada /
    arsipnya tak ketemu). `rekomendasi_dir` dioper eksplisit di uji supaya
    swauji tak pernah menyentuh `data-idx/json/rekomendasi/` sungguhan."""
    out_dir = rekomendasi_dir or REKOMENDASI_DIR
    out = out_dir / f"{tanggal}.json"
    if out.exists():
        print(f"  {tanggal}: sudah ada — dilewati (sekali tulis, tidak diedit; spek §Tugas C.1)")
        return False
    arsip = muat_arsip(tanggal)
    if arsip is None:
        print(f"  {tanggal}: tak ada kartu/arsip/{tanggal}.json — dilewati (backfill ke tanggal itu "
              f"di luar cakupan generator ini, lihat docstring)")
        return False

    # PAGAR BAR HANTU — temuan 28 Agu 2026. SEBABNYA: sumber harga menulis bar
    # bertanggal HARI BERJALAN dengan volume/nilai/frekuensi NOL dan OHLC rata
    # sama penutupan kemarin, sebelum data hari itu terbit; kartu_analisa.py
    # ikut mengarsipkannya, jadi kartu/arsip/2026-08-28.json ADA dan berisi 963
    # emiten — nol di antaranya berfrekuensi. Pagar ambang ini dulu cuma
    # dipasang di pilih_tanggal_otomatis(), sehingga jalur --tanggal dan
    # --backtest menembusnya: terbukti menulis 81 baris saham lintas 5 preset
    # dari harga hantu (AADI skor 1,0, entry [10125, 10125] karena low = close
    # pada bar rata), dan preset-preset itu tak menguji freq jadi nol pun lolos.
    # Karena rekomendasi/<tgl>.json SEKALI TULIS TAK DIEDIT, satu jalan salah
    # menanam berkas cacat permanen. Angka menyesatkan lebih buruk daripada
    # angka absen — pagarnya pindah ke sini supaya ketiga jalur lewat satu
    # pintu yang sama.
    terisi = emiten_berfrekuensi(arsip)
    if terisi < ambang:
        print(f"  {tanggal}: cuma {terisi} emiten berfrekuensi (< {ambang}) — arsip bar hantu / snapshot "
              f"belum settle, TIDAK ditulis (berkas rekomendasi sekali tulis tak diedit)")
        return False

    rows = arsip['emiten']
    ctx = {'p25': hitung_ukuran_order_p25(rows)}
    presets_out = []
    for pd in PRESET_DEFS:
        hasil = jalankan_preset(rows, pd, ctx, min_lolos=1)
        saham = []
        for h in hasil[:top_n]:
            s = bangun_saham(h['row'], tanggal)
            s['skor'] = round(h['lolos'] / h['terukur'], 4)
            saham.append(s)
        presets_out.append({'preset': pd['id'], 'saham': saham})

    out_dir.mkdir(parents=True, exist_ok=True)
    isi = {
        'tanggal': tanggal,
        'dibangun': datetime.now(timezone.utc).isoformat(timespec='seconds'),
        'backtest': backtest,
        'presets': presets_out,
    }
    out.write_text(json.dumps(isi, ensure_ascii=False, indent=1), encoding='utf-8')
    n_saham = sum(len(p['saham']) for p in presets_out)
    print(f"  {tanggal}: tersimpan {out.name} — {n_saham} baris saham lintas {len(presets_out)} preset"
          f"{' (BACKTEST)' if backtest else ''}")
    if out_dir == REKOMENDASI_DIR:
        perbarui_index()
    return True


# ------------------------------------------------------------------- swauji
def uji() -> None:
    import tempfile

    # 1) dari()/num() dasar
    assert dari(None) == 'tak-terukur' and dari(True) == 'lolos' and dari(False) == 'gagal'
    assert num(0) and num(3.5) and not num(None) and not num(True) and not num(float('nan'))

    # 2) label_accdist — dua aturan null-nya BEDA (scalping vs whale-akdis)
    assert _accdist_null_only({'label_accdist': None}) == 'tak-terukur'
    assert _accdist_null_only({'label_accdist': ''}) == 'gagal'  # "" TETAP diuji di scalping
    assert _accdist_null_only({'label_accdist': 'Big Acc'}) == 'lolos'
    assert _accdist_null_or_kosong({'label_accdist': ''}) == 'tak-terukur'  # beda: "" = tak-terukur
    assert _accdist_null_or_kosong({'label_accdist': 'Dist'}) == 'gagal'

    # 3) hitung_ukuran_order_p25 — tangan-hitung: [1,2,3,4,5,6,7,8] -> idx floor(7*0.25)=1 -> nilai 2
    assert hitung_ukuran_order_p25([{'ukuran_order': x} for x in [8, 1, 4, 2, 6, 3, 7, 5]]) == 2

    # 4) nilai_preset — baris scalping yang lolos SEMUA 7 kriteria
    row_lolos = {
        'kode': 'ABCD', 'harga': 1000, 'peringkat_value': 10, 'freq': 20_000,
        'ukuran_order': 1, 'ma5': 110, 'ma20': 100, 'posisi_bb': 0.9, 'label_accdist': 'Big Acc',
    }
    ctx = {'p25': 5}
    scalping = PRESET_DEFS[0]
    h = nilai_preset(row_lolos, scalping, ctx)
    assert h['lolos'] == 7 and h['terukur'] == 7, h

    # 5) baris dengan ruas kosong -> kriteria itu TAK ikut menyeret skor (tak-terukur, bukan gagal)
    row_sebagian = {'kode': 'EFGH', 'harga': 100, 'peringkat_value': None, 'freq': 5, 'ukuran_order': None,
                     'ma5': None, 'ma20': None, 'posisi_bb': None, 'label_accdist': None}
    h2 = nilai_preset(row_sebagian, scalping, ctx)
    # cuma 'frekuensi'(gagal, 5<10000) & 'bukan-gocap'(lolos, 100>50) yang terukur — 5 kriteria lain tak-terukur
    assert h2['terukur'] == 2 and h2['lolos'] == 1, h2

    # 6) jalankan_preset — urut skor (lolos/terukur) desc: ABCD 7/7=1.0 di atas EFGH 1/2=0.5
    rows = [row_sebagian, row_lolos]  # sengaja dibalik — urutan masukan tak boleh menentukan hasil
    urut = jalankan_preset(rows, scalping, ctx, min_lolos=1)
    assert [x['kode'] for x in urut] == ['ABCD', 'EFGH'], urut
    # min_lolos menyaring EFGH (skor sama, tapi lolos=1 < 2)
    assert [x['kode'] for x in jalankan_preset(rows, scalping, ctx, min_lolos=2)] == ['ABCD']

    # 7) whale-tiket 4-pintu ATAU
    whale = PRESET_DEFS[2]
    assert _whale_tiket_jejak({'tiket_lonjakan': None, 'tiket_broker_maks': None, 'bval_maks': None,
                                'nego_blok_rp': None}) == 'tak-terukur'
    assert _whale_tiket_jejak({'tiket_lonjakan': 3, 'tiket_broker_maks': None, 'bval_maks': None,
                                'nego_blok_rp': None}) == 'lolos'
    assert _whale_tiket_jejak({'tiket_lonjakan': 1, 'tiket_broker_maks': None, 'bval_maks': None,
                                'nego_blok_rp': None}) == 'gagal'

    # 8) entry/TP/SL — angka tangan-hitung tanpa file OHLC (d None -> entry None, tp/sl dari ATR saja)
    modul = sys.modules[__name__]
    asli = modul._baca_ohlc
    try:
        modul._baca_ohlc = lambda *a, **k: None  # type: ignore[assignment]
        row_tp = {'kode': 'ZZZZ', 'harga': 1000.0, 'atr_pct': 5.0, 'label_accdist': None, 'freq': 1,
                  'ukuran_order': 1, 'label_fd': None}
        s = bangun_saham(row_tp, '2026-01-01')
        # atr = 1000*5/100 = 50 -> tp1=1050(fraksi5 @500-2000 ->1050 sudah pas), tp2=1100, sl=1000-75=925->fraksi5->925
        assert s['tp1'] == 1050 and s['tp2'] == 1100 and s['sl'] == 925 and s['entry'] is None, s
    finally:
        modul._baca_ohlc = asli

    # 9) idempoten: tulis dua kali ke direktori sementara -> kedua kali TIDAK menimpa
    with tempfile.TemporaryDirectory() as tmp:
        tmp_dir = Path(tmp) / 'rekomendasi'
        arsip_asli = ARSIP_DIR / '__uji_tmp__.json'
        try:
            arsip_asli.parent.mkdir(parents=True, exist_ok=True)
            arsip_asli.write_text(json.dumps({'emiten': [row_lolos, row_sebagian]}), encoding='utf-8')
            # ambang=1 karena arsip uji cuma 2 baris; pagar bar hantu diuji terpisah di (10)
            ok1 = tulis_untuk_tanggal('__uji_tmp__', backtest=False, rekomendasi_dir=tmp_dir, ambang=1)
            ok2 = tulis_untuk_tanggal('__uji_tmp__', backtest=False, rekomendasi_dir=tmp_dir, ambang=1)
            assert ok1 is True and ok2 is False
            isi = json.loads((tmp_dir / '__uji_tmp__.json').read_text(encoding='utf-8'))
            assert isi['tanggal'] == '__uji_tmp__' and isi['backtest'] is False
            assert any(p['preset'] == 'scalping' and len(p['saham']) == 2 for p in isi['presets']), isi
        finally:
            arsip_asli.unlink(missing_ok=True)

    # 10) pagar bar hantu — arsip yang SEMUA emitennya freq 0 (bar hari
    # berjalan yang belum terbit) tak boleh menghasilkan berkas apa pun,
    # lewat jalur mana pun (--tanggal/--backtest ikut lewat fungsi ini).
    with tempfile.TemporaryDirectory() as tmp:
        tmp_dir = Path(tmp) / 'rekomendasi'
        arsip_hantu = ARSIP_DIR / '__uji_hantu__.json'
        try:
            arsip_hantu.parent.mkdir(parents=True, exist_ok=True)
            hantu = [dict(row_lolos, kode=f'H{i:03d}', freq=0) for i in range(300)]
            arsip_hantu.write_text(json.dumps({'emiten': hantu}), encoding='utf-8')
            assert tulis_untuk_tanggal('__uji_hantu__', backtest=False, rekomendasi_dir=tmp_dir) is False
            assert not (tmp_dir / '__uji_hantu__.json').exists()
        finally:
            arsip_hantu.unlink(missing_ok=True)

    print("swauji rekap_preset.py: SEMUA LOLOS")


# --------------------------------------------------------------------- main
if __name__ == '__main__':
    argv = sys.argv[1:]
    if '--uji' in argv:
        uji()
        raise SystemExit(0)

    top_n = TOP_N
    if '--top' in argv:
        top_n = int(argv[argv.index('--top') + 1])

    if '--backtest' in argv:
        i = argv.index('--backtest')
        dari_tgl, sampai_tgl = argv[i + 1], argv[i + 2]
        tanggal_arsip = sorted(p.stem for p in ARSIP_DIR.glob('*.json'))
        rentang = [t for t in tanggal_arsip if dari_tgl <= t <= sampai_tgl]
        print(f"backtest {dari_tgl}..{sampai_tgl}: {len(rentang)} tanggal ber-arsip ditemukan "
              f"(tanggal TANPA kartu/arsip/ dilewati — generator ini tak menghitung ulang ruas historis, "
              f"itu tugas kartu_analisa.py --semua --tanggal <tgl> --tulis, di luar cakupan panggilan ini)")
        for tgl in rentang:
            tulis_untuk_tanggal(tgl, backtest=True, top_n=top_n)
    elif '--tanggal' in argv:
        tgl = argv[argv.index('--tanggal') + 1]
        tulis_untuk_tanggal(tgl, backtest=False, top_n=top_n)
    else:
        tgl = pilih_tanggal_otomatis()
        if tgl is None:
            print("tak ada tanggal arsip yang layak (kosong sama sekali, atau semuanya bar hantu "
                  "berfrekuensi nol) — jalankan kartu_analisa.py --semua --tulis dulu sesudah bursa tutup")
            raise SystemExit(1)
        tulis_untuk_tanggal(tgl, backtest=False, top_n=top_n)
