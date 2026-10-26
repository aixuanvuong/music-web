// Music Web MVP - backend theo tài liệu kiến trúc (GĐ1 rút gọn để test)
// Engine trích xuất: yt-dlp (phương án B trong tài liệu) - cùng nguyên lý Innertube như
// kotlinYtmusicScraper của SimpMusic, triển khai nhanh để kiểm chứng. API/proxy giữ nguyên thiết kế.
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = process.env.PORT || 8787;
const YTDLP = process.env.YTDLP_BIN || 'yt-dlp';
const PUBLIC_DIR = path.join(__dirname, 'public');

const streamCache = new Map(); // videoId -> {url, exp}
const searchCache = new Map(); // key -> {at, data}
const SEARCH_TTL = 10 * 60 * 1000;

function runYtdlp(args, timeoutMs = 45000) {
  return new Promise((resolve, reject) => {
    const p = spawn(YTDLP, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    const timer = setTimeout(() => { p.kill('SIGKILL'); reject(new Error('yt-dlp timeout')); }, timeoutMs);
    p.stdout.on('data', d => { out += d; });
    p.stderr.on('data', d => { err += d; });
    p.on('error', e => { clearTimeout(timer); reject(e); });
    p.on('close', code => {
      clearTimeout(timer);
      if (code === 0) resolve(out);
      else reject(new Error('yt-dlp exit ' + code + ': ' + err.slice(-300)));
    });
  });
}

function mapEntry(e) {
  if (!e || !e.id) return null;
  return {
    id: e.id,
    title: e.title || '',
    artist: e.uploader || e.channel || '',
    duration: e.duration || null,
    thumb: `https://i.ytimg.com/vi/${e.id}/hqdefault.jpg`,
  };
}

async function searchTracks(q, limit = 20) {
  const key = q + '|' + limit;
  const hit = searchCache.get(key);
  if (hit && Date.now() - hit.at < SEARCH_TTL) return hit.data;
  const out = await runYtdlp(['--no-warnings', '-j', '--flat-playlist', `ytsearch${limit}:${q}`]);
  const tracks = out.trim().split('\n').filter(Boolean).map(l => { try { return mapEntry(JSON.parse(l)); } catch { return null; } })
    .filter(t => t && t.duration && t.duration >= 45 && t.duration <= 900);
  searchCache.set(key, { at: Date.now(), data: tracks });
  return tracks;
}

async function resolveStream(videoId) {
  const hit = streamCache.get(videoId);
  if (hit && hit.exp > Date.now() + 60000) return hit.url;
  const fmt = 'bestaudio[ext=m4a]/bestaudio[acodec^=mp4a]/bestaudio';
  const args = ['--no-warnings', '-g', '-f', fmt, '--no-playlist', `https://www.youtube.com/watch?v=${videoId}`];
  let out;
  try { out = await runYtdlp(args, 90000); }
  catch (e) { out = await runYtdlp(args, 90000); }
  const url = out.trim().split('\n')[0];
  if (!url || !url.startsWith('http')) throw new Error('Không lấy được URL stream');
  let exp = Date.now() + 4 * 3600 * 1000;
  const m = url.match(/[?&]expire=(\d+)/);
  if (m) exp = parseInt(m[1], 10) * 1000;
  streamCache.set(videoId, { url, exp });
  return url;
}

function fetchUpstream(url, headers, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, async r => {
      if ([301, 302, 303, 307, 308].includes(r.statusCode) && r.headers.location && redirectsLeft > 0) {
        r.resume();
        try { resolve(await fetchUpstream(r.headers.location, headers, redirectsLeft - 1)); }
        catch (e) { reject(e); }
      } else resolve(r);
    });
    req.on('error', reject);
  });
}

async function proxyStream(videoId, req, res) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const url = await resolveStream(videoId);
    const headers = { 'User-Agent': 'Mozilla/5.0' };
    if (req.headers.range) headers.Range = req.headers.range;
    const up = await fetchUpstream(url, headers);
    if ((up.statusCode === 403 || up.statusCode === 410) && attempt === 0) {
      streamCache.delete(videoId); up.resume(); continue;
    }
    const outHeaders = { 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' };
    for (const h of ['content-type', 'content-length', 'content-range']) {
      if (up.headers[h]) outHeaders[h] = up.headers[h];
    }
    res.writeHead(up.statusCode, outHeaders);
    up.pipe(res);
    return;
  }
  res.writeHead(502); res.end('Stream unavailable');
}

function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };

const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, 'http://localhost');
    if (u.pathname === '/api/search') {
      const q = (u.searchParams.get('q') || '').trim();
      if (!q) return json(res, 400, { error: 'Thiếu q' });
      return json(res, 200, { tracks: await searchTracks(q) });
    }
    if (u.pathname === '/api/home') {
      const [vn, pop] = await Promise.all([
        searchTracks('nhạc việt nam hot 2026 official audio', 15).catch(() => []),
        searchTracks('Bruno Mars Ed Sheeran Dua Lipa Taylor Swift official music video', 30).catch(() => []),
      ]);
      return json(res, 200, { sections: [
        { title: 'Nhạc Việt đang hot', tracks: vn },
        { title: 'Top hits quốc tế', tracks: pop },
      ]});
    }
    const sm = u.pathname.match(/^\/api\/stream\/([\w-]{6,20})$/);
    if (sm) return await proxyStream(sm[1], req, res);
    if (u.pathname === '/api/lyrics') {
      const q = (u.searchParams.get('q') || '').trim();
      if (!q) return json(res, 400, { error: 'Thiếu q' });
      const data = await new Promise((resolve, reject) => {
        const rq = https.get('https://lrclib.net/api/search?track_name=' + encodeURIComponent(q), { headers: { 'User-Agent': 'MusicWebMVP/0.1' }, family: 4, timeout: 12000 }, r => {
          let b = ''; r.on('data', d => b += d); r.on('end', () => { try { resolve(JSON.parse(b)); } catch { resolve([]); } });
        });
        rq.on('timeout', () => { rq.destroy(); resolve([]); });
        rq.on('error', () => resolve([]));
      });
      const first = Array.isArray(data) && data.length ? data[0] : null;
      return json(res, 200, { lyrics: first ? (first.syncedLyrics || first.plainLyrics || null) : null });
    }
    if (u.pathname === '/api/health') return json(res, 200, { ok: true, ytdlp: YTDLP, cache: streamCache.size });
    // static
    let file = u.pathname === '/' ? 'index.html' : u.pathname.slice(1);
    file = path.normalize(file).replace(/^(\.\.[\/\\])+/, '');
    const fp = path.join(PUBLIC_DIR, file);
    if (!fp.startsWith(PUBLIC_DIR) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
      res.writeHead(404); return res.end('Not found');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
    fs.createReadStream(fp).pipe(res);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) json(res, 500, { error: String(e.message || e) });
  }
});

server.listen(PORT, () => console.log(`Music Web MVP running at http://localhost:${PORT} (yt-dlp: ${YTDLP})`));
