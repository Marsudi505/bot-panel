import { NFToolsClient, getLiveEliteProxy, getProxy, setProxy } from '../lib/nftools.js';

const PROXY_API_KEY = '2uBXr7PQFBexppmsihvMWoW9yJvlYteVVE2v1ChtTfKgmBNpgaY9gHo7MqOOhDfK';

// Store client per user to maintain session
const clients = new Map();

export const command = ['netflix', 'nf', 'nftoken'];

export default async function(m, { riz, id, msg, reply, reactm, q, sender, cmd }) {
    const text = (q || '').trim();
    const args = text.split(/\s+/);
    const subcmd = args[0]?.toLowerCase() || 'help';
    const senderNum = (sender || '').split('@')[0] || '';

    const getSession = () => {
        if (!clients.has(senderNum)) {
            clients.set(senderNum, new NFToolsClient());
        }
        return clients.get(senderNum);
    };

    if (cmd === 'help' || subcmd === 'help' || !subcmd) {
        await reply(`🎬 *NETFLIX TOOLS BY LANN*

*.nf quota* - Cek sisa quota harian
*.nf countries* - Daftar negara & stok
*.nf gen [country]* - Buat NFToken link
  Contoh: *.nf gen US*

*.nf convert [cookies]* - Konversi cookies ke NFToken
  Reply cookies atau ketik setelah command

*.nf proxy* - Lihat status proxy
*.nf proxy on* - Aktifkan proxy rotation
*.nf proxy off* - Nonaktifkan proxy
*.nf proxy ip:port* - Set manual proxy

*.nf reset* - Reset session (ganti IP/device)

Note: Proses mungkin perlu waktu 10-30 detik`);
        return;
    }

    // QUOTA
    if (subcmd === 'quota' || subcmd === 'usage' || subcmd === 'q') {
        await reactm('⏳');
        try {
            const client = getSession();
            const usage = await client.getUsage();
            await reactm('✅');
            reply(`📊 *QUOTA HARIAN*

Limit: ${usage.limit ?? '∞'}
Terpakai: ${usage.count ?? 0}
Sisa: ${usage.remaining ?? '∞'}

Device: ${client.deviceId.slice(0, 16)}...`);
        } catch (e) {
            await reactm('❌');
            console.error('[NFLIX ERROR]', e);
            reply(`❌ Gagal cek quota: ${e.message}`);
        }
        return;
    }

    // COUNTRIES
    if (subcmd === 'country' || subcmd === 'countries' || subcmd === 'list' || subcmd === 'c') {
        await reactm('⏳');
        try {
            const client = getSession();
            const data = await client.getCountries();
            const countries = data.countries || [];

            let result = `🌍 *DAFTAR NEGARA*

Total: ${countries.length} negara

`;
            countries.forEach((c, i) => {
                const name = c.name || c.country_code;
                const count = c.count || 0;
                result += `${i + 1}. ${name} (${c.country_code}) — ${count} cookies\n`;
            });

            await reactm('✅');
            reply(result);
        } catch (e) {
            await reactm('❌');
            console.error('[NFLIX ERROR]', e);
            reply(`❌ Gagal ambil daftar negara: ${e.message}`);
        }
        return;
    }

    // GENERATE LINK
    if (subcmd === 'gen' || subcmd === 'generate' || subcmd === 'link' || subcmd === 'g') {
        const countryCode = args[1]?.toUpperCase();
        if (!countryCode) {
            reply('⚠️ Masukkan kode negara!\n\nContoh: .nf gen US');
            return;
        }

        await reactm('⏳');
        try {
            const client = getSession();
            let res = await client.generateLink(countryCode);

            // Auto-rotate on limit
            const isLimitReached = !res.ok && (
                (res.remaining !== undefined && res.remaining <= 0) ||
                (res.error && /used all|limit|tomorrow/i.test(res.error))
            );

            if (isLimitReached && getProxy()) {
                await reactm('🔄');
                console.log('[NFLIX] Auto-rotating session...');
                await client.initSession();
                res = await client.generateLink(countryCode);
            }

            if (res.ok) {
                await reactm('✅');
                const exp = res.expires ? new Date(res.expires * 1000).toLocaleString('id-ID') : '-';
                reply(`✅ *NFTOKEN LINK BERHASIL*

📍 Negara: ${countryCode.toUpperCase()}
⏰ Exp: ${exp}

🔗 Browser: ${res.browserLink || '-'}
📱 Mobile: ${res.mobileLink || '-'}
📺 TV: ${res.tvLink || '-'}

${res.accountInfo && res.accountInfo.length > 0 ? '👤 ' + res.accountInfo.join('\n👤 ') : ''}`);
            } else {
                await reactm('❌');
                reply(`❌ Gagal buat link: ${res.error || 'Unknown error'}
Sisa quota: ${res.remaining ?? 0}`);
            }
        } catch (e) {
            await reactm('❌');
            console.error('[NFLIX ERROR]', e);
            reply(`❌ Error: ${e.message}`);
        }
        return;
    }

    // CONVERT COOKIES
    if (subcmd === 'convert' || subcmd === 'conv' || subcmd === 'cookie' || subcmd === 'ck') {
        // Get cookies from quoted message or args
        let rawCookies = args.slice(1).join(' ');
        
        if (!rawCookies) {
            const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            if (quoted?.conversation) {
                rawCookies = quoted.conversation;
            } else if (quoted?.extendedTextMessage?.text) {
                rawCookies = quoted.extendedTextMessage.text;
            }
        }

        if (!rawCookies) {
            reply('⚠️ Kirim/paste cookies Netflix!\n\nKetik setelah command atau reply pesan cookies.');
            return;
        }

        await reactm('⏳');
        try {
            const client = getSession();
            const res = await client.convertCookies(rawCookies);

            if (res.ok) {
                await reactm('✅');
                const exp = res.expires ? new Date(res.expires * 1000).toLocaleString('id-ID') : '-';
                reply(`✅ *KONVERSI BERHASIL*

⏰ Exp: ${exp}

🔗 Browser: ${res.browserLink || '-'}
📱 Mobile: ${res.mobileLink || '-'}
📺 TV: ${res.tvLink || '-'}

${res.accountInfo && res.accountInfo.length > 0 ? '👤 ' + res.accountInfo.join('\n👤 ') : ''}`);
            } else {
                await reactm('❌');
                reply(`❌ Gagal konversi: ${res.error || 'Format cookies tidak valid'}`);
            }
        } catch (e) {
            await reactm('❌');
            console.error('[NFLIX ERROR]', e);
            reply(`❌ Error: ${e.message}`);
        }
        return;
    }

    // PROXY
    if (subcmd === 'proxy' || subcmd === 'prox') {
        const action = args[1]?.toLowerCase();
        if (!action) {
            const p = getProxy();
            reply(`⚙️ *PROXY STATUS*

Status: ${p ? 'AKTIF' : 'NONAKTIF'}
Proxy: ${p || 'Direct connection'}

Gunakan:
• .nf proxy on — auto rotation
• .nf proxy off — direct
• .nf proxy ip:port — manual`);
            return;
        }

        if (action === 'off') {
            setProxy(null);
            // Reset session for existing client
            if (clients.has(senderNum)) {
                clients.delete(senderNum);
            }
            reply('✅ Proxy dinonaktifkan. Koneksi direct.');
            return;
        }

        if (action === 'on') {
            await reactm('⏳');
            try {
                const proxy = await getLiveEliteProxy(PROXY_API_KEY);
                if (proxy) {
                    setProxy(proxy);
                    if (clients.has(senderNum)) clients.delete(senderNum);
                    await reactm('✅');
                    reply(`✅ Proxy aktif!\n📍 ${proxy}\n\nSession baru dibuat.`);
                } else {
                    await reactm('❌');
                    reply('❌ Tidak ditemukan proxy aktif.');
                }
            } catch (e) {
                await reactm('❌');
                reply(`❌ Error: ${e.message}`);
            }
            return;
        }

        // Manual proxy: .nf proxy ip:port
        if (action.includes(':')) {
            setProxy(action);
            if (clients.has(senderNum)) clients.delete(senderNum);
            reply(`✅ Proxy manual diset!\n📍 ${action}\n\nSession baru dibuat.`);
            return;
        }

        reply('⚠️ Format: .nf proxy [on/off/ip:port]');
        return;
    }

    // RESET
    if (subcmd === 'reset' || subcmd === 'r' || subcmd === 'refresh') {
        await reactm('⏳');
        try {
            const client = getSession();
            await client.initSession();
            await reactm('✅');
            reply(`✅ Session berhasil di-reset!

📍 Device ID: ${client.deviceId.slice(0, 20)}...
📍 Proxy: ${getProxy() || 'Direct'}

Session baru siap digunakan.`);
        } catch (e) {
            await reactm('❌');
            console.error('[NFLIX ERROR]', e);
            reply(`❌ Gagal reset: ${e.message}`);
        }
        return;
    }

    reply(`❌ Command tidak dikenal.

Gunakan *.nf help* untuk melihat daftar command.`);
}
