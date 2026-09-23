'use strict';
const fs=require('fs');
const MIG='P:/Repos/github/danieljbinns/APP SCRIPT FORMS/employee_forms_efx/migration/node_modules';
const {google}=require(MIG+'/googleapis');
const key=JSON.parse(fs.readFileSync('D:/Credentials/google/efx/efx-router-test.json','utf8'));
const SRC={tracker:'18prwB6phOIGIjI9V92h_hEXz4fpfwdramri1ziIiAC0',index:'1SDicVzLEcynHTRFX-3TK4GaHA8aGsRE46vHhoOBpPLc',template:'1GDnsjxAHAIj3q0X_1Enk32faXO0SkdYi_K4WKiqPxT0'};
(async()=>{
  const jwt=new google.auth.JWT({email:key.client_email,key:key.private_key,scopes:['https://www.googleapis.com/auth/drive'],subject:'dbinns@team-group.com'});
  await jwt.authorize();
  const drive=google.drive({version:'v3',auth:jwt});
  const out={};
  const findOrMake=async(name,parent)=>{
    const q=`name='${name.replace(/'/g,"\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false`+(parent?` and '${parent}' in parents`:'');
    const ex=await drive.files.list({q,fields:'files(id,name)'});
    if(ex.data.files.length) { console.log('  reuse folder  '+name+'  '+ex.data.files[0].id); return ex.data.files[0].id; }
    const r=await drive.files.create({requestBody:{name,mimeType:'application/vnd.google-apps.folder',parents:parent?[parent]:undefined},fields:'id'});
    console.log('  CREATED folder '+name+'  '+r.data.id); return r.data.id;
  };
  const copyOnce=async(srcId,name,parent)=>{
    const ex=await drive.files.list({q:`name='${name.replace(/'/g,"\'")}' and trashed=false and '${parent}' in parents`,fields:'files(id,name)'});
    if(ex.data.files.length){ console.log('  reuse copy    '+name+'  '+ex.data.files[0].id); return ex.data.files[0].id; }
    const r=await drive.files.copy({fileId:srcId,requestBody:{name,parents:[parent]},supportsAllDrives:true,fields:'id'});
    console.log('  COPIED        '+name+'  '+r.data.id); return r.data.id;
  };
  console.log('Creating isolated JR test resources in dbinns My Drive:');
  out.root      = await findOrMake('EFX JR TEST');
  out.approved  = await findOrMake('Approved JRs (EFX TEST)', out.root);
  out.tracker   = await copyOnce(SRC.tracker,  'JR Pending approval tracker (EFX TEST)', out.root);
  out.index     = await copyOnce(SRC.index,    'BOSS JR Templates (EFX TEST)',           out.root);
  out.template  = await copyOnce(SRC.template, 'JR Approval Template (EFX TEST)',        out.root);
  fs.writeFileSync('jr-test-ids.json',JSON.stringify(out,null,2));
  console.log('\nwrote jr-test-ids.json');
  // sanity: confirm the copies are NOT the originals
  for(const [k,v] of Object.entries(out)) for(const s of Object.values(SRC)) if(v===s) throw new Error('ALIAS COLLISION: '+k+' equals a production id');
  console.log('verified: no test id equals a production id');
})().catch(e=>{console.error('FAIL:',(e.response&&JSON.stringify(e.response.data))||e.message);process.exit(1);});
