# Spek #228 — ringkasan kanvas di halaman lama (tampilan Baru)

Johan 23 Sep 2026: *"lanjut semua halaman #228"*. Percontohan yang SUDAH jadi
dan wajib ditiru persis: Berkas Emiten (commit 334a2bbe1 + penyesuaian
SisipKanvas). Baca dulu:
- `app/src/views/dasbor/BerkasEmiten.tsx` — cari `SisipKanvas` dan `RingkasKanvas`
- `app/src/views/baru/L3Berkas.tsx` — prop `kodeTetap` + `sisip`
- `app/src/views/baru/SisipKanvas.tsx` — pembungkus (section `.baru.kanvas-sisip`,
  penahan galat, Suspense). Jangan diubah.

## Pola (sama untuk tiap pasangan halaman lama -> lapisan)
1. Lapisan `app/src/views/baru/<L...>.tsx`: tambah prop opsional
   `{ sisip = false, kodeTetap }: { sisip?: boolean; kodeTetap?: string } = {}`
   (kodeTetap hanya untuk lapisan per emiten). Bila `sisip`: jangan render
   `PilihEmiten`, `KakiBaru`, dan kendali navigasi milik /baru (tautan ke lapisan
   lain boleh tetap). Tanpa prop, perilakunya WAJIB sama persis dengan sekarang
   (rute /baru tak berubah). Kalau lapisan memanggil `useParams` untuk kode:
   `kodeTetap ?? kodeParam ?? EMITEN_BAWAAN`.
2. Halaman lama `app/src/views/dasbor/<Halaman>.tsx`:
   - `import { useTheme } from '../../context/ThemeContext'` +
     `import { SisipKanvas } from '../baru/SisipKanvas'` + sesudah SEMUA import:
     `const RingkasKanvas = lazy(() => import('../baru/<L...>'))` (tambah `lazy` ke
     import react).
   - Di komponen: `const { tampilan } = useTheme()` (sebelum return awal apa pun).
   - Tepat sesudah blok `.vhead` render utama:
     `{tampilan === 'baru' && (<SisipKanvas kunci={<kode atau nama rute>} label="Ringkasan ..."><RingkasKanvas sisip [kodeTetap={kode}] /></SisipKanvas>)}`
     Untuk halaman per emiten, `kode` = emiten yang SEDANG dipilih di halaman lama
     (cari state/param yang dipakai halaman itu; bukan konstanta).
   - Komentar satu baris: `{/* #228: ringkasan kanvas PAPAN Baru (tampilan Baru saja); fitur lama tetap di bawah. */}`
   - Tidak ada perubahan lain di halaman lama.
3. Mode Lama tak boleh berubah: semua kode baru di halaman lama berada di balik
   `tampilan === 'baru'`.

## Batasan
- Jangan git, jangan dev server/browser (pemanggil memverifikasi).
- Sentuh hanya berkas pasangan di kelompokmu.
- Verifikasi: `cd C:/tmp/wt-reimag/app && npx tsc -b` bersih. Lalu
  `git -C C:/tmp/wt-reimag diff --stat` hanya berkas kelompokmu.

## Laporan (<12 baris)
Per pasangan: halaman lama -> lapisan, sumber `kode` (untuk per emiten), baris
sisipan (berkas:baris), yang disembunyikan saat `sisip`, dan pasangan yang
tak bisa dikerjakan beserta alasannya.
