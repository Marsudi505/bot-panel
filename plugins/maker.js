import { downloadContentFromMessage } from "@whiskeysockets/baileys";
import { Sticker, StickerTypes } from "wa-sticker-formatter";
import sharp from "sharp";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import axios from "axios";
import FormData from "form-data";
import fetch from "node-fetch";

export const command = ["s", "sticker", "stiker", "tovn", "toimg", "removebg", "rbg", "qc", "quote", "bratvid"];

export default async function (m, { riz, reply, qriz, id, msg, q, cmd, reactm, pushname, sender }) {
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage || msg.message;
    
    switch (cmd) {
        case "s": case "sticker": case "stiker": {
            try {
                const typeKey = Object.keys(quoted).find(k => ["imageMessage", "videoMessage", "stickerMessage"].includes(k));
                if (!typeKey) return reply("❌ Reply gambar/video");
                await reactm("⏳");
                const stream = await downloadContentFromMessage(quoted[typeKey], typeKey.replace("Message", ""));
                let buf = Buffer.from([]);
                for await (const chunk of stream) buf = Buffer.concat([buf, chunk]);
                const sticker = new Sticker(buf, { pack: "INDICA PROJECT", author: pushname, type: StickerTypes.FULL, quality: 40 });
                await riz.sendMessage(id, await sticker.toMessage(), { quoted: qriz });
                await reactm("✅");
            } catch (e) { await reactm("❌"); reply("❌ Gagal bikin stiker\n" + e.message); }
            break;
        }
        case "bratvid": {
            if (!q) return reply('⚠️ Contoh: .bratvid Lu napa dah');
            try {
                await reactm("⏳");
                const res = await fetch(`https://www.sankavollerei.com/imagecreator/bratvideo?apikey=planaai&text=${encodeURIComponent(q)}`);
                const buffer = Buffer.from(await res.arrayBuffer());
                const sticker = new Sticker(buffer, { pack: '', author: '', type: StickerTypes.FULL, quality: 60, fps: 30 });
                await riz.sendMessage(id, await sticker.toMessage(), { quoted: qriz });
                await reactm("✅");
            } catch (e) { await reactm("❌"); reply(`🍂 Ups error: ${e.message}`); }
            break;
        }
        case "toimg": {
            try {
                const isSticker = quoted?.stickerMessage;
                if (!isSticker) return reply("❌ Reply stickernya bang 🫡");
                await reactm("⏳");
                const stream = await downloadContentFromMessage(quoted.stickerMessage, "sticker");
                let buffer = Buffer.from([]);
                for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
                const imgBuffer = await sharp(buffer).jpeg().toBuffer();
                await riz.sendMessage(id, { image: imgBuffer, caption: "Nih jadi gambar 📸" }, { quoted: qriz });
                await reactm("✅");
            } catch (err) { await reactm("❌"); reply("❌ Gagal convert sticker"); }
            break;
        }
        case "tovn": {
            try {
                if (!quoted?.audioMessage) return reply("⚠️ Balas audio dulu ya!");
                await reactm("⏳");
                const stream = await downloadContentFromMessage(quoted.audioMessage, "audio");
                let buffer = Buffer.from([]);
                for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
                const tempDir = path.resolve("./temp");
                if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
                const audioPath = path.join(tempDir, `in_${Date.now()}.mp3`);
                const opusPath = path.join(tempDir, `out_${Date.now()}.opus`);
                fs.writeFileSync(audioPath, buffer);
                await new Promise((resolve, reject) => {
                    const ffmpeg = spawn("ffmpeg", ["-i", audioPath, "-c:a", "libopus", "-b:a", "128k", "-vbr", "on", "-application", "voip", "-f", "opus", "-y", opusPath]);
                    ffmpeg.on("close", code => code === 0 ? resolve() : reject());
                });
                await riz.sendMessage(id, { audio: fs.readFileSync(opusPath), mimetype: "audio/ogg; codecs=opus", ptt: true }, { quoted: qriz });
                fs.unlinkSync(audioPath); fs.unlinkSync(opusPath);
                await reactm("✅");
            } catch (err) { await reactm("❌"); reply("⚠️ Gagal ubah ke VN"); }
            break;
        }
        case "removebg": case "rbg": {
            if (!quoted?.imageMessage) return reply("❌ Yang direply harus gambar");
            try {
                await reactm("⏳");
                const stream = await downloadContentFromMessage(quoted.imageMessage, "image");
                let buffer = Buffer.from([]);
                for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
                const form = new FormData();
                form.append("image", buffer.toString("base64"));
                const upload = await axios.post("https://api.imgbb.com/1/upload?key=dd5af36e89dc5e42d2c10ad563be2f2b", form, { headers: form.getHeaders() });
                const result = await axios.get(`https://api.nexray.eu.cc/tools/removebg?url=${encodeURIComponent(upload.data.data.url)}`, { responseType: "arraybuffer" });
                await riz.sendMessage(id, { image: Buffer.from(result.data), caption: "✅ Background terhapus" }, { quoted: qriz });
                await reactm("✅");
            } catch (err) { await reactm("❌"); reply("❌ Gagal menghapus background"); }
            break;
        }
        case "qc": case "quote": {
            if (!q) return reply("❌ Contoh:\n.qc Halo dunia");
            try {
                await reactm("⏳");
                let ppUrl = "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png";
                try { ppUrl = await riz.profilePictureUrl(sender, "image"); } catch {}
                const payload = { type: "quote", format: "png", backgroundColor: "#ffffff", width: 512, height: 768, scale: 2, messages: [{ entities: [], avatar: true, from: { id: 1, name: pushname, photo: { url: ppUrl } }, text: q, replyMessage: {} }] };
                const res = await axios.post("https://bot.lyo.su/quote/generate", payload, { headers: { "Content-Type": "application/json" } });
                const sticker = new Sticker(Buffer.from(res.data.result.image, "base64"), { type: StickerTypes.FULL, quality: 60 });
                await riz.sendMessage(id, await sticker.toMessage(), { quoted: qriz });
                await reactm("✅");
            } catch (err) { await reactm("❌"); reply("❌ Gagal membuat quote"); }
            break;
        }
    }
}
