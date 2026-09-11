"""Explicit integration test with disposable accounts. Never run against real users.
prepare -> apply generated setup SQL -> client -> apply assistant SQL -> verify
Finally apply cleanup SQL, even if an assertion fails. Secrets stay in ignored runtime files.
"""
import json, secrets, uuid, hashlib, sys, urllib.request, urllib.error
from pathlib import Path
from datetime import datetime, timezone

root=Path(__file__).resolve().parents[2]
statefile=root/'.sites-runtime/planner-cloud-smoke.json'
config=json.loads((root/'planner/public/sync-config.json').read_text())
base=config['url']; key=config['publishableKey']
def quote(text): return "'"+text.replace("'","''")+"'"
def request(path, body=None, token=None, method=None):
    headers={'apikey':key,'Content-Type':'application/json','Origin':'https://sayanovvg.github.io'}
    if token: headers['Authorization']='Bearer '+token
    req=urllib.request.Request(base+path, None if body is None else json.dumps(body).encode(), headers, method=method)
    try:
        with urllib.request.urlopen(req,timeout=45) as response:
            text=response.read().decode();return response.status,json.loads(text) if text else None
    except urllib.error.HTTPError as error:
        text=error.read().decode()
        try: value=json.loads(text)
        except ValueError: value={}
        return error.code,value
def save(): statefile.write_text(json.dumps(state))
def sqlfile(name,sql): (root/'.sites-runtime'/name).write_text(sql)
step=sys.argv[1]
if step=='prepare':
    state={'accounts':[{'invite':secrets.token_urlsafe(32),'email':'planner-smoke-'+uuid.uuid4().hex+'@example.com','password':secrets.token_urlsafe(32)} for _ in range(2)]}
    for a in state['accounts']: a['hash']=hashlib.sha256(a['invite'].encode()).hexdigest()
    save()
    sqlfile('planner-test-setup.sql', 'insert into planner_private.setup_links(token_hash,expires_at) values '+','.join('('+quote(a['hash'])+",now()+interval '30 minutes')" for a in state['accounts'])+';')
    print('Prepared two disposable account invitations.')
else:
    state=json.loads(statefile.read_text())
    if step=='client':
        status,_=request('/functions/v1/planner-activate',{'token':'A'*43,'email':'invalid-invite@example.com','password':'not-a-real-password-123'})
        assert status==401, ('Invalid invitation must fail',status)
        for a in state['accounts']:
            if a.get('uid'): continue
            status,data=request('/functions/v1/planner-activate',{'token':a['invite'],'email':a['email'],'password':a['password']})
            assert status==200 and data.get('ok'), ('Activation failed',status,data)
            status,data=request('/auth/v1/token?grant_type=password',{'email':a['email'],'password':a['password']})
            assert status==200 and data.get('access_token'),('Login failed',status)
            a.update(token=data['access_token'],uid=data['user']['id']);save()
            status,_=request('/functions/v1/planner-activate',{'token':a['invite'],'email':a['email'],'password':a['password']})
            assert status==401, 'Invitation must be one-use'
        a,b=state['accounts']
        now=datetime.now(timezone.utc).isoformat()
        body={'title':'Disposable sync test','notes':'','project':'inbox','date':'2026-09-11','time':None,'duration':30,'deadline':None,'priority':2,'starred':False,'status':'todo','completedAt':None,'checklist':[],'tags':[],'repeat':{'frequency':'none','interval':1,'anchorDay':11,'until':None},'seriesId':str(uuid.uuid4()),'repeatParent':None,'source':'self','createdAt':now,'updatedAt':now}
        change={'id':'smoke-task','kind':'task','body':body,'deleted':False,'base_revision':0}
        payload={'p_operation_id':str(uuid.uuid4()),'p_changes':[change]}
        status,data=request('/rest/v1/rpc/planner_commit',payload,a['token']);assert status==200 and data['status']=='ok',(status,data)
        status,retry=request('/rest/v1/rpc/planner_commit',payload,a['token']);assert retry==data,'Retry must be idempotent'
        status,rows=request('/rest/v1/planner_records?select=id,body,revision',token=b['token']);assert status==200 and rows==[], 'RLS must hide another owner'
        status,_=request('/rest/v1/planner_records?select=id');assert status in (401,403),'Anonymous read must fail'
        status,_=request('/rest/v1/rpc/planner_claim_setup',{'p_token_hash':a['hash']},a['token']);assert status in (401,403,404),'Setup helpers must be administrative'
        status,_=request('/rest/v1/planner_records',{'owner_id':a['uid'],**{k:v for k,v in change.items() if k!='base_revision'}},a['token']);assert status in (401,403),'Direct writes must fail'
        body={**body,'title':'Device version 2'};change={**change,'body':body,'base_revision':1}
        status,data=request('/rest/v1/rpc/planner_commit',{'p_operation_id':str(uuid.uuid4()),'p_changes':[change]},a['token']);assert status==200 and data['rows'][0]['revision']==2,(status,data)
        stale={**change,'body':{**body,'title':'Must never overwrite'}}
        status,data=request('/rest/v1/rpc/planner_commit',{'p_operation_id':str(uuid.uuid4()),'p_changes':[stale,{**stale,'id':'must-not-exist','base_revision':0}]},a['token']);assert status==200 and data['status']=='conflict',(status,data)
        status,rows=request('/rest/v1/planner_records?select=id,body,revision',token=a['token']);assert len(rows)==1 and rows[0]['body']['title']=='Device version 2'
        invalid={**change,'id':'invalid-task','base_revision':0,'body':{**body,'duration':'30'}}
        status,_=request('/rest/v1/rpc/planner_commit',{'p_operation_id':str(uuid.uuid4()),'p_changes':[invalid]},a['token']);assert status==400,'Malformed record must fail'
        status,data=request('/rest/v1/rpc/planner_commit',{'p_operation_id':str(uuid.uuid4()),'p_changes':[{**change,'base_revision':0,'body':{**body,'title':'Other owner'}}]},b['token']);assert status==200 and data['status']=='ok'
        assistant={**change,'base_revision':2,'body':{**body,'title':'Added by assistant','source':'max','updatedAt':datetime.now(timezone.utc).isoformat()}}
        sqlfile('planner-test-assistant.sql', 'select planner_private.planner_assistant_commit('+quote(a['email'])+','+quote(str(uuid.uuid4()))+'::uuid,'+quote(json.dumps([assistant]))+'::jsonb);')
        print('PASS: activation, login, one-use links, RLS, restricted writes, idempotency, atomic conflict and validation.')
    elif step=='verify':
        a,b=state['accounts']
        status,rows=request('/rest/v1/planner_records?select=id,body,revision,updated_by',token=a['token'])
        assert status==200 and len(rows)==1 and rows[0]['body']['title']=='Added by assistant' and rows[0]['revision']==3 and rows[0]['updated_by']=='max',(status,rows)
        status,rows=request('/rest/v1/planner_records?select=body',token=b['token']);assert rows[0]['body']['title']=='Other owner'
        print('PASS: assistant update is visible through the authenticated phone API; other owner remains isolated.')
    elif step=='cleanup':
        sqlfile('planner-test-cleanup.sql', 'begin;\ndelete from auth.users where email in ('+','.join(quote(a['email']) for a in state['accounts'])+');\ndelete from planner_private.setup_links where token_hash in ('+','.join(quote(a['hash']) for a in state['accounts'])+');\ncommit;')
        print('Cleanup SQL prepared for the exact disposable accounts and hashes only.')
