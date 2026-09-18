import fs from "fs";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const PDFDocument = require("pdfkit");
const SVGtoPDF = require("svg-to-pdfkit");

const STORE_ICON_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M15 21v-5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v5"/>
  <path d="M17.8 9.6a2 2 0 0 1-3.6 0 2 2 0 0 1-3.6 0 2 2 0 0 1-3.6 0"/>
  <path d="M3 21h18"/>
  <path d="M4 21V9"/>
  <path d="M20 21V9"/>
  <path d="M4 9h16"/>
  <path d="M5 9l1.2-5h11.6L19 9"/>
  <path d="M10 13h4"/>
</svg>
`;

function rupiah(value) { return `Rp ${Number(value || 0).toLocaleString("id-ID")}`; }
function angka(value) { return Number(value || 0).toLocaleString("id-ID"); }
function waktuSekarang() {
    const parts = new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
    const get = (type) => parts.find((part) => part.type === type)?.value;
    return { tanggal: `${get("year")}-${get("month")}-${get("day")}`, jam: `${get("hour")}.${get("minute")}`, fileTanggal: `${get("year")}${get("month")}${get("day")}`, fileJam: `${get("hour")}${get("minute")}` };
}
function safeFileName(value) { return String(value || "").replace(/[^a-zA-Z0-9-_]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, ""); }
function buatNamaFile(prefix = "struk", folder = ".") {
    const now = waktuSekarang();
    const id = Date.now().toString().slice(-6);
    return path.join(folder, `${safeFileName(prefix)}-${now.fileTanggal}-${now.fileJam}-${id}.pdf`);
}
function hitungQty(items) { return items.reduce((total, item) => total + Number(item.qtyTotal ?? item.qty ?? 0), 0); }
function hitungTotal(items) { return items.reduce((total, item) => total + Number(item.qty || 0) * Number(item.harga || 0), 0); }
function hitungTinggi(items) { return Math.max(520, 385 + items.length * 48); }

export default async function generateStrukPdf(data = {}) {
    const { toko = {}, kasir = "-", pelanggan = "-", alamatPelanggan = "-", nomorStruk = null, items = [], bayar = 0, metodeBayar = "Transfer", outputDir = "./temp" } = data;

    const now = waktuSekarang();
    const lebarKertas = 280;
    const margin = 22;
    const contentWidth = lebarKertas - margin * 2;
    const finalNomorStruk = nomorStruk || `No.${Date.now().toString().slice(-6)}`;
    const finalOutputFile = buatNamaFile("struk", outputDir);
    const outputPath = path.resolve(finalOutputFile);

    if (!fs.existsSync(path.dirname(outputPath))) fs.mkdirSync(path.dirname(outputPath), { recursive: true });

    const doc = new PDFDocument({ size: [lebarKertas, hitungTinggi(items)], margins: { top: 16, bottom: 16, left: margin, right: margin } });
    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    const center = (text, options = {}) => doc.text(String(text ?? ""), margin, doc.y, { width: contentWidth, align: "center", ...options });
    const dashedLine = () => {
        doc.moveDown(0.55);
        const y = doc.y;
        doc.save().lineWidth(0.7).dash(4, { space: 4 }).moveTo(margin, y).lineTo(margin + contentWidth, y).stroke().undash().restore();
        doc.moveDown(0.75);
    };
    const infoRow = (left, right) => {
        const y = doc.y;
        doc.text(String(left ?? ""), margin, y, { width: contentWidth * 0.45 });
        doc.text(String(right ?? ""), margin + contentWidth * 0.45, y, { width: contentWidth * 0.55, align: "right" });
        doc.moveDown(0.5);
    };
    const row = (left, right, options = {}) => {
        const y = doc.y;
        doc.text(String(left ?? ""), margin, y, { width: contentWidth * 0.5 });
        doc.text(String(right ?? ""), margin + contentWidth * 0.5, y, { width: contentWidth * 0.5, align: "right" });
        doc.moveDown(options.moveDown ?? 0.42);
    };

    const iconSize = 48;
    const iconX = (lebarKertas - iconSize) / 2;
    SVGtoPDF(doc, STORE_ICON_SVG, iconX, doc.y, { width: iconSize, height: iconSize, preserveAspectRatio: "xMidYMid meet" });
    doc.y += iconSize + 9;

    doc.font("Helvetica").fontSize(14);
    center(toko.nama || "Retail Shop");
    doc.font("Helvetica").fontSize(9.5);
    if (toko.alamat) center(toko.alamat);
    if (toko.kota) center(toko.kota);
    if (toko.telp) center(`No. Telp ${toko.telp}`);

    dashedLine();
    doc.font("Helvetica").fontSize(10);
    infoRow(now.tanggal, kasir);
    infoRow(now.jam, pelanggan);
    if (alamatPelanggan && alamatPelanggan !== "-") { doc.text(alamatPelanggan, margin, doc.y, { width: contentWidth, align: "right" }); doc.moveDown(0.65); }
    doc.text(finalNomorStruk, margin, doc.y, { width: contentWidth });
    dashedLine();

    let total = 0;
    items.forEach((item, index) => {
        const nama = item.nama || "-";
        const qty = Number(item.qty || 0);
        const satuan = item.satuan || "";
        const harga = Number(item.harga || 0);
        const subtotal = qty * harga;
        const detail = satuan ? `  ${qty} ${satuan} x ${angka(harga)}` : `  ${qty} x ${angka(harga)}`;
        total += subtotal;

        doc.font("Helvetica-Bold").fontSize(10.5);
        doc.text(`${index + 1}. ${nama}`, margin, doc.y, { width: contentWidth });
        const y = doc.y;
        doc.font("Helvetica").fontSize(9.5);
        doc.text(detail, margin, y, { width: contentWidth * 0.58 });
        doc.font("Helvetica").fontSize(10.5);
        doc.text(rupiah(subtotal), margin + contentWidth * 0.58, y, { width: contentWidth * 0.42, align: "right" });
        doc.moveDown(0.75);
    });

    dashedLine();
    const totalQty = hitungQty(items);
    const subTotal = hitungTotal(items);
    const kembali = Number(bayar || 0) - subTotal;

    doc.font("Helvetica").fontSize(10);
    doc.text(`Total QTY : ${totalQty}`, margin, doc.y);
    doc.moveDown(1.05);
    doc.font("Helvetica").fontSize(10);
    row("Sub Total", rupiah(subTotal));
    const yTotal = doc.y;
    doc.font("Helvetica-Bold").fontSize(12);
    doc.text("Total", margin, yTotal, { width: contentWidth * 0.45 });
    doc.font("Helvetica-Bold").fontSize(14);
    doc.text(rupiah(total), margin + contentWidth * 0.45, yTotal, { width: contentWidth * 0.55, align: "right" });
    doc.moveDown(0.68);
    doc.font("Helvetica").fontSize(10);
    row(`Bayar (${metodeBayar})`, rupiah(bayar));
    row("Kembali", rupiah(kembali));

    doc.moveDown(1.1);
    doc.font("Helvetica").fontSize(10.5);
    center("Terimakasih Telah Berbelanja");
    doc.moveDown(0.3);
    doc.font("Helvetica").fontSize(8.5);
    center("Simpan struk ini sebagai bukti pembayaran");

    doc.end();

    await new Promise((resolve, reject) => { stream.on("finish", resolve); stream.on("error", reject); });
    return outputPath;
}
