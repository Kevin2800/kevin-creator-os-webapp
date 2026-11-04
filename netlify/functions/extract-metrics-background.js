// Background function: AI membaca screenshot / frame rekaman layar Instagram Insights lalu mengisi angka metrik.
const SB = "https://tjvcqdfglgfpwsokybje.supabase.co";
const KEY = "sb_publishable_evtnCN1u9KHLVIa2Bh5dsg_v9TLsWvx"; // kunci publik by design
const { generate, parseJSON } = require("../lib/ai.js");
const PROMPT = `Kamu membaca screenshot atau frame rekaman layar Instagram Insights (bahasa Indonesia atau Inggris) untuk SATU Reels.
Aturan: ambil HANYA angka yang terlihat jelas. Jangan menebak atau menghitung sendiri; jika tidak terlihat isi null. Persen ditulis sebagai angka tanpa tanda %. Ubah "1,2 rb" atau "1.2K" menjadi 1200, "jt" menjadi juta. Waktu tonton dalam detik.
Untuk rate (skip_rate, share_rate, like_rate, save_rate, repost_rate, comment_rate) isi persen jika tampil. Kunci *_cmp berisi "lebih_rendah" atau "lebih_tinggi" hanya jika Instagram menampilkan pembanding dari biasanya, selain itu null.
Keluarkan JSON dengan kunci: skip_rate, skip_rate_cmp, share_rate, share_rate_cmp, like_rate, like_rate_cmp, save_rate, save_rate_cmp, repost_rate, repost_rate_cmp, comment_rate, comment_rate_cmp, views, reach, avg_watch_sec, retention_3s, profile_visits, follows, period ("24j", "48j", "7h", atau null), retention_note (ringkas dari grafik retensi jika terlihat, atau null), catatan (hal yang tidak terbaca atau meragukan).`;
exports.handler = async (event) => {
  const auth = event.headers.authorization || "";
  let id; try { id = JSON.parse(event.body).extraction_id; } catch {}
  if (!id) return;
  const rest = async (path, opt = {}) => {
    const r = await fetch(`${SB}/rest/v1/${path}`, { ...opt, headers: { apikey: KEY, Authorization: auth, "Content-Type": "application/json", ...(opt.headers || {}) } });
    if (!r.ok) throw new Error("Database menolak akses (HTTP " + r.status + ").");
    return opt.method ? null : r.json();
  };
  const patch = (b) => rest(`extractions?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(b) });
  try {
    const [x] = await rest(`extractions?id=eq.${id}&select=project_id,images`);
    if (!x || !x.images?.length) throw new Error("Tidak ada gambar.");
    const [st] = await rest(`ai_provider_settings?project_id=eq.${x.project_id}&select=*`);
    const { data } = await generate(st, 3000, PROMPT, parseJSON, x.images);
    await patch({ status: "selesai", result: data, error: null, images: null });
  } catch (e) { await patch({ status: "gagal", error: String(e.message || e).slice(0, 300) }).catch(() => {}); }
};
