// Menyalin teks prompt dari netlify/lib ke index.html (untuk tombol "Salin prompt").
// Jalankan setiap kali netlify/lib/film-prompt.js atau draft-prompts.js diubah:  node scripts/sync-prompts.js
const fs = require("fs"), path = require("path");
const P = require("../netlify/lib/draft-prompts.js");
const f = path.join(__dirname, "..", "index.html");
let h = fs.readFileSync(f, "utf8");
const lit = (x) => JSON.stringify(x).replace(/<\//g, "<\\/").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
const block = `/*PROMPTS:START*/\nconst P_BASE=${lit(P.BASE)},P_IDEAS=${lit(P.IDEAS)},P_SCRIPT=${lit(P.SCRIPT)},P_REVISE=${lit(P.REVISE)};\n/*PROMPTS:END*/`;
const re = /\/\*PROMPTS:START\*\/[\s\S]*?\/\*PROMPTS:END\*\//;
if (!re.test(h)) throw new Error("Penanda PROMPTS tidak ditemukan di index.html");
h = h.replace(re, () => block);
fs.writeFileSync(f, h);
console.log("prompt tersinkron ke index.html");
