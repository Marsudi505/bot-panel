export const command = ["getpp", "pp"];

export default async function (m, { riz, reply, qriz, id, msg, sender, reactm }) {
    // 1. Tentukan target: Apakah me-reply pesan, atau targetnya diri sendiri
    const ctx = msg.message?.extendedTextMessage?.contextInfo;
    const target = ctx?.participant || sender;

    await reactm("⏳");

    try {
        // 2. Menarik link foto profil dari server WhatsApp
        const ppUrl = await riz.profilePictureUrl(target, "image");

        // 3. Mengirimkan URL tersebut sebagai pesan Gambar
        await riz.sendMessage(id, {
            image: { url: ppUrl },
            caption: " *Ini dia foto profilnya!*"
        }, { quoted: qriz });

        await reactm("✅");

    } catch (err) {
        console.error("GETPP ERROR:", err);
        await reactm("❌");
        
        // 4. Penanganan error jika foto tidak ada / diprivasi (item-not-found)
        if (String(err).includes("item-not-found")) {
            return reply("❌ Tidak dapat mengambil foto profil.\nKemungkinan target tidak memasang foto profil, atau pengaturannya di-private dari bot.");
        }
        
        reply(`❌ Terjadi kesalahan: ${err.message}`);
    }
}
