'use strict';
// Binns: plain approve, like the JR flow. Drop the editable form.
// resume:'webhook' means clicking the emailed link resumes the run directly - no form page, no form
// fields. Build ID Setup then falls back to the drafted values for everything, which is exactly
// "approve as drafted". If George wants an editable review page he can build one.
const fs=require('fs');
const H={'X-N8N-API-KEY':fs.readFileSync('D:/Credentials/n8n/api-key-staging.txt','utf8').trim(),'Content-Type':'application/json'};
const API='https://n8n-staging.team-group.com/api/v1';
const WF='qd3vlXvkAY8H2PC3';
(async()=>{
  const w=await (await fetch(API+'/workflows/'+WF,{headers:H})).json();
  const i=w.nodes.findIndex(n=>n.name==='Manager approves');
  const wait=w.nodes[i];
  console.log('before: resume='+wait.parameters.resume);
  wait.parameters={ resume:'webhook', options:{} };
  const r=await fetch(API+'/workflows/'+WF,{method:'PUT',headers:H,body:JSON.stringify({name:w.name,nodes:w.nodes,connections:w.connections,settings:w.settings||{executionOrder:'v1'}})});
  console.log('PUT HTTP '+r.status);
  if(!r.ok){console.error(JSON.stringify(await r.json()).slice(0,300));process.exit(1);}
  const a=await (await fetch(API+'/workflows/'+WF,{headers:H})).json();
  console.log('after : resume='+a.nodes.find(n=>n.name==='Manager approves').parameters.resume);
})();
