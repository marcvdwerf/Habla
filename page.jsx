"use client";
import { useState, useEffect } from "react";

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────
const GRAMMAR_OPTIONS = [
  "Presente","Futuro simple","Pretérito perfecto","Pretérito indefinido",
  "Imperfecto","Imperativo","Pluscuamperfecto","Condicional simple",
  "Subjuntivo presente","Presente progresivo","Pretérito imperfecto progresivo","Condicional progresivo"
];
const SOURCE_TYPES = [
  { id:"artikel", icon:"📰", nl:"Artikel" },
  { id:"liedje",  icon:"🎵", nl:"Liedje"  },
  { id:"video",   icon:"🎬", nl:"Video"   },
  { id:"tekst",   icon:"📚", nl:"Tekst"   },
];
const LEVELS  = ["A1","A2","B1","B2","C1","C2"];
const TABS    = [
  { icon:"🏠", nl:"Vandaag"    },
  { icon:"🌐", nl:"Bron"       },
  { icon:"📖", nl:"Woorden"    },
  { icon:"🧠", nl:"Grammatica" },
  { icon:"⭐", nl:"Reflectie"  },
];
const COLORS  = ["#FF6B35","#58CC02","#3B82F6","#A78BFA","#FFB800"];
const SK      = "habla_v8";
const XP_ACT  = 15;
const SRS_INT = { nieuw:0, leren:1, herhalen:2, gekend:5 };

// ─────────────────────────────────────────────────────────────
// STORAGE
// ─────────────────────────────────────────────────────────────
function ls()    { try { return JSON.parse(localStorage.getItem(SK)||"{}"); } catch { return {}; } }
function ss(d)   { try { localStorage.setItem(SK, JSON.stringify(d)); } catch {} }
function getBank(){ return ls().bank || []; }
function setBank(b){ ss({...ls(), bank:b}); }
function getSessions(){ return ls().sessions || []; }
function setSessions(s){ ss({...ls(), sessions:s}); }
function today() { return new Date().toISOString().slice(0,10); }
function due(bank){ return bank.filter(w => w.nextReview <= today()); }
function srsNext(word, correct){
  const flow = { nieuw:"leren", leren:"herhalen", herhalen:"gekend", gekend:"gekend" };
  const st   = correct ? (flow[word.status]||"leren") : "leren";
  const d    = new Date(); d.setDate(d.getDate() + (SRS_INT[st]||1));
  return { ...word, status:st, nextReview:d.toISOString().slice(0,10) };
}
function snip(t, n=2500){ return t ? (t.length>n ? t.slice(0,n)+"…" : t) : ""; }

// ─────────────────────────────────────────────────────────────
// API
// ─────────────────────────────────────────────────────────────
async function ai(prompt, json=false, system=null){
  const sys = system || (json
    ? "Reageer ALLEEN met een geldige JSON array. Geen uitleg, geen markdown, geen backticks."
    : "Je bent een enthousiaste Spaans docent. Antwoord in het Nederlands tenzij Spaans vereist is.");
  const r = await fetch("/api/ai", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({
      model:"claude-sonnet-4-20250514",
      max_tokens: json ? 4000 : 1200,
      system: sys,
      messages:[{ role:"user", content:prompt }]
    })
  });
  const d = await r.json();
  return d.content?.map(b=>b.text||"").join("") || "";
}

function parseJ(raw){
  if(!raw) return null;
  let s = raw.replace(/```(?:json)?/gi,"").replace(/```/g,"").trim();
  try { return JSON.parse(s); } catch {}
  const a = s.match(/\[[\s\S]*\]/); if(a){ try { return JSON.parse(a[0]); } catch {} }
  return null;
}

function shuffle(arr){
  const a=[...arr];
  for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
  return a;
}

async function fetchPage(url){
  const enc = encodeURIComponent(url);
  for(const p of [
    `https://corsproxy.io/?${enc}`,
    `https://api.allorigins.win/raw?url=${enc}`,
    `https://api.codetabs.com/v1/proxy?quest=${enc}`,
  ]){
    try {
      const r = await fetch(p, { signal: AbortSignal.timeout(8000) });
      if(!r.ok) continue;
      const html = await r.text();
      if(!html || html.length < 200) continue;
      const text = html
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi,"")
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi,"")
        .replace(/<[^>]+>/g," ")
        .replace(/&amp;/g,"&").replace(/&nbsp;/g," ").replace(/&lt;/g,"<").replace(/&gt;/g,">")
        .replace(/\s{2,}/g," ").trim().slice(0,8000);
      if(text.length > 200) return text;
    } catch { continue; }
  }
  return "";
}

// ─────────────────────────────────────────────────────────────
// SHARED UI
// ─────────────────────────────────────────────────────────────
function Spin({ label="AI denkt na…" }){
  return(
    <div style={{display:"flex",alignItems:"center",gap:8,fontFamily:"'Nunito',sans-serif",fontWeight:800,fontSize:14,marginTop:10}}>
      <div style={{width:20,height:20,border:"3px solid #FFE44D",borderTopColor:"#FF6B35",borderRadius:"50%",animation:"spin .7s linear infinite",flexShrink:0}}/>
      {label}
    </div>
  );
}

function Card({ children, bg="#fff", style={} }){
  return <div style={{background:bg,border:"3px solid #1a1a1a",borderRadius:20,padding:"18px 20px",marginBottom:16,boxShadow:"5px 5px 0 #1a1a1a",...style}}>{children}</div>;
}

function Btn({ children, onClick, disabled, color="#FFE44D", tc="#1a1a1a", full, sm }){
  return(
    <button onClick={onClick} disabled={disabled} style={{
      display:"block", width:full?"100%":"auto",
      padding:sm?"7px 16px":"12px 24px",
      background:disabled?"#e0e0e0":color,
      color:disabled?"#999":tc,
      border:"3px solid #1a1a1a", borderRadius:14,
      fontFamily:"'Nunito',sans-serif", fontWeight:900, fontSize:sm?12:14,
      cursor:disabled?"not-allowed":"pointer",
      boxShadow:disabled?"none":"4px 4px 0 #1a1a1a",
      transition:"transform .1s, box-shadow .1s"
    }}
      onMouseDown={e=>{ if(!disabled){ e.currentTarget.style.transform="translate(3px,3px)"; e.currentTarget.style.boxShadow="1px 1px 0 #1a1a1a"; }}}
      onMouseUp={e=>{ e.currentTarget.style.transform=""; e.currentTarget.style.boxShadow=disabled?"none":"4px 4px 0 #1a1a1a"; }}
      onMouseLeave={e=>{ e.currentTarget.style.transform=""; e.currentTarget.style.boxShadow=disabled?"none":"4px 4px 0 #1a1a1a"; }}
    >{children}</button>
  );
}

function Chip({ color="#58CC02", text, sm }){
  return <span style={{display:"inline-flex",alignItems:"center",background:color,color:"#fff",border:"2.5px solid #1a1a1a",borderRadius:20,padding:sm?"2px 9px":"3px 12px",fontSize:sm?10:12,fontWeight:800,fontFamily:"'Nunito',sans-serif",boxShadow:"2px 2px 0 #1a1a1a"}}>{text}</span>;
}

function AIBox({ text }){
  if(!text) return null;
  return(
    <div style={{marginTop:12,display:"flex",gap:10,alignItems:"flex-start",animation:"popIn .3s ease"}}>
      <div style={{width:34,height:34,flexShrink:0,background:"#A78BFA",border:"2.5px solid #1a1a1a",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,boxShadow:"2px 2px 0 #1a1a1a"}}>🤖</div>
      <div style={{flex:1,background:"#F0F9FF",border:"2.5px solid #1a1a1a",borderRadius:"4px 16px 16px 16px",padding:"10px 14px",fontFamily:"'Nunito',sans-serif",fontSize:14,lineHeight:1.6,whiteSpace:"pre-wrap",boxShadow:"3px 3px 0 #1a1a1a"}}>{text}</div>
    </div>
  );
}

function XPBar({ xp }){
  const max=200, pct=Math.min((xp%max)/max*100,100), lv=Math.floor(xp/max)+1;
  return(
    <div style={{display:"flex",alignItems:"center",gap:10}}>
      <span style={{fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:13,color:"#fff",background:"#FF6B35",border:"2px solid rgba(255,255,255,.5)",borderRadius:20,padding:"2px 10px"}}>Nv.{lv}</span>
      <div style={{flex:1,height:13,background:"rgba(255,255,255,.3)",borderRadius:20,border:"2px solid rgba(255,255,255,.4)",overflow:"hidden"}}>
        <div style={{width:`${pct}%`,height:"100%",background:"linear-gradient(90deg,#FFE44D,#58CC02)",borderRadius:20,transition:"width .6s ease"}}/>
      </div>
      <span style={{fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:13,color:"#fff"}}>{xp} XP</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TAB 0: VANDAAG
// ─────────────────────────────────────────────────────────────
function VandaagTab({ setTab, level, setLevel, grammar, setGrammar, rawText, addXP }){
  const [bank,      setBank_]    = useState(getBank);
  const [revIdx,    setRevIdx]   = useState(0);
  const [revDone,   setRevDone]  = useState(false);
  const [revScore,  setRevScore] = useState({c:0,t:0});
  const [flipped,   setFlipped]  = useState(false);
  const sessions = getSessions();
  const dueList  = due(bank);
  const todaySes = sessions.find(s=>s.datum===today());

  const stats = {
    total:  bank.length,
    leren:  bank.filter(w=>w.status==="nieuw"||w.status==="leren").length,
    herhalen: bank.filter(w=>w.status==="herhalen").length,
    gekend: bank.filter(w=>w.status==="gekend").length,
    streak: ls().streak||0,
  };

  function handleRev(correct){
    const word = dueList[revIdx];
    const updated = srsNext(word, correct);
    const nb = bank.map(w=>w.id===word.id?updated:w);
    setBank_(nb); setBank(nb);
    addXP(correct?15:5);
    setRevScore(s=>({c:s.c+(correct?1:0),t:s.t+1}));
    setFlipped(false);
    if(revIdx<dueList.length-1) setRevIdx(i=>i+1);
    else setRevDone(true);
  }

  return(
    <div>
      <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:22,marginBottom:16}}>🏠 Vandaag · <span style={{fontSize:14,color:"#888",fontWeight:700}}>{today()}</span></div>

      {/* Settings */}
      <Card bg="#FFF9DB">
        <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:13,marginBottom:8}}>📊 Niveau</div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
          {LEVELS.map(l=>(
            <button key={l} onClick={()=>setLevel(l)} style={{padding:"5px 13px",background:level===l?"#A78BFA":"#fff",color:level===l?"#fff":"#1a1a1a",border:"2.5px solid #1a1a1a",borderRadius:20,fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:13,cursor:"pointer",boxShadow:level===l?"2px 2px 0 #1a1a1a":"none"}}>{l}</button>
          ))}
        </div>
        <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:13,marginBottom:8}}>🧠 Grammatica-focus</div>
        <select value={grammar} onChange={e=>setGrammar(e.target.value)} style={{width:"100%",padding:"10px 14px",border:"3px solid #1a1a1a",borderRadius:12,fontFamily:"'Nunito',sans-serif",fontWeight:700,fontSize:14,background:"#fff",cursor:"pointer",boxShadow:"3px 3px 0 #1a1a1a"}}>
          {GRAMMAR_OPTIONS.map(g=><option key={g}>{g}</option>)}
        </select>
      </Card>

      {/* Sessie plan */}
      <Card bg="#1a1a1a">
        <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:13,color:"#FFE44D",marginBottom:10}}>⚡ 15-20 MIN SESSIEPLAN</div>
        {[
          { n:1, t:"~3 min", icon:"🔁", l:"Woorden herhalen",   done: revDone||dueList.length===0, go:null },
          { n:2, t:"~5 min", icon:"🌐", l:"Nieuwe bron laden",  done:!!todaySes,                   go:1 },
          { n:3, t:"~5 min", icon:"📖", l:"Woorden leren",      done:(todaySes?.wc||0)>0,           go:2 },
          { n:4, t:"~5 min", icon:"🧠", l:"Grammatica oefenen", done:false,                         go:3 },
          { n:5, t:"~2 min", icon:"⭐", l:"Reflecteer",         done:ls().lastRef===today(),        go:4 },
        ].map(s=>(
          <div key={s.n} onClick={()=>s.go!=null&&setTab(s.go)} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:s.n<5?"1px solid rgba(255,255,255,.1)":"none",cursor:s.go!=null?"pointer":"default",opacity:s.done?.65:1}}>
            <div style={{width:26,height:26,borderRadius:"50%",background:s.done?"#58CC02":COLORS[s.n-1],border:"2px solid rgba(255,255,255,.3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,flexShrink:0,fontFamily:"'Nunito',sans-serif",fontWeight:900,color:"#fff"}}>{s.done?"✓":s.n}</div>
            <div style={{flex:1}}>
              <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:13,color:s.done?"#888":"#fff"}}>{s.icon} {s.l}</div>
            </div>
            <div style={{fontFamily:"'Nunito',sans-serif",fontSize:11,color:"rgba(255,255,255,.4)"}}>{s.t}</div>
          </div>
        ))}
      </Card>

      {/* Stats */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:16}}>
        {[
          {icon:"📚",val:stats.total,  label:"Totaal woorden", color:"#3B82F6"},
          {icon:"🔁",val:dueList.length,label:"Te herhalen",   color:dueList.length>0?"#FF6B35":"#58CC02"},
          {icon:"✅",val:stats.gekend, label:"Gekend",          color:"#58CC02"},
          {icon:"🔥",val:`${stats.streak}d`,label:"Streak",    color:"#FF6B35"},
        ].map(s=>(
          <div key={s.label} style={{background:"#fff",border:"3px solid #1a1a1a",borderRadius:16,padding:"14px 16px",boxShadow:"4px 4px 0 #1a1a1a"}}>
            <div style={{fontSize:22,marginBottom:4}}>{s.icon}</div>
            <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:26,color:s.color}}>{s.val}</div>
            <div style={{fontFamily:"'Nunito',sans-serif",fontSize:11,color:"#888",fontWeight:700}}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* SRS review */}
      {dueList.length>0 && !revDone && (
        <Card bg="#E8F5E9">
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:15}}>🔁 Herhalen {revIdx+1}/{dueList.length}</div>
            <Chip color="#58CC02" text={`${revScore.c}/${revScore.t} goed`}/>
          </div>
          <div onClick={()=>setFlipped(true)} style={{minHeight:120,background:flipped?"#fff":"linear-gradient(135deg,#EFF6FF,#DBEAFE)",border:"3px solid #1a1a1a",borderRadius:16,padding:20,cursor:flipped?"default":"pointer",display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"center",textAlign:"center",boxShadow:"4px 4px 0 #1a1a1a"}}>
            <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:26,marginBottom:4}}>{dueList[revIdx]?.es}</div>
            {flipped ? (
              <>
                <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:20,color:"#1a5c00",marginBottom:6}}>{dueList[revIdx]?.nl}</div>
                <div style={{fontFamily:"'Nunito',sans-serif",fontSize:12,color:"#555",fontStyle:"italic"}}>"{dueList[revIdx]?.zin}"</div>
              </>
            ) : (
              <div style={{fontFamily:"'Nunito',sans-serif",fontSize:13,color:"#3B82F6",fontWeight:800}}>👆 Tik om te onthullen</div>
            )}
          </div>
          {flipped && (
            <div style={{display:"flex",gap:10,marginTop:10}}>
              <Btn onClick={()=>handleRev(false)} color="#FFF1F2" tc="#FF6B35" full>❌ Wist ik niet</Btn>
              <Btn onClick={()=>handleRev(true)}  color="#E8F5E9" tc="#1a5c00" full>✅ Kende ik!</Btn>
            </div>
          )}
        </Card>
      )}
      {revDone && <Card bg="#E8F5E9" style={{textAlign:"center"}}><div style={{fontSize:36,marginBottom:8}}>🎉</div><div style={{fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:16}}>Herhaling klaar! {revScore.c}/{revScore.t} goed</div></Card>}
      {dueList.length===0 && bank.length>0 && !revDone && <Card bg="#E8F5E9" style={{textAlign:"center"}}><div style={{fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:14}}>✅ Geen woorden te herhalen vandaag!</div></Card>}

      {/* Quick nav */}
      <div style={{display:"flex",flexDirection:"column",gap:10,marginTop:8}}>
        {rawText?.trim()
          ? <Btn onClick={()=>setTab(2)} color="#3B82F6" tc="#fff" full>📖 Ga naar woordenlijst van huidige bron</Btn>
          : <Btn onClick={()=>setTab(1)} color="#58CC02" tc="#fff" full>🌐 Laad een nieuwe bron</Btn>
        }
      </div>

      {/* Recent sessions */}
      {getSessions().slice(-5).reverse().map((s,i)=>(
        <div key={i} style={{background:i===0?"#FFF9DB":"#fff",border:"2.5px solid #1a1a1a",borderRadius:14,padding:"10px 14px",marginTop:i===0?16:6,boxShadow:"3px 3px 0 #1a1a1a"}}>
          <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:6}}>
            <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:13}}>{SOURCE_TYPES.find(t=>t.id===s.sourceType)?.icon||"📄"} {s.title||"Sessie"}</div>
            <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
              <Chip color="#888" text={s.datum} sm/><Chip color="#A78BFA" text={s.grammar} sm/>{s.wc>0&&<Chip color="#3B82F6" text={`${s.wc}w`} sm/>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TAB 1: BRON
// ─────────────────────────────────────────────────────────────
function BronTab({ grammar, rawText, setRawText, sourceType, setSourceType, level, num, setNum, deepLKey, setDeepLKey, addXP, setTab }){
  const [summary,  setSummary]  = useState("");
  const [loading,  setLoading]  = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [fetching, setFetching] = useState(false);
  const [fetchErr, setFetchErr] = useState("");

  async function fetchUrl(){
    setFetchErr("");
    let url = urlInput.trim();
    if(!url){ setFetchErr("Voer eerst een URL in."); return; }
    if(!/^https?:\/\//i.test(url)) url = "https://"+url;
    setFetching(true);
    const text = await fetchPage(url);
    setFetching(false);
    if(text){ setRawText(text); setFetchErr(""); }
    else setFetchErr("Ophalen mislukt. Kopieer de tekst handmatig en plak hieronder.");
  }

  async function generate(){
    if(!rawText?.trim()){ alert("Plak eerst tekst of haal een URL op."); return; }
    setLoading(true); setSummary("");
    const stLabel = SOURCE_TYPES.find(t=>t.id===sourceType)?.nl || sourceType;
    const prompt =
`Je analyseert een ${stLabel} op niveau ${level}.

TEKST:
"""
${snip(rawText)}
"""

Genereer:
1. Samenvatting 5-8 zinnen IN HET SPAANS
2. Nederlandse vertaling

Formaat:
🇪🇸 SPAANS:
[samenvatting]

🇳🇱 NEDERLANDS:
[vertaling]`;

    const r = await ai(prompt);
    setSummary(r);

    // Save session
    const title = rawText.trim().split(/\s+/).slice(0,5).join(" ")+"…";
    const sessions = getSessions();
    const newSes = { datum:today(), grammar, sourceType, level, title, wc:0 };
    setSessions([...sessions.filter(s=>s.datum!==today()), newSes]);

    addXP(XP_ACT*2);
    setLoading(false);
  }

  const wc = rawText ? rawText.trim().split(/\s+/).filter(Boolean).length : 0;

  return(
    <div>
      <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:22,marginBottom:16}}>🌐 Bron laden</div>

      {/* Source type */}
      <Card bg="#EFF6FF">
        <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:14,marginBottom:10}}>Wat voor bron?</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
          {SOURCE_TYPES.map(t=>(
            <button key={t.id} onClick={()=>setSourceType(t.id)} style={{padding:"10px 6px",background:sourceType===t.id?"#1a1a1a":"#fff",color:sourceType===t.id?"#fff":"#1a1a1a",border:"3px solid #1a1a1a",borderRadius:12,fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:12,cursor:"pointer",boxShadow:"3px 3px 0 #1a1a1a",textAlign:"center"}}>
              <div style={{fontSize:20,marginBottom:2}}>{t.icon}</div>{t.nl}
            </button>
          ))}
        </div>
      </Card>

      {/* URL */}
      <Card bg="#E8F5E9">
        <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:14,marginBottom:10}}>🔗 URL ophalen</div>
        <div style={{display:"flex",gap:8}}>
          <input
            value={urlInput}
            onChange={e=>{ setUrlInput(e.target.value); setFetchErr(""); }}
            onKeyDown={e=>e.key==="Enter"&&fetchUrl()}
            placeholder="https://nos.nl/artikel/..."
            style={{flex:1,padding:"11px 14px",border:"3px solid #1a1a1a",borderRadius:12,fontFamily:"'Nunito',sans-serif",fontSize:14,background:"#fff",boxShadow:"3px 3px 0 #1a1a1a",boxSizing:"border-box"}}
          />
          <Btn onClick={fetchUrl} disabled={fetching} color="#3B82F6" tc="#fff">{fetching?"⏳":"Haal op"}</Btn>
        </div>
        {fetching && <Spin label="Pagina ophalen…"/>}
        {fetchErr && <div style={{fontFamily:"'Nunito',sans-serif",fontSize:12,fontWeight:800,color:"#FF6B35",marginTop:6}}>⚠️ {fetchErr}</div>}
      </Card>

      {/* Paste */}
      <Card bg="#FFF9DB">
        <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:14,marginBottom:10}}>
          📋 Of plak tekst — <span style={{fontWeight:700,color:"#888",fontSize:12}}>artikel, songtekst, transcript, ondertitels</span>
        </div>
        <textarea
          value={rawText}
          onChange={e=>setRawText(e.target.value)}
          placeholder="Plak hier de volledige tekst…"
          style={{width:"100%",minHeight:140,padding:"12px 14px",border:"3px solid #1a1a1a",borderRadius:12,fontFamily:"'Nunito',sans-serif",fontSize:13,resize:"vertical",boxSizing:"border-box",lineHeight:1.6,boxShadow:"3px 3px 0 #1a1a1a",background:"#fff"}}
        />
        {wc>0 && <div style={{display:"flex",gap:8,marginTop:6,flexWrap:"wrap"}}><Chip color="#58CC02" text={`✓ ${wc} woorden geladen`}/></div>}
      </Card>

      {/* Settings */}
      <Card bg="#fff">
        <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
          <span style={{fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:13}}>📚 Woorden:</span>
          {[10,15,20,25].map(n=>(
            <button key={n} onClick={()=>setNum(n)} style={{padding:"5px 13px",background:num===n?"#58CC02":"#fff",color:num===n?"#fff":"#1a1a1a",border:"2.5px solid #1a1a1a",borderRadius:20,fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:13,cursor:"pointer",boxShadow:num===n?"2px 2px 0 #1a1a1a":"none"}}>{n}</button>
          ))}
        </div>
      </Card>

      {/* DeepL */}
      <Card bg="#FDF4FF">
        <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:13,marginBottom:6}}>🔑 DeepL API Key {deepLKey&&<span style={{color:"#58CC02"}}>✓ Actief</span>}</div>
        <input type="password" value={deepLKey} onChange={e=>setDeepLKey(e.target.value)}
          placeholder="Plak je DeepL key (eindigt op :fx) — optioneel"
          style={{width:"100%",padding:"10px 14px",border:"3px solid #1a1a1a",borderRadius:12,fontFamily:"'Nunito',sans-serif",fontSize:13,background:"#fff",boxShadow:"3px 3px 0 #1a1a1a",boxSizing:"border-box"}}
        />
      </Card>

      {/* Generate */}
      <Btn onClick={generate} disabled={loading||!rawText?.trim()} color="#58CC02" tc="#fff" full>
        {loading ? "⏳ Bezig…" : "🚀 Genereer samenvatting"}
      </Btn>
      {!rawText?.trim() && <div style={{fontFamily:"'Nunito',sans-serif",fontSize:12,color:"#FF6B35",fontWeight:800,marginTop:6}}>⚠️ Voeg eerst een bron toe hierboven.</div>}
      {loading && <Spin/>}

      {summary && (
        <Card bg="#fff" style={{marginTop:16,animation:"popIn .4s ease"}}>
          <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
            <Chip color="#A78BFA" text="✓ Samenvatting gegenereerd"/><Chip color="#58CC02" text={`+${XP_ACT*2} XP`}/>
          </div>
          <div style={{fontFamily:"'Nunito',sans-serif",fontSize:14,lineHeight:1.8,whiteSpace:"pre-wrap",marginBottom:16}}>{summary}</div>
          <Btn onClick={()=>setTab(2)} color="#3B82F6" tc="#fff" full>→ Ga naar woordenlijst</Btn>
        </Card>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TAB 2: WOORDEN
// ─────────────────────────────────────────────────────────────
function WoordenTab({ rawText, num, sourceType, level, deepLKey, addXP }){
  const [words,   setWords]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [bank,    setBank_]   = useState(getBank);
  const [added,   setAdded]   = useState(0);
  const [quizI,   setQuizI]   = useState(null);
  const [quizA,   setQuizA]   = useState("");
  const [quizFB,  setQuizFB]  = useState("");
  const [quizL,   setQuizL]   = useState(false);

  const BG = ["#FFF9DB","#E8F5E9","#EFF6FF","#FDF4FF","#FFF1F2","#ECFDF5","#FFF7ED","#F0F9FF"];

  async function generate(){
    if(!rawText?.trim()) return;
    setLoading(true); setWords([]); setAdded(0);
    const known = bank.map(w=>w.es).slice(0,30).join(", ");
    const prompt =
`BRONTYPE: ${sourceType} · NIVEAU: ${level}

TEKST:
"""
${snip(rawText)}
"""

Selecteer ${Math.min(num,20)} kernwoorden die LETTERLIJK in de tekst voorkomen.
Geen stopwoorden (de, het, een, en, van, is, te, in, op, dat).
${known?`Sla deze al bekende woorden over: ${known}`:""}

Geef ALLEEN een JSON array:
[{"es":"palabra","uitspraak":"pa-la-bra","zin":"Exacte zin uit de tekst."}]`;

    const raw = await ai(prompt, true);
    const parsed = parseJ(raw);
    if(!parsed || !Array.isArray(parsed) || parsed.length===0){
      setWords([{es:"⚠️ Probeer opnieuw",nl:"",uitspraak:"",zin:""}]);
      setLoading(false); return;
    }

    // Translate
    let nls;
    if(deepLKey){
      nls = await Promise.all(parsed.map(async w=>{
        try {
          const r = await fetch("https://api-free.deepl.com/v2/translate",{
            method:"POST", headers:{"Content-Type":"application/x-www-form-urlencoded","Authorization":`DeepL-Auth-Key ${deepLKey}`},
            body: new URLSearchParams({ text:w.es, target_lang:"NL" })
          });
          const d = await r.json(); return d.translations?.[0]?.text||null;
        } catch { return null; }
      }));
    } else {
      const tr = await ai(`Vertaal naar Nederlands. Alleen JSON:\n[{"es":"x","nl":"y"}]\nWoorden: ${parsed.map(w=>w.es).join(", ")}`, true);
      const tp = parseJ(tr); const map={};
      if(tp) tp.forEach(t=>{ if(t.es) map[t.es]=t.nl; });
      nls = parsed.map(w=>map[w.es]||null);
    }

    setWords(parsed.map((w,i)=>({...w, nl:nls[i]||"—"})));
    addXP(XP_ACT);
    setLoading(false);
  }

  function addToBank(w){
    if(bank.find(b=>b.es===w.es)) return;
    const nb = [...bank, {...w, id:`${w.es}_${Date.now()}`, status:"nieuw", nextReview:today()}];
    setBank_(nb); setBank(nb); setAdded(c=>c+1);
    const sess = getSessions(); if(sess.length>0){ sess[sess.length-1].wc=(sess[sess.length-1].wc||0)+1; setSessions(sess); }
  }

  function addAll(){ words.filter(w=>!bank.find(b=>b.es===w.es)).forEach(addToBank); }

  async function checkQuiz(w){
    if(!quizA.trim()) return;
    setQuizL(true);
    const r = await ai(`Woord: "${w.es}" (${w.nl}). Leerling: "${quizA}". Correct? ✅ of ❌. Max 2 zinnen.`);
    setQuizFB(r); addXP(10); setQuizL(false);
  }

  function csv(){
    const b=new Blob(["ES,NL,Uitspraak,Zin\n"+words.map(w=>`"${w.es}","${w.nl}","${w.uitspraak}","${w.zin}"`).join("\n")],{type:"text/csv"});
    Object.assign(document.createElement("a"),{href:URL.createObjectURL(b),download:"habla_woorden.csv"}).click();
  }

  return(
    <div>
      <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:22,marginBottom:16}}>📖 Woordenlijst · <span style={{fontSize:13,color:"#888",fontWeight:700}}>Bank: {bank.length}</span></div>

      {rawText?.trim()
        ? <Card bg="#E8F5E9"><Chip color="#58CC02" text={`✓ Bron geladen · ${rawText.trim().split(/\s+/).length} woorden · ${sourceType} · ${level}`}/></Card>
        : <Card bg="#FFF1F2"><div style={{fontFamily:"'Nunito',sans-serif",fontSize:13,fontWeight:800,color:"#FF6B35"}}>❌ Geen bron — ga naar het Bron-tabblad en plak tekst.</div></Card>
      }

      <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:4}}>
        <Btn onClick={generate} disabled={loading||!rawText?.trim()} color="#3B82F6" tc="#fff">
          {loading?"⏳ Bezig…":` ✨ Genereer ${num} woorden`}
        </Btn>
        {words.length>0 && <Btn onClick={addAll}    color="#58CC02" tc="#fff" sm>+ Alles naar bank</Btn>}
        {words.length>0 && <Btn onClick={csv}       color="#fff" sm>⬇️ CSV</Btn>}
      </div>
      {loading && <Spin label="Woorden extraheren uit brontekst…"/>}
      {added>0  && <div style={{fontFamily:"'Nunito',sans-serif",fontSize:13,fontWeight:800,color:"#58CC02",margin:"6px 0"}}>✅ {added} woorden toegevoegd aan woordenbank</div>}

      {words.length>0 && (
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(250px,1fr))",gap:12,marginTop:8}}>
          {words.map((w,i)=>{
            const saved = !!bank.find(b=>b.es===w.es);
            return(
              <div key={i} style={{background:BG[i%BG.length],border:"3px solid #1a1a1a",borderRadius:18,padding:14,boxShadow:"4px 4px 0 #1a1a1a",position:"relative"}}>
                <button onClick={()=>!saved&&addToBank(w)} style={{position:"absolute",top:8,right:8,background:saved?"#58CC02":"#fff",border:"2px solid #1a1a1a",borderRadius:16,padding:"2px 9px",fontSize:11,fontWeight:900,cursor:saved?"default":"pointer",color:saved?"#fff":"#1a1a1a",fontFamily:"'Nunito',sans-serif"}}>
                  {saved?"✓":"+ Bank"}
                </button>
                <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:20,paddingRight:64}}>{w.es}</div>
                <div style={{fontFamily:"'Nunito',sans-serif",fontSize:12,color:"#888",fontStyle:"italic",marginBottom:2}}>/{w.uitspraak}/</div>
                <div style={{fontFamily:"'Nunito',sans-serif",fontSize:14,fontWeight:700,color:"#333",marginBottom:6}}>{w.nl}</div>
                <div style={{background:"rgba(0,0,0,.05)",borderLeft:"3px solid #1a1a1a",padding:"5px 8px",borderRadius:"0 8px 8px 0",fontFamily:"'Nunito',sans-serif",fontSize:11,color:"#555",fontStyle:"italic",marginBottom:8}}>📄 {w.zin}</div>
                <button onClick={()=>{setQuizI(quizI===i?null:i);setQuizA("");setQuizFB("");}} style={{background:"none",border:"2px dashed #1a1a1a",borderRadius:8,padding:"3px 10px",fontFamily:"'Nunito',sans-serif",fontSize:11,fontWeight:800,cursor:"pointer",color:"#FF6B35"}}>🎮 Quiz</button>
                {quizI===i && (
                  <div style={{marginTop:8,borderTop:"2px dashed #1a1a1a",paddingTop:8}}>
                    <input value={quizA} onChange={e=>setQuizA(e.target.value)} onKeyDown={e=>e.key==="Enter"&&checkQuiz(w)}
                      placeholder="Nederlandse vertaling…" style={{width:"100%",padding:"7px 10px",border:"2px solid #1a1a1a",borderRadius:8,fontFamily:"'Nunito',sans-serif",fontSize:13,boxSizing:"border-box"}}/>
                    <div style={{marginTop:6}}><Btn onClick={()=>checkQuiz(w)} disabled={quizL||!quizA.trim()} color="#FF6B35" tc="#fff" sm>{quizL?"…":"✓"}</Btn></div>
                    {quizL && <Spin/>}
                    <AIBox text={quizFB}/>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Word bank list */}
      {bank.length>0 && (
        <div style={{marginTop:24}}>
          <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:15,marginBottom:8}}>🗃️ Woordenbank ({bank.length})</div>
          <div style={{display:"flex",gap:8,marginBottom:8,flexWrap:"wrap"}}>
            {[["nieuw","#888"],["leren","#FF6B35"],["herhalen","#3B82F6"],["gekend","#58CC02"]].map(([s,c])=>(
              <Chip key={s} color={c} text={`${bank.filter(w=>w.status===s).length} ${s}`} sm/>
            ))}
          </div>
          <div style={{maxHeight:280,overflowY:"auto",border:"2.5px solid #1a1a1a",borderRadius:14,boxShadow:"3px 3px 0 #1a1a1a"}}>
            {bank.slice().reverse().map((w,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 14px",background:i%2===0?"#fff":"#F8FAFF",borderBottom:i<bank.length-1?"1px solid #f0f0f0":"none",flexWrap:"wrap"}}>
                <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:14,minWidth:80}}>{w.es}</div>
                <div style={{fontFamily:"'Nunito',sans-serif",fontSize:13,color:"#555",flex:1}}>{w.nl}</div>
                <Chip color={w.status==="gekend"?"#58CC02":w.status==="herhalen"?"#3B82F6":w.status==="leren"?"#FF6B35":"#888"} text={w.status} sm/>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CONJUGATION TABLE
// ─────────────────────────────────────────────────────────────
const PERSONEN = ["yo","tú","él/ella","nosotros","vosotros","ellos/ellas"];
function ConjTable({ data }){
  if(!data||!data.length) return null;
  const hc=["#FF6B35","#3B82F6","#58CC02"];
  return(
    <div style={{overflowX:"auto"}}>
      <table style={{width:"100%",borderCollapse:"separate",borderSpacing:0,border:"3px solid #1a1a1a",borderRadius:14,overflow:"hidden",boxShadow:"4px 4px 0 #1a1a1a",fontFamily:"'Nunito',sans-serif",fontSize:14}}>
        <thead><tr>
          <th style={{background:"#1a1a1a",color:"#fff",padding:"9px 12px",textAlign:"left",fontWeight:900,borderRight:"2px solid #333"}}>👤</th>
          {data.map((c,i)=><th key={i} style={{background:hc[i]||"#888",color:"#fff",padding:"9px 12px",textAlign:"center",fontWeight:900,borderRight:i<data.length-1?"2px solid rgba(255,255,255,.3)":"none"}}>-{c.ending}<br/><span style={{fontSize:11,opacity:.85}}>{c.example}</span></th>)}
        </tr></thead>
        <tbody>
          {PERSONEN.map((p,pi)=>(
            <tr key={pi} style={{background:pi%2===0?"#fff":"#F8FAFF"}}>
              <td style={{padding:"8px 12px",fontWeight:800,color:"#555",borderRight:"2px solid #e0e0e0",borderBottom:pi<5?"1px solid #f0f0f0":"none"}}>{p}</td>
              {data.map((c,ci)=><td key={ci} style={{padding:"8px 12px",textAlign:"center",fontWeight:900,borderRight:ci<data.length-1?"1px solid #f0f0f0":"none",borderBottom:pi<5?"1px solid #f0f0f0":"none"}}>{c.forms?.[pi]||"—"}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TAB 3: GRAMMATICA
// ─────────────────────────────────────────────────────────────
function GrammaticaTab({ grammar, rawText, level, sourceType, deepLKey, addXP }){
  const [uitleg,   setUitleg]   = useState("");
  const [tabel,    setTabel]    = useState(null);
  const [exs,      setExs]      = useState([]);
  const [loadU,    setLoadU]    = useState(false);
  const [loadE,    setLoadE]    = useState(false);
  const [answers,  setAnswers]  = useState({});
  const [feedback, setFeedback] = useState({});
  const [loadingFB,setLoadingFB]= useState({});
  const [cur,      setCur]      = useState(0);
  const [score,    setScore]    = useState({c:0,w:0});
  const [done,     setDone]     = useState(new Set());
  const [finished, setFinished] = useState(false);
  const [writeV,   setWriteV]   = useState("");
  const [writeFB,  setWriteFB]  = useState("");
  const [writeL,   setWriteL]   = useState(false);

  const hasSource = !!rawText?.trim();

  async function genUitleg(){
    setLoadU(true); setUitleg(""); setTabel(null);
    const uitlegPrompt =
`Grammatica: ${grammar} · Niveau: ${level}
${rawText?`TEKST:\n"""\n${snip(rawText,1000)}\n"""`:""}

Geef:
UITLEG: 2-3 zinnen intuïtieve uitleg (Paul Noble-stijl, Nederlands, niveau ${level})
VOORBEELDEN: 3 zinnen in ${grammar}${rawText?" gebaseerd op de brontekst":""}, formaat: "🇪🇸 [ES] | 🇳🇱 [NL]"
TIP: 1 ezelsbruggetje`;

    const tabelPrompt =
`Grammatica: ${grammar}. JSON conjugatietabel:
[{"ending":"ar","example":"hablar","forms":["","","","","",""]},{"ending":"er","example":"comer","forms":["","","","","",""]},{"ending":"ir","example":"vivir","forms":["","","","","",""]}]
Vul alle 6 vormen in voor ${grammar}. ALLEEN JSON.`;

    const [u, t] = await Promise.all([ai(uitlegPrompt), ai(tabelPrompt, true)]);
    setUitleg(u);
    const tp = parseJ(t); if(tp) setTabel(tp);
    setLoadU(false);
  }

  async function genOefeningen(){
    if(!hasSource) return;
    setLoadE(true); setExs([]); setCur(0); setScore({c:0,w:0}); setDone(new Set()); setFinished(false);

    const prompt =
`Grammatica: ${grammar} · Niveau: ${level}
TEKST:
"""
${snip(rawText,1800)}
"""

Genereer 8 oefeningen GEBASEERD OP DE BRONTEKST op niveau ${level}.
VERPLICHT voor invulzinnen: veld "werkwoord" (infinitief) en "opties" (4 vervoegingen, juiste NIET altijd eerste).

JSON array ALLEEN:
[
{"type":"invulzin","vraag":"Los peritos ___ el telefono.","werkwoord":"analizar","antwoord":"analizaron","opties":["analizaba","analizaron","analizan","analizara"],"uitleg":"3e pers mv ${grammar}"},
{"type":"invulzin","vraag":"El juez ___ la sentencia.","werkwoord":"dictar","antwoord":"dicto","opties":["dicta","dicto","dictaba","dictaran"],"uitleg":"3e pers ev ${grammar}"},
{"type":"vertaal","vraag":"De advocaat las het vonnis.","werkwoord":"","antwoord":"El abogado leyo el veredicto.","opties":[],"uitleg":"preterito indefinido"},
{"type":"correctie","vraag":"Yo tiene un problema.","werkwoord":"","antwoord":"Yo tengo un problema.","opties":[],"uitleg":"tener irregulier"}
]
Maak: 4 invulzinnen (elk met werkwoord+4 opties), 2 vertalingen, 2 correcties.`;

    const raw = await ai(prompt, true);
    let p = parseJ(raw);
    if(p && Array.isArray(p)){
      // Fix missing werkwoord / opties
      p = await Promise.all(p.map(async ex=>{
        if(ex.type!=="invulzin") return ex;
        if(!ex.werkwoord){
          const inf = await ai(`Infinitief van "${ex.antwoord}"? Geef alleen het woord.`);
          ex = {...ex, werkwoord: inf.trim().replace(/[^a-záéíóúüñ]/gi,"")};
        }
        if(!ex.opties || ex.opties.length<2){
          const or = await ai(`Werkwoord "${ex.werkwoord}", tijd ${grammar}. 4 vervoegingen (juiste="${ex.antwoord}"+3 fout). ALLEEN JSON array.`, true);
          const op = parseJ(or);
          if(op && Array.isArray(op)){
            const wc = op.includes(ex.antwoord)?op:[ex.antwoord,...op.slice(0,3)];
            ex = {...ex, opties: shuffle(wc)};
          }
        } else {
          ex = {...ex, opties: shuffle(ex.opties)};
        }
        return ex;
      }));
      // DeepL verify vertaal answers
      if(deepLKey){
        p = await Promise.all(p.map(async ex=>{
          if(ex.type==="vertaal"){
            try {
              const r = await fetch("https://api-free.deepl.com/v2/translate",{
                method:"POST", headers:{"Content-Type":"application/x-www-form-urlencoded","Authorization":`DeepL-Auth-Key ${deepLKey}`},
                body: new URLSearchParams({ text:ex.vraag, target_lang:"ES" })
              });
              const d = await r.json();
              const dl = d.translations?.[0]?.text;
              if(dl) return {...ex, antwoord:dl};
            } catch {}
          }
          return ex;
        }));
      }
      setExs(p);
    }
    setLoadE(false);
  }

  async function checkEx(i, ex){
    const ans = answers[i]; if(!ans?.trim()) return;
    setLoadingFB(p=>({...p,[i]:true}));
    const r = await ai(`Vraag: "${ex.vraag}"\nJuist: "${ex.antwoord}"\nLeerling: "${ans}"\nBegin met CORRECT of FOUT. Dan 1-2 zinnen uitleg.`);
    setFeedback(p=>({...p,[i]:r}));
    const ok = r.trim().toUpperCase().startsWith("CORRECT");
    setDone(s=>{ const ns=new Set(s); ns.add(i); return ns; });
    if(ok) setScore(s=>({...s,c:s.c+1})); else setScore(s=>({...s,w:s.w+1}));
    addXP(ok?15:5);
    setLoadingFB(p=>({...p,[i]:false}));
  }

  function reveal(i, ex){
    setFeedback(p=>({...p,[i]:`FOUT\n\nJuist: ${ex.antwoord}\n💡 ${ex.uitleg}`}));
    setDone(s=>{ const ns=new Set(s); ns.add(i); return ns; });
    setScore(s=>({...s,w:s.w+1}));
  }

  async function checkWrite(){
    if(!writeV.trim()) return;
    setWriteL(true);
    const r = await ai(`Grammatica: ${grammar} · Niveau: ${level}\nLeerling:\n"${writeV}"\nCorrigeer spelling, grammatica, stijl. ✅ goed, ❌ fout. Eindig met motiverende Spaanse zin.`);
    setWriteFB(r); addXP(XP_ACT); setWriteL(false);
  }

  const TC={invulzin:"#FFB800",vertaal:"#58CC02",correctie:"#A78BFA"};
  const TI={invulzin:"✏️",vertaal:"🔄",correctie:"🔍"};
  const prog = exs.length ? done.size/exs.length : 0;
  const curFB = feedback[cur];
  const curOk = curFB?.trim().toUpperCase().startsWith("CORRECT");

  return(
    <div>
      <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:22,marginBottom:16}}>🧠 {grammar} · <span style={{fontSize:13,color:"#888",fontWeight:700}}>{level}</span></div>

      {/* Uitleg */}
      <Btn onClick={genUitleg} disabled={loadU} color="#A78BFA" tc="#fff" full>
        {loadU?"⏳ Genereren…":"📖 Genereer uitleg + conjugatietabel"}
      </Btn>
      {loadU && <Spin label="Uitleg en tabel bouwen…"/>}

      {uitleg && (() => {
        const ps=(k)=>{ const m=uitleg.match(new RegExp(`${k}:?\\s*([\\s\\S]*?)(?=(?:UITLEG|VOORBEELDEN|TIP):|$)`,"i")); return m?.[1]?.trim()||""; };
        const u=ps("UITLEG"), v=ps("VOORBEELDEN"), t=ps("TIP");
        const vl=v.split("\n").map(l=>l.trim()).filter(l=>l.length>8);
        return(
          <div style={{display:"flex",flexDirection:"column",gap:14,marginTop:14}}>
            {u&&<Card bg="#FFF9DB"><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}><Chip color="#FFB800" text="📖 Uitleg"/><span style={{fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:13,color:"#7a5900"}}>{grammar} · {level}</span></div><div style={{fontFamily:"'Nunito',sans-serif",fontSize:14,lineHeight:1.8,whiteSpace:"pre-wrap"}}>{u}</div></Card>}
            {tabel&&<Card bg="#fff"><div style={{marginBottom:12}}><Chip color="#1a1a1a" text="📊 Conjugatietabel"/><span style={{fontFamily:"'Nunito',sans-serif",fontSize:12,color:"#666",marginLeft:8,fontStyle:"italic"}}>{grammar}</span></div><ConjTable data={tabel}/></Card>}
            {vl.length>0&&<Card bg="#E8F5E9"><Chip color="#58CC02" text={`💡 Voorbeelden${rawText?" uit bron":""}`}/><div style={{display:"flex",flexDirection:"column",gap:10,marginTop:12}}>{vl.slice(0,3).map((line,i)=>{ const pts=line.split("|").map(s=>s.trim()); const es=pts[0]?.replace(/^🇪🇸\s*/,"").replace(/^\d\.\s*/,""); const nl=pts[1]?.replace(/^🇳🇱\s*/,""); return(<div key={i} style={{background:"rgba(255,255,255,.75)",border:"2px solid #1a1a1a",borderRadius:12,padding:"10px 12px",boxShadow:"2px 2px 0 #1a1a1a"}}><div style={{fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:14,color:"#1a5c00",marginBottom:nl?3:0}}>{es||line}</div>{nl&&<div style={{fontFamily:"'Nunito',sans-serif",fontSize:12,color:"#555",fontStyle:"italic"}}>🇳🇱 {nl}</div>}</div>); })}</div></Card>}
            {t&&<Card bg="#EFF6FF"><div style={{display:"flex",gap:10}}><span style={{fontSize:24}}>💡</span><div><div style={{fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:13,color:"#1e3a8a",marginBottom:4}}>Geheugensteuntje</div><div style={{fontFamily:"'Nunito',sans-serif",fontSize:14,lineHeight:1.6,color:"#1e3a8a"}}>{t}</div></div></div></Card>}
          </div>
        );
      })()}

      {/* Oefeningen */}
      <div style={{margin:"20px 0 12px",display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
        <Btn onClick={genOefeningen} disabled={loadE||!hasSource} color="#FF6B35" tc="#fff">
          {loadE?"⏳ Bezig…":"🎮 Genereer 8 oefeningen"}
        </Btn>
        {!hasSource&&<div style={{fontFamily:"'Nunito',sans-serif",fontSize:12,color:"#FF6B35",fontWeight:800,background:"#FFF1F2",border:"2px solid #FF6B35",borderRadius:8,padding:"5px 10px"}}>⚠️ Laad eerst een bron</div>}
      </div>
      {loadE && <Spin label="Oefeningen genereren op basis van bron…"/>}

      {exs.length>0 && !finished && (
        <>
          {/* Progress */}
          <div style={{marginBottom:14}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
              <span style={{fontFamily:"'Nunito',sans-serif",fontSize:13,fontWeight:800,color:"#555"}}>Vraag {cur+1}/{exs.length}</span>
              <div style={{display:"flex",gap:12}}>
                <span style={{fontFamily:"'Nunito',sans-serif",fontSize:13,fontWeight:900,color:"#58CC02"}}>✅ {score.c}</span>
                <span style={{fontFamily:"'Nunito',sans-serif",fontSize:13,fontWeight:900,color:"#FF6B35"}}>❌ {score.w}</span>
              </div>
            </div>
            <div style={{height:10,background:"#e0e0e0",borderRadius:20,overflow:"hidden",border:"2px solid #1a1a1a"}}>
              <div style={{width:`${prog*100}%`,height:"100%",background:"linear-gradient(90deg,#58CC02,#FFE44D)",transition:"width .4s ease"}}/>
            </div>
            <div style={{display:"flex",gap:5,marginTop:8,flexWrap:"wrap"}}>
              {exs.map((_,i)=>(
                <button key={i} onClick={()=>setCur(i)} style={{width:28,height:28,borderRadius:"50%",border:"2.5px solid #1a1a1a",background:i===cur?"#FFE44D":done.has(i)?"#58CC02":"#fff",color:done.has(i)&&i!==cur?"#fff":"#1a1a1a",fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:11,cursor:"pointer",boxShadow:i===cur?"3px 3px 0 #1a1a1a":"1px 1px 0 #ccc"}}>{i+1}</button>
              ))}
            </div>
          </div>

          {/* Current exercise */}
          {(ex=>{
            const isCor = curFB?.trim().toUpperCase().startsWith("CORRECT");
            return(
              <Card bg={done.has(cur)?(isCor?"#E8F5E9":"#FFF1F2"):{invulzin:"#FFF9DB",vertaal:"#E8F5E9",correctie:"#FDF4FF"}[ex.type]||"#fff"} style={{borderLeft:`6px solid ${done.has(cur)?(isCor?"#58CC02":"#FF6B35"):TC[ex.type]||"#1a1a1a"}`}}>
                <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:10,flexWrap:"wrap"}}>
                  <Chip color={TC[ex.type]||"#888"} text={`${TI[ex.type]} ${ex.type}`}/>
                  {done.has(cur)&&<span style={{fontSize:18}}>{isCor?"✅":"❌"}</span>}
                </div>
                <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:16,marginBottom:12,lineHeight:1.5}}>
                  {ex.type==="invulzin"&&ex.werkwoord
                    ? <>{ex.vraag.split("___")[0]}<span style={{background:"#1a1a1a",color:"#FFE44D",borderRadius:8,padding:"2px 9px",fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:14,margin:"0 3px"}}>___ ({ex.werkwoord})</span>{ex.vraag.split("___")[1]}</>
                    : ex.vraag
                  }
                </div>
                {ex.type==="invulzin"&&ex.opties&&!done.has(cur)&&(
                  <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10,alignItems:"center"}}>
                    <span style={{fontFamily:"'Nunito',sans-serif",fontSize:12,fontWeight:800,color:"#888"}}>Kies:</span>
                    {ex.opties.map((opt,oi)=>(
                      <button key={oi} onClick={()=>setAnswers(p=>({...p,[cur]:opt}))} style={{padding:"6px 14px",background:answers[cur]===opt?"#FFB800":"#fff",color:answers[cur]===opt?"#fff":"#1a1a1a",border:"2.5px solid #1a1a1a",borderRadius:10,fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:14,cursor:"pointer",boxShadow:answers[cur]===opt?"2px 2px 0 #1a1a1a":"1px 1px 0 #ddd"}}>{opt}</button>
                    ))}
                  </div>
                )}
                {!done.has(cur)&&(
                  <div style={{display:"flex",gap:8,marginBottom:8}}>
                    <input value={answers[cur]||""} onChange={e=>setAnswers(p=>({...p,[cur]:e.target.value}))}
                      onKeyDown={e=>e.key==="Enter"&&checkEx(cur,ex)}
                      placeholder={ex.type==="invulzin"?"Typ het antwoord…":ex.type==="vertaal"?"Vertaal naar Spaans…":"Gecorrigeerde zin…"}
                      style={{flex:1,padding:"10px 14px",border:"3px solid #1a1a1a",borderRadius:12,fontFamily:"'Nunito',sans-serif",fontSize:14,boxShadow:"3px 3px 0 #1a1a1a"}}
                    />
                    <Btn onClick={()=>checkEx(cur,ex)} disabled={loadingFB[cur]||!answers[cur]?.trim()} color="#58CC02" tc="#fff">{loadingFB[cur]?"⏳":"✓"}</Btn>
                  </div>
                )}
                {loadingFB[cur]&&<Spin/>}
                {!done.has(cur)&&(
                  <div style={{display:"flex",gap:8}}>
                    <button onClick={()=>reveal(cur,ex)} style={{background:"none",border:"2px dashed #ffb0b0",borderRadius:8,padding:"4px 10px",fontFamily:"'Nunito',sans-serif",fontSize:12,fontWeight:800,color:"#FF6B35",cursor:"pointer"}}>👁 Toon antwoord</button>
                  </div>
                )}
                {curFB&&<div style={{marginTop:10,padding:"10px 14px",background:isCor?"rgba(88,204,2,.12)":"rgba(255,107,53,.1)",border:`2px solid ${isCor?"#58CC02":"#FF6B35"}`,borderRadius:12,fontFamily:"'Nunito',sans-serif",fontSize:14,lineHeight:1.6,whiteSpace:"pre-wrap",animation:"popIn .3s ease"}}>{curFB.replace(/^\s*CORRECT\s*\n?/i,"✅ ").replace(/^\s*FOUT\s*\n?/i,"❌ ")}</div>}
              </Card>
            );
          })(exs[cur])}

          <div style={{display:"flex",gap:10,justifyContent:"space-between",marginTop:8}}>
            <Btn onClick={()=>setCur(i=>Math.max(0,i-1))} disabled={cur===0} color="#fff" sm>← Vorige</Btn>
            <Btn onClick={()=>{ if(cur<exs.length-1) setCur(i=>i+1); else setFinished(true); }} color={done.has(cur)?"#58CC02":"#e0e0e0"} tc={done.has(cur)?"#fff":"#999"}>
              {cur===exs.length-1?"🏁 Resultaat":"Volgende →"}
            </Btn>
          </div>
        </>
      )}

      {finished&&(
        <Card bg="#1a1a1a" style={{textAlign:"center"}}>
          <div style={{fontSize:48,marginBottom:8}}>{score.c/exs.length>=.8?"🏆":score.c/exs.length>=.5?"💪":"📚"}</div>
          <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:32,color:"#fff",marginBottom:4}}>{score.c}/{exs.length}</div>
          <div style={{fontFamily:"'Nunito',sans-serif",fontSize:14,color:"#ccc",marginBottom:16}}>{score.c/exs.length>=.8?"Uitstekend!":score.c/exs.length>=.5?"Goed bezig!":"Blijf oefenen!"}</div>
          <Btn onClick={()=>{setCur(0);setScore({c:0,w:0});setDone(new Set());setFinished(false);}} color="#FFE44D" tc="#1a1a1a" full>🔄 Opnieuw</Btn>
        </Card>
      )}

      {/* Schrijfopdracht */}
      {exs.length>0&&(
        <Card bg="#EFF6FF" style={{marginTop:16}}>
          <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:15,marginBottom:4}}>✍️ Schrijfopdracht</div>
          <div style={{fontFamily:"'Nunito',sans-serif",fontSize:13,color:"#444",marginBottom:10}}>Schrijf 3-5 zinnen over het bron-thema in <strong>{grammar}</strong> op niveau <strong>{level}</strong>.</div>
          <textarea value={writeV} onChange={e=>setWriteV(e.target.value)}
            placeholder="Escribe aquí…" style={{width:"100%",minHeight:90,padding:"12px 14px",border:"3px solid #1a1a1a",borderRadius:12,fontFamily:"'Nunito',sans-serif",fontSize:14,resize:"vertical",boxSizing:"border-box",lineHeight:1.6,boxShadow:"3px 3px 0 #1a1a1a"}}
          />
          <div style={{marginTop:10}}><Btn onClick={checkWrite} disabled={writeL||!writeV.trim()} color="#3B82F6" tc="#fff">{writeL?"⏳…":"🤖 AI corrigeert"}</Btn></div>
          {writeL&&<Spin/>}
          <AIBox text={writeFB}/>
        </Card>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TAB 4: REFLECTIE
// ─────────────────────────────────────────────────────────────
function ReflectieTab({ grammar, level, addXP }){
  const [goed,  setGoed]  = useState("");
  const [lastig,setLastig]= useState("");
  const [plan,  setPlan]  = useState("");
  const [saved, setSaved] = useState(false);
  const [aiFB,  setAiFB]  = useState("");
  const [load,  setLoad]  = useState(false);
  const [mood,  setMood]  = useState(null);
  const MOODS = ["😅","🙂","😊","😄","🤩"];

  function saveRef(){
    const s=ls(), h=s.reflecties||[];
    // Update streak
    const yesterday=new Date(); yesterday.setDate(yesterday.getDate()-1);
    const yday=yesterday.toISOString().slice(0,10);
    let streak=s.streak||0;
    if(s.lastRef===yday) streak++;
    else if(s.lastRef!==today()) streak=1;
    h.push({goed,lastig,plan,grammar,level,mood,datum:today(),streak});
    ss({...s,reflecties:h,streak,lastRef:today()});
    setSaved(true); addXP(XP_ACT);
    setTimeout(()=>setSaved(false),3000);
  }

  async function getAI(){
    setLoad(true);
    const r=await ai(`Reflectie niveau ${level}:\nGoed: ${goed}\nLastig: ${lastig}\nPlan: ${plan}\nGrammatica: ${grammar}\n\nGeef aanmoediging (3 zinnen) + 1 tip voor ${level}. Eindig met motiverende Spaanse zin.`);
    setAiFB(r); setLoad(false);
  }

  const hist=(ls().reflecties||[]).slice(-4).reverse();

  return(
    <div>
      <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:22,marginBottom:16}}>⭐ Dagelijkse reflectie</div>
      <Card bg="#FFF9DB">
        <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:14,marginBottom:10}}>Hoe was het vandaag? 😊</div>
        <div style={{display:"flex",gap:10}}>
          {MOODS.map((m,i)=>(<button key={i} onClick={()=>setMood(i)} style={{fontSize:22,background:mood===i?"#FFE44D":"#fff",border:`3px solid ${mood===i?"#1a1a1a":"#ddd"}`,borderRadius:"50%",width:44,height:44,cursor:"pointer",boxShadow:mood===i?"3px 3px 0 #1a1a1a":"none"}}>{m}</button>))}
        </div>
      </Card>
      {[{l:"✅ Wat ging goed?",v:goed,s:setGoed,p:"Bijv. de invulzinnen…",bg:"#E8F5E9"},{l:"🤔 Wat was lastig?",v:lastig,s:setLastig,p:"Bijv. de Subjuntivo…",bg:"#FDF4FF"},{l:"🎯 Plan voor morgen",v:plan,s:setPlan,p:"Bijv. meer schrijven…",bg:"#EFF6FF"}].map(({l,v,s,p,bg})=>(
        <Card key={l} bg={bg}>
          <label style={{fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:14,display:"block",marginBottom:8}}>{l}</label>
          <textarea value={v} onChange={e=>s(e.target.value)} placeholder={p} style={{width:"100%",minHeight:70,padding:"10px 14px",border:"3px solid #1a1a1a",borderRadius:12,fontFamily:"'Nunito',sans-serif",fontSize:14,resize:"vertical",boxSizing:"border-box",lineHeight:1.5,boxShadow:"3px 3px 0 #1a1a1a"}}/>
        </Card>
      ))}
      <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:8}}>
        <Btn onClick={saveRef} color={saved?"#58CC02":"#FFE44D"} tc="#1a1a1a">{saved?`✅ Opgeslagen! +${XP_ACT} XP`:"💾 Sla op"}</Btn>
        <Btn onClick={getAI} disabled={load||(!goed&&!lastig)} color="#A78BFA" tc="#fff">{load?"⏳…":"🤖 AI feedback"}</Btn>
      </div>
      {load&&<Spin/>}
      <AIBox text={aiFB}/>
      {hist.length>0&&(
        <div style={{marginTop:20}}>
          <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:15,marginBottom:10}}>🗓 Vorige reflecties</div>
          {hist.map((r,i)=>(
            <Card key={i} bg={i===0?"#FFF9DB":"#fff"}>
              <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:6,marginBottom:6}}>
                <span style={{fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:13,color:"#FF6B35"}}>{r.datum}</span>
                <div style={{display:"flex",gap:5}}><Chip color="#A78BFA" text={r.grammar} sm/>{r.level&&<Chip color="#3B82F6" text={r.level} sm/>}{r.streak&&<Chip color="#FF6B35" text={`🔥${r.streak}`} sm/>}</div>
              </div>
              <div style={{fontFamily:"'Nunito',sans-serif",fontSize:13,lineHeight:1.8,color:"#333"}}>✅ {r.goed}<br/>🤔 {r.lastig}<br/>🎯 {r.plan}</div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// APP
// ─────────────────────────────────────────────────────────────
export default function App(){
  const s = ls();
  const [tab,        setTab]        = useState(0);
  const [grammar,    setGrammar]    = useState(s.grammar||"Presente");
  const [rawText,    setRawText]    = useState(s.rawText||"");
  const [sourceType, setSourceType] = useState(s.sourceType||"artikel");
  const [level,      setLevel]      = useState(s.level||"A2");
  const [numWords,   setNumWords]   = useState(s.numWords||15);
  const [deepLKey,   setDeepLKey]   = useState(s.deepLKey||"");
  const [xp,         setXp]         = useState(s.xp||0);

  // Persist all settings + rawText on every change
  useEffect(()=>{
    ss({...ls(), grammar, rawText, sourceType, level, numWords, deepLKey, xp});
  }, [grammar, rawText, sourceType, level, numWords, deepLKey, xp]);

  function addXP(n){ setXp(p=>p+n); }
  function handleDeepL(k){ setDeepLKey(k); }

  const dueCount = due(getBank()).length;

  return(
    <div style={{minHeight:"100vh",background:"#F8FAFF",fontFamily:"'Nunito',sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes popIn{from{opacity:0;transform:scale(.9) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}
        @keyframes slideDown{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes wiggle{0%,100%{transform:rotate(0)}25%{transform:rotate(-8deg)}75%{transform:rotate(8deg)}}
        input:focus,textarea:focus,select:focus{outline:none;border-color:#3B82F6!important;}
        ::-webkit-scrollbar{width:6px;}::-webkit-scrollbar-thumb{background:#ddd;border-radius:10px;}
      `}</style>

      {/* HEADER */}
      <div style={{background:"linear-gradient(135deg,#58CC02 0%,#3B82F6 55%,#A78BFA 100%)",padding:"16px 20px 12px",boxShadow:"0 4px 0 #1a1a1a"}}>
        <div style={{maxWidth:760,margin:"0 auto"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{background:"#fff",border:"3px solid #1a1a1a",borderRadius:14,width:44,height:44,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,boxShadow:"3px 3px 0 #1a1a1a",animation:"wiggle 3s ease-in-out infinite"}}>🦜</div>
              <div>
                <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:24,color:"#fff",letterSpacing:1}}>Habla!</div>
                <div style={{fontSize:11,color:"rgba(255,255,255,.85)",fontWeight:700}}>Leer Spaans · Aprende español</div>
              </div>
            </div>
            <div style={{display:"flex",gap:5,flexWrap:"wrap",justifyContent:"flex-end",alignItems:"center"}}>
              <div style={{background:"rgba(255,255,255,.2)",border:"2px solid rgba(255,255,255,.4)",borderRadius:10,padding:"3px 10px",fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:11,color:"#fff"}}>🧠 {grammar}</div>
              <div style={{background:"rgba(255,255,255,.2)",border:"2px solid rgba(255,255,255,.4)",borderRadius:10,padding:"3px 10px",fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:11,color:"#fff"}}>📊 {level}</div>
              {rawText&&<div style={{background:"#58CC02",border:"2px solid rgba(255,255,255,.5)",borderRadius:10,padding:"3px 10px",fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:11,color:"#fff"}}>📄 Bron ✓</div>}
              {dueCount>0&&<div style={{background:"#FF6B35",border:"2px solid rgba(255,255,255,.5)",borderRadius:10,padding:"3px 10px",fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:11,color:"#fff"}}>🔁 {dueCount}</div>}
            </div>
          </div>
          <XPBar xp={xp}/>
        </div>
      </div>

      {/* TABS */}
      <div style={{display:"flex",background:"#fff",borderBottom:"3px solid #1a1a1a",overflowX:"auto"}}>
        {TABS.map((t,i)=>(
          <button key={i} onClick={()=>setTab(i)} style={{flex:"1 1 0",minWidth:58,padding:"10px 4px",border:"none",borderBottom:tab===i?`4px solid ${COLORS[i]}`:"4px solid transparent",background:tab===i?"#F8FAFF":"#fff",cursor:"pointer",fontFamily:"'Nunito',sans-serif",fontWeight:tab===i?900:700,fontSize:11,color:tab===i?COLORS[i]:"#666",position:"relative"}}>
            <div style={{fontSize:19,marginBottom:1}}>{t.icon}</div>
            <div>{t.nl}</div>
            {i===0&&dueCount>0&&<div style={{position:"absolute",top:5,right:5,width:14,height:14,background:"#FF6B35",border:"2px solid #1a1a1a",borderRadius:"50%",fontSize:8,fontWeight:900,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center"}}>{dueCount}</div>}
          </button>
        ))}
      </div>

      {/* CONTENT */}
      <div style={{maxWidth:760,margin:"0 auto",padding:"20px 16px 90px",animation:"slideDown .25s ease"}}>
        {tab===0 && <VandaagTab setTab={setTab} level={level} setLevel={setLevel} grammar={grammar} setGrammar={setGrammar} rawText={rawText} addXP={addXP}/>}
        {tab===1 && <BronTab grammar={grammar} rawText={rawText} setRawText={setRawText} sourceType={sourceType} setSourceType={setSourceType} level={level} num={numWords} setNum={setNumWords} deepLKey={deepLKey} setDeepLKey={handleDeepL} addXP={addXP} setTab={setTab}/>}
        {tab===2 && <WoordenTab rawText={rawText} num={numWords} sourceType={sourceType} level={level} deepLKey={deepLKey} addXP={addXP}/>}
        {tab===3 && <GrammaticaTab grammar={grammar} rawText={rawText} level={level} sourceType={sourceType} deepLKey={deepLKey} addXP={addXP}/>}
        {tab===4 && <ReflectieTab grammar={grammar} level={level} addXP={addXP}/>}
      </div>

      {/* BOTTOM NAV */}
      <div style={{position:"fixed",bottom:0,left:0,right:0,background:"#fff",borderTop:"3px solid #1a1a1a",display:"flex",zIndex:100}}>
        {TABS.map((t,i)=>(
          <button key={i} onClick={()=>setTab(i)} style={{flex:1,padding:"10px 0",border:"none",background:tab===i?COLORS[i]:"#fff",cursor:"pointer",fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:11,color:tab===i?"#fff":"#888",position:"relative"}}>
            <div style={{fontSize:19}}>{t.icon}</div>
            <div>{t.nl}</div>
            {i===0&&dueCount>0&&tab!==0&&<div style={{position:"absolute",top:3,right:"20%",width:13,height:13,background:"#FF6B35",border:"2px solid #fff",borderRadius:"50%",fontSize:8,fontWeight:900,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center"}}>{dueCount}</div>}
          </button>
        ))}
      </div>
    </div>
  );
}
