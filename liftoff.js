// =============================================================================
// liftoff — subtiel, aanmoedigend "opstijg"-geluid bij Start (vrouw met vleugels).
//
// Volledig synthetisch via de Web Audio API: geen audiobestand, geen externe
// asset, werkt ook na publicatie. Eenmalig (one-shot), niet doorlopend.
//
// Karakter: een warme straalmotor/raket-whoosh die snel opzwelt ("stuwkracht
// pakt"), even kracht geeft, en dan zacht uitfadet omdat we "in de lucht zijn".
// Bewust discreet qua volume — bemoedigend, nooit schril of schrikwekkend.
//
// Opbouw:
//   - gefilterde bruine ruis (de luchtstroom/stuwkracht) met een lowpass die
//     opent terwijl de motor pakt en weer dichtgaat bij het wegdrijven;
//   - een lage zaagtand die een octaaf omhoog glijdt (motor spoelt op / stijgt);
//   - een korte, hoge "shimmer" sine die meeliftet voor een hoopvol tintje;
//   - envelope: snelle swell-in (~0.35s), korte top, daarna vloeiende uitfade
//     naar stilte over ~2.6s ("we zijn in de lucht").
// =============================================================================
(function(){
  // Mute-status in-memory (geen opslag-API nodig in de preview).
  function geluidUit(){
    return window.__t4teensGeluidUit === true;
  }

  function maakRuisBuffer(ctx, secs){
    var len = Math.floor(ctx.sampleRate * secs);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var data = buf.getChannelData(0);
    var last = 0;
    for (var i=0;i<len;i++){
      var white = Math.random()*2 - 1;
      // bruine ruis: zachter/warmer dan witte (geen sissen)
      last = (last + 0.02*white) / 1.02;
      data[i] = last * 3.2;
    }
    return buf;
  }

  // Eenmalige lift-off. Wordt aangeroepen vanuit een klik (gebruikersgebaar),
  // dus audio mag starten.
  function liftoff(){
    if (geluidUit()) return;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      var ctx = new AC();
      var now = ctx.currentTime;

      var DUUR = 2.6;          // totale lengte tot stilte
      var TOP_GAIN = 0.07;     // discreet pieksvolume

      // ---- Master + zachte low-pass zodat niets schel klinkt ----
      var master = ctx.createGain();
      master.gain.setValueAtTime(0.0001, now);
      var masterLp = ctx.createBiquadFilter();
      masterLp.type = "lowpass";
      masterLp.frequency.setValueAtTime(2600, now);
      masterLp.Q.setValueAtTime(0.5, now);
      master.connect(masterLp);
      masterLp.connect(ctx.destination);

      // ---- Stuwkracht: bruine ruis door een vegende band/lowpass ----
      var ruisBron = ctx.createBufferSource();
      ruisBron.buffer = maakRuisBuffer(ctx, DUUR + 0.3);
      var ruisLp = ctx.createBiquadFilter();
      ruisLp.type = "lowpass";
      // filter opent terwijl de motor pakt, sluit weer bij het wegdrijven
      ruisLp.frequency.setValueAtTime(280, now);
      ruisLp.frequency.exponentialRampToValueAtTime(1700, now + 0.45); // stuwkracht
      ruisLp.frequency.exponentialRampToValueAtTime(420, now + DUUR);  // wegdrijven
      ruisLp.Q.setValueAtTime(0.8, now);
      var ruisGain = ctx.createGain();
      ruisGain.gain.setValueAtTime(0.0001, now);
      ruisGain.gain.exponentialRampToValueAtTime(0.9, now + 0.30);     // snelle swell
      ruisGain.gain.exponentialRampToValueAtTime(0.55, now + 0.9);     // top voorbij
      ruisGain.gain.exponentialRampToValueAtTime(0.0001, now + DUUR);  // uitfade
      ruisBron.connect(ruisLp);
      ruisLp.connect(ruisGain);
      ruisGain.connect(master);
      ruisBron.start(now);

      // ---- Motor spoelt op: lage zaagtand glijdt een octaaf omhoog ----
      var motor = ctx.createOscillator();
      motor.type = "sawtooth";
      motor.frequency.setValueAtTime(70, now);
      motor.frequency.exponentialRampToValueAtTime(150, now + 0.8);    // opspoelen / stijgen
      motor.frequency.exponentialRampToValueAtTime(96, now + DUUR);    // vermindert, drijft weg
      var motorLp = ctx.createBiquadFilter();
      motorLp.type = "lowpass";
      motorLp.frequency.setValueAtTime(700, now);
      motorLp.frequency.exponentialRampToValueAtTime(1400, now + 0.5);
      motorLp.frequency.exponentialRampToValueAtTime(500, now + DUUR);
      var motorGain = ctx.createGain();
      motorGain.gain.setValueAtTime(0.0001, now);
      motorGain.gain.exponentialRampToValueAtTime(0.5, now + 0.28);
      motorGain.gain.exponentialRampToValueAtTime(0.0001, now + DUUR);
      motor.connect(motorLp);
      motorLp.connect(motorGain);
      motorGain.connect(master);
      motor.start(now);

      // ---- Hoopvolle shimmer: hoge sine die kort meeliftet en wegzweeft ----
      var shimmer = ctx.createOscillator();
      shimmer.type = "sine";
      shimmer.frequency.setValueAtTime(520, now);
      shimmer.frequency.exponentialRampToValueAtTime(880, now + 1.0);  // omhoog, optimistisch
      shimmer.frequency.exponentialRampToValueAtTime(1180, now + DUUR);// zweeft de hoogte in
      var shimmerGain = ctx.createGain();
      shimmerGain.gain.setValueAtTime(0.0001, now);
      shimmerGain.gain.exponentialRampToValueAtTime(0.12, now + 0.4);
      shimmerGain.gain.exponentialRampToValueAtTime(0.0001, now + DUUR); // vervliegt
      shimmer.connect(shimmerGain);
      shimmerGain.connect(master);
      shimmer.start(now);

      // ---- Masterenvelope: snelle swell-in, korte top, vloeiende uitfade ----
      master.gain.setValueAtTime(0.0001, now);
      master.gain.exponentialRampToValueAtTime(TOP_GAIN, now + 0.35);  // we stijgen op
      master.gain.exponentialRampToValueAtTime(TOP_GAIN * 0.6, now + 1.0);
      master.gain.exponentialRampToValueAtTime(0.0001, now + DUUR);    // in de lucht -> zacht stil

      // Netjes afbreken na de uitfade.
      var stoppen = [ruisBron, motor, shimmer];
      window.setTimeout(function(){
        stoppen.forEach(function(n){ try { n.stop(); } catch(e){} });
        try { ctx.close(); } catch(e){}
      }, (DUUR + 0.25) * 1000);
    } catch(e){ /* stil falen — geluid is nice-to-have */ }
  }

  window.t4teensLiftoff = liftoff;
})();
