// Pustaka AI bersama: daftar provider, pemanggilan model, retry otomatis, dan provider cadangan.
const PROVIDERS = {
  gemini: { label: "Gemini", env: "GEMINI_API_KEY", model: "gemini-flash-latest", kind: "gemini" },
  openai: { label: "OpenAI", env: "OPENAI_API_KEY", model: "gpt-4o-mini", kind: "openai", base: "https://api.openai.com/v1" },
  anthropic: { label: "Claude (Anthropic)", env: "ANTHROPIC_API_KEY", model: "claude-haiku-5-5", kind: "anthropic" },
  deepseek: { label: "DeepSeek", env: "DEEPSEEK_API_KEY", model: "deepseek-chat", kind: "openai", base: "https://api.deepseek.com/v1" },
  groq: { label: "Groq", env: "GROQ_API_KEY", model: "llama-3.3-70b-versatile", kind: "openai", base: "https://api.groq.com/openai/v1" },
  openrouter: { label: "OpenRouter", env: "OPENROUTER_API_KEY", model: "openrouter/free", kind: "openai", base: "https://openrouter.ai/api/v1", json: false },
  mistral: { label: "Mistral", env: "MISTRAL_API_KEY", model: "mistral-small-latest", kind: "openai", base: "https://api.mistral.ai/v1" },
};
const JSON_HINT = "Balas HANYA dengan satu objek JSON yang valid, tanpa teks lain dan tanpa blok markdown.";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function fail(P, status, body) {
  let detail = ""; const raw = String(body || "");
  try { const j = JSON.parse(raw); detail = j.error?.message || j.error || j.message || ""; if (typeof detail !== "string") detail = JSON.stringify(detail); } catch { detail = raw; }
  detail = detail.replace(/\s+/g, " ").slice(0, 140);
  const noMoney = /insufficient_quota|billing|credit|balance|exceeded your current quota/i.test(raw);
  let msg, transient = [429, 500, 502, 503, 504, 529].includes(status);
  if (status === 401 || status === 403) msg = `${P.label}: API key ditolak. Periksa key di Netlify.`;
  else if (status === 402 || (status === 429 && noMoney)) { msg = `${P.label}: saldo atau kuota habis. Isi saldo atau pilih provider lain.`; transient = false; }
  else if (status === 429) msg = `${P.label}: batas permintaan terlampaui (HTTP 429). Tunggu sebentar atau pilih provider lain.`;
  else if (status >= 500) msg = `${P.label}: server sedang sibuk (HTTP ${status}). Coba lagi sebentar.`;
  else if (status === 400 || status === 404) msg = `${P.label}: permintaan ditolak (HTTP ${status}). Periksa nama model. ${detail}`;
  else msg = `${P.label} menolak permintaan (HTTP ${status}). ${detail}`;
  const e = new Error(msg.trim()); e.status = status; e.transient = transient; return e;
}

async function post(P, url, headers, body) {
  let r;
  try { r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) }); }
  catch { const e = new Error(`${P.label}: tidak dapat dihubungi.`); e.transient = true; throw e; }
  const text = await r.text();
  return { ok: r.ok, status: r.status, text };
}

async function call(id, model, maxTokens, prompt) {
  const P = PROVIDERS[id], key = process.env[P.env];
  if (P.kind === "gemini") {
    const r = await post(P, `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, { "x-goog-api-key": key },
      { contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json", maxOutputTokens: maxTokens } });
    if (!r.ok) throw fail(P, r.status, r.text);
    return JSON.parse(r.text).candidates?.[0]?.content?.parts?.map((p) => p.text).join("");
  }
  if (P.kind === "anthropic") {
    const r = await post(P, "https://api.anthropic.com/v1/messages", { "x-api-key": key, "anthropic-version": "2023-06-01" },
      { model, max_tokens: maxTokens, system: JSON_HINT, messages: [{ role: "user", content: prompt }] });
    if (!r.ok) throw fail(P, r.status, r.text);
    return (JSON.parse(r.text).content || []).filter((c) => c.type === "text").map((c) => c.text).join("");
  }
  // OpenAI dan yang kompatibel (DeepSeek, Groq, OpenRouter, Mistral)
  const newStyle = id === "openai" && /^(gpt-5|o\d)/.test(model);
  const mk = (useJson) => ({
    model, messages: [{ role: "user", content: useJson ? prompt : prompt + "\n\n" + JSON_HINT }],
    [newStyle ? "max_completion_tokens" : "max_tokens"]: maxTokens,
    ...(useJson ? { response_format: { type: "json_object" } } : {}),
  });
  const headers = { Authorization: "Bearer " + key };
  let r = await post(P, P.base + "/chat/completions", headers, mk(P.json !== false));
  if (!r.ok && r.status === 400 && P.json !== false) r = await post(P, P.base + "/chat/completions", headers, mk(false));
  if (!r.ok) throw fail(P, r.status, r.text);
  return JSON.parse(r.text).choices?.[0]?.message?.content;
}

function pickModel(st, id) {
  const legacy = id === "gemini" ? st?.model_gemini : id === "openai" ? st?.model_openai : "";
  return (st?.models?.[id] || legacy || PROVIDERS[id].model).trim();
}

// Coba provider utama (retry 3x untuk error sementara), lalu provider cadangan bila ada.
async function generate(st, maxTokens, prompt) {
  const primary = st?.default_provider || "gemini", fb = st?.models?._fallback;
  const chain = [primary]; if (fb && fb !== primary) chain.push(fb);
  let last;
  for (const id of chain) {
    if (!PROVIDERS[id]) { last = new Error("Provider tidak dikenal: " + id); continue; }
    if (!process.env[PROVIDERS[id].env]) { last = new Error(`API key ${PROVIDERS[id].label} belum diisi di Environment variables Netlify (${PROVIDERS[id].env}).`); continue; }
    const model = pickModel(st, id);
    for (let i = 0; i < 3; i++) {
      try { const text = await call(id, model, maxTokens, prompt); if (text) return { text, provider: id, model }; last = new Error(`${PROVIDERS[id].label}: tidak mengembalikan teks.`); break; }
      catch (e) { last = e; if (!e.transient || i === 2) break; await sleep(i === 0 ? 3000 : 8000); }
    }
  }
  throw last || new Error("Tidak ada provider AI yang siap dipakai.");
}

module.exports = { PROVIDERS, generate, pickModel };
