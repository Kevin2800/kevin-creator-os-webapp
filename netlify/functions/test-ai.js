const SB_URL = "https://tjvcqdfglgfpwsokybje.supabase.co";
const SB_KEY = "sb_publishable_evtnCN1u9KHLVIa2Bh5dsg_v9TLsWvx"; // kunci publik by design
const j = (c, o) => ({ statusCode: c, headers: { "Content-Type": "application/json" }, body: JSON.stringify(o) });

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return j(405, { ok: false, message: "Metode tidak didukung." });
  const u = await fetch(SB_URL + "/auth/v1/user", { headers: { apikey: SB_KEY, Authorization: event.headers.authorization || "" } });
  if (!u.ok) return j(401, { ok: false, message: "Belum masuk." });
  let provider; try { provider = JSON.parse(event.body).provider; } catch {}
  const cfg = {
    gemini: { key: process.env.GEMINI_API_KEY, url: "https://generativelanguage.googleapis.com/v1beta/models", h: (k) => ({ "x-goog-api-key": k }) },
    openai: { key: process.env.OPENAI_API_KEY, url: "https://api.openai.com/v1/models", h: (k) => ({ Authorization: "Bearer " + k }) },
  }[provider];
  if (!cfg) return j(400, { ok: false, message: "Provider tidak valid." });
  if (!cfg.key) return j(200, { ok: false, message: "API key belum diisi di Environment variables Netlify." });
  try {
    const r = await fetch(cfg.url, { headers: cfg.h(cfg.key) });
    return j(200, r.ok ? { ok: true, message: "Koneksi berhasil." } : { ok: false, message: `Provider menolak permintaan (HTTP ${r.status}). Periksa API key.` });
  } catch { return j(200, { ok: false, message: "Provider tidak dapat dihubungi." }); }
};
