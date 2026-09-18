import fetch from "node-fetch";
import config from "../config.js";

export const command = ["gist", "tosite"];

// FIX: Menghapus 'msg' dari parameter dan menggunakan 'm' secara langsung
export default async function (m, { riz, id, q, sender, reply, reactm }) {
    
    // 1. PENGAMANAN OWNER
    const isOwner = sender.includes("6285xxxxx090"); 
    if (!isOwner) return reply("❌ Akses ditolak! Ini adalah fitur khusus Owner.");

    // 2. TOKEN GITHUB
    const TOKEN = config.GITHUB_TOKEN; 

    if (!TOKEN || TOKEN === "MASUKKAN_TOKEN_ANDA_DISINI") {
        return reply("⚠️ Token GitHub Gist belum diisi di dalam file plugin gist.js!");
    }

    // 3. DETEKSI INPUT (Menggunakan 'm.message' bukan 'msg.message')
    const ctx = m.message?.extendedTextMessage?.contextInfo;
    const quotedMsg = ctx?.quotedMessage;
    
    let contentToUpload = "";
    let filename = `script_${Date.now()}.js`; 

    if (quotedMsg) {
        contentToUpload = quotedMsg.conversation || quotedMsg.extendedTextMessage?.text || quotedMsg.imageMessage?.caption || "";
        if (!contentToUpload) return reply("⚠️ Fitur ini hanya untuk teks/kode, bukan file media atau dokumen fisik.");
    } else {
        contentToUpload = q;
    }

    if (!contentToUpload) {
        return reply("⚠️ Teks kosong!\n\nKetik langsung: `.gist console.log('halo');`\nAtau reply pesan kode orang lain dengan `.gist`");
    }

    await reactm("⏳");

    // 4. PROSES UPLOAD KE GITHUB
    try {
        const res = await fetch("https://api.github.com/gists", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${TOKEN}`,
                Accept: "application/vnd.github+json",
                "Content-Type": "application/json",
                "X-GitHub-Api-Version": "2022-11-28",
            },
            body: JSON.stringify({
                description: "Backup via INDICA PROJECT",
                public: false, 
                files: {
                    [filename]: { content: contentToUpload }
                },
            }),
        });

        const data = await res.json().catch(() => null);
        
        if (!res.ok) {
            await reactm("❌");
            return reply(`❌ Gagal upload: ${data?.message || res.status}`);
        }

        await reactm("✅");
        
        // 5. OUTPUT BALASAN
        let teksBalasan = `✅ *Gist Berhasil Dibuat!*\n\n`;
        teksBalasan += `🔗 *URL:* ${data.html_url}\n`;
        teksBalasan += `🆔 *ID:* \`${data.id}\`\n\n`;
        teksBalasan += `*📂 Raw Link (Mentahan):*\n`;
        
        for (const [name, fileObj] of Object.entries(data.files || {})) {
            teksBalasan += `👉 ${fileObj.raw_url}\n`;
        }

        return reply(teksBalasan);

    } catch (e) {
        await reactm("❌");
        return reply(`❌ Terjadi error internal: ${e.message}`);
    }
}
