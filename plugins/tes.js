export const command = ["tesupload", "cobaupload"];

export default async function (m, { reply, reactm, pushname }) {
    // Memberikan reaksi jam pasir saat perintah diterima
    await reactm("⏳");
    
    // Pesan balasan
    const teks = `Halo *${pushname}* 👋\n\n🎉 Selamat! File *tes.js* berhasil diunggah ke server.\n\nSistem _auto-loader_ bekerja dengan sempurna. Plugin ini langsung terbaca dan bisa digunakan tanpa perlu menekan tombol restart di Pterodactyl! 🚀`;
    
    // Mengirim pesan balasan
    await reply(teks);
    
    // Memberikan reaksi centang hijau setelah selesai
    await reactm("✅");
}
