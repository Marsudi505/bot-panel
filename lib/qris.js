/**
 * QRIS Statis -> Dinamis Converter Helper
 * 
 * Format QRIS (EMV QR Code):
 * - Tag 00: Payload Format Indicator (01)
 * - Tag 01: Point of Initiation (11=statis, 12=dinamis)
 * - Tag 26-51: Merchant Account Information
 * - Tag 52: Merchant Category Code
 * - Tag 53: Transaction Currency (360 = IDR)
 * - Tag 54: Transaction Amount (kosong jika statis, ada jika dinamis)
 * - Tag 58: Country Code (ID)
 * - Tag 59: Merchant Name
 * - Tag 60: Merchant City
 * - Tag 61: Postal Code
 * - Tag 62: Additional Data
 * - Tag 63: CRC (Checksum)
 */

import fs from 'fs';
import path from 'path';

const DB_PATH = path.resolve(process.cwd(), 'qris_database.json');

/**
 * Parse QRIS string ke object TLV
 */
export function parseQRIS(qris) {
    const result = {};
    let i = 0;
    while (i < qris.length) {
        const tag = qris.substr(i, 2);
        const len = parseInt(qris.substr(i + 2, 2), 10);
        const value = qris.substr(i + 4, len);
        
        if (tag === '26' || tag === '51') {
            result[tag] = parseSubTLV(value);
        } else if (tag === '62') {
            result[tag] = parseSubTLV(value);
        } else {
            result[tag] = value;
        }
        i += 4 + len;
    }
    return result;
}

/**
 * Parse sub-TLV (recursive)
 */
function parseSubTLV(str) {
    const result = {};
    let i = 0;
    while (i < str.length) {
        const tag = str.substr(i, 2);
        const len = parseInt(str.substr(i + 2, 2), 10);
        const value = str.substr(i + 4, len);
        result[tag] = value;
        i += 4 + len;
    }
    return result;
}

/**
 * Build TLV dari object
 */
function buildTLV(tag, value) {
    const len = value.length.toString().padStart(2, '0');
    return tag + len + value;
}

/**
 * Build sub-TLV object ke string
 */
function buildSubTLV(obj) {
    let result = '';
    for (const [tag, value] of Object.entries(obj)) {
        result += buildTLV(tag, value);
    }
    return result;
}

/**
 * Generate CRC16-CCITT (0xFFFF) untuk QRIS tag 63
 */
function generateCRC16(str) {
    let crc = 0xFFFF;
    for (let i = 0; i < str.length; i++) {
        crc ^= str.charCodeAt(i) << 8;
        for (let j = 0; j < 8; j++) {
            if (crc & 0x8000) {
                crc = (crc << 1) ^ 0x1021;
            } else {
                crc = crc << 1;
            }
            crc &= 0xFFFF;
        }
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Convert QRIS statis ke dinamis dengan nominal tertentu
 */
export function convertToDynamic(qrisStatis, amount) {
    const parsed = parseQRIS(qrisStatis);
    
    parsed['01'] = '12';
    
    if (amount && amount > 0) {
        parsed['54'] = amount.toString();
    }
    
    let qrisWithoutCRC = '';
    qrisWithoutCRC += buildTLV('00', parsed['00'] || '01');
    qrisWithoutCRC += buildTLV('01', parsed['01']);
    
    if (parsed['26']) {
        qrisWithoutCRC += buildTLV('26', buildSubTLV(parsed['26']));
    }
    if (parsed['51']) {
        qrisWithoutCRC += buildTLV('51', buildSubTLV(parsed['51']));
    }
    
    qrisWithoutCRC += buildTLV('52', parsed['52'] || '0000');
    qrisWithoutCRC += buildTLV('53', parsed['53'] || '360');
    qrisWithoutCRC += buildTLV('54', parsed['54']);
    qrisWithoutCRC += buildTLV('58', parsed['58'] || 'ID');
    qrisWithoutCRC += buildTLV('59', parsed['59'] || 'MERCHANT');
    qrisWithoutCRC += buildTLV('60', parsed['60'] || 'CITY');
    
    if (parsed['61']) {
        qrisWithoutCRC += buildTLV('61', parsed['61']);
    }
    if (parsed['62']) {
        qrisWithoutCRC += buildTLV('62', buildSubTLV(parsed['62']));
    }
    
    const crc = generateCRC16(qrisWithoutCRC + '6304');
    return qrisWithoutCRC + '6304' + crc;
}

/**
 * Get database QRIS
 */
export function getDB() {
    try {
        if (!fs.existsSync(DB_PATH)) {
            saveDB({ users: {} });
        }
        return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    } catch (e) {
        return { users: {} };
    }
}

/**
 * Save database QRIS
 */
export function saveDB(db) {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * Simpan QRIS statis user
 */
export function saveUserQRIS(userId, name, qrisString) {
    const db = getDB();
    if (!db.users[userId]) {
        db.users[userId] = {};
    }
    db.users[userId][name] = {
        qris: qrisString,
        parsed: parseQRIS(qrisString),
        created: Date.now()
    };
    saveDB(db);
}

/**
 * Ambil QRIS statis user
 */
export function getUserQRIS(userId, name) {
    const db = getDB();
    if (!db.users[userId]) return null;
    if (name) return db.users[userId][name] || null;
    return db.users[userId];
}

/**
 * Hapus QRIS user
 */
export function deleteUserQRIS(userId, name) {
    const db = getDB();
    if (!db.users[userId] || !db.users[userId][name]) return false;
    delete db.users[userId][name];
    saveDB(db);
    return true;
}

/**
 * Simpan QRIS dinamis yang sudah dibuat (untuk tracking 24 jam)
 */
export function saveUserQRISDinamis(userId, name, qrisDinamis, amount) {
    const db = getDB();
    if (!db.dinamis) db.dinamis = {};
    if (!db.dinamis[userId]) db.dinamis[userId] = {};
    db.dinamis[userId][name] = {
        qris: qrisDinamis,
        amount: amount,
        created: Date.now(),
        expires: Date.now() + 24 * 60 * 60 * 1000
    };
    saveDB(db);
}

/**
 * Ambil QRIS dinamis user (belum expired)
 */
export function getUserQRISDinamis(userId) {
    const db = getDB();
    if (!db.dinamis || !db.dinamis[userId]) return {};
    const result = {};
    const now = Date.now();
    for (const [name, data] of Object.entries(db.dinamis[userId])) {
        if (data.expires > now) {
            result[name] = data;
        }
    }
    return result;
}
