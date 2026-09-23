'use strict';
const fs=require('fs');
const MIG='P:/Repos/github/danieljbinns/APP SCRIPT FORMS/employee_forms_efx/migration/node_modules';
const {google}=require(MIG+'/googleapis');
const key=JSON.parse(fs.readFileSync('D:/Credentials/google/efx/efx-router-test.json','utf8'));
const SC=['https://www.googleapis.com/auth/spreadsheets','https://www.googleapis.com/auth/drive','https://www.googleapis.com/auth/script.external_request','https://www.googleapis.com/auth/script.send_mail','https://www.googleapis.com/auth/userinfo.email','https://www.googleapis.com/auth/userinfo.profile','https://www.googleapis.com/auth/admin.directory.user.readonly','https://www.googleapis.com/auth/admin.directory.group.member.readonly','https://www.googleapis.com/auth/directory.readonly','https://www.googleapis.com/auth/contacts.readonly','https://www.googleapis.com/auth/script.projects'];
const WFS=process.argv.slice(2);
(async()=>{
  const jwt=new google.auth.JWT({email:key.client_email,key:key.private_key,scopes:SC,subject:'efx-bot@team-group.com'});
  const t=(await jwt.authorize()).access_token;
  const call=async(fn,params)=>{const r=await fetch('https://script.googleapis.com/v1/scripts/1yD_Me_Y_zVZBoejOozy1CGVEFh2_dzw289SbVohVpWt2LEKXYMx_OYIn:run',{method:'POST',headers:{Authorization:'Bearer '+t,'Content-Type':'application/json'},body:JSON.stringify({function:fn,parameters:params,devMode:false})});return (await r.json()).response.result;};
  for(const wf of WFS){
    const g=await call('n8n_getWorkflow',[{id:'v',email:'efx-bot@team-group.com'},wf]);
    const r=g.result||{};
    const step=r['Current Step']||r['Status']||'?';
    console.log('\n'+wf);
    console.log('  employee      : '+(g.employeeId&&g.employeeId.employeeName)+'  id '+(g.employeeId&&g.employeeId.internalEmployeeId));
    console.log('  status        : '+step);
    const d=await call('n8n_getStepData'in{}?'n8n_getWorkflow':'n8n_getWorkflow',[{id:'v',email:'efx-bot@team-group.com'},wf]);
    const t2=await call('n8n_listTasks',[{id:'v',email:'efx-bot@team-group.com'},{workflowId:wf}]);
    const list=(t2.result&&(t2.result.tasks||t2.result))||[];
    console.log('  tasks         : '+((Array.isArray(list)?list:[]).map(x=>(x.formType||x.type)+'/'+x.status).join(', ')||'none'));
  }
})().catch(e=>{console.error('FAIL:',e.message);process.exit(1);});
