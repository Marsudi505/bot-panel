// Suppress Node.js runtime deprecation warnings
process.noDeprecation = true;
process.removeAllListeners('warning');

import crypto from 'crypto';
import fetch from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';
import * as haidarPkg from 'haidarcf';
import config from '../config.js';

const { haidarcf } = haidarPkg;

// Constants & Endpoints
const AUTHOR_NAME = 'Lann';
const BASE_URL = 'https://nftools.live';
const TURNSTILE_SITEKEY = '0x4AAAAAADrtSr01ExtZ3ikN';
const SUPABASE_URL = 'https://ytowziwmmvtxhbcfyonk.supabase.co';
const SUPABASE_ANON_KEY = config.SUPABASE_KEY;
const PROXY_API_KEY = '2uBXr7PQFBexppmsihvMWoW9yJvlYteVVE2v1ChtTfKgmBNpgaY9gHo7MqOOhDfK';

const SERVER_FN_IDS = {
  TOKEN: '170f89ee5ad7e666f1eb147823da1546f98126cceecb548f2aefe3a2349b6c57',
  COUNTRIES: 'b6f32cb097d03b340ab7820a0c3449f410e38dd0621d3d13682b52b00de500d3',
  USAGE: 'b0a92a794170f9dd228fc024748957e676e45d7a3853cc371ee0378c016d79eb',
  GET_LINK: '77925f08e3f251cda34d206a5097f6d339da6ed089307ae03ca160b34ca385c4',
  CONVERT: '8210e805f6a6e6ab0d5f9831b51d242038d6a7ff0991105f06ce137267f06fe2'
};

const COUNTRY_NAMES = {
  US: "United States", CA: "Canada", GB: "United Kingdom", IN: "India",
  BR: "Brazil", FR: "France", TR: "Turkey", MX: "Mexico", ES: "Spain",
  KR: "South Korea", PH: "Philippines", ID: "Indonesia", IT: "Italy",
  DE: "Germany", PL: "Poland", ZA: "South Africa", PK: "Pakistan",
  TH: "Thailand", JP: "Japan", AR: "Argentina", MY: "Malaysia",
  SG: "Singapore", HK: "Hong Kong", TW: "Taiwan", AU: "Australia",
  RO: "Romania", NL: "Netherlands", EG: "Egypt", VN: "Vietnam"
};

let currentProxy = null;
let proxyAgent = null;

// Seroval Serialization
function serializeSeroval(data) {
  let id = 0;
  function walk(val) {
    if (val === null) return { t: 2, s: 0 };
    if (val === undefined) return { t: 2, s: 1 };
    if (typeof val === 'boolean') return { t: 2, s: val ? 2 : 3 };
    if (typeof val === 'number') return { t: 0, s: val };
    if (typeof val === 'string') return { t: 1, s: val };
    if (Array.isArray(val)) {
      const curId = id++;
      return { t: 9, i: curId, a: val.map(walk), o: 0 };
    }
    if (typeof val === 'object') {
      const curId = id++;
      const keys = Object.keys(val);
      const values = keys.map(k => walk(val[k]));
      return { t: 10, i: curId, p: { k: keys, v: values }, o: 0 };
    }
    throw new Error('Unsupported Seroval type: ' + typeof val);
  }
  return { t: walk(data), f: 63, m: [] };
}

function parseSerovalNode(node) {
  if (!node || typeof node !== 'object') return node;
  if (node.t === 0) return node.s;
  if (node.t === 1) return node.s;
  if (node.t === 2) {
    if (node.s === 2) return true;
    if (node.s === 3) return false;
    if (node.s === 0) return null;
    if (node.s === 1) return undefined;
  }
  if (node.t === 9) return (node.a || []).map(parseSerovalNode);
  if ((node.t === 10 || node.t === 11) && node.p) {
    const obj = {};
    const keys = node.p.k || [];
    const vals = node.p.v || [];
    for (let i = 0; i < keys.length; i++) {
      obj[keys[i]] = parseSerovalNode(vals[i]);
    }
    return obj;
  }
  return node;
}

function parseSerovalResponse(json) {
  const root = parseSerovalNode(json);
  if (root && root.result !== undefined) return root.result;
  if (root && root.error !== undefined) throw new Error(JSON.stringify(root.error));
  return root;
}

export function setProxy(proxy) {
  currentProxy = proxy || null;
  proxyAgent = proxy ? new HttpsProxyAgent(`http://${proxy}`) : null;
}

export function getProxy() {
  return currentProxy;
}

export class NFToolsClient {
  constructor() {
    this.deviceId = crypto.randomUUID();
    this.ua = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36';
    this.wafHeaders = {};
    this.accessToken = null;
    this.sessionCookie = null;
    this.toolToken = null;
    this.tokenExpiresAt = 0;
  }

  async initSession() {
    this.deviceId = crypto.randomUUID();

    // 1. WAF Session
    const wafParams = { url: `${BASE_URL}/tools/nftoken-link` };
    if (currentProxy) {
      const [host, port] = currentProxy.split(':');
      wafParams.proxy = { host, port: Number(port) };
    }
    let wafData;
    try {
      wafData = await haidarcf.wafSession(wafParams);
    } catch (err) {
      if (wafParams.proxy) {
        delete wafParams.proxy;
        wafData = await haidarcf.wafSession(wafParams);
      } else {
        throw err;
      }
    }
    if (wafData && wafData.headers) {
      this.wafHeaders = wafData.headers;
      if (wafData.headers['user-agent']) this.ua = wafData.headers['user-agent'];
    }
    let cookieList = [];
    if (wafData && wafData.cookies) {
      cookieList = wafData.cookies.map(c => `${c.name}=${c.value}`);
    }

    // 2. Supabase Auth
    let authData;
    try {
      const authRes = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
        method: 'POST',
        headers: { 'apikey': SUPABASE_ANON_KEY, 'content-type': 'application/json' },
        body: JSON.stringify({}),
        agent: proxyAgent || undefined
      });
      const authText = await authRes.text();
      try {
        authData = JSON.parse(authText);
      } catch (jsonErr) {
        // If not JSON, try anonymous sign-in
        const anonRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=anonymous`, {
          method: 'POST',
          headers: { 'apikey': SUPABASE_ANON_KEY, 'content-type': 'application/json' },
          body: JSON.stringify({}),
          agent: proxyAgent || undefined
        });
        const anonText = await anonRes.text();
        try {
          authData = JSON.parse(anonText);
        } catch (e2) {
          throw new Error(`Supabase auth failed: ${authText.substring(0, 100)} / ${anonText.substring(0, 100)}`);
        }
      }
    } catch (err) {
      throw new Error(`Supabase auth error: ${err.message}`);
    }
    this.accessToken = authData.access_token || authData.access_token;

    // 3. Turnstile Solver
    const solverParams = { url: `${BASE_URL}/tools/nftoken-link`, siteKey: TURNSTILE_SITEKEY };
    if (currentProxy) {
      const [host, port] = currentProxy.split(':');
      solverParams.proxy = { host, port: Number(port) };
    }
    let tsData;
    try {
      tsData = await haidarcf.turnstileMin(solverParams);
    } catch (err) {
      if (solverParams.proxy) {
        delete solverParams.proxy;
        tsData = await haidarcf.turnstileMin(solverParams);
      } else {
        throw err;
      }
    }
    if (!tsData || !tsData.token) throw new Error('Gagal mendapatkan Turnstile token');

    // 4. Verify & Establish Cookie Session
    const verifyRes = await fetch(`${BASE_URL}/api/turnstile/verify`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'origin': BASE_URL,
        'referer': `${BASE_URL}/tools/nftoken-link`,
        'user-agent': this.ua,
        'cookie': cookieList.join('; '),
        ...this.wafHeaders
      },
      body: JSON.stringify({ token: tsData.token }),
      agent: proxyAgent || undefined
    });
    const setCookies = verifyRes.headers.raw()['set-cookie'] || [];
    for (const c of setCookies) cookieList.push(c.split(';')[0]);
    this.sessionCookie = cookieList.join('; ');

    // 5. Tool Token
    await this.refreshToken();
  }

  async refreshToken() {
    const tokenPayload = serializeSeroval({ data: { deviceId: this.deviceId } });
    const gpRes = await fetch(`${BASE_URL}/_serverFn/${SERVER_FN_IDS.TOKEN}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'accept': 'application/x-tss-framed, application/x-ndjson, application/json',
        'x-tsr-serverfn': 'true',
        'authorization': `Bearer ${this.accessToken}`,
        'cookie': this.sessionCookie,
        'user-agent': this.ua,
        'origin': BASE_URL,
        'referer': `${BASE_URL}/tools/nftoken-link`,
        ...this.wafHeaders
      },
      body: JSON.stringify(tokenPayload),
      agent: proxyAgent || undefined
    });
    const gpJson = await gpRes.json();
    const gpResult = parseSerovalResponse(gpJson);
    this.toolToken = gpResult.token;
    this.tokenExpiresAt = gpResult.expiresAt || (Date.now() + (gpResult.ttlMs || 30000));
    return this.toolToken;
  }

  async ensureInit() {
    if (!this.sessionCookie) {
      await this.initSession();
    }
  }

  async getValidToken() {
    await this.ensureInit();
    if (!this.toolToken || Date.now() >= (this.tokenExpiresAt - 5000)) {
      await this.refreshToken();
    }
    return this.toolToken;
  }

  async callServerFn(fnId, data, refererPath = '/tools/nftoken-link') {
    const payload = serializeSeroval({ data });
    let res;
    try {
      res = await fetch(`${BASE_URL}/_serverFn/${fnId}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'accept': 'application/x-tss-framed, application/x-ndjson, application/json',
          'x-tsr-serverfn': 'true',
          'authorization': `Bearer ${this.accessToken}`,
          'cookie': this.sessionCookie,
          'user-agent': this.ua,
          'origin': BASE_URL,
          'referer': `${BASE_URL}${refererPath}`,
          ...this.wafHeaders
        },
        body: JSON.stringify(payload),
        agent: proxyAgent || undefined,
        timeout: 60000
      });
    } catch (netErr) {
      if (proxyAgent) {
        res = await fetch(`${BASE_URL}/_serverFn/${fnId}`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'accept': 'application/x-tss-framed, application/x-ndjson, application/json',
            'x-tsr-serverfn': 'true',
            'authorization': `Bearer ${this.accessToken}`,
            'cookie': this.sessionCookie,
            'user-agent': this.ua,
            'origin': BASE_URL,
            'referer': `${BASE_URL}${refererPath}`,
            ...this.wafHeaders
          },
          body: JSON.stringify(payload),
          timeout: 60000
        });
      } else {
        throw netErr;
      }
    }
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); }
    catch { throw new Error(`Server returned ${res.status}: ${text.substring(0, 100)}`); }
    return parseSerovalResponse(json);
  }

  getBotSignals(dwellMs = 12500, mouseEvents = 40) {
    const isLinux = this.ua.includes('Linux');
    return {
      webdriver: false, headlessUA: false, noPlugins: false,
      noLanguages: false, noChrome: false, permissionsAnomaly: false,
      webglHash: crypto.randomBytes(4).toString('hex'),
      canvasHash: crypto.randomBytes(4).toString('hex'),
      screen: '1920x1080@1', hardware: '8/8',
      gpu: 'Google Inc. (NVIDIA)|ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)',
      timezone: 'Asia/Jakarta',
      platform: isLinux ? 'Linux x86_64' : 'Win32',
      touchPoints: 0, screenSize: '1920x1080',
      mouseEvents, keyEvents: 15, touchEvents: 0, scrollEvents: 6, dwellMs
    };
  }

  async getUsage() {
    const token = await this.getValidToken();
    return await this.callServerFn(SERVER_FN_IDS.USAGE, {
      deviceId: this.deviceId, token,
      fingerprint: crypto.randomBytes(8).toString('hex'),
      botSignals: this.getBotSignals(5000, 25)
    });
  }

  async getCountries() {
    const token = await this.getValidToken();
    return await this.callServerFn(SERVER_FN_IDS.COUNTRIES, {
      deviceId: this.deviceId, token
    });
  }

  async generateLink(countryCode) {
    const token = await this.getValidToken();
    return await this.callServerFn(SERVER_FN_IDS.GET_LINK, {
      deviceId: this.deviceId,
      countryCode: countryCode.toUpperCase(),
      token,
      fingerprint: crypto.randomBytes(8).toString('hex'),
      botSignals: this.getBotSignals(12500, 45)
    }, `/tools/nftoken-link/${countryCode.toUpperCase()}`);
  }

  async convertCookies(rawCookies) {
    const token = await this.getValidToken();
    return await this.callServerFn(SERVER_FN_IDS.CONVERT, {
      raw: rawCookies,
      deviceId: this.deviceId, token
    }, '/tools/convert');
  }
}

export async function getLiveEliteProxy(apiKey) {
  try {
    const res = await fetch(`https://api.proxyscrape.com/v2/?request=displayproxies&protocol=http&timeout=2500&country=all&ssl=yes&anonymity=elite&auth=${apiKey}`);
    const list = (await res.text()).split(/\r?\n/).map(s => s.trim()).filter(Boolean);

    const testProxy = async (p) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2500);
      try {
        const agent = new HttpsProxyAgent(`http://${p}`);
        const start = Date.now();
        const r1 = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
          method: 'POST',
          headers: { 'apikey': SUPABASE_ANON_KEY, 'content-type': 'application/json' },
          body: JSON.stringify({}),
          agent, signal: controller.signal
        });
        if (r1.status !== 200) return null;
        const r2 = await fetch(`${BASE_URL}/_serverFn/${SERVER_FN_IDS.TOKEN}`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'accept': 'application/json',
            'x-tsr-serverfn': 'true',
            'origin': BASE_URL,
            'user-agent': 'Mozilla/5.0'
          },
          body: '{"t":{"t":10,"i":0,"p":{"k":["data"],"v":[{"t":10,"i":1,"p":{"k":["deviceId"],"v":[{"t":1,"s":"test"}]},"o":0}]},"o":0},"f":63,"m":[]}',
          agent, signal: controller.signal
        });
        if (r2.status === 200 || r2.status === 401) {
          return { proxy: p, ms: Date.now() - start };
        }
      } catch {} finally { clearTimeout(timer); }
      return null;
    };

    const batchSize = 10;
    for (let i = 0; i < Math.min(30, list.length); i += batchSize) {
      const batch = list.slice(i, i + batchSize);
      const results = await Promise.all(batch.map(testProxy));
      const working = results.filter(Boolean);
      if (working.length > 0) {
        working.sort((a, b) => a.ms - b.ms);
        return working[0].proxy;
      }
    }
  } catch {}
  return null;
}
