// Background function: AI memeriksa konsistensi script dengan Brand DNA, karakter, dan episode sebelumnya.
const SB = "https://tjvcqdfglgfpwsokybje.supabase.co";
const KEY = "sb_publishable_evtnCN1u9KHLVIa2Bh5dsg_v9TLsWvx"; // kunci publik by design
const clean = (o) => Object.fromEntries(Object.entries(o || {}).filter(([k, v]) => v && !["id", "project_id", "created_at", "updated_at"].includes(k)));
const { generate, parseJSON } = require("../lib/ai.js");
const RULES = `Kamu editor cerita (script supervisor) untuk serial Instagram Reels berbahasa Indonesia. Periksa SCRIPT BARU terhadap data serial di bawah.
Periksa: (1) rahasia karakter atau informasi yang belum boleh diketahui tokoh tapi sudah muncul/bocor di script; (2) dialog atau sikap yang tidak sesuai sifat, gaya bicara, dan pilihan kata karakter; (3) kontradiksi dengan episode sebelumnya (fakta, hubungan, urutan kejadian); (4) konflik atau adegan yang hanya mengulang tanpa perkembangan; (5) ketidaksesuaian dengan Brand DNA (nilai, batasan, hal yang dihindari); (6) janji cerita lama yang dibayar atau diabaikan.
Aturan: pakai HANYA data yang diberikan, jangan mengarang fakta. Setiap temuan harus menyebut bagian script yang bermasalah secara singkat dan saran perbaikan konkret. Jika tidak ada masalah, katakan terus terang; jangan mencari-cari kesalahan.
Keluarkan JSON: "penilaian" ("baik"|"perlu_perhatian"|"bermasalah"), "ringkasan" (string singkat), "temuan" (array objek {"jenis","tingkat":"tinggi|sedang|rendah","bagian","masalah","saran"}), "janji_terbayar" (array string), "janji_baru" (array string, janji cerita baru yang muncul di script ini). Teks biasa tanpa markdown.`;
exports.handler = async (event) => {
  const auth = event.headers.authorization || "";
  let kind, id; try { ({ kind, id } = JSON.parse(event.body)); } catch {}
  if (!id || !["draft", "version"].includes(kind)) return;
  const tb = kind === "draft" ? "drafts" : "script_versions";
  const rest = async (path, opt = {}) => {
    const r = await fetch(`${SB}/rest/v1/${path}`, { ...opt, headers: { apikey: KEY, Authorization: auth, "Content-Type": "application/json", ...(opt.headers || {}) } });
    if (!r.ok) throw new Error("Database menolak akses (HTTP " + r.status + ").");
    return opt.method ? null : r.json();
  };
  const put = (c) => rest(`${tb}?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ consistency: c }) });
  try {
    const [row] = await rest(`${tb}?id=eq.${id}&select=*`);
    if (!row) return;
    const sc = (kind === "draft" ? row.script : row.content) || {};
    if (!sc.script) throw new Error("Script belum tersedia.");
    const pid = row.project_id;
    const [br] = await rest(`brand_profiles?project_id=eq.${pid}&select=data`);
    const ids = (row.character_ids || []).join(",");
    const chars = kind === "draft" ? (ids ? await rest(`characters?project_id=eq.${pid}&id=in.(${ids})&select=*`) : []) : await rest(`characters?project_id=eq.${pid}&status=eq.aktif&select=*`);
    let ep = null, lim = "";
    if (kind === "version") { [ep] = await rest(`episodes?id=eq.${row.episode_id}&select=*`); lim = ep ? `&number=lt.${ep.number}` : ""; }
    const prev = await rest(`episodes?project_id=eq.${pid}${lim}&order=number.desc&limit=8&select=number,title,summary,main_conflict,key_events,new_info,relationship_changes,unpaid_promises,cliffhanger`);
    const [st] = await rest(`ai_provider_settings?project_id=eq.${pid}&select=*`);
    const prompt = `${RULES}\n\nBRAND DNA:\n${JSON.stringify(clean(br?.data))}\n\nKARAKTER:\n${JSON.stringify(chars.map(clean))}\n\nEPISODE SEBELUMNYA (terbaru dulu):\n${JSON.stringify(prev.map(clean))}\n\n${ep ? "EPISODE INI:\n" + JSON.stringify(clean(ep)) + "\n\n" : ""}IDE YANG DISETUJUI:\n${JSON.stringify(row.chosen || null)}\n\nSCRIPT BARU:\n${String(sc.script).slice(0, 24000)}\n\nASUMSI SCRIPT:\n${JSON.stringify(sc.asumsi || "")}`;
    const { data, provider, model } = await generate(st, Math.max(st?.max_output_tokens || 0, 6000), prompt, parseJSON);
    await put({ status: "selesai", result: data, model: `${provider}:${model}` });
  } catch (e) { await put({ status: "gagal", error: String(e.message || e).slice(0, 300) }).catch(() => {}); }
};
