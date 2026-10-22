const { PROVIDERS } = require("../lib/ai.js");
const SB_URL = "https://tjvcqdfglgfpwsokybje.supabase.co";
const SB_KEY = "sb_publishable_evtnCN1u9KHLVIa2Bh5dsg_v9TLsWvx"; // kunci publik by design
const j = (c, o) => ({ statusCode: c, headers: { "Content-Type": "application/json" }, body: JSON.stringify(o) });

// URL dan header untuk cek key tanpa memakai kuota generate
function probe(id, key) {
  const P = PROVIDERS[id];
  if (P.kind === "gemini") return ["https://generativelanguage.googleapis.com/v1beta/models", { "x-goog-api-key": key }];
  if (P.kind === "anthropic") return ["https://api.anthropic.com/v1/models", { "x-api-key": key, "anthropic-version": "2023-06-01" }];
  if (id === "openrouter") return ["https://openrouter.ai/api/v1/key", { Authorization: "Bearer " + key }];
  return [P.base + "/models", { Authorization: "Bearer " + key }];
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return j(405, { ok: false, message: "Metode tidak didukung." });
  const u = await fetch(SB_URL + "/auth/v1/user", { headers: { apikey: SB_KEY, Authorization: event.headers.authorization || "" } });
  if (!u.ok) return j(401, { ok: false, message: "Belum masuk." });
  let provider; try { provider = JSON.parse(event.body).provider; } catch {}
  if (provider === "_status") return j(200, { ok: true, keys: Object.fromEntries(Object.entries(PROVIDERS).map(([k, P]) => [k, !!process.env[P.env]])) });
  const P = PROVIDERS[provider];
  if (!P) return j(400, { ok: false, message: "Provider tidak valid." });
  const key = process.env[P.env];
  if (!key) return j(200, { ok: false, message: `API key belum diisi di Netlify (${P.env}).` });
  try {
    const [url, headers] = probe(provider, key);
    const r = await fetch(url, { headers });
    return j(200, r.ok ? { ok: true, message: "Koneksi berhasil." } : { ok: false, message: r.status === 401 || r.status === 403 ? "API key ditolak. Periksa key di Netlify." : `Provider menolak permintaan (HTTP ${r.status}).` });
  } catch { return j(200, { ok: false, message: "Provider tidak dapat dihubungi." }); }
};
