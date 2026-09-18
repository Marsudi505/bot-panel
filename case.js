/**
 * 🧠 OTAK PERINTAH (CASE.JS) - INDICA PROJECT
 * Handler untuk semua perintah, fitur, dan sistem Plugin
 */

import { downloadContentFromMessage, getContentType, generateWAMessageFromContent, generateWAMessageContent, jidNormalizedUser, isJidGroup } from "@whiskeysockets/baileys";
import axios from "axios";
import crypto from "crypto";
import fetch from "node-fetch";
import * as cheerio from "cheerio";
import { createRequire } from "module";
import FormData from "form-data";
import util from "util"
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { Sticker, StickerTypes } from "wa-sticker-formatter";
import sharp from "sharp";
const require = createRequire(import.meta.url);
const { sendInteractiveMessage } = require('baileys_helper');

// Global config untuk fitur maker
global.pack = "INDICA Bot";
global.author = "Sudi Project";
global.footer = "© INDICA PROJECT est 2026";

// Global: daftar user yang sedang dalam mode Hermes
global.hermesUsers = global.hermesUsers || new Map();

// ─── Uploader Helpers (untuk .tourl) ───────────────────────────────
const imgbbApiKey = "dd5af36e89dc5e42d2c10ad563be2f2b";
const catboxUserhash = "1f7e3515ecabb90bf6c8892c5";

async function CatboxMoe(file) {
  const form = new FormData();
  form.append("reqtype", "fileupload");
  form.append("userhash", catboxUserhash);
  form.append("fileToUpload", fs.createReadStream(file));
  const res = await fetch("https://catbox.moe/user/api.php", {
    method: "POST",
    body: form,
    headers: { ...form.getHeaders(), "User-Agent": "Mozilla/5.0" }
  });
  const url = (await res.text()).trim();
  if (!res.ok || !/^https?:\/\/files\.catbox\.moe\//.test(url)) throw new Error(url || `HTTP ${res.status}`);
  return url;
}

async function YupraUploader(file) {
  const form = new FormData();
  form.append("files", fs.createReadStream(file));
  const res = await fetch("https://cdn.yupra.my.id/upload", {
    method: "POST",
    body: form,
    headers: form.getHeaders()
  });
  const json = await res.json();
  if (!res.ok || !json?.files?.[0]?.url) throw new Error("Yupra gagal");
  return { url: "https://cdn.yupra.my.id" + json.files[0].url };
}

async function upVidey(file) {
  const form = new FormData();
  form.append("file", fs.createReadStream(file));
  const res = await fetch("https://cdn.yupra.my.id/upload", {
    method: "POST",
    body: form,
    headers: form.getHeaders()
  });
  const json = await res.json();
  if (!res.ok || !json?.files?.[0]?.url) throw new Error("Videy gagal");
  return { cdn: "https://cdn.yupra.my.id" + json.files[0].url };
}

async function UguuUpload(file, name) {
  const form = new FormData();
  form.append("files[]", fs.createReadStream(file), name);
  const res = await fetch("https://api.uguu.se/upload", {
    method: "POST",
    body: form,
    headers: form.getHeaders()
  });
  const json = await res.json();
  if (!res.ok || !json?.files?.[0]?.url) throw new Error("Uguu gagal");
  return { url: json.files[0].url };
}

async function tiktok2(query) {
  try {
    const encodedParams = new URLSearchParams();
    encodedParams.set("url", query);
    encodedParams.set("hd", "1");

    const response = await axios({
      method: "POST",
      url: "https://tikwm.com/api/",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        Cookie: "current_language=en",
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36",
      },
      data: encodedParams,
    });

    const videos = response.data.data;

    return {
      title: videos.title,
      cover: videos.cover,
      origin_cover: videos.origin_cover,
      no_watermark: videos.play,
      watermark: videos.wmplay,
      music: videos.music,
    };
  } catch (error) {
    throw error;
  }
}

export default async function handleMessages(riz, msg, serM, rawM) {
    try {
        let rawMessage = msg.message;
        while (rawMessage?.ephemeralMessage?.message || rawMessage?.viewOnceMessage?.message) {
            rawMessage = rawMessage.ephemeralMessage?.message || rawMessage.viewOnceMessage?.message;
        }
        const type = Object.keys(rawMessage)[0];
        const body = (type === "conversation") ? rawMessage.conversation : (type === "extendedTextMessage") ? rawMessage.extendedTextMessage.text : (type === "imageMessage") ? (rawMessage.imageMessage.caption || "") : (type === "videoMessage") ? (rawMessage.videoMessage.caption || "") : "";
        const text = body ? body.trim() : '';
        const prefix = /^[\\/!#.]/gi.test(text) ? text.match(/^[\\/!#.]/gi)[0] : '/';
        const cmd = text.startsWith(prefix) ? text.replace(prefix, '').trim().split(/ +/).shift().toLowerCase() : '';
        const q = text.replace(new RegExp(`^${prefix}${cmd}`, 'i'), '').trim();   
        const id = msg.key.remoteJid;
        const isGroup = id.endsWith('@g.us');

        // ==== CLEAN JID: normalisasi LID → PN (Baileys 7) ====
        const CleanJid = (raw) => {
            try {
                return jidNormalizedUser(
                    raw?.key?.participantAlt ||
                    raw?.key?.participantPn ||
                    raw?.key?.participant ||
                    raw?.key?.remoteJidAlt ||
                    raw?.key?.remoteJid
                );
            } catch (e) { return raw || ""; }
        };
        const sender = (isGroup
            ? (msg.key.participantAlt || msg.key.participantPn || msg.key.participant || riz.user?.id)
            : (msg.key.participantAlt || msg.key.remoteJidAlt || id)
        ) || id;
        const senderClean = CleanJid({ key: { participantAlt: msg.key?.participantAlt, participantPn: msg.key?.participantPn, participant: msg.key?.participant, remoteJidAlt: msg.key?.remoteJidAlt, remoteJid: id } }) || jidNormalizedUser(sender);
        const pushname = msg.pushName || "User";
        const qriz = msg;
        const reply = async (teks) => { await riz.sendMessage(id, { text: teks }, { quoted: msg }); };
        const reactm = async (emoji) => { await riz.sendMessage(id, { react: { text: emoji, key: msg.key } }); };
        const m = { ...msg, Xp: async () => await reactm("⏳"), Xd: async () => await reactm("✅"), Xg: async () => await reactm("❌") };

        let isAdmin = false;
        if (isGroup) {
            const groupMetadata = await riz.groupMetadata(id).catch(() => ({}));
            const participants = groupMetadata.participants || [];
            const groupAdmins = participants.filter(v => v.admin !== null).map(v => v.id);
            isAdmin = groupAdmins.includes(jidNormalizedUser(msg.key.participant || msg.key.participantAlt));
        }
        
        const botNumber = (riz.user?.id || '').split(':')[0] + '@s.whatsapp.net';
        const owner = ["6285xxxxx090@s.whatsapp.net", botNumber];
        const isOwner = owner.includes(senderClean) || msg.key.fromMe;
        const senderNum = senderClean.split('@')[0];

if (isOwner) {
    try {

        // Alias eval: m = message serialized, sock = soket Baileys, conn = alias sock
        const m = serM || msg;
        const sock = riz;
        const conn = sock;

        if (body && body.startsWith("=>")) {
            console.log("⚙️ Async Eval Mode Active")

            let code = body.slice(2).trim()
            if (!code) return

            try {
                const evaled = await eval(`(async () => { ${code} })()`)

                const out =
                    typeof evaled === "undefined"
                        ? "✅ Kode dieksekusi tanpa output."
                        : typeof evaled === "string"
                        ? evaled
                        : util.inspect(evaled, { depth: 2 })

                return reply(out)
            } catch (err) {
                return reply("❌ Error Async Eval:\n" + err)
            }
        }

        if (body && body.startsWith(">")) {
            console.log("⚙️ Eval Mode Active")

            let code = body.replace(/^>+\s*/, "").trim()
            if (!code) return

            try {
                const evaled = eval(code)

                const out =
                    typeof evaled === "undefined"
                        ? "✅ Kode dieksekusi tanpa output."
                        : typeof evaled === "string"
                        ? evaled
                        : util.inspect(evaled, { depth: 2 })

                return reply(out)
            } catch (err) {
                return reply("❌ Error Eval:\n" + err)
            }
        }

        if (body && body.startsWith("$")) {
            console.log("💻 Exec Mode Active")

            let command = body.slice(1).trim()
            if (!command) return

            const { exec } = await import("child_process")

            const cleanOut = (txt) =>
                String(txt)
                    .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "")
                    .replace(/\r/g, "")
                    .split("\n")
                    .map((l) => l.replace(/\s+$/g, ""))
                    .filter((l, i, arr) => i === 0 || !(arr[i - 1] === "" && l === ""))
                    .join("\n")
                    .trim()

            if (/^pm2\s+(list|ls|l)\s*$/.test(command)) {
                exec("pm2 jlist --no-color 2>/dev/null", { maxBuffer: 10 * 1024 * 1024 }, (err, stdout) => {
                    try {
                        const apps = err ? [] : JSON.parse(stdout || "[]");
                        if (!apps.length) return reply("⚠️ Tidak ada proses PM2.");
                        const lines = apps.map((a) => {
                            const up = a.pm2_env ? (a.pm2_env.status || "-") : "-";
                            const restarts = a.pm2_env ? (a.pm2_env.restart_time ?? 0) : 0;
                            const upt = a.pm2_env && a.pm2_env.pm_uptime ? Math.floor((Date.now() - a.pm2_env.pm_uptime) / 1000) : 0;
                            const mem = (a.monit && a.monit.memory ? a.monit.memory / 1048576 : 0).toFixed(1);
                            const cpu = a.monit && a.monit.cpu ? a.monit.cpu : 0;
                            const upStr = upt >= 3600 ? `${(upt / 3600).toFixed(1)}h` : upt >= 60 ? `${Math.floor(upt / 60)}m` : `${upt}s`;
                            const icon = up === "online" ? "🟢" : up === "stopped" ? "⏹️" : "🔴";
                            return `${icon} ${a.name.padEnd(14, " ")} ${up.padEnd(8, " ")} uptime:${upStr.padEnd(8, " ")} restarts:${String(restarts).padEnd(4, " ")} cpu:${cpu}%  mem:${mem}mb`;
                        });
                        reply("📊 *PM2 List*\n\n" + lines.join("\n"));
                    } catch (e) {
                        reply("❌ Gagal membaca pm2 jlist: " + e.message);
                    }
                });
                return;
            }

            if (!global.execCwd) {
                try { global.execCwd = process.cwd(); } catch (e) {}
            }

            const cdMatch = command.match(/^cd\s+(.+)$/);
            if (cdMatch || command === "cd" || command === "pwd") {
                if (command === "pwd") return reply("📂 " + (global.execCwd || process.cwd()));
                if (command === "cd") return reply("📂 " + (global.execCwd || process.cwd()));
                const target = path.resolve(global.execCwd || process.cwd(), cdMatch[1].replace(/^["']|["']$/g, "").replace(/\$HOME/, "/home/indcflix"));
                if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) {
                    return reply("❌ Folder tidak ditemukan: " + target);
                }
                global.execCwd = target;
                return reply("📂 " + target);
            }

            const runCwd = (global.execCwd || process.cwd()).replace(/["\\]/g, "\\$&");

            exec(command, { maxBuffer: 10 * 1024 * 1024, cwd: runCwd }, (err, stdout, stderr) => {
                if (err) {
                    const msg = err.message || String(err)
                    return reply("❌ Error:\n" + msg)
                }

                if (stderr) {
                    return reply("⚠️ Stderr:\n" + cleanOut(stderr))
                }

                reply(cleanOut(stdout) || "✅ Command selesai tanpa output.")
            })

            return
        }

    } catch (err) {
        reply("❌ Error Eval:\n" + err)
    }
}

        // ============================================================
        // 🚀 SISTEM AUTO-LOADER PLUGINS (Bisa baca 'plugin' & 'plugins')
        // ============================================================
        let isHandledByPlugin = false;
        const pluginDirs = [path.resolve("./plugins"), path.resolve("./plugin")];
        const activeDir = pluginDirs.find(d => fs.existsSync(d));
        console.log('[DEBUG] activeDir:', activeDir);

        if (activeDir) {
            const pluginFiles = fs.readdirSync(activeDir).filter(file => file.endsWith('.js'));
            console.log('[DEBUG] pluginFiles:', pluginFiles.length, pluginFiles.slice(0, 3));
            for (let file of pluginFiles) {
                try {
                    const pluginUrl = `file://${path.join(activeDir, file)}?update=${Date.now()}`;
                    console.log('[DEBUG] loading:', file);
                    const plugin = await import(pluginUrl);
                    console.log('[DEBUG] loaded:', file, 'commands:', plugin.command);
                    
                    const pluginCommands = plugin.command ? (Array.isArray(plugin.command) ? plugin.command : [plugin.command]) : [];
                    
                    if (pluginCommands.includes(cmd) && pluginCommands.length > 0) {
                        if (plugin.default && typeof plugin.default === 'function') {
                            // Kirim parameter LENGKAP agar fitur seperti tovn.js tidak error
                            const pluginArgs = { 
                                msg, riz, reply, qriz, id, q, cmd, reactm, 
                                isGroup, isAdmin, sender: senderClean, pushname, 
                                senderNum, 
                                isPremiumUser: true, 
                                DEFAULT_LIMIT: 100,
                                getUserLimit: () => 100,
                                useUserLimit: () => true
                            };
                            
                            await plugin.default(m, pluginArgs);
                            isHandledByPlugin = true;
                            if (pluginCommands.includes(cmd)) break;
                        }
                    }
                } catch (err) { console.log(`[PLUGIN ERROR] ${file}:`, err.message); }
            }
        }

        if (isHandledByPlugin) return;

        // ============================================================
        // 🧠 NATIVE COMMANDS CASE
        // ============================================================
        switch (cmd) {
            case "lid2pn": {
                const lidVal = (q || "").trim().toLowerCase();
                if (!lidVal || !lidVal.includes("@lid")) return reply("Format: .lid2pn <jid lid>\nContoh: .lid2pn 175058655965193@lid");
                try {
                    const lidUser = lidVal.split(":")[0].replace(/@.*$/, "");
                    let pn = null;
                    if (global.lidpnCache && global.lidpnCache[lidUser]) {
                        pn = global.lidpnCache[lidUser].replace(/^0/, "62") + "@s.whatsapp.net";
                    } else if (riz.signalRepository?.lidMapping?.getPNForLID) {
                        pn = await riz.signalRepository.lidMapping.getPNForLID(lidVal).catch(() => null);
                    }
                    if (!pn) return reply("❌ Mapping LID→PN tidak ditemukan.\n\nKontak ini belum pernah berinteraksi dengan bot, atau mapping belum tersimpan.");
                    const pnClean = String(pn).replace(/:.*@s\.whatsapp\.net$/, "@s.whatsapp.net");
                    const pnNumber = pnClean.split("@")[0];
                    const isRule = pnNumber.startsWith("0") ? "0" : (pnNumber.startsWith("62") ? "62" : "+62");
                    return reply(`✅ LID: ${lidVal}\n📞 PN: ${pnClean}\n🔢 Nomor: ${pnNumber}\n🌐 Format: ${isRule}`);
                } catch (e) {
                    return reply("❌ Error: " + (e.message || e));
                }
            }
            case "pn2lid": {
                const pnRaw = (q || "").trim().replace(/[^0-9]/g, "");
                if (pnRaw.length < 10) return reply("Format: .pn2lid <nomor>\nContoh: .pn2lid 6285xxxxx090");
                try {
                    const pnUser = pnRaw.replace(/^0/, "62");
                    let lid = null;
                    if (global.lidpnCache) {
                        const found = Object.entries(global.lidpnCache).find(([, v]) => v === pnUser);
                        if (found) lid = found[0] + "@lid";
                    }
                    if (!lid && riz.signalRepository?.lidMapping?.getLIDForPN) {
                        lid = await riz.signalRepository.lidMapping.getLIDForPN(`${pnUser}@s.whatsapp.net`).catch(() => null);
                    }
                    if (!lid) return reply("❌ Mapping PN→LID tidak ditemukan.");
                    return reply(`📞 PN: ${pnUser}@s.whatsapp.net\n🆔 LID: ${lid}`);
                } catch (e) {
                    return reply("❌ Error: " + (e.message || e));
                }
            }
            case "runjs":
            case "jsrun":
            case "jscheck": {
                const runJs = async (code) => {
                    const tmpFile = path.join(process.cwd(), `.runjs-${Date.now()}.cjs`);
                    try {
                        fs.writeFileSync(tmpFile, code);
                        const { exec } = await import("child_process");
                        const run = (c) => new Promise((resolve) => {
                            exec(c, { timeout: 30000, maxBuffer: 5 * 1024 * 1024 }, (err, so, se) =>
                                resolve({ err, out: (so || "") + (se || ""), killed: !!err && err.code === null && err.signal === "SIGTERM" })
                            );
                        });

                        const check = await run(`node --check "${tmpFile}"`);
                        if (check.err) {
                            return `❌ Syntax Error:\n${check.out.slice(0, 3500).trim()}`;
                        }
                        const result = await run(`node "${tmpFile}"`);
                        if (result.err) {
                            const reason = result.killed
                                ? "⏱️ Timeout (30 detik)"
                                : result.err.code === 1
                                    ? "Runtime Error"
                                    : `Exit code ${result.err.code || "?"}`;
                            return `${reason}:\n${result.out.slice(0, 3500).trim() || "no output"}`;
                        }
                        const out = result.out.trim();
                        return out
                            ? `✅ Berhasil dieksekusi:\n${out.slice(0, 3500)}`
                            : "✅ Berhasil dieksekusi tanpa output.";
                    } finally {
                        try { fs.unlinkSync(tmpFile); } catch (e) {}
                    }
                };

                await reactm("⏳");
                const ctxQ = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                const quotedCode = ctxQ?.conversation || ctxQ?.extendedTextMessage?.text || "";
                const code = (quotedCode || q).trim();
                if (!code) {
                    return reply("Kirim kode JS yang akan dicek & dijalankan.\n\nCara: reply pesan berisi kode dengan `.runjs`, atau ketik:\n.runjs console.log('halo')");
                }
                return reply(await runJs(code));
            }
            case "upswgc": {
    if (!isGroup) return reply("Group Only");
    if (!isAdmin) return reply("Admin Only");

    try {
        await reactm("⏳");

        const ct = getContentType(msg.message);

        const quoted =
            msg.message?.[ct]
                ?.contextInfo
                ?.quotedMessage;

        if (!quoted && !q) {
            return reply(
                `Reply media / teks.\n\nContoh:\n.upswgc (reply media)\n.upswgc halo`
            );
        }

        const jid = id;

        let payload;

        if (quoted) {
            payload = {
                groupStatusMessageV2: {
                    message: quoted
                }
            };
        } else {
            payload = {
                groupStatusMessageV2: {
                    message: {
                        conversation: q
                    }
                }
            };
        }

        await riz.relayMessage(
            jid,
            payload,
            {}
        );

        await reactm("✅");

    } catch (e) {
        console.error(
            "UPSWGC ERROR:",
            e
        );

        await reactm("❌");

        reply(
            `Gagal kirim swgc\n${e.message}`
        );
    }
}
break;

            
            case "s":
case "sticker":
case "stiker": {
    try {
        const quoted =
            msg.message?.extendedTextMessage?.contextInfo?.quotedMessage ||
            msg.message;

        if (!quoted)
            return reply("❌ Reply gambar/video/stiker");

        const typeKey = Object.keys(quoted).find(k =>
            ["imageMessage", "videoMessage", "stickerMessage"].includes(k)
        );

        if (!typeKey)
            return reply("❌ Hanya support gambar, video, stiker");

        const stream = await downloadContentFromMessage(
            quoted[typeKey],
            typeKey.replace("Message", "")
        );

        let buf = Buffer.from([]);

        for await (const chunk of stream) {
            buf = Buffer.concat([buf, chunk]);
        }

        if (!buf || buf.length < 10)
            throw new Error("Media corrupt");

        await reactm("⏳");

        const sticker = new Sticker(buf, {
            pack: "",
            author: "",
            type: StickerTypes.FULL,
            quality: 40,
            background: "#00000000"
        });

        const stickerMsg = await sticker.toMessage();

        await riz.sendMessage(id, stickerMsg, {
            quoted: qriz
        });

        await reactm("✅");

    } catch (e) {
        console.error("Sticker Error:", e);

        await reactm("❌");

        return reply(
            "❌ Gagal bikin stiker\n" + e.message
        );
    }

    break;
}

case "ss":
case "screenshot":
case "skrinsut":
case "webss":
case "ssweb": {

    const BASE_URL = "https://www.screenshotmachine.com"

    const sleep = ms =>
        new Promise(resolve =>
            setTimeout(resolve, ms)
        )

    function getUserAgent(mode) {
        if (mode === "android") {
            return "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36"
        }

        return "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36"
    }

    function isMobile(mode) {
        return mode === "android"
    }

    function extractCookies(res) {

    const rawCookies =
        res.headers.raw?.()["set-cookie"]

    if (!rawCookies) return ""

    return rawCookies
        .map(cookie =>
            cookie.split(";")[0]
        )
        .join("; ")

}

    async function captureScreenshot(
        url,
        mode
    ) {

        const formParams = {
            url,
            device:
                mode === "android"
                    ? "phone"
                    : "desktop",

            cacheLimit: "0",

            "homepage-tab":
                "screenshot"
        }

        if (mode === "fullpage") {
            formParams.device =
                "desktop"

            formParams.full =
                "on"
        }

        const postBody =
            new URLSearchParams(
                formParams
            )

        const captureHeaders = {
            "Content-Type":
                "application/x-www-form-urlencoded; charset=UTF-8",

            Accept:
                "*/*",

            "Accept-Language":
                "id-ID",

            "Sec-Ch-Ua":
                '"Chromium";v="127", "Not)A;Brand";v="99", "Microsoft Edge Simulate";v="127", "Lemur";v="127"',

            "Sec-Ch-Ua-Mobile":
                isMobile(mode)
                    ? "?1"
                    : "?0",

            "Sec-Ch-Ua-Platform":
                isMobile(mode)
                    ? '"Android"'
                    : '"Windows"',

            "Sec-Fetch-Dest":
                "empty",

            "Sec-Fetch-Mode":
                "cors",

            "Sec-Fetch-Site":
                "same-origin",

            "User-Agent":
                getUserAgent(
                    mode
                ),

            "X-Requested-With":
                "XMLHttpRequest",

            Origin:
                BASE_URL,

            Referer:
                BASE_URL +
                "/"
        }

        const captureRes =
            await fetch(
                `${BASE_URL}/capture.php`,
                {
                    method:
                        "POST",

                    headers:
                        captureHeaders,

                    body:
                        postBody
                }
            )

        if (!captureRes.ok) {
            throw new Error(
                `capture.php HTTP ${captureRes.status}`
            )
        }

        const sessionCookie =
            extractCookies(
                captureRes
            )

        if (!sessionCookie) {
            throw new Error(
                "Tidak ada session cookie dari server"
            )
        }

        const captureText =
            await captureRes.text()

        let captureData = {}

        try {

            captureData =
                JSON.parse(
                    captureText
                )

        } catch {

            throw new Error(
                `Gagal parse response: ${captureText.slice(0,200)}`
            )

        }

        if (!captureData.link) {
            throw new Error(
                "Tidak ada link screenshot dari server"
            )
        }

        await sleep(4000)

        const serveUrl =
            `${BASE_URL}/${captureData.link}`

        const serveHeaders = {

            Accept:
                "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",

            "Accept-Language":
                "id-ID",

            Cookie:
                sessionCookie,

            "Sec-Ch-Ua":
                '"Chromium";v="127", "Not)A;Brand";v="99", "Microsoft Edge Simulate";v="127", "Lemur";v="127"',

            "Sec-Ch-Ua-Mobile":
                isMobile(mode)
                    ? "?1"
                    : "?0",

            "Sec-Ch-Ua-Platform":
                isMobile(mode)
                    ? '"Android"'
                    : '"Windows"',

            "Sec-Fetch-Dest":
                "image",

            "Sec-Fetch-Mode":
                "no-cors",

            "Sec-Fetch-Site":
                "same-origin",

            "User-Agent":
                getUserAgent(
                    mode
                ),

            Referer:
                BASE_URL +
                "/"
        }

        const serveRes =
            await fetch(
                serveUrl,
                {
                    headers:
                        serveHeaders
                }
            )

        const contentType =
            serveRes.headers.get(
                "content-type"
            ) ?? ""

        if (!serveRes.ok) {

            const body =
                await serveRes.text()

            throw new Error(
                `serve.php HTTP ${serveRes.status}: ${body.slice(0,200)}`
            )

        }

        if (
            !contentType.includes(
                "image"
            )
        ) {

            const body =
                await serveRes.text()

            throw new Error(
                `Expected image tapi dapat: ${contentType}\n${body.slice(0,200)}`
            )

        }

        const imageBuffer =
            Buffer.from(
                await serveRes.arrayBuffer()
            )

        if (
            imageBuffer.length <
            1000
        ) {

            throw new Error(
                `Gambar terlalu kecil (${imageBuffer.length} bytes)`
            )

        }

        return imageBuffer
    }

    try {

        const parts =
            q.trim().split(
                /\s+/
            )

        let url =
            parts[0]

        const modeArg =
            parts[1]
                ?.toLowerCase()

        if (!url) {

            return reply(
`📸 Screenshot Website

Compatible:
desktop
android
fullpage

Contoh:
.ss google.com

.ss google.com android

.ss google.com fullpage`
            )

        }

        if (
            !/^https?:\/\//i.test(
                url
            )
        ) {

            url =
                "https://" +
                url

        }

        const validModes = [
            "desktop",
            "android",
            "fullpage"
        ]

        const mode =
            validModes.includes(
                modeArg
            )
                ? modeArg
                : "desktop"

        await reactm("⏳")

        const imageBuffer =
            await captureScreenshot(
                url,
                mode
            )

        const modeLabel = {
            desktop:
                "Desktop",

            android:
                "Android",

            fullpage:
                "Fullpage"
        }[mode]

        await riz.sendMessage(
            id,
            {
                image:
                    imageBuffer,

                caption:
`*Screenshot Berhasil!*
\`${modeLabel}\` Mode`
            },
            {
                quoted:
                    qriz
            }
        )

        await reactm("✅")

    } catch (err) {

        console.log(
            "[SSWEB]",
            err
        )

        await reactm("❌")

        reply(
            `⚠️ Gagal screenshot!\n\n${err.message}`
        )

    }

    break
}

case "ttdl":
case "tiktok":
case "tt":
{
    if (!q) return reply("⚠ *Mana Link Tiktoknya?*");

    reactm("⏳️")

    try {

        const { no_watermark } = await tiktok2(q);

        if (!no_watermark) {
            throw new Error("No video from primary API");
        }

        await riz.sendMessage(
            id,
            {
                video: {
                    url: no_watermark
                },
                caption:
                    "Nih ✨"
            },
            {
                quoted: qriz
            }
        );

        reactm("✅️")

    } catch (err1) {

        console.error(
            "Primary TikTok DL error:",
            err1
        );

        try {

            const apiUrl =
                `https://chocomilk.amira.us.kg/v1/download/tiktok?url=${encodeURIComponent(q)}`;

            const { data } =
                await axios.get(
                    apiUrl,
                    {
                        headers: {
                            Accept:
                                "application/json"
                        }
                    }
                );

            if (
                !data?.success ||
                !data?.data?.media?.video
            ) {
                throw new Error(
                    "Fallback API response invalid"
                );
            }

            const videoUrl =
                data.data.media.video;

            await riz.sendMessage(
                id,
                {
                    video: {
                        url: videoUrl
                    },
                    caption:
                        "Nih ✨"
                },
                {
                    quoted: qriz
                }
            );

            reactm("✅️")

        } catch (err2) {

            console.error(
                "Fallback TikTok DL error:",
                err2
            );

            reply("❌ Gagal download video TikTok");
            reactm("❌️")

        }
    }

}
break;



case "gethtml": {
    if (!q) {
        return reply(
            "❌ Contoh:\n.gethtml https://example.com"
        );
    }

    if (!/^https?:\/\//i.test(q)) {
        return reply(
            "❌ URL harus diawali http:// atau https://"
        );
    }

    try {
        await reactm("⏳");

        const res = await fetch(q, {
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (gethtml-bot)"
            }
        });

        if (!res.ok) {
            await reactm("❌");

            return reply(
                `❌ Gagal mengambil HTML\nStatus: ${res.status}`
            );
        }

        const html = await res.text();

        const tmpDir =
            path.join(process.cwd(), "tmp");

        if (!fs.existsSync(tmpDir)) {
            fs.mkdirSync(tmpDir);
        }

        const filePath = path.join(
            tmpDir,
            `html_${Date.now()}.html`
        );

        fs.writeFileSync(filePath, html);

        await riz.sendMessage(
            id,
            {
                document: fs.readFileSync(filePath),
                mimetype: "text/html",
                fileName: "source.html"
            },
            {
                quoted: qriz
            }
        );

        fs.unlinkSync(filePath);

        await reactm("✅");

    } catch (err) {
        console.error(
            "GETHTML ERROR:",
            err
        );

        await reactm("❌");

        reply(
            "❌ Error saat mengambil HTML\n" +
            err.message
        );
    }

    break;
}

case "listgc":
case "gclist": {
    try {
        await reactm("⏳");

        const groups =
            await riz.groupFetchAllParticipating();

        const groupList =
            Object.values(groups);

        if (!groupList.length) {
            await reactm("❌");

            return reply(
                "❌ Bot tidak ada di grup manapun"
            );
        }

        let teks =
            `📋 LIST GROUP BOT\n\n`;

        for (let i = 0; i < groupList.length; i++) {
            const gc = groupList[i];

            let inviteLink =
                "Tidak bisa mengambil link";

            try {
                const code =
                    await riz.groupInviteCode(gc.id);

                inviteLink =
                    `https://chat.whatsapp.com/${code}`;

            } catch {}

            teks +=
                `*${i + 1}. ${gc.subject}*\n` +
                `👥 Member: ${gc.size || 0}\n` +
                `🆔 ID: ${gc.id}\n` +
                `🔗 Link: ${inviteLink}\n\n`;
        }

        teks +=
            `Total Grup: ${groupList.length}`;

        await reply(teks);

        await reactm("✅");

    } catch (err) {
        console.error(
            "LISTGC ERROR:",
            err
        );

        await reactm("❌");

        reply(
            "❌ Gagal mengambil list grup"
        );
    }
    break;
}

case "ig":
case "igdl":
case "instagram": {
    if (!q) {
        return reply(
            "❌ Masukkan URL Instagram\n\nContoh:\n.ig https://www.instagram.com/reel/xxxx/"
        );
    }

    try {
        await reactm("⏳");

        let medias = [];

        try {
            const form = new URLSearchParams();

            form.append("q", q);
            form.append("vt", "home");

            const { data } = await axios.post(
                "https://yt5s.io/api/ajaxSearch",
                form,
                {
                    headers: {
                        Accept: "application/json",
                        "X-Requested-With":
                            "XMLHttpRequest",
                        "Content-Type":
                            "application/x-www-form-urlencoded"
                    }
                }
            );

            if (data.status !== "ok") {
                throw new Error("yt5s gagal");
            }

            const $ = cheerio.load(data.data);

            const video =
                $('a[title="Download Video"]').attr("href");

            const image =
                $("img").attr("src");

            if (video) {
                medias.push({
                    type: "video",
                    url: video
                });

            } else if (image) {
                medias.push({
                    type: "image",
                    url: image
                });

            } else {
                throw new Error(
                    "Media tidak ditemukan"
                );
            }

        } catch (e) {
            console.log(
                "IGDL Primary Error:",
                e
            );

            try {
                const api =
                    `https://api.yupra.my.id/api/downloader/Instagram?url=${encodeURIComponent(q)}`;

                const { data } =
                    await axios.get(api);

                if (
                    data.status !== 200 ||
                    !data.result?.medias?.length
                ) {
                    throw new Error(
                        "Fallback gagal"
                    );
                }

                medias =
                    data.result.medias.map(v => ({
                        type: v.type,
                        url: v.url
                    }));

            } catch (err) {
                console.log(
                    "IGDL Fallback Error:",
                    err
                );

                await reactm("❌");

                return reply(
                    "❌ Gagal download Instagram"
                );
            }
        }

        await reactm("✅");

        const videos =
            medias.filter(v =>
                v.type === "video"
            );

        const images =
            medias.filter(v =>
                v.type === "image"
            );

        if (videos.length > 0) {
            return await riz.sendMessage(
                id,
                {
                    video: {
                        url: videos[0].url
                    },
                    caption:
                        "✅ Instagram Video"
                },
                {
                    quoted: qriz
                }
            );
        }

        if (images.length === 1) {
            return await riz.sendMessage(
                id,
                {
                    image: {
                        url: images[0].url
                    },
                    caption:
                        "✅ Instagram Image"
                },
                {
                    quoted: qriz
                }
            );
        }

        if (images.length > 1) {
            for (const img of images) {
                await riz.sendMessage(
                    id,
                    {
                        image: {
                            url: img.url
                        }
                    },
                    {
                        quoted: qriz
                    }
                );
            }

            return;
        }

        reply(
            "❌ Media tidak didukung"
        );

    } catch (err) {
        console.error(
            "IGDL ERROR:",
            err
        );

        await reactm("❌");

        reply(
            "❌ Terjadi kesalahan saat download Instagram"
        );
    }
    break;
}

case "fb":
case "fbdl":
case "facebook": {
    if (!q) {
        return reply(
            "❌ Masukkan URL Facebook\n\nContoh:\n.fb https://fb.watch/xxxxx"
        );
    }

    if (
        !q.includes("facebook.com") &&
        !q.includes("fb.watch")
    ) {
        return reply(
            "❌ URL tidak valid"
        );
    }

    try {
        await reactm("⏳");

        const { data } = await axios.post(
            "https://yt5s.io/api/ajaxSearch",
            new URLSearchParams({
                q,
                vt: "home"
            }),
            {
                headers: {
                    Accept: "application/json",
                    "X-Requested-With":
                        "XMLHttpRequest",
                    "Content-Type":
                        "application/x-www-form-urlencoded"
                }
            }
        );

        if (data.status !== "ok") {
            throw new Error(
                "Gagal mengambil data"
            );
        }

        const $ = cheerio.load(data.data);

        const thumb =
            $("img").attr("src");

        const links = [];

        $("table tbody tr").each(
            (_, el) => {
                const quality =
                    $(el)
                        .find(".video-quality")
                        .text()
                        .trim();

                const link =
                    $(el)
                        .find(
                            "a.download-link-fb"
                        )
                        .attr("href");

                if (quality && link) {
                    links.push({
                        quality,
                        link
                    });
                }
            }
        );

        if (links.length > 0) {
            await riz.sendMessage(
                id,
                {
                    video: {
                        url: links[0].link
                    },
                    caption:
                        `✅ Facebook Video\n🎥 Quality: ${links[0].quality}`
                },
                {
                    quoted: qriz
                }
            );
            await reactm("✅");
            return;
        }

        if (thumb) {
            await riz.sendMessage(
                id,
                {
                    image: {
                        url: thumb
                    },
                    caption:
                        "✅ Facebook Image"
                },
                {
                    quoted: qriz
                }
            );
            await reactm("✅");
            return;
        }

        await reactm("❌");
        reply(
            "❌ Media tidak ditemukan"
        );
    } catch (e) {
        console.error(
            "FB DOWNLOAD ERROR:",
            e
        );
        await reactm("❌");
        reply(
            "❌ Gagal download Facebook"
        );
    }
    break;
}

case "tagall":
case "h":
case "ht": {
    if (!isGroup) {
        return reply("⚠️ Command ini cuma bisa di grup.");
    }
    if (!isAdmin) {
        return reply("⚠️ Command ini hanya untuk Admin Grup!");
    }

    await m.Xp(); // React dengan ⏳
    const groupMetadata = await riz.groupMetadata(id);
    const participants = groupMetadata.participants || [];
    const mentions = participants.map(p => p.id);

    const ctx = msg.message?.extendedTextMessage?.contextInfo;
    const quoted = ctx?.quotedMessage;

    let teks = q || "*Tag All*";

    // === REPLY IMAGE ===
    if (quoted?.imageMessage) {
        const stream = await downloadContentFromMessage(
            quoted.imageMessage,
            "image"
        );
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }

        await riz.sendMessage(id, {
            image: buffer,
            caption: quoted.imageMessage.caption || teks,
            mentions
        }, { quoted: qriz });
        await m.Xd();
        return;
    }

    // === REPLY VIDEO ===
    if (quoted?.videoMessage) {
        const stream = await downloadContentFromMessage(
            quoted.videoMessage,
            "video"
        );
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }

        await riz.sendMessage(id, {
            video: buffer,
            caption: quoted.videoMessage.caption || teks,
            mentions
        }, { quoted: qriz });
        await m.Xd();
        return;
    }

    // === REPLY TEXT / NORMAL ===
    if (quoted?.conversation) {
        teks = quoted.conversation;
    }

    await riz.sendMessage(id, {
        text: teks.trim(),
        mentions
    }, { quoted: qriz });
    await m.Xd();
    break;
}

case "bratvid": {
    try {
        if (!q) return reply('⚠️ Contoh: .bratvid Lu napa dah');

        await reactm("⏳");

        const apiUrl = `https://www.sankavollerei.com/imagecreator/bratvideo?apikey=planaai&text=${encodeURIComponent(q)}`;
        const res = await fetch(apiUrl);
        if (!res.ok) throw new Error(`Status ${res.status}`);

        const buffer = Buffer.from(await res.arrayBuffer());

        const sticker = new Sticker(buffer, {
            pack: '',
            author: '',
            type: StickerTypes.FULL,
            quality: 60,
            fps: 30,
            loop: 0,
            background: '#00000000'
        });

        await riz.sendMessage(id, await sticker.toMessage(), { quoted: qriz });
        await reactm("✅");
    } catch (e) {
        console.error('❌ BratVid Error:', e);
        reply(`🍂 Ups error: ${e.message}`);
        await reactm("❌");
    }
    break;
}


case "tovn": {
    try {
        const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!quotedMsg) return reply("⚠️ Balas audio dulu ya!");

        const mediaType = Object.keys(quotedMsg).find(type =>
            ["audioMessage"].includes(type)
        );
        if (!mediaType) return reply("⚠️ Yang direply harus audio!");

        await reactm("⏳");

        const stream = await downloadContentFromMessage(
            quotedMsg[mediaType],
            "audio"
        );
        let buffer = Buffer.from([]);
        for await (const chunk of stream)
            buffer = Buffer.concat([buffer, chunk]);

        const tempDir = path.resolve("./temp");
        await fs.promises.mkdir(tempDir, { recursive: true });

        const audioPath = path.join(tempDir, `input_${Date.now()}.mp3`);
        const opusPath = path.join(tempDir, `output_${Date.now()}.opus`);
        await fs.promises.writeFile(audioPath, buffer);

        await new Promise((resolve, reject) => {
            const ffmpeg = spawn("ffmpeg", [
                "-i",
                audioPath,
                "-c:a",
                "libopus",
                "-b:a",
                "128k",
                "-ar",
                "16000",
                "-ac",
                "1",
                "-vbr",
                "on",
                "-application",
                "voip",
                "-f",
                "opus",
                "-y",
                opusPath
            ]);

            ffmpeg.on("close", code => {
                if (code === 0) resolve();
                else reject(new Error(`FFmpeg exited with code ${code}`));
            });
            ffmpeg.on("error", reject);
        });

        await riz.sendMessage(
            id,
            {
                audio: fs.readFileSync(opusPath),
                mimetype: "audio/ogg; codecs=opus",
                ptt: true
            },
            { quoted: qriz }
        );

        await fs.promises.unlink(audioPath).catch(() => {});
        await fs.promises.unlink(opusPath).catch(() => {});

        await reactm("✅");
    } catch (err) {
        console.error("❌ toVN Error:", err);
        reply(`⚠️ Gagal ubah ke VN: ${err.message}`);
        await reactm("❌");
    }
    break;
}

case "toimg": {
    try {
        const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const isSticker = msg.message?.stickerMessage || quotedMsg?.stickerMessage;

        if (!isSticker) {
            return reply("❌ Reply stickernya bang 🫡");
        }

        await reactm("⏳");

        const targetMessage = msg.message?.stickerMessage ? msg.message.stickerMessage : quotedMsg.stickerMessage;

        const stream = await downloadContentFromMessage(
            targetMessage,
            "sticker"
        );
        
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }

        const imgBuffer = await sharp(buffer).jpeg().toBuffer();

        await riz.sendMessage(
            id,
            {
                image: imgBuffer,
                caption: "Nih jadi gambar 📸"
            },
            {
                quoted: qriz
            }
        );

        await reactm("✅");
    } catch (err) {
        console.error("TOIMG ERROR:", err);
        await reactm("❌");
        reply("❌ Gagal convert sticker 😔\nPastikan stiker yang direply adalah stiker statis (bukan animasi).");
    }
    break;
}

case "removebg":
case "rbg": {
    const quoted =
        msg.message?.extendedTextMessage
            ?.contextInfo?.quotedMessage;
            
            const imgbbApiKey =
    "dd5af36e89dc5e42d2c10ad563be2f2b";

    if (!quoted) {
        return reply(
            "❌ Reply gambar dengan command ini"
        );
    }

    const mediaType =
        Object.keys(quoted).find(type =>
            ["imageMessage"].includes(type)
        );

    if (!mediaType) {
        return reply(
            "❌ Yang direply harus gambar"
        );
    }

    try {
        await reactm("⏳");

        const stream =
            await downloadContentFromMessage(
                quoted.imageMessage,
                "image"
            );

        let buffer = Buffer.from([]);

        for await (const chunk of stream) {
            buffer = Buffer.concat([
                buffer,
                chunk
            ]);
        }

        if (
            !buffer ||
            buffer.length < 10
        ) {
            throw new Error(
                "Gagal mengambil gambar"
            );
        }

        const base64Img =
            buffer.toString("base64");

        const form =
            new FormData();

        form.append(
            "image",
            base64Img
        );

        form.append(
            "name",
            `rbg_${Date.now()}`
        );

        const endpoint =
            `https://api.imgbb.com/1/upload?key=${encodeURIComponent(imgbbApiKey)}`;

        const upload =
            await axios.post(
                endpoint,
                form,
                {
                    headers: {
                        ...form.getHeaders(),
                        Accept:
                            "application/json"
                    },
                    maxBodyLength:
                        Infinity,
                    maxContentLength:
                        Infinity
                }
            );

        if (
            upload.status !== 200 ||
            !upload.data?.success
        ) {
            throw new Error(
                "Gagal upload ke ImgBB"
            );
        }

        const imageUrl =
            upload.data.data.url;

        if (!imageUrl) {
            throw new Error(
                "URL gambar kosong"
            );
        }

        const apiUrl =
            `https://api.nexray.eu.cc/tools/removebg?url=${encodeURIComponent(imageUrl)}`;

        const result =
            await axios.get(
                apiUrl,
                {
                    responseType:
                        "arraybuffer",
                    headers: {
                        Accept:
                            "image/*",
                        "User-Agent":
                            "Mozilla/5.0"
                    }
                }
            );

        const outputBuffer =
            Buffer.from(
                result.data
            );

        if (
            !outputBuffer ||
            !outputBuffer.length
        ) {
            throw new Error(
                "Gagal remove background"
            );
        }

        await riz.sendMessage(
            id,
            {
                image: outputBuffer,
                caption:
                    "✅ Background berhasil dihapus"
            },
            {
                quoted: qriz
            }
        );

        await reactm("✅");

    } catch (err) {
        console.error(
            "REMOVEBG ERROR:",
            err
        );

        await reactm("❌");
        reply(
            "❌ Gagal menghapus background"
        );
    }
    break;
}

case "tourl": {
    try {
        const quoted =
            msg.message?.extendedTextMessage?.contextInfo?.quotedMessage ||
            msg.message;

        if (!quoted) return reply("⚠️ Kirim atau reply media dulu");

        const mediaType = Object.keys(quoted).find(t =>
            [
                "imageMessage",
                "videoMessage",
                "audioMessage",
                "documentMessage",
                "stickerMessage"
            ].includes(t)
        );

        if (!mediaType) return reply("⚠️ Media tidak valid");

        const mime = quoted[mediaType]?.mimetype || "";
        const isImage = /image/.test(mime);
        const isVideo = /video/.test(mime);
        const isAudio = /audio/.test(mime);
        const isSticker = mediaType === "stickerMessage";
        const isDocument = mediaType === "documentMessage";

        await m.Xp();

        const stream = await downloadContentFromMessage(
            quoted[mediaType],
            mediaType.replace("Message", "")
        );

        let buffer = Buffer.from([]);
        for await (const chunk of stream)
            buffer = Buffer.concat([buffer, chunk]);

        if (!buffer.length) throw new Error("Buffer kosong");

        let ext = ".bin";
        if (isImage) ext = ".jpg";
        else if (isVideo) ext = ".mp4";
        else if (isAudio) ext = ".mp3";
        else if (isSticker) ext = ".webp";
        else if (isDocument)
            ext = path.extname(quoted[mediaType]?.fileName || ".bin");

        const file = `./temp_${Date.now()}${ext}`;
        fs.writeFileSync(file, buffer);

        let result = [];

        if (isImage) {
            try {
                const b64 = buffer.toString("base64");
                const form = new FormData();
                form.append("image", b64);

                const res = await axios.post(
                    `https://api.imgbb.com/1/upload?key=${imgbbApiKey}`,
                    form,
                    { headers: form.getHeaders() }
                );

                if (res.data?.success)
                    result.push(`🖼 ImgBB  : ${res.data.data.url}`);
            } catch {}

            try {
                const yup = await YupraUploader(file);
                result.push(`📦 Yupra  : ${yup.url}`);
            } catch {}

            try {
                const cat = await CatboxMoe(file);
                result.push(`📦 Catbox : ${cat}`);
            } catch {}
        }

        else if (isVideo) {
            try {
                const vd = await upVidey(file);
                if (vd?.cdn)
                    result.push(`🎥 Videy  : ${vd.cdn}`);
            } catch {}

            try {
                const yup = await YupraUploader(file);
                result.push(`📦 Yupra  : ${yup.url}`);
            } catch {}

            try {
                const cat = await CatboxMoe(file);
                result.push(`📦 Catbox : ${cat}`);
            } catch {}
        }

        else {
            try {
                const cat = await CatboxMoe(file);
                result.push(`📦 Catbox : ${cat}`);
            } catch {}

            try {
                const yup = await YupraUploader(file);
                result.push(`📦 Yupra  : ${yup.url}`);
            } catch {}

            try {
                const uguu = await UguuUpload(file, `upload_${Date.now()}${ext}`);
                if (uguu?.url)
                    result.push(`📦 Uguu   : ${uguu.url}`);
            } catch {}
        }

        reply(
            `✅ *Upload sukses!*\n\n${result.join("\n") || "❌ Semua uploader gagal"}`
        );
        await m.Xd();

        fs.unlinkSync(file);
    } catch (e) {
        console.error("[TOURL ERROR]", e);
        reply("❌ Gagal upload media");
    }
    break;
}

case "bcd":
case "barcode": {
    if (!q) {
        return reply(
            `❌ Contoh:\n.bcd Halo dunia\n.bcd 128 489DLS614\n.bcd qr https://google.com\n.bcd ean13 8997015180011\n\nTipe: qr, 128/code128, code39, code93, ean13, ean8, upca, upce, itf14, datamatrix, aztec, pdf417`
        );
    }

    try {
        await reactm("⏳");

        const KNOWN = [
            "qr", "qrcode", "2d", "128", "code128", "c128a", "c128b", "c128c", "nw7",
            "code39", "code93", "ean", "ean13", "ean8", "upc", "upca", "upce", "itf14",
            "datamatrix", "aztec", "azteccode", "pdf", "pdf417", "postnet"
        ];

        const parts = q.split(/ +/);
        let tipe = "auto";
        let content = q;

        if (KNOWN.includes(parts[0].toLowerCase()) && parts.length > 1) {
            tipe = parts.shift().toLowerCase();
            content = parts.join(" ");
        }

        let apiUrl;
        if (["128", "code128", "c128a", "c128b", "c128c", "nw7"].includes(tipe)) {
            apiUrl = `https://barcode.klikidm.my.id/api/128/${encodeURIComponent(content)}?text=none&scale=4`;
        } else if (["qr", "qrcode", "2d"].includes(tipe)) {
            apiUrl = `https://barcode.klikidm.my.id/api/qr/${encodeURIComponent(content)}?scale=4`;
        } else {
            apiUrl = `https://barcode.klikidm.my.id/api/${tipe}/${encodeURIComponent(content)}?scale=4`;
        }

        const res = await fetch(apiUrl);

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(
                err.error?.message || `HTTP ${res.status}`
            );
        }

        const buffer = Buffer.from(
            await res.arrayBuffer()
        );

        await riz.sendMessage(id, {
            image: buffer,
            caption:
                `✅ Barcode dibuat!\n\n🔹 Tipe: *${tipe}*\n🔹 Isi: ${content}\n\n🔗 Link API:\n${apiUrl}`
        }, { quoted: qriz });

        await reactm("✅");

    } catch (e) {
        console.error("[BCD ERROR]", e);
        await reactm("❌");
        reply(`❌ Gagal: ${e.message}`);
    }
    break;
}

case "qc":
case "quote": {
    if (!q) {
        return reply(
            "❌ Contoh:\n.qc Halo dunia"
        );
    }

    try {
        await reactm("⏳");

        const sender =
            msg.key.participant ||
            msg.key.remoteJid;

        const name =
            pushname || "User";

        let ppUrl;

        try {
            ppUrl =
                await riz.profilePictureUrl(
                    sender,
                    "image"
                );

        } catch {
            ppUrl =
                "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png";
        }

        const payload = {
            type: "quote",
            format: "png",
            backgroundColor:
                "#ffffff",
            width: 512,
            height: 768,
            scale: 2,
            messages: [
                {
                    entities: [],
                    avatar: true,
                    from: {
                        id: 1,
                        name,
                        photo: {
                            url: ppUrl
                        }
                    },
                    text: q,
                    replyMessage: {}
                }
            ]
        };

        const res =
            await axios.post(
                "https://bot.lyo.su/quote/generate",
                payload,
                {
                    headers: {
                        "Content-Type":
                            "application/json"
                    }
                }
            );

        const buffer =
            Buffer.from(
                res.data.result.image,
                "base64"
            );

        const sticker =
            new Sticker(buffer, {
                pack: "",
                author: "",
                type: StickerTypes.FULL,
                quality: 60
            });

        await riz.sendMessage(
            id,
            await sticker.toMessage(),
            {
                quoted: qriz
            }
        );

        await reactm("✅");

    } catch (err) {
        console.error(
            "QC ERROR:",
            err
        );

        await reactm("❌");
        reply(
            "❌ Gagal membuat quote sticker"
        );
    }
    break;
}

case "cekidid":
case "jid": {
    if (!isGroup) {
        return reply(
            "❌ Command ini cuma bisa di grup"
        );
    }

    try {
        await reactm("⏳");

        const ctx =
            msg.message
                ?.extendedTextMessage
                ?.contextInfo ||

            msg.message
                ?.imageMessage
                ?.contextInfo ||

            msg.message
                ?.videoMessage
                ?.contextInfo ||

            msg.message
                ?.stickerMessage
                ?.contextInfo ||

            msg.message
                ?.documentMessage
                ?.contextInfo ||

            null;

        const quotedTarget =
            ctx?.participant;

        const mentionedTarget =
            Array.isArray(
                ctx?.mentionedJid
            )
                ? ctx.mentionedJid[0]
                : null;

        const targetJid =
            quotedTarget ||
            mentionedTarget ||
            sender;

        await sendInteractiveMessage(
            riz,
            id,
            {
                text:
                    `📋 Target JID:\n\n${targetJid}`,

                footer:
                    "JID Checker",

                interactiveButtons: [
                    {
                        name:
                            "cta_copy",

                        buttonParamsJson:
                            JSON.stringify({
                                display_text:
                                    "📋 Salin JID",

                                copy_code:
                                    targetJid
                            })
                    }
                ]
            }
        );

        await reactm("✅");

    } catch (err) {
        console.error(
            "CEKJID ERROR:",
            err
        );
        await reactm("❌");
        reply(
            "❌ Gagal mengambil JID"
        );
    }
    break;
}

case "ceklid":
case "lid": {
    if (!isGroup) {
        return reply(
            "❌ Command ini cuma bisa di grup"
        );
    }

    try {
        await reactm("⏳");

        const participants =
            (
                await riz.groupMetadata(id)
            ).participants || [];

        const ctx =
            msg.message
                ?.extendedTextMessage
                ?.contextInfo ||

            msg.message
                ?.imageMessage
                ?.contextInfo ||

            msg.message
                ?.videoMessage
                ?.contextInfo ||

            msg.message
                ?.stickerMessage
                ?.contextInfo ||

            msg.message
                ?.documentMessage
                ?.contextInfo ||

            null;

        const quotedTarget =
            ctx?.participant;

        const mentionedTarget =
            Array.isArray(
                ctx?.mentionedJid
            )
                ? ctx.mentionedJid[0]
                : null;

        const targetJid =
            quotedTarget ||
            mentionedTarget ||
            sender;

        const p =
            participants.find(
                x =>
                    (
                        x?.jid ||
                        x?.id
                    ) === targetJid
            );

        let targetLid =
            p?.lid ||
            p?.full?.lid ||
            null;

        if (!targetLid) {
            try {
                const ow =
                    await riz.onWhatsApp?.(
                        targetJid
                    );

                if (
                    Array.isArray(ow) &&
                    ow[0]
                ) {
                    targetLid =
                        ow[0].lid ||
                        ow[0].id ||
                        ow[0].jid ||
                        null;
                }

            } catch {}
        }

        if (!targetLid) {
            await reactm("❌");

            return reply(
                "❌ LID tidak ditemukan"
            );
        }

        await sendInteractiveMessage(
            riz,
            id,
            {
                text:
                    `📋 Target LID:\n\n${targetLid}\n\n📌 Target JID:\n${targetJid}`,

                footer:
                    "Linked ID Checker",

                interactiveButtons: [
                    {
                        name:
                            "cta_copy",

                        buttonParamsJson:
                            JSON.stringify({
                                display_text:
                                    "📋 Salin LID",

                                copy_code:
                                    targetLid
                            })
                    }
                ]
            }
        );

        await reactm("✅");

} catch (err) {
        console.error(
            "CEKLID ERROR:",
            err
        );
        await reactm("❌");
        reply(
            "❌ Gagal mengambil LID"
        );
    }
    break;
}

 case "getfile": {
        if (!isOwner) return reply("❌ Akses ditolak! Khusus Owner.");
        if (!q) return reply("📄 Format: `.getfile case.js`\nContoh: `.getfile plugins/maker.js`");

        const target = path.resolve(process.cwd(), q.trim());
        if (!target.startsWith(path.resolve(process.cwd()))) return reply("❌ Path tidak valid.");
        if (!fs.existsSync(target)) return reply(`❌ File *${q.trim()}* tidak ditemukan.`);
        if (!fs.statSync(target).isFile()) return reply("❌ Itu folder, bukan file. Pakai `.getfolder`.");

        const ext = path.extname(target).toLowerCase();
        const mimeMap = { ".js": "application/javascript", ".json": "application/json", ".txt": "text/plain", ".html": "text/html", ".css": "text/css", ".csv": "text/csv", ".md": "text/markdown", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".mp3": "audio/mpeg", ".mp4": "video/mp4", ".zip": "application/zip" };

        try {
            const size = (fs.statSync(target).size / 1024 / 1024).toFixed(2);
            await riz.sendMessage(id, {
                document: fs.readFileSync(target),
                mimetype: mimeMap[ext] || "application/octet-stream",
                fileName: q.trim().split("/").pop(),
                caption: `📄 *${q.trim()}*\n📦 Size: ${size} MB`
            }, { quoted: msg });
        } catch (err) { console.log("GETFILE ERROR:", err); reply("❌ Gagal mengirim file."); }
        break;
    }

    case "getfolder": {
        if (!isOwner) return reply("❌ Akses ditolak! Khusus Owner.");
        if (!q) return reply("📁 Format: `.getfolder plugins`");

        const target = path.resolve(process.cwd(), q.trim());
        if (!target.startsWith(path.resolve(process.cwd()))) return reply("❌ Path tidak valid.");
        if (!fs.existsSync(target)) return reply(`❌ Folder *${q.trim()}* tidak ditemukan.`);
        if (!fs.statSync(target).isDirectory()) return reply("❌ Itu file, bukan folder. Pakai `.getfile`.");

        try {
            await reactm("⏳");
            const { createRequire } = await import("module");
            const require2 = createRequire(import.meta.url);
            const archiver = require2("archiver");
            const outPath = path.join(process.cwd(), `getfolder_${Date.now()}.zip`);
            const output = fs.createWriteStream(outPath);
            const archive = archiver("zip", { zlib: { level: 9 } });
            archive.pipe(output);
            archive.directory(target, false);
            await archive.finalize();
            output.on("close", async () => {
                const size = (archive.pointer() / 1024 / 1024).toFixed(2);
                await riz.sendMessage(id, {
                    document: fs.readFileSync(outPath),
                    mimetype: "application/zip",
                    fileName: `folder_${q.trim().split("/").pop()}.zip`,
                    caption: `📁 *${q.trim()}*\n📦 Size: ${size} MB`
                }, { quoted: msg });
                fs.unlinkSync(outPath);
                await reactm("✅");
            });
        } catch (err) { console.log("GETFOLDER ERROR:", err); await reactm("❌"); reply("❌ Gagal mengarsipkan folder."); }
        break;
    }

    case "addplugin": {
        if (!isOwner) return reply("❌ Akses ditolak! Khusus Owner.");
        const ctx = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const doc = ctx?.documentMessage;
        const quotedText = ctx?.conversation || ctx?.extendedTextMessage?.text || null;
        if (!doc && !quotedText) return reply("❗ Reply file plugin (.js) atau teks kode plugin.\nContoh: `.addplugin fiturbaru.js`");

        let filename = (q || doc?.fileName || "").trim();
        if (!filename) return reply("❗ Nama file tidak ditemukan.");
        if (!filename.toLowerCase().endsWith(".js")) filename += ".js";
        filename = filename.replace(/[/\\]/g, "").replace(/\s+/g, "_");
        if (!/^[\w.\-]+\.js$/i.test(filename)) return reply("❌ Nama file tidak valid.");

        try {
            let buffer;
            if (doc) {
                const stream = await downloadContentFromMessage(doc, "document");
                buffer = Buffer.from([]);
                for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
            } else {
                buffer = Buffer.from(quotedText, "utf-8");
            }
            const pluginsDir = path.resolve(process.cwd(), "plugins");
            if (!fs.existsSync(pluginsDir)) fs.mkdirSync(pluginsDir, { recursive: true });
            fs.writeFileSync(path.join(pluginsDir, filename), buffer);
            reply(`✅ Plugin ditambahkan: *${filename}*`);
        } catch (err) { console.log("ADDPLUGIN ERROR:", err); reply("❌ Gagal menambahkan plugin."); }
        break;
    }

    case "delplugin": {
        if (!isOwner) return reply("❌ Akses ditolak! Khusus Owner.");
        if (!q) return reply("❗ Contoh: `.delplugin fiturbaru.js`");
        const filename = q.trim().replace(/[/\\]/g, "");
        const fp = path.join(process.cwd(), "plugins", filename);
        if (!fs.existsSync(fp)) return reply(`❌ Plugin *${filename}* tidak ditemukan.`);
        try {
            fs.unlinkSync(fp);
            reply(`✅ Plugin dihapus: *${filename}*`);
        } catch (err) { reply("❌ Gagal menghapus plugin."); }
        break;
    }

    case "reload":
    case "reloadplugin":
    case "reloadplugins": {
        if (!isOwner) return reply("❌ Akses ditolak! Khusus Owner.");
        reply("✅ Plugin loader menggunakan import ulang per pesan, perubahan file langsung aktif. Tidak perlu reload manual.");
        break;
    }

    case "encjs": {
        if (!isOwner) return reply("❌ Akses ditolak! Khusus Owner.");
        const qctx = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const qdoc = qctx?.documentMessage;
        const qtext = qctx?.conversation || qctx?.extendedTextMessage?.text || null;
        if (!qdoc && !qtext) return reply("❌ Reply *file .js* atau teks JS dengan `.encjs`");

        try {
            await reactm("⏳");
            let source;
            if (qdoc) {
                const stream = await downloadContentFromMessage(qdoc, "document");
                source = Buffer.from([]);
                for await (const chunk of stream) source = Buffer.concat([source, chunk]);
            } else {
                source = Buffer.from(qtext, "utf-8");
            }

            const { createRequire } = await import("module");
            const require2 = createRequire(import.meta.url);
            const JavaScriptObfuscator = require2("javascript-obfuscator");
            const terser = require2("terser");

            const obf = JavaScriptObfuscator.obfuscate(source.toString(), {
                compact: true, controlFlowFlattening: true, deadCodeInjection: false,
                identifierNamesGenerator: "hexadecimal", renameGlobals: false,
                selfDefending: false, simplify: true, stringArray: true,
                stringArrayThreshold: 0.5
            }).getObfuscatedCode();

            const min = await terser.minify(obf);
            if (min.error) throw min.error;

            const srcSize = (source.length / 1024).toFixed(2);
            const outSize = (Buffer.byteLength(min.code || obf) / 1024).toFixed(2);
            const outName = `enc_${Date.now()}.js`;

            await riz.sendMessage(id, {
                document: Buffer.from(min.code || obf, "utf-8"),
                mimetype: "application/javascript",
                fileName: outName,
                caption: `🔒 *ENCRYPTED JS*\n📥 Input: ${srcSize} KB\n📤 Output: ${outSize} KB`
            }, { quoted: msg });
            await reactm("✅");
        } catch (err) { console.log("ENCJS ERROR:", err); await reactm("❌"); reply("❌ Gagal enkripsi. Pastikan reply file .js."); }
        break;
    }

 case "backup":
        case "backupbot": {
            if (!isOwner) return
            await reactm("⏳")
            const { exec } = await import("child_process")
            exec("bash /home/indcflix/apps/backup.sh", { timeout: 120000 }, async (err, stdout, stderr) => {
                if (err) {
                    await reactm("❌")
                    return reply("❌ *Backup gagal:*\n" + (err.message || String(err)))
                }
                const clean = String(stdout + (stderr ? "\n" + stderr : ""))
                    .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "")
                    .trim()
                await reactm("✅")
                return reply("✅ *Backup Selesai*\n\n" + (clean || "Berhasil."))
            })
            break
        }

        case "menu":
        case "help": {
            const listMenu = `🤖 *INDICA BOT MENU*
__*═══════════════*__
📌 *Sticker & Media*
  .s / .sticker (reply media)
  .toimg (reply stiker)
  .tovn (reply audio)
  .removebg / .rbg
  .tourl (reply media)
  .qc / .quote (teks)
  .bcd / .barcode (teks)

📥 *Downloader*
  .tt / .tiktok (link)
  .ig / .instagram (link)
  .fb / .facebook (link)
  .gethtml (link)

🛠 *Tools*
  .ss / .ssweb (url)
  .listgc / .gclist
  .tagall / .h
  .cekid / .cekidgc / .cekidch
  .cekidid / .jid
  .ceklid / .lid
  .upswgc (admin grup)

♻️ *Lainnya*
  .cekidid / .jid
  .v (reply view once)
  .self / .public / .strict
  .hermes (mode AI Hermes)
  .exithermes (keluar mode Hermes)
  .ping (tes bot)
  .plu [plu/nama]
  .caritoko [kode/nama]

🔒 *Owner Only*
  .restart
  .backup / .getfile / .getfolder
  .addplugin / .delplugin / .reload
  .encjs (enkripsi file js)
  > kode (eval)
  $ perintah (exec)`;
            return reply(listMenu);
        }

        case "v": {
    try {
        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!quoted) return reply("❌ Reply pesan 1x lihat (view once)");
        
        const viewOnceKey = Object.keys(quoted).find(k => k.toLowerCase().includes("viewonce"));
        let isViewOnce = false, mediaMessage = null;
        if (viewOnceKey) {
            isViewOnce = true;
            mediaMessage = quoted[viewOnceKey]?.message;
        } else {
            const mType = Object.keys(quoted)[0];
            if (quoted[mType]?.viewOnce) { isViewOnce = true; mediaMessage = quoted; }
        }
        if (!isViewOnce || !mediaMessage) return reply("❌ Pesan yang di-reply bukan 1x lihat");
        
        const realType = Object.keys(mediaMessage).find(k => ["imageMessage", "videoMessage", "audioMessage", "documentMessage"].includes(k));
        if (!realType) return reply("❌ Format view once tidak didukung");
        
        await reactm("⏳");
        const stream = await downloadContentFromMessage(mediaMessage[realType], realType.replace("Message", ""));
        let buffer = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
        
        const cap = mediaMessage[realType]?.caption || "";
        await riz.sendMessage(id, {
            [realType.replace("Message", "")]: buffer,
            caption: realType === "audioMessage" ? undefined : (cap || undefined)
        }, { quoted: msg });
        await reactm("✅");
    } catch (err) {
        console.error("❌ /v ERROR:", err);
        await reactm("❌");
        reply("⚠️ Gagal membuka view once. Mungkin pesan sudah expired/dilihat.");
    }
    break;
}

case "hermes": {
    if (!isOwner) return;
    global.hermesUsers.set(senderClean, { 
        startedAt: Date.now(),
        chatId: id,
        pushname: pushname
    });
    await reactm("🤖");
    return reply("🤖 *MODE HERMES AKTIF*\n\nSemua pesan selanjutnya akan diteruskan ke Hermas AI.\nKetik .exithermes untuk keluar.");
}
case "exithermes": {
    if (!isOwner) return;
    if (global.hermesUsers.has(senderClean)) {
        global.hermesUsers.delete(senderClean);
        await reactm("✅");
        return reply("✅ *MODE HERMES NONAKTIF*\n\nKembali ke mode bot normal.");
    }
    return reply("ℹ️ Tidak dalam mode Hermes.");
}
        case "public": {
            if (!isOwner) return;
            global.botMode = "public";
            await reactm("🌐");
            return reply("🌐 *BERHASIL*\nMode bot telah diubah menjadi *PUBLIC* (Merespon semua orang & grup).");
        }
        case "strict": {
            if (!isOwner) return;
            global.botMode = "strict";
            await reactm("🛡️");
            return reply("🛡️ *BERHASIL*\nMode bot telah diubah menjadi *STRICT* (Hanya merespon Whitelist).");
        }



        }
    } catch (e) { console.log("Terjadi error di case.js:", e); }
}
