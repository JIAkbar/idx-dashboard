// cek_token_console.js — tempel di Console DevTools saat tab stockbit.com terbuka (sudah login).
// Johan 23 Agu 2026: "script untuk cek token baru di console".
// Membaca pasangan token dari credentialStorage (localStorage, cadangan: cookie), menampilkan
// terbit/habis tiap token (isi token disamarkan), lalu menyalin dua baris .env.local ke clipboard:
//   STOCKBIT_TOKEN=...        (access, umur 24 jam)
//   STOCKBIT_REFRESH_TOKEN=... (refresh, umur 7 hari)
// Langkah berikutnya di komputer:  python scripts/cek_token.py --semai   (tulis ke ~/.papan + uji hidup)
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
  const kini = Date.now() / 1000;
  const baris = [];
  for (const [nama, t] of [["access", access], ["refresh", refresh]]) {
    const k = klaim(t);
    const sisa = k.exp ? ((k.exp - kini) / 3600).toFixed(1) : "?";
    baris.push({ token: nama, terbit: wib(k.iat), habis: wib(k.exp), sisa_jam: sisa, isi: samar(t) });
  }
  console.log(`sumber: ${sumber.asal}`);
  console.table(baris);
  const ka = klaim(access);
  if (ka.exp && ka.exp < kini) console.warn("ACCESS SUDAH KEDALUWARSA — login ulang dulu, lalu jalankan lagi.");
  else if (ka.iat && (kini - ka.iat) < 3600) console.log("%cTOKEN BARU (terbit < 1 jam lalu)", "color:#2a9d5c;font-weight:bold");

  const env = `STOCKBIT_TOKEN=${access}\nSTOCKBIT_REFRESH_TOKEN=${refresh}\n`;
  const selesai = () => console.log("%cDua baris .env.local sudah di clipboard → tempel ke app/.env.local (ganti baris lama), lalu: python scripts/cek_token.py --semai", "color:#2a9d5c");
  if (typeof copy === "function") { copy(env); selesai(); }
  else if (navigator.clipboard) navigator.clipboard.writeText(env).then(selesai, () => console.warn("clipboard ditolak — klik halaman dulu lalu ulangi"));
})();
