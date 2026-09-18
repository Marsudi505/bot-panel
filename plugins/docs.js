import fs from "fs";
import path from "path";
import { downloadContentFromMessage } from "@whiskeysockets/baileys";

// Mendaftarkan semua kata kunci percakapan agar terdeteksi oleh sistem
export const command = ["docs", "tambah", "hapus", "tampil", "y", "n", "simpan"];

// Inisialisasi Database & Folder Penyimpanan
const dbFolder = path.resolve("./database");
const docsFolder = path.join(dbFolder, "docs_files");
if (!fs.existsSync(docsFolder)) fs.mkdirSync(docsFolder, { recursive: true });
const fileDocs = path.join(dbFolder, "docs_record.json");

function readDB() {
    if (!fs.existsSync(fileDocs)) return [];
    try { return JSON.parse(fs.readFileSync(fileDocs, 'utf-8')); } catch { return []; }
}
function writeDB(data) { fs.writeFileSync(fileDocs, JSON.stringify(data, null, 2)); }

// Memori Sesi (Session Tracking) untuk sistem Tanya Jawab
global.docsSession = global.docsSession || {};

export default async function (m, { riz, reply, qriz, id, q, cmd, reactm, sender, msg }) {
    
    // 🔒 Keamanan: Fitur ini MUTLAK hanya untuk Owner
    const isOwner = sender === "6285790374090@s.whatsapp.net" || sender.includes("6285790374090");
    if (!isOwner) {
        if (["docs", "tambah", "hapus", "tampil", "y", "n", "simpan"].includes(cmd)) {
            return reply("❌ Akses ditolak! Area ini khusus Developer/Owner.");
        }
        return;
    }

    const db = readDB();
    const session = global.docsSession[sender];

    // ==========================================
    // 1. MENU UTAMA (!docs / .docs)
    // ==========================================
    if (cmd === "docs") {
        delete global.docsSession[sender]; // Reset sesi jika ada yang menggantung
        
        let txt = "📚 *KNOWLEDGE BASE (DOKUMENTASI)*\n\n";
        if (db.length === 0) {
            txt += "_Belum ada dokumentasi yang tersimpan._\n\n";
        } else {
            db.forEach((doc, i) => {
                txt += `*${i + 1}. ${doc.judul}*\n`;
                txt += `   └ 📝 ${doc.keterangan}\n`;
                txt += `   └ 📁 Tipe: ${doc.tipe}\n`;
                txt += `   └ 🕒 ${doc.waktu}\n\n`;
            });
        }
        txt += "━━━━━━━━━━━━━━━━━━\n";
        txt += "*MENU INTERAKTIF:*\n";
        txt += "Balas pesan ini dengan mengetik:\n";
        txt += "👉 *.tambah* (Untuk menambah doc)\n";
        txt += "👉 *.hapus* (Untuk menghapus doc)\n";
        txt += "👉 *.tampil* (Untuk melihat isi doc)";
        
        return reply(txt);
    }

    // ==========================================
    // 2. ALUR TAMBAH DOKUMEN
    // ==========================================
    if (cmd === "tambah") {
        global.docsSession[sender] = { step: "WAITING_FILE_OR_TEXT" };
        return reply("📥 *MODE TAMBAH DOKUMEN*\n\nSilakan kirimkan *File* (js/json/txt) ATAU ketik *Teks biasa* dengan awalan *.simpan*\n\n_Contoh (Teks):_\n`.simpan Ini adalah script koneksi database...`\n\n_Contoh (File):_\nKirim sebuah file Document, lalu beri caption/reply filenya dengan ketik: `.simpan`");
    }

    // Eksekutor Penyimpanan (Menerima input dari mode Tambah)
    if (cmd === "simpan") {
        
        // Fase B: Menerima Judul dan Keterangan (Penyelesaian)
        if (session && session.step === "WAITING_TITLE") {
            const parts = q.split("|").map(s => s.trim());
            if (parts.length < 2) return reply("⚠️ Format salah! Gunakan format:\n`.simpan judul | keterangan`");

            const timeNow = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
            
            db.push({
                judul: parts[0],
                keterangan: parts[1],
                tipe: session.tipe,
                waktu: timeNow,
                isi: session.content 
            });
            writeDB(db);

            delete global.docsSession[sender]; 
            return reply(`🎉 *Berhasil!*\n\nDokumentasi *${parts[0]}* telah disimpan ke server pada ${timeNow}.\n\nKetik *.docs* untuk melihat daftar terbaru.`);
        }

        // Fase A: Menerima File / Teks Mentah
        if (!session || session.step !== "WAITING_FILE_OR_TEXT") {
            return reply("⚠️ Sesi tidak valid. Ketik *.tambah* terlebih dahulu.");
        }

        await reactm("⏳");
        
        const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const mediaType = quotedMsg ? Object.keys(quotedMsg).find(type => ["documentMessage", "imageMessage", "videoMessage"].includes(type)) : Object.keys(msg.message).find(type => ["documentMessage", "imageMessage", "videoMessage"].includes(type));
        const targetMedia = quotedMsg ? quotedMsg[mediaType] : msg.message[mediaType];

        if (targetMedia) {
            // PROSES JIKA INPUTANNYA FILE
            const fileName = targetMedia.fileName || `file_${Date.now()}`;
            const stream = await downloadContentFromMessage(targetMedia, mediaType.replace("Message", ""));
            let fileBuffer = Buffer.from([]);
            for await (const chunk of stream) {
                fileBuffer = Buffer.concat([fileBuffer, chunk]);
            }
            const savePath = path.join(docsFolder, fileName);
            fs.writeFileSync(savePath, fileBuffer);
            
            global.docsSession[sender] = { step: "WAITING_TITLE", tipe: "File", content: fileName };
            await reactm("✅");
            return reply("✅ *File Tersimpan di Server!*\n\nSekarang, masukkan Judul dan Keterangan dengan membalas pesan ini.\n\n*Format:* `.simpan judul | keterangan`\nContoh: `.simpan config.js | Pengaturan utama server`");
        
        } else if (q) {
            // PROSES JIKA INPUTANNYA TEKS
            global.docsSession[sender] = { step: "WAITING_TITLE", tipe: "Teks", content: q };
            await reactm("✅");
            return reply("✅ *Teks Dokumentasi Tersimpan!*\n\nSekarang, masukkan Judul dan Keterangan dengan membalas pesan ini.\n\n*Format:* `.simpan judul | keterangan`\nContoh: `.simpan Catatan API | Kumpulan link untuk bot`");
        
        } else {
            await reactm("❌");
            return reply("⚠️ Kirimkan file dengan caption `.simpan` atau ketik teks dengan awalan `.simpan`.");
        }
    }


    // ==========================================
    // 3. ALUR HAPUS DOKUMEN
    // ==========================================
    if (cmd === "hapus") {
        if (!q) {
            return reply("🗑️ *MODE HAPUS DOKUMEN*\n\nSilakan tentukan nomor file yang ingin dihapus (bisa dicek di menu *.docs*).\n\nKetik: `.hapus [nomor]`\nContoh: `.hapus 2`");
        }

        const index = parseInt(q) - 1;
        if (isNaN(index) || index < 0 || index >= db.length) return reply(`⚠️ Nomor urut tidak valid. Pilih antara 1 sampai ${db.length}.`);

        const targetDoc = db[index];
        global.docsSession[sender] = { step: "WAITING_CONFIRM_DEL", indexToDelete: index, docInfo: targetDoc };

        return reply(`⚠️ *KONFIRMASI HAPUS*\n\nYakin ingin menghapus dokumentasi ini?\n\nJudul: ${targetDoc.judul}\nKet: ${targetDoc.keterangan}\n\nBalas dengan *.y* untuk menghapus permanen, atau *.n* untuk membatalkan.`);
    }

    if (cmd === "y") {
        if (!session || session.step !== "WAITING_CONFIRM_DEL") return reply("⚠️ Tidak ada proses penghapusan yang tertunda.");

        const doc = session.docInfo;
        if (doc.tipe === "File") {
            const filePath = path.join(docsFolder, doc.isi);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath); // Hapus file fisik dari panel
        }

        db.splice(session.indexToDelete, 1);
        writeDB(db);
        delete global.docsSession[sender];

        return reply(`🗑️ *Selesai!*\nDokumentasi *${doc.judul}* telah berhasil dihapus hingga ke akar server.`);
    }

    if (cmd === "n") {
        if (!session || session.step !== "WAITING_CONFIRM_DEL") return reply("⚠️ Tidak ada proses penghapusan yang tertunda.");
        delete global.docsSession[sender];
        return reply("✅ *Dibatalkan.* Data Anda aman dan tidak jadi dihapus.");
    }


    // ==========================================
    // 4. ALUR TAMPIL DOKUMEN
    // ==========================================
    if (cmd === "tampil") {
        if (!q) return reply("👁️ *MODE TAMPIL DOKUMEN*\n\nSilakan masukkan nomor dokumen yang ingin dilihat (cek di *.docs*).\n\nKetik: `.tampil [nomor]`\nContoh: `.tampil 1`");
        
        const index = parseInt(q) - 1;
        if (isNaN(index) || index < 0 || index >= db.length) return reply(`⚠️ Nomor tidak valid. Pilih antara 1 sampai ${db.length}.`);

        const doc = db[index];
        await reactm("⏳");

        if (doc.tipe === "Teks") {
            const txt = `📄 *${doc.judul}*\n🕒 _${doc.waktu}_\n\n*Keterangan:* ${doc.keterangan}\n\n*Isi Dokumentasi:*\n\`\`\`${doc.isi}\`\`\``;
            await reply(txt);
            await reactm("✅");
            
        } else if (doc.tipe === "File") {
            const filePath = path.join(docsFolder, doc.isi);
            if (!fs.existsSync(filePath)) {
                await reactm("❌");
                return reply("❌ File fisik tidak ditemukan di Pterodactyl! Kemungkinan file telah terhapus secara manual dari panel.");
            }

            const ext = path.extname(doc.isi).toLowerCase();
            let mime = "application/octet-stream"; // Default fallback
            if (ext === ".js") mime = "application/javascript";
            else if (ext === ".json") mime = "application/json";
            else if (ext === ".txt") mime = "text/plain";

            const captionInfo = `📄 *${doc.judul}*\n🕒 _${doc.waktu}_\n\n*Keterangan:* ${doc.keterangan}\n\n_File terlampir di atas_ ☝️`;

            await riz.sendMessage(id, {
                document: fs.readFileSync(filePath),
                mimetype: mime,
                fileName: doc.isi,
                caption: captionInfo
            }, { quoted: qriz });
            
            await reactm("✅");
        }
    }
}
