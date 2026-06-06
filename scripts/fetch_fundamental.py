"""
fetch_fundamental.py
====================
Ambil data fundamental saham IDX (komprehensif) dari yfinance
dan simpan ke data/fundamental/<TICKER>.json

Cara pakai:
  python fetch_fundamental.py               → fetch semua 959 saham IDX
  python fetch_fundamental.py BBCA ASII    → fetch saham tertentu
  python fetch_fundamental.py --ihsg       → coba IDX API dulu, fallback ke 959 default
  python fetch_fundamental.py --semua      → alias, sama dengan tanpa argumen

Output: data/fundamental/<TICKER>.json  +  data/fundamental/index.json
"""

import yfinance as yf
import json, os, sys, time, requests
import pandas as pd
from datetime import datetime, date

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
    "GOOD", "GOTO", "GOTOM", "GPRA", "GPSO", "GRIA", "GRPH", "GRPM", "GSMF", "GTBO", "GTRA", "GTSI",
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
    session = requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8",
        "X-Requested-With": "XMLHttpRequest",
        "Referer": "https://www.idx.co.id/id/data-pasar/data-saham/daftar-saham/",
    })
    # Ambil cookie dulu
    try:
        session.get("https://www.idx.co.id/id/data-pasar/data-saham/daftar-saham/", timeout=10)
    except Exception:
        pass

    endpoints = [
        ("GetSecurities",
         "https://www.idx.co.id/primary/StockData/GetSecurities",
         {"start":0,"length":9999,"exchange":"idx","type":"s"},
         ["data","Data"], ["StockCode","Code","code","symbol"]),
        ("GetCompanyProfiles",
         "https://www.idx.co.id/primary/ListedCompany/GetCompanyProfiles",
         {"start":0,"length":9999,"sCategoryBoard":"S"},
         ["data","Data"], ["StockCode","Code","code"]),
    ]

    for name, url, params, data_keys, code_keys in endpoints:
        print(f"  Endpoint {name} ... ", end="", flush=True)
        try:
            r = session.get(url, params=params, timeout=25)
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

    ytd_start = pd.Timestamp(today_dt.year, 1, 2)
    ytd_sub = hist[hist.index >= ytd_start]
    ytd_price = float(ytd_sub["Close"].iloc[0]) if not ytd_sub.empty else None

    r1d_l,  r1d_h  = get_range(2)
    r1w_l,  r1w_h  = get_range(7)
    r1m_l,  r1m_h  = get_range(30)
    r3m_l,  r3m_h  = get_range(91)
    r6m_l,  r6m_h  = get_range(183)
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
    }

# ─── Fetch satu saham ──────────────────────────────────────────────────────
def fetch_stock(ticker_code):
    ticker_jk = ticker_code + ".JK"
    try:
        t = yf.Ticker(ticker_jk)
        info = t.info
        name = sg(info,"longName") or sg(info,"shortName")
        if not name:
            return None

        # ── Laporan keuangan ──────────────────────────────────────────────
        try: fin  = t.financials
        except: fin = None
        try: bs   = t.balance_sheet
        except: bs  = None
        try: cf   = t.cashflow
        except: cf  = None
        try: qfin = t.quarterly_financials
        except: qfin = None
        try: qbs  = t.quarterly_balance_sheet
        except: qbs  = None
        try: qcf  = t.quarterly_cashflow
        except: qcf  = None

        # ── Harga historis ────────────────────────────────────────────────
        try:
            hist = t.history(period="1y")
            pp   = price_perf(hist)
        except Exception:
            hist, pp = None, {}

        # ── Quarterly helpers ─────────────────────────────────────────────
        q_rev  = df_quarterly(qfin, "Total Revenue")
        q_ni   = df_quarterly(qfin, "Net Income")
        q_gp   = df_quarterly(qfin, "Gross Profit")
        q_oi   = df_quarterly(qfin, "Operating Income")

        # EPS quarterly: Net Income / Shares
        shares = sg(info,"sharesOutstanding") or 1
        q_eps  = {}
        for y, qmap in q_ni.items():
            q_eps[y] = {q: round(v/shares, 2) for q, v in qmap.items()}

        # Quarterly balance sheet
        q_assets = df_quarterly(qbs, "Total Assets")
        q_eq     = df_quarterly(qbs, "Stockholders Equity")
        q_debt   = df_quarterly(qbs, "Total Debt")
        q_cash_bs= df_quarterly(qbs, "Cash And Cash Equivalents")
        q_cur_a  = df_quarterly(qbs, "Current Assets")
        q_cur_l  = df_quarterly(qbs, "Current Liabilities")
        q_lt_debt= df_quarterly(qbs, "Long Term Debt")
        q_tot_l  = df_quarterly(qbs, "Total Liabilities Net Minority Interest")

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

        # ── HISTORICAL METRICS (per share, annual) ───────────────────────
        # EPS historis tahunan = Net Income / Shares
        hist_eps_a = {}
        for yr, ni in a_ni.items():
            if ni and shares and shares > 0:
                hist_eps_a[yr] = round(ni / shares, 2)

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

        # DPS historis per tahun (dari t.dividends langsung)
        hist_dps_a = {}
        try:
            divs_raw = t.dividends
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

        # Calculated solvency (latest quarter)
        lq_net_debt = (lq_debt - lq_cash) if (lq_debt and lq_cash) else None
        lq_wc       = (lq_cur_a - lq_cur_l) if (lq_cur_a and lq_cur_l) else None
        der_q       = (lq_debt/lq_eq) if (lq_debt and lq_eq and lq_eq!=0) else None
        lt_der_q    = (lq_lt_debt/lq_eq) if (lq_lt_debt and lq_eq and lq_eq!=0) else None
        lev_q       = (lq_assets/lq_eq) if (lq_assets and lq_eq and lq_eq!=0) else None
        tl_eq_q     = (lq_tot_l/lq_eq) if (lq_tot_l and lq_eq and lq_eq!=0) else None
        td_ta_q     = (lq_debt/lq_assets) if (lq_debt and lq_assets and lq_assets!=0) else None

        # Revenue per share TTM
        rev_ps = (ttm_rev/shares) if (ttm_rev and shares) else None
        cash_ps = (lq_cash/shares) if (lq_cash and shares) else None
        fcf_ps  = (ttm_fcf/shares) if (ttm_fcf and shares) else None

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
        earn_yield = (1/pe*100) if pe and pe!=0 else None
        price_cf   = (last_price/(ttm_ocf/shares)) if (last_price and ttm_ocf and shares and ttm_ocf!=0) else None
        price_fcf  = (last_price/(ttm_fcf/shares)) if (last_price and ttm_fcf and shares and ttm_fcf!=0) else None

        # Free float %
        float_sh = sg(info,"floatShares")
        float_pct = (float_sh/shares*100) if (float_sh and shares and shares!=0) else None

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

        # Dividend history (per tahun dari t.dividends)
        div_history = []
        try:
            divs = t.dividends
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
            "updated":  datetime.now().strftime("%Y-%m-%d %H:%M"),

            # Harga & Statistik Perdagangan
            "last_price":       last_price,
            "prev_close":       sg(info,"regularMarketPreviousClose"),
            "week52_high":      sg(info,"fiftyTwoWeekHigh"),
            "week52_low":       sg(info,"fiftyTwoWeekLow"),
            "week52_change_pct":round(week52_change*100,2) if week52_change else None,
            "beta":             round(beta,2) if beta else None,
            "avg_volume":       sg(info,"averageVolume"),
            "shares":           shares,
            "float_shares":     float_sh,
            "float_pct":        round(float_pct,2) if float_pct else None,

            # === CURRENT VALUATION ===
            "pe":           pe,
            "pe_annualised":sg(info,"trailingPE"),    # same as pe, yfinance annualised
            "forward_pe":   sg(info,"forwardPE"),
            "earn_yield":   round(earn_yield,2) if earn_yield else None,
            "pb":           sg(info,"priceToBook"),
            "ps":           sg(info,"priceToSalesTrailing12Months"),
            "price_cf":     round(price_cf,2) if price_cf else None,
            "price_fcf":    round(price_fcf,2) if price_fcf else None,
            "ev_ebit":      sg(info,"enterpriseToEbitda"),   # closest available
            "ev_ebitda":    sg(info,"enterpriseToEbitda"),
            "ev_revenue":   sg(info,"enterpriseToRevenue"),
            "peg":          sg(info,"pegRatio"),

            # === PER SHARE ===
            "eps":          sg(info,"trailingEps"),
            "eps_fwd":      sg(info,"forwardEps"),
            "bv":           sg(info,"bookValue"),
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
            "ttm_revenue":  ttm_rev,
            "ttm_gross":    ttm_gp,
            "ttm_ebitda":   sg(info,"ebitda"),
            "ttm_net_income":ttm_ni,
            "ttm_op_income":ttm_oi,

            # === BALANCE SHEET (Latest Quarter) ===
            "lq_cash":      lq_cash,
            "lq_assets":    lq_assets,
            "lq_tot_liab":  lq_tot_l,
            "lq_wc":        lq_wc,
            "lq_equity":    lq_eq,
            "lq_lt_debt":   lq_lt_debt,
            "lq_st_debt":   (lq_debt - lq_lt_debt) if (lq_debt and lq_lt_debt) else None,
            "lq_total_debt":lq_debt,
            "lq_net_debt":  lq_net_debt,

            # === CASH FLOW TTM ===
            "ttm_ocf":      ttm_ocf,
            "ttm_icf":      ttm_icf,
            "ttm_fincf":    ttm_fincf,
            "ttm_capex":    sg(info,"capitalExpenditures"),
            "ttm_fcf":      ttm_fcf,

            # === MARKET CAP & ENTERPRISE VALUE ===
            "market_cap":       sg(info,"marketCap"),
            "enterprise_value": sg(info,"enterpriseValue"),

            # === QUARTERLY DATA (untuk tabel) ===
            "q_revenue":    q_rev,
            "q_net_income": q_ni,
            "q_eps":        q_eps,
            "q_gross":      q_gp,
            "q_op_income":  q_oi,
            # Quarterly balance sheet
            "q_assets":     q_assets,
            "q_equity":     q_eq,
            "q_debt":       q_debt,
            "q_cash":       q_cash_bs,
            # Quarterly cash flow
            "q_ocf":        q_ocf,
            "q_fcf":        q_fcf_cf,
            # Annual (alias hist_* untuk kompatibilitas HTML)
            "a_revenue":    a_rev,
            "a_net_income": a_ni,
            "hist_revenue":          a_rev,
            "hist_gross_profit":     a_gp,
            "hist_operating_income": a_oi,
            "hist_net_income":       a_ni,
            "hist_total_assets":     a_assets,
            "hist_total_equity":     a_eq,
            "hist_total_debt":       a_debt,

            # === PRICE PERFORMANCE ===
            "price_perf": pp,

            # === HISTORICAL PER SHARE ===
            "hist_eps":      hist_eps_a,   # {year: EPS}
            "hist_fcf":      hist_fcf_a,   # {year: FCF IDR}
            "hist_bv":       hist_bv_a,    # {year: BV/share}
            "hist_roe":      hist_roe_a,   # {year: ROE %}
            "hist_dps":      hist_dps_a,   # {year: total DPS}

            # === EPS GROWTH ===
            "eps_cagr_3y":   eps_cagr_3y,  # % p.a.
            "eps_cagr_2y":   eps_cagr_2y,  # % p.a.

            # === DDM DATA ===
            "ddm_g_rate":    ddm_g_rate,   # DPS CAGR 2Y (%)
            "div_years":     len(hist_dps_a),  # jumlah tahun bagi dividen
        }

        # Save JSON per saham
        out_path = os.path.join(OUT_DIR, f"{ticker}.json")
        with open(out_path, "w", encoding="utf-8") as fw:
            json.dump(data, fw, ensure_ascii=False, separators=(",", ":"))

        results.append({"code": ticker, "name": data.get("company_name",""), "sector": data.get("sector","")})
        ok += 1

    except Exception as exc:
        print(f"  ERROR: {exc}")
        fail += 1

print(f"\n✅ Selesai: {ok} berhasil, {fail} gagal dari {len(tickers)} saham")

# ── POST-PROCESSING: Sector Median ──────────────────────────────
print("\n📊 Hitung sektor median...")
import statistics

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
print(f"  sector_avg.json -> {len(sector_avg)} sektor")

# Update setiap saham JSON dengan sektor comparison
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
print("  Sector fields diupdate ke semua saham JSON")

# ── SAVE INDEX ───────────────────────────────────────────────────
idx_path = os.path.join(OUT_DIR, "index.json")
with open(idx_path, "w", encoding="utf-8") as fw:
    json.dump({
        "updated": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "total":   len(results),
        "stocks":  results
    }, fw, ensure_ascii=False, separators=(",", ":"))
print(f"  index.json -> {len(results)} saham")
print("\n🎉 Semua selesai!")
