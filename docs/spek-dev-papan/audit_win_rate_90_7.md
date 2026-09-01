# Audit — angka win rate 90,7% (artefak "Rencana Peleburan PAPAN")

**Dari:** Fable (pengawas, sesi AI Skill) · **Untuk:** sesi PAPAN · **31 Agu 2026**

Ditulis ke disk karena sesi Papan terpadatkan dua kali hari ini dan temuan ini
sebelumnya hanya hidup di percakapan. Johan akan memakai angka ini untuk memutuskan
apakah PAPAN "layak dipakai" dalam 10 hari, jadi ia tidak boleh bergantung pada ingatan
sesi.

## Yang sudah benar, dan jarang ada

Artefaknya membawa bagian **"Yang membuat angka ini belum boleh dipercaya penuh"** —
empat hari bukan empat bulan, satu rezim pasar, 163 "tak tentu" disebut sebagai BIAYA
bukan diabaikan, dan pengakuan bahwa baseline-nya dipilih sendiri. Baseline tebakan buta
49,5% juga langkah yang tepat: tanpa kontrol, 90% tak membuktikan apa pun.

Tiga temuan di bawah **tidak membatalkan** itu. Mereka menambah apa yang belum tertutup.

## Temuan 1 — tabelnya tidak menjumlah: 100 sinyal hilang

    preset          sinyal  menang  kalah  tak tentu   jumlah  selisih
    scalping           80      19      1       40         60     -20
    whale-tiket        80      17      1       42         60     -20
    swing              80      26      3       31         60     -20
    whale-akdis        40       7      1       12         20     -20
    whale-asing        80      19      3       38         60     -20
    TOTAL             360      88      9      163        260    -100

Tiap preset kehilangan **tepat 20**. Keteraturan itu menunjukkan satu sebab — dugaan:
sinyal hari terakhir yang jendela 5 harinya belum tutup. Halamannya tidak mengatakannya.

**Yang diminta:** sebutkan 100 itu apa, atau keluarkan dari kolom "sinyal" supaya
angkanya jujur menjumlah. Pembaca yang menjumlah sendiri dan gagal akan berhenti percaya
pada seluruh tabel, bukan cuma pada satu baris.

## Temuan 2 — nilai-p dihitung atas penyintas

"Peluang muncul kebetulan: 1 dari 220 juta miliar" sah **hanya** kalau 97 itu sampel
yang ditetapkan lebih dulu. Nyatanya 97 adalah yang tersisa sesudah 163 dibuang karena
tak menyentuh TP maupun SL — penyaringan yang terjadi SESUDAH hasilnya diketahui.

Bagian kejujuran menyebut 163-nya; angka besar di kepala dihitung seolah mereka tak ada.
Dua-duanya benar sendiri-sendiri dan saling meruntuhkan, dan yang dibaca orang angka
besarnya.

## Temuan 3 — percobaannya belum tentu bebas

Tabelnya menghitung **sinyal**, bukan **emiten**. Tiga ratus enam puluh sinyal atas lima
hari bisa datang dari 300 emiten berbeda, atau dari 20 emiten yang berulang tiap hari.

Kalau yang kedua, 97 hasil **bukan 97 percobaan bebas**: sinyal emiten yang sama di hari
berturut memakai jendela H+1..H+5 yang bertindihan empat hari, jadi hasilnya hampir pasti
sama. Menghitungnya sebagai dua kemenangan terpisah menggandakan bukti yang sebenarnya
satu.

**Yang diminta di tabel, per preset:**

    sinyal · emiten unik · sinyal per emiten · hari · menang · kalah · tak tentu

dan dua angka berdampingan:

    win rate per SINYAL    88 / 97   = 90,7%
    win rate per EMITEN    ?  / ?    = ?     (satu emiten dihitung sekali)

Berdekatan → sampelnya tersebar, angkanya kuat. Berjauhan → menumpuk di sedikit emiten,
dan harus dibaca jauh lebih hati-hati. Tidak perlu ditebak; datanya ada.

## Ketiganya menarik ke arah yang sama

163 dibuang sesudah hasil diketahui · jendela bertindihan · emiten berulang. Ketiganya
membuat nilai-p terlalu meyakinkan. Itu sebabnya "1 dari 220 juta miliar" perlu dicabut
atau diberi syarat, bukan sekadar diberi catatan kaki.

## Angka yang paling menjawab pertanyaan Johan, dan belum ada di halaman

    88 / (88+9)       = 90,7%   menang DI ANTARA yang tuntas
    88 / (88+9+163)   = 33,8%   menang dari seluruh yang terukur

Jarak 90,7% ke 33,8% itu seluruh pertanyaan "layak dipakai atau belum". Bukan berarti
33,8% yang benar — posisi menggantung memang bukan kalah — tapi keduanya harus
berdampingan, bukan satu di kepala dan satu di catatan kaki.

## Yang bisa dikerjakan sekarang dan nilainya lebih besar

Johan minta membandingkan dengan hasil 31 Agustus. Jendelanya tidak sepadan: 90,7%
mengukur TP-sebelum-SL dalam 5 hari, sementara sinyal 31 Agustus baru berjalan nol hari.

Tiga hitungan, bukan satu:

1. **Ukur ulang 24–28 Agustus dengan jendela yang kini tertutup penuh** (29, 30, 31 Agu
   sudah masuk). Sebagian besar dari 163 "tak tentu" kini selesai. Win rate barunya
   inilah yang jujur — dan ia kemungkinan **turun**, karena yang dulu tersaring keluar
   sekarang sebagian mendarat di kolom kalah.
2. **Masukkan 100 sinyal yang hilang** — jendelanya sekarang sudah tutup.
3. **Sinyal 31 Agustus dicatat, JANGAN dinilai.** Simpan sebagai uji luar sampel yang
   terkunci: presetnya sudah ditetapkan sebelum hasilnya ada. Nilai pada 5 September.
   Itu satu-satunya angka di proyek ini yang nanti tak bisa dituduh dipilih sesudah
   melihat hasil.

Kalau nomor 1 menurunkan angkanya, **laporkan penurunannya sebagai temuan, bukan
kemunduran.** Angka yang turun karena jendelanya jujur lebih berguna daripada 90,7% yang
bertahan karena separuh sampelnya dibuang.

## Satu ketegangan yang belum direkonsiliasi

Pagi 30 Agu dilaporkan penaksir peluang 5 hari punya **skill −0,023** — kalah dari
tebakan dasar, dengan tepi peringatan di halaman. Malam itu preset yang sama-sama
berjendela 5 hari menunjukkan 90,7%.

Keduanya bisa benar sekaligus (yang satu kalibrasi probabilitas, yang lain aturan
TP-sebelum-SL atas subset tersaring) — tapi Johan membaca dua-duanya, dan tanpa satu
paragraf yang menjelaskan bedanya ia akan menyimpulkan salah satu dari yang lain.

## Istilah

90,7% adalah **frekuensi historis terukur**, bukan probabilitas ke depan. Ia menjawab
"berapa sering aturan ini menang pada 24–28 Agustus", bukan "berapa peluang menang
besok". Aturan itu sudah dipegang `berkasRekam.ts` di repo ini sendiri: *"Bukan
ramalan"*, dan persentase hanya dicetak kalau sampelnya cukup.
