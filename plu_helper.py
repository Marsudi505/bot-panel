#!/usr/bin/env python3
"""PLU checker helper. Return JSON ke stdout."""
import sys
import os
import json

# Tambahkan parent directory ke path untuk import config
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    import config as cfg
except ImportError:
    class _Cfg:
        AP_MC_BASE = "https://ap-mc.klikindomaret.com"
        SEARCH_PATH = "/assets-klikidmcore/api/get/catalog-xpress/api/webapp/search/result"
        DEFAULT_STORE_CODE = "TTTT"
        STORE_COORDS = {
            "TTTT": {"latitude": "-6.1134", "longitude": "106.8828", "mode": "PICKUP", "districtId": "317305100"},
            "TJKT": {"latitude": "-6.1763897", "longitude": "106.82667", "mode": "DELIVERY", "districtId": "141100100"},
            "2449": {"latitude": "-6.1134", "longitude": "106.8828", "mode": "PICKUP", "districtId": "317305100"},
        }
        API_REFERER = "https://www.klikindomaret.com/"
        API_ORIGIN = "https://www.klikindomaret.com"
        TIMEOUT_API = 20

    cfg = _Cfg()

from curl_cffi import requests as cr

URL = f"{cfg.AP_MC_BASE}{cfg.SEARCH_PATH}"


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "no plu"}))
        return 1
    plu = sys.argv[1]
    store = sys.argv[2] if len(sys.argv) > 2 else cfg.DEFAULT_STORE_CODE

    store_cfg = cfg.STORE_COORDS.get(store, cfg.STORE_COORDS.get(cfg.DEFAULT_STORE_CODE, {}))

    s = cr.Session(impersonate="chrome124")
    s.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "id-ID,id;q=0.9",
        "Referer": cfg.API_REFERER,
        "Origin": cfg.API_ORIGIN,
    })

    params = {
        "keyword": plu,
        "storeCode": store,
        **store_cfg,
        "page": 0,
        "size": 5,
    }
    try:
        resp = s.get(URL, params=params, timeout=cfg.TIMEOUT_API)
        data = resp.json()
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        return 1

    content = (data.get("data") or {}).get("content") or []
    product = next((p for p in content if p.get("plu") == plu), None)
    if not product:
        print(json.dumps({"error": "not_found", "plu": plu}))
        return 0

    out = {
        "ok": True,
        "productName": product.get("productName"),
        "plu": product.get("plu"),
        "brandName": product.get("brandName"),
        "price": product.get("price"),
        "finalPrice": product.get("finalPrice"),
        "promoText": product.get("promoText"),
        "promoType": product.get("promoType"),
        "discountText": product.get("discountText"),
        "uom": product.get("uom"),
        "size": product.get("size"),
        "selling": product.get("selling"),
        "descriptionList": product.get("descriptionList") or [],
        "permalink": product.get("permalink"),
    }
    print(json.dumps(out, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())