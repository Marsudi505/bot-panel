import fs from "fs";
import path from "path";
import { downloadContentFromMessage } from "@whiskeysockets/baileys";
import createBackupZip from "../lib/backupMaker.js"; // <--- Import fungsi backup

export const command = ["upload", "savefile"];

export default async function (m, { riz, reply, qriz, id, q, msg, senderNum, reactm }) {
    if (senderNum !== "6285790374090") return reply("❌ Akses ditolak! Hanya Owner yang bisa menggunakan fitur ini.");

    const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!quotedMsg) return reply("⚠️ Reply sebuah file Document (js/json/txt) dengan perintah ini.");

    const mediaType = Object.keys(quotedMsg).find(type => ["documentMessage"].includes(type));
    if (!mediaType) return reply("⚠️ Yang direply harus berupa *Document*.");

    if (!q) return reply("⚠️ Masukkan lokasi dan nama file penyimpanan.\n\nContoh:\n`.upload plugins/fiturbaru.js`\n`.upload case.js`");

    await reactm("⏳");

    try {
        const stream = await downloadContentFromMessage(quotedMsg[mediaType], "document");
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }

        const savePath = path.resolve(q);
        const dirName = path.dirname(savePath);

        if (!fs.existsSync(dirName)) {
            fs.mkdirSync(dirName, { recursive: true });
        }

        fs.writeFileSync(savePath, buffer);

        // 1. Notifikasi Upload Sukses
        await reply(`✅ *UPLOAD BERHASIL*\nFile tersimpan di: \`${savePath}\`\n\n_Sedang menyiapkan Auto-Backup server Anda..._`);

        // 2. Proses Auto-Backup
        const zipPath = await createBackupZip();
        
        // 3. Mengirim Dokumen Auto-Backup ke WA
        await riz.sendMessage(id, {
            document: fs.readFileSync(zipPath),
            mimetype: "application/zip",
            fileName: `AutoBackup_${Date.now().toString().slice(-4)}.zip`,
            caption: "📦 *AUTO BACKUP SYSTEM*\nBerikut adalah backup terbaru sistem Anda setelah terjadi pembaruan (upload) file."
        }, { quoted: qriz });

        // 4. Hapus file zip sementara
        if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

        await reactm("✅");

    } catch (err) {
        console.error("UPLOAD/BACKUP ERROR:", err);
        await reactm("❌");
        reply(`❌ Terjadi kesalahan: ${err.message}`);
    }
}
