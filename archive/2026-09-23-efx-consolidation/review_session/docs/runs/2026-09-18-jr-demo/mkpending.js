'use strict';
const fs=require('fs');
const MIG='P:/Repos/github/danieljbinns/APP SCRIPT FORMS/employee_forms_efx/migration/node_modules';
const {google}=require(MIG+'/googleapis');
const IDS=JSON.parse(fs.readFileSync('jr-test-ids.json','utf8'));
const key=JSON.parse(fs.readFileSync('D:/Credentials/google/efx/efx-router-test.json','utf8'));
(async()=>{
  const jwt=new google.auth.JWT({email:key.client_email,key:key.private_key,scopes:['https://www.googleapis.com/auth/drive'],subject:'dbinns@team-group.com'});
  await jwt.authorize();
  const drive=google.drive({version:'v3',auth:jwt});
  const name='Pending JRs (EFX TEST)';
  const ex=await drive.files.list({q:`name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false and '${IDS.root}' in parents`,fields:'files(id)'});
  let id = ex.data.files.length ? ex.data.files[0].id
    : (await drive.files.create({requestBody:{name,mimeType:'application/vnd.google-apps.folder',parents:[IDS.root]},fields:'id'})).data.id;
  console.log((ex.data.files.length?'reuse ':'CREATED ')+name+'  '+id);
  for(const who of ['efx-bot@team-group.com',key.client_email]){
    try{ await drive.permissions.create({fileId:id,sendNotificationEmail:false,requestBody:{type:'user',role:'writer',emailAddress:who}}); console.log('   granted '+who); }
    catch(e){ console.log('   (already) '+who); }
  }
  IDS.pending=id;
  fs.writeFileSync('jr-test-ids.json',JSON.stringify(IDS,null,2));
  console.log('jr-test-ids.json updated');
})().catch(e=>{console.error('FAIL:',e.message);process.exit(1);});
