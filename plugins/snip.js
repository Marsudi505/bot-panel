import { AIRich } from "../lib/nixcode.js";

export const command = ["snip", "inspect"];

export default async function (m, { riz, reply, qriz, id, msg, reactm, senderNum }) {
    // 🔒 Keamanan: Hanya Anda (Owner) yang bisa membedah struktur pesan
    if (senderNum !== "6285xxxxx090") return reply("❌ Akses ditolak! Ini adalah fitur Developer.");

    // Mengambil metadata dari pesan yang di-reply
    const ctx = msg.message?.extendedTextMessage?.contextInfo;
    const quoted = ctx?.quotedMessage;

    if (!quoted) return reply("⚠️ Anda harus me-reply sebuah pesan untuk di-snip!");

    await reactm("⏳");

    try {
        // Ekstraksi Informasi Target
        const participant = ctx.participant || "Tidak diketahui";
        const msgId = ctx.stanzaId || "Tidak diketahui";
        
        // Mendapatkan waktu saat ini
        const timeNow = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });

        // Membuat format header teks
        const headerText = `*Info Pengirim*\nParticipant : ${participant}\nMessage ID : ${msgId}\nTimestamp : ${timeNow}`;

        // Mengubah raw JSON pesan menjadi bentuk string yang rapi
        const rawJson = JSON.stringify(quoted, null, 2);
        
        // Mensimulasikan kode Baileys JS (persis seperti bot teman Anda)
        const codeSnippet = `await sock.relayMessage(jid, \n${rawJson}\n, { messageId: "${msgId}" });`;

        // ==========================================
        // 🚀 MEMBANGUN UI DENGAN NIXCODE AIRich
        // ==========================================
        const sniffer = new AIRich(riz);
        
        // 1. Masukkan Teks Header
        sniffer.addText(headerText);
        
        // 2. Masukkan Blok Kode JavaScript
        sniffer.addCode("javascript", codeSnippet);

        // Kirimkan hasilnya ke WhatsApp
        await sniffer.send(id, { quoted: qriz });
        
        await reactm("✅");

    } catch (err) {
        console.error("SNIP ERROR:", err);
        await reactm("❌");
        reply("❌ Gagal mengekstrak struktur pesan: " + err.message);
    }
}
