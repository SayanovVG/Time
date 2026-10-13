import test from "node:test";
import assert from "node:assert/strict";
import { freshState, normalizeState, suspiciousRepetitions, report, exerciseById, exerciseGroupId, setInput, validSet, previousRows, trainingSessions, analytics, addFood } from "../app/model.mjs";
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

test("band selector stays compact: four colors and optional second color, not ten long combinations", () => {
  const s=freshState();
  const ex=exerciseById("curlband");
  s.train["2026-09-07_curlband"]=[
    {load:BANDS[1]+" + "+BANDS[3],reps:12,rir:2,done:true},
    {load:BANDS[3],reps:10,rir:2,done:true},
    {load:"",reps:"",rir:2,done:false},
  ];
  const html=training(s,{day:1,date:"2026-09-07",focus:false});
  assert.match(html,/data-action="band-open"/);
  assert.match(html,/class="band-picker-trigger"/);
  assert.match(html,/band-dot--black/);
  assert.match(html,/band-dot--green/);
  assert.doesNotMatch(html,/data-field="band-primary"|data-action="band-add"/);
  assert.match(html,/Зелёная/);
  assert.doesNotMatch(html,/>Зелёная \+ Чёрная · две резинки/);
  assert.equal(validSet(ex,s.train["2026-09-07_curlband"][0]),true);
});

test("machine versus old band has separate comparable type and no misleading percentage", () => {
  const s=freshState();
  s.train["2026-09-03_legcurlband"]=[row(BANDS[0]),row(BANDS[0]),row(BANDS[0])];
  s.train["2026-09-10_legcurlband"]=[row(25),row(25),row(25)];
  const t=analytics(s,14,"2026-09-10").trends.find(x=>x.id==="legcurlband");
  assert.equal(t.status,"equipment");
  assert.equal(t.pct,null);
  assert.equal(t.badge,"Смена");
  const html=progress(s,{period:90},{snapshots:()=>[]});
  assert.match(html,/Смена оборудования/);
  assert.match(html,/резинка → тренажёр/);
});

test("implausible old repetitions are retained but cannot create a false training progress percentage", () => {
  const s = freshState();
  const original = [row(BANDS[3],113),row(BANDS[3],113)];
  s.train["2026-10-07_wedcurl"] = original;
  s.train["2026-10-12_curlband"] = [row(BANDS[3],14),row(BANDS[3],14),row(BANDS[3],14)];
  const previous = trainingSessions(s,28,"2026-10-13").find((r) => r.date === "2026-10-07" && r.id === "curlband");
  const t = analytics(s,28,"2026-10-13").trends.find((r) => r.id === "curlband");
  assert.equal(previous.suspicious,true);
  assert.deepEqual(previous.suspiciousSets,[{index:1,reps:113},{index:2,reps:113}]);
  assert.equal(t.status,"review");
  assert.equal(t.pct,null);
  assert.match(t.reason,/113/);
  assert.equal(s.train["2026-10-07_wedcurl"][0].reps,113);
  const html = progress(s,{period:28},{snapshots:()=>[]});
  assert.match(html,/Проверить запись/);
  assert.match(html,/data-action="repair-workout"/);
  assert.match(html,/data-date="2026-10-07"/);
  const workout = training(s,{day:1,date:"2026-10-12",focus:false});
  assert.match(workout,/Проверь старую запись/);
  const text = report(s,28,"2026-10-13");
  assert.match(text,/Проверить запись/);
  assert.doesNotMatch(text,/226.*%/);
});

test("suspect thresholds do not confuse timed exercises with strength reps", () => {
  assert.equal(suspiciousRepetitions(exerciseById("plank"),180),false);
  assert.equal(suspiciousRepetitions(exerciseById("legcurlband"),210),true);
  assert.equal(suspiciousRepetitions(exerciseById("hammer"),112),true);
  assert.equal(suspiciousRepetitions(exerciseById("bench"),14),false);
  const s=freshState();
  s.train["2026-10-02_legcurlband"]=[row(BANDS[1],210),row(BANDS[1],210),row(BANDS[1],210)];
  s.train["2026-10-09_legcurlband"]=[row(BANDS[1],212),row(BANDS[1],212),row(BANDS[1],212)];
  const t=analytics(s,28,"2026-10-13").trends.find((x)=>x.id==="legcurlband");
  assert.equal(t.status,"review");
  assert.equal(t.pct,null);
  const before=JSON.stringify(s.train);
  normalizeState(s);
  assert.equal(JSON.stringify(s.train),before);
});
