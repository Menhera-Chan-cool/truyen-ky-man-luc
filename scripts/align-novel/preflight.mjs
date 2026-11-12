import fs from 'node:fs/promises';
const base=process.env.NOVEL_ALIGNMENT_SUPABASE_URL,key=process.env.NOVEL_ALIGNMENT_SERVICE_ROLE_KEY;
if(!base||!key)throw Error('Alignment worker credentials are not configured');
const response=await fetch(base+'/rest/v1/rpc/claim_novel_alignment_job',{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(30000)});
if(!response.ok)throw Error('Unable to claim alignment work: HTTP '+response.status);
const job=await response.json();await fs.mkdir('.alignment-work',{recursive:true});
if(job)await fs.writeFile('.alignment-work/first-job.json',JSON.stringify(job));
if(process.env.GITHUB_OUTPUT)await fs.appendFile(process.env.GITHUB_OUTPUT,'has_job='+Boolean(job)+'\n');
console.log(JSON.stringify({hasJob:Boolean(job)}));
