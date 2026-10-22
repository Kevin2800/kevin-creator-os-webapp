// Background function: ide (3 pilihan), script lengkap, dan revisi lewat chat. Hasil ditulis ke tabel drafts.
const SB = "https://tjvcqdfglgfpwsokybje.supabase.co";
const KEY = "sb_publishable_evtnCN1u9KHLVIa2Bh5dsg_v9TLsWvx"; // kunci publik by design
const clean = (o) => Object.fromEntries(Object.entries(o || {}).filter(([k, v]) => v && !["id", "project_id", "created_at", "updated_at"].includes(k)));

const BASE = `Kamu adalah creative director, penulis naskah, dan sutradara serial Instagram Reels (vertikal 9:16) berbahasa Indonesia untuk akun @kevin_k.w.
Aturan:
- Pakai HANYA data di bawah. Jangan mengarang karakter, fakta, atau episode. Jika informasi penting tidak ada, tulis "belum ditentukan" dan catat sebagai asumsi.
- Dialog natural, bahasa percakapan Indonesia sesuai gaya bicara tiap karakter. Hindari pidato motivasi dan penjelasan emosi yang sudah terlihat dari aksi.
- Jangan membocorkan rahasia karakter sebelum waktunya. Jaga konsistensi dengan profil karakter, Brand DNA, dan episode sebelumnya. Jangan ulangi konflik tanpa perkembangan baru.
- Hook harus dibayar oleh isi cerita (bukan clickbait). Tidak semua episode harus cliffhanger.
- Produksi realistis (smartphone, tripod, mikrofon, lampu sederhana); beri alternatif bila alat terbatas. Musik hanya yang berlisensi atau bebas royalti.
- Jangan menyalin karya kreator lain.
- Jika ada PEMBELAJARAN dari analisis performa, terapkan yang relevan dan jelaskan singkat pengaruhnya: pada tugas ide, sebutkan di kunci "alasan" tiap ide; pada tugas script, tambahkan baris berawalan "Pembelajaran dipakai:" di kunci "asumsi". Perlakukan pembelajaran berstatus hipotesis sebagai uji coba, bukan kepastian.`;

const IDEAS = `TUGAS: usulkan TEPAT 3 ide episode yang berbeda (variasi konflik, hook, dan ending) untuk tokoh terpilih. Jangan hanya mengejar yang paling viral; pertimbangkan konsistensi serial dan identitas brand.
Keluarkan JSON {"ideas":[...]} berisi 3 objek. Tiap objek punya kunci string: judul, premis, tema, target_audiens, masalah, karakter, konflik, hook, alur, ending, hubungan_episode_lalu, tujuan_awareness, potensi_produksi, alasan; dan kunci "skor" berisi angka 1-10 untuk: relevansi_audiens, kekuatan_hook, potensi_retensi, shareability, orisinalitas, konsistensi_karakter, kesesuaian_brand, kemudahan_produksi. Skor hanya estimasi AI, bukan prediksi performa.`;

const OUT = `Keluarkan JSON dengan 4 kunci string:
"script": ringkasan produksi singkat (logline, durasi, karakter, lokasi), struktur (hook, konflik, setup, eskalasi, payoff, ending), lalu dialog lengkap. Tiap adegan memakai baris berlabel: TIMESTAMP, LOKASI, SHOT, AKSI, KARAKTER, DIALOG, EKSPRESI, PAUSE, AUDIO, CATATAN SUTRADARA.
"arahan_teknis": shot list (nomor, timestamp, ukuran shot, sudut, posisi dan gerak kamera, blocking, durasi, pencahayaan, audio, transisi), frame rate dan shutter speed, exposure dan white balance, penempatan kamera, arah cahaya, komposisi 9:16, alternatif shot, rencana editing (ritme, subtitle, sound design, color grading, frame pembuka dan penutup).
"paket_publikasi": 3 alternatif judul atau opening text, caption, CTA natural, teks cover, kata kunci, hashtag seperlunya, komentar natural untuk dipancing (bukan engagement bait), hipotesis performa.
"asumsi": daftar asumsi dan hal yang belum ditentukan, satu per baris.
Gunakan teks biasa tanpa tanda markdown.`;
const SCRIPT = `TUGAS: tulis script episode lengkap dari hook sampai ending berdasarkan ide yang sudah disetujui pengguna (ikuti idenya, jangan diganti).\n${OUT}`;
const REVISE = `TUGAS: revisi script saat ini sesuai instruksi pengguna. Ubah hanya yang diminta dan pertahankan bagian lain. Tetap patuhi aturan di atas.\n${OUT}`;

const { generate } = require("../lib/ai.js");

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
    const { text: raw, provider, model } = await generate(st, Math.max(st?.max_output_tokens || 0, mode === "ideas" ? 6000 : 12000), prompt);
    if (!raw) throw new Error("AI tidak mengembalikan teks.");
    let c; try { c = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, "")); } catch { throw new Error("Respons AI terpotong atau bukan JSON. Naikkan batas output di Pengaturan lalu coba lagi."); }
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
