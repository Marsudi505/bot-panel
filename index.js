import { connectToWhatsApp } from "./connection.js";
import { getContentType, jidNormalizedUser } from "@whiskeysockets/baileys";
import chalk from "chalk";
import axios from "axios";
import fs from "fs";
import os from "os";
import { execSync } from "child_process";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const Jimp = require("jimp");
const bwipjs = require("bwip-js");

import config from './config.js';

global.botMode = "self";

const OWNER_NUMBER = "6285xxxxx090";
const BOT_START_TIME = Date.now();

// Fungsi untuk mengecek daftar allowed users
function getAllowedUsers() {
    try {
        if (!fs.existsSync('./allowed_users.json')) return [];
        return JSON.parse(fs.readFileSync('./allowed_users.json', 'utf-8'));
    } catch (e) { return []; }
}

async function generateBarcodeBuffer(number) {
    if (!number || number === "GAGAL_BACA") return null;
    try {
        // Generate barcode PNG buffer via bwipjs (hanya gambar barcode, tanpa teks)
        const barcodeBuffer = await bwipjs.toBuffer({
            bcid: 'code128', text: number, scale: 4, height: 20,
            includetext: false, backgroundcolor: 'FFFFFF', padding: 8
        });
        return barcodeBuffer;
    } catch (err) { return null; }
}

async function generateBarcodeWithLabel(number, label) {
    if (!number || number === "GAGAL_BACA") return null;
    const outputPath = `./temp_barcode_labeled_${Date.now()}.png`;
    const targetWidth = 1000;
    const barcodeHeight = 150;
    const labelHeight = 48;
    try {
        // Generate barcode with embedded text (includes label text under the barcode)
        const barcodeBuffer = await bwipjs.toBuffer({
            bcid: 'code128', text: number, scale: 4, height: 20,
            includetext: true, backgroundcolor: 'FFFFFF', padding: 8
        });
        const barcodeImg = await JimpModule.Jimp.read(barcodeBuffer);
        // Resize to target width max, keep aspect ratio for height
        const scaledHeight = Math.round(barcodeImg.getHeight() * (targetWidth / barcodeImg.getWidth()));
        const barcodeResized = barcodeImg.resize(targetWidth, scaledHeight);
        
        // Create canvas with extra space for label, center barcode horizontally
        const canvas = new JimpModule.Jimp(targetWidth, scaledHeight + labelHeight, 0xFFFFFFFF);
        canvas.composite(barcodeResized, 0, 0);
        
        // Add label text below barcode
        // Try module-level loadFont first
        let font = null;
        try { font = await JimpModule.loadFont(JimpModule.FONT_SANS_32_BLACK); } catch(e) {}
        if (font) {
            const textWidth = JimpModule.measureText(font, label);
            const textX = Math.max(0, (targetWidth - textWidth) / 2);
            canvas.print(font, textX, scaledHeight + 2, label);
        } else {
            // Fallback: write label text to separate image and composite
            const labelPath = `./temp_label_${Date.now()}.png`;
            const labelCmd = `convert -size ${targetWidth}x${labelHeight} xc:white -font DejaVu-Sans -pointsize 24 -fill black -gravity center -annotate +0+0 "${label}" "${labelPath}"`;
            try {
                execSync(labelCmd, { timeout: 10000 });
                const labelImg = await JimpModule.Jimp.read(labelPath);
                canvas.composite(labelImg, 0, scaledHeight);
                fs.unlinkSync(labelPath);
            } catch(e2) {
                // If font still fails, try without font
                try {
                    const fallbackCmd = `convert -size ${targetWidth}x${labelHeight} xc:white -pointsize 24 -fill black -gravity center -annotate +0+0 "${label}" "${labelPath}"`;
                    execSync(fallbackCmd, { timeout: 10000 });
                    const labelImg = await JimpModule.Jimp.read(labelPath);
                    canvas.composite(labelImg, 0, scaledHeight);
                    fs.unlinkSync(labelPath);
                } catch(e3) {}
            }
        }
        
        await canvas.writeAsync(outputPath);
        return outputPath;
    } catch (err) { return null; }
}

async function combineImages(productBuffer, barcodePath, outputPath) {
    const productPath = `./temp_product_${Date.now()}.png`;
    fs.writeFileSync(productPath, productBuffer);
    
    // Match bot-stok layout: product on top, barcode right below
    // Product: max 800x1000, centered horizontally at top
    // Barcode: max 800x300, centered horizontally, right below product with 15px gap
    const cmd = `convert -size 1000x1448 xc:white \
        \\( "${productPath}" -resize 800x1000\\> \\) -geometry +100+0 -composite \
        \\( "${barcodePath}" -resize 800x300 \\) -geometry +100+1015 -composite \
        "${outputPath}"`;
    
    try {
        execSync(cmd, { timeout: 30000 });
        fs.unlinkSync(productPath);
        return outputPath;
    } catch (e) {
        try { fs.unlinkSync(productPath); } catch(e2) {}
        return null;
    }
}

async function getSupabaseImage(plu) {
    try {
        const res = await axios.get(`${config.SUPABASE_URL}/rest/v1/Produk?plu=eq.${plu}&select=image_url`, {
            headers: { 'apikey': config.SUPABASE_KEY, 'Authorization': `Bearer ${config.SUPABASE_KEY}` },
            timeout: 5000
        });
        if (res.data && res.data.length > 0 && res.data[0].image_url) {
            return res.data[0].image_url;
        }
    } catch (e) { return null; } return null;
}

function formatUptime(ms) {
    let totalSeconds = Math.floor(ms / 1000);
    const days = Math.floor(totalSeconds / 86400); totalSeconds %= 86400;
    const hours = Math.floor(totalSeconds / 3600); totalSeconds %= 3600;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const parts = [];
    if (days) parts.push(`${days}h`);
    if (hours) parts.push(`${hours}j`);
    if (minutes) parts.push(`${minutes}m`);
    parts.push(`${seconds}s`);
    return parts.join(' ');
}

// Fungsi Progress Bar
async function startProgressBar(waInstance, jid, customText = "Memproses data...", msgQuoted = null) {
    let { key } = await waInstance.sendMessage(jid, { text: `[▒▒▒▒▒▒▒▒▒▒] 0% - ${customText}` }, { quoted: msgQuoted });
    let progress = 0;
    const interval = setInterval(async () => {
        progress += 10; if (progress > 90) progress = 90;
        let bar = "█".repeat(progress / 10) + "▒".repeat(10 - (progress / 10));
        try { await waInstance.sendMessage(jid, { text: `[${bar}] ${progress}% - ${customText}`, edit: key }); } catch (e) { clearInterval(interval); }
    }, 2000); return { interval, key };
}

console.log(chalk.cyan(`██╗███╗   ██╗██████╗ ██╗ ██████╗ █████╗ \n██║████╗  ██║██╔══██╗██║██╔════╝██╔══██╗\n██║██╔██╗ ██║██║  ██║██║██║     ███████║\n██║██║╚██╗██║██║  ██║██║██║     ██╔══██║\n██║██║ ╚████║██████╔╝██║╚██████╗██║  ██║\n╚═╝╚═╝  ╚═══╝╚═════╝ ╚═╝ ╚═════╝╚═╝  ╚═╝`));
console.log(chalk.green(`  STATUS: READY | MODE: LIGHTWEIGHT EDITION`));

// Callback untuk menangani perintah khusus yang tidak ada di case.js
async function myUpsertHandler(wa, msg, m) {
    try {
        const chatJid = msg.key.remoteJid;
        const isFromBotSelf = !!msg.key.fromMe;
        const botNumber = (wa.user?.id || "").split(":")[0].split("@")[0];
        const realSender = isFromBotSelf ? (wa.user?.id || chatJid) : (msg.key.participantAlt || msg.key.participantPn || msg.key.participant || msg.key.remoteJidAlt || msg.key.remoteJid);
        try { global.realSenderClean = jidNormalizedUser(realSender); } catch (e) { global.realSenderClean = realSender; }
        const userId = isFromBotSelf ? botNumber : (global.realSenderClean || realSender).split("@")[0];
        
        const type = getContentType(msg.message);
        let body = (type === "conversation") ? msg.message.conversation : (type === "extendedTextMessage") ? msg.message.extendedTextMessage.text : "";
        const text = body ? body.trim() : "";
        if (!text) return;

        const cmd = text.toLowerCase().split(" ")[0];
        const isOwnerUser = isFromBotSelf || userId === OWNER_NUMBER || userId === botNumber || realSender.startsWith(OWNER_NUMBER);

        // --- COMMAND KHUSUS ---

        if (cmd === "/restart" || cmd === ".restart" || cmd === "restart") {
            if (!isOwnerUser) return;
            await wa.sendMessage(chatJid, { text: "🔄 *RESTARTING BOT...*\nMohon tunggu beberapa saat." }, { quoted: msg });
            setTimeout(() => process.exit(0), 1000);
            return;
        }

        if (cmd === "/ping" || cmd === ".ping" || cmd === "ping") {
            const uptimeStr = formatUptime(Date.now() - BOT_START_TIME);
            const start = Date.now();
            await wa.sendMessage(chatJid, { text: "🏓 Pong!" }, { quoted: msg });
            const latency = Date.now() - start;

            const loadavg = os.loadavg().map(x => x.toFixed(2)).join(", ");
            const totalMem = (os.totalmem() / 1048576).toFixed(0);
            const freeMem = (os.freemem() / 1048576).toFixed(0);
            const usedMem = (totalMem - freeMem);
            const serverUptime = formatUptime(os.uptime() * 1000);

            let nodeVersion = "-";
            let pm2Status = "-";
            try {
                pm2Status = execSync("pm2 ls --no-color 2>/dev/null | grep -c online || echo 0", { timeout: 5000 }).toString().trim();
            } catch (e) {}

            return wa.sendMessage(chatJid, { text: `🏓 *PONG!*\n\n⏱️ Latency    : ${latency}ms\n⏳ Uptime     : ${uptimeStr}\n📡 Mode       : ${global.botMode.toUpperCase()}\n\n🖥 *SERVER*\n├ Uptime     : ${serverUptime}\n├ Load 1/5/15: ${loadavg}\n├ RAM        : ${usedMem}/${totalMem} MB\n├ PM2 Online : ${pm2Status} app\n└ Node       : ${process.version} (${process.platform}-${process.arch})` }, { quoted: msg });
        }

        if (cmd.startsWith("/plu") || cmd.startsWith(".plu")) {
            const rawArgs = text.split(" ").slice(1).filter(s => s.trim());
            if (rawArgs.length === 0) return wa.sendMessage(chatJid, { text: "⚠️ Format salah!\nGunakan: `/plu [nomor plu] [quantity]`\nBulk multiple: `/plu 20076768 5, 20076765`" }, { quoted: msg });
            
            // Parse args: each item can be "plu" or "plu qty", separated by comma
            const items = [];
            for (const chunk of rawArgs.join(" ").split(",")) {
                const parts = chunk.trim().split(/\s+/);
                const plu = parts[0];
                const qty = parts.length > 1 ? parseInt(parts[1]) : 1;
                if (plu) items.push({ plu, qty: isNaN(qty) ? 1 : Math.max(1, Math.min(999, qty)) });
            }
            
            if (items.length === 0) return wa.sendMessage(chatJid, { text: "⚠️ Tidak ada PLU yang valid." }, { quoted: msg });
            
            // React with shopping emoji on the command message
            try { await wa.sendMessage(chatJid, { react: { key: msg.key, text: "🛍️" } }); } catch (e) {}
            
            try {
                // Load barcode database from local file
                const barcodeData = JSON.parse(fs.readFileSync('/sdcard/Download/barcodesheet.json', 'utf8'));
                
                for (const { plu, qty } of items) {
                    try {
                        // Use Python helper for API call
                        const { execFile } = require('child_process');
                        const result = await new Promise((resolve, reject) => {
                            execFile('python3', ['/data/data/com.termux/files/home/bot-panel/plu_helper.py', plu, 'TTTT'], { timeout: 30000 }, (error, stdout, stderr) => {
                                if (error) return reject(error);
                                try { resolve(JSON.parse(stdout)); }
                                catch (e) { reject(new Error('Invalid JSON from helper')); }
                            });
                        });
                        
                        if (result.error) { await wa.sendMessage(chatJid, { text: `❌ PLU ${plu}: ${result.error}` }); continue; }
                        if (!result.ok) { await wa.sendMessage(chatJid, { text: `❌ PLU ${plu} tidak ditemukan.` }); continue; }
                        
                        // Find barcode from database
                        const barcodeItem = barcodeData.find(x => x.plu == plu || x.barcode === plu);
                        const barcodeNum = barcodeItem && barcodeItem.barcode ? barcodeItem.barcode : plu;

                        // For bulk: barcode value = "B" + code + zero-padded qty, display = "code | qty: N"
                        const barcodeValue = qty > 1 ? `B${barcodeNum}${String(qty).padStart(2, '0')}` : barcodeNum;
                        const barcodeLabel = qty > 1 ? `${barcodeNum} | qty: ${qty}` : barcodeNum;

                        // Generate barcode image buffer
                        const barcodeBuffer = await generateBarcodeBuffer(barcodeValue);

                        // Try to get product image
                        const cdnUrl = `https://cdn-klik.klikindomaret.com/klik-catalog/product/${result.plu}_1.jpg`;
                        let productBuffer = null;

                        try {
                            const imgResp = await axios.get(cdnUrl, { responseType: 'arraybuffer', timeout: 10000 });
                            productBuffer = Buffer.from(imgResp.data);
                        } catch (e) {
                            try {
                                const supaUrl = await getSupabaseImage(result.plu);
                                if (supaUrl) {
                                    const imgResp = await axios.get(supaUrl, { responseType: 'arraybuffer', timeout: 10000 });
                                    productBuffer = Buffer.from(imgResp.data);
                                }
                            } catch (e2) {}
                        }

                        // Build caption once
                        const price = result.price || 0;
                        const total = price * qty;
                        const promoText = result.promoText || result.promoType || 'Tidak ada promo untuk produk ini';
                        const qtyLine = qty > 1 ? `\n📦 Harga Rp ${price.toLocaleString('ID')} x ${qty} = Rp ${total.toLocaleString('ID')}` : '';
                        const caption = `🛍️ *${result.productName}*\n🔖 PLU: ${result.plu}\n💰 Harga: Rp ${price.toLocaleString('ID')}${qtyLine}\n🏷️ ${promoText}\n\nJangan lupa kunjungi klikidm.my.id`;

                        // Send product image first
                        if (productBuffer) {
                            const productPath = `./temp_product_${Date.now()}.png`;
                            fs.writeFileSync(productPath, productBuffer);
                            await wa.sendMessage(chatJid, { image: { url: productPath }, caption });
                            fs.unlinkSync(productPath);
                        }

                        // Send barcode image second (with label drawn on it via ImageMagick)
                        if (barcodeBuffer) {
                            const barcodePath = `./temp_barcode_${Date.now()}.png`;
                            fs.writeFileSync(barcodePath, barcodeBuffer);
                            
                            // Composite barcode (centered) + label below using ImageMagick
                            const finalBarcodePath = `./temp_barcode_final_${Date.now()}.png`;
                            // Use spawnSync to avoid shell escaping issues with \( and \>
                            const { spawnSync } = require('child_process');
                            const args = [
                                '-size', '1000x198', 'xc:white',
                                '\\(', barcodePath, '-resize', '800x150\\>', ')', '-gravity', 'center', '-geometry', '+0+0', '-composite',
                                '-fill', 'black', '-font', 'DejaVu-Sans', '-pointsize', '24', '-gravity', 'south', '-annotate', '+0+4', barcodeLabel,
                                finalBarcodePath
                            ];
                            try {
                                const res = spawnSync('convert', args, { timeout: 10000 });
                                if (res.status === 0) {
                                    await wa.sendMessage(chatJid, { image: { url: finalBarcodePath }, caption: `BARCODE: ${barcodeLabel}` });
                                    fs.unlinkSync(finalBarcodePath);
                                } else {
                                    await wa.sendMessage(chatJid, { image: { url: barcodePath }, caption: `BARCODE: ${barcodeLabel}` });
                                }
                            } catch(e) {
                                await wa.sendMessage(chatJid, { image: { url: barcodePath }, caption: `BARCODE: ${barcodeLabel}` });
                            }
                            fs.unlinkSync(barcodePath);
                        } else if (!productBuffer) {
                            await wa.sendMessage(chatJid, { text: caption });
                        }
                        
                    } catch (e) {
                        await wa.sendMessage(chatJid, { text: `❌ Error cek PLU ${plu}: ${e.message}` });
                    }
                }
            } catch (error) {
                await wa.sendMessage(chatJid, { text: "❌ Terjadi kesalahan API." });
            }
            return;
        }

        if (cmd.startsWith("/caritoko") || cmd.startsWith(".caritoko")) {
            const args = text.split(" ").slice(1).join(" ").trim().toUpperCase();
            if (!args) return wa.sendMessage(chatJid, { text: "⚠️ Format salah!\nGunakan: `/caritoko [kode/nama toko]`" }, { quoted: msg });
            const pbar = await startProgressBar(wa, chatJid, "Mencari data toko...", msg);
            try {
                const { data } = await axios.get("https://api.github.com/repos/Marsudi505/toko-idm/contents/toko.json", {
                    headers: { "Authorization": `Bearer ${config.GITHUB_TOKEN}`, "Accept": "application/vnd.github.v3.raw" }
                });
                const toko = data.find(x => (x.storeCode && x.storeCode.toUpperCase() === args) || (x.storeName && x.storeName.toUpperCase().includes(args)));
                clearInterval(pbar.interval);
                if (!toko) return wa.sendMessage(chatJid, { text: "❌ Toko tidak ditemukan.", edit: pbar.key });
                const jamBukaTutup = (toko.openingHour && toko.closingHour) ? `${toko.openingHour} - ${toko.closingHour}` : "-";
                const txtToko = `🏪 *Detail Toko*\n━━━━━━━━━━━━━━\n📦 KDTK  : ${toko.storeCode || "-"}\n🏪 TOKO  : ${toko.storeName || "-"}\n🏷️ TYPE  : ${toko.storeType || "-"}\n🏬 DC    : ${toko.dcCode || "-"}\n\n📍 ALAMAT :\n${toko.address || "-"}\n\n🕒 JAM BUKA : ${jamBukaTutup}\n🌐 KOORDINAT: ${toko.latitude}, ${toko.longitude}\n✅ STATUS   : ${toko.operational ? "Buka ✅" : "Tutup ❌"}\n\n📌 Maps: ${toko.googleMaps || "-"}`;
                await wa.sendMessage(chatJid, { text: txtToko, edit: pbar.key });
            } catch (error) { clearInterval(pbar.interval); await wa.sendMessage(chatJid, { text: "❌ Error API GitHub.", edit: pbar.key }); } return;
        }

    } catch (err) {
        console.error(err);
    }
}

connectToWhatsApp(myUpsertHandler);
