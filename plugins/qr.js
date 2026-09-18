import { downloadContentFromMessage } from "@whiskeysockets/baileys";
import { Jimp } from "jimp"; // Import versi terbaru Jimp
import { createRequire } from "module";

// Menggunakan require untuk qrcode-reader agar tidak bentrok dengan sistem ESM Module Anda
const require = createRequire(import.meta.url);
const QrCode = require("qrcode-reader");

export const command = ["qr", "readqr", "scanqr"];

export default async function (m, { riz, id, msg, reply, reactm }) {
    try {
        // 1. Deteksi Media yang Fleksibel (Persis seperti fitur .tourl)
        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage || msg.message;
        
        const mediaType = Object.keys(quoted).find(t => ["imageMessage", "documentMessage"].includes(t));
        
        if (!mediaType) {
            return reply("❌ *Cara penggunaan:*\nKirim atau reply sebuah gambar QR Code dengan perintah *.qr*");
        }

        await reactm("⏳");

        // 2. Proses Unduh Gambar
        const stream = await downloadContentFromMessage(quoted[mediaType], mediaType.replace("Message", ""));
        
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }

        if (!buffer || buffer.length === 0) {
            await reactm("❌");
            return reply("❌ Gagal menyedot data gambar. Coba kirim ulang gambarnya.");
        }

        // 3. Membaca Buffer gambar menggunakan Jimp
        const image = await Jimp.read(buffer);
        const qr = new QrCode();

        // 4. Proses Scan dan Callback
        qr.callback = async (err, value) => {
            if (err) {
                await reactm("❌");
                return reply("⚠️ Gagal membaca QR Code.\nPastikan gambar QR Code terlihat jelas, fokus, dan tidak terpotong.");
            } else {
                await reactm("✅");
                return reply(`✅ *Hasil Scan QR Code:*\n\n${value.result}`);
            }
        };

        // Mulai memindai piksel gambar
        qr.decode(image.bitmap);

    } catch (error) {
        console.error("[QR SCANNER ERROR]", error);
        await reactm("❌");
        reply(`❌ Terjadi kesalahan internal: ${error.message}`);
    }
}
