import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.dirname(fileURLToPath(import.meta.url));
const dataFile=path.join(root,'AI_PhotoBooth_Storyboard_Data.js');
const backupDir=path.join(root,'storyboard-backups');
const port=Number(process.env.AI_PHOTOBOOTH_STORYBOARD_PORT||4319);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.json':'application/json; charset=utf-8'};

function send(res,status,body,type='application/json; charset=utf-8'){res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store'});res.end(body)}
function stamp(){return new Date().toISOString().replace(/[:.]/g,'-')}
async function readBody(req){let body='';for await(const chunk of req){body+=chunk;if(body.length>2_000_000)throw new Error('too large')}return JSON.parse(body)}
function validate(data){if(!data||typeof data!=='object'||!Array.isArray(data.steps)||!Array.isArray(data.lanes))throw new Error('잘못된 데이터 형식입니다.');const ids=new Set();for(const step of data.steps){if(!step.id||!step.title||!step.screen)throw new Error('필수 단계 정보가 없습니다.');if(ids.has(step.id))throw new Error('중복 단계 ID가 있습니다.');ids.add(step.id)}}
async function persist(data,confirmed){validate(data);await fs.mkdir(backupDir,{recursive:true});try{const old=await fs.readFile(dataFile,'utf8');await fs.writeFile(path.join(backupDir,`AI_PhotoBooth_Storyboard_Data_${stamp()}.js`),old,'utf8')}catch{}if(confirmed){data.meta.confirmed=true;data.meta.confirmedAt=data.meta.confirmedAt||new Date().toISOString()}data.meta.updatedAt=new Date().toISOString();const text=`window.AI_PHOTOBOOTH_STORYBOARD = ${JSON.stringify(data,null,2)};\n`;const temp=`${dataFile}.saving`;await fs.writeFile(temp,text,'utf8');await fs.rename(temp,dataFile);return {ok:true,updatedAt:data.meta.updatedAt,confirmedAt:data.meta.confirmedAt||null,stepCount:data.steps.length}}

const server=http.createServer(async(req,res)=>{try{
  const url=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`);
  if(req.method==='POST'&&(url.pathname==='/api/save'||url.pathname==='/api/confirm')){const result=await persist(await readBody(req),url.pathname==='/api/confirm');return send(res,200,JSON.stringify(result))}
  if(req.method!=='GET')return send(res,405,JSON.stringify({error:'method not allowed'}));
  const route=url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname);const file=path.resolve(root,`.${route}`);if(file!==root&&!file.startsWith(`${root}${path.sep}`))return send(res,403,'Forbidden','text/plain; charset=utf-8');
  const stat=await fs.stat(file);if(!stat.isFile())throw new Error('not file');const content=await fs.readFile(file);send(res,200,content,mime[path.extname(file).toLowerCase()]||'application/octet-stream');
}catch(error){send(res,404,JSON.stringify({error:error.message}))}});

server.listen(port,'127.0.0.1',()=>{console.log(`AI 포토부스 스토리보드: http://localhost:${port}/`);console.log('이 창을 닫으면 저장 서버가 종료됩니다.')});
