const { createDecipheriv, createHash } = require('crypto');

const BASE = process.env.NUNODRAMA_BASE_URL || 'https://nunodrama.my.id';
const TOKEN = process.env.NUNODRAMA_API_TOKEN || '';
const SECRET = process.env.NUNODRAMA_SECRET_KEY || '';

function evp(password, salt) {
  let out = Buffer.alloc(0), prev = Buffer.alloc(0);
  while (out.length < 48) {
    prev = createHash('md5').update(Buffer.concat([prev, password, salt])).digest();
    out = Buffer.concat([out, prev]);
  }
  return { key: out.subarray(0,32), iv: out.subarray(32,48) };
}
function decrypt(v) {
  if (!v || typeof v !== 'string' || !SECRET) return v;
  try {
    const raw = Buffer.from(v,'base64');
    if (raw.subarray(0,8).toString() !== 'Salted__') return v;
    const {key,iv}=evp(Buffer.from(SECRET),raw.subarray(8,16));
    const d=createDecipheriv('aes-256-cbc',key,iv);
    return JSON.parse(Buffer.concat([d.update(raw.subarray(16)),d.final()]).toString('utf8'));
  } catch { return v; }
}
function describe(v, depth=0) {
  if (depth > 3) return typeof v;
  if (Array.isArray(v)) return { type:'array', length:v.length, sample:v.slice(0,2).map(x=>describe(x,depth+1)) };
  if (v && typeof v === 'object') {
    const out={type:'object',keys:Object.keys(v)};
    for (const k of Object.keys(v).slice(0,12)) out[k]=describe(v[k],depth+1);
    return out;
  }
  if (typeof v === 'string') return {type:'string',length:v.length,prefix:v.slice(0,80)};
  return {type:typeof v,value:v};
}
module.exports = async function handler(req,res){
  res.setHeader('Access-Control-Allow-Origin','*');
  if(!TOKEN||!SECRET) return res.status(503).json({ok:false,configured:false});
  const target=(req.query?.target||'trending').toString();
  const endpoint=target==='search'?'/api/melolo/search?query=CEO':'/api/melolo/trending';
  try{
    const r=await fetch(BASE+endpoint,{headers:{'User-Agent':'Mozilla/5.0 Chrome/135.0.0.0 Safari/537.36','x-api-token':TOKEN,Accept:'application/json, text/plain, */*',Referer:BASE+'/',Origin:BASE},cache:'no-store'});
    const text=await r.text();
    let body; try{body=JSON.parse(text)}catch{body=text}
    let decoded=body;
    if(body&&typeof body==='object'&&typeof body.data==='string') decoded={...body,data:decrypt(body.data)};
    else if(typeof body==='string') decoded=decrypt(body);
    return res.status(200).json({ok:true,upstreamStatus:r.status,endpoint,rawShape:describe(body),decodedShape:describe(decoded)});
  }catch(e){return res.status(500).json({ok:false,error:e.message})}
}
