import fs from "fs";
import path from "path";
import generateStrukPdf from "../lib/strukMaker.js";
import { Button, Carousel } from "../lib/nixcode.js";

export const command = ["addlist", "dellist", "list", "proses", "done"];

const dbFolder = path.resolve("./database");
if (!fs.existsSync(dbFolder)) fs.mkdirSync(dbFolder, { recursive: true });
const fileProduk = path.join(dbFolder, "produk.json");
const fileTracking = path.join(dbFolder, "tracking.json");
const fileCounter = path.join(dbFolder, "counter.json"); 

function readDB(file) {
    if (!fs.existsSync(file)) return {};
    try { return JSON.parse(fs.readFileSync(file, 'utf-8')); } catch { return {}; }
}
function writeDB(file, data) { fs.writeFileSync(file, JSON.stringify(data, null, 2)); }

export default async function (m, { riz, reply, qriz, id, q, cmd, reactm, sender, pushname, msg }) {
    
    // --- 1. COMMAND: .addlist ---
    if (cmd === "addlist") {
        const parts = q.split("|").map(s => s.trim());
        if (parts.length < 3) return reply("⚠️ Format salah!\nContoh: `.addlist PV1 | Prime Video 1 Bulan | 17000 | Akun Private`");
        
        const kode = parts[0].toUpperCase();
        const namaProduk = parts[1];
        const hargaProduk = parseInt(parts[2].replace(/[^0-9]/g, ''));
        const descProduk = parts[3] || "";

        if (isNaN(hargaProduk)) return reply("⚠️ Harga harus berupa angka valid.");

        const dbProduk = readDB(fileProduk);
        dbProduk[kode] = { nama: namaProduk, harga: hargaProduk, desc: descProduk };
        writeDB(fileProduk, dbProduk);

        await reactm("✅");
        return reply(`✅ *BERHASIL*\nProduk \`${kode}\` telah disimpan.\n\nNama: ${namaProduk}\nHarga: Rp ${hargaProduk.toLocaleString("id-ID")}`);
    }

    // --- 2. COMMAND: .dellist ---
    if (cmd === "dellist") {
        if (!q) return reply("⚠️ Masukkan kode yang ingin dihapus. Contoh: `.dellist PV1`");
        const kode = q.toUpperCase();
        const dbProduk = readDB(fileProduk);
        
        if (!dbProduk[kode]) return reply(`⚠️ Produk \`${kode}\` tidak ditemukan.`);
        delete dbProduk[kode];
        writeDB(fileProduk, dbProduk);
        
        await reactm("✅");
        return reply(`🗑️ *BERHASIL*\nProduk \`${kode}\` telah dihapus dari database.`);
    }

    // --- 3. COMMAND: .list (CAROUSEL QRIS) ---
    if (cmd === "list") {
        const dbProduk = readDB(fileProduk);
        const keys = Object.keys(dbProduk);
        if (keys.length === 0) return reply("📂 Database produk masih kosong.");

        await reactm("⏳");

        try {
            // Teks Header Carousel Sesuai Revisi
            const textHeader = "KATALOG INDC\nSilahkan geser kartu dibawah ini untuk melihat daftar produk, bayar qris di bawah sesuai nominal lalu kirim screenshot sambil tag admin\nPesanan akan segera di proses\n© INDC PROJECT";
            
            const katalogCarousel = new Carousel(riz).setBody(textHeader);
            const cards = [];
            
            // ⚠️ GANTI LINK DI BAWAH INI DENGAN LINK QRIS ANDA (HARUS .jpg / .png) ⚠️
            const linkQris = "https://cdn.yupra.my.id/yp/scmmohbl.jpg"; 

            for (let i = 0; i < keys.length; i++) {
                const k = keys[i];
                const p = dbProduk[k];

                const kartu = new Button(riz)
                    .setImage(linkQris) 
                    .setTitle(`[ ${k} ] - ${p.nama}`) 
                    .setBody(`💵 *Harga:* Rp ${p.harga.toLocaleString("id-ID")}\n\n📝 ${p.desc}`)
                    .addCopy("🛒 Beli Sekarang", `.done ${k} 1`); 
                
                cards.push(await kartu.toCard());
            }

            katalogCarousel.addCard(cards);
            await katalogCarousel.send(id, { quoted: qriz });
            
            await reactm("✅");

        } catch (err) {
            console.error("CAROUSEL ERROR:", err);
            await reactm("❌");
            reply("❌ Gagal memaparkan katalog interaktif: " + err.message);
        }
        return;
    }

    // --- 4. COMMAND: .proses (KHUSUS ADMIN) ---
    if (cmd === "proses") {
        // 🔒 Sistem Keamanan: Validasi Admin Grup
        const isGroup = id.endsWith('@g.us');
        if (!isGroup) return reply("⚠️ Perintah ini hanya bisa digunakan di dalam Grup.");
        
        const groupMetadata = await riz.groupMetadata(id).catch(() => ({}));
        const isAdmin = (groupMetadata.participants || []).some(p => p.id === sender && (p.admin === 'admin' || p.admin === 'superadmin'));
        const botNumber = (riz.user?.id || "").split(":")[0] + "@s.whatsapp.net";
        const isOwner = sender.includes("6285790374090") || msg.key?.fromMe || sender === botNumber;
        
        if (!isAdmin && !isOwner) return reply("❌ Akses ditolak! Perintah ini hanya untuk Admin Grup.");
        // ------------------------------------------

        const ctx = msg.message?.extendedTextMessage?.contextInfo;
        const target = ctx?.participant || ctx?.remoteJid;
        
        if (!target) return reply("⚠️ Kamu harus mereply pesan Customer untuk memproses order.");

        const dbTrack = readDB(fileTracking);
        const startTime = Date.now();
        const dateStr = new Date(startTime).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });

        dbTrack[target] = { start: startTime, admin: sender, adminName: pushname, dateStr };
        writeDB(fileTracking, dbTrack);

        const txt = `🔄 *ORDER IN PROCESS*\n\n📅 Started: ${dateStr}\n👤 Customer: @${target.split('@')[0]}\n🛠️ Processed by: @${sender.split('@')[0]}\n\n_Status: Processing..._`;
        
        await reactm("⏳");
        return await riz.sendMessage(id, { text: txt, mentions: [target, sender] }, { quoted: qriz });
    }

    // --- 5. COMMAND: .done (KHUSUS ADMIN) ---
    if (cmd === "done") {
        // 🔒 Sistem Keamanan: Validasi Admin Grup
        const isGroup = id.endsWith('@g.us');
        if (!isGroup) return reply("⚠️ Perintah ini hanya bisa digunakan di dalam Grup.");
        
        const groupMetadata = await riz.groupMetadata(id).catch(() => ({}));
        const isAdmin = (groupMetadata.participants || []).some(p => p.id === sender && (p.admin === 'admin' || p.admin === 'superadmin'));
        const botNumber = (riz.user?.id || "").split(":")[0] + "@s.whatsapp.net";
        const isOwner = sender.includes("6285790374090") || msg.key?.fromMe || sender === botNumber;
        
        if (!isAdmin && !isOwner) return reply("❌ Akses ditolak! Perintah ini hanya untuk Admin Grup.");
        // ------------------------------------------

        const ctx = msg.message?.extendedTextMessage?.contextInfo;
        const target = ctx?.participant || ctx?.remoteJid;
        
        if (!target) return reply("⚠️ Kamu harus mereply pesan Customer yang sudah selesai dikerjakan.");

        const dbTrack = readDB(fileTracking);
        const trackData = dbTrack[target];
        if (!trackData) return reply("⚠️ Customer ini belum diproses, atau ordernya sudah selesai.\nSilakan gunakan `.proses` dulu.");

        const args = q.split(" ");
        const kode = args[0]?.toUpperCase();
        const qty = parseInt(args[1]) || 1;

        if (!kode) return reply("⚠️ Kamu lupa memasukkan kode produk.\nFormat: `.done PV1 1` (kode qty)");

        const dbProduk = readDB(fileProduk);
        const produk = dbProduk[kode];
        if (!produk) return reply(`⚠️ Kode \`${kode}\` belum terdaftar di database.\nKetik \`.list\` untuk melihat katalog.`);

        await reactm("⏳");

        const diffMs = Date.now() - trackData.start;
        const diffMins = Math.floor(diffMs / 60000);
        const diffSecs = Math.floor((diffMs % 60000) / 1000);
        const duration = diffMins > 0 ? `${diffMins} minutes` : `${diffSecs} seconds`;

        const dbCounter = readDB(fileCounter);
        if (!dbCounter.lastNumber) dbCounter.lastNumber = 0; 
        dbCounter.lastNumber += 1; 
        writeDB(fileCounter, dbCounter);

        const nomorStrukUrut = `No.${dbCounter.lastNumber.toString().padStart(4, '0')}`;

        const strukData = {
            toko: { 
                nama: "PT INDICA PROJECT", 
                alamat: "Jl. Dr. Ir. H. Soekarno No.19, Medokan Semampir", 
                kota: "Surabaya", 
                telp: "081234567890" 
            },
            kasir: pushname || "Admin",
            pelanggan: target.split('@')[0], 
            nomorStruk: nomorStrukUrut, 
            items: [
                { nama: produk.nama, qty: qty, satuan: "", harga: produk.harga }
            ],
            bayar: produk.harga * qty,
            metodeBayar: "Qris / Transfer"
        };

        try {
            const pdfPath = await generateStrukPdf(strukData);
            
            const txt = `✅ *ORDER COMPLETED*\n\n📅 Started: ${trackData.dateStr}\n⏱️ Duration: ${duration}\n👤 Customer: @${target.split('@')[0]}\n🛠️ Processed by: @${sender.split('@')[0]}\n\n_Status: Completed_`;

            await riz.sendMessage(id, { 
                document: fs.readFileSync(pdfPath), 
                mimetype: "application/pdf", 
                fileName: `Struk_${target.split('@')[0]}_${Date.now().toString().slice(-4)}.pdf`, 
                caption: txt,
                mentions: [target, sender]
            }, { quoted: qriz });

            delete dbTrack[target];
            writeDB(fileTracking, dbTrack);

            if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);

            await reactm("✅");

        } catch (err) {
            console.error("STRUK GEN ERROR:", err);
            await reactm("❌");
            reply("❌ Gagal membuat struk kasir: " + err.message);
        }
    }
}
