import axios from "axios";

export const command = ["carbon", "code"];

export default async function (m, { riz, reply, qriz, id, q, reactm, msg }) {
    // Ambil teks dari parameter 'q' atau dari pesan yang di-reply
    const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const quotedText = quotedMsg?.conversation || quotedMsg?.extendedTextMessage?.text;
    const codeInput = q || quotedText;

    if (!codeInput) {
        return reply("❌ Masukkan kode atau reply pesan teks yang berisi kode.\n\nContoh:\n.carbon console.log('Hello World');");
    }

    await reactm("⏳");

    const INPUT = {
        code: codeInput,
        language: "javascript", // Secara default kita set JS, tapi API biasanya cukup pintar auto-detect
        theme: "dracula-pro",
        font: "Fira Code",
        fontSize: "14px",
        background: "rgba(226,233,239,1)",
        lineNumbers: true,
        width: 1024,
        height: 768,
    };

    const API = "https://api.rifkyshre.biz.id";
    const ROUTE = "/maker/carbon";

    try {
        const res = await axios.post(`${API}${ROUTE}`, INPUT, {
            timeout: 60000,
            validateStatus: () => true,
            headers: { "Content-Type": "application/json" },
        });

        const body = res.data;
        if (!body?.status || !body?.data?.url) {
            throw new Error(body?.error || "Gagal mendapatkan gambar dari API.");
        }

        // Kirim hasil gambar Carbon ke WhatsApp
        await riz.sendMessage(
            id,
            {
                image: { url: body.data.url },
                caption: "Nih hasil code snippet-nya 💻✨"
            },
            { quoted: qriz }
        );

        await reactm("✅");
    } catch (err) {
        console.error("CARBON ERROR:", err);
        await reactm("❌");
        reply(`❌ Terjadi kesalahan saat memproses carbon: ${err.message}`);
    }
}
