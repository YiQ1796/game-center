import {signRow,sendEvent,fetchBoard} from './board-relay.mjs?v=081';
const adjectives=['晨霧','琥珀','晚霞','玉露','銀月','赤楓','春雷','星河','青竹','霜花','金穗','翠羽'];
const roles=['巡山客','採桃手','守林人','踏風客','追星猴','摘月客','尋泉人','聽雨猴','斥候','果園長','鈴弓手','搗藥師'];
const validName=name=>adjectives.some(a=>roles.some(b=>name===a+b));
export function nameChoices(){
  const choices=new Set();
  while(choices.size<4){
    const [a,b]=crypto.getRandomValues(new Uint32Array(2));
    choices.add(adjectives[a%adjectives.length]+roles[b%roles.length]);
  }
  return [...choices];
}
const storage='orchard-runs-v070';
const repo='YiQ1796/game-center';
const prefix='果園戰績 v070';
export function valid(row){
  return row && validName(row.name) && ['單人','合作'].includes(row.mode) &&
    ['staff','mage','scout'].includes(row.job) && Number.isSafeInteger(row.kills)&&row.kills>=0&&row.kills<1e8 &&
    Number.isSafeInteger(row.seconds)&&row.seconds>=0&&row.seconds<=604800&&
    typeof row.id==='string'&&/^[a-z0-9-]{8,100}$/i.test(row.id);
}
export function sorted(rows,metric){
  const other=metric==='kills'?'seconds':'kills';
  return [...rows].sort((a,b)=>b[metric]-a[metric]||b[other]-a[other]||a.name.localeCompare(b.name));
}
let memory=[];
export function history(){
  try{const list=JSON.parse(localStorage.getItem(storage)||'[]');if(Array.isArray(list))return [...new Map([...list,...memory].filter(valid).map(r=>[r.id,r])).values()];}catch{}
  return memory;
}
export function saveResult(view){
  const rows=view.players.map((p,i)=>({id:view.runId+'-'+i,mode:view.players.length>1?'合作':'單人',job:p.job,name:p.name,kills:p.kills,seconds:p.aliveSeconds}));
  const all=[...new Map([...history(),...rows.filter(valid)].map(row=>[row.id,row])).values()];
  const keep=new Map();
  for(const mode of ['單人','合作'])for(const metric of ['kills','seconds'])
    for(const row of sorted(all.filter(r=>r.mode===mode),metric).slice(0,50))keep.set(row.id,row);
  memory=[...keep.values()];
  try{localStorage.setItem(storage,JSON.stringify(memory));}catch{}
  return rows;
}
let cache;
async function oldScores(){
  const rows=new Map();
  for(let page=1;;page++){
    const url='https://api.github.com/repos/'+repo+'/issues?state=all&per_page=100&page='+page;
    const response=await fetch(url,{signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw new Error('公開榜暫時讀不到，請稍後再試。');
    const issues=await response.json();
    for(const issue of issues){
      if(issue.pull_request||issue.state!=='open')continue;
      const [mark,name,mode,job,kills,seconds,id]=issue.title.split('｜');
      const row={name,mode,job,kills:Number(kills),seconds:Number(seconds),id};
      if(mark===prefix&&valid(row))rows.set(id,row);
    }
    if(issues.length<100)break;
  }
  return [...rows.values()];
}

const pending='orchard-rank-pending/';
const sent='orchard-rank-sent/';
const waiting=new Map(),inflight=new Map();
function read(key){try{return localStorage.getItem(key);}catch{return null;}}
function write(key,value){try{localStorage.setItem(key,value);}catch{}}
export function submitResult(row){
  if(!valid(row))return Promise.reject(new Error('無效戰績'));
  if(read(sent+row.id))return Promise.resolve();
  if(inflight.has(row.id))return inflight.get(row.id);
  waiting.set(row.id,row);write(pending+row.id,JSON.stringify(row));
  const task=(async()=>{
    const event=await signRow(row);
    await sendEvent(event);cache=null;
    write(sent+row.id,'1');waiting.delete(row.id);
    try{localStorage.removeItem(pending+row.id);}catch{}
    window.dispatchEvent(new CustomEvent('orchard-score-synced',{detail:row}));
  })().finally(()=>inflight.delete(row.id));
  inflight.set(row.id,task);return task;
}
export function retryPending(){
  try{
    for(const key of Object.keys(localStorage)){
      if(!key.startsWith(pending))continue;
      try{
        const row=JSON.parse(read(key));
        if(valid(row)&&!read(sent+row.id))waiting.set(row.id,row);
      }catch{}
    }
  }catch{}
  for(const row of waiting.values())submitResult(row).catch(()=>{});
}
export async function publicResults(){
  if(cache&&Date.now()-cache.at<15000)return cache.rows;
  const [current,legacy]=await Promise.all([fetchBoard(),oldScores().catch(()=>[])]);
  const rows=[...new Map([...legacy,...current].filter(valid).map(r=>[r.id,r])).values()];
  cache={at:Date.now(),rows};return rows;
}
