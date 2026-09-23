'use strict';
const fs=require('fs');
const MIG='P:/Repos/github/danieljbinns/APP SCRIPT FORMS/employee_forms_efx/migration/node_modules';
const {google}=require(MIG+'/googleapis');
const IDS=JSON.parse(fs.readFileSync('jr-test-ids.json','utf8'));
const key=JSON.parse(fs.readFileSync('D:/Credentials/google/efx/efx-router-test.json','utf8'));
const SA=key.client_email, BOT='efx-bot@team-group.com';
(async()=>{
  const jwt=new google.auth.JWT({email:key.client_email,key:key.private_key,scopes:['https://www.googleapis.com/auth/drive'],subject:'dbinns@team-group.com'});
  await jwt.authorize();
  const drive=google.drive({version:'v3',auth:jwt});
  for(const [k,id] of Object.entries(IDS)){
    for(const who of [BOT,SA]){
      try{
        const ex=await drive.permissions.list({fileId:id,fields:'permissions(id,emailAddress,role)'});
        if((ex.data.permissions||[]).some(p=>p.emailAddress===who)){console.log('  have  '+k.padEnd(10)+who);continue;}
        await drive.permissions.create({fileId:id,sendNotificationEmail:false,requestBody:{type:'user',role:'writer',emailAddress:who}});
        console.log('  GRANT '+k.padEnd(10)+who);
      }catch(e){console.log('  FAIL  '+k.padEnd(10)+who+'  '+String((e.response&&JSON.stringify(e.response.data))||e.message).slice(0,120));}
    }
  }
})().catch(e=>{console.error('FAIL:',e.message);process.exit(1);});
