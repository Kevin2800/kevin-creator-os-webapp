// Background function: ide (3 pilihan), script lengkap, dan revisi lewat chat. Hasil ditulis ke tabel drafts.
const SB = "https://tjvcqdfglgfpwsokybje.supabase.co";
const KEY = "sb_publishable_evtnCN1u9KHLVIa2Bh5dsg_v9TLsWvx"; // kunci publik by design
const clean = (o) => Object.fromEntries(Object.entries(o || {}).filter(([k, v]) => v && !["id", "project_id", "created_at", "updated_at"].includes(k)));

const { BASE, IDEAS, SCRIPT, REVISE } = require("../lib/draft-prompts.js");

const { generate, parseJSON } = require("../lib/ai.js");

exports.handler = async (event) => {
  const auth = event.headers.authorization || "";
  let id, mode; try { ({ draft_id: id, mode } = JSON.parse(event.body)); } catch {}
  if (!id || !["ideas", "script", "revise"].includes(mode)) return;
  const rest = async (path, opt = {}) => {
    const r = await fetch(`${SB}/rest/v1/${path}`, { ...opt, headers: { apikey: KEY, Authorization: auth, "Content-Type": "application/json", ...(opt.headers || {}) } });
    if (!r.ok) throw new Error("Database menolak akses (HTTP " + r.status + ").");
    return opt.method ? null : r.json();
  };
  const patch = (b) => rest(`drafts?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ ...b, updated_at: new Date().toISOString() }) });
  try {
    const [d] = await rest(`drafts?id=eq.${id}&select=*`);
    if (!d) return;
    const ids = (d.character_ids || []).join(",");
    const [br] = await rest(`brand_profiles?project_id=eq.${d.project_id}&select=data`);
    const chars = await rest(`characters?project_id=eq.${d.project_id}&id=in.(${ids})&select=*`);
    const prev = await rest(`episodes?project_id=eq.${d.project_id}&order=number.desc&limit=5&select=number,title,summary,main_conflict,key_events,new_info,relationship_changes,unpaid_promises,cliffhanger`);
    const ins = await rest(`insights?project_id=eq.${d.project_id}&active=eq.true&order=created_at.desc&limit=10&select=teks,rekomendasi,keyakinan,status`).catch(() => []);
    const [st] = await rest(`ai_provider_settings?project_id=eq.${d.project_id}&select=*`);
    const ctx = `DATA BRAND DNA (kosong berarti belum ditentukan):\n${JSON.stringify(clean(br?.data))}\n\nTOKOH YANG TAMPIL:\n${JSON.stringify(chars.map(clean))}\n\n5 EPISODE TERAKHIR (terbaru dulu, bisa kosong jika ini episode pertama):\n${JSON.stringify(prev.map(clean))}\n\nPEMBELAJARAN DARI ANALISIS PERFORMA (aktif, bisa kosong):\n${JSON.stringify(ins)}\n\nARAH DARI PENGGUNA (opsional): ${d.params?.note || "-"}`;
    const idea = `\n\nIDE YANG DISETUJUI PENGGUNA:\n${JSON.stringify(d.chosen)}`;
    const prompt = mode === "ideas" ? `${BASE}\n${IDEAS}\n\n${ctx}`
      : mode === "script" ? `${BASE}\n${SCRIPT}\n\n${ctx}${idea}`
      : `${BASE}\n${REVISE}\n\n${ctx}${idea}\n\nSCRIPT SAAT INI:\n${JSON.stringify(d.script)}\n\nINSTRUKSI REVISI DARI PENGGUNA:\n${d.instruction}`;
    const { data: c, provider, model } = await generate(st, Math.max(st?.max_output_tokens || 0, mode === "ideas" ? 6000 : 12000), prompt, parseJSON);
    if (mode === "ideas") {
      if (!Array.isArray(c.ideas) || !c.ideas.length) throw new Error("AI tidak memberi ide. Coba lagi.");
      return await patch({ status: "ide_siap", ideas: c.ideas.slice(0, 3), chosen: null, error: null });
    }
    const history = d.script ? [...(d.history || []), { script: d.script, instruksi: d.instruction, at: new Date().toISOString() }] : d.history || [];
    await patch({ status: "script_siap", error: null, history, script: { script: c.script, arahan_teknis: c.arahan_teknis, paket_publikasi: c.paket_publikasi, asumsi: c.asumsi, model: `${provider}:${model}` } });
  } catch (e) {
    await patch({ status: "gagal", error: String(e.message || e).slice(0, 300) }).catch(() => {});
  }
};
