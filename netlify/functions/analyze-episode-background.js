// Background function: analisis performa satu snapshot + pembelajaran untuk script berikutnya.
const SB = "https://tjvcqdfglgfpwsokybje.supabase.co";
const KEY = "sb_publishable_evtnCN1u9KHLVIa2Bh5dsg_v9TLsWvx"; // kunci publik by design
const clean = (o) => Object.fromEntries(Object.entries(o || {}).filter(([k, v]) => v && !["id", "project_id", "created_at", "updated_at"].includes(k)));
const LABEL = { skip_rate: "Jumlah lewati / skip rate (%)", share_rate: "Jumlah bagikan (% dari jangkauan)", like_rate: "Jumlah suka (%)", save_rate: "Jumlah simpan (%)", repost_rate: "Jumlah posting ulang (%)", comment_rate: "Jumlah komentar (%)", views: "Tayangan", reach: "Akun terjangkau", avg_watch_sec: "Rata-rata waktu tonton (detik)", retention_3s: "Masih menonton di detik 3 (%)", profile_visits: "Kunjungan profil", follows: "Follow dari konten", retention_note: "Catatan grafik retensi" };
const readable = (m) => Object.fromEntries(Object.entries(m || {}).map(([k, v]) => k.endsWith("_cmp") ? [(LABEL[k.replace("_cmp", "")] || k) + " - pembanding Instagram", String(v).replace("_", " ") + " dari biasanya"] : [LABEL[k] || k, v]));

const RULES = `Kamu analis performa konten Instagram Reels untuk serial @kevin_k.w. Analisis performa SATU episode dari data yang dimasukkan pengguna, lalu temukan apa yang kurang dari script dan bagaimana menyempurnakan script berikutnya.
Aturan:
- Pakai HANYA data di bawah. Jangan mengarang metrik. Metrik yang tidak ada berarti tidak diisi (bukan nol).
- Rate adalah persen dari Instagram. Untuk "Jumlah lewati" (skip rate), LEBIH RENDAH = LEBIH BAIK. Pembanding "lebih rendah/lebih tinggi" adalah dibanding rata-rata akun menurut Instagram.
- Bedakan FAKTA (dari data), HIPOTESIS (dugaan penyebab), dan REKOMENDASI. Jangan menyimpulkan sebab-akibat dari korelasi sederhana. Nilai keterbatasan sampel (satu video, satu periode ukur). Jangan menyarankan perubahan strategi besar karena satu video viral atau gagal.
- Hubungkan temuan dengan bagian script (hook, struktur, konflik, dialog, ending, durasi). Rujuk detail script secara singkat dan jelaskan apa yang kurang beserta saran konkret.
- Bandingkan dengan video lain hanya jika periode ukurnya sama. Jika tidak ada pembanding, katakan terus terang.
Keluarkan JSON dengan kunci:
"ringkasan" (string), "menonjol" (array string), "berjalan_baik" (array), "perlu_diperbaiki" (array; tiap item menyebut bagian script, apa yang kurang, dan saran konkret), "kemungkinan_penyebab" (array; tiap item diawali "Hipotesis:"), "perbandingan" (string), "keyakinan" (objek {"tingkat":"rendah|sedang|tinggi","alasan":string}), "eksperimen" (array untuk video berikutnya), "jangan_diubah" (array hal yang belum cukup bukti untuk diubah), "insights" (array maksimal 5 objek {"teks","keyakinan":"rendah|sedang|tinggi","rekomendasi","status":"hipotesis"}; ringkas dan siap dipakai saat menulis script berikutnya).
Gunakan teks biasa tanpa markdown.`;

const { generate } = require("../lib/ai.js");

exports.handler = async (event) => {
  const auth = event.headers.authorization || "";
  let id; try { id = JSON.parse(event.body).snapshot_id; } catch {}
  if (!id) return;
  const rest = async (path, opt = {}) => {
    const r = await fetch(`${SB}/rest/v1/${path}`, { ...opt, headers: { apikey: KEY, Authorization: auth, "Content-Type": "application/json", ...(opt.headers || {}) } });
    if (!r.ok) throw new Error("Database menolak akses (HTTP " + r.status + ").");
    return opt.method ? null : r.json();
  };
  const patch = (b) => rest(`snapshots?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(b) });
  try {
    const [sn] = await rest(`snapshots?id=eq.${id}&select=*`);
    if (!sn) return;
    const [ep] = await rest(`episodes?id=eq.${sn.episode_id}&select=*`);
    let [sv] = await rest(`script_versions?episode_id=eq.${sn.episode_id}&approved=eq.true&order=version.desc&limit=1&select=content`);
    if (!sv) [sv] = await rest(`script_versions?episode_id=eq.${sn.episode_id}&status=eq.selesai&order=version.desc&limit=1&select=content`);
    const [br] = await rest(`brand_profiles?project_id=eq.${sn.project_id}&select=data`);
    const others = await rest(`snapshots?project_id=eq.${sn.project_id}&period=eq.${sn.period}&id=neq.${id}&order=measured_at.desc&limit=8&select=episode_id,metrics`);
    const titles = Object.fromEntries((await rest(`episodes?project_id=eq.${sn.project_id}&select=id,number,title`)).map((e) => [e.id, `EP${e.number} ${e.title}`]));
    const [st] = await rest(`ai_provider_settings?project_id=eq.${sn.project_id}&select=*`);
    const sc = sv?.content || {};
    const prompt = `${RULES}

BRAND DNA:
${JSON.stringify(clean(br?.data))}

EPISODE:
${JSON.stringify(clean(ep))}

SCRIPT EPISODE (versi disetujui jika ada):
${JSON.stringify({ script: sc.script, publikasi: sc.paket_publikasi }) || "tidak tersedia"}

DATA PERFORMA YANG DIMASUKKAN PENGGUNA (periode: ${sn.period}, diambil: ${sn.measured_at}, sumber: ${sn.source}):
${JSON.stringify(readable(sn.metrics))}
Catatan pengguna: ${sn.notes || "-"}

VIDEO LAIN DENGAN PERIODE UKUR YANG SAMA (untuk perbandingan; kosong jika belum ada):
${JSON.stringify(others.map((o) => ({ episode: titles[o.episode_id], data: readable(o.metrics) })))}`;
    const { text: raw, provider, model } = await generate(st, Math.max(st?.max_output_tokens || 0, 8192), prompt);
    if (!raw) throw new Error("AI tidak mengembalikan teks.");
    let c; try { c = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, "")); } catch { throw new Error("Respons AI terpotong atau bukan JSON. Naikkan batas output di Pengaturan lalu coba lagi."); }
    await rest(`insights?snapshot_id=eq.${id}`, { method: "DELETE" });
    const ins = (Array.isArray(c.insights) ? c.insights : []).slice(0, 5).filter((i) => i && i.teks).map((i) => ({ project_id: sn.project_id, episode_id: sn.episode_id, snapshot_id: id, teks: String(i.teks), rekomendasi: i.rekomendasi ? String(i.rekomendasi) : null, keyakinan: ["rendah", "sedang", "tinggi"].includes(i.keyakinan) ? i.keyakinan : "rendah", status: "hipotesis" }));
    if (ins.length) await rest("insights", { method: "POST", body: JSON.stringify(ins) });
    const { insights, ...analysis } = c;
    await patch({ analysis_status: "selesai", analysis_error: null, analysis: { ...analysis, model: `${provider}:${model}` } });
  } catch (e) {
    await patch({ analysis_status: "gagal", analysis_error: String(e.message || e).slice(0, 300) }).catch(() => {});
  }
};
