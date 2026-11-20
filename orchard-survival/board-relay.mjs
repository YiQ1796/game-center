// Kind 30078 stores application data. Each completed run is independent.
export const BOARD='yiq1796-orchard-survival';
export const RELAYS=['wss://relay.damus.io','wss://nos.lol','wss://relay.primal.net','wss://relay.nostr.net'];
let cryptoModule;
export const signing=()=>cryptoModule??=import('./rank-sign.mjs').catch(e=>{cryptoModule=null;throw e;});
async function exchange(url,command,onMessage){
  return new Promise((resolve,reject)=>{
    const socket=new WebSocket(url);
    let ended=false;
    function finish(error,result){
      if(ended)return;ended=true;clearTimeout(timeout);
      socket.onopen=socket.onclose=socket.onerror=socket.onmessage=null;
      socket.close();
      if(error)reject(error);else resolve(result);
    }
    const timeout=setTimeout(()=>finish(new Error('排行榜連線逾時')),10500);
    socket.onopen=()=>socket.send(JSON.stringify(command));
    socket.onerror=socket.onclose=()=>finish(new Error('排行榜連線中斷'));
    socket.onmessage=e=>{
      try{onMessage(JSON.parse(e.data),(result)=>finish(null,result),(msg)=>finish(new Error(msg)));}
      catch(err){finish(err);}
    };
  });
}
export async function signRow(row,board=BOARD,ttl=0){
  const {generateSecretKey,finalizeEvent}=await signing();
  const now=Math.floor(Date.now()/1000);
  const tags=[['d',board+'/'+row.id],['t',board]];
  if(ttl)tags.push(['expiration',String(now+ttl)]);
  return finalizeEvent({kind:30078,created_at:now,tags,content:JSON.stringify(row)},generateSecretKey());
}
export function sendEvent(event,relays=RELAYS){
  return Promise.any(relays.map(url=>exchange(url,['EVENT',event],(packet,ok,fail)=>{
    if(packet[0]==='OK'&&packet[1]===event.id){
      if(packet[2]||String(packet[3]).startsWith('duplicate:'))ok(url);else fail(String(packet[3]));
    }
  })));
}
export async function fetchBoard(board=BOARD,relays=RELAYS){
  const {verifyEvent}=await signing(),rows=new Map();
  async function readRelay(url){
    let until;
    for(;;){
      const id=crypto.randomUUID(),events=[];
      await exchange(url,['REQ',id,{kinds:[30078],'#t':[board],limit:300,...(until?{until}:{})}],(msg,ok,fail)=>{
        if(msg[1]!==id)return;
        if(msg[0]==='CLOSED')fail('榜單暫時無法讀取');
        if(msg[0]==='EOSE')ok(true);
        if(msg[0]==='EVENT'&&events.length<300)events.push(msg[2]);
      });
      for(const event of events){
        try{
          if(event.kind!==30078||event.content.length>512||!verifyEvent(event))continue;
          const row=JSON.parse(event.content);
          if(event.tags.some(t=>t[0]==='d'&&t[1]===board+'/'+row.id))rows.set(row.id,row);
        }catch{}
      }
      if(events.length<300)return;
      const next=Math.min(...events.map(e=>e.created_at))-1;
      if(until&&next>=until)return;until=next;
    }
  }
  const results=await Promise.allSettled(relays.map(readRelay));
  if(!results.some(r=>r.status==='fulfilled'))throw new Error('公開榜暫時無法讀取');
  return [...rows.values()];
}
