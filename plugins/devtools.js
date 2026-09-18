import fs from "fs";
import path from "path";

export const command = ["listplugin", "getplugin", "listcase", "getcase"];

// FIX: Menggunakan 'cmd' (bukan command) dan menangkap 'sender'
export default async function (m, { riz, id, q, sender, cmd, reply, reactm }) {
    
    // FIX: Validasi Owner manual menggunakan nomor Anda
    const botNumber = (riz.user?.id || "").split(":")[0] + "@s.whatsapp.net";
    const isDeveloper = sender.includes("6285xxxxx090") || m.key.fromMe || sender === botNumber; 
    if (!isDeveloper) return reply("❌ Akses ditolak! Ini adalah fitur khusus Developer.");

    switch (cmd) { // FIX: Menggunakan switch(cmd)
        // ==========================================
        // FITUR 1: Melihat daftar semua plugin
        // ==========================================
        case "listplugin": {
            await reactm("⏳");
            try {
                const pluginDirs = ["./plugins", "./plugin"];
                const activeDir = pluginDirs.find(d => fs.existsSync(d));
                if (!activeDir) return reply("❌ Folder plugin tidak ditemukan di server.");

                const files = fs.readdirSync(activeDir).filter(f => f.endsWith('.js'));
                if (files.length === 0) return reply("📂 Tidak ada file plugin yang ditemukan.");

                let teks = `*📚 DAFTAR PLUGIN (${files.length} File)*\n\n`;
                files.forEach((f, i) => {
                    teks += `*${i + 1}.* ${f}\n`;
                });
                teks += `\n_👉 Ketik .getplugin <nama_file> untuk mengambil isinya._`;
                
                await reactm("✅");
                return reply(teks);
            } catch (e) {
                await reactm("❌");
                return reply(`❌ Error: ${e.message}`);
            }
        }

        // ==========================================
        // FITUR 2: Mengambil isi file plugin
        // ==========================================
        case "getplugin": {
            if (!q) return reply("⚠️ Masukkan nama plugin!\nContoh: *.getplugin gist.js*");
            await reactm("⏳");
            try {
                let filename = q.trim();
                if (!filename.endsWith(".js")) filename += ".js"; 

                const pluginDirs = ["./plugins", "./plugin"];
                const activeDir = pluginDirs.find(d => fs.existsSync(d));
                if (!activeDir) return reply("❌ Folder plugin tidak ditemukan.");

                const filePath = path.join(activeDir, filename);
                if (!fs.existsSync(filePath)) return reply(`❌ Plugin *${filename}* tidak ditemukan di folder!`);

                const content = fs.readFileSync(filePath, "utf-8");
                
                await reactm("✅");
                await riz.sendMessage(id, {
                    document: Buffer.from(content, "utf-8"),
                    fileName: filename,
                    mimetype: "application/javascript",
                    caption: `✅ Ini adalah isi script dari plugin *${filename}*`
                }, { quoted: m });
                
            } catch (e) {
                await reactm("❌");
                return reply(`❌ Error: ${e.message}`);
            }
            break;
        }

        // ==========================================
        // FITUR 3: Melihat fungsi apa saja di case.js
        // ==========================================
        case "listcase": {
            await reactm("⏳");
            try {
                const casePath = path.resolve("./case.js");
                if (!fs.existsSync(casePath)) return reply("❌ File case.js tidak ditemukan di direktori utama!");

                const content = fs.readFileSync(casePath, "utf-8");
                const matches = [...content.matchAll(/case\s+["']([^"']+)["']\s*:/g)];
                
                if (matches.length === 0) return reply("📂 Tidak ada fungsi 'case' manual yang ditemukan di case.js.");

                let teks = `*📚 DAFTAR FUNGSI DI CASE.JS (${matches.length})*\n\n`;
                matches.forEach((match, i) => {
                    teks += `*${i + 1}.* ${match[1]}\n`;
                });
                teks += `\n_👉 Ketik .getcase <nama_case> untuk mengambil isinya._`;
                
                await reactm("✅");
                return reply(teks);
            } catch (e) {
                await reactm("❌");
                return reply(`❌ Error: ${e.message}`);
            }
        }

        // ==========================================
        // FITUR 4: Mengambil isi spesifik sebuah case
        // ==========================================
        case "getcase": {
            if (!q) return reply("⚠️ Masukkan nama case!\nContoh: *.getcase tourl*");
            await reactm("⏳");
            try {
                const casePath = path.resolve("./case.js");
                if (!fs.existsSync(casePath)) return reply("❌ File case.js tidak ditemukan!");

                const content = fs.readFileSync(casePath, "utf-8");
                const targetCase = q.trim();
                
                const regex = new RegExp(`case\\s+["']${targetCase}["']\\s*:`);
                const match = content.match(regex);

                if (!match) return reply(`❌ Fitur *${targetCase}* tidak ditemukan di dalam file case.js!`);

                const startIndex = match.index;
                const afterCase = content.slice(startIndex);
                
                let hasil = afterCase.split(/\n\s*break;?/)[0] + "\nbreak;";

                await reactm("✅");
                await riz.sendMessage(id, {
                    text: `\`\`\`javascript\n${hasil}\n\`\`\``
                }, { quoted: m });

            } catch (e) {
                await reactm("❌");
                return reply(`❌ Error: ${e.message}`);
            }
            break;
        }
    }
}
