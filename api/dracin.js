const { createDecipheriv, createHash } = require('crypto');

const BASE = process.env.NUNODRAMA_BASE_URL || 'https://nunodrama.my.id';
const API_BASE = process.env.NUNODRAMA_API_URL || 'https://api.nunodrama.my.id';
const TOKEN = process.env.NUNODRAMA_API_TOKEN || '';
const SECRET = process.env.NUNODRAMA_SECRET_KEY || '';
const DEFAULT_PROVIDER = 'melolo';
const SEARCH_PROVIDERS = ['melolo','dramabox','netshort','reelshort','shortmax','goodshort','dramaverse'];

function evp(password, salt) {
  let out = Buffer.alloc(0), prev = Buffer.alloc(0);
  while (out.length < 48) {
    prev = createHash('md5').update(Buffer.concat([prev, password, salt])).digest();
    out = Buffer.concat([out, prev]);
  }
  return { key: out.subarray(0, 32), iv: out.subarray(32, 48) };
}

function decrypt(value) {
  if (!value || typeof value !== 'string' || !SECRET) return value;
  try {
    const raw = Buffer.from(value, 'base64');
    if (raw.subarray(0, 8).toString() !== 'Salted__') return value;
    const { key, iv } = evp(Buffer.from(SECRET), raw.subarray(8, 16));
    const d = createDecipheriv('aes-256-cbc', key, iv);
    return JSON.parse(Buffer.concat([d.update(raw.subarray(16)), d.final()]).toString('utf8'));
  } catch { return value; }
}

function hdr(cookie) {
  return {
    'User-Agent': 'Mozilla/5.0 Chrome/135.0.0.0 Safari/537.36',
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8',
    'x-api-token': TOKEN,
    Referer: `${BASE}/`, Origin: BASE,
    ...(cookie ? { Cookie: cookie } : {}),
  };
}

async function rawFetch(url, cookie) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const r = await fetch(url, { headers: hdr(cookie), signal: controller.signal, cache: 'no-store' });
    if (!r.ok) throw new Error(`UPSTREAM_${r.status}`);
    const text = await r.text();
    let body; try { body = JSON.parse(text); } catch { body = text; }
    if (body && typeof body === 'object' && typeof body.data === 'string') body = { ...body, data: decrypt(body.data) };
    else if (typeof body === 'string') body = decrypt(body);
    return body;
  } finally { clearTimeout(timer); }
}

async function call(endpoint, cookie) {
  try { return await rawFetch(`${BASE}${endpoint}`, cookie); }
  catch { return rawFetch(`${API_BASE}${endpoint}`, cookie); }
}

function cookieFrom(r) {
  const s = r.headers.get('set-cookie');
  return s ? s.split(/,(?=[^;,]+=)/g).map(v => v.split(';')[0]).join('; ') : undefined;
}

async function langCookie(p) {
  let lang = 'in';
  if (['shortmax','dramabox','dramabite','kalostv','reelshort','momeshort','happyshort','flextv','idrama','pinedrama','velolo','minishort','mydrama','dramarush','bibishort','vibeshort','dotdrama','storyreel','mymuse','moreshort'].includes(p)) lang = 'id';
  if (['netshort','freeshort','stardust'].includes(p)) lang = 'id_ID';
  if (['freereels','dramawave'].includes(p)) lang = 'id-ID';
  if (p === 'anyreel') lang = 'ID';
  if (p === 'snackshort') lang = 'Indonesian';
  if (p === 'flickreels') lang = '6';
  try {
    const r = await fetch(`${BASE}/api/${p}/set_language?lang=${encodeURIComponent(lang)}`, { headers: hdr(), cache: 'no-store' });
    return cookieFrom(r);
  } catch { return undefined; }
}

function list(raw) {
  if (Array.isArray(raw)) return raw;
  for (const v of [raw?.data, raw?.data?.list, raw?.data?.items, raw?.data?.episodes, raw?.dramas, raw?.episodes]) if (Array.isArray(v)) return v;
  return [];
}
function pval(v) {
  const p = String(v || DEFAULT_PROVIDER).trim().toLowerCase();
  if (!/^[a-z0-9_-]{2,40}$/.test(p)) throw new Error('INVALID_PLATFORM');
  return p;
}
function drama(x, p, i) {
  const id = String(x.bookId || x.id || x.drama_id || x.shortPlayId || x.work_id || x.book_id || i + 1);
  return { index:i+1, platform:p, id, title:x.bookName||x.title||x.name||x.book_title||'Untitled', cover:x.cover||x.book_pic||x.cover_url||x.poster||'', synopsis:x.introduction||x.desc||x.description||x.synopsis||'-', totalEpisodes:x.chapter_count||x.total_episodes||x.num_videos||0 };
}

async function feed(p, page=1, limit=21) {
  const c = await langCookie(p);
  let ep = `/api/${p}/foryou?page=${page}&limit=${limit}`;
  if (p==='stardust') ep=`/api/stardust/hot?page=${page}&page_size=${limit}`;
  else if (p==='drakorid') ep='/api/drakorid/foryou';
  else if (p==='melolo') ep='/api/melolo/trending';
  else if (p==='toonshort') ep='/api/toonshort/popular';
  const dramas = list(await call(ep,c)).map((x,i)=>drama(x,p,i));
  return {status:'success',source:'NunoDrama',platform:p,page,total:dramas.length,dramas};
}

async function search(q,p) {
  const c=await langCookie(p); const key=['netshort','flickreels','freereels','melolo'].includes(p)?'query':'keyword';
  const results=list(await call(`/api/${p}/search?${key}=${encodeURIComponent(q)}`,c)).map((x,i)=>drama(x,p,i));
  return {status:'success',source:'NunoDrama',query:q,platform:p,total:results.length,results};
}

async function detail(p,id) {
  const c=await langCookie(p); let ep=`/api/${p}/detail?book_id=${encodeURIComponent(id)}`;
  if (['shortmax','storyreel','vibeshort'].includes(p)) ep=`/api/${p}/detail?drama_id=${encodeURIComponent(id)}`;
  else if(p==='netshort') ep=`/api/netshort/detail?shortPlayId=${encodeURIComponent(id)}`;
  else if(['flickreels','freereels'].includes(p)) ep=`/api/${p}/detail?id=${encodeURIComponent(id)}`;
  else if(['melolo','velolo'].includes(p)) ep=`/api/${p}/detail?bookId=${encodeURIComponent(id)}`;
  else if(p==='moboreels') ep=`/api/moboreels/detail?series_id=${encodeURIComponent(id)}`;
  else if(p==='bumpint') ep=`/api/bumpint/detail?work_id=${encodeURIComponent(id)}`;
  else if(p==='toonshort') ep=`/api/toonshort/detail?dramas_id=${encodeURIComponent(id)}`;
  const r=await call(ep,c), d=r?.data||r||{};
  return {status:'success',source:'NunoDrama',platform:p,id,title:d.bookName||d.title||d.name||d.shortPlayName||'Untitled',cover:d.cover||d.book_pic||d.cover_url||d.poster||'',synopsis:d.introduction||d.desc||d.description||d.synopsis||'-',totalEpisodes:d.chapter_count||d.total_episodes||d.num_videos||0,tags:d.tags||d.tag_list||d.genres||[]};
}

async function episodes(p,id){
  const c=await langCookie(p); let ep=`/api/${p}/allepisode?book_id=${encodeURIComponent(id)}`;
  if(['shortmax','storyreel','goodshort','vibeshort'].includes(p)) ep=`/api/${p}/episode?drama_id=${encodeURIComponent(id)}&book_id=${encodeURIComponent(id)}`;
  else if(p==='velolo') ep=`/api/velolo/allepisode?bookId=${encodeURIComponent(id)}`;
  else if(p==='moboreels') ep=`/api/moboreels/allepisode?series_id=${encodeURIComponent(id)}`;
  else if(p==='bumpint') ep=`/api/bumpint/allepisode?work_id=${encodeURIComponent(id)}`;
  else if(p==='toonshort') ep=`/api/toonshort/allepisode?dramas_id=${encodeURIComponent(id)}`;
  const items=list(await call(ep,c)).map((x,i)=>({index:x.chapterIndex||x.episode||x.episode_index||i+1,chapterId:String(x.chapterId||x.id||x.episode_id||i+1),chapterName:x.chapterName||x.name||x.title||`Episode ${i+1}`}));
  return {status:'success',source:'NunoDrama',platform:p,bookId:id,totalEpisodes:items.length,episodes:items};
}

async function stream(p,id,episode=1){
  const c=await langCookie(p); let ep=`/api/${p}/stream?book_id=${encodeURIComponent(id)}&episode=${episode}`;
  if(['shortmax','storyreel','vibeshort'].includes(p)) ep=`/api/${p}/stream?drama_id=${encodeURIComponent(id)}&episode_index=${episode}&json=1`;
  else if(p==='netshort') ep=`/api/netshort/stream?book_id=${encodeURIComponent(id)}&episode=${episode}`;
  else if(p==='flickreels') ep=`/api/flickreels/stream?book_id=${encodeURIComponent(id)}&chapter_id=${episode}`;
  else if(p==='freereels') ep=`/api/freereels/stream?bookId=${encodeURIComponent(id)}&episodeId=${episode}`;
  else if(p==='goodshort') ep=`/api/goodshort/stream?book_id=${encodeURIComponent(id)}&episode_id=${episode}&server=1`;
  else if(['snackshort','stardust'].includes(p)) ep=`/api/${p}/stream?book_id=${encodeURIComponent(id)}&chapter_id=${episode}`;
  else if(p==='melolo') ep=`/api/melolo/stream?bookId=${encodeURIComponent(id)}&ep=${episode}`;
  else if(p==='toonshort') ep=`/api/toonshort/stream?dramas_id=${encodeURIComponent(id)}&episode=${episode}`;
  else if(p==='moboreels') ep=`/api/moboreels/stream?series_id=${encodeURIComponent(id)}&episode=${episode}&json=1`;
  const r=await call(ep,c), d=r?.data||r||{}; const qualities=Array.isArray(d.qualities)?d.qualities.map(q=>({quality:q.quality||'HD',url:q.url||q.playUrl||q.proxyUrl||''})):[];
  const streamUrl=d.playUrl||d.proxyUrl||d.url||qualities[0]?.url||'';
  return {status:'success',source:'NunoDrama',platform:p,bookId:id,episode,quality:d.quality||qualities[0]?.quality||'HD',streamUrl,directPlayUrl:d.proxyUrl||d.playUrl||streamUrl,qualities};
}

module.exports = async function handler(req,res){
  res.setHeader('Access-Control-Allow-Origin','*'); res.setHeader('Access-Control-Allow-Methods','GET,OPTIONS');
  if(req.method==='OPTIONS') return res.status(204).end();
  if(req.method!=='GET') return res.status(405).json({status:'error',message:'GET only'});
  if(!TOKEN||!SECRET) return res.status(503).json({status:'error',source:'NunoDrama',message:'NunoDrama credentials belum dikonfigurasi di Vercel'});
  const q=req.query||{}, op=q.op||q.action||'health';
  try{
    if(op==='health') return res.json({success:true,service:'Rayliziie Dracin',source:'NunoDrama',version:'1.0.0',upstream:BASE,defaultProvider:DEFAULT_PROVIDER});
    if(op==='platforms'||op==='categories') return res.json({status:'success',source:'NunoDrama',providers:SEARCH_PROVIDERS});
    if(['feed','home','recent','videos'].includes(op)) return res.json(await feed(pval(q.platform||q.provider),Number(q.page||1)||1,Number(q.limit||q.count||21)||21));
    if(['search','search_rtl'].includes(op)){
      const term=q.q||q.query||q.search||''; if(!term) return res.status(400).json({status:'error',message:'q/query wajib diisi'});
      if(q.platform||q.provider) return res.json(await search(term,pval(q.platform||q.provider)));
      const settled=await Promise.allSettled(SEARCH_PROVIDERS.map(p=>search(term,p))); const results=settled.flatMap(s=>s.status==='fulfilled'?s.value.results:[]);
      return res.json({status:'success',source:'NunoDrama',query:term,mode:'multi-platform',total:results.length,results});
    }
    const p=pval(q.platform||q.provider), id=q.id||q.bookId||q.seriesId||q.videoId||'';
    if(['detail','episodes','episode','stream','play','watch','model'].includes(op)&&!id) return res.status(400).json({status:'error',message:'id/bookId wajib diisi'});
    if(op==='detail') return res.json(await detail(p,id));
    if(op==='episodes'||op==='episode') return res.json(await episodes(p,id));
    if(['stream','play','watch','model'].includes(op)) return res.json(await stream(p,id,Number(q.episode||q.ep||1)||1));
    if(op==='category') return res.json(await feed(pval(q.platform||q.provider||q.id),Number(q.page||1)||1,Number(q.count||21)||21));
    return res.json({success:true,service:'Rayliziie Dracin / NunoDrama',routes:['?action=home','?action=search&query=...','?action=detail&id=...','?action=episodes&id=...','?action=stream&id=...&episode=1']});
  }catch(e){ return res.status(e?.message==='INVALID_PLATFORM'?400:502).json({status:'error',source:'NunoDrama',message:e?.message||'Unknown error'}); }
};
