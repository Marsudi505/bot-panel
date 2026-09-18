/* BAWX PROJECT V44 - OPTIMIZED FOR SPEED
   - Engine: Lenwy (Baileys v7 + GramJS)
   - Optimization: Memory Caching & Removed Heavy Fake Quote
*/

import { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, getContentType, DisconnectReason } from "@whiskeysockets/baileys";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { NewMessage } from "telegram/events/index.js";
import input from "input";
import pino from "pino";
import chalk from "chalk";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import os from "os";

// Import Helper untuk Tombol Copy
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { sendInteractiveMessage } = require('baileys_helper');

// ============================================================
// 👇 KONFIGURASI
// ============================================================
const TG_API_ID = 30042890; 
const TG_API_HASH = "1012659099f45a9315c3b56aeff66be6"; 
const TARGET_TG_BOT = "Auto_Order_KLIK_bot"; 

const NOMOR_BOT_ANDA = "628553056669"; 
const ID_GRUP_TARGET = ['120363406018124885@g.us', '120363407313936563@g.us']; 
const SUPER_ADMINS = ['628553056669', '7289096413331', '175058655965193']; 
const ADMIN_REPORT_JID = "6285xxxxx090@s.whatsapp.net"; 

const LOCAL_MENU_PATH = './menu.jpg'; 
const FALLBACK_MENU_URL = 'https://files.catbox.moe/gdg5yl.jpg'; 
const QRIS_IMAGE_URL = 'https://files.catbox.moe/gdg5yl.jpg'; 

const DB_FILE = './database.json'; 
const HISTORY_FILE = './history.json';
const FINANCE_FILE = './finance.json';
const ADMINS_FILE = './admins.json'; 

// --- MEMORY CACHE (UNTUK KECEPATAN INSTAN) ---
let dbCache = null;
let historyCache = null;
let financeCache = null;
let adminCache = null;
let menuBufferCache = null;

// --- VARIABLES GLOBALS ---
let wa, tg, tgEntityKlik;
let isTgInitialized = false;
const sessions = {}; 
let isStoreOpen = true; 

const pendingTransactions = {}; 
let coQueue = []; 
let activeCoRequest = null; 

// --- HELPERS ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

const rupiah = (number) => { return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(number); }
function getSession(jid) { if (!sessions[jid]) sessions[jid] = { status: 'IDLE', selectedNumbers: [], kodeToko: '', plu: '' }; return sessions[jid]; }

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

// --- SYSTEM END REQUEST ---
async function endActiveRequest(isCrash = false, crashReason = "") {
    if (!activeCoRequest) return;
    const req = activeCoRequest; activeCoRequest = null; 
    clearTimeout(req.timeout);

    const successSet = new Set(req.successNumbers);
    const failedAccounts = req.selectedNumbers.filter(num => !successSet.has(num));
    const currentUserNum = req.jid.split('@')[0];

    if (isCrash) {
        await wa.sendMessage(req.jid, { text: `Terjadi error, pesan error sudah diteruskan ke admin silahkan tunggu` }, { quoted: req.fquote });
        let adminTxt = `⚠️ *[ LAPORAN ERROR V1 ]* ⚠️\n👤 *User:* ${currentUserNum}\n⚙️ *Kendala:* ${crashReason}\n\n📦 *Data Semua Akun:*\n${req.selectedNumbers.join('\n')}`;
        if (failedAccounts.length > 0) adminTxt += `\n\n❌ *Akun Gagal/Belum Selesai:*\n${failedAccounts.join('\n')}`;
        await wa.sendMessage(ADMIN_REPORT_JID, { text: adminTxt });
    } else {
        if (failedAccounts.length > 0) {
            let adminTxt = `⚠️ *[ LAPORAN ERROR V1 ]* ⚠️\n👤 *User:* ${currentUserNum}\n⚙️ *Kendala:* Sebagian/Semua akun gagal Checkout\n\n📦 *Data Semua Akun:*\n${req.selectedNumbers.join('\n')}\n\n❌ *Akun Gagal/Nyangkut:*\n${failedAccounts.join('\n')}`;
            await wa.sendMessage(ADMIN_REPORT_JID, { text: adminTxt });
        }
        await wa.sendMessage(req.jid, { text: `${req.selectedNumbers.length} Sudah selesai 🙏` }, { quoted: req.fquote });
    }
    setTimeout(processCoQueue, 1500); 
}

async function processCoQueue() {
    if (activeCoRequest || coQueue.length === 0) return; 
    activeCoRequest = coQueue.shift(); 
    
    await tg.sendMessage(TARGET_TG_BOT, { message: activeCoRequest.tgMsg });
    await wa.sendMessage(activeCoRequest.jid, { text: `⏳ [ ░░░░░░░░░░ ] Pesanan sedang diproses server...` }, { quoted: activeCoRequest.fquote });

    activeCoRequest.timeout = setTimeout(async () => {
        if (activeCoRequest) endActiveRequest(true, "Timeout Server (Bot Telegram melebihi 3 menit)");
    }, 180000); 
}

export async function initTG(waSocket) {
    wa = waSocket;
    if (isTgInitialized) return;
    isTgInitialized = true;
    
    // Load Caches on Startup
    loadDatabase();
    loadHistory();
    loadFinance();
    loadAdmins();
    getMenuImage();

    console.log(chalk.yellow("\n[*] Menyiapkan koneksi Telegram..."));
    const sessionStr = fs.existsSync('tg_session.txt') ? fs.readFileSync('tg_session.txt', 'utf8') : "";
    const session = new StringSession(sessionStr);
    tg = new TelegramClient(session, parseInt(TG_API_ID), TG_API_HASH, { connectionRetries: 5 });

    await tg.start({
        phoneNumber: async () => await input.text("📱 Masukkan Nomor Telegram (+62...): "),
        password: async () => await input.text("🔑 Masukkan Password 2FA (jika ada): "),
        phoneCode: async () => await input.text("📩 Masukkan Kode OTP Telegram: "),
        onError: (err) => console.log(err),
    });
    
    console.log(chalk.green("[+] Telegram Berhasil Terhubung!"));
    fs.writeFileSync('tg_session.txt', tg.session.save());
    
    try { tgEntityKlik = await tg.getEntity(TARGET_TG_BOT); } 
    catch (e) { console.log(chalk.red("[ERROR] Bot Telegram Target belum dikenali.")); }

    tg.addEventHandler(async (ev) => {
        const msg = ev.message;
        const senderId = msg.peerId?.userId?.value;
        if (!tgEntityKlik || senderId !== tgEntityKlik.id.value) return; 

        const text = msg.message || "";
        if (!text) return;

        let targetJid = null;
        let targetFquote = null; 

        const isSuccessReceipt = (text.toUpperCase().includes("KDTK") || text.toUpperCase().includes("TOKO") || text.toUpperCase().includes("SALES ORDER")) && text.toUpperCase().includes("TOTAL");
        const hpMatch = text.match(/(?:NO\s*HP|PHONE\s*NUMBER)\s*:\s*(\d+)/i);
        const gagalMatch = text.match(/GAGAL\s*:\s*(\d+)/i);
        const isProsesSelesai = text.toUpperCase().includes("PROSES SELESAI !");

        if (hpMatch) {
            let extractedHp = hpMatch[1];
            if (extractedHp.startsWith('62')) extractedHp = '0' + extractedHp.substring(2); 
            if (pendingTransactions[extractedHp]) { targetJid = pendingTransactions[extractedHp].jid; targetFquote = pendingTransactions[extractedHp].fquote; }
        } 
        else if (gagalMatch) {
            let extractedHp = gagalMatch[1];
            if (extractedHp.startsWith('62')) extractedHp = '0' + extractedHp.substring(2);
            if (activeCoRequest && activeCoRequest.tgMsg.includes(extractedHp)) { targetJid = activeCoRequest.jid; targetFquote = activeCoRequest.fquote; } 
            else if (pendingTransactions[extractedHp]) { targetJid = pendingTransactions[extractedHp].jid; targetFquote = pendingTransactions[extractedHp].fquote; }
        }
        else if (activeCoRequest && (isSuccessReceipt || isProsesSelesai)) {
            targetJid = activeCoRequest.jid; targetFquote = activeCoRequest.fquote;
        }

        if (targetJid && !isProsesSelesai) {
            const barcodeMatch = text.match(/(https?:\/\/[^\s]+barcode[^\s]+)/i);
            const vaBcaMatch = text.match(/VA_BCA\s*:\s*(\d+)/i);
            const ppMatch = text.match(/(?:PAYMENT|KODE\s*BAYAR)\s*:\s*([A-Z0-9]+)/i); 
            const displayHp = hpMatch ? hpMatch[1] : "-";
            const msgText = `[SERVER]\n\n${text}`;

            if (barcodeMatch) {
                const imgBuffer = await getBuffer(barcodeMatch[1]);
                if (imgBuffer) {
                    await wa.sendMessage(targetJid, { image: imgBuffer, caption: msgText }, { quoted: targetFquote });
                } else {
                    await wa.sendMessage(targetJid, { text: msgText }, { quoted: targetFquote });
                }
                if (ppMatch && ppMatch[1]) {
                    try {
                        await sendInteractiveMessage(wa, targetJid, {
                            text: `💳 *INFO PAYMENT POINT*\n📱 Nomor: ${displayHp}\n\nSilakan salin kode di bawah ini:`,
                            interactiveButtons: [ { name: 'cta_copy', buttonParamsJson: JSON.stringify({ display_text: 'Copy Payment Point', copy_code: `${ppMatch[1]}` }) } ]
                        });
                    } catch (err) {}
                }
            } else if (vaBcaMatch && vaBcaMatch[1]) {
                await wa.sendMessage(targetJid, { text: msgText }, { quoted: targetFquote });
                try {
                    await sendInteractiveMessage(wa, targetJid, {
                        text: `💳 *INFO VA BCA*\n📱 Nomor: ${displayHp}\n\nSilakan salin kode di bawah ini:`,
                        interactiveButtons: [ { name: 'cta_copy', buttonParamsJson: JSON.stringify({ display_text: 'Copy VA BCA', copy_code: `${vaBcaMatch[1]}` }) } ]
                    });
                } catch (err) {}
            } else if (ppMatch && ppMatch[1]) {
                await wa.sendMessage(targetJid, { text: msgText }, { quoted: targetFquote });
                try {
                    await sendInteractiveMessage(wa, targetJid, {
                        text: `💳 *INFO PAYMENT POINT*\n📱 Nomor: ${displayHp}\n\nSilakan salin kode di bawah ini:`,
                        interactiveButtons: [ { name: 'cta_copy', buttonParamsJson: JSON.stringify({ display_text: 'Copy Payment Point', copy_code: `${ppMatch[1]}` }) } ]
                    });
                } catch (err) {}
            } else {
                await wa.sendMessage(targetJid, { text: msgText }, { quoted: targetFquote });
            }
        }

        if (activeCoRequest && targetJid === activeCoRequest.jid) {
            if (isSuccessReceipt) {
                if (hpMatch) {
                    let extHp = hpMatch[1];
                    if (extHp.startsWith('62')) extHp = '0' + extHp.substring(2);
                    activeCoRequest.successNumbers.push(extHp);
                }
                activeCoRequest.receivedReplies++; 
            } else if (gagalMatch) { 
                activeCoRequest.receivedReplies++; 
            }
            if (isProsesSelesai || activeCoRequest.receivedReplies >= activeCoRequest.expectedReplies) { 
                endActiveRequest(false); 
            }
        }
        for (const num in pendingTransactions) { if (Date.now() - pendingTransactions[num].time > 900000) delete pendingTransactions[num]; }
    }, new NewMessage({ incoming: true }));
}

// ============================================================
// 🔥 PENANGANAN PERINTAH BAWX (SUDAH DIHAPUS FAKE QUOTE-NYA)
// ============================================================
export async function handleCoCommand(waSocket, msg, chatJid, senderJid, senderNum, pushname, trimmedBody, isGroup) {
    wa = waSocket;
    const userSession = getSession(senderJid); 
    const isCommand = trimmedBody.startsWith('.') || trimmedBody.startsWith('/');
    const isSessionActive = userSession.status !== 'IDLE';
    if (!isCommand && !isSessionActive) return; 
    
    const rawCommand = trimmedBody.split(' ')[0].toLowerCase();
    const command = rawCommand.startsWith('/') ? '.' + rawCommand.substring(1) : rawCommand;
    const args = trimmedBody.substring(rawCommand.length).trim();
    
    const isAdmin = SUPER_ADMINS.includes(senderNum) || loadAdmins().includes(senderNum);
    
    // 🔥 PERBAIKAN: Menggunakan msg asli (SANGAT CEPAT) daripada mendownload foto profil
    const fquote = msg; 

    if (command === '.menu' || command === '.help') {
        const menuBuffer = await getMenuImage();
        let menuText = `Halo @${senderNum} (MODE CO)\nStatus Toko: ${isStoreOpen ? "BUKA [V]" : "TUTUP [X]"}\n\n┏ *[ MANAJEMEN DATA ]*\n┣ .add [nomor]\n┣ .list\n┣ .get [urutan]\n┗ .hapus [urutan]\n\n┏ *[ TRANSAKSI ]*\n┣ .co\n┣ .pin\n┣ .history\n┣ .delhis\n┗ .batal\n\n┏ *[ LAINNYA ]*\n┣ .pay\n┣ .ping\n┗ .exitco (Keluar dari Mode CO)\n`;
        if (isAdmin) menuText += `\n┏ *[ MENU ADMIN ]*\n┣ .setharga / .dompet / .laporan\n┗ .open atau .close\n`;
        if (menuBuffer) await wa.sendMessage(chatJid, { image: menuBuffer, caption: menuText, mentions: [senderJid] }, { quoted: fquote });
        else await wa.sendMessage(chatJid, { text: menuText, mentions: [senderJid] }, { quoted: fquote });
        return; 
    }
    
    if (command === '.pay') { const captionQris = `[ 💳 PEMBAYARAN OTOMATIS ]\n\nxxxxxxxxxx\n^ A.N RACHMAD HIDAYAT (BCA)\n\n0857xxxxx090\n^ A.N RACHMAD HIDAYAT (ISAKU/DANA/OVO)`; await wa.sendMessage(chatJid, { image: { url: QRIS_IMAGE_URL }, caption: captionQris }, { quoted: fquote }); return; }
    if (command === '.open') { if (!isAdmin) return; isStoreOpen = true; await wa.sendMessage(chatJid, { text: '[INFO] Toko DIBUKA.' }, { quoted: fquote }); return; }
    if (command === '.close') { if (!isAdmin) return; isStoreOpen = false; await wa.sendMessage(chatJid, { text: '[INFO] Toko DITUTUP.' }, { quoted: fquote }); return; }
    
    if (command === '.setharga') { if (!isAdmin) return; const [b, s] = args.split(' ').map(Number); if (!b || !s) return; const f = loadFinance(); if (!f[chatJid]) f[chatJid] = { balance: 0, buy: 0, sell: 0, sold: 0, omzet: 0, profit: 0 }; f[chatJid].buy = b; f[chatJid].sell = s; saveFinance(f); await wa.sendMessage(chatJid, { text: `✅ [SUKSES] Harga Disimpan` }, { quoted: fquote }); return; }
    if (command === '.dompet') { if (!isAdmin) return; const f = loadFinance()[chatJid] || { balance: 0 }; await wa.sendMessage(chatJid, { text: `Saldo: ${rupiah(f.balance)}` }, { quoted: fquote }); return; }
    if (command === '.laporan') { if (!isAdmin) return; const d = loadFinance()[chatJid] || { balance: 0, sold: 0, profit: 0 }; await wa.sendMessage(chatJid, { text: `Terjual: ${d.sold}\nProfit: ${rupiah(d.profit)}\nSaldo: ${rupiah(d.balance)}` }, { quoted: fquote }); return; }
    
    if (command === '.add') {
        const db = loadDatabase(); if (!db[chatJid]) db[chatJid] = [];
        args.split(/[\s,\n]+/).forEach(n => { let c = n.replace(/\D/g, ''); if(c.length>9) { if(c.startsWith('62')) c='0'+c.substring(2); if(!db[chatJid].includes(c)) db[chatJid].push(c); } });
        saveDatabase(db); await wa.sendMessage(chatJid, { text: 'Disimpan ke Database.' }, { quoted: fquote }); return;
    }
    if (command === '.list') {
        const nums = loadDatabase()[chatJid] || []; if(nums.length===0) return wa.sendMessage(chatJid, {text: 'Kosong'}, { quoted: fquote });
        const hist = loadHistory(); const userHist = hist[chatJid] || []; const usedNumbers = new Set(userHist.map(item => item.number));
        let t = '[ LIST AKUN ]\n'; nums.forEach((n,i) => { t += `${i+1}. ${n} - ${usedNumbers.has(n) ? 'OFF [X]' : 'ON [V]'}\n`; });
        await wa.sendMessage(chatJid, { text: t }, { quoted: fquote }); return;
    }
    if (command === '.hapus') {
        const db = loadDatabase(); let nums = db[chatJid] || []; const idxs = parseIndices(args);
        db[chatJid] = nums.filter((_, i) => !idxs.includes(i)); saveDatabase(db); await wa.sendMessage(chatJid, { text: 'Dihapus.' }, { quoted: fquote }); return;
    }

    if (command === '.get' || command === '/get') {
        const db = loadDatabase(); let nums = db[chatJid] || [];
        if (nums.length === 0) return wa.sendMessage(chatJid, { text: 'Database Kosong' }, { quoted: fquote });
        const idxs = parseIndices(args);
        if (idxs.length === 0) return wa.sendMessage(chatJid, { text: 'Format salah. Contoh: .get 1-10' }, { quoted: fquote });
        const validIdxs = [...new Set(idxs)].filter(i => i >= 0 && i < nums.length).sort((a, b) => a - b);
        if (validIdxs.length === 0) return wa.sendMessage(chatJid, { text: 'Urutan tidak ditemukan di database.' }, { quoted: fquote });

        let resultText = `✅ Ambil ${validIdxs.length} Data\n\n`;
        let extractedData = [];
        validIdxs.forEach(idx => { let item = nums[idx]; let textLine = typeof item === 'object' ? item.fullData : item; extractedData.push(textLine); });
        resultText += extractedData.join('\n') + `\n\n_(Dihapus dari list)_`;

        const toRemove = new Set(validIdxs);
        db[chatJid] = nums.filter((_, i) => !toRemove.has(i)); saveDatabase(db);

        try { await sendInteractiveMessage(wa, chatJid, { text: resultText, interactiveButtons: [ { name: 'cta_copy', buttonParamsJson: JSON.stringify({ display_text: 'Salin Semua Data', copy_code: extractedData.join('\n') }) } ] }); } 
        catch (err) { await wa.sendMessage(chatJid, { text: resultText }, { quoted: fquote }); }
        return;
    }

    if (command === '.batal') { 
        sessions[senderJid] = { status: 'IDLE' }; coQueue = coQueue.filter(req => req.jid !== chatJid); 
        if (activeCoRequest && activeCoRequest.jid === chatJid) { clearTimeout(activeCoRequest.timeout); activeCoRequest = null; setTimeout(processCoQueue, 1000); }
        await wa.sendMessage(chatJid, { text: '✅ Sesi Dibatalkan. Silahkan buat pesanan baru.' }, { quoted: fquote }); return; 
    }

    if (command === '.history') {
        const h = loadHistory()[chatJid] || []; if(h.length===0) return wa.sendMessage(chatJid, {text: 'History Kosong'}, { quoted: fquote });
        let t = '[ HISTORY TRANSAKSI ]\n\n'; h.forEach((i,x) => t+=`${x+1}. ${i.number} | ${i.kode} | ${i.plu}\n`); 
        if (t.length > 2000) t = t.substring(0, 2000) + "\n..."; await wa.sendMessage(chatJid, { text: t }, { quoted: fquote }); return;
    }
    if (command === '.delhis') { const h = loadHistory(); h[chatJid] = []; saveHistory(h); await wa.sendMessage(chatJid, { text: 'History Dihapus' }, { quoted: fquote }); return; }

    if (command === '.co') {
        if (!isStoreOpen) return wa.sendMessage(chatJid, { text: 'Toko Tutup' }, { quoted: fquote });
        const nums = loadDatabase()[chatJid] || []; if (nums.length === 0) return wa.sendMessage(chatJid, { text: 'Database Kosong. Gunakan .add dulu.' }, { quoted: fquote });
        const usedNumbers = new Set((loadHistory()[chatJid] || []).map(i => i.number));
        let txt = '[ PILIH AKUN ]\n'; nums.forEach((n, i) => { txt += `${i+1}. ${n} - ${usedNumbers.has(n) ? 'OFF [X]' : 'ON [V]'}\n`; });
        txt += '\n> Ketik urutan akun (Contoh: 1-3):';
        userSession.status = 'SELECT_ACCOUNTS'; await wa.sendMessage(chatJid, { text: txt }, { quoted: fquote }); return;
    }
    if (userSession.status === 'SELECT_ACCOUNTS') {
        const nums = loadDatabase()[chatJid] || []; const selectedIndices = parseIndices(trimmedBody);
        const validNumbers = []; selectedIndices.forEach(idx => { if(nums[idx]) validNumbers.push(nums[idx]); });
        if (validNumbers.length === 0) return wa.sendMessage(chatJid, { text: 'Error pilihan.' }, { quoted: fquote });
        userSession.selectedNumbers = validNumbers; userSession.status = 'INPUT_KODETOKO';
        await wa.sendMessage(chatJid, { text: `[INFO] ${validNumbers.length} Akun Dipilih.\n> Masukkan KDTK (4 digit):` }, { quoted: fquote }); return;
    }
    if (userSession.status === 'INPUT_KODETOKO') {
        if(trimmedBody.length!==4) return wa.sendMessage(chatJid, { text: 'Kode harus 4 digit' }, { quoted: fquote });
        userSession.kodeToko = trimmedBody; userSession.status = 'INPUT_PLU';
        await wa.sendMessage(chatJid, { text: `[INFO] Kode: ${trimmedBody}\n> Masukkan PLU:QTY atau PLU:QTY:KUPON:` }, { quoted: fquote }); return;
    }
    if (userSession.status === 'INPUT_PLU') {
        userSession.plu = trimmedBody; userSession.status = 'SELECT_FORMAT';
        await wa.sendMessage(chatJid, { text: `[INFO] Data Siap.\n\nPILIH METODE BAYAR:\n1. BCA\n2. PAYMENT POINT\n3. FOOD (BCA)\n4. FOOD (PAYMENT POINT)\n\n> Ketik angkanya (1/2/3/4):` }, { quoted: fquote }); return;
    }
    if (userSession.status === 'SELECT_FORMAT') {
        let fmt = ''; if(trimmedBody==='1') fmt='GAS.KLIK'; else if(trimmedBody==='2') fmt='GAS.PP'; else if(trimmedBody==='3') fmt='GAS.FOODKLIK'; else if(trimmedBody==='4') fmt='GAS.FOODPP'; else return wa.sendMessage(chatJid, {text:'Pilih 1, 2, 3, atau 4'}, { quoted: fquote });
        let rawPlu = userSession.plu; let parts = rawPlu.split(':'); let pluString = parts[0] + (parts[1] ? ':' + parts[1] : ''); let kuponString = parts[2] ? parts[2] : ''; 
        let finalToko = userSession.kodeToko; if (kuponString) { finalToko = `${userSession.kodeToko}.${kuponString}`; }
        
        let tgMsg = `/FORMAT\n${fmt}\n${finalToko}\n${pluString}\n` + userSession.selectedNumbers.join('\n');
        const fin = loadFinance(); if (!fin[chatJid]) fin[chatJid] = { balance: 0, buy: 0, sell: 0, sold: 0, omzet: 0, profit: 0 };
        for(const num of userSession.selectedNumbers) {
            addHistory(chatJid, num, userSession.kodeToko, rawPlu); 
            if(fin[chatJid].sell > 0) { fin[chatJid].sold++; fin[chatJid].omzet += fin[chatJid].sell; fin[chatJid].profit += (fin[chatJid].sell - fin[chatJid].buy); fin[chatJid].balance += fin[chatJid].sell; }
            pendingTransactions[num] = { jid: chatJid, time: Date.now(), fquote: fquote };
        }
        saveFinance(fin);
        await wa.sendMessage(chatJid, { text: `✅ 100% Pesanan Dimasukkan ke Antrean.\n\nMemproses ${userSession.selectedNumbers.length} Transaksi...` }, { quoted: fquote });
        coQueue.push({ jid: chatJid, tgMsg: tgMsg.trim(), expectedReplies: userSession.selectedNumbers.length, receivedReplies: 0, successNumbers: [], selectedNumbers: userSession.selectedNumbers, fquote: fquote });
        processCoQueue(); sessions[senderJid] = { status: 'IDLE' }; return;
    }

    if (command === '.pin') {
        if (!isStoreOpen) return wa.sendMessage(chatJid, { text: 'Toko Tutup' }, { quoted: fquote });
        const nums = loadDatabase()[chatJid] || []; if (nums.length === 0) return wa.sendMessage(chatJid, { text: 'Database Kosong' }, { quoted: fquote });
        const usedNumbers = new Set((loadHistory()[chatJid] || []).map(i => i.number));
        let txt = '[ PILIH AKUN PIN ]\n'; nums.forEach((n, i) => { txt += `${i+1}. ${n} - ${usedNumbers.has(n) ? 'OFF [X]' : 'ON [V]'}\n`; });
        txt += '\n> Ketik urutan akun (Contoh: 1-3):';
        userSession.status = 'SELECT_ACCOUNTS_PIN'; await wa.sendMessage(chatJid, { text: txt }, { quoted: fquote }); return;
    }
    if (userSession.status === 'SELECT_ACCOUNTS_PIN') {
        const nums = loadDatabase()[chatJid] || []; const selectedIndices = parseIndices(trimmedBody);
        const validNumbers = []; selectedIndices.forEach(idx => { if(nums[idx]) validNumbers.push(nums[idx]); });
        if (validNumbers.length === 0) return wa.sendMessage(chatJid, { text: '[ERROR] Salah pilih.' }, { quoted: fquote });
        let tgMsg = `/FORMAT\nGAS.PIN\n` + validNumbers.join('\n');
        const fin = loadFinance(); if (!fin[chatJid]) fin[chatJid] = { balance: 0, buy: 0, sell: 0, sold: 0, omzet: 0, profit: 0 };
        for(const num of validNumbers) {
            addHistory(chatJid, num, 'PIN', '-');
            if(fin[chatJid].sell > 0) { fin[chatJid].sold++; fin[chatJid].omzet += fin[chatJid].sell; fin[chatJid].profit += (fin[chatJid].sell - fin[chatJid].buy); fin[chatJid].balance += fin[chatJid].sell; }
            pendingTransactions[num] = { jid: chatJid, time: Date.now(), fquote: fquote };
        }
        saveFinance(fin);
        await wa.sendMessage(chatJid, { text: `✅ Memproses penarikan ${validNumbers.length} PIN...` }, { quoted: fquote });
        await tg.sendMessage(TARGET_TG_BOT, { message: tgMsg.trim() });
        sessions[senderJid] = { status: 'IDLE' }; return;
    }
}
