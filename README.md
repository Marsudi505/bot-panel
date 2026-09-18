# Bot Panel - INDICA PROJECT

Bot WhatsApp untuk cek harga, stok, dan barcode produk Klik Indomaret.

## Fitur

- `/plu <kode>` — Cek harga, promo, dan barcode produk
- `/plu <kode> <qty>` — Cek produk dengan quantity (bulk)
- `/stok <plu> <kodetoko>` — Cek stok produk di toko tertentu
- `/caritoko <kode/nama>` — Cari toko Indomaret terdekat
- `/scan [index]` — Scan barcode dari gambar
- `/fairs` — Cek harga acuan
- `/v` — Anti view-once
- `/moderegis` — Mode registrasi
- `/exitregis` — Keluar dari mode registrasi
- `/modeco` — Mode checkout
- `/modeco2` — Mode checkout v2
- `/modeip` — Mode iPhone
- `/exitco` — Keluar dari mode checkout
- `/exitip` — Keluar dari mode iPhone
- `/add <id>` — Tambah user allowed (admin only)
- `/menu` — Tampilkan menu
- `/ping` — Cek status bot

## Instalasi

### Prasyarat

- Node.js v18+
- Python 3.8+
- PM2 (untuk process manager)
- Termux (Android) atau Linux

### Langkah-langkah

1. Clone repository:
```bash
git clone https://github.com/Marsudi505/bot-panel.git
cd bot-panel
```

2. Install dependencies:
```bash
npm install
```

3. Install Python dependencies:
```bash
pip install curl_cffi
```

4. Isi konfigurasi:
   - Edit `config.js` — isi `SUPABASE_KEY` dan `GITHUB_TOKEN`
   - Edit `config.py` — isi `SUPABASE_KEY` dan `GITHUB_TOKEN`

5. Jalankan bot:
```bash
pm2 start ecosystem.config.cjs
```

6. Atau jalankan langsung:
```bash
node index.js
```

## Konfigurasi

### config.js

```javascript
{
    SUPABASE_KEY: "",      // Isi dengan Supabase anon key
    GITHUB_TOKEN: "",      // Isi dengan GitHub personal access token
    BARCODE_DB_PATH: "/sdcard/Download/barcodesheet.json",
    DEFAULT_STORE_CODE: "TX0B",
    OWNER_PHONE: "085790374090",
    OWNER_BC_A: "7901479538",
}
```

### config.py

```python
SUPABASE_KEY = ""  # Isi dengan Supabase anon key
GITHUB_TOKEN = ""  # Isi dengan GitHub personal access token
BARCODE_DB_PATH = "/sdcard/Download/barcodesheet.json"
DEFAULT_STORE_CODE = "TX0B"
OWNER_PHONE = "085790374090"
OWNER_BC_A = "7901479538"
```

## Struktur File

```
bot-panel/
├── index.js              # Main bot file
├── connection.js         # WhatsApp connection handler
├── config.js             # Konfigurasi (isi token di sini)
├── config.py             # Konfigurasi Python (isi token di sini)
├── plu_helper.py         # Helper untuk cek PLU via API
├── co.js                 # Checkout engine v1
├── co2.js                # Checkout engine v2
├── coip.js               # Checkout engine iPhone mode
├── plugins/              # Plugin modules
├── lib/                  # Library modules
├── session_auth/         # WhatsApp session (jangan diupload)
├── node_modules/         # Dependencies (jangan diupload)
├── allowed_users.json    # Daftar user allowed
├── usermode.json         # Mode user
├── database.json         # Database lokal
├── history.json          # History transaksi
├── finance.json          # Data keuangan
├── admins.json           # Daftar admin
└── README.md             # File ini
```

## Catatan

- File `config.js` dan `config.py` yang diupload ke GitHub tidak berisi token asli
- Token asli disimpan di `/sdcard/BACKUP/config-bot/`
- Pastikan `barcodesheet.json` tersedia di `/sdcard/Download/`
- Bot berjalan di mode `self` (owner only) secara default

## License

MIT License - INDICA PROJECT est. 2026