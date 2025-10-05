// Are We Alone — single model: Temperature vs Orbital Distance (Plotly) with KOI fields
(function(){
  const $ = (sel)=>document.querySelector(sel);

  function normalizeKeyName(s){
    return String(s || "")
      .replace(/\uFEFF/g, "")
      .replace(/\u00A0/g, " ")
      .normalize("NFKC")
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[^\p{L}\p{N}_]/gu, "");
  }
  function getAny(obj, keys) {
    for (const k of keys) { if (obj[k] != null && obj[k] !== "") return obj[k]; }
    const dict = {}; for (const kk of Object.keys(obj)) dict[normalizeKeyName(kk)] = obj[kk];
    for (const k of keys) { const nk = normalizeKeyName(k); if (dict[nk] != null && dict[nk] !== "") return dict[nk]; }
    return null;
  }
  const AU_PER_RSUN = 1/215.032;
  function toNum(v){ if(v==null||v==="") return null; const n=Number(String(v).replace(",",".")); return Number.isFinite(n)?n:null; }

  function normalizeRow(r){
    const name = getAny(r, ["pl_name","name","planet","kepler_name","kepoi_name","koi_name","الاسم","الكوكب"]);
    const disp = getAny(r, ["koi_disposition","disposition","discoverymethod","الحالة"]);
    const period_days = toNum(getAny(r, ["pl_orbper","period","koi_period","الفترة"]));
    const a_au = toNum(getAny(r, ["pl_orbsmax","a","semimajoraxis","orbitaldistance","koi_sma","المسافة (وحدات فلكية)"]));
    const pr = toNum(getAny(r, ["pl_rade","radius","koi_prad","نصف القطر"]));
    const teq_k = toNum(getAny(r, ["pl_eqt","teq","equilibriumtemperature","koi_teq","درجة التوازن","درجة الحرارة"]));
    const teff = toNum(getAny(r, ["st_teff","teff","koi_steff","درجة حرارة النجم"]));
    const rstar = toNum(getAny(r, ["st_rad","rstar","koi_srad","نصف قطر النجم"]));

    let a_est = a_au;
    if (!Number.isFinite(a_est) && Number.isFinite(period_days)) {
      const P_year = period_days / 365.25;
      a_est = Math.pow(Math.max(P_year, 0), 2/3);
    }

    let Teq = teq_k;
    if (!Number.isFinite(Teq) && Number.isFinite(teff) && Number.isFinite(rstar) && Number.isFinite(a_est) && a_est>0) {
      const r_au = rstar * AU_PER_RSUN;
      Teq = teff * Math.sqrt(r_au / (2 * a_est));
    }
    return { name, disp, a:a_est, pr, Teq };
  }

  async function readFile(file){
    const name = file.name.toLowerCase();
    if (name.endsWith(".csv")){
      const text = await file.text();
      const parsed = Papa.parse(text, { header:true, dynamicTyping:true, skipEmptyLines:true });
      return parsed.data.map(normalizeRow);
    } else if (name.endsWith(".xlsx") || name.endsWith(".xls")){
      const data = new Uint8Array(await file.arrayBuffer());
      const wb = XLSX.read(data, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet, { defval:"" });
      return json.map(normalizeRow);
    } else { throw new Error("Please upload CSV or Excel (.xlsx/.xls) file"); }
  }

  function calcKPIs(rows){
    const total = rows.length;
    const named = rows.filter(r=>r.name).length;
    const withYear = 0;
    const small = rows.filter(r=> Number.isFinite(r.pr) && r.pr<=1.5).length;
    return { total, named, withYear, small };
  }

  function renderKPIs(k){
    document.getElementById("kpi_total").textContent = k.total;
    document.getElementById("kpi_named").textContent = k.named;
    document.getElementById("kpi_year").textContent = k.withYear;
    document.getElementById("kpi_small").textContent = k.small;
  }

  function makeTraces(rows){
    const clean = rows.filter(r=> Number.isFinite(r.Teq) && Number.isFinite(r.a));
    const groups = { "CONFIRMED": [], "CANDIDATE": [], "FALSE POSITIVE": [], "OTHER": [] };
    clean.forEach(r=>{
      const d = (r.disp||"").toString().toUpperCase();
      if (d.includes("CONFIRMED")) groups["CONFIRMED"].push(r);
      else if (d.includes("CANDIDATE")) groups["CANDIDATE"].push(r);
      else if (d.includes("FALSE")) groups["FALSE POSITIVE"].push(r);
      else groups["OTHER"].push(r);
    });

    const palette = {
      "CONFIRMED": undefined,
      "CANDIDATE": "#ff9ec9",
      "FALSE POSITIVE": "#b393ff",
      "OTHER": "#8bd3e6"
    };

    const traces = Object.entries(groups).map(([label, arr])=> ({
      type:'scatter',
      mode:'markers',
      name: label.split(' ').map(w=> w[0]+w.slice(1).toLowerCase()).join(' '),
      x: arr.map(r=> r.a),
      y: arr.map(r=> r.Teq),
      text: arr.map(r=> (r.name||'Unknown') + (Number.isFinite(r.pr)?` — ${r.pr.toFixed(2)} R⊕`:"")),
      hovertemplate:'<b>%{text}</b><br>Distance: %{x:.2f} AU<br>Teq: %{y:.0f} K<extra></extra>',
      marker: { size: 8, opacity: 0.85, color: palette[label] }
    }));

    const earthlike = clean.filter(r => Number.isFinite(r.pr) && r.pr>=0.8 && r.pr<=1.5 && r.Teq>=180 && r.Teq<=310);
    if (earthlike.length){
      traces.push({
        type:'scatter',
        mode:'markers',
        name:'Earth-like Planets',
        x: earthlike.map(r=> r.a),
        y: earthlike.map(r=> r.Teq),
        text: earthlike.map(r=> (r.name||'Earth-like')),
        hovertemplate:'🌟 <b>%{text}</b><br>Distance: %{x:.2f} AU<br>Teq: %{y:.0f} K<extra></extra>',
        marker:{ size: 14, symbol:'star', line:{width:1}, color:"#ffd900ff" }
      });
    }
    return traces;
  }

  function drawScatter(rows){
    const traces = makeTraces(rows);
    const layout = {
      paper_bgcolor:'rgba(0,0,0,0)',
      plot_bgcolor:'rgba(0,0,0,0)',
      margin:{l:60,r:20,b:60,t:40},
      xaxis:{ title:'Orbital Distance (AU)', zeroline:false, showspikes:false, color:'#cdd3ff', gridcolor:'#2f365f' },
      yaxis:{ title:'Equilibrium Temperature (K)', showspikes:false, color:'#cdd3ff', gridcolor:'#2f365f' },
      legend:{ bgcolor:'rgba(0,0,0,0)' }
    };
    Plotly.react('tempDistancePlot', traces, layout, {displayModeBar:false});
  }

  function attachDrop(){
    const dz = document.querySelector(".dropzone");
    const inp = document.getElementById("fileInput");
    const btnFileLabel = document.querySelector(".btn-file");
    const status = document.querySelector(".status");

    async function handle(file){
      status.textContent = "Parsing…";
      try{
        const rows = await readFile(file);
        renderKPIs(calcKPIs(rows));
        drawScatter(rows);
        btnFileLabel.setAttribute('data-filename', file.name);
        status.textContent = `Loaded ${rows.length} rows ✅`;
      }catch(e){
        console.error(e);
        status.textContent = "Failed: " + e.message;
      }
    }

    dz.addEventListener('dragover', (e)=>{ e.preventDefault(); dz.classList.add('dragover'); });
    dz.addEventListener('dragleave', ()=> dz.classList.remove('dragover'));
    dz.addEventListener('drop', (e)=>{ e.preventDefault(); dz.classList.remove('dragover'); e.dataTransfer.files[0] && handle(e.dataTransfer.files[0]); });
    inp.addEventListener('change', ()=> { if(inp.files[0]) handle(inp.files[0]); });
  }

  document.addEventListener('DOMContentLoaded', attachDrop);
})();