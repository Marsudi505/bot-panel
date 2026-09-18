import { downloadContentFromMessage } from "@whiskeysockets/baileys";
import fetch from "node-fetch";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { sendInteractiveMessage } = require('baileys_helper');

export const command = ["upswgc", "ss", "screenshot", "skrinsut", "webss", "ssweb", "listgc", "gclist", "tagall", "h", "ht", "cekid", "cekidgc", "cekidch", "cekidid", "jid", "ceklid", "lid"];

export default async function (m, { riz, reply, qriz, id, msg, q, cmd, reactm, isGroup, isAdmin, sender }) {
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    
    switch (cmd) {
        case "upswgc": {
            if (!isGroup || !isAdmin) return reply("Admin & Group Only");
            try {
                await reactm("⏳");
                const payload = quoted ? { groupStatusMessageV2: { message: quoted } } : { groupStatusMessageV2: { message: { conversation: q } } };
                await riz.relayMessage(id, payload, {});
                await reactm("✅");
            } catch (e) { await reactm("❌"); reply("Gagal kirim swgc"); }
            break;
        }
        case "tagall": case "h": case "ht": {
            if (!isGroup || !isAdmin) return reply("⚠️ Admin Grup Only!");
            await reactm("⏳");
            const groupMetadata = await riz.groupMetadata(id);
            const mentions = groupMetadata.participants.map(p => p.id);
            let teks = q || "*Tag All*";
            if (quoted?.conversation) teks = quoted.conversation;
            await riz.sendMessage(id, { text: teks.trim(), mentions }, { quoted: qriz });
            await reactm("✅");
            break;
        }
        case "listgc": case "gclist": {
            await reactm("⏳");
            const groups = Object.values(await riz.groupFetchAllParticipating());
            let teks = `📋 LIST GROUP BOT\n\n`;
            for (let i = 0; i < groups.length; i++) teks += `*${i + 1}. ${groups[i].subject}*\n👥 Member: ${groups[i].size}\n🆔 ID: ${groups[i].id}\n\n`;
            await reply(teks); await reactm("✅");
            break;
        }
        case "cekid": case "cekidgc": case "cekidch": {
            if (!q) return reply("*Masukkan link grup/channel*");
            try {
                const url = new URL(q.trim());
                const isGroup = url.hostname === "chat.whatsapp.com" && !!url.pathname.match(/^\/[A-Za-z0-9]{20,}$/);
                const isChannel = (url.hostname === "whatsapp.com" || url.hostname === "www.whatsapp.com") && url.pathname.startsWith("/channel/");
                if (!isGroup && !isChannel) return reply("*Link tidak valid*");
                
                let res, targetId, targetName, memberCount, createdStr = "tidak diketahui";
                if (isGroup) {
                    const code = url.pathname.replace(/^\/+/, "");
                    res = await riz.groupGetInviteInfo(code);
                    targetId = res.id || res.groupId;
                    targetName = res.subject || "(tidak diketahui)";
                    memberCount = res.size || res.participantCount || "tidak diketahui";
                    if (res.creation) {
                        const ts = res.creation < 1e12 ? res.creation * 1000 : res.creation;
                        createdStr = new Date(ts).toLocaleString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
                    }
                } else {
                    const code = url.pathname.split("/channel/")[1]?.split("/")[0];
                    if (!code) return reply("*Tidak dapat menemukan kode channel*");
                    res = await riz.newsletterMetadata("invite", code, "GUEST");
                    targetId = res.id;
                    targetName = res?.name || "(tidak diketahui)";
                    memberCount = res?.subscriberCount || "tidak diketahui";
                    if (res?.creationTime) {
                        const ts = res.creationTime < 1e12 ? res.creationTime * 1000 : res.creationTime;
                        createdStr = new Date(ts).toLocaleString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
                    }
                }
                reply(`📋 *INFORMASI GRUP*\n\n👥 *Nama:* ${targetName}\n🆔 *ID:* ${targetId}\n👨‍👩‍👧‍👦 *Anggota:* ${memberCount}\n📅 *Dibuat:* ${createdStr}`);
            } catch (err) { reply("Gagal cek ID: " + (err.message || "error")); }
            break;
        }
        case "cekidid": case "jid": {
            const targetJid = msg.message?.extendedTextMessage?.contextInfo?.participant || sender;
            reply(`📋 Target JID:\n\n${targetJid}`);
            break;
        }
        case "ceklid": case "lid": {
            if (!isGroup) return;
            const targetJid = msg.message?.extendedTextMessage?.contextInfo?.participant || sender;
            const participants = (await riz.groupMetadata(id)).participants || [];
            const p = participants.find(x => x.id === targetJid);
            if (p?.lid) reply(`📋 Target LID:\n${p.lid}\n\n📌 JID:\n${targetJid}`);
            else reply("❌ LID tidak ditemukan");
            break;
        }
        case "ss": case "ssweb": {
            if (!q) return reply("Contoh: .ss google.com");
            let url = q.split(" ")[0];
            if (!/^https?:\/\//i.test(url)) url = "https://" + url;
            await reactm("⏳");
            try {
                const res = await fetch(`https://image.thum.io/get/width/1920/crop/1080/${url}`);
                const buffer = Buffer.from(await res.arrayBuffer());
                await riz.sendMessage(id, { image: buffer, caption: "✅ Screenshot" }, { quoted: qriz });
                await reactm("✅");
            } catch (err) { await reactm("❌"); reply("Gagal screenshot"); }
            break;
        }
    }
}
