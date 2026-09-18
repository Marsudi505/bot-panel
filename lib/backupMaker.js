import fs from "fs";
import path from "path";
import archiver from "archiver";

export default async function createBackupZip() {
    // Buat folder temp jika belum ada
    const tempDir = path.resolve("./temp");
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    // Tentukan nama dan lokasi file ZIP sementara
    const zipPath = path.join(tempDir, `Backup_${Date.now()}.zip`);
    const output = fs.createWriteStream(zipPath);
    
    // Konfigurasi kompresi ZIP level tertinggi (9)
    const archive = archiver("zip", {
        zlib: { level: 9 } 
    });

    return new Promise((resolve, reject) => {
        output.on("close", () => resolve(zipPath));
        archive.on("error", (err) => reject(err));

        archive.pipe(output);

        // Memasukkan semua file dari folder utama panel (root)
        // Mengabaikan folder node_modules, session_auth, temp, dan file .zip lainnya
        archive.glob("**/*", {
            cwd: path.resolve("."),
            ignore: ["node_modules/**", "session_auth/**", "temp/**", "*.zip"]
        });

        archive.finalize();
    });
}
