import assert from 'node:assert/strict';
import {signRow,sendEvent,fetchBoard} from '../orchard-survival/board-relay.mjs';
const board='orchard-ranking-connectivity-test';
const row={id:crypto.randomUUID(),name:'晨霧巡山客',job:'scout',mode:'單人',kills:1,seconds:15};
const event=await signRow(row,board,180);
const relay=await sendEvent(event);
for(let attempt=0;attempt<3;attempt++){
  const rows=await fetchBoard(board,[relay]);
  if(rows.some(r=>r.id===row.id&&r.name===row.name&&r.seconds===15)){console.log('Independent anonymous write and read confirmed on '+relay);break;}
  assert.ok(attempt<2,'acknowledged score was not returned');await new Promise(r=>setTimeout(r,1500));
}
