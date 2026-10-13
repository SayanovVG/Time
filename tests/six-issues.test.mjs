import test from "node:test";
import assert from "node:assert/strict";
import { freshState, normalizeState, exerciseById, exerciseGroupId, setInput, validSet, previousRows, trainingSessions, analytics, addFood } from "../app/model.mjs";
import { BANDS, BAND_LOADS } from "../app/program.mjs";
import { training, foodPicker, foodResults, progress } from "../app/view.mjs";
const row = (load, reps=12) => ({ load, reps, rir: 2, done: true });

test("past workouts stay writable without a separate edit-past toggle", () => {
  const s=freshState();
  const html=training(s,{day:1,date:"2026-01-05",focus:false,editPast:false});
  assert.match(html,/Можно записать пропущенную тренировку/);
  assert.match(html,/aria-label="Завершить:/);
  assert.doesNotMatch(html,/aria-label="Завершить:[^"]+"[^>]*disabled/);
});
test("Monday/Wednesday biceps and Tuesday/Friday calves share history without rewriting sessions", () => {
  const s=freshState();
  s.train["2026-09-07_curlband"]=[row(BANDS[0]),row(BANDS[0]),row(BANDS[0])];
  s.train["2026-09-09_wedcurl"]=[row(BANDS[0]),row(BANDS[0])];
  s.train["2026-09-08_calfA"]=[row(30),row(30),row(30)];
  s.train["2026-09-11_calfB"]=[row(30),row(30),row(30)];
  assert.equal(exerciseGroupId("wedcurl"),"curlband");
  assert.equal(previousRows(s,"2026-09-10",exerciseById("wedcurl"))[0].load,BANDS[0]);
  assert.equal(previousRows(s,"2026-09-12",exerciseById("calfB"))[0].load,30);
  const sessions=trainingSessions(s,14,"2026-09-13");
  assert.equal(sessions.filter(x=>x.id==="curlband").length,2);
  assert.equal(sessions.filter(x=>x.id==="calfA").length,2);
  assert.equal(Object.keys(s.train).length,4);
  assert.equal(analytics(s,14,"2026-09-13").trends.length,2);
});
test("two resistance bands persist and validate as equipment names, not synthetic kilograms", () => {
  const ex=exerciseById("curlband"),s=freshState();
  const pair=BANDS[1]+" + "+BANDS[3];
  assert.ok(BAND_LOADS.includes(pair));
  assert.ok(BAND_LOADS.includes(BANDS[3]+" + "+BANDS[3]));
  const r={load:"",reps:12,rir:2,done:false};
  setInput(ex,r,"load",pair);r.done=true;
  assert.equal(validSet(ex,r),true);
  s.train["2026-09-09_curlband"]=[r];
  assert.equal(normalizeState(s).train["2026-09-09_curlband"][0].load,pair);
});
test("hamstring machine accepts kg and historical band sessions still count", () => {
  const ex=exerciseById("legcurlband"),s=freshState();
  assert.equal(ex.machine,true);assert.equal(ex.band,false);
  s.train["2026-08-28_legcurlband"]=[row(BANDS[0])];
  s.train["2026-09-04_legcurlband"]=[row(20)];
  const restored=normalizeState(s);
  const history=trainingSessions(restored,20,"2026-09-05").filter(x=>x.id==="legcurlband");
  assert.deepEqual(history.map(x=>x.kind),["band","weight"]);
  const r={load:"",reps:12,rir:2,done:false};
  setInput(ex,r,"load","25");r.done=true;
  assert.equal(validSet(ex,r),true);
});
test("food enters through a single picker without products/meals tabs", () => {
  const s=freshState(),date="2026-09-10";
  addFood(s,"egg",3,date);
  const picker={date,query:"",tab:"recent",lastIds:[],added:0};
  const html=foodPicker(s,picker);
  assert.doesNotMatch(html,/data-action="food-tab"/);
  assert.match(html,/Название еды/);
  assert.match(foodResults(s,picker),/data-action="quick-food"/);
  assert.match(foodResults(s,picker),/data-action="choose-food"/);
});
test("progress offers 90 days, 365 days and all-time history", () => {
  const s=freshState();
  s.train["2026-09-01_row"]=[row(30)];
  s.train["2026-09-05_row"]=[row(35)];
  const html=progress(s,{period:36500},{snapshots:()=>[]});
  assert.match(html,/Всё/);assert.match(html,/90 дней/);assert.match(html,/365 дней/);
});
