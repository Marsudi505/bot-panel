import fs from "fs";
import createBackupZip from "../lib/backupMaker.js";

export const command = ["backup"]; // Bisa dipanggil dengan !backup atau .backup

export default async function (m, { riz, reply, qriz, id, senderNum, reactm }) {
    // Keamanan: Hanya Owner (termasuk jika dikirim dari nomor bot sendiri)
    if (!m.key?.fromMe && senderNum !== "6285790374090") return reply("❌ Akses ditolak! Hanya Owner.");

    await reactm("⏳");
    try {
        await reply("⏳ Sedang memproses kompresi data panel... Mohon tunggu sebentar.");
        
        // Memanggil fungsi zip dari lib/backupMaker.js
        const zipPath = await createBackupZip();
        const now = new Date();
        const pad = (n) => String(n).padStart(2, "0");
        const tgl = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

        // Mengirimkan hasilnya ke WA
        await riz.sendMessage(id, {
            document: fs.readFileSync(zipPath),
            mimetype: "application/zip",
            fileName: `ManualBackup_${tgl}.zip`,
            caption: "📦 *MANUAL BACKUP SELESAI*\n\nSeluruh file panel Anda (kecuali node_modules & session_auth) telah berhasil dicadangkan dengan aman."
        }, { quoted: qriz });

        // Hapus file zip sementara di server setelah terkirim agar memori tidak penuh
        if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
        
        await reactm("✅");

    } catch (err) {
        console.error("BACKUP ERROR:", err);
        await reactm("❌");
        reply("❌ Gagal membuat backup: " + err.message);
    }
}
