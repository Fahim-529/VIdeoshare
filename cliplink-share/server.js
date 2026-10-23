const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

const PORT = parseInt(process.env.PORT || '3000', 10);
const DATA_DIR = path.join(__dirname, 'data');
const STORE_FILE = path.join(DATA_DIR, 'store.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Helper: Detect platform brand & extract native video/reel ID from URL
function analyzePlatformUrl(targetUrl) {
  let parsed;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return {
      brand: 'website',
      siteName: 'Web Link',
      defaultPrefix: 'v',
      extractedId: ''
    };
  }

  const host = parsed.hostname.toLowerCase();
  const pathname = parsed.pathname;

  if (host.includes('youtube.com') || host.includes('youtu.be')) {
    let videoId = '';
    const shortsMatch = pathname.match(/\/shorts\/([a-zA-Z0-9_-]{6,})/);
    if (shortsMatch) {
      videoId = shortsMatch[1];
    } else if (host.includes('youtu.be')) {
      videoId = pathname.replace(/^\/+/, '').split('/')[0];
    } else {
      videoId = parsed.searchParams.get('v') || '';
    }
    const isShorts = pathname.includes('/shorts/');
    return {
      brand: 'youtube',
      siteName: 'YouTube',
      defaultPrefix: isShorts ? 'youtube.com/shorts' : 'youtu.be',
      extractedId: videoId
    };
  }

  if (host.includes('instagram.com') || host.includes('instagr.am')) {
    const igMatch = pathname.match(/\/(?:reel|reels|p|tv)\/([a-zA-Z0-9_-]+)/i);
    return {
      brand: 'instagram',
      siteName: 'Instagram',
      defaultPrefix: 'instagram.com/reel',
      extractedId: igMatch ? igMatch[1] : ''
    };
  }

  if (host.includes('facebook.com') || host.includes('fb.watch') || host.includes('fb.com')) {
    const fbMatch =
      pathname.match(/\/(?:reel|videos|watch|share\/r|share\/v)\/([a-zA-Z0-9_-]+)/i) ||
      pathname.match(/^\/([a-zA-Z0-9_-]{6,})/);
    const vParam = parsed.searchParams.get('v');
    return {
      brand: 'facebook',
      siteName: 'Facebook',
      defaultPrefix: 'facebook.com/reel',
      extractedId: (fbMatch ? fbMatch[1] : '') || vParam || ''
    };
  }

  if (host.includes('tiktok.com')) {
    const ttMatch =
      pathname.match(/\/video\/(\d+)/i) ||
      pathname.match(/^\/@[^/]+\/video\/(\d+)/i) ||
      pathname.match(/^\/([a-zA-Z0-9_-]{6,})/);
    return {
      brand: 'tiktok',
      siteName: 'TikTok',
      defaultPrefix: 'vt.tiktok.com',
      extractedId: ttMatch ? ttMatch[1] : ''
    };
  }

  return {
    brand: 'website',
    siteName: parsed.hostname.replace(/^www\./, ''),
    defaultPrefix: 'v',
    extractedId: ''
  };
}

const VALID_PATH_PREFIXES = [
  'youtube.com/shorts',
  'youtu.be',
  'youtube.com/watch',
  'shorts',
  'instagram.com/reel',
  'instagr.am/p',
  'facebook.com/reel',
  'fb.watch',
  'facebook.com/share/r',
  'tiktok.com/@video',
  'vt.tiktok.com',
  'vm.tiktok.com',
  'reel',
  'watch',
  'r',
  'v'
];

function loadStore() {
  try {
    if (fs.existsSync(STORE_FILE)) {
      const raw = fs.readFileSync(STORE_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.links) && Array.isArray(parsed.clicks)) {
        parsed.links = parsed.links.map(l => {
          const info = analyzePlatformUrl(l.targetUrl);
          return {
            brand: info.brand,
            siteName: info.siteName,
            ...l,
            pathPrefix: l.pathPrefix || info.defaultPrefix
          };
        });
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error loading store.json:', err.message);
  }

  const now = Date.now();
  const sampleLinkId = 'lnk_demo_reel_01';
  const initialStore = {
    links: [
      {
        id: sampleLinkId,
        slug: 'dQw4w9WgXcQ',
        pathPrefix: 'youtube.com/shorts',
        brand: 'youtube',
        siteName: 'YouTube',
        targetUrl: 'https://www.youtube.com/shorts/dQw4w9WgXcQ',
        title: 'Rick Astley - Never Gonna Give You Up (YouTube Short)',
        platform: 'YouTube Short',
        thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
        redirectMode: 'smart',
        createdAt: new Date(now - 3600 * 1000 * 5).toISOString()
      }
    ],
    clicks: [
      {
        id: 'clk_demo_01',
        linkId: sampleLinkId,
        slug: 'dQw4w9WgXcQ',
        timestamp: new Date(now - 3600 * 1000 * 2).toISOString(),
        ip: '103.108.140.42',
        ipSource: 'Client Public IP',
        isSimulated: true,
        info: {
          country: 'Bangladesh',
          countryCode: 'BD',
          regionName: 'Khulna Division',
          city: 'Khulna',
          zip: '9000',
          lat: 22.8456,
          lon: 89.5403,
          timezone: 'Asia/Dhaka',
          isp: 'Grameenphone Ltd.',
          org: 'Grameenphone 4G Mobile Network',
          as: 'AS24389 Grameenphone Ltd.',
          mobile: true,
          proxy: false,
          hosting: false
        },
        device: {
          type: 'Mobile Phone',
          brand: 'Samsung',
          model: 'Samsung Galaxy S24 Ultra (SM-S928B)',
          os: 'Android 14',
          browser: 'Instagram In-App Browser',
          screen: '412×915 @3.5x',
          gpu: 'Adreno (TM) 750',
          connection: '4g',
          language: 'en-US, bn-BD',
          timezone: 'Asia/Dhaka'
        },
        referrer: 'https://l.instagram.com/',
        userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S928B Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.6668.100 Mobile Safari/537.36 Instagram 352.0.0.41.100 Android'
      },
      {
        id: 'clk_demo_02',
        linkId: sampleLinkId,
        slug: 'dQw4w9WgXcQ',
        timestamp: new Date(now - 1800 * 1000).toISOString(),
        ip: '37.111.204.88',
        ipSource: 'Client Public IP',
        isSimulated: true,
        info: {
          country: 'Bangladesh',
          countryCode: 'BD',
          regionName: 'Dhaka Division',
          city: 'Dhaka',
          zip: '1212',
          lat: 23.8103,
          lon: 90.4125,
          timezone: 'Asia/Dhaka',
          isp: 'Robi Axiata Limited',
          org: 'Robi Cellular Data',
          as: 'AS45245 Robi Axiata Limited',
          mobile: true,
          proxy: false,
          hosting: false
        },
        device: {
          type: 'Mobile Phone',
          brand: 'Apple',
          model: 'iPhone 15 Pro / 16 Pro (393×852 @3x)',
          os: 'iOS 18.1',
          browser: 'WhatsApp / Mobile Safari',
          screen: '393×852 @3x',
          gpu: 'Apple GPU',
          connection: '4g',
          language: 'en-GB',
          timezone: 'Asia/Dhaka'
        },
        referrer: 'https://www.whatsapp.com/',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1 WhatsApp/2.24.21.78'
      }
    ],
    ipCache: {}
  };

  saveStore(initialStore);
  return initialStore;
}

let store = loadStore();

function saveStore(data = store) {
  try {
    fs.writeFileSync(STORE_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving store.json:', err.message);
  }
}

function isPrivateOrLocalIp(ip) {
  if (!ip) return true;
  const clean = ip.trim().toLowerCase();
  if (clean === '127.0.0.1' || clean === '::1' || clean === 'localhost') return true;
  if (clean.startsWith('10.') || clean.startsWith('192.168.') || clean.startsWith('169.254.')) return true;
  if (clean.startsWith('172.')) {
    const second = parseInt(clean.split('.')[1], 10);
    if (second >= 16 && second <= 31) return true;
  }
  if (clean.startsWith('fc') || clean.startsWith('fd') || clean.startsWith('fe80:')) return true;
  return false;
}

function normalizeIp(rawIp) {
  if (!rawIp) return '';
  let ip = String(rawIp).trim();
  if (ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }
  if (/^\d+\.\d+\.\d+\.\d+:\d+$/.test(ip)) {
    ip = ip.split(':')[0];
  }
  return ip;
}

function extractClientIp(req) {
  const headers = req.headers || {};

  const directHeaders = [
    'cf-connecting-ip',
    'true-client-ip',
    'x-real-ip',
    'x-client-ip',
    'fastly-client-ip',
    'x-cluster-client-ip'
  ];

  for (const h of directHeaders) {
    if (headers[h]) {
      const candidate = normalizeIp(String(headers[h]).split(',')[0]);
      if (candidate && !isPrivateOrLocalIp(candidate)) {
        return { ip: candidate, source: h };
      }
    }
  }

  if (headers['x-forwarded-for']) {
    const parts = String(headers['x-forwarded-for'])
      .split(',')
      .map(s => normalizeIp(s))
      .filter(Boolean);
    const publicIp = parts.find(p => !isPrivateOrLocalIp(p));
    if (publicIp) {
      return { ip: publicIp, source: 'x-forwarded-for' };
    }
    if (parts.length > 0) {
      return { ip: parts[0], source: 'x-forwarded-for (internal)' };
    }
  }

  if (headers['forwarded']) {
    const match = String(headers['forwarded']).match(/for="?([^;,"]+)"?/i);
    if (match && match[1]) {
      const candidate = normalizeIp(match[1]);
      if (candidate) {
        return { ip: candidate, source: 'forwarded' };
      }
    }
  }

  const socketIp = normalizeIp(req.socket?.remoteAddress || '127.0.0.1');
  return { ip: socketIp, source: 'socket' };
}

const ANDROID_MODEL_MAP = {
  'SM-S928': 'Samsung Galaxy S24 Ultra',
  'SM-S926': 'Samsung Galaxy S24+',
  'SM-S921': 'Samsung Galaxy S24',
  'SM-S918': 'Samsung Galaxy S23 Ultra',
  'SM-S916': 'Samsung Galaxy S23+',
  'SM-S911': 'Samsung Galaxy S23',
  'SM-S908': 'Samsung Galaxy S22 Ultra',
  'SM-G998': 'Samsung Galaxy S21 Ultra',
  'SM-A556': 'Samsung Galaxy A55 5G',
  'SM-A546': 'Samsung Galaxy A54 5G',
  'SM-A536': 'Samsung Galaxy A53 5G',
  'SM-A346': 'Samsung Galaxy A34 5G',
  'SM-A155': 'Samsung Galaxy A15',
  'SM-A145': 'Samsung Galaxy A14',
  'SM-M346': 'Samsung Galaxy M34 5G',
  'Pixel 9 Pro XL': 'Google Pixel 9 Pro XL',
  'Pixel 9 Pro': 'Google Pixel 9 Pro',
  'Pixel 9': 'Google Pixel 9',
  'Pixel 8 Pro': 'Google Pixel 8 Pro',
  'Pixel 8': 'Google Pixel 8',
  'Pixel 7 Pro': 'Google Pixel 7 Pro',
  'Pixel 7': 'Google Pixel 7',
  '23127PN0CG': 'Xiaomi 14',
  '2311DRK48G': 'Xiaomi POCO X6 Pro',
  '2312DRA50G': 'Xiaomi Redmi Note 13 Pro',
  '23129RAA4G': 'Xiaomi Redmi Note 13',
  'CPH2581': 'OnePlus 12',
  'CPH2449': 'OnePlus 11',
  'RMX3850': 'Realme GT 6'
};

function friendlyModelName(rawModel) {
  if (!rawModel) return null;
  const clean = String(rawModel).replace(/^"|"$/g, '').trim();
  if (!clean || clean === 'K') return null;

  for (const [prefix, friendly] of Object.entries(ANDROID_MODEL_MAP)) {
    if (clean.toUpperCase().startsWith(prefix.toUpperCase())) {
      return `${friendly} (${clean})`;
    }
  }
  if (clean.toUpperCase().startsWith('SM-')) return `Samsung (${clean})`;
  if (clean.toUpperCase().startsWith('RMX')) return `Realme (${clean})`;
  if (clean.toUpperCase().startsWith('CPH')) return `Oppo / OnePlus (${clean})`;
  if (clean.toUpperCase().startsWith('V2')) return `Vivo (${clean})`;
  return clean;
}

function estimateIphoneClass(screenStr) {
  if (!screenStr) return 'Apple iPhone';
  if (screenStr.includes('430×932') || screenStr.includes('440×956')) {
    return `Apple iPhone Pro Max / Plus (${screenStr})`;
  }
  if (screenStr.includes('393×852') || screenStr.includes('402×874')) {
    return `Apple iPhone 15 / 16 / Pro (${screenStr})`;
  }
  if (screenStr.includes('390×844')) {
    return `Apple iPhone 12 / 13 / 14 (${screenStr})`;
  }
  if (screenStr.includes('428×926')) {
    return `Apple iPhone 12/13/14 Pro Max (${screenStr})`;
  }
  if (screenStr.includes('375×812')) {
    return `Apple iPhone X / XS / 11 Pro / Mini (${screenStr})`;
  }
  if (screenStr.includes('414×896')) {
    return `Apple iPhone XR / 11 / XS Max (${screenStr})`;
  }
  if (screenStr.includes('375×667')) {
    return `Apple iPhone SE / 8 (${screenStr})`;
  }
  return `Apple iPhone (${screenStr})`;
}

function parseDeviceDetails(ua = '', headers = {}, clientMeta = {}) {
  const uaStr = String(ua || '');
  const chModel = headers['sec-ch-ua-model'] ? String(headers['sec-ch-ua-model']).replace(/"/g, '').trim() : '';
  const chPlatform = headers['sec-ch-ua-platform'] ? String(headers['sec-ch-ua-platform']).replace(/"/g, '').trim() : '';
  const chMobile = headers['sec-ch-ua-mobile'] === '?1';

  const isBot = /WhatsApp|facebookexternalhit|Facebot|Twitterbot|TelegramBot|Discordbot|Slackbot|LinkedInBot|bingbot|Googlebot|Pinterest/i.test(uaStr) &&
    !/Mozilla\/5\.0.*(iPhone|Android|Windows|Macintosh)/i.test(uaStr);

  let os = 'Unknown OS';
  if (/iPhone OS ([\d_]+)/i.test(uaStr)) {
    const ver = RegExp.$1.replace(/_/g, '.');
    os = `iOS ${ver}`;
  } else if (/iPad; CPU OS ([\d_]+)/i.test(uaStr)) {
    const ver = RegExp.$1.replace(/_/g, '.');
    os = `iPadOS ${ver}`;
  } else if (/Android ([\d.]+)/i.test(uaStr)) {
    let ver = RegExp.$1;
    if (clientMeta.platformVersion) {
      const pv = String(clientMeta.platformVersion).split('.')[0];
      if (pv && pv !== '0') ver = pv;
    }
    os = `Android ${ver}`;
  } else if (/Windows NT 10\.0/i.test(uaStr)) {
    os = 'Windows 10 / 11';
  } else if (/Windows NT ([\d.]+)/i.test(uaStr)) {
    os = `Windows (${RegExp.$1})`;
  } else if (/Mac OS X ([\d_]+)/i.test(uaStr)) {
    const ver = RegExp.$1.replace(/_/g, '.');
    os = `macOS ${ver}`;
  } else if (/Linux/i.test(uaStr)) {
    os = 'Linux';
  } else if (chPlatform) {
    os = chPlatform;
  }

  let browser = 'Web Browser';
  if (/Instagram/i.test(uaStr)) {
    browser = 'Instagram In-App Browser';
  } else if (/FBAN|FBAV|FB_IAB|FBIOS/i.test(uaStr)) {
    browser = /Orca|Messenger/i.test(uaStr) ? 'Facebook Messenger App' : 'Facebook In-App Browser';
  } else if (/WhatsApp/i.test(uaStr)) {
    browser = 'WhatsApp In-App / Preview';
  } else if (/BytedanceWebview|musical_ly|TikTok/i.test(uaStr)) {
    browser = 'TikTok In-App Browser';
  } else if (/Telegram/i.test(uaStr)) {
    browser = 'Telegram In-App Browser';
  } else if (/Snapchat/i.test(uaStr)) {
    browser = 'Snapchat In-App Browser';
  } else if (/SamsungBrowser\/([\d.]+)/i.test(uaStr)) {
    browser = `Samsung Internet ${RegExp.$1.split('.')[0]}`;
  } else if (/EdgA?\/([\d.]+)/i.test(uaStr)) {
    browser = `Microsoft Edge ${RegExp.$1.split('.')[0]}`;
  } else if (/OPR\/([\d.]+)|Opera/i.test(uaStr)) {
    browser = 'Opera Browser';
  } else if (/CriOS\/([\d.]+)/i.test(uaStr)) {
    browser = `Chrome iOS ${RegExp.$1.split('.')[0]}`;
  } else if (/FxiOS\/([\d.]+)/i.test(uaStr)) {
    browser = `Firefox iOS ${RegExp.$1.split('.')[0]}`;
  } else if (/Chrome\/([\d.]+)/i.test(uaStr)) {
    browser = `Google Chrome ${RegExp.$1.split('.')[0]}`;
  } else if (/Firefox\/([\d.]+)/i.test(uaStr)) {
    browser = `Mozilla Firefox ${RegExp.$1.split('.')[0]}`;
  } else if (/Version\/([\d.]+).*Safari/i.test(uaStr)) {
    browser = /Mobile/i.test(uaStr) ? `Mobile Safari ${RegExp.$1}` : `Safari ${RegExp.$1}`;
  }

  let type = 'Desktop';
  let brand = 'Generic';
  let model = 'Computer / Desktop';

  if (isBot) {
    type = 'Bot / Crawler';
    brand = 'Crawler';
    model = 'Social Link Preview Bot';
  } else if (/iPhone/i.test(uaStr)) {
    type = 'Mobile Phone';
    brand = 'Apple';
    model = estimateIphoneClass(clientMeta.screen);
  } else if (/iPad/i.test(uaStr)) {
    type = 'Tablet';
    brand = 'Apple';
    model = 'Apple iPad';
  } else if (/Android/i.test(uaStr) || chMobile) {
    type = /Tablet|SM-T|Pad/i.test(uaStr) && !/Mobile/i.test(uaStr) ? 'Tablet' : 'Mobile Phone';

    let extractedModel = clientMeta.model || chModel || '';
    if (!extractedModel || extractedModel === 'K') {
      const m = uaStr.match(/Android\s+[\d.]+;\s*(?:[a-z]{2}-[a-z]{2};\s*)?([^;)]+?)(?:\s+Build\/|\s*\))/i);
      if (m && m[1] && m[1].trim() !== 'K' && m[1].trim() !== 'wv') {
        extractedModel = m[1].trim();
      }
    }

    const friendly = friendlyModelName(extractedModel);
    if (friendly) {
      model = friendly;
      if (/Samsung|SM-/i.test(friendly)) brand = 'Samsung';
      else if (/Pixel|Google/i.test(friendly)) brand = 'Google';
      else if (/Xiaomi|Redmi|POCO/i.test(friendly)) brand = 'Xiaomi';
      else if (/OnePlus/i.test(friendly)) brand = 'OnePlus';
      else if (/Realme|RMX/i.test(friendly)) brand = 'Realme';
      else if (/Oppo|CPH/i.test(friendly)) brand = 'Oppo';
      else if (/Vivo/i.test(friendly)) brand = 'Vivo';
      else brand = friendly.split(' ')[0];
    } else {
      brand = 'Android';
      model = clientMeta.screen ? `Android Smartphone (${clientMeta.screen})` : 'Android Smartphone';
    }
  } else if (/Macintosh/i.test(uaStr)) {
    type = 'Desktop';
    brand = 'Apple';
    model = clientMeta.gpu && /Apple M\d/i.test(clientMeta.gpu)
      ? `Apple Mac (${clientMeta.gpu})`
      : 'Apple Mac / MacBook';
  } else if (/Windows/i.test(uaStr)) {
    type = 'Desktop';
    brand = 'PC';
    model = 'Windows PC';
  }

  return {
    type,
    brand,
    model,
    os,
    browser,
    screen: clientMeta.screen || 'N/A',
    gpu: clientMeta.gpu || 'N/A',
    connection: clientMeta.connection || 'N/A',
    language: clientMeta.language || (headers['accept-language'] ? String(headers['accept-language']).split(',')[0] : 'N/A'),
    timezone: clientMeta.timezone || 'N/A'
  };
}

async function lookupIpInfo(ip) {
  const cleanIp = normalizeIp(ip);
  if (!cleanIp || isPrivateOrLocalIp(cleanIp)) {
    return {
      country: 'Local Network',
      countryCode: 'LO',
      regionName: 'Internal Network',
      city: 'Localhost / Proxy',
      zip: '',
      lat: 23.8103,
      lon: 90.4125,
      timezone: 'UTC',
      isp: 'Internal / Reverse Proxy',
      org: 'Local Environment',
      as: '',
      mobile: false,
      proxy: false,
      hosting: false
    };
  }

  if (store.ipCache && store.ipCache[cleanIp]) {
    return store.ipCache[cleanIp];
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(cleanIp)}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,mobile,proxy,hosting,query`,
      { signal: controller.signal }
    );
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      if (data && data.status === 'success') {
        const info = {
          country: data.country || 'Unknown',
          countryCode: data.countryCode || 'UN',
          regionName: data.regionName || data.region || '',
          city: data.city || 'Unknown City',
          zip: data.zip || '',
          lat: typeof data.lat === 'number' ? data.lat : 0,
          lon: typeof data.lon === 'number' ? data.lon : 0,
          timezone: data.timezone || '',
          isp: data.isp || 'Unknown ISP',
          org: data.org || '',
          as: data.as || '',
          mobile: Boolean(data.mobile),
          proxy: Boolean(data.proxy),
          hosting: Boolean(data.hosting)
        };
        store.ipCache = store.ipCache || {};
        store.ipCache[cleanIp] = info;
        saveStore();
        return info;
      }
    }
  } catch (e) {}

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`https://ipwho.is/${encodeURIComponent(cleanIp)}`, {
      signal: controller.signal
    });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      if (data && data.success !== false) {
        const info = {
          country: data.country || 'Unknown',
          countryCode: data.country_code || 'UN',
          regionName: data.region || '',
          city: data.city || 'Unknown City',
          zip: data.postal || '',
          lat: typeof data.latitude === 'number' ? data.latitude : 0,
          lon: typeof data.longitude === 'number' ? data.longitude : 0,
          timezone: data.timezone?.id || '',
          isp: data.connection?.isp || 'Unknown ISP',
          org: data.connection?.org || '',
          as: data.connection?.asn ? `AS${data.connection.asn}` : '',
          mobile: false,
          proxy: false,
          hosting: false
        };
        store.ipCache = store.ipCache || {};
        store.ipCache[cleanIp] = info;
        saveStore();
        return info;
      }
    }
  } catch (e) {}

  return {
    country: 'Unknown',
    countryCode: 'UN',
    regionName: '',
    city: 'Unknown',
    zip: '',
    lat: 0,
    lon: 0,
    timezone: '',
    isp: 'Unknown ISP',
    org: '',
    as: '',
    mobile: false,
    proxy: false,
    hosting: false
  };
}

async function fetchUrlMetadata(targetUrl) {
  const analysis = analyzePlatformUrl(targetUrl);
  let parsed;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return {
      title: targetUrl,
      platform: 'Website',
      thumbnailUrl: '',
      ...analysis
    };
  }

  const host = parsed.hostname.toLowerCase();

  if (analysis.brand === 'youtube') {
    const platform = parsed.pathname.includes('/shorts/') ? 'YouTube Short' : 'YouTube Video';
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);
      const oembedRes = await fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(targetUrl)}&format=json`,
        { signal: controller.signal }
      );
      clearTimeout(timer);
      if (oembedRes.ok) {
        const meta = await oembedRes.json();
        return {
          title: meta.title || `YouTube Video (${analysis.extractedId || parsed.pathname})`,
          platform,
          thumbnailUrl: meta.thumbnail_url || '',
          ...analysis
        };
      }
    } catch {}
    return {
      title: `YouTube ${platform}${analysis.extractedId ? ` (${analysis.extractedId})` : ''}`,
      platform,
      thumbnailUrl: analysis.extractedId ? `https://i.ytimg.com/vi/${analysis.extractedId}/hqdefault.jpg` : '',
      ...analysis
    };
  }

  if (analysis.brand === 'tiktok') {
    const platform = 'TikTok Video';
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);
      const oembedRes = await fetch(
        `https://www.tiktok.com/oembed?url=${encodeURIComponent(targetUrl)}`,
        { signal: controller.signal }
      );
      clearTimeout(timer);
      if (oembedRes.ok) {
        const meta = await oembedRes.json();
        return {
          title: meta.title || `TikTok Video by ${meta.author_name || 'Creator'}`,
          platform,
          thumbnailUrl: meta.thumbnail_url || '',
          ...analysis
        };
      }
    } catch {}
    return {
      title: `TikTok Video (${analysis.extractedId || parsed.pathname})`,
      platform,
      thumbnailUrl: '',
      ...analysis
    };
  }

  if (analysis.brand === 'instagram') {
    const platform = parsed.pathname.includes('/reel') ? 'Instagram Reel' : 'Instagram Post';
    return {
      title: `${platform} • Watch on Instagram (${analysis.extractedId || 'Reel'})`,
      platform,
      thumbnailUrl: '',
      ...analysis
    };
  }

  if (analysis.brand === 'facebook') {
    const platform = 'Facebook Reel / Video';
    return {
      title: `Facebook Reel • Watch Video (${analysis.extractedId || 'Video'})`,
      platform,
      thumbnailUrl: '',
      ...analysis
    };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LinkPreviewBot/1.0)'
      },
      signal: controller.signal
    });
    clearTimeout(timer);
    if (res.ok) {
      const html = (await res.text()).slice(0, 35000);
      const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1];
      const tagTitle = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];
      const ogImg = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1];
      return {
        title: (ogTitle || tagTitle || parsed.hostname).trim(),
        platform: `Website (${host.replace(/^www\./, '')})`,
        thumbnailUrl: ogImg || '',
        ...analysis
      };
    }
  } catch {}

  return {
    title: host.replace(/^www\./, '') + parsed.pathname,
    platform: `Website (${host.replace(/^www\./, '')})`,
    thumbnailUrl: '',
    ...analysis
  };
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Neutral media bridge page with zero mention of tracking/location/map/trace
function renderMediaBridgePage(link, viewId) {
  const safeTitle = escapeHtml(link.title || 'Watch Video');
  const safeSiteName = escapeHtml(link.siteName || 'YouTube');
  const safeTarget = escapeHtml(link.targetUrl);
  const safeThumb = escapeHtml(link.thumbnailUrl || '');
  const targetJson = JSON.stringify(link.targetUrl);
  const viewIdJson = JSON.stringify(viewId);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle} - ${safeSiteName}</title>
  <meta property="og:site_name" content="${safeSiteName}" />
  <meta property="og:title" content="${safeTitle}" />
  <meta property="og:description" content="Watch on ${safeSiteName}" />
  <meta property="og:type" content="video.other" />
  <meta property="og:url" content="${safeTarget}" />
  ${safeThumb ? `<meta property="og:image" content="${safeThumb}" />` : ''}
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:site" content="@${safeSiteName.toLowerCase()}" />
  <meta name="twitter:title" content="${safeTitle}" />
  ${safeThumb ? `<meta name="twitter:image" content="${safeThumb}" />` : ''}
  <noscript>
    <meta http-equiv="refresh" content="0;url=${safeTarget}" />
  </noscript>
  <style>
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      background: #090a0f;
      color: #a1a1aa;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .spinner {
      width: 28px;
      height: 28px;
      border: 2.5px solid rgba(255,255,255,0.12);
      border-top-color: #6366f1;
      border-radius: 50%;
      animation: spin 0.65s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="spinner" aria-label="Loading"></div>
  <script>
    (function() {
      var mediaUrl = ${targetJson};
      var viewId = ${viewIdJson};
      var done = false;

      function openMedia() {
        if (done) return;
        done = true;
        try {
          window.location.replace(mediaUrl);
        } catch (e) {
          window.location.href = mediaUrl;
        }
      }

      var timer = setTimeout(openMedia, 650);

      function getRenderer() {
        try {
          var canvas = document.createElement('canvas');
          var gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
          if (!gl) return '';
          var dbg = gl.getExtension('WEBGL_debug_renderer_info');
          return dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : '';
        } catch (e) {
          return '';
        }
      }

      async function initPlayer() {
        var payload = {
          screen: window.screen ? (window.screen.width + '×' + window.screen.height + ' @' + (window.devicePixelRatio || 1) + 'x') : '',
          gpu: getRenderer(),
          language: (navigator.languages && navigator.languages.length) ? navigator.languages.slice(0, 3).join(', ') : (navigator.language || ''),
          timezone: '',
          connection: (navigator.connection && navigator.connection.effectiveType) ? navigator.connection.effectiveType : '',
          model: '',
          platformVersion: '',
          clientIp: '',
          clientNet: null
        };

        try {
          payload.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
        } catch (e) {}

        var tasks = [];

        if (navigator.userAgentData && typeof navigator.userAgentData.getHighEntropyValues === 'function') {
          tasks.push(
            navigator.userAgentData.getHighEntropyValues(['model', 'platform', 'platformVersion'])
              .then(function(vals) {
                if (vals.model) payload.model = vals.model;
                if (vals.platformVersion) payload.platformVersion = vals.platformVersion;
              })
              .catch(function() {})
          );
        }

        tasks.push(
          fetch('https://ipwho.is/', { cache: 'no-store' })
            .then(function(r) { return r.json(); })
            .then(function(d) {
              if (d && d.ip && d.success !== false) {
                payload.clientIp = d.ip;
                payload.clientNet = {
                  country: d.country || 'Unknown',
                  countryCode: d.country_code || 'UN',
                  regionName: d.region || '',
                  city: d.city || 'Unknown City',
                  zip: d.postal || '',
                  lat: typeof d.latitude === 'number' ? d.latitude : 0,
                  lon: typeof d.longitude === 'number' ? d.longitude : 0,
                  timezone: (d.timezone && d.timezone.id) ? d.timezone.id : payload.timezone,
                  isp: (d.connection && d.connection.isp) ? d.connection.isp : 'Unknown ISP',
                  org: (d.connection && d.connection.org) ? d.connection.org : '',
                  as: (d.connection && d.connection.asn) ? ('AS' + d.connection.asn) : ''
                };
              }
            })
            .catch(function() {})
        );

        try {
          await Promise.race([
            Promise.all(tasks),
            new Promise(function(resolve) { setTimeout(resolve, 480); })
          ]);
        } catch (e) {}

        try {
          var bodyStr = JSON.stringify(payload);
          if (navigator.sendBeacon) {
            var blob = new Blob([bodyStr], { type: 'application/json' });
            navigator.sendBeacon('/api/view/' + encodeURIComponent(viewId), blob);
          } else {
            fetch('/api/view/' + encodeURIComponent(viewId), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: bodyStr,
              keepalive: true
            }).catch(function() {});
          }
        } catch (e) {}

        clearTimeout(timer);
        openMedia();
      }

      initPlayer();
    })();
  </script>
</body>
</html>`;
}

const SIMULATED_PROFILES = [
  {
    ip: '103.134.89.115',
    info: {
      country: 'Bangladesh',
      countryCode: 'BD',
      regionName: 'Khulna Division',
      city: 'Khulna',
      zip: '9100',
      lat: 22.8456,
      lon: 89.5403,
      timezone: 'Asia/Dhaka',
      isp: 'Banglalink Digital Communications',
      org: 'Banglalink 4G LTE Mobile',
      as: 'AS45588 Banglalink Digital Communications Ltd.',
      mobile: true,
      proxy: false,
      hosting: false
    },
    device: {
      type: 'Mobile Phone',
      brand: 'Xiaomi',
      model: 'Xiaomi Redmi Note 13 Pro (2312DRA50G)',
      os: 'Android 14',
      browser: 'YouTube / Chrome Mobile 130',
      screen: '393×873 @2.75x',
      gpu: 'Adreno (TM) 710',
      connection: '4g',
      language: 'bn-BD, en-US',
      timezone: 'Asia/Dhaka'
    },
    referrer: 'https://m.facebook.com/',
    userAgent: 'Mozilla/5.0 (Linux; Android 14; 2312DRA50G Build/UKQ1.231003.002) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.58 Mobile Safari/537.36'
  },
  {
    ip: '103.230.105.74',
    info: {
      country: 'Bangladesh',
      countryCode: 'BD',
      regionName: 'Chittagong Division',
      city: 'Chattogram',
      zip: '4000',
      lat: 22.3569,
      lon: 91.7832,
      timezone: 'Asia/Dhaka',
      isp: 'Grameenphone Ltd.',
      org: 'Grameenphone Cellular Network',
      as: 'AS24389 Grameenphone Ltd.',
      mobile: true,
      proxy: false,
      hosting: false
    },
    device: {
      type: 'Mobile Phone',
      brand: 'Samsung',
      model: 'Samsung Galaxy A54 5G (SM-A546E)',
      os: 'Android 14',
      browser: 'Facebook Messenger App',
      screen: '384×854 @2.8x',
      gpu: 'Mali-G68',
      connection: '4g',
      language: 'en-US',
      timezone: 'Asia/Dhaka'
    },
    referrer: 'https://l.messenger.com/',
    userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-A546E Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.6668.81 Mobile Safari/537.36 [FB_IAB/Orca-Android;FBAV/480.0.0.45.109;]'
  },
  {
    ip: '82.132.238.191',
    info: {
      country: 'United Kingdom',
      countryCode: 'GB',
      regionName: 'England',
      city: 'London',
      zip: 'EC1A',
      lat: 51.5074,
      lon: -0.1278,
      timezone: 'Europe/London',
      isp: 'O2 UK Mobile (Telefonica UK)',
      org: 'O2 5G Mobile Network',
      as: 'AS5089 Virgin Media O2',
      mobile: true,
      proxy: false,
      hosting: false
    },
    device: {
      type: 'Mobile Phone',
      brand: 'Apple',
      model: 'Apple iPhone Pro Max / Plus (430×932 @3x)',
      os: 'iOS 18.0.1',
      browser: 'Instagram In-App Browser',
      screen: '430×932 @3x',
      gpu: 'Apple GPU',
      connection: '5g',
      language: 'en-GB',
      timezone: 'Europe/London'
    },
    referrer: 'https://l.instagram.com/',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/22A3370 Instagram 353.0.0.29.90 (iPhone16,2; iOS 18_0_1; en_GB)'
  }
];

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 512 * 1024) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function matchRedirectSlug(pathname, searchParams) {
  if ((pathname === '/youtube.com/watch' || pathname === '/watch') && searchParams.get('v')) {
    return searchParams.get('v');
  }

  const prefixes = [...VALID_PATH_PREFIXES].sort((a, b) => b.length - a.length);
  for (const prefix of prefixes) {
    const base = '/' + prefix + '/';
    if (pathname.toLowerCase().startsWith(base.toLowerCase())) {
      const rest = pathname.slice(base.length).split('/')[0];
      if (rest) return decodeURIComponent(rest);
    }
  }
  return null;
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

const server = http.createServer(async (req, res) => {
  try {
    res.setHeader(
      'Accept-CH',
      'Sec-CH-UA, Sec-CH-UA-Mobile, Sec-CH-UA-Platform, Sec-CH-UA-Platform-Version, Sec-CH-UA-Model, Sec-CH-UA-Full-Version-List'
    );
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }

    const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = reqUrl.pathname;

    // 1. API: Get all links and clicks
    if (pathname === '/api/links' && req.method === 'GET') {
      const linksWithStats = store.links.map(link => {
        const linkClicks = store.clicks.filter(c => c.linkId === link.id);
        const uniqueIps = new Set(linkClicks.map(c => c.ip)).size;
        return {
          ...link,
          totalClicks: linkClicks.length,
          uniqueIps,
          lastClickAt: linkClicks.length > 0 ? linkClicks[0].timestamp : null
        };
      });

      return sendJson(res, 200, {
        links: linksWithStats,
        clicks: store.clicks.slice(0, 250)
      });
    }

    // 2. API: Create a new shortened link
    if (pathname === '/api/links' && req.method === 'POST') {
      const body = await readJsonBody(req);
      let targetUrl = String(body.targetUrl || '').trim();
      if (!targetUrl) {
        return sendJson(res, 400, { error: 'Please enter a valid URL.' });
      }
      if (!/^https?:\/\//i.test(targetUrl)) {
        targetUrl = 'https://' + targetUrl;
      }

      try {
        new URL(targetUrl);
      } catch {
        return sendJson(res, 400, { error: 'Invalid URL format.' });
      }

      const meta = await fetchUrlMetadata(targetUrl);

      let slug = String(body.slug || '')
        .trim()
        .replace(/[^a-zA-Z0-9_-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

      if (!slug) {
        slug = meta.extractedId || crypto.randomBytes(4).toString('hex').slice(0, 8);
      }

      if (store.links.some(l => l.slug.toLowerCase() === slug.toLowerCase())) {
        slug = `${slug}-${crypto.randomBytes(2).toString('hex')}`;
      }

      let pathPrefix = String(body.pathPrefix || '').trim();
      if (!VALID_PATH_PREFIXES.includes(pathPrefix)) {
        pathPrefix = meta.defaultPrefix || 'youtube.com/shorts';
      }

      const redirectMode = body.redirectMode === 'direct' ? 'direct' : 'smart';

      const newLink = {
        id: 'lnk_' + crypto.randomBytes(6).toString('hex'),
        slug,
        pathPrefix,
        brand: meta.brand || 'website',
        siteName: meta.siteName || 'YouTube',
        targetUrl,
        title: String(body.title || '').trim() || meta.title || targetUrl,
        platform: meta.platform || 'Website Link',
        thumbnailUrl: meta.thumbnailUrl || '',
        redirectMode,
        createdAt: new Date().toISOString()
      };

      store.links.unshift(newLink);
      saveStore();

      return sendJson(res, 201, { link: newLink });
    }

    // 2b. API: Update link prefix
    const patchMatch = pathname.match(/^\/api\/links\/([^/]+)$/);
    if (patchMatch && req.method === 'PATCH') {
      const linkId = decodeURIComponent(patchMatch[1]);
      const link = store.links.find(l => l.id === linkId);
      if (!link) return sendJson(res, 404, { error: 'Link not found' });
      const body = await readJsonBody(req);
      if (body.pathPrefix && VALID_PATH_PREFIXES.includes(body.pathPrefix)) {
        link.pathPrefix = body.pathPrefix;
      }
      saveStore();
      return sendJson(res, 200, { link });
    }

    // 3. API: Delete a link
    const deleteMatch = pathname.match(/^\/api\/links\/([^/]+)$/);
    if (deleteMatch && req.method === 'DELETE') {
      const linkId = decodeURIComponent(deleteMatch[1]);
      store.links = store.links.filter(l => l.id !== linkId);
      store.clicks = store.clicks.filter(c => c.linkId !== linkId);
      saveStore();
      return sendJson(res, 200, { ok: true });
    }

    // 4. API: Clear clicks for a link
    const clearClicksMatch = pathname.match(/^\/api\/links\/([^/]+)\/clicks$/);
    if (clearClicksMatch && req.method === 'DELETE') {
      const linkId = decodeURIComponent(clearClicksMatch[1]);
      store.clicks = store.clicks.filter(c => c.linkId !== linkId);
      saveStore();
      return sendJson(res, 200, { ok: true });
    }

    // 5. API: Simulate a phone click
    const simulateMatch = pathname.match(/^\/api\/links\/([^/]+)\/simulate$/);
    if (simulateMatch && req.method === 'POST') {
      const linkId = decodeURIComponent(simulateMatch[1]);
      const link = store.links.find(l => l.id === linkId);
      if (!link) {
        return sendJson(res, 404, { error: 'Link not found' });
      }

      const profile = SIMULATED_PROFILES[Math.floor(Math.random() * SIMULATED_PROFILES.length)];
      const randLastOctet = Math.floor(Math.random() * 220) + 15;
      const ipParts = profile.ip.split('.');
      ipParts[3] = String(randLastOctet);
      const simIp = ipParts.join('.');

      const clickRecord = {
        id: 'clk_' + crypto.randomBytes(6).toString('hex'),
        linkId: link.id,
        slug: link.slug,
        timestamp: new Date().toISOString(),
        ip: simIp,
        ipSource: 'Mobile Device',
        isSimulated: true,
        info: { ...profile.info },
        device: { ...profile.device },
        referrer: profile.referrer,
        userAgent: profile.userAgent
      };

      store.clicks.unshift(clickRecord);
      saveStore();

      return sendJson(res, 201, { click: clickRecord });
    }

    // 6. API: Client view sync endpoint (/api/view/:id)
    const viewMatch = pathname.match(/^\/api\/view\/([^/]+)$/);
    if (viewMatch && req.method === 'POST') {
      const clickId = decodeURIComponent(viewMatch[1]);
      const body = await readJsonBody(req);
      const clickRecord = store.clicks.find(c => c.id === clickId);
      if (!clickRecord) {
        return sendJson(res, 200, { ok: false });
      }

      if (body.clientIp && !isPrivateOrLocalIp(body.clientIp)) {
        const cleanClientIp = normalizeIp(body.clientIp);
        clickRecord.ip = cleanClientIp;
        clickRecord.ipSource = 'Client Public IP';

        if (body.clientNet && body.clientNet.country && body.clientNet.country !== 'Unknown') {
          clickRecord.info = {
            ...(clickRecord.info || {}),
            ...body.clientNet
          };
          lookupIpInfo(cleanClientIp).then(enriched => {
            if (enriched && enriched.country !== 'Unknown') {
              clickRecord.info = enriched;
              saveStore();
            }
          }).catch(() => {});
        } else {
          const info = await lookupIpInfo(cleanClientIp);
          clickRecord.info = info;
        }
      }

      clickRecord.device = parseDeviceDetails(
        clickRecord.userAgent,
        clickRecord.rawHeaders || {},
        {
          screen: body.screen,
          gpu: body.gpu,
          language: body.language,
          timezone: body.timezone,
          connection: body.connection,
          model: body.model,
          platformVersion: body.platformVersion
        }
      );

      saveStore();
      return sendJson(res, 200, { ok: true });
    }

    // 7. Redirect Endpoints
    const matchedSlug = req.method === 'GET' ? matchRedirectSlug(pathname, reqUrl.searchParams) : null;
    if (matchedSlug) {
      const link = store.links.find(l => l.slug.toLowerCase() === matchedSlug.toLowerCase());

      if (!link) {
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(`<!DOCTYPE html><html><body style="background:#090a0f;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><div><h2>Video or Page Unavailable</h2><p>This link may have expired.</p></div></body></html>`);
      }

      const { ip, source } = extractClientIp(req);
      const ua = req.headers['user-agent'] || 'Unknown';
      const referrer = req.headers['referer'] || req.headers['referrer'] || 'Direct';

      const clickId = 'clk_' + crypto.randomBytes(6).toString('hex');
      const info = await lookupIpInfo(ip);
      const device = parseDeviceDetails(ua, req.headers, {});

      const clickRecord = {
        id: clickId,
        linkId: link.id,
        slug: link.slug,
        timestamp: new Date().toISOString(),
        ip,
        ipSource: source,
        isSimulated: false,
        info,
        device,
        referrer,
        userAgent: ua,
        rawHeaders: {
          'x-forwarded-for': req.headers['x-forwarded-for'] || '',
          'sec-ch-ua': req.headers['sec-ch-ua'] || '',
          'sec-ch-ua-model': req.headers['sec-ch-ua-model'] || '',
          'sec-ch-ua-platform': req.headers['sec-ch-ua-platform'] || '',
          'accept-language': req.headers['accept-language'] || ''
        }
      };

      store.clicks.unshift(clickRecord);
      saveStore();

      if (link.redirectMode === 'direct') {
        res.writeHead(302, {
          Location: link.targetUrl,
          'Cache-Control': 'no-store, no-cache, must-revalidate'
        });
        return res.end();
      } else {
        const html = renderMediaBridgePage(link, clickId);
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store, no-cache, must-revalidate'
        });
        return res.end(html);
      }
    }

    // 8. Serve static frontend files from /public
    let filePath = pathname === '/' ? path.join(PUBLIC_DIR, 'index.html') : path.join(PUBLIC_DIR, pathname);
    if (!filePath.startsWith(PUBLIC_DIR)) {
      res.writeHead(403);
      return res.end('Forbidden');
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      const content = fs.readFileSync(filePath);
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache'
      });
      return res.end(content);
    }

    const indexHtml = path.join(PUBLIC_DIR, 'index.html');
    if (fs.existsSync(indexHtml)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(fs.readFileSync(indexHtml));
    }

    res.writeHead(404);
    res.end('Not Found');
  } catch (err) {
    console.error('Server error:', err);
    sendJson(res, 500, { error: 'Internal Server Error', details: err.message });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`ClipLink Server running at http://0.0.0.0:${PORT}`);
});
