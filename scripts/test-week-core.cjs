'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const core=require('../lfa-week-core.js');
const d=v=>new Date(v);
assert.equal(new Date(core.weekOneTuesday(2026)).toISOString().slice(0,10),'2026-09-08');
assert.equal(new Date(core.weekOneTuesday(2027)).toISOString().slice(0,10),'2027-09-07');
const cases=[
 ['2026-09-08T02:59:59.000Z',1],  // Lunes 23:59, Argentina
 ['2026-09-08T03:00:00.000Z',1],
 ['2026-11-10T02:59:59.000Z',9],  // Lunes: continúa la 9
 ['2026-11-10T03:00:00.000Z',10], // Martes: empieza la 10
 ['2026-11-11T14:56:00.000Z',10],
 ['2026-11-17T02:59:59.000Z',10],
 ['2026-11-17T03:00:00.000Z',11],
 ['2027-01-06T16:00:00.000Z',18]
];
for(const [iso,expected] of cases){
 assert.equal(core.calendarWeek(2026,d(iso)),expected,'Semana para '+iso);
 assert.equal(core.resolveWeek({season:2026,status:'in_season',nflWeek:9,seasonType:'regular'},d(iso)),expected,'Sleeper no debe atrasar la semana '+iso);
}
assert.equal(core.resolveWeek({season:2027,status:'pre_draft'},d('2027-11-09T14:00:00Z')),1);
assert.equal(core.calendarWeek(2027,d('2027-09-14T03:00:00Z')),2);
const html=fs.readFileSync('index.html','utf8');
assert.ok(html.indexOf('src="lfa-week-core.js"')<html.indexOf('src="app.js"'),'La semana se carga antes que la aplicación');
const app=fs.readFileSync('app.js','utf8');
assert.ok(app.includes('currentWeek:computedWeek(snap.league,snap.nfl)'),'El respaldo también debe corregirse');
assert.ok(app.includes('wasViewingCurrent&&week!==old.currentWeek'),'La vista debe avanzar al pasar de fecha');
const v6=fs.readFileSync('lfa-v6.js','utf8');
assert.ok(v6.includes('Number(live.selectedWeek||live.currentWeek||1)+1'),'Próxima fecha debe avanzar desde la selección');
console.log('OK: calendario argentino, martes 00:00, semana 10, selector y próximo partido sin saltos.');
