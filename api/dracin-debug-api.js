module.exports = async function handler(req,res){
  res.setHeader('Access-Control-Allow-Origin','*');
  const base=process.env.NUNODRAMA_API_URL||'https://api.nunodrama.my.id';
  const token=process.env.NUNODRAMA_API_TOKEN||'';
  if(!token)return res.status(503).json({ok:false,configured:false});
  const endpoint=req.query?.target==='search'?'/api/melolo/search?query=CEO':'/api/melolo/trending';
  try{
    const r=await fetch(base+endpoint,{headers:{'User-Agent':'Mozilla/5.0 Chrome/135.0.0.0 Safari/537.36','x-api-token':token,Accept:'application/json, text/plain, */*'},cache:'no-store'});
    const text=await r.text();
    let body;try{body=JSON.parse(text)}catch{body=text}
    const shape=v=>Array.isArray(v)?{type:'array',length:v.length}:v&&typeof v==='object'?{type:'object',keys:Object.keys(v),dataType:Array.isArray(v.data)?'array':typeof v.data,dataLength:Array.isArray(v.data)?v.data.length:typeof v.data==='string'?v.data.length:null}:typeof v==='string'?{type:'string',length:v.length,prefix:v.slice(0,120)}:{type:typeof v};
    return res.json({ok:true,upstreamStatus:r.status,endpoint,shape:shape(body)});
  }catch(e){return res.status(500).json({ok:false,error:e.message})}
};
