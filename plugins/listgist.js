import fetch from "node-fetch";
import config from "../config.js";

export const command = ["listgist", "gists"];

export default async function (m, { riz, id, q, sender, reply, reactm }) {
    
    // 1. PENGAMANAN OWNER
    const isOwner = sender.includes("6285xxxxx090"); 
    if (!isOwner) return reply("❌ Akses ditolak! Ini fitur khusus Owner.");

    // 2. TOKEN GITHUB
    // Token yang Anda berikan sudah dipasang di sini
    const TOKEN = config.GITHUB_TOKEN; 

    await reactm("⏳");

    try {
        // Mengambil data dari API GitHub (Limit maksimal per halaman adalah 100 Gist)
        const res = await fetch("https://api.github.com/gists?per_page=100", {
            method: "GET",
            headers: {
                Authorization: `Bearer ${TOKEN}`,
                Accept: "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            }
        });

        const data = await res.json();

        if (!res.ok) {
            await reactm("❌");
            return reply(`❌ Gagal mengambil data: ${data?.message || res.status}`);
        }

        if (data.length === 0) {
            await reactm("✅");
            return reply("📂 Akun GitHub Anda belum memiliki Gist sama sekali.");
        }

        // ==========================================
        // MODE 1: TAMPILKAN DAFTAR SEMUA GIST
        // ==========================================
        if (!q) {
            let teksBalasan = `📚 *DAFTAR SEMUA GIST (${data.length} Gist)*\n\n`;

            data.forEach((gist, index) => {
                // Mengambil nama file pertama sebagai judul jika description kosong
                const firstFileName = Object.keys(gist.files)[0];
                const title = gist.description || firstFileName || "Tanpa Judul";
                
                teksBalasan += `*${index + 1}.* ${title}\n`;
            });

            teksBalasan += `\n━━━━━━━━━━━━━━━━━━\n`;
            teksBalasan += `_👉 Ketik *\.listgist <nomor>* untuk melihat detail & isi kodenya._\n`;
            teksBalasan += `_Contoh: .listgist 1_`;

            await reactm("✅");
            return reply(teksBalasan);
        }

        // ==========================================
        // MODE 2: TAMPILKAN DETAIL & ISI GIST
        // ==========================================
        const index = parseInt(q) - 1;
        if (isNaN(index) || index < 0 || index >= data.length) {
            await reactm("❌");
            return reply(`⚠️ Nomor urut tidak valid! Pilih antara 1 sampai ${data.length}.`);
        }

        const selectedGist = data[index];
        const gistId = selectedGist.id;

        // Fetch khusus ke ID Gist untuk mendapatkan ISI FILE secara utuh
        const detailRes = await fetch(`https://api.github.com/gists/${gistId}`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${TOKEN}`,
                Accept: "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            }
        });

        const detailData = await detailRes.json();

        if (!detailRes.ok) {
            await reactm("❌");
            return reply(`❌ Gagal mengambil detail Gist: ${detailData?.message || detailRes.status}`);
        }

        const firstFileName = Object.keys(detailData.files)[0];
        const title = detailData.description || firstFileName || "Tanpa Judul";
        const visibility = detailData.public ? "🌐 Public" : "🔒 Secret";
        const date = new Date(detailData.created_at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });

        let detailTeks = `📄 *DETAIL GIST*\n━━━━━━━━━━━━━━━━━━\n`;
        detailTeks += `*Judul:* ${title}\n`;
        detailTeks += `*Status:* ${visibility}\n`;
        detailTeks += `*Dibuat:* ${date} WIB\n`;
        detailTeks += `*Link Gist:* ${detailData.html_url}\n\n`;
        detailTeks += `*📂 ISI FILE:*\n`;

        // Menampilkan isi teks/kode dari masing-masing file di dalam Gist tersebut
        for (const [name, fileObj] of Object.entries(detailData.files || {})) {
            detailTeks += `\n*>> ${name}*\n`;
            
            let content = fileObj.content || "Isi tidak tersedia";
            
            // Pengaman agar WhatsApp tidak crash jika script terlalu panjang (>2000 karakter)
            if (content.length > 2000) {
                content = content.substring(0, 2000) + "\n\n... [Teks Terpotong Karena Terlalu Panjang. Buka Link Raw di bawah untuk melihat selengkapnya] ...";
            }
            
            detailTeks += `\`\`\`${content}\`\`\`\n`;
            detailTeks += `🔗 *Raw:* ${fileObj.raw_url}\n`;
        }

        await reactm("✅");
        return reply(detailTeks);

    } catch (e) {
        await reactm("❌");
        return reply(`❌ Terjadi error internal: ${e.message}`);
    }
}
