import { Jimp } from 'jimp';
import { createRequire } from 'module';
import QRCode from 'qrcode';
import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import { parseQRIS, convertToDynamic, saveUserQRIS, getUserQRIS, deleteUserQRIS, saveUserQRISDinamis, getUserQRISDinamis } from '../lib/qris.js';

const require = createRequire(import.meta.url);
const QrCodeReader = require('qrcode-reader');

export const command = ['qris', 'qrisset', 'listqris', 'qrisdel'];

export default async function(m, { riz, id, msg, reply, reactm, q, sender, cmd }) {
    const text = (q || '').trim();
    const args = text.split(/\s+/);
    const subcmd = cmd?.toLowerCase() || 'qris';
    
    const senderNum = (sender || '').split('@')[0] || '';

    // --- QRIS STATIS -> DINAMIS (default command .qris) ---
    if (subcmd === 'qris') {
        const amount = parseInt(args[0]);
        const qrisName = args[1];
        
        if (!amount || amount <= 0 || amount > 100000000) {
            return reply(`⚠️ Format salah!\n\n📖 Cara pakai:\n• Kirim gambar QRIS → reply dengan: .qris [nominal]\n• Kirim gambar QRIS → reply dengan: .qris [nominal] [nama_qris]\n\nContoh:\n.qris 50000 dana_kasir\n.qris 15000\n\n⚡ Perintah lain:\n• .qrisset [nama] - simpan QRIS statis\n• .listqris - lihat QRIS tersimpan\n• .qrisdel [nama] - hapus QRIS tersimpan`);
        }
        
        let qrisStatis = null;
        let source = '';

        if (qrisName) {
            const saved = getUserQRIS(senderNum, qrisName);
            if (saved) {
                qrisStatis = saved.qris;
                source = 'database';
            }
        }

        if (!qrisStatis) {
            const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage || msg.message;
            const mediaType = Object.keys(quoted || {}).find(t => ['imageMessage', 'documentMessage'].includes(t));
            
            if (mediaType) {
                await reactm('⏳');
                try {
                    const stream = await downloadContentFromMessage(quoted[mediaType], mediaType.replace('Message', ''));
                    let buffer = Buffer.from([]);
                    for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
                    
                    const image = await Jimp.read(buffer);
                    const qr = new QrCodeReader();
                    
                    const result = await new Promise((resolve, reject) => {
                        qr.callback = (err, value) => {
                            if (err) reject(err);
                            else resolve(value);
                        };
                        qr.decode(image.bitmap);
                    });
                    
                    qrisStatis = result.result;
                    source = 'gambar';
                } catch (e) {
                    await reactm('❌');
                    return reply('❌ Gagal scan QR code dari gambar. Pastikan gambar QR jelas dan tidak terpotong.');
                }
            }
        }

        if (!qrisStatis) {
            const potentialQRIS = args.slice(1).join(' ').trim();
            if (potentialQRIS.length > 50 && /^\d+$/.test(potentialQRIS)) {
                qrisStatis = potentialQRIS;
                source = 'input';
            }
        }

        if (!qrisStatis) {
            return reply('❌ QRIS tidak ditemukan!\n\nCara pakai:\n1. Kirim gambar QRIS statis\n2. Reply gambar dengan: .qris [nominal]\n\nContoh:\n.qris 50000');
        }

        try {
            await reactm('⏳');
            const qrisDinamis = convertToDynamic(qrisStatis, amount);
            const buffer = await QRCode.toBuffer(qrisDinamis, { 
                type: 'png', 
                width: 800, 
                margin: 2,
                color: { dark: '#000000', light: '#ffffff' }
            });
            
            // Calculate expiration (24 hours from now)
            const now = new Date();
            const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            const expStr = expires.toLocaleString('id-ID', { 
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit', hour12: false
            });

            await reactm('✅');
            // Save to dinamis DB for tracking
            saveUserQRISDinamis(senderNum, qrisName || 'manual_' + Date.now(), qrisDinamis, amount);
            
            // Use m.chat as fallback for id (fix DM issue)
            const chatId = id || m.chat || m.key?.remoteJid;
            await riz.sendMessage(chatId, { 
                image: buffer, 
                caption: `📱 Silahkan scan qris berikut\n\n💰 Nominal: Rp ${amount.toLocaleString('id-ID')}\n⏰ Exp: ${expStr} (24 jam)` 
            }, { quoted: msg });
        } catch (e) {
            await reactm('❌');
            console.error('[QRIS ERROR]', e);
            reply('❌ Gagal membuat QRIS dinamis. Pastikan QRIS valid.');
        }
        return;
    }

    // --- SIMPAN QRIS STATIS ---
    if (subcmd === 'qrisset') {
        const name = args[0];
        if (!name) return reply('⚠️ Format: .qrisset [nama_qris]\nSimpan QRIS statis dengan nama untuk dipakai berulang.');

        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage || msg.message;
        const mediaType = Object.keys(quoted || {}).find(t => ['imageMessage', 'documentMessage'].includes(t));
        
        let qrisStatis = null;

        if (mediaType) {
            await reactm('⏳');
            try {
                const stream = await downloadContentFromMessage(quoted[mediaType], mediaType.replace('Message', ''));
                let buffer = Buffer.from([]);
                for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
                
                const image = await Jimp.read(buffer);
                const qr = new QrCodeReader();
                
                const result = await new Promise((resolve, reject) => {
                    qr.callback = (err, value) => {
                        if (err) reject(err);
                        else resolve(value);
                    };
                    qr.decode(image.bitmap);
                });
                
                qrisStatis = result.result;
            } catch (e) {
                await reactm('❌');
                return reply('❌ Gagal scan QR code.');
            }
        } else {
            const potentialQRIS = text.replace(name, '').trim();
            if (potentialQRIS.length > 50 && /^\d+$/.test(potentialQRIS)) {
                qrisStatis = potentialQRIS;
            }
        }

        if (!qrisStatis) {
            return reply('❌ Kirim gambar QRIS atau ketik QRIS statis setelah nama.\n\nFormat: .qrisset [nama]');
        }

        saveUserQRIS(senderNum, name, qrisStatis);
        await reactm('✅');
        reply(`✅ QRIS statis berhasil disimpan dengan nama "${name}".\n\nGunakan: .qris [nominal] ${name}`);
        return;
    }

    // --- LIHAT DAFTAR QRIS TERSIMPAN (.listqris) ---
    if (subcmd === 'listqris') {
        const allQRIS = getUserQRIS(senderNum);
        if (!allQRIS || Object.keys(allQRIS).length === 0) {
            return reply('📭 Belum ada QRIS tersimpan.\n\nGunakan .qrisset [nama] untuk menyimpan QRIS statis.');
        }

        let list = '📋 *DAFTAR QRIS TERSIMPAN*\n━━━━━━━━━━━━━━━\n';
        for (const [qrisName, data] of Object.entries(allQRIS)) {
            const info = data.parsed;
            const merchantName = info['59'] || 'N/A';
            list += `\n📌 *${qrisName}*\n├ Merchant: ${merchantName}\n└ Buat: ${new Date(data.created).toLocaleString('id-ID')}\n`;
        }
        list += '\n💡 Gunakan: .qris [nominal] [nama_qris]';
        reply(list);
        return;
    }

    // --- HAPUS QRIS ---
    if (subcmd === 'qrisdel') {
        const name = args[0];
        if (!name) return reply('⚠️ Format: .qrisdel [nama_qris]');
        
        if (deleteUserQRIS(senderNum, name)) {
            reply(`✅ QRIS "${name}" berhasil dihapus.`);
        } else {
            reply(`❌ QRIS "${name}" tidak ditemukan.`);
        }
        return;
    }
}
