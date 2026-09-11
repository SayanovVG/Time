import test from 'node:test';
import assert from 'node:assert/strict';
import { blankTask, validateBody, validDay, nextRepeat, parseQuick, completionChanges, tasksOf, weekDays, monthGrid } from '../lib/model.ts';
import { emptyState, stage, prepareBatch, acknowledge, mergeRemote, resolveConflict, backup, readBackup } from '../lib/sync-state.ts';

const now='2026-09-11T13:00:00.000Z';
const task=(patch={})=>({...blankTask(),title:'Тестовая задача',createdAt:now,updatedAt:now,...patch});
const row=(id='task-a',body=task(),revision=1)=>({id,kind:'task',body,revision,deleted:false,updated_at:now,updated_by:'device'});
const change=(id='task-a',body=task())=>({id,kind:'task',body});

test('Russian quick capture has explicit date, time, priority and project',()=>{
  const result=parseQuick('Позвонить поставщику завтра в 16:00 !3 #Бизнес #звонок',null,'2026-09-11');
  assert.equal(result.task.title,'Позвонить поставщику');
  assert.equal(result.task.date,'2026-09-12'); assert.equal(result.task.time,'16:00');
  assert.equal(result.task.priority,3);assert.equal(result.task.project,'business');
  assert.deepEqual(result.task.tags,['звонок']);validateBody('task',result.task);
  assert.throws(()=>parseQuick('Дело 31.02.2026',null,'2026-09-11'));
  assert.equal(parseQuick('Сдать отчёт p1',null,'2026-09-11').task.priority,3);
});
test('Calendar uses local days, real leap days and Monday weeks',()=>{
  assert.equal(validDay('2024-02-29'),true);assert.equal(validDay('2026-02-29'),false);
  assert.equal(validDay('2199-12-31'),true);assert.equal(validDay('2200-01-01'),false);
  assert.deepEqual(weekDays('2026-09-13'),['2026-09-07','2026-09-08','2026-09-09','2026-09-10','2026-09-11','2026-09-12','2026-09-13']);
  assert.equal(monthGrid('2026-08-01').length,42);
});
test('Monthly and leap-year repeats preserve their original day',()=>{
  const monthly=task({date:'2026-01-31',repeat:{frequency:'monthly',interval:1,anchorDay:31,until:null}});
  assert.equal(nextRepeat(monthly,'2026-01-31'),'2026-02-28');
  assert.equal(nextRepeat({...monthly,date:'2026-02-28'},'2026-02-28'),'2026-03-31');
  const yearly=task({date:'2024-02-29',repeat:{frequency:'yearly',interval:1,anchorDay:29,until:null}});
  assert.equal(nextRepeat(yearly,'2027-02-28'),'2028-02-29');
});
test('Missed repeats skip to the next planned occurrence without creating completed history',()=>{
  const body=task({date:'2026-09-07',repeat:{frequency:'daily',interval:1,anchorDay:7,until:null}});
  const initial=row('old',body);const changes=completionChanges(initial,[initial],true,'2026-09-11',now);
  assert.equal(changes.length,2);assert.equal(changes[0].body.status,'done');
  assert.equal(changes[1].body.date,'2026-09-12');assert.equal(changes[1].body.status,'todo');
  assert.equal(changes[1].body.repeatParent,'old');
  assert.equal(nextRepeat({...body,repeat:{...body.repeat,frequency:'weekdays'}},'2026-09-11'),'2026-09-14');
  assert.equal(nextRepeat({...body,repeat:{...body.repeat,until:'2026-09-11'}},'2026-09-11'),null);
});
test('Completing and undoing a repeat is atomic and protects edited future work',()=>{
  const initial=row('repeat-a',task({date:'2026-09-11',repeat:{frequency:'daily',interval:1,anchorDay:11,until:null}}));
  const completed=stage({...emptyState(),rows:[initial]},completionChanges(initial,[initial],true,'2026-09-11',now),true,now);
  const [parent,child]=tasksOf(completed.rows);assert.equal(completionChanges(parent,completed.rows,true).length,0);
  const undone=stage(completed,completionChanges(parent,completed.rows,false,'2026-09-11',now),true,now);
  assert.equal(tasksOf(undone.rows).length,1);assert.equal(tasksOf(undone.rows)[0].body.status,'todo');
  const edited=completed.rows.map(r=>r.id===child.id?{...r,body:{...r.body,title:'Уже изменено',updatedAt:'2026-09-11T13:01:00.000Z'}}:r);
  assert.throws(()=>completionChanges(parent,edited,false,'2026-09-11',now));
});
test('Offline batch survives retries and keeps edits made while a request is in flight',()=>{
  const first=prepareBatch(stage(emptyState(),[change()],true,now));
  assert.deepEqual(prepareBatch(first),first);
  const edited=stage(first,[change('task-a',task({title:'Более новая версия'}))],true,now);
  assert.equal(edited.pending['task-a'].baseRevision,0);
  const acknowledged=acknowledge(edited,first.inFlight.operationId,{status:'ok',rows:[row()]});
  assert.equal(acknowledged.rows[0].body.title,'Более новая версия');
  assert.equal(acknowledged.pending['task-a'].baseRevision,1);
  const second=prepareBatch(acknowledged);assert.notEqual(second.inFlight.operationId,first.inFlight.operationId);
  const done=acknowledge(second,second.inFlight.operationId,{status:'ok',rows:[row('task-a',task({title:'Более новая версия'}),2)]});
  assert.equal(Object.keys(done.pending).length,0);assert.equal(done.rows[0].revision,2);
});
test('Remote updates cannot overwrite local pending edits; conflicts keep both versions',()=>{
  const base={...emptyState(),rows:[row()]};
  const sent=prepareBatch(stage(base,[change('task-a',task({title:'С телефона'}))],true,now));
  const server=row('task-a',task({title:'Из чата'}),2);
  assert.equal(mergeRemote(sent,[server]).rows[0].body.title,'С телефона');
  const conflict=acknowledge(sent,sent.inFlight.operationId,{status:'conflict',rows:[server]});
  assert.equal(conflict.conflicts['task-a'].remote.body.title,'Из чата');
  assert.equal(prepareBatch(conflict).inFlight,null);
  assert.equal(resolveConflict(conflict,'task-a','local').pending['task-a'].baseRevision,2);
  const remote=resolveConflict(conflict,'task-a','remote');
  assert.equal(remote.rows[0].body.title,'Из чата');assert.equal(Object.keys(remote.pending).length,0);
});
test('An incomplete server acknowledgement does not discard the outbox',()=>{
  const state=prepareBatch(stage(emptyState(),[change()],true,now));
  assert.throws(()=>acknowledge(state,state.inFlight.operationId,{status:'ok',rows:[]}));
  assert.equal(Object.keys(state.pending).length,1);
});
test('Invalid records and backup imports fail as a whole',()=>{
  const state=emptyState();assert.throws(()=>stage(state,[change(),change('invalid',task({title:''}))],true));
  assert.equal(state.rows.length,0);
  const saved=stage(state,[change()],false,now);const copy=backup(saved);
  assert.equal(readBackup(copy)[0].body.title,'Тестовая задача');
  assert.equal(copy.includes('pending'),false);assert.equal(copy.includes('password'),false);
  const duplicate=JSON.parse(copy);duplicate.records.push(duplicate.records[0]);
  assert.throws(()=>readBackup(JSON.stringify(duplicate)));
  assert.throws(()=>validateBody('task',task({date:'2026-09-11',time:'23:50',duration:30})));
});
