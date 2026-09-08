// semai_live_console.js — kembar `cek_token_console.js`, TAPI menyalin dua baris
// bernama kunci RANTAI LIVE. Tempel di Console DevTools pada tab stockbit.com
// yang login AKUN KEDUA (rantai live), bukan akun panen.
//
// Kenapa berkas terpisah, bukan satu skrip dengan dua nama:
// `cek_token_console.js` menyalin `STOCKBIT_TOKEN=` / `STOCKBIT_REFRESH_TOKEN=`,
// dan dua nama itu sudah dipakai rantai PANEN di app/.env.local. Kalau satu
// skrip menyalin keduanya sekaligus, satu tempelan bisa mendudukkan token akun
// kedua di kamar rantai panen — dan memutar refresh dari dua tempat mencabut
// satu keluarga sesi (insiden 23–24 Agu 2026). Jadi: satu skrip, satu kamar.
//
//   STOCKBIT_LIVE_TOKEN=...         (access, umur 24 jam)
//   STOCKBIT_LIVE_REFRESH_TOKEN=... (refresh, umur 7 hari)
//
// Langkah berikutnya di komputer:  python scripts/semai_live_token.py
(() => {
  const baca = () => {
    const ls = localStorage.getItem("credentialStorage");
    if (ls) return { asal: "localStorage", isi: JSON.parse(ls) };
    const m = document.cookie.split("; ").find(c => c.startsWith("credentialStorage="));
    if (m) return { asal: "cookie", isi: JSON.parse(decodeURIComponent(m.slice("credentialStorage=".length))) };
    return null;
  };
  const klaim = t => { try { const p = t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"); return JSON.parse(atob(p + "=".repeat((4 - p.length % 4) % 4))); } catch { return {}; } };
  const wib = s => s ? new Date(s * 1000).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", hour12: false }) : "?";
  const samar = t => t ? t.slice(0, 12) + "…" + t.slice(-6) + ` (${t.length} huruf)` : "TIDAK ADA";

  const sumber = baca();
  if (!sumber) { console.error("credentialStorage tidak ditemukan — pastikan tab stockbit.com dan sudah login."); return; }
  const st = sumber.isi.state || sumber.isi;
  const access = st.access?.token || st.accessToken || st.access;
  const refresh = st.refresh?.token || st.refreshToken || st.refresh;
  if (!access || !refresh) { console.error("Pasangan token tak lengkap — login ulang lalu jalankan lagi."); return; }

  const kini = Date.now() / 1000;
  const baris = [];
  for (const [nama, t] of [["access", access], ["refresh", refresh]]) {
    const k = klaim(t);
    baris.push({ token: nama, terbit: wib(k.iat), habis: wib(k.exp),
                 sisa_jam: k.exp ? ((k.exp - kini) / 3600).toFixed(1) : "?", isi: samar(t) });
  }
  console.log(`sumber: ${sumber.asal} — RANTAI LIVE (akun kedua)`);
  console.table(baris);
  const ka = klaim(access);
  if (ka.exp && ka.exp < kini) console.warn("ACCESS SUDAH KEDALUWARSA — login ulang dulu, lalu jalankan lagi.");

  const env = `STOCKBIT_LIVE_TOKEN=${access}\nSTOCKBIT_LIVE_REFRESH_TOKEN=${refresh}\n`;
  const selesai = () => console.log("%cDua baris STOCKBIT_LIVE_* sudah di clipboard → tempel ke app/.env.local, lalu TUTUP SEMUA TAB STOCKBIT akun ini (refresh sekali-pakai).", "color:#2a9d5c;font-weight:bold");
  if (typeof copy === "function") { copy(env); selesai(); }
  else if (navigator.clipboard) navigator.clipboard.writeText(env).then(selesai, () => console.warn("clipboard ditolak — klik halaman dulu lalu ulangi."));
  else console.log(env);
})();
