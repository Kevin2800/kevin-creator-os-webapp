// Background function: berjalan sampai 15 menit, hasil ditulis ke tabel script_versions.
const SB = "https://tjvcqdfglgfpwsokybje.supabase.co";
const KEY = "sb_publishable_evtnCN1u9KHLVIa2Bh5dsg_v9TLsWvx"; // kunci publik by design

const clean = (o) => Object.fromEntries(Object.entries(o || {}).filter(([k, v]) => v && !["id", "project_id", "created_at", "updated_at"].includes(k)));

const RULES = `Kamu adalah penulis naskah dan sutradara serial Instagram Reels (vertikal 9:16) berbahasa Indonesia untuk akun @kevin_k.w.
Aturan:
- Pakai HANYA data di bawah. Jangan mengarang karakter, fakta, atau episode. Jika informasi penting tidak ada, tulis "belum ditentukan" dan catat di "asumsi".
- Dialog natural, bahasa percakapan Indonesia sesuai gaya bicara tiap karakter. Hindari pidato motivasi dan penjelasan emosi yang sudah terlihat dari aksi.
- Jangan membocorkan rahasia karakter sebelum waktunya. Jaga konsistensi dengan episode sebelumnya dan hubungan antarkarakter.
- Hook harus dibayar oleh isi cerita (bukan clickbait). Tidak semua episode harus cliffhanger.
- Produksi realistis (smartphone, tripod, mikrofon, lampu sederhana sesuai peralatan yang tersedia); beri alternatif bila alat terbatas. Musik hanya yang berlisensi atau bebas royalti.
- Jangan menyalin karya kreator lain.
Keluarkan JSON dengan 4 kunci bertipe string:
"script": ringkasan produksi singkat (logline, durasi, karakter, lokasi), struktur (hook, konflik, setup, eskalasi, payoff, ending), lalu dialog lengkap. Tiap adegan memakai baris berlabel: TIMESTAMP, LOKASI, SHOT, AKSI, KARAKTER, DIALOG, EKSPRESI, PAUSE, AUDIO, CATATAN SUTRADARA.
"arahan_teknis": shot list (nomor, timestamp, ukuran shot, sudut, posisi dan gerak kamera, blocking, durasi, pencahayaan, audio, transisi), frame rate dan shutter speed, exposure dan white balance, penempatan kamera, arah cahaya, komposisi 9:16, alternatif shot, dan rencana editing (ritme, subtitle, sound design, color grading, frame pembuka dan penutup).
"paket_publikasi": 3 alternatif judul atau opening text, caption, CTA natural, teks cover, kata kunci, hashtag seperlunya, komentar yang natural untuk dipancing (bukan engagement bait), hipotesis performa yang diuji.
"asumsi": daftar asumsi dan hal yang belum ditentukan, satu per baris.
Gunakan teks biasa tanpa tanda markdown.`;

const { generate } = require("../lib/ai.js");

exports.handler = async (event) => {
  const auth = event.headers.authorization || "";
  let id; try { id = JSON.parse(event.body).version_id; } catch {}
  if (!id) return;
  const rest = async (path, opt = {}) => {
    const r = await fetch(`${SB}/rest/v1/${path}`, { ...opt, headers: { apikey: KEY, Authorization: auth, "Content-Type": "application/json", ...(opt.headers || {}) } });
    if (!r.ok) throw new Error("Database menolak akses (HTTP " + r.status + ").");
    return opt.method ? null : r.json();
  };
  const patch = (b) => rest(`script_versions?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(b) });
  try {
    const [v] = await rest(`script_versions?id=eq.${id}&select=*`);
    if (!v) return;
    const [ep] = await rest(`episodes?id=eq.${v.episode_id}&select=*`);
    const [br] = await rest(`brand_profiles?project_id=eq.${v.project_id}&select=data`);
    const chars = await rest(`characters?project_id=eq.${v.project_id}&status=eq.aktif&select=*`);
    const prev = await rest(`episodes?project_id=eq.${v.project_id}&number=lt.${ep.number}&order=number.desc&limit=5&select=number,title,summary,main_conflict,key_events,new_info,relationship_changes,unpaid_promises,cliffhanger`);
    const [st] = await rest(`ai_provider_settings?project_id=eq.${v.project_id}&select=*`);
    const maxTokens = Math.max(st?.max_output_tokens || 0, 8192);
    const prompt = `${RULES}

DATA BRAND DNA (kosong berarti belum ditentukan):
${JSON.stringify(clean(br?.data))}

KARAKTER AKTIF:
${JSON.stringify(chars.map(clean))}

EPISODE SEBELUMNYA (terbaru dulu):
${JSON.stringify(prev.map(clean))}

EPISODE YANG DITULIS:
${JSON.stringify(clean(ep))}

PARAMETER PRODUKSI DARI PENGGUNA:
${JSON.stringify(clean(v.params))}`;
    const { text: raw, provider, model } = await generate(st, maxTokens, prompt);
    if (!raw) throw new Error("AI tidak mengembalikan teks.");
    let c; try { c = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, "")); } catch { throw new Error("Respons AI terpotong atau bukan JSON. Naikkan batas output di Pengaturan lalu coba lagi."); }
    await patch({ status: "selesai", error: null, content: { script: c.script, arahan_teknis: c.arahan_teknis, paket_publikasi: c.paket_publikasi, asumsi: c.asumsi, model: `${provider}:${model}` } });
  } catch (e) {
    await patch({ status: "gagal", error: String(e.message || e).slice(0, 300) }).catch(() => {});
  }
};
