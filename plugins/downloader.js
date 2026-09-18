import axios from "axios";
import * as cheerio from "cheerio";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";

export const command = ["ttdl", "tiktok", "tt", "gethtml", "ig", "igdl", "instagram", "fb", "fbdl", "facebook"];

async function tiktok2(query) {
    const encodedParams = new URLSearchParams();
    encodedParams.set("url", query);
    encodedParams.set("hd", "1");
    const response = await axios({
        method: "POST", url: "https://tikwm.com/api/",
        headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8", Cookie: "current_language=en", "User-Agent": "Mozilla/5.0" },
        data: encodedParams,
    });
    return { no_watermark: response.data.data.play };
}

export default async function (m, { riz, reply, qriz, id, q, cmd, reactm }) {
    switch (cmd) {
        case "ttdl": case "tiktok": case "tt": {
            if (!q) return reply("⚠ *Mana Link Tiktoknya?*");
            await reactm("⏳️");
            try {
                const { no_watermark } = await tiktok2(q);
                await riz.sendMessage(id, { video: { url: no_watermark }, caption: "Nih ✨" }, { quoted: qriz });
                await reactm("✅️");
            } catch (err1) {
                try {
                    const { data } = await axios.get(`https://chocomilk.amira.us.kg/v1/download/tiktok?url=${encodeURIComponent(q)}`);
                    await riz.sendMessage(id, { video: { url: data.data.media.video }, caption: "Nih ✨" }, { quoted: qriz });
                    await reactm("✅️");
                } catch (err2) {
                    await reactm("❌️");
                    reply("❌ Gagal download video TikTok");
                }
            }
            break;
        }
        case "gethtml": {
            if (!q || !/^https?:\/\//i.test(q)) return reply("❌ Contoh:\n.gethtml https://example.com");
            try {
                await reactm("⏳");
                const res = await fetch(q, { headers: { "User-Agent": "Mozilla/5.0 (gethtml-bot)" } });
                const html = await res.text();
                const tmpDir = path.join(process.cwd(), "tmp");
                if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);
                const filePath = path.join(tmpDir, `html_${Date.now()}.html`);
                fs.writeFileSync(filePath, html);
                await riz.sendMessage(id, { document: fs.readFileSync(filePath), mimetype: "text/html", fileName: "source.html" }, { quoted: qriz });
                fs.unlinkSync(filePath);
                await reactm("✅");
            } catch (err) { await reactm("❌"); reply("❌ Error\n" + err.message); }
            break;
        }
        case "ig": case "igdl": case "instagram": {
            if (!q) return reply("❌ Masukkan URL Instagram");
            try {
                await reactm("⏳");
                let medias = [];
                try {
                    const form = new URLSearchParams({ q, vt: "home" });
                    const { data } = await axios.post("https://yt5s.io/api/ajaxSearch", form, { headers: { "X-Requested-With": "XMLHttpRequest" } });
                    const $ = cheerio.load(data.data);
                    const video = $('a[title="Download Video"]').attr("href");
                    const image = $("img").attr("src");
                    if (video) medias.push({ type: "video", url: video });
                    else if (image) medias.push({ type: "image", url: image });
                } catch (e) {
                    const { data } = await axios.get(`https://api.yupra.my.id/api/downloader/Instagram?url=${encodeURIComponent(q)}`);
                    medias = data.result.medias.map(v => ({ type: v.type, url: v.url }));
                }
                const videos = medias.filter(v => v.type === "video");
                const images = medias.filter(v => v.type === "image");
                if (videos.length > 0) {
                    await riz.sendMessage(id, { video: { url: videos[0].url }, caption: "✅ IG Video" }, { quoted: qriz });
                } else if (images.length > 0) {
                    for (const img of images) await riz.sendMessage(id, { image: { url: img.url } }, { quoted: qriz });
                }
                await reactm("✅");
            } catch (err) { await reactm("❌"); reply("❌ Gagal download Instagram"); }
            break;
        }
        case "fb": case "fbdl": case "facebook": {
            if (!q) return reply("❌ Masukkan URL Facebook");
            try {
                await reactm("⏳");
                const { data } = await axios.post("https://yt5s.io/api/ajaxSearch", new URLSearchParams({ q, vt: "home" }), { headers: { "X-Requested-With": "XMLHttpRequest" } });
                const $ = cheerio.load(data.data);
                const thumb = $("img").attr("src");
                const link = $("table tbody tr").first().find("a.download-link-fb").attr("href");
                if (link) await riz.sendMessage(id, { video: { url: link }, caption: "✅ FB Video" }, { quoted: qriz });
                else if (thumb) await riz.sendMessage(id, { image: { url: thumb }, caption: "✅ FB Image" }, { quoted: qriz });
                await reactm("✅");
            } catch (e) { await reactm("❌"); reply("❌ Gagal download Facebook"); }
            break;
        }
    }
}
