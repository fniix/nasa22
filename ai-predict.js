// AI Predictions — KOI-ready explorer
(function(){
  const $ = (s)=>document.querySelector(s);
  const $$ = (s)=>[...document.querySelectorAll(s)];
  function n(x){ if(x==null||x==="") return null; const v = Number(String(x).replace(",", ".")); return Number.isFinite(v)?v:null; }
  function key(o, names){
    const map={};
    Object.keys(o).forEach(k=> map[k.trim().toLowerCase()] = o[k]);
    for(const nm of names){ const k = nm.toLowerCase(); if(map[k]!=null && map[k]!=="") return map[k]; }
    return null;
  }

  function parseRow(r){
    const name = key(r, ["name","planet","pl_name","koi_name","kepler_name","kepoi_name","kepid"]);
    const label = key(r, ["predicted_label","label","class"]) || "Other";
    const trueLabel = key(r, ["true_label"]);
    const period = n(key(r, ["koi_period","period_days","pl_orbper"]));
    const t0 = n(key(r, ["koi_time0bk"]));
    const duration = n(key(r, ["koi_duration"]));
    const insol = n(key(r, ["koi_insol"]));
    const ra = n(key(r, ["ra"]));
    const dec = n(key(r, ["dec"]));
    const rstar = n(key(r, ["koi_srad","st_rad"]));
    const impact = n(key(r, ["koi_impact"]));
    const depth = n(key(r, ["koi_depth"]));
    const radius = n(key(r, ["koi_prad","pl_rade"]));
    const snr = n(key(r, ["koi_model_snr"]));
    return { name, label, trueLabel, period, t0, duration, insol, ra, dec, rstar, impact, depth, radius, snr };
  }

  function summarize(rows){
    return { total: rows.length, avgProb: 0, high: 0 };
  }
  function renderKPIs(s){
    document.getElementById("p_total").textContent = s.total;
    document.getElementById("p_avg").textContent = s.avgProb.toFixed(2);
    document.getElementById("p_high").textContent = s.high;
  }

  function groupByLabel(rows){
    const g = {}; rows.forEach(r=> (g[r.label] ||= []).push(r)); return g;
  }

  function scatterDurDepth(rows){
    const clean = rows.filter(r => Number.isFinite(r.duration) && Number.isFinite(r.depth) && r.depth>0);
    const groups = groupByLabel(clean);
    const traces = Object.entries(groups).map(([lab,arr])=>({
      type:'scatter', mode:'markers', name:lab,
      x:arr.map(r=>r.duration), y:arr.map(r=>r.depth),
      text:arr.map(r=> r.name || ""), hovertemplate:'<b>%{text}</b><br>Duration: %{x:.2f} hr<br>Depth: %{y:.2f} ppm (log)<extra></extra>',
      marker:{ size:8, opacity:.85 }
    }));
    const layout = {
      paper_bgcolor:'rgba(0,0,0,0)', plot_bgcolor:'rgba(0,0,0,0)',
      margin:{l:70,r:20,b:60,t:10},
      xaxis:{ title:'Transit duration (hours)', color:'#cdd3ff', gridcolor:'#2f365f' },
      yaxis:{ title:'Transit depth (ppm)', type:'log', color:'#cdd3ff', gridcolor:'#2f365f' },
      legend:{ bgcolor:'rgba(0,0,0,0)' }
    };
    Plotly.react('predPlot', traces, layout, {displayModeBar:false});
  }

  function scatterRadSNR(rows){
    const clean = rows.filter(r => Number.isFinite(r.radius) && Number.isFinite(r.snr) && r.snr>0);
    const groups = groupByLabel(clean);
    const traces = Object.entries(groups).map(([lab,arr])=>({
      type:'scatter', mode:'markers', name:lab,
      x:arr.map(r=>r.radius), y:arr.map(r=>r.snr),
      text:arr.map(r=> r.name || ""), hovertemplate:'<b>%{text}</b><br>Radius: %{x:.2f} R⊕<br>Model SNR: %{y:.2f} (log)<extra></extra>',
      marker:{ size:8, opacity:.85 }
    }));
    const layout = {
      paper_bgcolor:'rgba(0,0,0,0)', plot_bgcolor:'rgba(0,0,0,0)',
      margin:{l:70,r:20,b:60,t:10},
      xaxis:{ title:'Radius (R⊕)', color:'#cdd3ff', gridcolor:'#2f365f' },
      yaxis:{ title:'Model SNR', type:'log', color:'#cdd3ff', gridcolor:'#2f365f' },
      legend:{ bgcolor:'rgba(0,0,0,0)' }
    };
    Plotly.react('predPlot', traces, layout, {displayModeBar:false});
  }

  function snrHistogram(rows){
    const clean = rows.filter(r => Number.isFinite(r.snr));
    const groups = groupByLabel(clean);
    const traces = Object.entries(groups).map(([lab,arr])=>({
      type:'histogram', name:lab, x:arr.map(r=>r.snr), opacity:.7, nbinsx: 40, bingroup:1
    }));
    const layout = {
      barmode:'overlay',
      paper_bgcolor:'rgba(0,0,0,0)', plot_bgcolor:'rgba(0,0,0,0)',
      margin:{l:70,r:20,b:60,t:10},
      xaxis:{ title:'Model SNR', color:'#cdd3ff', gridcolor:'#2f365f' },
      yaxis:{ title:'Count', color:'#cdd3ff', gridcolor:'#2f365f' },
      legend:{ bgcolor:'rgba(0,0,0,0)' }
    };
    Plotly.react('predPlot', traces, layout, {displayModeBar:false});
  }

  function depthBoxplot(rows){
    const clean = rows.filter(r => Number.isFinite(r.depth) && r.depth>0);
    const labels = [...new Set(clean.map(r=>r.label))];
    const traces = labels.map(lab => ({
      type:'box', name:lab, y: clean.filter(r=>r.label===lab).map(r=>r.depth), boxpoints:false
    }));
    const layout = {
      paper_bgcolor:'rgba(0,0,0,0)', plot_bgcolor:'rgba(0,0,0,0)',
      margin:{l:70,r:20,b:60,t:10},
      yaxis:{ title:'Transit depth (ppm)', type:'log', color:'#cdd3ff', gridcolor:'#2f365f' },
      legend:{ bgcolor:'rgba(0,0,0,0)' }
    };
    Plotly.react('predPlot', traces, layout, {displayModeBar:false});
  }

  function drawExplorer(rows){
    const sel = $('#chartSelect');
    const choice = sel ? sel.value : 'dur_depth';
    if(choice === 'dur_depth') return scatterDurDepth(rows);
    if(choice === 'rad_snr') return scatterRadSNR(rows);
    if(choice === 'snr_hist') return snrHistogram(rows);
    if(choice === 'depth_box') return depthBoxplot(rows);
  }

  // --- ANOVA F-score signals for categorical target ---
  function mean(a){ return a.reduce((s,x)=>s+x,0)/a.length; }
  function anovaF(rows, keyName, targetKey){
    const buckets = {};
    rows.forEach(r => {
      const y = (r[targetKey] ?? "Other").toString();
      const xRaw = r[keyName];
      const x = Number(String(xRaw).replace(",", "."));
      if(!Number.isFinite(x)) return;
      (buckets[y] ||= []).push(x);
    });
    const classes = Object.keys(buckets);
    if(classes.length < 2) return {score:0, n:0};
    const all = classes.flatMap(c=>buckets[c]);
    if(all.length < 10) return {score:0, n:all.length};
    const grand = mean(all);
    let ssb=0, ssw=0, dfb=classes.length-1, dfw=all.length-classes.length;
    classes.forEach(c=>{
      const a=buckets[c], m=mean(a);
      ssb += a.length * (m-grand)*(m-grand);
      ssw += a.reduce((s,x)=> s+(x-m)*(x-m), 0);
    });
    const msb = ssb/Math.max(dfb,1);
    const msw = ssw/Math.max(dfw,1);
    const F = msw===0?0:(msb/msw);
    return {score:F, n:all.length};
  }

  function computeSignalsCategorical(rows, targetKey){
    const numericKeys = ["koi_period","koi_time0bk","koi_duration","koi_insol","ra","dec","koi_srad","koi_impact","koi_depth","koi_prad","koi_model_snr"];
    const results = [];
    numericKeys.forEach(k=>{
      const {score, n} = anovaF(rows, k, targetKey);
      if(n>=10) results.push({ key:k, score, n });
    });
    results.sort((a,b)=> b.score - a.score);
    return results;
  }

  function drawFeaturePlot(signals){
    const labels = signals.map(s=> s.key);
    const scores = signals.map(s=> Number(s.score.toFixed(3)));
    const text = signals.map(s=> `F=${s.score.toFixed(2)} • n=${s.n}`);
    const trace = { type:'bar', x:scores, y:labels, orientation:'h', text, textposition:'auto' };
    const layout = {
      paper_bgcolor:'rgba(0,0,0,0)', plot_bgcolor:'rgba(0,0,0,0)',
      margin:{l:160,r:20,b:40,t:10},
      xaxis:{ title:'ANOVA F-score', color:'#cdd3ff', gridcolor:'#2f365f' },
      yaxis:{ automargin:true, color:'#cdd3ff' }
    };
    Plotly.react('featurePlot', [trace], layout, {displayModeBar:false});
  }

  function preview(rows){
    const cols = ["name","label","trueLabel","duration","depth","radius","snr"];
    const top = rows.slice(0,20);
    const th = '<tr>'+cols.map(c=>`<th>${c.toUpperCase()}</th>`).join('')+'</tr>';
    const tr = top.map(r=> '<tr>'+cols.map(c=> `<td>${(r[c]??"")}</td>`).join('') + '</tr>').join('');
    document.getElementById("preview").innerHTML = `<table>${th}${tr}</table>`;
  }

  function loadCSVText(text){
    const parsed = Papa.parse(text, { header:true, dynamicTyping:false, skipEmptyLines:true });
    const origRows = parsed.data;
    const rows = origRows.map(parseRow);
    window.AI_PRED_ORG_ROWS = origRows;
    window.AI_PRED_ROWS = rows;

    renderKPIs(summarize(rows));
    drawExplorer(rows);
    preview(rows);
    const target = (document.getElementById('targetSelect')?.value) || 'predicted_label';
    const sigs = computeSignalsCategorical(origRows, target);
    drawFeaturePlot(sigs);
  }

  function attach(){
    const dz = document.querySelector(".dropzone");
    const inp = document.getElementById("predFile");
    const status = document.querySelector(".status");
    dz.addEventListener('dragover', e=>{e.preventDefault(); dz.classList.add('dragover');});
    dz.addEventListener('dragleave', ()=>dz.classList.remove('dragover'));
    dz.addEventListener('drop', e=>{
      e.preventDefault(); dz.classList.remove('dragover');
      const f = e.dataTransfer.files?.[0]; if(!f) return;
      status.textContent = "Parsing…";
      f.text().then(loadCSVText).then(()=> status.textContent = "Loaded ✅").catch(err=> status.textContent = "Failed: "+err.message);
    });
    inp.addEventListener('change', ()=>{
      const f = inp.files?.[0]; if(!f) return;
      status.textContent = "Parsing…";
      f.text().then(loadCSVText).then(()=> status.textContent = "Loaded ✅").catch(err=> status.textContent = "Failed: "+err.message);
    });
    const sel = document.getElementById('chartSelect');
    if(sel){ sel.addEventListener('change', ()=> window.AI_PRED_ROWS && drawExplorer(window.AI_PRED_ROWS)); }
    const btn = document.getElementById('recompute');
    const targetSel = document.getElementById('targetSelect');
    if(btn && targetSel){
      btn.addEventListener('click', ()=>{
        if(!window.AI_PRED_ORG_ROWS) return;
        const sigs = computeSignalsCategorical(window.AI_PRED_ORG_ROWS, targetSel.value);
        drawFeaturePlot(sigs);
      });
    }
    const btnSample = document.getElementById("loadSample");
    if(btnSample){
      btnSample.addEventListener('click', async ()=>{
        try{
          const res = await fetch('kepler_predictions.csv');
          const text = await res.text();
          loadCSVText(text);
          status.textContent = "Loaded sample ✅";
        }catch(e){ status.textContent = "Could not load sample."; }
      });
    }
  }

  document.addEventListener('DOMContentLoaded', attach);
})();