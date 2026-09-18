/* BAWX PROJECT - COIP.JS (MESIN KHUSUS IPHONE / iOS)
   - Clone of V1 (co.js) - Single Block Telegram Message (Estafet Queue)
   - Target: @Auto_Order_KLIK_bot
   - UI/UX: Plain Text (Aman iOS) + Tombol Copy Dipertahankan + Lapor Admin
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
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { sendInteractiveMessage } = require('baileys_helper');

// ============================================================
// 👇 KONFIGURASI GLOBAL (MENIRU V1)
// ============================================================
const TG_API_ID = 30042890; 
const TG_API_HASH = "1012659099f45a9315c3b56aeff66be6"; 
const TARGET_TG_BOT = "Auto_Order_KLIK_bot"; // 🔥 KEMBALI KE BOT V1
const SUPER_ADMINS = ['628553056669', '7289096413331', '175058655965193']; 
const ADMIN_REPORT_JID = "6285xxxxx090@s.whatsapp.net"; // 🔥 NOMOR ADMIN

const MENU_IMAGE_URL = 'https://files.catbox.moe/gdg5yl.jpg'; 
const LOCAL_MENU_PATH = './menu.jpg'; 
const FALLBACK_MENU_URL = 'https://files.catbox.moe/gdg5yl.jpg'; 
const QRIS_IMAGE_URL = 'https://files.catbox.moe/gdg5yl.jpg'; 

// Berbagi database yang sama dengan V1 agar user tidak bingung
const DB_FILE = './database.json'; 
const HISTORY_FILE = './history.json';
const FINANCE_FILE = './finance.json';
const ADMINS_FILE = './admins.json'; 

let wa, tg, tgEntityKlik;
let isTgInitialized = false; 
const sessionsIp = {}; 
let isStoreOpen = true; 

const pendingTransactionsIp = {}; 
let coIpQueue = []; 
let activeCoIpRequest = null; 

// --- HELPERS ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const getBuffer = async (url) => { try { return (await axios({ method: 'get', url, responseType: 'arraybuffer', timeout: 10000 })).data; } catch (e) { return null; } };
const getMenuImage = async () => { try { return fs.existsSync(LOCAL_MENU_PATH) ? fs.readFileSync(LOCAL_MENU_PATH) : (await axios({ url: FALLBACK_MENU_URL, responseType: 'arraybuffer' })).data; } catch (e) { return null; } };

function loadAdmins() { try { if (!fs.existsSync(ADMINS_FILE)) { fs.writeFileSync(ADMINS_FILE, JSON.stringify(SUPER_ADMINS, null, 2)); return SUPER_ADMINS; } return JSON.parse(fs.readFileSync(ADMINS_FILE)); } catch { return []; } }
function loadDatabase() { try { if (!fs.existsSync(DB_FILE)) { fs.writeFileSync(DB_FILE, '{}'); return {}; } return JSON.parse(fs.readFileSync(DB_FILE)); } catch { return {}; } }
function saveDatabase(data) { fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2)); }
function loadHistory() { try { if (!fs.existsSync(HISTORY_FILE)) { fs.writeFileSync(HISTORY_FILE, '{}'); return {}; } return JSON.parse(fs.readFileSync(HISTORY_FILE)); } catch { return {}; } }
function saveHistory(data) { fs.writeFileSync(HISTORY_FILE, JSON.stringify(data, null, 2)); }
function addHistory(jid, number, kode, plu) { const db = loadHistory(); if (!db[jid]) db[jid] = []; db[jid].unshift({ number, kode, plu, timestamp: Date.now(), readableTime: new Date().toLocaleString('id-ID') }); saveHistory(db); }
function loadFinance() { try { if (!fs.existsSync(FINANCE_FILE)) { fs.writeFileSync(FINANCE_FILE, '{}'); return {}; } return JSON.parse(fs.readFileSync(FINANCE_FILE)); } catch { return {}; } }
function saveFinance(data) { fs.writeFileSync(FINANCE_FILE, JSON.stringify(data, null, 2)); }
const rupiah = (number) => { return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(number); }
function getSession(jid) { if (!sessionsIp[jid]) sessionsIp[jid] = { status: 'IDLE', selectedNumbers: [], kodeToko: '', plu: '' }; return sessionsIp[jid]; }

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
// 🔥 MESIN ANTREAN (ESTAFET QUEUE) UNTUK V1 iPHONE
// ============================================================
async function processCoIpQueue() {
    if (activeCoIpRequest || coIpQueue.length === 0) return; 
    
    activeCoIpRequest = coIpQueue.shift(); 
    const currentUserNum = activeCoIpRequest.jid.split('@')[0];
    
    console.log(chalk.yellow(`[QUEUE iPHONE] Membuka antrean .co untuk ${activeCoIpRequest.jid} (Menunggu ${activeCoIpRequest.expectedReplies} balasan)`));
    
    await tg.sendMessage(TARGET_TG_BOT, { message: activeCoIpRequest.tgMsg });
    
    // Menggunakan realMsg asli user (Tanpa Fake Quote)
    await wa.sendMessage(activeCoIpRequest.jid, { text: `⏳ [ ░░░░░░░░░░ ] Pesanan sedang diproses server...` }, { quoted: activeCoIpRequest.realMsg });

    // Timeout Pengaman (Lapor Admin & Lanjut Antrean)
    activeCoIpRequest.timeout = setTimeout(async () => {
        if (activeCoIpRequest) {
            const req = activeCoIpRequest;
            activeCoIpRequest = null;
            
            // Lapor User
            await wa.sendMessage(req.jid, { text: `Terjadi error, pesan error sudah diteruskan ke admin silahkan tunggu` }, { quoted: req.realMsg });
            
            // Lapor Admin
            const adminTxt = `⚠️ *[ LAPORAN ERROR MODE iPHONE (V1) ]* ⚠️\n👤 *User:* ${currentUserNum}\n⚙️ *Kendala:* Timeout Server\n📝 *Detail:* Bot Telegram (${TARGET_TG_BOT}) terlalu lama membalas (Melewati 3 menit).\n\n📦 *Data Pesanan:*\n${req.tgMsg}`;
            await wa.sendMessage(ADMIN_REPORT_JID, { text: adminTxt });
            
            // Lanjut ke antrean berikutnya
            processCoIpQueue(); 
        }
    }, 180000); 
}

// ============================================================
// 🔥 INISIALISASI TELEGRAM (MODE iPHONE V1)
// ============================================================
export async function initTG_IP(waSocket) {
    wa = waSocket;
    if (isTgInitialized) return;
    isTgInitialized = true;
    
    console.log(chalk.yellow("\n[*] Menyiapkan koneksi Telegram Mode iPHONE..."));
    const sessionStr = fs.existsSync('tg_session_ip.txt') ? fs.readFileSync('tg_session_ip.txt', 'utf8') : "";
    const session = new StringSession(sessionStr);
    tg = new TelegramClient(session, parseInt(TG_API_ID), TG_API_HASH, { connectionRetries: 5 });

    await tg.start({
        phoneNumber: async () => await input.text("📱 Masukkan Nomor Telegram (+62...): "),
        password: async () => await input.text("🔑 Masukkan Password 2FA (jika ada): "),
        phoneCode: async () => await input.text("📩 Masukkan Kode OTP Telegram Mode iPHONE: "),
        onError: (err) => console.log(err),
    });
    
    console.log(chalk.green(`[+] Telegram Mode iPHONE Berhasil Terhubung ke ${TARGET_TG_BOT}!`));
    fs.writeFileSync('tg_session_ip.txt', tg.session.save());
    
    try { tgEntityKlik = await tg.getEntity(TARGET_TG_BOT); } 
    catch (e) { console.log(chalk.red(`[ERROR] Bot Telegram Target (${TARGET_TG_BOT}) belum dikenali.`)); }

    tg.addEventHandler(async (ev) => {
        const msg = ev.message;
        const senderId = msg.peerId?.userId?.value;
        if (!tgEntityKlik || senderId !== tgEntityKlik.id.value) return; 

        const text = msg.message || "";
        if (!text) return;

        let targetJid = null;
        let isCoReply = false; 
        let targetRealMsg = null; 

        const isSuccessReceipt = (text.toUpperCase().includes("KDTK") || text.toUpperCase().includes("TOKO") || text.toUpperCase().includes("SALES ORDER")) && text.toUpperCase().includes("TOTAL");
        const hpMatch = text.match(/(?:NO\s*HP|PHONE\s*NUMBER)\s*:\s*(\d+)/i);
        const gagalMatch = text.match(/GAGAL\s*:\s*(\d+)/i);

        // PENCOCOKAN NOMOR HP SEPERTI V1
        if (hpMatch) {
            let extractedHp = hpMatch[1];
            if (extractedHp.startsWith('62')) extractedHp = '0' + extractedHp.substring(2); 
            if (pendingTransactionsIp[extractedHp]) {
                targetJid = pendingTransactionsIp[extractedHp].jid;
                targetRealMsg = pendingTransactionsIp[extractedHp].realMsg;
                isCoReply = true; 
            }
        } 
        else if (gagalMatch) {
            let extractedHp = gagalMatch[1];
            if (extractedHp.startsWith('62')) extractedHp = '0' + extractedHp.substring(2);
            if (activeCoIpRequest && activeCoIpRequest.tgMsg.includes(extractedHp)) {
                targetJid = activeCoIpRequest.jid;
                targetRealMsg = activeCoIpRequest.realMsg;
                isCoReply = true; 
            } else if (pendingTransactionsIp[extractedHp]) {
                targetJid = pendingTransactionsIp[extractedHp].jid;
                targetRealMsg = pendingTransactionsIp[extractedHp].realMsg;
                isCoReply = true;
            }
        }
        else if (activeCoIpRequest && isSuccessReceipt) {
            targetJid = activeCoIpRequest.jid;
            targetRealMsg = activeCoIpRequest.realMsg;
            isCoReply = true; 
        }

        // PENGHITUNGAN ESTAFET
        if (isCoReply && activeCoIpRequest && targetJid === activeCoIpRequest.jid) {
            activeCoIpRequest.receivedReplies++; 
            if (activeCoIpRequest.receivedReplies >= activeCoIpRequest.expectedReplies) {
                clearTimeout(activeCoIpRequest.timeout);
                
                // Pesan Penutup Manis
                const closingMsg = activeCoIpRequest.realMsg;
                const totalAcc = activeCoIpRequest.expectedReplies;
                const jidUser = activeCoIpRequest.jid;
                
                activeCoIpRequest = null; 
                
                // Kirim Penutup
                setTimeout(async () => {
                    try { await wa.sendMessage(jidUser, { text: `${totalAcc} Sudah selesai 🙏` }, { quoted: closingMsg }); } catch(e){}
                }, 500);

                // Gas ke antrean selanjutnya tanpa jeda
                setTimeout(processCoIpQueue, 1000); 
            }
        }

        // PENGIRIMAN PESAN IPHONE SAFE (TOMBOL COPY)
        if (targetJid) {
            const barcodeMatch = text.match(/(https?:\/\/[^\s]+barcode[^\s]+)/i);
            const vaBcaMatch = text.match(/VA_BCA\s*:\s*(\d+)/i);
            const ppMatch = text.match(/(?:PAYMENT|KODE\s*BAYAR)\s*:\s*([A-Z0-9]+)/i); 

            if (barcodeMatch) {
                const imgBuffer = await getBuffer(barcodeMatch[1]);
                const msgText = `[SERVER]\n\n${text}`;
                
                if (imgBuffer) {
                    await wa.sendMessage(targetJid, { image: imgBuffer, caption: msgText }, { quoted: targetRealMsg });
                } else {
                    await wa.sendMessage(targetJid, { text: msgText }, { quoted: targetRealMsg });
                }

                if (ppMatch && ppMatch[1]) {
                    const hpNum = text.match(/(?:NO\s*HP|PHONE\s*NUMBER)\s*:\s*(\d+)/i);
                    const displayHp = hpNum ? hpNum[1] : "-";
                    try {
                        await sendInteractiveMessage(wa, targetJid, {
                            text: `💳 *INFO PAYMENT POINT*\n📱 Nomor: ${displayHp}\n\nSilakan salin kode di bawah ini:`,
                            interactiveButtons: [
                                { name: 'cta_copy', buttonParamsJson: JSON.stringify({ display_text: 'Copy Payment Point', copy_code: `${ppMatch[1]}` }) }
                            ]
                        });
                    } catch (err) {}
                }
                return;

            } else if (vaBcaMatch && vaBcaMatch[1]) {
                const vaNumber = vaBcaMatch[1];
                const msgText = `[SERVER]\n\n${text}`;
                try {
                    await sendInteractiveMessage(wa, targetJid, {
                        text: msgText,
                        interactiveButtons: [
                            { name: 'cta_copy', buttonParamsJson: JSON.stringify({ display_text: 'Copy VA BCA', copy_code: `${vaNumber}` }) }
                        ]
                    });
                    return;
                } catch (err) {
                    await wa.sendMessage(targetJid, { text: msgText }, { quoted: targetRealMsg });
                    return;
                }

            } else if (ppMatch && ppMatch[1]) {
                const msgText = `[SERVER]\n\n${text}`;
                const hpNum = text.match(/(?:NO\s*HP|PHONE\s*NUMBER)\s*:\s*(\d+)/i);
                const displayHp = hpNum ? hpNum[1] : "-";
                
                try {
                    await sendInteractiveMessage(wa, targetJid, {
                        text: `[SERVER]\n\n${text}\n\n💳 *INFO PAYMENT POINT*\n📱 Nomor: ${displayHp}\nSilakan salin kode di bawah ini:`,
                        interactiveButtons: [
                            { name: 'cta_copy', buttonParamsJson: JSON.stringify({ display_text: 'Copy Payment Point', copy_code: `${ppMatch[1]}` }) }
                        ]
                    });
                    return;
                } catch (err) {
                    await wa.sendMessage(targetJid, { text: msgText }, { quoted: targetRealMsg });
                    return;
                }
            }
            await wa.sendMessage(targetJid, { text: `[SERVER]\n\n${text}` }, { quoted: targetRealMsg });
        }

        for (const num in pendingTransactionsIp) {
            if (Date.now() - pendingTransactionsIp[num].time > 900000) delete pendingTransactionsIp[num];
        }

    }, new NewMessage({ incoming: true }));
}

// ============================================================
// 🔥 PENANGANAN PERINTAH IPHONE MODE (KLONING V1)
// ============================================================
export async function handleCoIpCommand(waSocket, msg, chatJid, senderJid, senderNum, pushname, trimmedBody, isGroup) {
    wa = waSocket;
    const userSession = getSession(senderJid); 
    const isCommand = trimmedBody.startsWith('.') || trimmedBody.startsWith('/');
    const isSessionActive = userSession.status !== 'IDLE';
    if (!isCommand && !isSessionActive) return; 
    
    const rawCommand = trimmedBody.split(' ')[0].toLowerCase();
    const command = rawCommand.startsWith('/') ? '.' + rawCommand.substring(1) : rawCommand;
    const args = trimmedBody.substring(rawCommand.length).trim();
    
    const isAdmin = SUPER_ADMINS.includes(senderNum) || loadAdmins().includes(senderNum);

    // MENGGUNAKAN MSG ASLI (REAL MSG) AGAR AMAN DI IPHONE
    const realMsgQuoted = msg;

    if (command === '.menu' || command === '.help') {
        const menuBuffer = await getMenuImage();
        let menuText = `Halo @${senderNum} (Mode iPHONE)\nStatus Toko: ${isStoreOpen ? "BUKA [V]" : "TUTUP [X]"}\n\n┏ *[ MANAJEMEN DATA ]*\n┣ .add [nomor]\n┣ .list\n┣ .get [urutan]\n┗ .hapus [urutan]\n\n┏ *[ TRANSAKSI ]*\n┣ .co\n┣ .pin\n┣ .history\n┣ .delhis\n┗ .batal\n\n┏ *[ LAINNYA ]*\n┣ .pay\n┣ .ping\n┗ .exitip (Keluar dari Mode iPHONE)\n`;
        if (isAdmin) menuText += `\n┏ *[ MENU ADMIN ]*\n┣ .setharga / .dompet / .laporan\n┣ .restart (Restart Termux)\n┗ .open atau .close\n`;
        
        if (menuBuffer) {
            await wa.sendMessage(chatJid, { image: menuBuffer, caption: menuText, mentions: [senderJid] }, { quoted: realMsgQuoted });
        } else {
            await wa.sendMessage(chatJid, { text: menuText, mentions: [senderJid] }, { quoted: realMsgQuoted });
        }
        return; 
    }
    
    if (command === '.pay') {
        const captionQris = `[ 💳 PEMBAYARAN OTOMATIS ]\n\nxxxxxxxxxx\n^ A.N RACHMAD HIDAYAT (BCA)\n\n0857xxxxx090\n^ A.N RACHMAD HIDAYAT (ISAKU/DANA/OVO)`;
        await wa.sendMessage(chatJid, { image: { url: QRIS_IMAGE_URL }, caption: captionQris }, { quoted: realMsgQuoted }); return;
    }
    if (command === '.open') { if (!isAdmin) return; isStoreOpen = true; await wa.sendMessage(chatJid, { text: '[INFO] Toko DIBUKA.' }, { quoted: realMsgQuoted }); return; }
    if (command === '.close') { if (!isAdmin) return; isStoreOpen = false; await wa.sendMessage(chatJid, { text: '[INFO] Toko DITUTUP.' }, { quoted: realMsgQuoted }); return; }
    
    // 🔥 TOMBOL RESTART SERVER 🔥
    if (command === '.restart') {
        if (!isAdmin) return;
        await wa.sendMessage(chatJid, { text: '🔄 *Merestart Bot via Termux...*' }, { quoted: realMsgQuoted });
        setTimeout(() => { process.exit(0); }, 1000);
        return;
    }

    if (command === '.setharga') {
        if (!isAdmin) return; const [b, s] = args.split(' ').map(Number); if (!b || !s) return;
        const f = loadFinance(); if (!f[chatJid]) f[chatJid] = { balance: 0, buy: 0, sell: 0, sold: 0, omzet: 0, profit: 0 };
        f[chatJid].buy = b; f[chatJid].sell = s; saveFinance(f); await wa.sendMessage(chatJid, { text: `✅ [SUKSES] Harga Disimpan` }, { quoted: realMsgQuoted }); return;
    }
    if (command === '.dompet') { if (!isAdmin) return; const f = loadFinance()[chatJid] || { balance: 0 }; await wa.sendMessage(chatJid, { text: `Saldo: ${rupiah(f.balance)}` }, { quoted: realMsgQuoted }); return; }
    if (command === '.laporan') { if (!isAdmin) return; const d = loadFinance()[chatJid] || { balance: 0, sold: 0, profit: 0 }; await wa.sendMessage(chatJid, { text: `Terjual: ${d.sold}\nProfit: ${rupiah(d.profit)}\nSaldo: ${rupiah(d.balance)}` }, { quoted: realMsgQuoted }); return; }
    
    if (command === '.add') {
        const db = loadDatabase(); if (!db[chatJid]) db[chatJid] = [];
        args.split(/[\s,\n]+/).forEach(n => { let c = n.replace(/\D/g, ''); if(c.length>9) { if(c.startsWith('62')) c='0'+c.substring(2); if(!db[chatJid].includes(c)) db[chatJid].push(c); } });
        saveDatabase(db); await wa.sendMessage(chatJid, { text: 'Disimpan ke Database.' }, { quoted: realMsgQuoted }); return;
    }
    if (command === '.list') {
        const nums = loadDatabase()[chatJid] || []; if(nums.length===0) return wa.sendMessage(chatJid, {text: 'Kosong'}, { quoted: realMsgQuoted });
        const hist = loadHistory(); const userHist = hist[chatJid] || []; const usedNumbers = new Set(userHist.map(item => item.number));
        let t = '[ LIST AKUN ]\n'; nums.forEach((n,i) => { t += `${i+1}. ${n} - ${usedNumbers.has(n) ? 'OFF [X]' : 'ON [V]'}\n`; });
        await wa.sendMessage(chatJid, { text: t }, { quoted: realMsgQuoted }); return;
    }

    // 🔥 FITUR GET AKUN (HANYA NOMOR) 🔥
    if (command === '.get') {
        const db = loadDatabase(); let nums = db[chatJid] || []; const idxs = parseIndices(args);
        if (idxs.length === 0) return wa.sendMessage(chatJid, { text: 'Format salah. Contoh: .get 1-5' }, { quoted: realMsgQuoted });
        let grabbed = [], remaining = [];
        nums.forEach((n, i) => { if (idxs.includes(i)) grabbed.push(n); else remaining.push(n); });
        if (grabbed.length === 0) return wa.sendMessage(chatJid, { text: 'Tidak ada data yang diambil.' }, { quoted: realMsgQuoted });
        db[chatJid] = remaining; saveDatabase(db);
        await wa.sendMessage(chatJid, { text: `✅ *Berhasil Mengambil ${grabbed.length} Akun*\n\n${grabbed.join('\n')}\n\n_(Akun otomatis dihapus dari list)_` }, { quoted: realMsgQuoted });
        return;
    }

    if (command === '.hapus') {
        const db = loadDatabase(); let nums = db[chatJid] || []; const idxs = parseIndices(args);
        db[chatJid] = nums.filter((_, i) => !idxs.includes(i)); saveDatabase(db); await wa.sendMessage(chatJid, { text: 'Dihapus.' }, { quoted: realMsgQuoted }); return;
    }

    if (command === '.batal') { 
        sessionsIp[senderJid] = { status: 'IDLE' }; 
        coIpQueue = coIpQueue.filter(req => req.jid !== chatJid); 
        if (activeCoIpRequest && activeCoIpRequest.jid === chatJid) {
            clearTimeout(activeCoIpRequest.timeout);
            activeCoIpRequest = null;
            setTimeout(processCoIpQueue, 1000); 
        }
        await wa.sendMessage(chatJid, { text: '✅ Sesi Mode iPHONE Dibatalkan.' }, { quoted: realMsgQuoted }); 
        return; 
    }

    if (command === '.history') {
        const h = loadHistory()[chatJid] || []; if(h.length===0) return wa.sendMessage(chatJid, {text: 'History Kosong'}, { quoted: realMsgQuoted });
        let t = '[ HISTORY TRANSAKSI ]\n\n'; h.forEach((i,x) => t+=`${x+1}. ${i.number} | ${i.kode} | ${i.plu}\n`); 
        if (t.length > 2000) t = t.substring(0, 2000) + "\n..."; await wa.sendMessage(chatJid, { text: t }, { quoted: realMsgQuoted }); return;
    }
    if (command === '.delhis') { const h = loadHistory(); h[chatJid] = []; saveHistory(h); await wa.sendMessage(chatJid, { text: 'History Dihapus' }, { quoted: realMsgQuoted }); return; }

    if (command === '.co') {
        if (!isStoreOpen) return wa.sendMessage(chatJid, { text: 'Toko Tutup' }, { quoted: realMsgQuoted });
        const nums = loadDatabase()[chatJid] || []; if (nums.length === 0) return wa.sendMessage(chatJid, { text: 'Database Kosong. Gunakan .add dulu.' }, { quoted: realMsgQuoted });
        const usedNumbers = new Set((loadHistory()[chatJid] || []).map(i => i.number));
        let txt = '[ PILIH AKUN ]\n'; nums.forEach((n, i) => { txt += `${i+1}. ${n} - ${usedNumbers.has(n) ? 'OFF [X]' : 'ON [V]'}\n`; });
        txt += '\n> Ketik nomor urut (Contoh: 1-3)';
        userSession.status = 'SELECT_ACCOUNTS'; await wa.sendMessage(chatJid, { text: txt }, { quoted: realMsgQuoted }); return;
    }
    if (userSession.status === 'SELECT_ACCOUNTS') {
        const nums = loadDatabase()[chatJid] || []; const selectedIndices = parseIndices(trimmedBody);
        const validNumbers = []; selectedIndices.forEach(idx => { if(nums[idx]) validNumbers.push(nums[idx]); });
        if (validNumbers.length === 0) return wa.sendMessage(chatJid, { text: 'Error pilihan.' }, { quoted: realMsgQuoted });
        userSession.selectedNumbers = validNumbers; userSession.status = 'INPUT_KODETOKO';
        await wa.sendMessage(chatJid, { text: `[INFO] ${validNumbers.length} Akun Dipilih.\n> Masukkan KODE TOKO (4 digit):` }, { quoted: realMsgQuoted }); return;
    }
    if (userSession.status === 'INPUT_KODETOKO') {
        if(trimmedBody.length!==4) return wa.sendMessage(chatJid, { text: 'Kode harus 4 digit' }, { quoted: realMsgQuoted });
        userSession.kodeToko = trimmedBody; userSession.status = 'INPUT_PLU';
        await wa.sendMessage(chatJid, { text: `[INFO] Kode: ${trimmedBody}\n> Masukkan PLU:QTY:` }, { quoted: realMsgQuoted }); return;
    }
    if (userSession.status === 'INPUT_PLU') {
        userSession.plu = trimmedBody; userSession.status = 'SELECT_FORMAT';
        // 🔥 KEMBALI KE 4 OPSI V1 🔥
        await wa.sendMessage(chatJid, { text: `[INFO] Data Siap.\n\nPILIH METODE BAYAR:\n1. BCA\n2. PAYMENT POINT\n3. FOOD (BCA)\n4. FOOD (PAYMENT POINT)\n\n> Ketik angkanya (1/2/3/4):` }, { quoted: realMsgQuoted }); return;
    }
    if (userSession.status === 'SELECT_FORMAT') {
        let fmt = ''; if(trimmedBody==='1') fmt='GAS.KLIK'; else if(trimmedBody==='2') fmt='GAS.PP'; else if(trimmedBody==='3') fmt='GAS.FOODKLIK'; else if(trimmedBody==='4') fmt='GAS.FOODPP'; else return wa.sendMessage(chatJid, {text:'Pilih 1, 2, 3, atau 4'}, { quoted: realMsgQuoted });
        
        let tgMsg = `/FORMAT\n${fmt}\n${userSession.kodeToko}\n${userSession.plu}\n` + userSession.selectedNumbers.join('\n');
        const fin = loadFinance(); if (!fin[chatJid]) fin[chatJid] = { balance: 0, buy: 0, sell: 0, sold: 0, omzet: 0, profit: 0 };
        
        for(const num of userSession.selectedNumbers) {
            addHistory(chatJid, num, userSession.kodeToko, userSession.plu); 
            if(fin[chatJid].sell > 0) { fin[chatJid].sold++; fin[chatJid].omzet += fin[chatJid].sell; fin[chatJid].profit += (fin[chatJid].sell - fin[chatJid].buy); fin[chatJid].balance += fin[chatJid].sell; }
            
            pendingTransactionsIp[num] = { jid: chatJid, time: Date.now(), realMsg: realMsgQuoted };
        }
        saveFinance(fin);
        
        await wa.sendMessage(chatJid, { text: `✅ 100% Pesanan Dimasukkan ke Antrean.\n\nMemproses ${userSession.selectedNumbers.length} Transaksi...` }, { quoted: realMsgQuoted });
        
        coIpQueue.push({ jid: chatJid, tgMsg: tgMsg.trim(), expectedReplies: userSession.selectedNumbers.length, receivedReplies: 0, realMsg: realMsgQuoted });
        processCoIpQueue(); 
        
        sessionsIp[senderJid] = { status: 'IDLE' }; return;
    }

    if (command === '.pin') {
        if (!isStoreOpen) return wa.sendMessage(chatJid, { text: 'Toko Tutup' }, { quoted: realMsgQuoted });
        const nums = loadDatabase()[chatJid] || []; if (nums.length === 0) return wa.sendMessage(chatJid, { text: 'Database Kosong' }, { quoted: realMsgQuoted });
        const usedNumbers = new Set((loadHistory()[chatJid] || []).map(i => i.number));
        let txt = '[ PILIH AKUN PIN ]\n'; nums.forEach((n, i) => { txt += `${i+1}. ${n} - ${usedNumbers.has(n) ? 'OFF [X]' : 'ON [V]'}\n`; });
        txt += '\n> Ketik nomor urut (Contoh: 1-3)';
        userSession.status = 'SELECT_ACCOUNTS_PIN'; await wa.sendMessage(chatJid, { text: txt }, { quoted: realMsgQuoted }); return;
    }
    if (userSession.status === 'SELECT_ACCOUNTS_PIN') {
        const nums = loadDatabase()[chatJid] || []; const selectedIndices = parseIndices(trimmedBody);
        const validNumbers = []; selectedIndices.forEach(idx => { if(nums[idx]) validNumbers.push(nums[idx]); });
        if (validNumbers.length === 0) return wa.sendMessage(chatJid, { text: '[ERROR] Salah pilih.' }, { quoted: realMsgQuoted });
        
        let tgMsg = `/FORMAT\nGAS.PIN\n` + validNumbers.join('\n');
        const fin = loadFinance(); if (!fin[chatJid]) fin[chatJid] = { balance: 0, buy: 0, sell: 0, sold: 0, omzet: 0, profit: 0 };
        
        for(const num of validNumbers) {
            addHistory(chatJid, num, 'PIN', '-');
            if(fin[chatJid].sell > 0) { fin[chatJid].sold++; fin[chatJid].omzet += fin[chatJid].sell; fin[chatJid].profit += (fin[chatJid].sell - fin[chatJid].buy); fin[chatJid].balance += fin[chatJid].sell; }
            pendingTransactionsIp[num] = { jid: chatJid, time: Date.now(), realMsg: realMsgQuoted };
        }
        saveFinance(fin);
        
        await wa.sendMessage(chatJid, { text: `✅ Memproses penarikan ${validNumbers.length} PIN...` }, { quoted: realMsgQuoted });
        await tg.sendMessage(TARGET_TG_BOT, { message: tgMsg.trim() });
        
        sessionsIp[senderJid] = { status: 'IDLE' }; return;
    }
}

