/* T4Teens — Vonk-scorer (client-side, lichte spiegel van t4teens-scoring.ts)
   Leidt uit answers/energy de max. 5 'bijzondere dingen' af. Deterministisch.
   v2 (16/06/2026): 5 versnellers (Impact opgenomen in 'groepsondersteunend met impact'),
   driver-energie centraal (gaspedaal vs rem), contextsignaal bij rem op driver #1/#2. */

// item -> construct mapping (vast, uit scoringslogica)
// V4 (oud 'Impact') wordt nu OPGETELD bij Facilitatie = 'groepsondersteunend met impact'.
const ACC_MAP = { V1:'Analyse', V2:'Coaching', V3:'Facilitatie', V4:'Facilitatie', V5:'Resultaat', V6:'Constructief onderscheidend' };
const FOC_MAP = { F1:'Bedenken/creatie', F2:'Uitzoeken/onderzoek', F4:'Leren/overdragen' }; // F3/F5 via SJT
const RIA_MAP = { R1:'Realistisch', R2:'Investigative', R3:'Artistiek', R4:'Sociaal', R5:'Ondernemend', R6:'Conventioneel' };

function energyContrib(e){ return (typeof e === 'number') ? e/2 : 0; } // -2..+2 -> -1..+1

function scoreVonk(answers, energy){
  // ---- versnellers (5 categorieen; Impact opgenomen in Facilitatie)
  const acc = { 'Analyse':0,'Coaching':0,'Facilitatie':0,'Resultaat':0,'Constructief onderscheidend':0 };
  const accEnergy = {};
  for(const id in ACC_MAP){
    const c = ACC_MAP[id];
    if(id in answers){ acc[c] += answers[id] + energyContrib(energy[id]); }
    if(id in energy){
      // bij Facilitatie kunnen V3 en V4 beide energie aanleveren -> gemiddelde houden we simpel: laatste/gecombineerd
      accEnergy[c] = (c in accEnergy) ? (accEnergy[c] + energy[id]) / 2 : energy[id];
    }
  }
  // SJT-bijladingen op versnellers
  if(answers.D5 === 'b'){ acc['Coaching'] += 1; }
  if(answers.F5 === 'a'){ acc['Coaching'] += 1; acc['Facilitatie'] += 1; } // F5 samen
  const accRank = Object.keys(acc).sort((a,b)=>acc[b]-acc[a]);

  // ---- foci
  const foc = { 'Bedenken/creatie':0,'Uitzoeken/onderzoek':0,'Doen/uitvoeren':0,'Leren/overdragen':0,'Samenwerken':0 };
  const focEnergy = {};
  for(const id in FOC_MAP){
    const c = FOC_MAP[id];
    if(id in answers){ foc[c] += answers[id] + energyContrib(energy[id]); }
    if(id in energy) focEnergy[c] = energy[id];
  }
  if(answers.F3 === 'a'){ foc['Doen/uitvoeren'] += 2 + energyContrib(energy.F3); if('F3' in energy) focEnergy['Doen/uitvoeren']=energy.F3; }
  else if(answers.F3 === 'b'){ foc['Doen/uitvoeren'] -= 1; focEnergy['Doen/uitvoeren']=-1; }
  if(answers.F5 === 'a'){ foc['Samenwerken'] += 2; }
  if(answers.D5 === 'b'){ foc['Samenwerken'] += 1; }
  const focRank = Object.keys(foc).sort((a,b)=>foc[b]-foc[a]);

  // ---- interesse
  const ria = {};
  for(const id in RIA_MAP){ if(id in answers) ria[RIA_MAP[id]] = answers[id]; else ria[RIA_MAP[id]] = 0; }
  const riaRank = Object.keys(ria).sort((a,b)=>ria[b]-ria[a]);

  // ---- drivers (sterkte + energie). Energie bepaalt gaspedaal (>0) vs rem (<0).
  const drv = { 'Be Perfect':0,'Please Others':0,'Try Hard':0,'Hurry Up':0,'Be Strong':0 };
  const drvEnergy = { 'Be Perfect':null,'Please Others':null,'Try Hard':null,'Hurry Up':null,'Be Strong':null };
  // sterkte
  if('D1' in answers) drv['Be Perfect'] += answers.D1;
  if('D2' in answers) drv['Please Others'] += answers.D2;
  if('D3' in answers) drv['Try Hard'] += answers.D3;
  if('D4' in answers) drv['Hurry Up'] += answers.D4;
  if(answers.D5 === 'a') drv['Be Strong'] += 2;
  if(answers.D5 === 'b') drv['Please Others'] += 2;
  if(answers.D6 === 'a') drv['Be Strong'] += 2;
  if(answers.D6 === 'b') drv['Hurry Up'] += 2;
  // energie per driver (uit de bijbehorende energie-items, indien aanwezig)
  const setDrvE = (cat, e)=>{ if(typeof e==='number'){ drvEnergy[cat] = (drvEnergy[cat]===null) ? e : (drvEnergy[cat]+e)/2; } };
  setDrvE('Be Perfect',   energy.D1);
  setDrvE('Please Others',energy.D2);
  setDrvE('Try Hard',     energy.D3);
  setDrvE('Hurry Up',     energy.D4);
  // D5/D6 zijn keuze-items; eventuele energie-ankers meenemen indien meegegeven
  if(answers.D5 === 'a') setDrvE('Be Strong', energy.D5);
  if(answers.D5 === 'b') setDrvE('Please Others', energy.D5);
  if(answers.D6 === 'a') setDrvE('Be Strong', energy.D6);
  if(answers.D6 === 'b') setDrvE('Hurry Up', energy.D6);
  const drvRank = Object.keys(drv).sort((a,b)=>drv[b]-drv[a]);

  // ---- contextsignaal: rem op driver #1 of #2 (energie < 0 bij een dominante driver)
  const drvDriverKey = {'Try Hard':'driver_TryHard','Be Strong':'driver_BeStrong','Be Perfect':'driver_BePerfect','Please Others':'driver_PleaseOthers','Hurry Up':'driver_HurryUp'};
  let contextBrake = false;
  for(let i=0;i<2;i++){
    const d = drvRank[i];
    if(d && drv[d] >= 3 && typeof drvEnergy[d] === 'number' && drvEnergy[d] < 0){ contextBrake = true; }
  }

  // ---- energie-ijkpunt
  const battery = (typeof answers.I1 === 'number') ? answers.I1 : null;

  // ---- volledigheid
  const answered = Object.keys(answers).length;

  return { acc, accEnergy, accRank, foc, focEnergy, focRank, ria, riaRank,
           drv, drvEnergy, drvRank, drvDriverKey, contextBrake,
           battery, answered, answers, energy };
}

/* selectie: max 5 boodschap-ids op sterkte, met drempels.
   Drivers worden ALLEEN als gaspedaal-kaart getoond (energie >= 0).
   Bij contextBrake komt onderaan een warme contextsignaal-kaart i.p.v. een driver-kaart. */
function selectVonk(s){
  const picks = [];
  const used = new Set();
  const push = (id, prio, strength) => { if(!used.has(id)){ picks.push({id, prio, strength}); used.add(id); } };

  // 1. Topversneller
  const acc1 = s.accRank[0];
  if(s.acc[acc1] >= 2.5){ push('acc_'+acc1, 1, s.acc[acc1]); }

  // 2. Top-focus met energie
  const focMap = {
    'Bedenken/creatie':'focus_Bedenken/creatie','Uitzoeken/onderzoek':'focus_Uitzoeken/onderzoek',
    'Doen/uitvoeren':'focus_Doen/uitvoeren','Leren/overdragen':'focus_Leren/overdragen','Samenwerken':'focus_Samenwerken'
  };
  const foc1 = s.focRank[0];
  if(s.foc[foc1] >= 2.5){ push(focMap[foc1], 2, s.foc[foc1]); }

  // 3. Sterke interesse (RIASEC #1)
  const ria1 = s.riaRank[0];
  if(s.ria[ria1] >= 2){ push('int_'+ria1, 3, 2 + (s.ria[s.riaRank[1]]===2?0.3:0)); }

  // 4. Driver ALS GASPEDAAL (top-driver, sterkte >= 3, energie >= 0).
  //    Als de top-driver een rem is, tonen we hier GEEN gaspedaal-kaart.
  const drv1 = s.drvRank[0];
  if(s.drv[drv1] >= 3){
    const e1 = s.drvEnergy[drv1];
    if(e1 === null || e1 >= 0){ push(s.drvDriverKey[drv1], 4, s.drv[drv1]); }
  }

  // 5. Volle batterij
  if(s.battery !== null && s.battery >= 7){ push('energy_full', 5, s.battery); }

  // 6. tweede versneller of focus (opvulling)
  const acc2 = s.accRank[1];
  if(s.acc[acc2] >= 2.5){ push('acc_'+acc2, 6, s.acc[acc2]); }
  const ria2 = s.riaRank[1];
  if(s.ria[ria2] >= 2){ push('int_'+ria2, 7, 2); }
  const foc2 = s.focRank[1];
  if(s.foc[foc2] >= 2.0){ push(focMap[foc2], 8, s.foc[foc2]); }

  // 7. betekenisspoor (B1)
  if('B1' in s.answers){ push('meaning', 9, 1); }

  // Sorteer op prio, dan sterkte
  picks.sort((a,b)=> a.prio - b.prio || b.strength - a.strength);
  let chosen = picks.slice(0,5).map(p=>p.id);

  // Te dun? minstens iets tonen + groei-boodschap
  if(chosen.length < 2){
    if(!chosen.includes('meaning') && 'B1' in s.answers) chosen.push('meaning');
    chosen.push('growth_thin');
  }

  // 'meaning' liefst als voorlaatste; contextsignaal (indien rem op #1/#2) ALTIJD als laatste, warme kaart.
  chosen = chosen.filter(c=>c!=='meaning' && c!=='context_brake');
  if(chosen.includes('meaning') === false && false){} // (no-op, leesbaarheid)
  const tail = [];
  // meaning toevoegen als hij eerder gekozen was
  if(used.has('meaning')) tail.push('meaning');

  // Contextsignaal: vervangt zo nodig de laatste plek zodat het ALTIJD meekomt.
  if(s.contextBrake){
    // zorg dat er ruimte is: max 5 totaal, contextsignaal laatst
    chosen = chosen.concat(tail);
    if(chosen.length >= 5) chosen = chosen.slice(0,4);
    chosen.push('context_brake');
    return chosen.slice(0,5);
  }

  chosen = chosen.concat(tail);
  return chosen.slice(0,5);
}

if(typeof module !== 'undefined'){ module.exports = { scoreVonk, selectVonk, ACC_MAP, FOC_MAP, RIA_MAP }; }
