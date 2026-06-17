/* Unit-test Vonk-scorer v2 */
const { scoreVonk, selectVonk } = require('./vonk_scorer.js');
const fs = require('fs');
const MSG = JSON.parse(fs.readFileSync('./vonk_messages.json','utf8'));

const profiles = {
  'Sander (analytisch onderzoeker, alles in energie)': {
    a:{I1:8,D1:2,D2:1,D3:4,D4:1,D5:'a',D6:'a',V1:2,V2:0,V3:0,V4:1,V5:1,V6:2,F1:2,F2:2,F3:'a',F4:2,F5:'a',R1:2,R2:2,R3:0,R4:0,R5:1,R6:1,B1:'puzzel'},
    e:{V1:2,V2:0,V3:-1,V4:1,V5:0,V6:2,F1:2,F2:2,F4:2,D3:2}
  },
  'Lina (sociale coach, driver in energie)': {
    a:{I1:7,D1:1,D2:4,D3:1,D4:1,D5:'b',D6:'b',V1:0,V2:2,V3:2,V4:0,V5:0,V6:0,F1:1,F2:0,F3:'b',F4:1,F5:'a',R1:0,R2:0,R3:0,R4:2,R5:1,R6:0,B1:'samen'},
    e:{V1:-1,V2:2,V3:2,V4:0,V5:0,V6:0,F1:1,F2:0,F4:1,D2:2}
  },
  'Tibo (creatieve ondernemer)': {
    a:{I1:9,D1:4,D2:1,D3:1,D4:1,D5:'a',D6:'b',V1:0,V2:0,V3:0,V4:2,V5:2,V6:1,F1:2,F2:1,F3:'a',F4:0,F5:'b',R1:1,R2:0,R3:2,R4:0,R5:2,R6:0,B1:'maken'},
    e:{V4:2,V5:2,V6:1,V1:0,V2:0,V3:0,F1:2,F2:1,F4:0,D1:1}
  },
  'Mira (sterke driver OP DE REM -> contextsignaal)': {
    a:{I1:4,D1:4,D2:1,D3:2,D4:1,D5:'a',D6:'a',V1:2,V2:0,V3:0,V4:0,V5:1,V6:1,F1:2,F2:1,F3:'a',F4:1,F5:'b',R1:1,R2:2,R3:0,R4:0,R5:0,R6:1,B1:'rustig'},
    e:{V1:2,V2:0,V3:0,V4:0,V5:1,V6:1,F1:1,F2:1,F4:0,D1:-2}  // Be Perfect sterkste EN op de rem
  },
  'Noor (onvolledig/vlak)': {
    a:{I1:5,V1:0,V2:0,F1:0,R1:0,B1:'rustig'},
    e:{V1:0,V2:0,F1:0}
  }
};

let fail = 0;
for(const [name,p] of Object.entries(profiles)){
  const s = scoreVonk(p.a, p.e);
  const sel = selectVonk(s);
  console.log('\n=== '+name+' ===');
  console.log('  versnellers rank:', s.accRank.map(k=>k+':'+s.acc[k].toFixed(1)).join(', '));
  console.log('  driver rank:', s.drvRank.map(k=>k+':'+s.drv[k]+'(e='+s.drvEnergy[k]+')').join(', '));
  console.log('  contextBrake:', s.contextBrake);
  console.log('  selectie:', JSON.stringify(sel));
  // valideer dat elke id in MSG bestaat + audio heeft
  sel.forEach(id=>{
    if(!MSG[id]){ console.log('  !!! MISSING MSG:', id); fail++; }
    else if(!MSG[id].audio){ console.log('  !!! NO AUDIO:', id); fail++; }
  });
  if(sel.length<1 || sel.length>5){ console.log('  !!! BAD LENGTH', sel.length); fail++; }
}

// Specifieke checks
const sMira = scoreVonk(profiles['Mira (sterke driver OP DE REM -> contextsignaal)'].a, profiles['Mira (sterke driver OP DE REM -> contextsignaal)'].e);
const selMira = selectVonk(sMira);
if(!sMira.contextBrake){ console.log('\n!!! Mira had GEEN contextBrake (verwacht WEL)'); fail++; }
if(!selMira.includes('context_brake')){ console.log('!!! context_brake niet in selectie Mira'); fail++; }
if(selMira[selMira.length-1] !== 'context_brake'){ console.log('!!! context_brake niet LAATSTE kaart'); fail++; }
// Mira: Be Perfect is op de rem -> mag GEEN driver_BePerfect gaspedaal-kaart hebben
if(selMira.includes('driver_BePerfect')){ console.log('!!! driver_BePerfect (gaspedaal) getoond terwijl op de rem'); fail++; }

// acc_Impact mag nergens voorkomen
for(const [name,p] of Object.entries(profiles)){
  const sel = selectVonk(scoreVonk(p.a,p.e));
  if(sel.includes('acc_Impact')){ console.log('!!! acc_Impact verschijnt nog bij', name); fail++; }
}

console.log('\n'+(fail===0 ? 'ALLE CHECKS OK' : fail+' CHECKS GEFAALD'));
