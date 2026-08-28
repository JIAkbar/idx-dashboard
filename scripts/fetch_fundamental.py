"""
fetch_fundamental.py
====================
Ambil data fundamental saham IDX (komprehensif) dari yfinance
dan simpan ke data-idx/json/fundamental/<TICKER>.json

Cara pakai:
  python fetch_fundamental.py               → fetch semua 959 saham IDX
  python fetch_fundamental.py BBCA ASII    → fetch saham tertentu
  python fetch_fundamental.py --ihsg       → coba IDX API dulu, fallback ke 959 default
  python fetch_fundamental.py --semua      → alias, sama dengan tanpa argumen

Output: data-idx/json/fundamental/<TICKER>.json  +  data-idx/json/fundamental/index.json
"""

import yfinance as yf
from yfinance.exceptions import YFRateLimitError
import json, os, sys, time, requests
import pandas as pd
from datetime import datetime, date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import arsip_mentah  # noqa: E402 — reuse, lihat CLAUDE.md rung 2
import idx_net  # noqa: E402 — satu pintu jaringan IDX (curl_cffi)


def _arsip_yf(ticker: str, nama: str, obj) -> None:
    """Simpan objek yfinance MENTAH sebelum diolah — bukan respons HTTP asli
    (yfinance tak membukanya), tapi yang terdekat yang bisa didapat: `info`
    (dict) dan DataFrame/Series laporan keuangan APA ADANYA dari pustaka.
    Tiap field di sini = satu request Yahoo terpisah; mengarsipkannya berarti
    menambah/mengubah rasio turunan di kemudian hari tak perlu memanggil
    Yahoo lagi untuk 959 emiten."""
    if obj is None:
        return
    try:
        if isinstance(obj, dict):
            arsip_mentah.simpan("fundamental", ticker, f"{nama}.json", data=json.dumps(obj, default=str))
        elif hasattr(obj, "empty"):
            if obj.empty:
                return
            arsip_mentah.simpan("fundamental", ticker, f"{nama}.json", data=obj.to_json(date_format="iso"))
    except Exception as e:  # noqa: BLE001 — arsip gagal bukan alasan panen gagal
        print(f"   ! arsip {ticker}/{nama} gagal: {e}", flush=True)


# ─── 959 saham IDX — sumber: IDX Ringkasan Saham 2026-06-05 (idx.co.id) ──────────
DEFAULT_TICKERS = sorted(set([
    "AADI", "AALI", "ABBA", "ABDA", "ABMM", "ACES", "ACRO", "ACST", "ADCP", "ADES", "ADHI", "ADMF",
    "ADMG", "ADMR", "ADRO", "AEGS", "AGAR", "AGII", "AGRO", "AGRS", "AHAP", "AIMS", "AISA", "AKKU",
    "AKPI", "AKRA", "AKSI", "ALDO", "ALII", "ALKA", "ALMI", "ALTO", "AMAG", "AMAN", "AMAR", "AMFG",
    "AMIN", "AMMN", "AMMS", "AMOR", "AMRT", "ANDI", "ANJT", "ANTM", "APEX", "APIC", "APII", "APLI",
    "APLN", "ARCI", "AREA", "ARGO", "ARII", "ARKA", "ARKO", "ARMY", "ARNA", "ARTA", "ARTI", "ARTO",
    "ASBI", "ASDM", "ASGR", "ASHA", "ASII", "ASJT", "ASLC", "ASLI", "ASMI", "ASPI", "ASPR", "ASRI",
    "ASRM", "ASSA", "ATAP", "ATIC", "ATLA", "AUTO", "AVIA", "AWAN", "AXIO", "AYAM", "AYLS", "BABP",
    "BABY", "BACA", "BAIK", "BAJA", "BALI", "BANK", "BAPA", "BAPI", "BATA", "BATR", "BAUT", "BAYU",
    "BBCA", "BBHI", "BBKP", "BBLD", "BBMD", "BBNI", "BBRI", "BBRM", "BBSI", "BBSS", "BBTN", "BBYB",
    "BCAP", "BCIC", "BCIP", "BDKR", "BDMN", "BEBS", "BEEF", "BEER", "BEKS", "BELI", "BELL", "BESS",
    "BEST", "BFIN", "BGTG", "BHAT", "BHIT", "BIKA", "BIKE", "BIMA", "BINA", "BINO", "BIPI", "BIPP",
    "BIRD", "BISI", "BJBR", "BJTM", "BKDP", "BKSL", "BKSW", "BLES", "BLOG", "BLTA", "BLTZ", "BLUE",
    "BMAS", "BMBL", "BMHS", "BMRI", "BMSR", "BMTR", "BNBA", "BNBR", "BNGA", "BNII", "BNLI", "BOAT",
    "BOBA", "BOGA", "BOLA", "BOLT", "BOSS", "BPFI", "BPII", "BPTR", "BRAM", "BREN", "BRIS", "BRMS",
    "BRNA", "BRPT", "BRRC", "BSBK", "BSDE", "BSIM", "BSML", "BSSR", "BSWD", "BTEK", "BTEL", "BTON",
    "BTPN", "BTPS", "BUAH", "BUDI", "BUKA", "BUKK", "BULL", "BUMI", "BUVA", "BVIC", "BWPT", "BYAN",
    "CAKK", "CAMP", "CANI", "CARE", "CARS", "CASA", "CASH", "CASS", "CBDK", "CBMF", "CBPE", "CBRE",
    "CBUT", "CCSI", "CDIA", "CEKA", "CENT", "CFIN", "CGAS", "CHEK", "CHEM", "CHIP", "CINT", "CITA",
    "CITY", "CLAY", "CLEO", "CLPI", "CMNP", "CMNT", "CMPP", "CMRY", "CNKO", "CNMA", "CNTB", "CNTX",
    "COAL", "COCO", "COIN", "COWL", "CPIN", "CPRI", "CPRO", "CRAB", "CRSN", "CSAP", "CSIS", "CSMI",
    "CSRA", "CTBN", "CTRA", "CTTH", "CUAN", "CYBR", "DAAZ", "DADA", "DART", "DATA", "DAYA", "DCII",
    "DEAL", "DEFI", "DEPO", "DEWA", "DEWI", "DFAM", "DGIK", "DGNS", "DGWG", "DIGI", "DILD", "DIVA",
    "DKFT", "DKHH", "DLTA", "DMAS", "DMMX", "DMND", "DNAR", "DNET", "DOID", "DOOH", "DOSS", "DPNS",
    "DPUM", "DRMA", "DSFI", "DSNG", "DSSA", "DUCK", "DUTI", "DVLA", "DWGL", "DYAN", "EAST", "ECII",
    "EDGE", "EKAD", "ELIT", "ELPI", "ELSA", "ELTY", "EMAS", "EMDE", "EMTK", "ENAK", "ENRG", "ENVY",
    "ENZO", "EPAC", "EPMT", "ERAA", "ERAL", "ERTX", "ESIP", "ESSA", "ESTA", "ESTI", "ETWA", "EURO",
    "EXCL", "FAPA", "FAST", "FASW", "FILM", "FIMP", "FIRE", "FISH", "FITT", "FLMC", "FMII", "FOLK",
    "FOOD", "FORE", "FORU", "FPNI", "FUJI", "FUTR", "FWCT", "GAMA", "GDST", "GDYR", "GEMA", "GEMS",
    "GGRM", "GGRP", "GHON", "GIAA", "GJTL", "GLOB", "GLVA", "GMFI", "GMTD", "GOLD", "GOLF", "GOLL",
    "GOOD", "GOTO", "GPRA", "GPSO", "GRIA", "GRPH", "GRPM", "GSMF", "GTBO", "GTRA", "GTSI",
    "GULA", "GUNA", "GWSA", "GZCO", "HADE", "HAIS", "HAJJ", "HALO", "HATM", "HBAT", "HDFA", "HDIT",
    "HEAL", "HELI", "HERO", "HEXA", "HGII", "HILL", "HITS", "HKMU", "HMSP", "HOKI", "HOME", "HOMI",
    "HOPE", "HOTL", "HRME", "HRTA", "HRUM", "HUMI", "HYGN", "IATA", "IBFN", "IBOS", "IBST", "ICBP",
    "ICON", "IDEA", "IDPR", "IFII", "IFSH", "IGAR", "IIKP", "IKAI", "IKAN", "IKBI", "IKPM", "IMAS",
    "IMJS", "IMPC", "INAF", "INAI", "INCF", "INCI", "INCO", "INDF", "INDO", "INDR", "INDS", "INDX",
    "INDY", "INET", "INKP", "INOV", "INPC", "INPP", "INPS", "INRU", "INTA", "INTD", "INTP", "IOTF",
    "IPAC", "IPCC", "IPCM", "IPOL", "IPPE", "IPTV", "IRRA", "IRSX", "ISAP", "ISAT", "ISEA", "ISSP",
    "ITIC", "ITMA", "ITMG", "JARR", "JAST", "JATI", "JAWA", "JAYA", "JECC", "JGLE", "JIHD", "JKON",
    "JMAS", "JPFA", "JRPT", "JSKY", "JSMR", "JSPT", "JTPE", "KAEF", "KAQI", "KARW", "KAYU", "KBAG",
    "KBLI", "KBLM", "KBLV", "KBRI", "KDSI", "KDTN", "KEEN", "KEJU", "KETR", "KIAS", "KICI", "KIJA",
    "KING", "KINO", "KIOS", "KJEN", "KKES", "KKGI", "KLAS", "KLBF", "KLIN", "KMDS", "KMTR", "KOBX",
    "KOCI", "KOIN", "KOKA", "KONI", "KOPI", "KOTA", "KPIG", "KRAS", "KREN", "KRYA", "KSIX", "KUAS",
    "LABA", "LABS", "LAJU", "LAND", "LAPD", "LCGP", "LCKM", "LEAD", "LFLO", "LIFE", "LINK", "LION",
    "LIVE", "LMAS", "LMAX", "LMPI", "LMSH", "LOPI", "LPCK", "LPGI", "LPIN", "LPKR", "LPLI", "LPPF",
    "LPPS", "LRNA", "LSIP", "LTLS", "LUCK", "LUCY", "MABA", "MAGP", "MAHA", "MAIN", "MANG", "MAPA",
    "MAPB", "MAPI", "MARI", "MARK", "MASB", "MAXI", "MAYA", "MBAP", "MBMA", "MBSS", "MBTO", "MCAS",
    "MCOL", "MCOR", "MDIA", "MDIY", "MDKA", "MDKI", "MDLA", "MDLN", "MDRN", "MEDC", "MEDS", "MEGA",
    "MEJA", "MENN", "MERI", "MERK", "META", "MFMI", "MGLV", "MGNA", "MGRO", "MHKI", "MICE", "MIDI",
    "MIKA", "MINA", "MINE", "MIRA", "MITI", "MKAP", "MKNT", "MKPI", "MKTR", "MLBI", "MLIA", "MLPL",
    "MLPT", "MMIX", "MMLP", "MNCN", "MOLI", "MORA", "MPIX", "MPMX", "MPOW", "MPPA", "MPRO", "MPXL",
    "MRAT", "MREI", "MSIE", "MSIN", "MSJA", "MSKY", "MSTI", "MTDL", "MTEL", "MTFN", "MTLA", "MTMH",
    "MTPS", "MTRA", "MTSM", "MTWI", "MUTU", "MYOH", "MYOR", "MYTX", "NAIK", "NANO", "NASA", "NASI",
    "NATO", "NAYZ", "NCKL", "NELY", "NEST", "NETV", "NFCX", "NICE", "NICK", "NICL", "NIKL", "NINE",
    "NIRO", "NISP", "NOBU", "NPGF", "NRCA", "NSSS", "NTBK", "NUSA", "NZIA", "OASA", "OBAT", "OBMD",
    "OCAP", "OILS", "OKAS", "OLIV", "OMED", "OMRE", "OPMS", "PACK", "PADA", "PADI", "PALM", "PAMG",
    "PANI", "PANR", "PANS", "PART", "PBID", "PBRX", "PBSA", "PCAR", "PDES", "PDPP", "PEGE", "PEHA",
    "PEVE", "PGAS", "PGEO", "PGJO", "PGLI", "PGUN", "PICO", "PIPA", "PJAA", "PJHB", "PKPK", "PLAN",
    "PLAS", "PLIN", "PMJS", "PMMP", "PMUI", "PNBN", "PNBS", "PNGO", "PNIN", "PNLF", "PNSE", "POLA",
    "POLI", "POLL", "POLU", "POLY", "POOL", "PORT", "POSA", "POWR", "PPGL", "PPRE", "PPRI", "PPRO",
    "PRAY", "PRDA", "PRIM", "PSAB", "PSAT", "PSDN", "PSGO", "PSKT", "PSSI", "PTBA", "PTDU", "PTIS",
    "PTMP", "PTMR", "PTPP", "PTPS", "PTPW", "PTRO", "PTSN", "PTSP", "PUDP", "PURA", "PURE", "PURI",
    "PWON", "PYFA", "PZZA", "RAAM", "RAFI", "RAJA", "RALS", "RANC", "RATU", "RBMS", "RCCC", "RDTX",
    "REAL", "RELF", "RELI", "RGAS", "RICY", "RIGS", "RIMO", "RISE", "RLCO", "RMKE", "RMKO", "ROCK",
    "RODA", "RONY", "ROTI", "RSCH", "RSGK", "RUIS", "RUNS", "SAFE", "SAGE", "SAME", "SAMF", "SAPX",
    "SATU", "SBAT", "SBMA", "SCCO", "SCMA", "SCNP", "SCPI", "SDMU", "SDPC", "SDRA", "SEMA", "SFAN",
    "SGER", "SGRO", "SHID", "SHIP", "SICO", "SIDO", "SILO", "SIMA", "SIMP", "SINI", "SIPD", "SKBM",
    "SKLT", "SKRN", "SKYB", "SLIS", "SMAR", "SMBR", "SMCB", "SMDM", "SMDR", "SMGA", "SMGR", "SMIL",
    "SMKL", "SMKM", "SMLE", "SMMA", "SMMT", "SMRA", "SMRU", "SMSM", "SNLK", "SOCI", "SOFA", "SOHO",
    "SOLA", "SONA", "SOSS", "SOTS", "SOUL", "SPMA", "SPRE", "SPTO", "SQMI", "SRAJ", "SRIL", "SRSN",
    "SRTG", "SSIA", "SSMS", "SSTM", "STAA", "STAR", "STRK", "STTP", "SUGI", "SULI", "SUNI", "SUPA",
    "SUPR", "SURE", "SURI", "SWAT", "SWID", "TALF", "TAMA", "TAMU", "TAPG", "TARA", "TAXI", "TAYS",
    "TBIG", "TBLA", "TBMS", "TCID", "TCPI", "TDPM", "TEBE", "TECH", "TELE", "TFAS", "TFCO", "TGKA",
    "TGRA", "TGUK", "TIFA", "TINS", "TIRA", "TIRT", "TKIM", "TLDN", "TLKM", "TMAS", "TMPO", "TNCA",
    "TOBA", "TOOL", "TOPS", "TOSK", "TOTL", "TOTO", "TOWR", "TOYS", "TPIA", "TPMA", "TRAM", "TRGU",
    "TRIL", "TRIM", "TRIN", "TRIO", "TRIS", "TRJA", "TRON", "TRST", "TRUE", "TRUK", "TRUS", "TSPC",
    "TUGU", "TYRE", "UANG", "UCID", "UDNG", "UFOE", "ULTJ", "UNIC", "UNIQ", "UNIT", "UNSP", "UNTD",
    "UNTR", "UNVR", "URBN", "UVCR", "VAST", "VERN", "VICI", "VICO", "VINS", "VISI", "VIVA", "VKTR",
    "VOKS", "VRNA", "VTNY", "WAPO", "WBSA", "WEGE", "WEHA", "WGSH", "WICO", "WIDI", "WIFI", "WIIM",
    "WIKA", "WINE", "WINR", "WINS", "WIRG", "WMPP", "WMUU", "WOMF", "WOOD", "WOWS", "WSBP", "WSKT",
    "WTON", "YELO", "YOII", "YPAS", "YULE", "YUPI", "ZATA", "ZBRA", "ZINC", "ZONE", "ZYRX",
]))

# ─── Fetch daftar semua saham IDX ─────────────────────────────────────────
def fetch_all_idx_tickers():
    print("\nMengambil daftar saham IHSG dari API IDX ...")
    # `requests` -> `curl_cffi` (18 Agu 2026): endpoint IDX menolak requests
    # dengan 403 walau headernya lengkap; pembedanya sidik jari TLS. Yahoo
    # SENGAJA tetap pakai requests di berkas ini — Yahoo tak bermasalah.
    REF = "https://www.idx.co.id/id/data-pasar/data-saham/daftar-saham/"

    endpoints = [
        # `StockData/GetSecurities` DIHAPUS dari daftar: endpoint itu menjawab
        # 503 Varnish lewat requests MAUPUN curl_cffi — mati di sisi IDX, bukan
        # gejala blokir. Penggantinya yang hidup `GetSecuritiesStock` (962 baris,
        # ruas "Code"), diuji 18 Agu 2026.
        ("GetSecuritiesStock",
         "https://www.idx.co.id/primary/StockData/GetSecuritiesStock",
         {"start":0,"length":9999,"code":"","sector":"","board":"","language":"id-id"},
         ["data","Data"], ["StockCode","Code","code","symbol"]),
        ("GetCompanyProfiles",
         "https://www.idx.co.id/primary/ListedCompany/GetCompanyProfiles",
         {"start":0,"length":9999,"sCategoryBoard":"S"},
         ["data","Data"], ["StockCode","Code","code"]),
    ]

    for name, url, params, data_keys, code_keys in endpoints:
        print(f"  Endpoint {name} ... ", end="", flush=True)
        try:
            r = idx_net.get(url, params=params, timeout=25, referer=REF)
            if not r.text.strip():
                print("kosong"); continue
            j = r.json()
            items = None
            for k in data_keys:
                if isinstance(j, dict) and k in j and isinstance(j[k], list):
                    items = j[k]; break
            if not items:
                print("tidak ada data"); continue
            tickers = []
            for item in items:
                if isinstance(item, dict):
                    for ck in code_keys:
                        v = item.get(ck,"")
                        if v and isinstance(v,str) and v.isalpha() and 2<=len(v)<=6:
                            tickers.append(v.upper()); break
            if tickers:
                print(f"OK — {len(tickers)} saham")
                return sorted(set(tickers))
            print("tidak ada kode valid")
        except Exception as e:
            print(f"gagal ({e})")

    print("  Semua endpoint gagal. Gunakan daftar default.")
    return []

# ─── Helper ───────────────────────────────────────────────────────────────
def sg(d, key):
    """safe get dari dict yfinance info."""
    try:
        v = d.get(key)
        return None if (v is None or (isinstance(v,float) and v!=v)) else v
    except Exception:
        return None

def aman(fn):
    """Jalankan fetch sub-data; error data → None, tapi rate limit HARUS naik
    ke pemanggil supaya retry+backoff di loop utama bekerja (bare except lama
    menelan YFRateLimitError → ticker ditandai gagal permanen padahal transien)."""
    try:
        return fn()
    except YFRateLimitError:
        raise
    except Exception:
        return None

def konversi_ke_idr(nilai, mata_uang, kurs_usd_idr):
    """Samakan satuan angka laporan keuangan ke IDR.

    AADI (dan emiten pelapor-USD lain) melaporkan keuangan dalam USD sementara
    harganya IDR; membaginya mentah-mentah menghasilkan PB 20.683x. Sebelumnya
    skrip hanya membaca `currency` (mata uang HARGA) dan tidak pernah membaca
    `financialCurrency`.
    """
    if nilai is None:
        return None
    if mata_uang == "IDR":
        return nilai
    if not kurs_usd_idr:
        return None
    return nilai * kurs_usd_idr

def konversi_dict_ke_idr(d, mata_uang, kurs_usd_idr):
    """Terapkan konversi_ke_idr ke setiap nilai dalam dict {key: number} atau
    {key: {subkey: number}} (mis. q_revenue = {year: {quarter: value}}), mempertahankan
    struktur dan None. Dipakai untuk field kuartalan/tahunan absolut (bukan rasio,
    bukan EPS — lihat catatan di blok emisi)."""
    if not d:
        return d
    out = {}
    for k, v in d.items():
        if isinstance(v, dict):
            out[k] = konversi_dict_ke_idr(v, mata_uang, kurs_usd_idr)
        else:
            out[k] = konversi_ke_idr(v, mata_uang, kurs_usd_idr)
    return out

_SAHAM_IDX: dict | None = None

def saham_idx(kode):
    """Jumlah saham TERCATAT resmi IDX (`ListedShares`) dari
    `data-idx/json/daftar_emiten.json` — berkas lokal, NOL permintaan jaringan
    (`sinkron_emiten.py` sudah menyimpannya dari payload yang memang diambilnya).

    Kenapa ada: `sharesOutstanding` yfinance ketinggalan aksi korporasi di 43
    emiten per 18 Agu 2026 — BBNI tersimpan 578.683.733 padahal resmi IDX
    36.924.339.786 (0,0157x, pemecahan saham tak terbaca), MSKY sebaliknya
    9,97 miliar vs 1,99 miliar resmi (5,0x, reverse split). Ruas `eps` tahunan
    selamat karena disalin langsung dari `trailingEps`, tapi SEMUA yang dibagi
    `shares` di berkas ini — q_eps, hist_eps, hist_bv, rev_ps, cash_ps, fcf_ps,
    ocf_ps, float_pct — ikut salah dengan faktor yang sama, tanpa satu pun galat.
    Balikan None kalau emiten tak ada di daftar (mis. disuspensi: CNTB, CNTX,
    NIPS) — pemanggil yang memutuskan, jangan menebak.
    """
    global _SAHAM_IDX
    if _SAHAM_IDX is None:
        p = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                          '..', 'data-idx', 'json', 'daftar_emiten.json'))
        try:
            with open(p, encoding='utf-8') as f:
                _SAHAM_IDX = {e["kode"]: e.get("saham") for e in json.load(f)["emiten"]}
        except Exception as e:  # noqa: BLE001 — daftar hilang/tua bukan alasan gagal panen
            print(f"   ⚠ daftar_emiten.json tak terbaca ({type(e).__name__}) — "
                  f"shares memakai yfinance apa adanya")
            _SAHAM_IDX = {}
    v = _SAHAM_IDX.get(kode)
    return v if isinstance(v, (int, float)) and v > 0 else None

def get_latest_kurs():
    """Kurs USD/IDR terbaru dari data-idx/json/ds_*.json (snapshot harian IHSG)."""
    data_dir = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data-idx', 'json'))
    try:
        files = sorted(f for f in os.listdir(data_dir) if f.startswith('ds_') and f.endswith('.json'))
        if not files:
            return None
        with open(os.path.join(data_dir, files[-1]), encoding='utf-8') as fj:
            return json.load(fj).get('usd_idr')
    except Exception:
        return None

def df_annual(df, row):
    """Annual DataFrame row → {year: float}."""
    out = {}
    if df is None or df.empty or row not in df.index:
        return out
    for col in df.columns:
        v = df.loc[row, col]
        if v==v and v is not None:
            out[str(col.year)] = float(v)
    return out

def df_quarterly(df, row):
    """Quarterly DataFrame row → {year: {Qn: float}}."""
    out = {}
    if df is None or df.empty or row not in df.index:
        return out
    for col in df.columns:
        v = df.loc[row, col]
        if v!=v or v is None:
            continue
        try:
            y = col.year
            q = f"Q{(col.month-1)//3+1}"
            out.setdefault(str(y), {})[q] = float(v)
        except Exception:
            pass
    return out

def ttm_from_quarterly(qdict):
    """Hitung TTM (Trailing 12 Month) dari quarterly dict: jumlah 4 quarter terakhir."""
    rows = []
    for y, qmap in qdict.items():
        for q, v in qmap.items():
            rows.append((int(y), q, v))
    rows.sort(key=lambda x: (x[0], x[1]), reverse=True)
    vals = [r[2] for r in rows[:4]]
    return sum(vals) if len(vals)==4 else None

def annual_sum(qdict, year):
    """Jumlah semua quarter dalam satu tahun → annualised."""
    ymap = qdict.get(str(year), {})
    vals = [v for v in ymap.values() if v is not None]
    return sum(vals) if vals else None

def price_perf(hist):
    """Hitung price performance & range dari DataFrame history."""
    if hist is None or hist.empty:
        return {}
    hist = hist.sort_index()
    cur = float(hist["Close"].iloc[-1])
    today_dt = hist.index[-1]

    def pct(past_price):
        if not past_price: return None
        return round((cur/past_price-1)*100, 2)

    def get_past_price(days):
        cutoff = today_dt - pd.Timedelta(days=days)
        sub = hist[hist.index <= cutoff]
        return float(sub["Close"].iloc[-1]) if not sub.empty else None

    def get_range(days):
        cutoff = today_dt - pd.Timedelta(days=days)
        sub = hist[hist.index >= cutoff]
        if sub.empty: return None, None
        return round(float(sub["Low"].min()),0), round(float(sub["High"].max()),0)

    # tz= wajib: hist.index dari yfinance timezone-aware (Asia/Jakarta) — Timestamp naif
    # vs index aware bikin TypeError di pandas modern ("Invalid comparison between
    # dtype=datetime64[s, Asia/Jakarta] and Timestamp"), ditemukan lewat percobaan
    # langsung ke Yahoo saat Task 9 (lihat laporan).
    ytd_start = pd.Timestamp(today_dt.year, 1, 2, tz=today_dt.tz)
    ytd_sub = hist[hist.index >= ytd_start]
    ytd_price = float(ytd_sub["Close"].iloc[0]) if not ytd_sub.empty else None

    r1d_l,  r1d_h  = get_range(2)
    r1w_l,  r1w_h  = get_range(7)
    r1m_l,  r1m_h  = get_range(30)
    r3m_l,  r3m_h  = get_range(91)
    r6m_l,  r6m_h  = get_range(183)
    # Horizon panjang (hist sekarang period=5y, tetap 1 call history):
    # emiten IPO < horizon → get_past_price None → pct None (bukan 0).
    r1y_l,  r1y_h  = get_range(365)
    r3y_l,  r3y_h  = get_range(1095)
    r5y_l,  r5y_h  = get_range(1825)
    ytd_l = round(float(ytd_sub["Low"].min()),0)  if not ytd_sub.empty else None
    ytd_h = round(float(ytd_sub["High"].max()),0) if not ytd_sub.empty else None

    return {
        "current": round(cur, 0),
        "1d_pct":  pct(get_past_price(1)),  "1d_low": r1d_l,  "1d_high": r1d_h,
        "1w_pct":  pct(get_past_price(7)),  "1w_low": r1w_l,  "1w_high": r1w_h,
        "1m_pct":  pct(get_past_price(30)), "1m_low": r1m_l,  "1m_high": r1m_h,
        "3m_pct":  pct(get_past_price(91)), "3m_low": r3m_l,  "3m_high": r3m_h,
        "6m_pct":  pct(get_past_price(183)),"6m_low": r6m_l,  "6m_high": r6m_h,
        "ytd_pct": pct(ytd_price),           "ytd_low": ytd_l,  "ytd_high": ytd_h,
        "1y_pct":  pct(get_past_price(365)), "1y_low": r1y_l,  "1y_high": r1y_h,
        "3y_pct":  pct(get_past_price(1095)),"3y_low": r3y_l,  "3y_high": r3y_h,
        "5y_pct":  pct(get_past_price(1825)),"5y_low": r5y_l,  "5y_high": r5y_h,
    }

# ─── Fetch satu saham ──────────────────────────────────────────────────────
def fetch_stock(ticker_code):
    ticker_jk = ticker_code + ".JK"
    try:
        t = yf.Ticker(ticker_jk)
        info = t.info
        _arsip_yf(ticker_code, "info", info)
        name = sg(info,"longName") or sg(info,"shortName")
        if not name:
            return None

        # Mata uang laporan keuangan vs mata uang harga (lihat konversi_ke_idr).
        # AADI cs. melapor dalam USD sementara harganya IDR — tanpa ini, bv/rev_ps/
        # cash_ps/fcf_ps mentah dari laporan USD dibagi harga IDR → PB 20.683x.
        fin_cur = sg(info, "financialCurrency") or "IDR"
        kurs = KURS_USD_IDR

        # ── Laporan keuangan ──────────────────────────────────────────────
        fin  = aman(lambda: t.financials)
        bs   = aman(lambda: t.balance_sheet)
        cf   = aman(lambda: t.cashflow)
        qfin = aman(lambda: t.quarterly_financials)
        qbs  = aman(lambda: t.quarterly_balance_sheet)
        qcf  = aman(lambda: t.quarterly_cashflow)
        for _nama, _obj in (("financials", fin), ("balance_sheet", bs), ("cashflow", cf),
                             ("quarterly_financials", qfin), ("quarterly_balance_sheet", qbs),
                             ("quarterly_cashflow", qcf)):
            _arsip_yf(ticker_code, _nama, _obj)

        # Dividends: satu kali fetch, dipakai dua blok (hist_dps_a + div_history) —
        # sebelumnya t.dividends dipanggil 2x = 2x request history(period=max) ke Yahoo.
        divs_raw = aman(lambda: t.dividends)
        _arsip_yf(ticker_code, "dividends", divs_raw)

        # ── Harga historis ────────────────────────────────────────────────
        try:
            # 5y (sebelumnya 1y): tetap SATU call history, sekalian buat perf 1y/3y/5y.
            hist = t.history(period="5y")
            _arsip_yf(ticker_code, "history_5y", hist)
            pp   = price_perf(hist)
        except YFRateLimitError:
            raise
        except Exception as e:
            print(f"   ! {ticker_jk} price_perf gagal: {type(e).__name__}: {e}", flush=True)
            gagal_price_perf.append(ticker_jk)
            hist, pp = None, {}

        # ── Quarterly helpers ─────────────────────────────────────────────
        q_rev  = df_quarterly(qfin, "Total Revenue")
        q_ni   = df_quarterly(qfin, "Net Income")
        q_gp   = df_quarterly(qfin, "Gross Profit")
        q_oi   = df_quarterly(qfin, "Operating Income")
        # Baris tambahan utk interest coverage / ROIC (tax efektif) / efisiensi —
        # dari DataFrame qfin yang sudah di-fetch, NOL request ekstra.
        q_cogs   = df_quarterly(qfin, "Cost Of Revenue")
        q_int    = df_quarterly(qfin, "Interest Expense")
        q_tax    = df_quarterly(qfin, "Tax Provision")
        q_pretax = df_quarterly(qfin, "Pretax Income")

        # shares None eksplisit bila sharesOutstanding tidak ada (fallback lama `or 1`
        # menghasilkan rev_ps/q_eps = nilai absolut menyamar per-saham — data palsu).
        shares = sg(info,"sharesOutstanding")
        shares_sumber = "yahoo" if shares else None
        # Koreksi ke jumlah saham tercatat resmi IDX — WAJIB di sini, sebelum
        # satu pun turunan per-saham dihitung (lihat `saham_idx`). Ambangnya 2x:
        # beda di bawah itu treasury/waktu potret (101 emiten, wajar), di atasnya
        # selalu aksi korporasi yang tak terbaca yfinance (43 emiten, terukur
        # 18 Agu 2026). `market_cap` Yahoo TIDAK dipakai sebagai wasit — ia
        # sendiri basi di AISA (3,81 M vs 9,31 M resmi), LPPF, dan ZBRA.
        shares_yf = shares          # dipakai menskalakan floatShares di bawah
        s_idx = saham_idx(ticker_code)
        if s_idx and (not shares or not (0.5 <= shares / s_idx <= 2.0)):
            shares = s_idx
            shares_sumber = "idx"
        # q_eps dihitung DI BAWAH (setelah q_ni_idr ada) — net income kuartalan
        # harus disamakan ke IDR dulu sebelum dibagi saham, sama seperti rev_ps/
        # cash_ps/fcf_ps/ocf_ps. Bug lama: dibagi dari q_ni MENTAH (USD utk
        # pelapor non-IDR) → q_eps 62+ emiten kepotong ke 0.00 (532 miliar IDR
        # net income / kurs / 25 miliar saham = 0,001 USD/saham, round(.,2)=0.0)
        # padahal ttm_net_income & q_net_income di berkas yang sama sudah benar.

        # Quarterly balance sheet
        q_assets = df_quarterly(qbs, "Total Assets")
        q_eq     = df_quarterly(qbs, "Stockholders Equity")
        q_debt   = df_quarterly(qbs, "Total Debt")
        q_cash_bs= df_quarterly(qbs, "Cash And Cash Equivalents")
        q_cur_a  = df_quarterly(qbs, "Current Assets")
        q_cur_l  = df_quarterly(qbs, "Current Liabilities")
        q_lt_debt= df_quarterly(qbs, "Long Term Debt")
        q_tot_l  = df_quarterly(qbs, "Total Liabilities Net Minority Interest")
        # Baris tambahan utk efisiensi/Altman/balance_q — qbs sudah di-fetch.
        q_teq    = df_quarterly(qbs, "Total Equity Gross Minority Interest")
        q_recv   = df_quarterly(qbs, "Accounts Receivable")
        q_inv    = df_quarterly(qbs, "Inventory")
        q_pay    = df_quarterly(qbs, "Accounts Payable")
        q_re     = df_quarterly(qbs, "Retained Earnings")

        # Quarterly cashflow
        q_ocf    = df_quarterly(qcf, "Operating Cash Flow")
        q_icf    = df_quarterly(qcf, "Investing Cash Flow")
        q_fcf_cf = df_quarterly(qcf, "Free Cash Flow")
        q_capex  = df_quarterly(qcf, "Capital Expenditure")
        q_fcf_cf2= df_quarterly(qcf, "Financing Cash Flow")

        # Annual
        a_rev  = df_annual(fin, "Total Revenue")
        a_ni   = df_annual(fin, "Net Income")
        a_gp   = df_annual(fin, "Gross Profit")
        a_oi   = df_annual(fin, "Operating Income")
        a_assets= df_annual(bs, "Total Assets")
        a_eq   = df_annual(bs, "Stockholders Equity")
        a_debt = df_annual(bs, "Total Debt")
        a_ocf  = df_annual(cf, "Operating Cash Flow")
        a_capex= df_annual(cf, "Capital Expenditure")
        a_fcf  = df_annual(cf, "Free Cash Flow")
        a_icf  = df_annual(cf, "Investing Cash Flow")
        a_fincf= df_annual(cf, "Financing Cash Flow")
        # Annual tambahan utk Piotroski F-Score & fallback interest/tax/RE —
        # dari bs/fin yang sudah di-fetch, nol request ekstra.
        a_lt_debt = df_annual(bs, "Long Term Debt")
        a_cur_a   = df_annual(bs, "Current Assets")
        a_cur_l   = df_annual(bs, "Current Liabilities")
        a_shares  = df_annual(bs, "Ordinary Shares Number")
        a_re      = df_annual(bs, "Retained Earnings")
        a_int     = df_annual(fin, "Interest Expense")
        a_tax     = df_annual(fin, "Tax Provision")
        a_pretax  = df_annual(fin, "Pretax Income")

        # ── HISTORICAL METRICS (per share, annual) ───────────────────────
        # EPS historis tahunan = Net Income / Shares.
        # Net income DISAMAKAN ke IDR LEBIH DULU, baru dibagi — alasannya persis
        # sama dengan q_eps (CLAUDE.md 18 Agu 2026): membagi dolar dengan
        # miliaran saham lalu round(.,2) memberi 0,00, dan mengalikan 0,00
        # dengan kurs tetap 0,00. Sampai 20 Agu 2026 baris ini tak dikonversi
        # sama sekali, sehingga `hist_eps` 99 emiten pelapor USD tersimpan
        # ~17.000x terlalu kecil dan bersanding dengan `hist_net_income`/
        # `hist_bv`/`hist_fcf` yang SUDAH rupiah — nol galat, cuma angka yang
        # salah diam-diam.
        hist_eps_a = {}
        for yr, ni in a_ni.items():
            if ni and shares and shares > 0:
                hist_eps_a[yr] = round(konversi_ke_idr(ni, fin_cur, kurs) / shares, 2)

        # FCF historis tahunan (prioritas: a_fcf; fallback: OCF + CapEx)
        hist_fcf_a = {}
        for yr in set(list(a_ocf.keys()) + list(a_capex.keys()) + list(a_fcf.keys())):
            if yr in a_fcf and a_fcf[yr] is not None:
                hist_fcf_a[yr] = round(a_fcf[yr], 0)
            elif yr in a_ocf and a_ocf[yr] is not None:
                hist_fcf_a[yr] = round(a_ocf[yr] + a_capex.get(yr, 0), 0)

        # BV per share historis = Total Equity / Shares
        hist_bv_a = {}
        for yr, eq in a_eq.items():
            if eq and shares and shares > 0:
                hist_bv_a[yr] = round(eq / shares, 2)

        # ROE historis tahunan = Net Income / Equity
        hist_roe_a = {}
        for yr in set(list(a_ni.keys()) + list(a_eq.keys())):
            ni = a_ni.get(yr); eq = a_eq.get(yr)
            if ni and eq and eq != 0:
                hist_roe_a[yr] = round(ni / eq * 100, 2)

        # DPS historis per tahun (dari divs_raw, di-fetch sekali di atas)
        hist_dps_a = {}
        try:
            if divs_raw is not None and not divs_raw.empty:
                for dt_idx, amt in divs_raw.items():
                    yr = str(dt_idx.year)
                    hist_dps_a[yr] = round(hist_dps_a.get(yr, 0) + float(amt), 2)
        except Exception:
            pass

        # EPS CAGR 2Y dan 3Y (untuk Graham Growth di browser)
        eps_cagr_3y, eps_cagr_2y = None, None
        sorted_eps_yrs = sorted([y for y, v in hist_eps_a.items() if v and v > 0], reverse=True)
        if len(sorted_eps_yrs) >= 3:
            en, eo = hist_eps_a[sorted_eps_yrs[0]], hist_eps_a[sorted_eps_yrs[2]]
            if eo > 0: eps_cagr_3y = round(((en/eo)**0.5 - 1)*100, 1)
        if len(sorted_eps_yrs) >= 2:
            en, eo = hist_eps_a[sorted_eps_yrs[0]], hist_eps_a[sorted_eps_yrs[1]]
            if eo > 0: eps_cagr_2y = round((en/eo - 1)*100, 1)

        # DDM dividend growth rate (CAGR DPS 2 tahun)
        ddm_g_rate = None
        dps_sorted_yrs = sorted(hist_dps_a.items(), reverse=True)
        if len(dps_sorted_yrs) >= 3:
            dps_new = dps_sorted_yrs[0][1]; dps_old = dps_sorted_yrs[2][1]
            if dps_old and dps_old > 0 and dps_new > 0:
                ddm_g_rate = round(((dps_new/dps_old)**0.5 - 1)*100, 1)

        # TTM calculations
        ttm_rev = ttm_from_quarterly(q_rev)  or sg(info,"totalRevenue")
        ttm_ni  = ttm_from_quarterly(q_ni)   or sg(info,"netIncomeToCommon")
        ttm_gp  = ttm_from_quarterly(q_gp)   or sg(info,"grossProfits")
        ttm_oi  = ttm_from_quarterly(q_oi)
        ttm_ocf = ttm_from_quarterly(q_ocf)  or sg(info,"operatingCashflow")
        ttm_fcf = ttm_from_quarterly(q_fcf_cf) or sg(info,"freeCashflow")
        ttm_icf = ttm_from_quarterly(q_icf)
        ttm_fincf=ttm_from_quarterly(q_fcf_cf2)

        # Latest quarter values (most recent)
        def latest_q(qdict):
            rows = []
            for y, qmap in qdict.items():
                for q, v in qmap.items():
                    rows.append((int(y), q, v))
            rows.sort(key=lambda x:(x[0],x[1]), reverse=True)
            return rows[0][2] if rows else None

        lq_assets = latest_q(q_assets)
        lq_eq     = latest_q(q_eq)
        lq_debt   = latest_q(q_debt)
        lq_cash   = latest_q(q_cash_bs)
        lq_cur_a  = latest_q(q_cur_a)
        lq_cur_l  = latest_q(q_cur_l)
        lq_lt_debt= latest_q(q_lt_debt)
        lq_tot_l  = latest_q(q_tot_l)
        lq_ocf    = latest_q(q_ocf)
        lq_capex  = latest_q(q_capex)
        lq_fcf    = latest_q(q_fcf_cf)
        lq_recv   = latest_q(q_recv)
        lq_inv    = latest_q(q_inv)
        lq_pay    = latest_q(q_pay)
        lq_teq    = latest_q(q_teq)

        def latest_a(adict):
            """Nilai tahun terakhir dari dict {year: value}."""
            yrs = sorted(adict.keys(), reverse=True)
            return adict[yrs[0]] if yrs else None

        lq_re     = latest_q(q_re)
        if lq_re is None:
            lq_re = latest_a(a_re)   # fallback annual (qbs sering tanpa RE)

        # TTM tambahan (fallback annual terakhir bila quarterly kosong)
        ttm_cogs   = ttm_from_quarterly(q_cogs)
        ttm_int    = ttm_from_quarterly(q_int)    or latest_a(a_int)
        ttm_tax_p  = ttm_from_quarterly(q_tax)    or latest_a(a_tax)
        ttm_pretax = ttm_from_quarterly(q_pretax) or latest_a(a_pretax)

        # Calculated solvency (latest quarter)
        lq_net_debt = (lq_debt - lq_cash) if (lq_debt and lq_cash) else None
        lq_wc       = (lq_cur_a - lq_cur_l) if (lq_cur_a and lq_cur_l) else None
        der_q       = (lq_debt/lq_eq) if (lq_debt and lq_eq and lq_eq!=0) else None
        lt_der_q    = (lq_lt_debt/lq_eq) if (lq_lt_debt and lq_eq and lq_eq!=0) else None
        lev_q       = (lq_assets/lq_eq) if (lq_assets and lq_eq and lq_eq!=0) else None
        tl_eq_q     = (lq_tot_l/lq_eq) if (lq_tot_l and lq_eq and lq_eq!=0) else None
        td_ta_q     = (lq_debt/lq_assets) if (lq_debt and lq_assets and lq_assets!=0) else None

        # Revenue per share TTM — nilai laporan-keuangan, disamakan ke IDR
        # (lihat konversi_ke_idr; no-op kalau fin_cur sudah IDR).
        rev_ps  = konversi_ke_idr((ttm_rev/shares) if (ttm_rev and shares) else None, fin_cur, kurs)
        cash_ps = konversi_ke_idr((lq_cash/shares) if (lq_cash and shares) else None, fin_cur, kurs)
        fcf_ps  = konversi_ke_idr((ttm_fcf/shares) if (ttm_fcf and shares) else None, fin_cur, kurs)
        ocf_ps  = konversi_ke_idr((ttm_ocf/shares) if (ttm_ocf and shares) else None, fin_cur, kurs)
        bv      = konversi_ke_idr(sg(info,"bookValue"), fin_cur, kurs)
        ebitda_idr = konversi_ke_idr(sg(info,"ebitda"), fin_cur, kurs)

        # Growth YoY (latest quarter vs same quarter prev year)
        def yoy_growth(qdict):
            rows = []
            for y, qmap in qdict.items():
                for q, v in qmap.items():
                    rows.append((int(y), q, v))
            rows.sort(key=lambda x:(x[0],x[1]), reverse=True)
            if len(rows) < 5:
                return None
            cur_v = rows[0][2]
            # find same quarter last year
            cur_y, cur_q = rows[0][0], rows[0][1]
            for yr, q, v in rows:
                if yr == cur_y-1 and q == cur_q:
                    if v and v!=0:
                        return round((cur_v/v-1)*100, 2)
            return None

        rev_yoy  = yoy_growth(q_rev)
        ni_yoy   = yoy_growth(q_ni)
        gp_yoy   = yoy_growth(q_gp)

        # Earnings yield, Price to CF
        last_price = sg(info,"currentPrice") or sg(info,"regularMarketPrice")
        pe = sg(info,"trailingPE")
        # yfinance kadang balikin trailingPE non-numerik (str "Infinity" — earnings
        # ~0, ditemukan di INRU): sg() cuma nyaring None/NaN-float, bukan tipe lain.
        # Tanpa guard ini, 1/pe di baris berikut TypeError ('int'/'str') & seluruh
        # ticker gagal disimpan (bukan cuma earn_yield-nya).
        if not isinstance(pe, (int, float)):
            pe = None
        earn_yield = (1/pe*100) if pe and pe!=0 else None
        # price_cf/price_fcf: last_price sudah IDR (harga), ocf_ps/fcf_ps sudah dikonversi
        # ke IDR di atas — kalau sebelumnya dibagi mentah (USD), hasilnya lima digit palsu.
        price_cf   = (last_price/ocf_ps) if (last_price and ocf_ps and ocf_ps!=0) else None
        price_fcf  = (last_price/fcf_ps) if (last_price and fcf_ps and fcf_ps!=0) else None

        # === RASIO VALUASI BERBASIS LAPORAN — dihitung ulang dari nilai yang sudah
        # dikonversi ke IDR, BUKAN diambil mentah dari Yahoo (priceToBook dkk. Yahoo
        # membagi harga IDR dengan nilai laporan USD mentah → PB/PS/EV lima digit). ===
        pb_val = round(last_price/bv, 4) if (last_price and bv and bv!=0) else None
        ps_val = round(last_price/rev_ps, 4) if (last_price and rev_ps and rev_ps!=0) else None
        ev_val = sg(info,"enterpriseValue")  # sudah market-cap-based → IDR, tidak perlu konversi
        ev_ebitda_val = round(ev_val/ebitda_idr, 2) if (ev_val and ebitda_idr and ebitda_idr!=0) else None
        ttm_rev_idr = konversi_ke_idr(ttm_rev, fin_cur, kurs)
        ev_revenue_val = round(ev_val/ttm_rev_idr, 2) if (ev_val and ttm_rev_idr and ttm_rev_idr!=0) else None

        # Free float %
        # `marketCap` Yahoo dihitung dari `sharesOutstanding` versinya sendiri,
        # jadi ikut basi persis di emiten yang `shares`-nya dikoreksi (AISA
        # tersirat 3,81 miliar saham, MSKY 5x kebesaran). Dihitung ulang dengan
        # definisi yang dipakai bursa: saham tercatat x harga terakhir. Emiten
        # lain tak disentuh — angka Yahoo tetap menang di sana.
        mcap = sg(info,"marketCap")
        if shares_sumber == "idx" and shares and last_price:
            mcap = round(shares * last_price)

        float_sh = sg(info,"floatShares")
        # `floatShares` Yahoo TIDAK selalu sebasis dengan `sharesOutstanding`-nya
        # sendiri: di BBNI keduanya sepasang (224,7 juta / 578,7 juta = 38,84%,
        # cocok dgn free float resmi), di AISA `floatShares` justru sudah memakai
        # jumlah saham TERKINI (2,25 miliar) sementara `sharesOutstanding` masih
        # yang lama. Menskalakannya dengan satu rumus tetap malah memburukkan
        # keduanya (AISA sempat terbaca 1.669%). Jadi: coba kedua basis, pakai
        # yang jatuh di rentang yang mungkin. Tak ada yang masuk akal -> None,
        # bukan angka mustahil yang terbaca seolah data (aturan #2 modul).
        float_pct = None
        for basis in (shares_yf, shares):
            if float_sh and basis:
                p = float_sh / basis * 100
                if 0 < p <= 100:
                    float_pct = p
                    break

        # Beta & 52W Change
        beta = sg(info,"beta")
        week52_change = sg(info,"52WeekChange")  # as decimal, e.g. 2.65 = 265%

        # Dividend info
        div_rate = sg(info,"dividendRate")
        div_yield = sg(info,"dividendYield")
        payout_r  = sg(info,"payoutRatio")
        ex_div    = sg(info,"exDividendDate")
        if ex_div:
            try:
                ex_div = datetime.fromtimestamp(ex_div).strftime("%d %b %y") if isinstance(ex_div,int) else str(ex_div)
            except Exception:
                ex_div = str(ex_div)

        # Dividend history (per tahun dari divs_raw, di-fetch sekali di atas)
        div_history = []
        try:
            divs = divs_raw
            if divs is not None and not divs.empty:
                # Group by year — ambil entri terbesar per tahun (biasanya 1x/tahun untuk IDX)
                div_by_year = {}
                for dt, amt in divs.items():
                    yr = str(dt.year)
                    div_by_year.setdefault(yr, []).append({"ex_date": dt.strftime("%d %b %y"), "amount": round(float(amt), 2)})
                # Urutkan desc, max 6 tahun
                for yr in sorted(div_by_year.keys(), reverse=True)[:6]:
                    for entry in div_by_year[yr]:
                        div_history.append({"year": yr, **entry})
        except Exception:
            pass

        # === RASIO TURUNAN BARU (Stock Detail ala "Key Stats") ===============
        # Rasio = laporan ÷ laporan (mata uang sama) → TIDAK perlu konversi_ke_idr.
        # Nilai absolut yang diekspor tetap dikonversi di blok output.

        # EBIT TTM: quarterly Operating Income, fallback annual terakhir.
        ttm_ebit = ttm_oi if ttm_oi is not None else latest_a(a_oi)

        # COGS TTM fallback: Revenue − Gross Profit (identitas akuntansi).
        if ttm_cogs is None and ttm_rev is not None and ttm_gp is not None:
            ttm_cogs = ttm_rev - ttm_gp

        # EV/EBIT = enterprise value (IDR, market-based) / EBIT TTM (→IDR).
        # Sebelumnya ev_ebit cuma alias ev_ebitda — sekarang dihitung beneran.
        ttm_ebit_idr = konversi_ke_idr(ttm_ebit, fin_cur, kurs)
        ev_ebit_val = round(ev_val/ttm_ebit_idr, 2) if (ev_val and ttm_ebit_idr) else None

        # Interest coverage = EBIT TTM / |beban bunga TTM|.
        interest_cov = round(ttm_ebit/abs(ttm_int), 2) if (ttm_ebit is not None and ttm_int) else None

        # ROIC ≈ NOPAT / (equity + total_debt − cash), posisi kuartal terakhir
        # (aproksimasi jujur: bukan rata-rata awal-akhir periode).
        # NOPAT = EBIT × (1 − tax efektif); tax efektif = Tax Provision TTM /
        # Pretax Income TTM (dipakai hanya bila 0 ≤ rate < 1), fallback tarif
        # PPh badan RI 22%.
        tax_rate = 0.22
        if ttm_tax_p is not None and ttm_pretax:
            tr = ttm_tax_p / ttm_pretax
            if 0 <= tr < 1:
                tax_rate = tr
        roic = None
        inv_cap = (lq_eq or 0) + (lq_debt or 0) - (lq_cash or 0)
        if ttm_ebit is not None and lq_eq and inv_cap > 0:
            roic = round(ttm_ebit*(1-tax_rate)/inv_cap, 4)

        # ROCE = EBIT TTM / capital employed (total assets − current liabilities).
        roce = None
        if ttm_ebit is not None and lq_assets and lq_cur_l is not None and (lq_assets - lq_cur_l):
            roce = round(ttm_ebit/(lq_assets - lq_cur_l), 4)

        # Efisiensi/aktivitas — basis 365 hari, TTM income vs posisi kuartal
        # terakhir. Bank/finansial umumnya tanpa Inventory/COGS → None (wajar).
        # DSO = 365·piutang/pendapatan · DIO = 365·persediaan/COGS ·
        # DPO = 365·utang usaha/COGS · CCC = DSO + DIO − DPO.
        recv_turn  = round(ttm_rev/lq_recv, 2)   if (ttm_rev and lq_recv)   else None
        inv_turn   = round(ttm_cogs/lq_inv, 2)   if (ttm_cogs and lq_inv)   else None
        asset_turn = round(ttm_rev/lq_assets, 4) if (ttm_rev and lq_assets) else None
        dso = round(365*lq_recv/ttm_rev, 1)  if (ttm_rev and lq_recv)  else None
        dio = round(365*lq_inv/ttm_cogs, 1)  if (ttm_cogs and lq_inv)  else None
        dpo = round(365*lq_pay/ttm_cogs, 1)  if (ttm_cogs and lq_pay)  else None
        ccc = round(dso + dio - dpo, 1) if None not in (dso, dio, dpo) else None

        # Altman Z"-Score (modifikasi emerging market, Altman 1995):
        # Z" = 6.56·WC/TA + 3.26·RE/TA + 6.72·EBIT/TA + 1.05·BVE/TL.
        # RE (retained earnings) dari balance sheet; null bila tak tersedia.
        altman_z = None
        if lq_assets and lq_tot_l and None not in (lq_wc, lq_re, ttm_ebit, lq_eq):
            altman_z = round(6.56*lq_wc/lq_assets + 3.26*lq_re/lq_assets
                             + 6.72*ttm_ebit/lq_assets + 1.05*lq_eq/lq_tot_l, 2)

        # Piotroski F-Score (0–9) — tahun fiskal terakhir (t) vs sebelumnya (t−1):
        #   1 ROA>0 · 2 CFO>0 · 3 ΔROA>0 · 4 CFO>NetIncome (kualitas akrual) ·
        #   5 ΔLTdebt/TA<0 · 6 ΔCurrentRatio>0 · 7 tanpa dilusi (saham ≤ t−1) ·
        #   8 ΔGrossMargin>0 · 9 ΔAssetTurnover>0.
        # Komponen tanpa data = 0 (dilewati); f_score_n = jumlah komponen yang
        # benar-benar terhitung (maks 9).
        def rasio_a(num, den):
            return {y: num[y]/den[y] for y in num if den.get(y)}
        def t_dan_t1(d):
            yrs = sorted(d.keys(), reverse=True)
            return (d[yrs[0]], d[yrs[1]]) if len(yrs) >= 2 else (None, None)

        f_score, f_n = 0, 0
        roa_t, roa_p = t_dan_t1(rasio_a(a_ni, a_assets))
        if roa_t is not None:
            f_n += 1; f_score += roa_t > 0                                   # 1
        cfo_t = latest_a(a_ocf)
        if cfo_t is not None:
            f_n += 1; f_score += cfo_t > 0                                   # 2
        if roa_t is not None and roa_p is not None:
            f_n += 1; f_score += roa_t > roa_p                               # 3
        thn_sama = sorted(set(a_ocf) & set(a_ni), reverse=True)
        if thn_sama:
            f_n += 1; f_score += a_ocf[thn_sama[0]] > a_ni[thn_sama[0]]      # 4
        lev_t, lev_p = t_dan_t1(rasio_a(a_lt_debt, a_assets))
        if lev_t is not None and lev_p is not None:
            f_n += 1; f_score += lev_t < lev_p                               # 5
        cr_t, cr_p = t_dan_t1(rasio_a(a_cur_a, a_cur_l))
        if cr_t is not None and cr_p is not None:
            f_n += 1; f_score += cr_t > cr_p                                 # 6
        sh_t, sh_p = t_dan_t1(a_shares)
        if sh_t is not None and sh_p is not None:
            f_n += 1; f_score += sh_t <= sh_p                                # 7
        gm_t, gm_p = t_dan_t1(rasio_a(a_gp, a_rev))
        if gm_t is not None and gm_p is not None:
            f_n += 1; f_score += gm_t > gm_p                                 # 8
        at_t, at_p = t_dan_t1(rasio_a(a_rev, a_assets))
        if at_t is not None and at_p is not None:
            f_n += 1; f_score += at_t > at_p                                 # 9
        f_score = int(f_score) if f_n else None

        # Kuartalan mini (maks 12 kuartal terakhir) utk tabel Net Income/Revenue
        # per kuartal di Stock Detail. IDR-ised sekali di sini, dipakai ulang di
        # q_revenue/q_net_income (output) — bukan konversi dobel.
        q_rev_idr = konversi_dict_ke_idr(q_rev, fin_cur, kurs)
        q_ni_idr  = konversi_dict_ke_idr(q_ni, fin_cur, kurs)
        # EPS quarterly: Net Income (SUDAH IDR) / Shares — lihat catatan di blok
        # "shares" di atas kenapa ini dipindah kesini, bukan dari q_ni mentah.
        q_eps = {}
        if shares:
            for y, qmap in q_ni_idr.items():
                q_eps[y] = {q: round(v/shares, 2) for q, v in qmap.items()}
        sel_q = sorted({(int(y), q) for y, m in q_rev_idr.items() for q in m} |
                       {(int(y), q) for y, m in q_ni_idr.items() for q in m},
                       reverse=True)[:12]
        quarterly_mini = {}
        for y, q in sel_q:
            quarterly_mini.setdefault(str(y), {})[q] = {
                "revenue":    q_rev_idr.get(str(y), {}).get(q),
                "net_income": q_ni_idr.get(str(y), {}).get(q),
            }

        # ── Susun output ──────────────────────────────────────────────────
        data = {
            # Meta
            "ticker":   ticker_code,
            "name":     name,
            "sector":   sg(info,"sector") or "-",
            "industry": sg(info,"industry") or "-",
            "website":  sg(info,"website") or "-",
            "summary":  (sg(info,"longBusinessSummary") or "")[:400],
            "currency": sg(info,"currency") or "IDR",
            # Mata uang LAPORAN KEUANGAN (fin_cur, baris ~321) — beda dari "currency"
            # di atas (mata uang HARGA, selalu IDR di IDX). Emiten pelapor-USD (AADI dkk.)
            # perlu ini di frontend buat caveat "laporan dalam USD" (Task 19).
            "financial_currency": fin_cur,
            "updated":  datetime.now().strftime("%Y-%m-%d %H:%M"),

            # Harga & Statistik Perdagangan
            "last_price":       last_price,
            "prev_close":       sg(info,"regularMarketPreviousClose"),
            "week52_high":      sg(info,"fiftyTwoWeekHigh"),
            "week52_low":       sg(info,"fiftyTwoWeekLow"),
            "week52_change_pct":round(week52_change*100,2) if week52_change else None,
            "beta":             round(beta,2) if beta else None,
            "avg_volume":       sg(info,"averageVolume"),
            "avg_volume_10d":   sg(info,"averageDailyVolume10Day"),
            "shares":           shares,
            # "idx" = jumlah saham dikoreksi ke ListedShares resmi bursa karena
            # yfinance ketinggalan aksi korporasi. Dibaca `shares_masuk_akal()`
            # di lengkapi_fundamental.py: tanda ini menang atas cek market_cap.
            "shares_sumber":    shares_sumber,
            "float_shares":     float_sh,
            "float_pct":        round(float_pct,2) if float_pct else None,
            # Field tambahan dashboard (dari info yang sama, nol request ekstra).
            # ma50/ma200 & target_price dalam mata uang HARGA (IDR) — bukan laporan,
            # jadi TIDAK melalui konversi_ke_idr.
            "ma50":             sg(info,"fiftyDayAverage"),
            "ma200":            sg(info,"twoHundredDayAverage"),
            "target_price":     sg(info,"targetMeanPrice"),
            "analyst_count":    sg(info,"numberOfAnalystOpinions"),
            "recommendation":   sg(info,"recommendationKey"),
            "held_insiders_pct":     round(sg(info,"heldPercentInsiders")*100,2) if sg(info,"heldPercentInsiders") is not None else None,
            "held_institutions_pct": round(sg(info,"heldPercentInstitutions")*100,2) if sg(info,"heldPercentInstitutions") is not None else None,

            # === CURRENT VALUATION ===
            # pb/ps/ev_ebit/ev_ebitda/ev_revenue: dihitung ulang dari bv/rev_ps/ebitda
            # yang sudah dikonversi ke IDR (lihat blok "RASIO VALUASI" di atas), BUKAN
            # field priceToBook/priceToSalesTrailing12Months/enterpriseToEbitda/
            # enterpriseToRevenue mentah dari Yahoo — field itu tetap membagi harga IDR
            # dengan nilai laporan USD mentah untuk emiten pelapor-USD (akar temuan C).
            "pe":           pe,
            "pe_annualised":sg(info,"trailingPE"),    # same as pe, yfinance annualised
            "forward_pe":   sg(info,"forwardPE"),
            "earn_yield":   round(earn_yield,2) if earn_yield else None,
            "pb":           pb_val,
            "ps":           ps_val,
            "price_cf":     round(price_cf,2) if price_cf else None,
            "price_fcf":    round(price_fcf,2) if price_fcf else None,
            "ev_ebit":      ev_ebit_val,     # EV / EBIT TTM beneran (dulu alias ev_ebitda)
            "ev_ebitda":    ev_ebitda_val,
            "ev_revenue":   ev_revenue_val,
            "peg":          sg(info,"pegRatio"),

            # === PER SHARE ===
            # eps/eps_fwd SENGAJA tidak melalui konversi_ke_idr: berbeda dari bookValue,
            # trailingEps/forwardEps Yahoo untuk emiten pelapor-USD di IDX secara empiris
            # SUDAH senilai IDR (dicek lintas >90 saham USD-reporter di data-idx/json/fundamental/
            # — rasio eps/hist_eps_lokal(USD) konsisten ~16.000-20.000, persis kisaran kurs
            # USD/IDR asli di data-idx/json/ds_*.json). Mengalikan lagi dengan kurs akan melipat-
            # gandakan nilai yang sudah benar (bug baru arah sebaliknya). forwardEps kadang
            # (minoritas ticker: HEXA, ARCI, BUMI, EMAS, RAJA, RATU) masih mentah-USD
            # (forward_pe lima digit) — belum ada cara andal membedakan per-ticker tanpa
            # verifikasi langsung, jadi TIDAK disentuh di task ini (lihat laporan Task 9).
            "eps":          sg(info,"trailingEps"),
            "eps_fwd":      sg(info,"forwardEps"),
            "bv":           round(bv,4) if bv else None,
            "rev_ps":       round(rev_ps,2) if rev_ps else None,
            "cash_ps":      round(cash_ps,2) if cash_ps else None,
            "fcf_ps":       round(fcf_ps,2) if fcf_ps else None,

            # === SOLVENCY (Latest Quarter) ===
            "current_ratio":sg(info,"currentRatio"),
            "quick_ratio":  sg(info,"quickRatio"),
            "der":          sg(info,"debtToEquity"),      # from info (usually annual)
            "der_q":        round(der_q,4) if der_q else None,
            "lt_der_q":     round(lt_der_q,4) if lt_der_q else None,
            "tl_eq_q":      round(tl_eq_q,4) if tl_eq_q else None,
            "td_ta_q":      round(td_ta_q,4) if td_ta_q else None,
            "lev_q":        round(lev_q,4) if lev_q else None,

            # === PROFITABILITY ===
            "gpm":          sg(info,"grossMargins"),
            "opm":          sg(info,"operatingMargins"),
            "npm":          sg(info,"profitMargins"),
            "ebitda_margin":sg(info,"ebitdaMargins"),
            "roe":          sg(info,"returnOnEquity"),
            "roa":          sg(info,"returnOnAssets"),

            # === GROWTH (Quarter YoY) ===
            "rev_yoy":      rev_yoy,
            "ni_yoy":       ni_yoy,
            "gp_yoy":       gp_yoy,

            # === DIVIDEND ===
            "dividend":         div_rate,
            "dividend_ttm":     div_rate,   # alias, same source
            "dividend_yield":   div_yield,
            "payout_ratio":     payout_r,
            "ex_dividend_date": ex_div,     # HTML uses ex_dividend_date
            "div_history":      div_history,

            # === INCOME STATEMENT TTM ===
            # Nilai absolut (bukan rasio, bukan per-saham) — disamakan ke IDR sama
            # seperti rev_ps/bv/ebitda_idr di atas untuk emiten pelapor-USD (lihat
            # konversi_ke_idr). ttm_revenue/ttm_ebitda memakai ulang ttm_rev_idr/
            # ebitda_idr yang sudah dihitung di atas (baris ~479/519) untuk rasio
            # ev_revenue/ev_ebitda — bukan konversi baru dari nilai yang sama.
            "ttm_revenue":  ttm_rev_idr,
            "ttm_gross":    konversi_ke_idr(ttm_gp, fin_cur, kurs),
            "ttm_ebitda":   ebitda_idr,
            "ttm_net_income":konversi_ke_idr(ttm_ni, fin_cur, kurs),
            "ttm_op_income":konversi_ke_idr(ttm_oi, fin_cur, kurs),

            # === BALANCE SHEET (Latest Quarter) ===
            "lq_cash":      konversi_ke_idr(lq_cash, fin_cur, kurs),
            "lq_assets":    konversi_ke_idr(lq_assets, fin_cur, kurs),
            "lq_tot_liab":  konversi_ke_idr(lq_tot_l, fin_cur, kurs),
            "lq_wc":        konversi_ke_idr(lq_wc, fin_cur, kurs),
            "lq_equity":    konversi_ke_idr(lq_eq, fin_cur, kurs),
            "lq_lt_debt":   konversi_ke_idr(lq_lt_debt, fin_cur, kurs),
            "lq_st_debt":   konversi_ke_idr((lq_debt - lq_lt_debt) if (lq_debt and lq_lt_debt) else None, fin_cur, kurs),
            "lq_total_debt":konversi_ke_idr(lq_debt, fin_cur, kurs),
            "lq_net_debt":  konversi_ke_idr(lq_net_debt, fin_cur, kurs),

            # === CASH FLOW TTM ===
            "ttm_ocf":      konversi_ke_idr(ttm_ocf, fin_cur, kurs),
            "ttm_icf":      konversi_ke_idr(ttm_icf, fin_cur, kurs),
            "ttm_fincf":    konversi_ke_idr(ttm_fincf, fin_cur, kurs),
            "ttm_capex":    konversi_ke_idr(sg(info,"capitalExpenditures"), fin_cur, kurs),
            "ttm_fcf":      konversi_ke_idr(ttm_fcf, fin_cur, kurs),

            # === MARKET CAP & ENTERPRISE VALUE ===
            "market_cap":       mcap,
            "enterprise_value": sg(info,"enterpriseValue"),

            # === QUARTERLY DATA (untuk tabel) ===
            # Dict {year: value} / {year: {quarter: value}} — disamakan ke IDR lewat
            # konversi_dict_ke_idr. q_eps dihitung dari q_ni_idr (SUDAH IDR) di atas
            # — beda dari eps/eps_fwd tahunan (trailingEps/forwardEps) yang memang
            # sudah IDR-scale langsung dari Yahoo (temuan empiris Task 9); q_ni
            # kuartalan di sini adalah baris laporan mentah, BUKAN rasio siap pakai
            # Yahoo, jadi tetap perlu dikonversi seperti rev_ps/cash_ps/fcf_ps.
            "q_revenue":    q_rev_idr,
            "q_net_income": q_ni_idr,
            "q_eps":        q_eps,
            "q_gross":      konversi_dict_ke_idr(q_gp, fin_cur, kurs),
            "q_op_income":  konversi_dict_ke_idr(q_oi, fin_cur, kurs),
            # Quarterly balance sheet
            "q_assets":     konversi_dict_ke_idr(q_assets, fin_cur, kurs),
            "q_equity":     konversi_dict_ke_idr(q_eq, fin_cur, kurs),
            "q_debt":       konversi_dict_ke_idr(q_debt, fin_cur, kurs),
            "q_cash":       konversi_dict_ke_idr(q_cash_bs, fin_cur, kurs),
            # Quarterly cash flow
            "q_ocf":        konversi_dict_ke_idr(q_ocf, fin_cur, kurs),
            "q_fcf":        konversi_dict_ke_idr(q_fcf_cf, fin_cur, kurs),
            # Annual (alias hist_* untuk kompatibilitas HTML)
            "a_revenue":    konversi_dict_ke_idr(a_rev, fin_cur, kurs),
            "a_net_income": konversi_dict_ke_idr(a_ni, fin_cur, kurs),
            "hist_revenue":          konversi_dict_ke_idr(a_rev, fin_cur, kurs),
            "hist_gross_profit":     konversi_dict_ke_idr(a_gp, fin_cur, kurs),
            "hist_operating_income": konversi_dict_ke_idr(a_oi, fin_cur, kurs),
            "hist_net_income":       konversi_dict_ke_idr(a_ni, fin_cur, kurs),
            "hist_total_assets":     konversi_dict_ke_idr(a_assets, fin_cur, kurs),
            "hist_total_equity":     konversi_dict_ke_idr(a_eq, fin_cur, kurs),
            "hist_total_debt":       konversi_dict_ke_idr(a_debt, fin_cur, kurs),

            # === PRICE PERFORMANCE ===
            "price_perf": pp,

            # === HISTORICAL PER SHARE ===
            "hist_eps":      hist_eps_a,   # {year: EPS}
            "hist_fcf":      konversi_dict_ke_idr(hist_fcf_a, fin_cur, kurs),   # {year: FCF IDR}
            "hist_bv":       konversi_dict_ke_idr(hist_bv_a, fin_cur, kurs),    # {year: BV/share IDR}
            "hist_roe":      hist_roe_a,   # {year: ROE %}
            "hist_dps":      hist_dps_a,   # {year: total DPS}

            # === EPS GROWTH ===
            "eps_cagr_3y":   eps_cagr_3y,  # % p.a.
            "eps_cagr_2y":   eps_cagr_2y,  # % p.a.

            # === DDM DATA ===
            "ddm_g_rate":    ddm_g_rate,   # DPS CAGR 2Y (%)
            "div_years":     len(hist_dps_a),  # jumlah tahun bagi dividen

            # === RASIO BARU (Key Stats Stock Detail — lihat blok perhitungan) ===
            "interest_coverage":      interest_cov,
            "roic":                   roic,
            "roce":                   roce,
            "receivables_turnover":   recv_turn,
            "inventory_turnover":     inv_turn,
            "asset_turnover":         asset_turn,
            "days_sales_outstanding": dso,
            "days_inventory":         dio,
            "days_payables":          dpo,
            "cash_conversion_cycle":  ccc,
            "altman_z":               altman_z,
            "f_score":                f_score,
            "f_score_n":              f_n,   # jumlah komponen F-Score yang terhitung (maks 9)

            # Alias eksplisit sesuai spek Stock Detail (nilai sama dgn shares/float_pct)
            "shares_outstanding":     shares,
            "free_float_pct":         round(float_pct, 2) if float_pct else None,

            # === KUARTALAN MINI (maks 12 kuartal, {tahun:{Qn:{revenue,net_income}}}) ===
            "quarterly":              quarterly_mini,
        }

        # === LAPORAN RINGKAS (grup) — referensi nilai flat yang SUDAH dikonversi
        # ke IDR di atas (bukan konversi/perhitungan kedua), supaya angka grup
        # dan angka flat mustahil beda.
        data["income_ttm"] = {
            "revenue":      data["ttm_revenue"],
            "gross_profit": data["ttm_gross"],
            "ebitda":       data["ttm_ebitda"],
            "net_income":   data["ttm_net_income"],
        }
        data["balance_q"] = {
            "cash":              data["lq_cash"],
            "total_assets":      data["lq_assets"],
            "total_liabilities": data["lq_tot_liab"],
            "working_capital":   data["lq_wc"],
            "common_equity":     data["lq_equity"],
            "lt_debt":           data["lq_lt_debt"],
            "st_debt":           data["lq_st_debt"],
            "total_debt":        data["lq_total_debt"],
            "net_debt":          data["lq_net_debt"],
            # Total equity termasuk minoritas; fallback ke common equity.
            "total_equity":      konversi_ke_idr(lq_teq, fin_cur, kurs) or data["lq_equity"],
        }
        data["cashflow_ttm"] = {
            "cfo":   data["ttm_ocf"],
            "cfi":   data["ttm_icf"],
            "cff":   data["ttm_fincf"],
            "capex": data["ttm_capex"],
            "fcf":   data["ttm_fcf"],
        }

        # Save JSON per saham
        out_path = os.path.join(OUT_DIR, f"{ticker_code}.json")
        with open(out_path, "w", encoding="utf-8") as fw:
            json.dump(data, fw, ensure_ascii=False, separators=(",", ":"))

        return data

    except YFRateLimitError:
        raise   # ditangani retry+backoff di main loop — jangan telan di sini
    except Exception as exc:
        print(f" ✗ {exc}")
        return None

# ─── Globals (set by main) ────────────────────────────────────────────────────
OUT_DIR  = ""
tickers  = []
results  = []
ok = fail = 0
KURS_USD_IDR = None      # diisi main() dari data-idx/json/ds_*.json, dibaca fetch_stock()
gagal_price_perf = []    # ticker.JK yang gagal price_perf — dipakai gerbang di akhir main()

# ─── Main execution ────────────────────────────────────────────────────────────
def main():
    global OUT_DIR, tickers, results, ok, fail, KURS_USD_IDR, gagal_price_perf
    import statistics

    # ── Resolve output directory ──────────────────────────────────────────────
    script_dir = os.path.dirname(os.path.abspath(__file__))
    OUT_DIR = os.path.normpath(os.path.join(script_dir, '..', 'data-idx', 'json', 'fundamental'))
    os.makedirs(OUT_DIR, exist_ok=True)

    # ── Kurs USD/IDR untuk konversi laporan-keuangan pelapor-USD (lihat konversi_ke_idr) ──
    KURS_USD_IDR = get_latest_kurs()
    gagal_price_perf = []
    if KURS_USD_IDR:
        print(f"   Kurs USD/IDR: {KURS_USD_IDR} (dari data-idx/json/ds_*.json terbaru)")
    else:
        print("   ⚠ Kurs USD/IDR tidak ditemukan — emiten pelapor-USD (financialCurrency=USD) "
              "akan punya bv/rev_ps/cash_ps/fcf_ps/pb/ps kosong (None), bukan salah.")

    # ── Determine tickers from sys.argv ───────────────────────────────────────
    args = sys.argv[1:]
    if not args or '--semua' in args:
        tickers = list(DEFAULT_TICKERS)
        mode_label = f"semua {len(tickers)} saham (default)"
    elif '--ihsg' in args:
        fetched = fetch_all_idx_tickers()
        tickers = fetched if fetched else list(DEFAULT_TICKERS)
        mode_label = f"IDX API — {len(tickers)} saham"
    else:
        tickers = [a.upper().replace('.JK', '') for a in args if not a.startswith('--')]
        mode_label = f"spesifik: {', '.join(tickers)}"

    # Ticker resmi IDX yang TIDAK dikenal Yahoo — jangan dicoba tiap panen
    # (keputusan Johan 28 Agu 2026: "untuk GOTOM itu di hapus saja").
    # GOTOM = saham multi-voting (MVS) GoTo: tercatat di bursa sehingga
    # sinkron harian selalu memasukkannya lagi ke daftar; menghapusnya dari
    # daftar saja akan kembali besok, jadi disaring di sini, permanen.
    LEWATI_YAHOO = {"GOTOM"}
    dilewati = [t for t in tickers if t in LEWATI_YAHOO]
    if dilewati:
        tickers = [t for t in tickers if t not in LEWATI_YAHOO]
        print(f"   Dilewati (tak dikenal Yahoo, permanen): {', '.join(dilewati)}")

    print(f"\n🔍 Mode  : {mode_label}")
    print(f"   Output: {OUT_DIR}\n")

    # ── Fetch loop ────────────────────────────────────────────────────────────
    def fetch_dengan_retry(ticker, max_coba=3):
        """Retry+backoff khusus rate limit Yahoo (429) — IP datacenter GitHub
        Actions sering kena. Error lain (data kosong dll.) tidak di-retry."""
        for coba in range(max_coba):
            try:
                return fetch_stock(ticker)
            except YFRateLimitError:
                if coba == max_coba - 1:
                    break
                tunggu = 30 * (2 ** coba)   # 30s, 60s
                print(f" ⏳ rate limit — tunggu {tunggu}s", flush=True)
                time.sleep(tunggu)
        print(" ✗ rate limit menetap", end='')
        return None

    results, ok, fail = [], 0, 0
    total = len(tickers)
    for i, ticker in enumerate(tickers, 1):
        print(f"  [{i:>4}/{total}] {ticker:<8}", end='', flush=True)
        data = fetch_dengan_retry(ticker)
        if data:
            ok += 1
            print(f" ✓ {data.get('name','')[:28]}")
            results.append({
                "ticker": ticker,
                "name":   data.get("name", ""),
                "sector": data.get("sector", ""),
            })
        else:
            fail += 1
            print(" — skip")
        # Jeda antar ticker: ~8 request/ticker × 959 ticker tanpa jeda = pola bot
        # di mata Yahoo (mitigasi standar per isu yfinance #2125/#2422).
        time.sleep(0.5)

    print(f"\n✅ Selesai: {ok} berhasil, {fail} gagal dari {total} saham")

    # ── POST-PROCESSING: Sector Median ────────────────────────────────────────
    print("\n📊 Hitung sektor median...")
    sector_data = {}
    for fname in os.listdir(OUT_DIR):
        if not fname.endswith(".json") or fname in ("index.json", "sector_avg.json"):
            continue
        try:
            with open(os.path.join(OUT_DIR, fname), encoding="utf-8") as fj:
                sd = json.load(fj)
            sec = sd.get("sector") or "Unknown"
            if sec not in sector_data:
                sector_data[sec] = []
            sector_data[sec].append(sd)
        except Exception:
            pass

    def safe_median(lst):
        vals = [v for v in lst if v is not None and isinstance(v, (int, float)) and v == v]
        return round(statistics.median(vals), 4) if len(vals) >= 3 else None

    sector_avg = {}
    for sec, stocks in sector_data.items():
        sector_avg[sec] = {
            "count":            len(stocks),
            "pe_median":        safe_median([s.get("pe")         for s in stocks]),
            "pb_median":        safe_median([s.get("pb")         for s in stocks]),
            "ps_median":        safe_median([s.get("ps")         for s in stocks]),
            "npm_median":       safe_median([s.get("npm")        for s in stocks]),
            "roe_median":       safe_median([s.get("roe")        for s in stocks]),
            "ev_ebitda_median": safe_median([s.get("ev_ebitda")  for s in stocks]),
            "gpm_median":       safe_median([s.get("gpm")        for s in stocks]),
            "opm_median":       safe_median([s.get("opm")        for s in stocks]),
            "der_median":       safe_median([s.get("der")        for s in stocks]),
        }

    sa_path = os.path.join(OUT_DIR, "sector_avg.json")
    with open(sa_path, "w", encoding="utf-8") as fw:
        json.dump(sector_avg, fw, ensure_ascii=False, separators=(",", ":"))
    print(f"  sector_avg.json → {len(sector_avg)} sektor")

    # Update each stock JSON with sector comparison
    for fname in os.listdir(OUT_DIR):
        if not fname.endswith(".json") or fname in ("index.json", "sector_avg.json"):
            continue
        try:
            fp = os.path.join(OUT_DIR, fname)
            with open(fp, encoding="utf-8") as fj:
                sd = json.load(fj)
            sec = sd.get("sector") or "Unknown"
            sa  = sector_avg.get(sec, {})
            for metric, sec_key in [("pe","pe_median"),("pb","pb_median"),("npm","npm_median"),
                                     ("roe","roe_median"),("ev_ebitda","ev_ebitda_median")]:
                sd[f"sector_{sec_key}"] = sa.get(sec_key)
            sd["sector_stock_count"] = sa.get("count", 0)
            for metric, sec_key in [("pe","pe_median"),("pb","pb_median"),("ps","ps_median")]:
                v = sd.get(metric); sm = sa.get(sec_key)
                if v and sm and sm != 0:
                    sd[f"{metric}_vs_sector_pct"] = round((v / sm - 1) * 100, 1)
            with open(fp, "w", encoding="utf-8") as fw:
                json.dump(sd, fw, ensure_ascii=False, separators=(",", ":"))
        except Exception:
            pass
    print("  Sector fields diperbarui ke semua saham JSON")

    # ── Save index ────────────────────────────────────────────────────────────
    # Dibangun dari SEMUA file JSON di disk, bukan hanya hasil run ini —
    # run yang gagal parsial (rate limit dsb.) tidak boleh menyusutkan index.json
    # padahal JSON per-ticker dari run sebelumnya masih utuh.
    stocks_index = []
    for fname in sorted(os.listdir(OUT_DIR)):
        if not fname.endswith(".json") or fname in ("index.json", "sector_avg.json"):
            continue
        try:
            with open(os.path.join(OUT_DIR, fname), encoding="utf-8") as fj:
                sd = json.load(fj)
            stocks_index.append({
                "ticker": sd.get("ticker") or fname[:-5],
                "name":   sd.get("name", ""),
                "sector": sd.get("sector", ""),
            })
        except Exception:
            pass
    idx_path = os.path.join(OUT_DIR, "index.json")
    with open(idx_path, "w", encoding="utf-8") as fw:
        json.dump({
            "updated": datetime.now().strftime("%Y-%m-%d %H:%M"),
            "total":   len(stocks_index),
            "stocks":  stocks_index,
        }, fw, ensure_ascii=False, separators=(",", ":"))
    print(f"  index.json → {len(stocks_index)} saham")
    print("\n🎉 Semua selesai!")

    # ── Gerbang kegagalan massal — jangan commit data bulanan yang bolong besar ─
    # (exit≠0 → step commit workflow tidak jalan). Hanya untuk run besar; smoke
    # test beberapa ticker tidak kena.
    if total >= 100 and fail / total > 0.3:
        print(f"GAGAL: {fail}/{total} ticker gagal (>30%) — kemungkinan diblokir Yahoo.")
        sys.exit(1)

    # ── Gerbang kegagalan price_perf — jangan biarkan galat senyap lagi ────────
    rasio = len(gagal_price_perf) / max(len(tickers), 1)
    print(f"price_perf gagal: {len(gagal_price_perf)}/{len(tickers)} ({rasio:.1%})")
    if rasio > 0.05:
        print("GAGAL: lebih dari 5% saham tidak mendapat price_perf.")
        sys.exit(1)


if __name__ == '__main__':
    main()
