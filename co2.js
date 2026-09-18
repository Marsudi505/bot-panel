/* BAWX PROJECT - CO2.JS (MESIN CHECKOUT V2 - SUPER CHECKOUT MODE)
   - Logic: /sco Integration (Super Checkout 1 Blok)
   - Fitur: Auto Hapus Akun, Tambah Akun, /sco (Toko, Range, Metode, PLU, Kupon)
   - Interface: Progress Bar Clean, Splitted Forwardable Receipt
   - Optimization: Memory Caching & Removed Heavy Fake Quote
*/

import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { NewMessage } from "telegram/events/index.js";
import input from "input";
import chalk from "chalk";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import os from "os";
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { sendInteractiveMessage } = require('baileys_helper');

// ============================================================
// 👇 KONFIGURASI GLOBAL
// ============================================================
const TG_API_ID = 30042890; 
const TG_API_HASH = "1012659099f45a9315c3b56aeff66be6"; 
const TARGET_TG_BOT = "Jh13m_bot"; 
const SUPER_ADMINS = ['628553056669', '7289096413331', '175058655965193']; 
const ADMIN_REPORT_JID = "6285xxxxx090@s.whatsapp.net"; 

const MENU_IMAGE_URL = 'https://files.catbox.moe/gdg5yl.jpg'; 
const LOCAL_MENU_PATH = './menu.jpg'; 
const FALLBACK_MENU_URL = 'https://files.catbox.moe/gdg5yl.jpg'; 

const DB_FILE = './database_v2.json'; 
const HISTORY_FILE = './history_v2.json';
const FINANCE_FILE = './finance_v2.json';
const ADMINS_FILE = './admins.json'; 

// --- MEMORY CACHE (UNTUK KECEPATAN INSTAN) ---
let dbCache = null;
let historyCache = null;
let financeCache = null;
let adminCache = null;
let menuBufferCache = null;

let wa, tg, tgEntityKlik;
let isTgInitialized = false; 
const sessions = {}; 
let isStoreOpen = true; 

let co2Queue = []; 
let activeCo2Request = null; 
let currentTgWait = null; 
const pendingTransactions = {}; 

// --- HELPERS ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms)); 
const getBuffer = async (url) => { try { return (await axios({ method: 'get', url, responseType: 'arraybuffer', timeout: 10000 })).data; } catch (e) { return null; } };

const getMenuImage = async () => { 
    if (menuBufferCache) return menuBufferCache;
    try { 
        if (fs.existsSync(LOCAL_MENU_PATH)) {
            menuBufferCache = fs.readFileSync(LOCAL_MENU_PATH);
        } else {
            const res = await axios({ url: FALLBACK_MENU_URL, responseType: 'arraybuffer', timeout: 10000 });
            menuBufferCache = res.data;
        }
        return menuBufferCache;
    } catch (e) { return null; } 
};

function loadAdmins() { 
    if (adminCache) return adminCache;
    try { 
        if (!fs.existsSync(ADMINS_FILE)) { fs.writeFileSync(ADMINS_FILE, JSON.stringify(SUPER_ADMINS, null, 2)); adminCache = SUPER_ADMINS; return adminCache; } 
        adminCache = JSON.parse(fs.readFileSync(ADMINS_FILE)); 
        return adminCache;
    } catch { return []; } 
}
function saveAdmins(data) { adminCache = data; fs.writeFileSync(ADMINS_FILE, JSON.stringify(data, null, 2)); }

function loadDatabase() { 
    if (dbCache) return dbCache;
    try { 
        if (!fs.existsSync(DB_FILE)) { fs.writeFileSync(DB_FILE, '{}'); dbCache = {}; return dbCache; } 
        dbCache = JSON.parse(fs.readFileSync(DB_FILE)); 
        return dbCache;
    } catch { return {}; } 
}
function saveDatabase(data) { dbCache = data; fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2)); }

function loadHistory() { 
    if (historyCache) return historyCache;
    try { 
        if (!fs.existsSync(HISTORY_FILE)) { fs.writeFileSync(HISTORY_FILE, '{}'); historyCache = {}; return historyCache; } 
        historyCache = JSON.parse(fs.readFileSync(HISTORY_FILE)); 
        return historyCache;
    } catch { return {}; } 
}
function saveHistory(data) { historyCache = data; fs.writeFileSync(HISTORY_FILE, JSON.stringify(data, null, 2)); }

function addHistory(jid, number, kode, plu) { 
    const db = loadHistory(); 
    if (!db[jid]) db[jid] = []; 
    db[jid].unshift({ number, kode, plu, timestamp: Date.now(), readableTime: new Date().toLocaleString('id-ID') }); 
    saveHistory(db); 
}

function loadFinance() { 
    if (financeCache) return financeCache;
    try { 
        if (!fs.existsSync(FINANCE_FILE)) { fs.writeFileSync(FINANCE_FILE, '{}'); financeCache = {}; return financeCache; } 
        financeCache = JSON.parse(fs.readFileSync(FINANCE_FILE)); 
        return financeCache;
    } catch { return {}; } 
}
function saveFinance(data) { financeCache = data; fs.writeFileSync(FINANCE_FILE, JSON.stringify(data, null, 2)); }

function getSession(jid) { if (!sessions[jid]) sessions[jid] = { status: 'IDLE', selectedAccounts: [], kodeToko: '', plu: '' }; return sessions[jid]; }

const parseIndices = (input) => {
    const sel = [];
    const cleanInput = input.replace(/\s/g, ''); 
    if (cleanInput.includes('-')) {
        const [s, e] = cleanInput.split('-').map(Number);
        if (!isNaN(s) && !isNaN(e)) for (let i = s; i <= e; i++) sel.push(i - 1);
    } else if (cleanInput.includes(',')) {
        cleanInput.split(',').forEach(n => { if (!isNaN(n)) sel.push(Number(n) - 1); });
    } else {
        if (!isNaN(cleanInput)) sel.push(Number(cleanInput) - 1);
    }
    return sel;
};

// ============================================================
// 🌟 PROGRESS BAR
// ============================================================

async function startProgressBarV2(jid, customText, fquote) {
    let { key } = await wa.sendMessage(jid, { text: `[▒▒▒▒▒▒▒▒▒▒] 0% - ${customText}` }, { quoted: fquote });
    let progress = 0;
    const interval = setInterval(async () => {
        progress += 10; if (progress > 90) progress = 90;
        let bar = "█".repeat(progress / 10) + "▒".repeat(10 - (progress / 10));
        try { await wa.sendMessage(jid, { text: `[${bar}] ${progress}% - ${customText}`, edit: key }); } catch (e) { clearInterval(interval); }
    }, 4000); 
    return { interval, key };
}

// ============================================================
// 🛡️ SISTEM PENUTUP & PELAPOR 
// ============================================================
async function endActiveRequest(isCrash = false, crashReason = "") {
    if (!activeCo2Request) return;
    const req = activeCo2Request; activeCo2Request = null; 
    clearTimeout(req.timeout); clearInterval(req.pbar.interval);
    try { await wa.sendMessage(req.jid, { delete: req.pbar.key }); } catch(e){}

    const successSet = new Set(req.successNumbers);
    const failedAccounts = req.accounts.filter(acc => !successSet.has(acc.number));

    if (isCrash) {
        await wa.sendMessage(req.jid, { text: `Terjadi error, pesan error sudah diteruskan ke admin silahkan tunggu` }, { quoted: req.fquote });
        let adminTxt = `⚠️ *[ LAPORAN ERROR V2 ]* ⚠️\n👤 *User:* ${req.jid.split('@')[0]}\n⚙️ *Kendala:* ${crashReason}\n\n📦 *Data Semua Akun:*\n${req.accounts.map(a => a.fullData).join('\n')}`;
        if (failedAccounts.length > 0) adminTxt += `\n\n❌ *Akun Gagal/Belum Selesai:*\n${failedAccounts.map(a => a.fullData).join('\n')}`;
        await wa.sendMessage(ADMIN_REPORT_JID, { text: adminTxt });
    } else {
        if (failedAccounts.length > 0) {
            let adminTxt = `⚠️ *[ LAPORAN ERROR V2 ]* ⚠️\n👤 *User:* ${req.jid.split('@')[0]}\n⚙️ *Kendala:* Sebagian/Semua akun gagal Checkout\n\n📦 *Data Semua Akun:*\n${req.accounts.map(a => a.fullData).join('\n')}\n\n❌ *Akun Gagal/Nyangkut:*\n${failedAccounts.map(a => a.fullData).join('\n')}`;
            await wa.sendMessage(ADMIN_REPORT_JID, { text: adminTxt });
        }
        await wa.sendMessage(req.jid, { text: `${req.accounts.length} Sudah selesai 🙏` }, { quoted: req.fquote });
    }
    try { await tg.sendMessage(TARGET_TG_BOT, { message: 'N' }); } catch(e){}
    setTimeout(processCo2Queue, 1500); 
}

// ============================================================
// 🤖 MESIN PING-PONG TELEGRAM (V2 LOGIC)
// ============================================================
async function tgWait(keywords, timeoutMs = 20000) {
    if (!Array.isArray(keywords)) keywords = [keywords];
    if (keywords.length === 0) keywords = [''];
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { currentTgWait = null; reject(`TIMEOUT`); }, timeoutMs);
        currentTgWait = { keywords: keywords.map(k => k.toUpperCase()), resolve: (text) => { clearTimeout(timer); currentTgWait = null; resolve(text); } };
    });
}

async function processCo2Queue() {
    if (activeCo2Request || co2Queue.length === 0) return; 
    activeCo2Request = co2Queue.shift(); 
    try {
        activeCo2Request.phase = 0; 
        activeCo2Request.pbar = await startProgressBarV2(activeCo2Request.jid, "Sedang diproses...", activeCo2Request.fquote);

        await tg.sendMessage(TARGET_TG_BOT, { message: 'N' }); await sleep(2000); 

        await tg.sendMessage(TARGET_TG_BOT, { message: '/hapusakun' }); await tgWait('YAKIN', 15000); await sleep(3000); 
        await tg.sendMessage(TARGET_TG_BOT, { message: 'y' }); await tgWait(['BERHASIL', 'SUKSES'], 15000); 

        activeCo2Request.phase = 1; await sleep(3000); 
        await tg.sendMessage(TARGET_TG_BOT, { message: '/tambahakun' }); await tgWait('AKUN', 15000); await sleep(3000); 
        const accString = activeCo2Request.accounts.map(a => a.fullData).join('\n');
        await tg.sendMessage(TARGET_TG_BOT, { message: accString }); await tgWait(['BERHASIL', 'LIST', 'SUKSES'], 15000); 

        activeCo2Request.phase = 2; await sleep(3000); 
        await tg.sendMessage(TARGET_TG_BOT, { message: activeCo2Request.scoMsg });

        activeCo2Request.timeout = setTimeout(async () => { if (activeCo2Request) endActiveRequest(true, "Timeout Server (Melewati 3 menit)"); }, 180000); 

    } catch (err) { if (activeCo2Request) endActiveRequest(true, `Sistem Nyangkut/Crash\n${err}`); }
}

// ============================================================
// 🔥 INISIALISASI TELEGRAM V2
// ============================================================
export async function initTG2(waSocket) {
    wa = waSocket;
    if (isTgInitialized) return;
    isTgInitialized = true;
    
    // Load Caches on Startup
    loadDatabase();
    loadHistory();
    loadFinance();
    loadAdmins();
    getMenuImage();

    console.log(chalk.yellow("\n[*] Menyiapkan koneksi Telegram V2..."));
    const sessionStr = fs.existsSync('tg_session_v2.txt') ? fs.readFileSync('tg_session_v2.txt', 'utf8') : "";
    const session = new StringSession(sessionStr);
    tg = new TelegramClient(session, parseInt(TG_API_ID), TG_API_HASH, { connectionRetries: 5 });

    await tg.start({
        phoneNumber: async () => await input.text("📱 Masukkan Nomor Telegram (+62...): "),
        password: async () => await input.text("🔑 Masukkan Password 2FA (jika ada): "),
        phoneCode: async () => await input.text("📩 Masukkan Kode OTP Telegram V2: "),
        onError: (err) => console.log(err),
    });
    
    console.log(chalk.green(`[+] Telegram V2 Berhasil Terhubung ke ${TARGET_TG_BOT}!`));
    fs.writeFileSync('tg_session_v2.txt', tg.session.save());
    
    try { tgEntityKlik = await tg.getEntity(TARGET_TG_BOT); } 
    catch (e) { console.log(chalk.red(`[ERROR] Bot Telegram Target (${TARGET_TG_BOT}) belum dikenali.`)); }

    tg.addEventHandler(async (ev) => {
        const msg = ev.message;
        const senderId = msg.peerId?.userId?.value;
        if (!tgEntityKlik || senderId !== tgEntityKlik.id.value) return; 

        const text = msg.message || "";
        if (!text) return;

        if (currentTgWait) { const upperText = text.toUpperCase(); if (currentTgWait.keywords.some(k => upperText.includes(k) || k === '')) { currentTgWait.resolve(text); } }

        let targetJid = null, targetFquote = null; 
        const isSuccessReceipt = (text.toUpperCase().includes("KDTK") || text.toUpperCase().includes("TOKO") || text.toUpperCase().includes("SALES ORDER")) && text.toUpperCase().includes("TOTAL") && !text.toUpperCase().includes("KERANJANG");
        const hpMatch = text.match(/(?:NO\s*HP|PHONE\s*NUMBER)\s*:\s*(\d+)/i);
        const gagalMatch = text.match(/(?:GAGAL\s*:\s*|❌\s*)(\d+)/i);
        const isProsesSelesai = text.toUpperCase().includes("PROSES SELESAI SEMUA") || text.toUpperCase().includes("PROSES SELESAI !");

        if (hpMatch) {
            let extractedHp = hpMatch[1]; if (extractedHp.startsWith('62')) extractedHp = '0' + extractedHp.substring(2); 
            if (pendingTransactions[extractedHp]) { targetJid = pendingTransactions[extractedHp].jid; targetFquote = pendingTransactions[extractedHp].fquote; }
        } 
        if (gagalMatch && !targetJid) {
            let extractedHp = gagalMatch[1]; if (extractedHp.startsWith('62')) extractedHp = '0' + extractedHp.substring(2); 
            if (pendingTransactions[extractedHp]) { targetJid = pendingTransactions[extractedHp].jid; targetFquote = pendingTransactions[extractedHp].fquote; }
        }
        if (!targetJid && activeCo2Request && (isSuccessReceipt || gagalMatch)) { targetJid = activeCo2Request.jid; targetFquote = activeCo2Request.fquote; }

        // 🚀 FORWARD PESAN KE WA TARGET DENGAN FORMAT TERPISAH (GAMBAR BISA DIFORWARD) 🔥
        if (targetJid && !isProsesSelesai) {
            const barcodeMatch = text.match(/(https?:\/\/[^\s]+barcode[^\s]+)/i);
            const vaBcaMatch = text.match(/VA_BCA\s*:\s*(\d+)/i);
            const ppMatch = text.match(/(?:PAYMENT|KODE\s*BAYAR)\s*:\s*([A-Z0-9]+)/i); 
            const displayHp = hpMatch ? hpMatch[1] : "-";
            const msgText = `[SERVER]\n\n${text}`;

            if (barcodeMatch) {
                const imgBuffer = await getBuffer(barcodeMatch[1]);
                // 1. Kirim Barcode + Teks
                if (imgBuffer) { await wa.sendMessage(targetJid, { image: imgBuffer, caption: msgText }, { quoted: targetFquote }); } 
                else { await wa.sendMessage(targetJid, { text: msgText }, { quoted: targetFquote }); }

                // 2. Susul dengan Tombol Copy PP
                if (ppMatch && ppMatch[1]) {
                    try { await sendInteractiveMessage(wa, targetJid, { text: `💳 *INFO PAYMENT POINT*\n📱 Nomor: ${displayHp}\n\nSilakan salin kode di bawah ini:`, interactiveButtons: [ { name: 'cta_copy', buttonParamsJson: JSON.stringify({ display_text: 'Copy Payment Point', copy_code: `${ppMatch[1]}` }) } ] }); } catch (err) {}
                }

            } else if (vaBcaMatch && vaBcaMatch[1]) {
                await wa.sendMessage(targetJid, { text: msgText }, { quoted: targetFquote });
                try { await sendInteractiveMessage(wa, targetJid, { text: `💳 *INFO VA BCA*\n📱 Nomor: ${displayHp}\n\nSilakan salin kode di bawah ini:`, interactiveButtons: [ { name: 'cta_copy', buttonParamsJson: JSON.stringify({ display_text: 'Copy VA BCA', copy_code: `${vaBcaMatch[1]}` }) } ] }); } catch (err) {}

            } else if (ppMatch && ppMatch[1]) {
                await wa.sendMessage(targetJid, { text: msgText }, { quoted: targetFquote });
                try { await sendInteractiveMessage(wa, targetJid, { text: `💳 *INFO PAYMENT POINT*\n📱 Nomor: ${displayHp}\n\nSilakan salin kode di bawah ini:`, interactiveButtons: [ { name: 'cta_copy', buttonParamsJson: JSON.stringify({ display_text: 'Copy Payment Point', copy_code: `${ppMatch[1]}` }) } ] }); } catch (err) {}

            } else {
                await wa.sendMessage(targetJid, { text: msgText }, { quoted: targetFquote });
            }
        }

        // 🔥 LOGIKA MENGHITUNG & MENYELESAIKAN ANTREAN 🔥
        if (activeCo2Request && activeCo2Request.phase === 2) {
            if (isSuccessReceipt) {
                if (hpMatch) { let extHp = hpMatch[1]; if (extHp.startsWith('62')) extHp = '0' + extHp.substring(2); activeCo2Request.successNumbers.push(extHp); }
                activeCo2Request.receivedReplies++; 
            } else if (gagalMatch) { activeCo2Request.receivedReplies++; }

            if (isProsesSelesai || activeCo2Request.receivedReplies >= activeCo2Request.expectedReplies) { 
                endActiveRequest(false); 
            }
        }

        for (const num in pendingTransactions) { if (Date.now() - pendingTransactions[num].time > 900000) delete pendingTransactions[num]; }

    }, new NewMessage({ incoming: true }));
}

// ============================================================
// 🔥 PENANGANAN PERINTAH BAWX V2
// ============================================================
export async function handleCo2Command(waSocket, msg, chatJid, senderJid, senderNum, pushname, trimmedBody, isGroup) {
    wa = waSocket;
    const userSession = getSession(senderJid); 
    const isCommand = trimmedBody.startsWith('.') || trimmedBody.startsWith('/');
    const isSessionActive = userSession.status !== 'IDLE';
    if (!isCommand && !isSessionActive) return; 
    
    const rawCommand = trimmedBody.split(' ')[0].toLowerCase();
    const command = rawCommand.startsWith('/') ? '.' + rawCommand.substring(1) : rawCommand;
    const args = trimmedBody.substring(rawCommand.length).trim();

    // 🔥 PERBAIKAN: Menggunakan pesan asli sebagai quote agar instan
    const fquote = msg;

    if (command === '.menu' || command === '.help') {
        const menuBuffer = await getMenuImage();
        let menuText = `Halo @${senderNum} (MODE CO V2)\nStatus Toko: ${isStoreOpen ? "BUKA [V]" : "TUTUP [X]"}\n\n┏ *[ MANAJEMEN DATA V2 ]*\n┣ /add [Nomor|Pass|DeviceID]\n┣ /list (Lihat Data)\n┣ /get [urutan]\n┗ /hapus [urutan]\n\n┏ *[ TRANSAKSI V2 ]*\n┣ /co (Mulai Checkout)\n┣ /batal (Batalkan Sesi)\n┗ /exitco (Keluar Mode V2)\n\n┏ *[ MENU ADMIN ]*\n┗ /restart (Restart Termux)\n\n_Mesin Siluman Aktif 🤖_`;
        if (menuBuffer) await wa.sendMessage(chatJid, { image: menuBuffer, caption: menuText, mentions: [senderJid] }, { quoted: fquote });
        else await wa.sendMessage(chatJid, { text: menuText, mentions: [senderJid] }, { quoted: fquote });
        return; 
    }

    if (command === '.batal') { 
        sessions[senderJid] = { status: 'IDLE' }; co2Queue = co2Queue.filter(req => req.jid !== chatJid); 
        if (activeCo2Request && activeCo2Request.jid === chatJid) {
            const req = activeCo2Request; activeCo2Request = null; clearTimeout(req.timeout); clearInterval(req.pbar.interval);
            try { await wa.sendMessage(chatJid, { delete: req.pbar.key }); } catch(e){}
            try { await tg.sendMessage(TARGET_TG_BOT, { message: 'N' }); } catch(e){} 
            setTimeout(processCo2Queue, 1500); 
        }
        await wa.sendMessage(chatJid, { text: '✅ Sesi CO V2 Dibatalkan.' }, { quoted: fquote }); return; 
    }

    if (command === '.add') {
        const db = loadDatabase(); if (!db[chatJid]) db[chatJid] = [];
        const lines = args.split('\n'); let added = 0;
        lines.forEach(line => {
            const cleanLine = line.trim(); if (!cleanLine) return;
            const match = cleanLine.match(/(\d+)/); 
            if (match) { let num = match[0]; if (num.startsWith('62')) num = '0' + num.substring(2); if (!db[chatJid].some(a => a.number === num)) { db[chatJid].push({ number: num, fullData: cleanLine }); added++; } }
        });
        saveDatabase(db); await wa.sendMessage(chatJid, { text: `✅ Disimpan ke Database V2 (${added} Data Masuk).` }, { quoted: fquote }); return;
    }

    if (command === '.list') {
        const nums = loadDatabase()[chatJid] || []; if(nums.length === 0) return wa.sendMessage(chatJid, {text: 'Database Kosong'}, { quoted: fquote });
        const hist = loadHistory(); const userHist = hist[chatJid] || []; const usedNumbers = new Set(userHist.map(item => item.number));
        let t = '[ LIST AKUN V2 ]\n'; nums.forEach((acc, i) => { t += `${i+1}. ${acc.number} - ${usedNumbers.has(acc.number) ? 'OFF [X]' : 'ON [V]'}\n`; });
        await wa.sendMessage(chatJid, { text: t }, { quoted: fquote }); return;
    }

    if (command === '.hapus') {
        const db = loadDatabase(); let nums = db[chatJid] || []; const idxs = parseIndices(args);
        db[chatJid] = nums.filter((_, i) => !idxs.includes(i)); saveDatabase(db); await wa.sendMessage(chatJid, { text: '✅ Data Dihapus.' }, { quoted: fquote }); return;
    }

    if (command === '.get' || command === '/get') {
        const db = loadDatabase(); let nums = db[chatJid] || [];
        if (nums.length === 0) return wa.sendMessage(chatJid, { text: 'Database Kosong' }, { quoted: fquote });
        const idxs = parseIndices(args);
        if (idxs.length === 0) return wa.sendMessage(chatJid, { text: 'Format salah. Contoh: .get 1-10' }, { quoted: fquote });
        const validIdxs = [...new Set(idxs)].filter(i => i >= 0 && i < nums.length).sort((a, b) => a - b);
        if (validIdxs.length === 0) return wa.sendMessage(chatJid, { text: 'Urutan tidak ditemukan di database.' }, { quoted: fquote });

        let resultText = `✅ Ambil ${validIdxs.length} Data V2\n\n`;
        let extractedData = [];
        validIdxs.forEach(idx => { let item = nums[idx]; let textLine = typeof item === 'object' ? item.fullData : item; extractedData.push(textLine); });
        resultText += extractedData.join('\n') + `\n\n_(Dihapus dari list)_`;

        const toRemove = new Set(validIdxs);
        db[chatJid] = nums.filter((_, i) => !toRemove.has(i)); saveDatabase(db);

        try { await sendInteractiveMessage(wa, chatJid, { text: resultText, interactiveButtons: [ { name: 'cta_copy', buttonParamsJson: JSON.stringify({ display_text: 'Salin Semua Data', copy_code: extractedData.join('\n') }) } ] }); } 
        catch (err) { await wa.sendMessage(chatJid, { text: resultText }, { quoted: fquote }); }
        return;
    }

    if (command === '.co') {
        if (!isStoreOpen) return wa.sendMessage(chatJid, { text: 'Toko Tutup' }, { quoted: fquote });
        const nums = loadDatabase()[chatJid] || []; if (nums.length === 0) return wa.sendMessage(chatJid, { text: 'Database Kosong. Gunakan /add dulu.' }, { quoted: fquote });
        const usedNumbers = new Set((loadHistory()[chatJid] || []).map(i => i.number));
        let txt = '[ PILIH AKUN - V2 MODE ]\n'; nums.forEach((acc, i) => { txt += `${i+1}. ${acc.number} - ${usedNumbers.has(acc.number) ? 'OFF [X]' : 'ON [V]'}\n`; });
        txt += '\n> Ketik urutan akun (Contoh: 1-3):';
        userSession.status = 'SELECT_ACCOUNTS'; await wa.sendMessage(chatJid, { text: txt }, { quoted: fquote }); return;
    }

    if (userSession.status === 'SELECT_ACCOUNTS') {
        const nums = loadDatabase()[chatJid] || []; const selectedIndices = parseIndices(trimmedBody); const validAccs = [];
        selectedIndices.forEach(idx => { if(nums[idx]) validAccs.push(nums[idx]); });
        if (validAccs.length === 0) return wa.sendMessage(chatJid, { text: 'Error pilihan.' }, { quoted: fquote });
        userSession.selectedAccounts = validAccs; userSession.status = 'INPUT_KODETOKO';
        await wa.sendMessage(chatJid, { text: `[INFO V2] ${validAccs.length} Akun Dipilih.\n> Masukkan KDTK (4 digit):` }, { quoted: fquote }); return;
    }
    if (userSession.status === 'INPUT_KODETOKO') {
        if(trimmedBody.length!==4) return wa.sendMessage(chatJid, { text: 'Kode harus 4 digit' }, { quoted: fquote });
        userSession.kodeToko = trimmedBody; userSession.status = 'INPUT_PLU';
        await wa.sendMessage(chatJid, { text: `[INFO V2] Kode: ${trimmedBody}\n> Masukkan PLU:QTY atau PLU:QTY:KUPON:` }, { quoted: fquote }); return;
    }
    if (userSession.status === 'INPUT_PLU') {
        userSession.plu = trimmedBody; userSession.status = 'SELECT_FORMAT';
        await wa.sendMessage(chatJid, { text: `[INFO V2] Data Siap.\n\nPILIH METODE BAYAR:\n1. I.SAKU\n2. PAYMENT POINT\n3. BCA\n\n> Ketik angkanya (1/2/3):` }, { quoted: fquote }); return;
    }
    if (userSession.status === 'SELECT_FORMAT') {
        let tipeBayar = ''; if(trimmedBody === '1') tipeBayar = 'ISAKU'; else if(trimmedBody === '2') tipeBayar = 'KASIR'; else if(trimmedBody === '3') tipeBayar = 'BCA'; else return wa.sendMessage(chatJid, {text:'Pilih 1, 2, atau 3'}, { quoted: fquote });
        let rawPlu = userSession.plu; let parts = rawPlu.split(':'); let pluString = parts[0] + (parts[1] ? ':' + parts[1] : ''); let kuponString = parts[2] ? parts[2] : ''; 
        let scoMsg = `/sco\n${userSession.kodeToko}\n1-${userSession.selectedAccounts.length}\n${tipeBayar}\n${pluString}`; if (kuponString) scoMsg += `\n${kuponString}`; 

        const fin = loadFinance(); if (!fin[chatJid]) fin[chatJid] = { balance: 0, buy: 0, sell: 0, sold: 0, omzet: 0, profit: 0 };
        for (const acc of userSession.selectedAccounts) {
            addHistory(chatJid, acc.number, userSession.kodeToko, rawPlu); 
            if(fin[chatJid].sell > 0) { fin[chatJid].sold++; fin[chatJid].omzet += fin[chatJid].sell; fin[chatJid].profit += (fin[chatJid].sell - fin[chatJid].buy); fin[chatJid].balance += fin[chatJid].sell; }
            pendingTransactions[acc.number] = { jid: chatJid, time: Date.now(), fquote: fquote };
        }
        saveFinance(fin);
        
        co2Queue.push({ jid: chatJid, accounts: userSession.selectedAccounts, kodeToko: userSession.kodeToko, plu: userSession.plu, metode: trimmedBody, scoMsg: scoMsg, expectedReplies: userSession.selectedAccounts.length, receivedReplies: 0, successNumbers: [], fquote: fquote, phase: 0 });
        processCo2Queue(); sessions[senderJid] = { status: 'IDLE' }; return;
    }
}
