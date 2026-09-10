// Tipe untuk `_akar-arsip.mjs` — helper-nya sengaja .mjs supaya bisa diimpor
// baik oleh pembangun .mjs (dijalankan `node` langsung di CI) maupun oleh
// skrip riset .ts (dijalankan vite-node). TypeScript menolak mengimpor .mjs
// tanpa deklarasi, jadi satu baris ini yang menyambungkan keduanya.
export const AKAR_ARSIP: string
