// Spesifikasi output naskah produksi (shooting script) bergaya film profesional.
// Dipakai bersama oleh generate-script-background.js dan generate-draft-background.js.
// Format keluaran: markdown ringan, dirender app sebagai dokumen bergaya PDF naskah produksi.

const FILM_STANDARD = `STANDAR PRODUKSI (wajib):
Tulis seperti dokumen produksi film pendek profesional yang bisa langsung dipakai kru kecil di lokasi tanpa bertanya lagi. Lengkap, spesifik, dan bisa dieksekusi, bukan deskripsi umum.
- Setiap shot punya: nomor, rentang waktu (m:ss–m:ss), ukuran shot (Wide, MS, CU, insert), nomor setup kamera, aksi visual, dialog, suara, dan transisi keluar.
- Rentang waktu shot harus berurutan tanpa celah dan total persis sama dengan durasi di Lembar Informasi. Insert yang menumpuk pada shot lain harus dinyatakan "mengganti sebagian durasi, bukan menambah".
- Dialog: kecepatan wajar sekitar 2–3 kata per detik. Hitung muatan tiap shot supaya muat di durasinya. Frame pertama langsung beraksi atau berdialog.
- Aksi hanya hal yang terlihat atau terdengar kamera. Jangan menulis pikiran batin tokoh. Emosi ditunjukkan lewat aksi, properti, jeda, dan nada, bukan dijelaskan.
- Konsistensi: aturan 180 derajat, posisi kiri/kanan frame tiap tokoh, properti di tangan mana, wardrobe, level minuman, dan kondisi cahaya harus sama dari shot ke shot dan dicatat di Checklist Kontinuitas.
- Komposisi vertikal 9:16: sisakan ruang kosong untuk caption dan jauhkan wajah dan aksi penting dari zona UI Instagram (bagian bawah sekitar 20 persen dan tepi kanan).
- Jenis potongan ditulis jelas (hard cut, L-cut, J-cut, match on action) dan jeda hening yang sengaja dipertahankan disebut.
- Suara: tentukan ambient yang dijaga, room tone, mic, target loudness. Musik hanya bila ada di data, dan harus berlisensi atau bebas royalti.
- Spesifikasi teknis nyata untuk smartphone dan tripod: resolusi, fps, shutter, ISO maksimum, white balance (Kelvin), kunci AE/AF, tanpa digital zoom, serta arah, suhu warna, dan fungsi cahaya (key, fill, praktikal).
- Rencana syuting berurutan dari setup paling efisien, jumlah take per setup, room tone, dan estimasi waktu total.
- Beri alternatif bila alat atau lokasi terbatas (tanpa mic clip-on, tanpa lampu tambahan, tanpa tripod, satu kamera, lokasi cadangan).
- Konten komersial (afiliasi, endorse, kerja sama) hanya jika ada di data. Bila ada, tandai terang-terangan di dialog atau caption, jangan menyebut nilai komisi atau klaim yang tidak bisa dibuktikan, dan jangan membacakan atau mengutip isi karya berhak cipta. Bila topik sensitif (misalnya depresi), tambahkan peringatan singkat di caption.
- Jangan mengarang fakta. Nomor episode, angka, nama tempat, dan detail yang tidak ada di data ditulis "belum ditentukan" dan dicatat di asumsi. Angka atau lelucon yang hanya properti dialog dicatat sebagai bukan fakta.`;

const FILM_FORMAT = `FORMAT TEKS (ikuti persis, markdown ringan):
- "# " untuk judul dokumen, "## " untuk bagian bernomor, "### " untuk judul shot.
- "- " untuk poin. Teks tebal dengan **tebal**, miring dengan *miring*. Garis pemisah antar shot dengan baris "---".
- Dialog satu baris per ucapan dengan pola: NAMA (ekspresi atau nada) kalimat. NAMA huruf kapital, ekspresi dalam kurung boleh dihilangkan. Contoh: YUSUF (ceria, heboh) Weh, Vin! Ditolak lagi!
- Judul shot memakai pola: ### SHOT 1 · 0:00–0:04 · MS two-shot · Setup A. Insert memakai: ### INSERT 3A · 0:10.8–0:12.3 · CU layar HP · Setup E.
- Judul adegan memakai pola: **SCENE 1. EXT. LOKASI — MALAM**.
- Jangan memakai tabel, blok kode, atau emoji.`;

const FILM_OUT = `${FILM_STANDARD}

${FILM_FORMAT}

Keluarkan JSON dengan 4 kunci bertipe string. Isi tiap kunci adalah teks berformat di atas. Penomoran bagian dimulai dari 1 di dalam tiap kunci.

"script" berisi:
# Judul Episode
*Naskah Produksi (Shooting Script) · Serial Reels @kevin_k.w · Episode N, lanjutan Episode sebelumnya jika ada*
## 1. Lembar Informasi
Poin: Format (rasio, resolusi, jenis konten), Durasi, Tokoh, Lokasi (INT/EXT, tempat, waktu), Gaya visual, Musik, Konten komersial. Lalu paragraf **Logline:** dan **Inti cerita:** (konflik, apa yang sengaja tidak ada seperti pidato atau kesimpulan moral).
## 2. Tokoh, Wardrobe, dan Properti
Satu paragraf per tokoh diawali **NAMA** — cara bicara, kebiasaan fisik, panggilan antar tokoh, wardrobe lengkap. Lalu **Properti:** dengan poin tiap benda beserta kondisi dan hal yang harus terbaca atau tidak boleh terbaca kamera.
## 3. Naskah Adegan
Judul adegan, paragraf kondisi awal (cahaya, suara lokasi, posisi tokoh, benda di tangan), **Ringkasan waktu:** berupa poin daftar semua shot dengan rentang waktu dan ukuran. Lalu tiap shot: judul shot, satu baris tekanan atau tujuan shot bila perlu, aksi, dialog, poin "Suara:" dan "Transisi keluar:", lalu "---". Akhiri dengan instruksi tahan akhir dan larangan (misalnya tanpa teks, tanpa musik, tanpa kesimpulan moral) bila relevan. Struktur cerita (hook, konflik, eskalasi, payoff, ending) harus terbaca dari urutan shot, tanpa label struktur di dalam naskah.

"arahan_teknis" berisi bagian:
## 1. Lokasi dan Blocking (denah teks sederhana, posisi tokoh kiri atau kanan frame, garis 180 derajat, tinggi dan jarak kamera, ruang kosong, zona UI Instagram)
## 2. Spesifikasi Teknis (**Kamera:**, **Cahaya:**, **Suara:** masing-masing dengan poin)
## 3. Rencana Syuting (urutan setup bernomor, jumlah take, room tone, estimasi waktu)
## 4. Panduan Editing, Suara, dan Warna (jenis tiap potongan, jeda yang dipertahankan, mixing dan target LUFS, color grading, tanpa atau dengan efek dan teks)
## 5. Checklist Kontinuitas (poin yang bisa dicentang kru)
## 6. Alternatif Bila Alat Terbatas

"paket_publikasi" berisi:
## 1. Judul atau Opening Text (3 alternatif)
## 2. Caption (siap tempel)
## 3. Kepatuhan (penandaan afiliasi atau kerja sama bila ada, peringatan konten sensitif, hal yang tidak boleh disebut)
## 4. Cover, Kata Kunci, Hashtag, dan Komentar (teks cover, kata kunci, hashtag seperlunya, komentar natural untuk dipancing bukan engagement bait)
## 5. Hipotesis Performa (hal yang diuji, ditulis sebagai hipotesis)

"asumsi": daftar asumsi dan hal yang belum ditentukan, satu poin "- " per baris.`;

module.exports = { FILM_OUT, FILM_STANDARD, FILM_FORMAT };
