import { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, getContentType, downloadContentFromMessage, downloadMediaMessage, DisconnectReason, jidNormalizedUser } from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";
import chalk from "chalk";
import readline from "readline";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import handleMessages from "./case.js";
import { serialize } from "./lib/serialize.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function question(prompt) {
  process.stdout.write(prompt);
  const r1 = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => { r1.question("", (ans) => { r1.close(); resolve(ans); }); });
}

const messageCache = new Map();
const CACHE_FILE = path.resolve(__dirname, "antiDeleteCache.json");
const CACHE_LIMIT = 1000;

function loadMessageCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const arr = JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
      for (const m of arr) if (m && m.key && m.key.id && m.message) messageCache.set(m.key.id, m);
      console.log(chalk.green(`📼 Anti-delete: ${messageCache.size} pesan dimuat dari cache file`));
    }
  } catch (e) {
    console.log(chalk.yellow("[ANTI-DELETE] Gagal memuat cache file: " + (e.message || e)));
  }
}

let cacheSaveTimer = null;
function persistMessageCache() {
  if (cacheSaveTimer) return;
  cacheSaveTimer = setTimeout(() => {
    cacheSaveTimer = null;
    try {
      const arr = [...messageCache.values()].slice(-CACHE_LIMIT);
      fs.writeFileSync(CACHE_FILE, JSON.stringify(arr));
    } catch (e) {
      console.log(chalk.yellow("[ANTI-DELETE] Gagal menyimpan cache file: " + (e.message || e)));
    }
  }, 500);
}

function cacheMessage(msg) {
  const id = msg.key?.id;
  if (!id || !msg.message) return;
  if (msg.message.protocolMessage) return;
  const existing = messageCache.get(id);
  if (existing) {
    const existingKeys = Object.keys(existing.message || {});
    const newKeys = Object.keys(msg.message);
    const existingIsViewOnce = existingKeys.some(k => k.toLowerCase().includes("viewonce"));
    const newIsViewOnce = newKeys.some(k => k.toLowerCase().includes("viewonce"));
    if (existingIsViewOnce && !newIsViewOnce) return;
  }
  messageCache.set(id, msg);
  if (messageCache.size > CACHE_LIMIT) messageCache.delete(messageCache.keys().next().value);
  persistMessageCache();
}

const ANTI_DELETE_OWNER_JID = "120363413843884326@g.us";
const MEDIA_TYPES = ["imageMessage", "videoMessage", "audioMessage", "documentMessage", "stickerMessage"];
const capturedBuffer = new Map(); // id -> { buffer, mediaType, caption }

function preCaptureViewOnce(msg) {
  if (!msg || !msg.message) return;
  const base = msg.message.ephemeralMessage
    ? (msg.message.ephemeralMessage.message || msg.message.ephemeralMessage)
    : msg.message;
  const voKey = Object.keys(base).find(k => k.toLowerCase().includes("viewonce"));
  if (!voKey) return;
  let inner = (base[voKey] && base[voKey].message) || base[voKey] || {};
  if (inner.viewedMessage) inner = inner.viewedMessage.message || inner.viewedMessage;
  const mediaType = Object.keys(inner).find(k => MEDIA_TYPES.includes(k));
  if (!mediaType || !inner[mediaType]?.url) return;
  const id = msg.key.id;
  console.log(chalk.blue(`[AD CAPTURE] view-once ${mediaType} DITERIMA, mulai unduh dini (id=${id.slice(0, 16)})...`));
  (async () => {
    try {
      const mType = mediaType.replace("Message", "");
      const stream = await downloadContentFromMessage(inner[mediaType], mType);
      const chunks = [];
      for await (const c of stream) chunks.push(c);
      const buffer = Buffer.concat(chunks);
      capturedBuffer.set(id, { buffer, mediaType, caption: inner[mediaType].caption || "" });
      console.log(chalk.green(`[AD CAPTURE] ✔ ${buffer.length} bytes tersimpan untuk id=${id.slice(0, 16)}`));
    } catch (e) {
      const code = e?.output?.statusCode ?? e?.status ?? e?.statusCode;
      console.log(chalk.yellow(`[AD CAPTURE] unduh dini gagal (${code || "?"}): ${e?.message || e}`));
    }
  })();
}

async function handleAntiDelete(wa, msg) {
  try {
    if (!msg || !msg.key || !msg.key.id) return false;

    // LOG pantauan: tampilkan pesan masuk yg berisi view-once / media / protocol
    if (!msg.message?.protocolMessage) {
      const cKeys = Object.keys(msg.message || {});
      const interesting = cKeys.some(k => k.toLowerCase().includes("viewonce") || MEDIA_TYPES.includes(k));
      if (interesting) {
        console.log(chalk.magenta(`[AD WATCH] pesan masuk id=${msg.key.id} keys=[${cKeys.join(", ")}] fromMe=${!!msg.key.fromMe}`));
      }
    }

    if (msg.message) cacheMessage(msg);

    // PRE-CAPTURE: unduh media view-once sejak diterima (non-revoke)
    if (!msg.message?.protocolMessage) preCaptureViewOnce(msg);

    const proto = msg.message && msg.message.protocolMessage;
    if (!proto || !(proto.type === 0 || proto.type === "REVOKE")) return false;
    if (msg.key.fromMe) return true;

    const deletedKey = proto.key;
    console.log(chalk.magenta(`[AD REVOKE] id=${deletedKey?.id} hit=${messageCache.has(deletedKey?.id)} cache=${messageCache.size}`));
    const originalMsg = messageCache.get(deletedKey.id);
    if (!originalMsg || !originalMsg.message || originalMsg.key.fromMe) {
      console.log(chalk.magenta(`[AD REVOKE] MISS! Keys di cache (${messageCache.size}): ${[...messageCache.keys()].slice(-10).join(", ")}`));
      return true;
    }

    const baseContent = originalMsg.message.ephemeralMessage
      ? (originalMsg.message.ephemeralMessage.message || originalMsg.message.ephemeralMessage)
      : originalMsg.message;

    if (getContentType(baseContent) === "reactionMessage") return true;

    const isViewOnce = Object.keys(baseContent).some(k => k.toLowerCase().includes("viewonce"));
    let inner = baseContent;
    let viewOnceMedia = null;
    if (isViewOnce) {
      const voKey = Object.keys(baseContent).find(k => k.toLowerCase().includes("viewonce"));
      const voMsg = baseContent[voKey];
      inner = (voMsg && voMsg.message) || voMsg || {};
      if (inner.viewedMessage) inner = inner.viewedMessage.message || inner.viewedMessage;
      viewOnceMedia = inner && Object.keys(inner).find(k => MEDIA_TYPES.includes(k));
    }

    const origType = getContentType(inner);
    const isMedia = MEDIA_TYPES.includes(origType) || !!viewOnceMedia;
    const isText = ["conversation", "extendedTextMessage"].includes(origType);
    if (!isMedia && !isText) return true;

    const sender = originalMsg.key.participant || originalMsg.key.remoteJid;
    const formattedSender = `+${sender.split("@")[0]}`;
    const isGroupMsg = originalMsg.key.remoteJid.endsWith("@g.us");
    let groupName = "";
    if (isGroupMsg) {
      try {
        const gm = await wa.groupMetadata(originalMsg.key.remoteJid);
        groupName = gm.subject;
      } catch (e) { groupName = "Grup Tidak Diketahui"; }
    }

    const kindLabel = isMedia ? "MEDIA" : "TEKS";
    let infoText = `🚨 *${kindLabel} DIHAPUS (ANTI-DELETE)* 🚨\n\n`;
    infoText += `File yang dihapus\n`;
    infoText += `Nomor pengirim: ${formattedSender}\n`;
    if (isViewOnce) infoText += `*[View Once]*\n`;
    if (isGroupMsg) infoText += `Nama Grub: ${groupName}\n`;

    try {
      if (isMedia && isViewOnce && viewOnceMedia && inner[viewOnceMedia]) {
        const voDebug = JSON.stringify({
          voKey: Object.keys(baseContent).find(k => k.toLowerCase().includes("viewonce")),
          viewOnceMedia,
          hasUrl: !!inner[viewOnceMedia]?.url,
          hasDp: !!inner[viewOnceMedia]?.directPath,
          hasKey: !!inner[viewOnceMedia]?.mediaKey,
          hasViewed: !!baseContent[Object.keys(baseContent).find(k => k.toLowerCase().includes("viewonce"))]?.message?.viewedMessage,
          mimetype: inner[viewOnceMedia]?.mimetype
        });
        console.log(chalk.blue("[ANTI-DELETE VIEW-ONCE] deteksi: " + voDebug));

        try {
          let buffer = null;
          if (capturedBuffer.has(deletedKey.id) && capturedBuffer.get(deletedKey.id).buffer.length > 0) {
            buffer = capturedBuffer.get(deletedKey.id).buffer;
            console.log(chalk.green(`[ANTI-DELETE VIEW-ONCE] pakai hasil capture dini, ${buffer.length} bytes`));
          } else {
            const strategies = [
              { name: "MediaRetry→reupload", fn: async () => {
                  try {
                    const refreshed = await wa.updateMediaMessage(originalMsg);
                    return await downloadMediaMessage(refreshed, "buffer", {}, { logger: pino({ level: "silent" }) });
                  } catch (e) {
                    return await downloadMediaMessage(originalMsg, "buffer", {}, { reuploadRequest: wa.updateMediaMessage, logger: pino({ level: "silent" }) });
                  }
              } },
              { name: "direct downloadContent", fn: async () => {
                  const mType = viewOnceMedia.replace("Message", "");
                  const stream = await downloadContentFromMessage(inner[viewOnceMedia], mType);
                  const chunks = [];
                  for await (const c of stream) chunks.push(c);
                  return Buffer.concat(chunks);
              } }
            ];
            for (const st of strategies) {
              try {
                buffer = await st.fn();
                if (buffer && buffer.length > 0) break;
              } catch (e) {
                const code = e?.output?.statusCode ?? e?.status ?? e?.statusCode;
                console.log(chalk.yellow(`[ANTI-DELETE VIEW-ONCE] strategi "${st.name}" gagal (${code || "?"}): ${e?.message || e}`));
              }
            }
          }
          if (!buffer || buffer.length === 0) throw new Error("Semua strategi unduh gagal (media 1x lihat mungkin sudah ditandai dilihat/hilang)");
          const sendOpts = { [viewOnceMedia.replace("Message", "")]: buffer };
          const cap = inner[viewOnceMedia]?.caption || "";
          if (cap) sendOpts.caption = cap;
          await wa.sendMessage(ANTI_DELETE_OWNER_JID, sendOpts);
          console.log(chalk.green(`[ANTI-DELETE VIEW-ONCE] berhasil, ${buffer.length} bytes dikirim ulang`));
        } catch (dlErr) {
          console.log(chalk.red("[ANTI-DELETE VIEW-ONCE] Gagal total: ") + (dlErr.message || dlErr));
          // kirim penjelasan, bukan forward yang rusak
          await wa.sendMessage(ANTI_DELETE_OWNER_JID, { text: "⚠️ Media 1x lihat yang dihapus tidak dapat diselamatkan (sudah dilihat/dihapus server WhatsApp).\n\n" + infoText }).catch(() => {});
        }
      } else {
        await wa.sendMessage(ANTI_DELETE_OWNER_JID, { forward: originalMsg });
      }
      await wa.sendMessage(ANTI_DELETE_OWNER_JID, { text: infoText });
    } catch (err) {
      console.log(chalk.red("[ANTI-DELETE ERROR] Gagal meneruskan pesan."));
    }
    return true;
  } catch (e) {
    console.log(chalk.red("[ANTI-DELETE]", e && e.message));
    return false;
  }
}

export async function connectToWhatsApp(upsertCallback) {
  loadMessageCache();

  const LIDPN_CACHE = path.resolve(__dirname, "lidpn-cache.json");
  let lidpnCache = {};
  try { lidpnCache = fs.existsSync(LIDPN_CACHE) ? JSON.parse(fs.readFileSync(LIDPN_CACHE, "utf-8")) : {}; } catch (e) {}
  global.lidpnCache = lidpnCache;
  const saveLidPn = () => {
    try { fs.writeFileSync(LIDPN_CACHE, JSON.stringify(lidpnCache)); } catch (e) {}
  };
  const recordLidPn = (msg) => {
    try {
      const key = msg.key || {};
      const lidCandidates = [key.participantAlt, (key.remoteJidAlt + "").includes("@lid") ? key.remoteJidAlt : null];
      const pnCandidates = [key.participantPn, (key.remoteJidAlt + "").includes("@lid") ? key.remoteJid : (key.remoteJidAlt ? key.remoteJid : null)];
      const lid = lidCandidates.find(v => v && String(v).includes("@lid"));
      const pn = pnCandidates.find(v => v && String(v).includes("@s.whatsapp.net"));
      if (!lid && key.participant && String(key.participant).includes("@s.whatsapp.net")) {
        global.lidpnCache[key.participant.split(":")[0].replace(/@.*$/, "")] = key.participant.split(":")[0].replace(/@.*$/, "");
      }
      if (!lid || !pn) return;
      const lidUser = String(lid).split(":")[0].replace(/@.*$/, "");
      const pnUser = String(pn).split(":")[0].replace(/@.*$/, "");
      if (!lidUser || !pnUser || lidpnCache[lidUser] === pnUser) return;
      lidpnCache[lidUser] = pnUser;
      saveLidPn();
    } catch (e) {}
  };
  global.recordLidPn = recordLidPn;

  const { state, saveCreds } = await useMultiFileAuthState(path.resolve(__dirname, "../BotSesi"));
  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`🚀 Using WA v${version.join(".")}, isLatest: ${isLatest}`);

  const wa = makeWASocket({
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
    auth: state,
    browser: ["Ubuntu", "Chrome", "20.0.04"],
    version,
    syncFullHistory: true,
    generateHighQualityLinkPreview: true
  });

  if (!wa.authState.creds.registered) {
    try {
      const phoneNumber = await question(chalk.yellow("☘️ Masukan Nomor Yang Diawali Dengan 62 :\n"));
      const code = await wa.requestPairingCode(phoneNumber.trim());
      console.log(chalk.green.bold(`\n🎁 KODE PAIRING ANDA: ${code}\n`));
    } catch (err) {
      console.error("Failed to get pairing code:", err);
    }
  }

  wa.ev.on("creds.update", saveCreds);

  // ANTI-DELETE: Baileys sering mengirim penghapusan (REVOKE) via messages.update
  wa.ev.on("messages.update", async (updates) => {
    for (const u of updates || []) {
      if (!u) continue;
      const proto = u.protocolMessage || u.update?.message?.protocolMessage || u.update?.protocolMessage;
      if (proto) {
        const fakeMsg = { key: u.protocolMessage?.key || u.key || proto.key, message: { protocolMessage: proto }, pushName: "" };
        await handleAntiDelete(wa, fakeMsg);
      }
    }
  });

  wa.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      // QR pairing hanya dipakai jika bukan pairing code
      console.log(chalk.yellow("📱 Scan QR untuk pairing..."));
    }
    if (connection === "close") {
      const reasonCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
      const reasonName = Object.keys(DisconnectReason).find(k => DisconnectReason[k] === reasonCode) || "unknown";

      console.log(chalk.red(`🔌 Disconnected (${reasonName})`));

      const shouldExit = [DisconnectReason.loggedOut, DisconnectReason.connectionReplaced, DisconnectReason.badSession].includes(reasonCode);
      if (shouldExit) {
        console.log(chalk.red(`🚪 ${reasonName}: sesi tidak valid/logged out. Bot berhenti.`));
        process.exit(1);
      }

      // Severity rendah (connectionClosed, connectionLost, timedOut, restartRequired, dll) → reconnect
      console.log(chalk.yellow(`🔄 Mencoba menyambung ulang (${reasonName})...`));
      setTimeout(() => connectToWhatsApp(upsertCallback), 3000);
    } else if (connection === "open") {
      console.log(chalk.green("✔  Bot Berhasil Terhubung Ke WhatsApp"));
    }
  });

  wa.ev.on("messages.upsert", async (m) => {
    const msg = m.messages[0];
    if (!msg) return;

    // Catat mapping LID ↔ PN ke cache lokal (persisten di file)
    if (global.recordLidPn) global.recordLidPn(msg);

    // ANTI-DELETE: cache semua pesan masuk + tangkap penghapusan (sebelum filter mode)
    if (await handleAntiDelete(wa, msg)) return;

    if (!msg.message) return;
    
    // Log pesan masuk ke terminal agar terlihat aktif
    const pushName = msg.pushName || "User";
    const chatJid = msg.key.remoteJid;
    const type = getContentType(msg.message);
    let text = (type === "conversation") ? msg.message.conversation : (type === "extendedTextMessage") ? msg.message.extendedTextMessage.text : "[Media]";
    console.log(chalk.cyan(`[PESAN MASUK] `) + chalk.white(`from: ${pushName} (${chatJid})`) + `\n➡️ ${text}`);

    // --- FILTER MODE BOT ---
    const isFromBotSelf = !!msg.key.fromMe;
    const rawSender = msg.key.participantAlt || msg.key.participantPn || msg.key.participant || msg.key.remoteJidAlt || msg.key.remoteJid || chatJid;
    let senderClean;
    try { senderClean = jidNormalizedUser(rawSender); } catch (e) { senderClean = rawSender; }
    const senderNum = senderClean.split("@")[0];
    const isOwner = isFromBotSelf || senderNum === "6285790374090" || senderNum.startsWith("6285790374090");
    
    const text_lower = text ? text.toLowerCase().trim() : "";
    const isModeCmd = text_lower === ".self" || text_lower === ".public" || text_lower === ".strict" || text_lower === "self" || text_lower === "public" || text_lower === "strict";

    // --- HERMES MODE: forward ke Hermes AI ---
    if (global.hermesUsers && global.hermesUsers.has(senderClean)) {
        if (text_lower === ".exithermes" || text_lower === "exithermes") {
            // Biar case.js yang handle .exithermes
        } else if (text && text.trim()) {
            console.log(chalk.blue(`[HERMES] Forwarding message from ${senderNum} to Hermes...`));
            try {
                await wa.sendMessage(chatJid, { text: "🤖 Memproses..." }, { quoted: msg });
                
                const { exec } = await import("child_process");
                const hermesQuery = text.replace(/"/g, '\\"').replace(/\$/g, '\\$');
                const command = `hermes chat -q "${hermesQuery}" --yolo --max-turns 5 2>&1`;
                
                exec(command, { timeout: 120000, maxBuffer: 10 * 1024 * 1024 }, async (err, stdout, stderr) => {
                    try {
                        let response = stdout || "";
                        // Bersihkan output hermes dari header/footer
                        const lines = response.split("\n");
                        const startIdx = lines.findIndex(l => l.includes("╭─") || l.includes("Hermes"));
                        const endIdx = lines.findIndex((l, i) => i > startIdx && (l.includes("╰─") || l.includes("Session:")));
                        if (startIdx !== -1 && endIdx !== -1) {
                            response = lines.slice(startIdx + 1, endIdx).join("\n").trim();
                        } else {
                            // Fallback: ambil setelah reasoning box
                            const reasoningEnd = lines.findIndex(l => l.includes("└─"));
                            if (reasoningEnd !== -1) {
                                response = lines.slice(reasoningEnd + 1).join("\n").trim();
                            }
                        }
                        
                        if (err && !response) {
                            response = `❌ Error: ${err.message || "Hermes gagal memproses"}`;
                        }
                        if (stderr && !response) {
                            response = `⚠️ ${stderr.substring(0, 500)}`;
                        }
                        if (!response) {
                            response = "✅ Hermes selesai tanpa output.";
                        }
                        
                        await wa.sendMessage(chatJid, { text: response }, { quoted: msg });
                    } catch (sendErr) {
                        console.error("[HERMES] Error sending response:", sendErr.message);
                    }
                });
            } catch (hermesErr) {
                console.error("[HERMES] Error:", hermesErr.message);
                await wa.sendMessage(chatJid, { text: "❌ Gagal menghubungkan ke Hermes." }, { quoted: msg });
            }
            return; // Skip normal processing
        }
    }
    // -----------------------

    if (!isOwner && !isModeCmd) {
        console.log('[DEBUG] mode:', global.botMode, 'sender:', senderNum, 'owner:', isOwner);
        if (global.botMode === "self") return; // Diam saja kalau mode self dan bukan owner
        if (global.botMode === "strict") {
            const fs = require('fs');
            let allowed = [];
            try { allowed = JSON.parse(fs.readFileSync('./allowed_users.json', 'utf-8')); } catch(e){}
            if (!allowed.includes(senderNum) && !allowed.includes(chatJid.split("@")[0])) return; // Diam saja jika tidak terdaftar
        }
    }
    // -----------------------

    // 1. Panggil case.js
    try {
        const serM = serialize(m);
        await handleMessages(wa, msg, serM, m);
    } catch (err) {
        console.error("Error di case.js:", err);
    }

    // 2. Panggil callback upsert di index.js
    if (upsertCallback) {
        try {
            await upsertCallback(wa, msg, m);
        } catch (err) {
            console.error("Error di index callback:", err);
        }
    }
  });

  // AUTO BACKUP SENDER: kirim tar.gz baru dari ~/backups ke owner
  const OWNER_JID = "120363413843884326@g.us";
  const BACKUP_DIR = path.resolve(__dirname, "../backups");
  const SENT_MARKER = path.resolve(BACKUP_DIR, ".sent-backups");

  const getSentList = () => {
    try {
      return fs.existsSync(SENT_MARKER) ? JSON.parse(fs.readFileSync(SENT_MARKER, "utf-8")) : [];
    } catch (e) { return []; }
  };
  const saveSentList = (list) => {
    try { fs.writeFileSync(SENT_MARKER, JSON.stringify(list)); } catch (e) {}
  };

  const sendNewBackups = async () => {
    if (!fs.existsSync(BACKUP_DIR)) return;
    const sent = getSentList();
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => /^bot-panel-\d+-\d+\.tar\.gz$/.test(f))
      .sort();
    for (const f of files) {
      if (sent.includes(f)) continue;
      const fp = path.join(BACKUP_DIR, f);
      const size = fs.statSync(fp).size;
      try {
        await wa.sendMessage(OWNER_JID, {
          document: fs.readFileSync(fp),
          mimetype: "application/gzip",
          fileName: f,
          caption: `📦 *BACKUP OTOMATIS*\n\n🕐 Waktu : ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}\n💾 File  : ${f}\n📏 Size  : ${(size / 1048576).toFixed(2)} MB`
        });
        sent.push(f);
        saveSentList(sent);
        console.log("📦 Backup terkirim ke owner:", f);
      } catch (e) {
        console.error("Gagal kirim backup:", f, e.message);
      }
    }
  };

  // Cek setiap 5 menit; langsung cek sekali saat bot online
  setTimeout(sendNewBackups, 30000);
  setInterval(sendNewBackups, 5 * 60 * 1000);

  return wa;
}
