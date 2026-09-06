@echo off
REM ============================================================
REM  PAPAN - Panen SEMUA saat buka laptop (permintaan Johan 27 Agu 2026:
REM  "setiap saya buka laptop langsung panen itu semua data baik dari IDX,
REM  Stockbit OHLCV nya dan IDX Statistik Daily, weekly, bulanan")
REM ============================================================
REM  Daftarkan ke Task Scheduler ONLOGON (delay 2 menit):
REM    schtasks /Create /TN "PAPAN-BukaLaptop" /TR "\"%~dp0JALANKAN_BUKA_LAPTOP.bat\" auto" /SC ONLOGON /DELAY 0002:00
REM  Hapus: schtasks /Delete /TN "PAPAN-BukaLaptop" /F
REM
REM  Kenapa jalur lokal: IDX memblokir IP datacenter (403) - workflow awan
REM  "Update IDX Dashboard" gagal terus karena itu; dari IP rumahan lolos.
REM  CATATAN PUSH (koreksi pengawas 27 Agu): baris-baris berkas ini sendiri
REM  tidak push, TAPI langkah [A] memanggil JALANKAN_OTOMATIS.bat yang di
REM  ujungnya push - jadi AKIBAT BERSIH tiap login: panen, commit, PUSH.
REM  Keputusan Johan 27 Agu: perilaku ini DIBIARKAN (konsisten runner malam).
REM  Kunci ganda: pipeline lain sedang jalan -> keluar, jangan tumpang
REM  tindih - terutama token Stockbit SATU RANTAI.

cd /d "%~dp0"
REM Konsol Windows memakai encoding lama (cp1252); satu tanda panah atau
REM minus Unicode di pesan cetak membunuh skripnya SEBELUM ia bekerja, dan
REM baris "gagal - lanjut" di bawah menelan galatnya. Terukur 5 Sep 2026:
REM panen_asing.py mati di baris cetak pembukanya selama berhari-hari, jadi
REM `asing/` berhenti di 3 Sep dan dua turunan ikut basi — padahal datanya
REM sudah ada di arsip mentah (0 unduhan diperlukan). Satu variabel menutup
REM seluruh skrip sekaligus, bukan menambal per baris cetak.
set PYTHONIOENCODING=utf-8
REM PYEXE bisa ditimpa dari lingkungan — 6 Sep 2026, saat bat ini mulai
REM dilacak git dan berhenti jadi milik satu mesin. Yang tak menyetelnya
REM tetap dapat jalur bawaan yang sama seperti sebelumnya.
if not defined PYEXE set PYEXE=C:\Python314\python.exe
if not exist "%PYEXE%" set PYEXE=python

REM JANGAN menaruh tanda kurung di echo DALAM blok if-berkurung: kurung
REM tutupnya menutup blok lebih awal dan sisa barisnya dieksekusi sebagai
REM perintah ("- was unexpected at this time", task 0xFF — uji sadar 27 Agu).
if exist "%~dp0.panen.lock" (
  echo Pipeline lain sedang jalan - .panen.lock ada - keluar.
  goto keluar_terkunci
)
mkdir "%~dp0.panen.lock" 2>nul

echo.
echo ============================================================
echo  [0] GERBANG TOKEN - panen TIDAK dimulai sebelum ini lolos
echo ============================================================
REM Kenapa gerbang, dan kenapa BUKAN --status:
REM   `stockbit_token.py --status` membaca masa berlaku dari ISI token, bukan
REM   dari jawaban server. Ia tetap melaporkan refresh sah sampai 6 hari ke
REM   depan padahal rantainya sudah dicabut dari sisi sana - terjadi 24 Agu
REM   2026, panen selesai bersih pukul 04.00 lalu pukul 06.00 tanggal yang
REM   SAMA menjawab 401. Satu-satunya cara tahu ia hidup adalah MENCOBANYA.
REM   `cek_token.py` melakukan itu: satu GET ringan, tanpa memanggil refresh
REM   (memanggil refresh dari sini justru bisa memutus proses lain).
REM
REM Kenapa panen dihentikan, bukan dilanjutkan dengan peringatan:
REM   23 Agu 2026 token mati di tengah jalan dan 963 emiten gagal berturut
REM   dalam 72 menit; 708 tercatat bermasalah dan hari gagal melompat
REM   474 -> 89.580. Panen dengan token mati bukan cuma sia-sia, ia MENULIS
REM   berkas yang terlihat lengkap.
:gerbang_token
"%PYEXE%" scripts\cek_token.py
if not errorlevel 1 goto token_ok

echo.
echo   ###########################################################
echo   #  TOKEN MATI - panen DIHENTIKAN sebelum menyentuh apa pun
echo   ###########################################################
echo.
echo   Yang perlu Johan lakukan, urut:
echo.
echo     1. TUTUP semua tab Stockbit di peramban.
echo        Rotasi-pakai-ulang mencabut seluruh keluarga sesi, jadi tab yang
echo        masih terbuka akan mematikan token baru begitu ia dipakai.
echo.
echo     2. Buka Stockbit, login, lalu tempel isi berkas ini ke Console:
echo          scripts\cek_token_console.js
echo        Hasilnya tersimpan ke app\.env.local
echo.
echo     3. Kembali ke jendela ini dan tekan tombol apa saja.
echo        Token akan disemai dari .env.local lalu DIUJI LAGI ke server.
echo.
pause
echo.
echo   Menyemai dan menguji ulang...
"%PYEXE%" scripts\cek_token.py --semai
if not errorlevel 1 goto token_ok
echo.
echo   Masih mati. Ulangi langkah 1-3, atau tutup jendela ini untuk berhenti.
goto gerbang_token

:token_ok
echo   Token HIDUP - panen dimulai.


echo ============================================================
echo  PAPAN - Panen Buka Laptop (%date% %time%)
echo ============================================================

echo.
echo [A] Jalur IDX + Yahoo + kabar (pipeline lama)...
set LEWATI_OHLC_YAHOO=1
call "%~dp0JALANKAN_OTOMATIS.bat" auto
set LEWATI_OHLC_YAHOO=

echo.
echo [B] OHLCV Stockbit (17 ruas, sejak IPO) + gabung + IHSG...
"%PYEXE%" scripts\panen_ohlcv_stockbit.py --semua
if errorlevel 1 echo   (Stockbit OHLCV gagal - lanjut; token mungkin perlu disemai ulang)
REM IHSG BUKAN bagian --semua (daftar_emiten tak memuat indeks) - tanpa baris
REM ini jahitan memakai IHSG Stockbit basi dan chart Beranda macet di tanggal
REM lama (temuan Johan 27 Agu). Jahit juga MENULIS ihsg_ohlc_ringkas.json.
"%PYEXE%" scripts\panen_ohlcv_stockbit.py IHSG
"%PYEXE%" scripts\gabung_ohlc_stockbit.py
"%PYEXE%" scripts\jahit_ihsg.py

echo.
echo [B2] Broker summary per emiten (permintaan Johan 27 Agu: "tambahkan
echo      broker 6 varian ke task buka laptop") - bentuk panggilan PERSIS
echo      CI panen-harian-rumah.yml: ENAM varian GROSS. CI diselaraskan
echo      5 Sep 2026 atas ralat Johan "setiap hari itu harusnya panen 6
echo      varian karena gross, sedangkan yang net bisa di hitung" - sampai
echo      hari itu CI masih 12 dan bat sudah 6, dua kebenaran sekaligus.
echo      JANGAN dipanggil tanpa --varian: bawaannya cuma reguler.
REM Penjaga HARI TUNTAS lewat scripts\tgl_broker_aman.py - JANGAN ditulis
REM inline di sini: versi satu-baris pernah membuat task keluar 0xFF karena
REM cmd menelan karakter "kurang-dari" di for /f sebagai redirection
REM ("- was unexpected at this time", uji sadar 27 Agu).
for /f %%d in ('"%PYEXE%" scripts\tgl_broker_aman.py') do set TGL_BROKER=%%d
echo      target: %TGL_BROKER%
REM -- ENAM varian, bukan dua belas. Ketetapan Johan 1 Sep 2026: "tidak
REM -- perlu harvest 12 varian cukup 6 varian saja ... net dihitung dari
REM -- gross dan sudah ada SOP nya" (docs/desain-broker-summary.md:26 --
REM -- "NET = beli - jual, dihitung di klien").
REM --
REM -- Dibuktikan sebelum dibuang, bukan diasumsikan: 19.888 dari 19.944
REM -- baris net hasil panen COCOK PERSIS dengan (beli - jual) dari gross
REM -- (99,72%). Dan 56 sisanya bukan informasi tambahan -- semuanya lot
REM -- bertanda terbalik sementara nilainya cocok, jadi net hasil panen
REM -- justru tak konsisten dengan dirinya sendiri di situ.
REM --
REM -- Memanen keduanya menggandakan permintaan untuk nol angka baru --
REM -- dan kuota permintaan itu yang dibutuhkan panen harga.
"%PYEXE%" scripts\panen_broker_harian.py --tanggal %TGL_BROKER% --jeda 0.4 --varian reguler,asing,nego,nego-asing,tunai,tunai-asing
if errorlevel 1 echo   (broker gagal - lanjut; jangan ulangi manual saat token dipakai proses lain)

echo.
echo [B3] Bangun arsip broker tahunan TAHUN BERJALAN (pembaca: Trader Papan,
echo      Neo Inventory/Compare/Stalker) - tahun lain tak disentuh.
for /f %%y in ('powershell -NoProfile -Command "(Get-Date).Year"') do set TAHUN_KINI=%%y
if "%TAHUN_KINI%"=="" (echo   [B3] PERINGATAN: tahun tak terbaca, memakai 2026 & lanjut) & if "%TAHUN_KINI%"=="" set TAHUN_KINI=2026
"%PYEXE%" scripts\bangun_broker_tahunan.py --tahun %TAHUN_KINI% --paralel 8
if errorlevel 1 echo   (bangun tahunan gagal - lanjut)

echo.
echo [C] Aliran asing (angka bursa)...
"%PYEXE%" scripts\panen_asing.py
if errorlevel 1 echo   (asing gagal - lanjut)

echo.
echo [D] Intraday 1 menit (jendela 90 hari; hari berjalan tak diarsip)...
"%PYEXE%" scripts\panen_intraday_stockbit.py
if errorlevel 1 echo   (intraday gagal - lanjut)
"%PYEXE%" scripts\bangun_intraday_1h.py

echo.
echo [E] Turunan: kartu analisa + screener...
"%PYEXE%" scripts\bangun_kategori_broker.py
"%PYEXE%" scripts\riset\kartu_analisa.py --semua --tulis
"%PYEXE%" scripts\bangun_rezim_pasar.py

if errorlevel 1 echo   (rezim pasar gagal - lanjut)

node app\scripts\bangun-screener.mjs
"%PYEXE%" scripts\riset\rekap_preset.py
if errorlevel 1 echo   (rekap preset gagal - lanjut)
rem -- Penilai jejak. Menutup celah yang ditemukan 1 Sep 2026: keduanya
rem -- ditulis hari itu tapi tak dipanggil di mana pun, jadi baris TERKUNCI
rem -- hari berikutnya tak akan pernah lahir -- dan tak ada satu pun galat
rem -- yang memberitahu, persis bentuk lima alarm senyap yang sudah dibayar.
rem -- WAJIB sesudah rekap_preset: keduanya membaca jejak yang ia tulis.
"%PYEXE%" scripts\riset\nilai_jejak.py
if errorlevel 1 echo   (nilai jejak gagal - lanjut)
"%PYEXE%" scripts\riset\selisih_terkunci.py
if errorlevel 1 echo   (selisih terkunci gagal - lanjut)
rem -- Rencana dagang + rekam jejak per emiten -> kartu di Kartu Analisa.
rem -- WAJIB sesudah gabung OHLC: ia membaca penutupan hari terakhir.
"%PYEXE%" scripts\riset\rencana_saham.py
if errorlevel 1 echo   (rencana saham gagal - lanjut)
node app\scripts\bangun-harian-papan.mjs
if errorlevel 1 echo   (harian papan gagal - lanjut)
node app\scripts\bangun-jago-papan.mjs
if errorlevel 1 echo   (jago papan gagal - lanjut)
node app\scripts\bangun-ipo.mjs
if errorlevel 1 echo   (ipo gagal - lanjut)
pushd app
call npx vite-node scripts/pola-screener.ts
if errorlevel 1 echo   (pola screener gagal - lanjut)
popd
REM [E2] Turunan halaman yang KEMARIN yatim (audit 28 Agu atas keluhan
REM Johan "bnyk yang setelah panen data, page-page itu tidak saling
REM terhubung"): aliran investor (tab Flow), bidoffer (Kuli Papan),
REM peta grup+harga terakhir (Deret Konglomerat), keystats+info Stockbit
REM (Kuli Papan & Neo). Keystats/info punya guard arsip-hari-ini, jadi
REM aman dipanggil dari kedua jalur tanpa panen dobel.
"%PYEXE%" scripts\bangun_aliran_investor.py
if errorlevel 1 echo   (aliran investor gagal - lanjut)
"%PYEXE%" scripts\bangun_bidoffer.py
if errorlevel 1 echo   (bidoffer gagal - lanjut)
"%PYEXE%" scripts\bangun_bandarmologi.py
if errorlevel 1 echo   (bandarmologi gagal - lanjut)
"%PYEXE%" scripts\bangun_harga_terakhir.py
if errorlevel 1 echo   (harga terakhir gagal - lanjut)
"%PYEXE%" scripts\petakan_grup.py
if errorlevel 1 echo   (peta grup gagal - lanjut)
REM -- Keystats + profil: SEBULAN SEKALI, ketetapan Johan 1 Sep 2026
REM -- ("keystat dan profile cukup 1 bulan sekali"). Keduanya memanen 963
REM -- emiten dan makan puluhan menit, sementara isinya rasio & profil yang
REM -- berubah per laporan keuangan - bukan per hari. Menjalankannya harian
REM -- membakar kuota permintaan yang justru dibutuhkan panen harga.
REM -- Penanda umur disimpan di .stempel_bulanan; kalau tak ada atau sudah
REM -- lewat 28 hari, jalan. Dibaca dari BERKAS, bukan dari nomor tanggal,
REM -- supaya laptop yang tak dibuka di awal bulan tetap kebagian.
"%PYEXE%" -c "import os,sys,time; p='.stempel_bulanan'; sys.exit(0 if (not os.path.exists(p) or time.time()-os.path.getmtime(p) > 28*86400) else 1)"
if errorlevel 1 goto lewati_bulanan
echo      (jatuh tempo bulanan - keystats + profil dipanen)
"%PYEXE%" scripts\panen_keystats_stockbit.py --semua --jeda 0.4
if errorlevel 1 echo   (keystats gagal - lanjut)
"%PYEXE%" scripts\panen_info_stockbit.py --semua --jeda 0.4
if errorlevel 1 echo   (info stockbit gagal - lanjut)
echo. > .stempel_bulanan
goto sesudah_bulanan
:lewati_bulanan
echo      (keystats + profil dilewati - belum 28 hari sejak panen terakhir)
:sesudah_bulanan
if errorlevel 1 echo   (info stockbit gagal - lanjut)
REM [E3] Backup screenshot kontributor (B16 — manifest via RPC sejak
REM 28 Agu, 100%% tanpa sesi Claude Code; idempoten, tak pernah hapus).
"%PYEXE%" scripts\backup_screenshot.py
if errorlevel 1 echo   (backup screenshot gagal - lanjut)

echo.
echo [R] Penjaga radar WDWL - deteksi edisi tertinggal, hari bursa dari IHSG
echo     yang baru dijahit langkah [B]. Tarik+transkrip TIDAK bisa dari bat:
echo     Gmail MCP cuma ada di sesi Claude Cowork, dan wdwl.png tabel GAMBAR
echo     butuh visi. Basi = peringatan + .radar_basi.json; pemicu: Radar Masuk.
"%PYEXE%" scripts\cek_radar_basi.py

echo.
echo [F] Commit data hasil panen (TANPA push - push tetap keputusan Johan)...
REM ── Sapuan 6 Sep 2026 (antrean #10) ──────────────────────────────────────
REM Johan menemukan tiga berkas data yang tak pernah bersih di `git status`.
REM Sebabnya: bat ini MEMBANGUN keluaran lalu tak menyebutnya saat commit.
REM Dienumerasi, bukan ditambal tiga yang kebetulan ketahuan: 40 pasangan
REM produsen-keluaran diperiksa, 26 sudah ada di daftar, 9 tidak — empat di
REM antaranya (aliran_investor, bidoffer, harga_terakhir, grup_konglomerat)
REM tertolong panen sore yang menyebutnya, lima sisanya (rezim_pasar,
REM nilai_jejak, penilaian/, selisih_terkunci, rencana_saham) tak ada di
REM daftar bat mana pun dan cuma ikut kalau JALANKAN_OTOMATIS kebetulan jalan.
REM `penilaian/` yang paling mahal kalau tertinggal: isinya catatan SEKALI
REM TULIS, dan catatan yang tak pernah didorong sama saja dengan tak ada.
git add data-idx/json/ohlc data-idx/json/ohlcv_stockbit data-idx/json/asing data-idx/json/intraday_1h data-idx/json/kartu data-idx/json/screener.json data-idx/json/bandarmologi.json data-idx/json/daftar_emiten.json data-idx/json/broker_harian data-idx/json/broker_tahunan data-idx/json/harian_papan data-idx/json/jago_papan data-idx/json/ipo.json data-idx/json/pola_screener.json data-idx/json/kategori_broker.json data-idx/json/rekomendasi data-idx/json/rezim_pasar.json data-idx/json/nilai_jejak.json data-idx/json/penilaian data-idx/json/selisih_terkunci.json data-idx/json/rencana_saham.json data-idx/json/aliran_investor.json data-idx/json/bidoffer.json data-idx/json/harga_terakhir.json data-idx/json/grup_konglomerat.json 2>nul
git commit -m "data: panen buka-laptop otomatis (%date%)" -- data-idx/json/ohlc data-idx/json/ohlcv_stockbit data-idx/json/asing data-idx/json/intraday_1h data-idx/json/kartu data-idx/json/screener.json data-idx/json/bandarmologi.json data-idx/json/daftar_emiten.json data-idx/json/broker_harian data-idx/json/broker_tahunan data-idx/json/harian_papan data-idx/json/jago_papan data-idx/json/ipo.json data-idx/json/pola_screener.json data-idx/json/kategori_broker.json data-idx/json/rekomendasi data-idx/json/rezim_pasar.json data-idx/json/nilai_jejak.json data-idx/json/penilaian data-idx/json/selisih_terkunci.json data-idx/json/rencana_saham.json data-idx/json/aliran_investor.json data-idx/json/bidoffer.json data-idx/json/harga_terakhir.json data-idx/json/grup_konglomerat.json
set COMMIT_RC=%errorlevel%
REM Ditangkap SEGERA sesudah commit. Baris echo di bawah menyetel ulang
REM errorlevel, jadi memeriksanya sesudah echo membuat pemeriksaan itu
REM tak pernah menyala - dan push akan jalan walau tak ada commit baru.

echo.
echo [G] Push live - permintaan Johan 1 Sep 2026 ("serta push live").
REM Aturan lama "push tetap keputusan Johan" DIGANTI di berkas ini saja:
REM ia sendiri yang meminta bat ini mendorong. Yang TIDAK berubah: push
REM hanya dari bat ini, dan hanya SESUDAH gerbang token lolos + commit jadi.
REM
REM `git commit` di atas menyebut berkasnya satu per satu, jadi push ini
REM tak bisa membawa kerja agen lain yang kebetulan ter-stage - pelajaran
REM 18 Agu 2026, ketika commit mengambil seluruh index dan 13 berkas
REM halaman lain terbawa ke commit berjudul lain.
if not "%COMMIT_RC%"=="0" goto lewati_push
git push origin HEAD:main
if errorlevel 1 echo   (push gagal - periksa jaringan atau konflik; data tetap aman di commit lokal)
goto sesudah_push
:lewati_push
echo   (tak ada commit baru - push dilewati)
:sesudah_push

REM Keluar karena kunci milik ORANG LAIN. Sengaja tidak lewat :akhir --
REM label itu menghapus kunci, dan menghapus kunci yang baru saja kita
REM hormati berarti membatalkan penjagaannya. Terukur 5 Sep 2026: bat
REM berhenti tanpa sampai langkah commit dan meninggalkan kuncinya; jalan
REM berikutnya akan melihat kunci itu, melapor "sedang jalan", lalu
REM MENGHAPUSNYA -- satu hari panen hilang diam-diam, dan tak ada satu pun
REM galat yang menyebutnya.
:keluar_terkunci
if not "%1"=="auto" pause
goto :eof

:akhir
rmdir "%~dp0.panen.lock" 2>nul
if not "%1"=="auto" pause
