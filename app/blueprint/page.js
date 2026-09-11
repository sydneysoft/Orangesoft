"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const C = {
  bg: "#061725",
  panel: "rgba(5,22,36,.82)",
  line: "#2b6b92",
  text: "#d7f2ff",
  muted: "#77a8c3",
  hi: "#9addff",
  danger: "#ffb6b6",
};

const aliases = [
  [/\bxochu\b/gi, "хочу"],
  [/\bgavaret\b/gi, "говорити"],
  [/\bkole\b/gi, "коли"],
  [/\babo\b/gi, "або"],
  [/\bjesli\b/gi, "jeśli"],
  [/\bukrainski\b/gi, "український"],
  [/\bruski\b/gi, "російський"],
];

function normalize(value) {
  let text = value.replace(/\./g, " ").replace(/_/g, " ");
  aliases.forEach(([pattern, replacement]) => {
    text = text.replace(pattern, replacement);
  });
  return text.replace(/\s+/g, " ").trim();
}

function parse(raw) {
  let m;
  if ((m = raw.match(/^zdrobic\s*(?:\(\s*)?["']([\s\S]*?)["']\s*\)?\s*$/i))) return { type: "execute", body: m[1] };
  if ((m = raw.match(/^reflect\s*\(([\s\S]*)\)\s*$/i))) return { type: "reflect", body: m[1] };
  if ((m = raw.match(/^inspect\s*\(([\s\S]*)\)\s*$/i))) return { type: "inspect", body: m[1] };
  if ((m = raw.match(/^modify\s*\(([\s\S]*)\)\s*$/i))) return { type: "modify", body: m[1] };
  if ((m = raw.match(/^find\s*\(([\s\S]*)\)\s*$/i))) return { type: "find", body: m[1] };
  if ((m = raw.match(/^deploy\s*\(([\s\S]*)\)\s*$/i))) return { type: "deploy", body: m[1] };
  return { type: "unknown", body: raw };
}

function localResult(command) {
  const labels = {
    execute: "EXECUTION REQUEST",
    reflect: "REFLECTION QUERY",
    inspect: "INSPECTION REQUEST",
    modify: "MODIFICATION REQUEST",
    find: "SEARCH REQUEST",
    deploy: "DEPLOYMENT REQUEST",
  };

  if (command.type === "unknown") {
    return `SYNTAX ERROR\nRAW: ${command.body}\n\nSUPPORTED:\nzdrobic(\"...\")\nreflect(...)\ninspect(...)\nmodify(...)\nfind(...)\ndeploy(...)`;
  }

  return `${labels[command.type]}\nRAW: ${command.body}\nNORMALIZED: ${normalize(command.body)}\nLANGUAGE: AUTO / MIXED\nSTATUS: PARSED`;
}

export default function BlueprintPage() {
  const [input, setInput] = useState("");
  const [masked, setMasked] = useState(false);
  const [status, setStatus] = useState("READY");
  const [seq, setSeq] = useState(2);
  const [entries, setEntries] = useState([
    {
      id: 1,
      kind: "SYSTEM RESULT",
      text: 'CONSOLE READY\nMODE: WEB\nLANGUAGE: AUTO-DETECT\nPARSER: ACTIVE\n\nExample:\nzdrobic("website.for.comicbook")',
      user: false,
      error: false,
    },
  ]);
  const logRef = useRef(null);

  useEffect(() => {
    const fn = (e) => {
      if (e.key === "Escape") setMasked((v) => !v);
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [entries]);

  const time = useMemo(() => new Date().toLocaleString(), [entries, status]);

  async function run() {
    const raw = input.trim();
    if (!raw) return;

    const command = parse(raw);
    const commandId = seq;
    const resultId = seq + 1;
    setEntries((v) => [...v, { id: commandId, kind: "COMMAND", text: raw, user: true, error: command.type === "unknown" }]);
    setSeq(resultId + 1);
    setInput("");
    setStatus("EXECUTING");

    let output = localResult(command);
    try {
      const response = await fetch("/api/command", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ raw, type: command.type, body: command.body, normalized: normalize(command.body) }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data?.output) output = data.output;
      }
    } catch {}

    setEntries((v) => [...v, { id: resultId, kind: "SYSTEM RESULT", text: output, user: false, error: command.type === "unknown" }]);
    setStatus("READY");
  }

  const btn = {
    border: `1px solid ${C.line}`,
    background: "transparent",
    color: C.text,
    padding: "7px 10px",
    font: "inherit",
    fontSize: 10,
    cursor: "pointer",
    textTransform: "uppercase",
    letterSpacing: ".06em",
  };

  return (
    <div style={{position:"fixed",inset:0,zIndex:9999,display:"grid",gridTemplateRows:"46px 1fr 26px",color:C.text,fontFamily:'ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono",monospace',backgroundColor:C.bg,backgroundImage:"linear-gradient(rgba(130,211,255,.13) 1px,transparent 1px),linear-gradient(90deg,rgba(130,211,255,.13) 1px,transparent 1px),linear-gradient(rgba(130,211,255,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(130,211,255,.045) 1px,transparent 1px)",backgroundSize:"32px 32px,32px 32px,8px 8px,8px 8px",overflow:"hidden"}}>
      <header style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 13px",borderBottom:`1px solid ${C.line}`,background:"rgba(5,20,33,.94)"}}>
        <div style={{display:"flex",gap:11,alignItems:"center",fontSize:11,letterSpacing:".14em",textTransform:"uppercase"}}>
          <span style={{width:23,height:23,border:`1px solid ${C.hi}`,display:"grid",placeItems:"center",color:C.hi}}>+</span>
          <span>ORANGESOFT / TECHNICAL DRAWING CONSOLE</span>
        </div>
        <div style={{display:"flex",gap:7}}>
          <button style={btn} onClick={() => setMasked((v) => !v)}>Drawing View</button>
          <button style={btn} onClick={() => setEntries([])}>Clear</button>
        </div>
      </header>

      <main style={{display:"grid",gridTemplateColumns:"210px minmax(0,1fr) 260px",minHeight:0}}>
        <aside style={{padding:12,borderRight:`1px solid ${C.line}`,background:C.panel,overflow:"auto"}}>
          <div style={{fontSize:9,color:C.muted,letterSpacing:".18em",textTransform:"uppercase",margin:"6px 0 10px"}}>Project Index</div>
          <div style={{fontSize:11,lineHeight:1.75}}>
            <div>▾ 00 GENERAL</div><div>&nbsp;&nbsp;A-01 Console</div><div>&nbsp;&nbsp;A-02 Notes</div><div>▸ 01 STRUCTURE</div><div>▸ 02 SYSTEMS</div><div>▸ 03 ARCHIVE</div>
          </div>
          <div style={{fontSize:9,color:C.muted,letterSpacing:".18em",textTransform:"uppercase",margin:"24px 0 10px"}}>Command Grammar</div>
          <div style={{fontSize:11,lineHeight:1.7}}>
            {[['zdrobic("...")','create / execute'],['reflect(...)','ask / reason'],['inspect(...)','check / review'],['modify(...)','change / edit'],['find(...)','search'],['deploy(...)','publish request']].map(([a,b]) => <div key={a} style={{marginBottom:7}}><div style={{color:C.hi}}>{a}</div><div style={{color:C.muted,fontSize:10}}>{b}</div></div>)}
          </div>
          <div style={{fontSize:9,color:C.muted,letterSpacing:".18em",textTransform:"uppercase",margin:"24px 0 10px"}}>Language</div>
          <div style={{color:C.muted,fontSize:10,lineHeight:1.5}}>EN · PL · UK · RU · MIXED<br/>Dots may replace spaces.<br/>Transliteration accepted.</div>
        </aside>

        <section style={{position:"relative",padding:16,minWidth:0,overflow:"hidden"}}>
          <div style={{position:"absolute",inset:16,border:`1px solid ${C.line}`,opacity:.4,pointerEvents:"none"}} />
          <div style={{position:"absolute",left:"50%",top:16,bottom:16,borderLeft:`1px dashed ${C.hi}`,opacity:.25}} />
          <div style={{position:"absolute",top:"50%",left:16,right:16,borderTop:`1px dashed ${C.hi}`,opacity:.25}} />

          <div style={{height:"100%",maxWidth:960,margin:"auto",position:"relative",zIndex:2,display:"flex",flexDirection:"column"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"end",padding:"8px 0 11px",borderBottom:`1px solid ${C.line}`}}>
              <h1 style={{margin:0,fontSize:17,fontWeight:500,letterSpacing:".14em",textTransform:"uppercase"}}>Command Console</h1>
              <span style={{fontSize:9,color:C.muted}}>DWG A-01 · REV 10 · WEB MODE</span>
            </div>

            <div ref={logRef} style={{flex:1,overflow:"auto",padding:"15px 5px 132px"}}>
              {entries.map((entry) => (
                <div key={entry.id} style={{maxWidth:"84%",margin:entry.user?"0 0 17px auto":"0 0 17px",textAlign:entry.user?"right":"left",fontSize:12,lineHeight:1.55}}>
                  <div style={{fontSize:9,color:C.muted,letterSpacing:".15em",textTransform:"uppercase",marginBottom:4}}>{entry.kind} {String(entry.id).padStart(3,"0")}</div>
                  <div style={{display:"inline-block",maxWidth:"100%",textAlign:"left",whiteSpace:"pre-wrap",overflowWrap:"anywhere",padding:"10px 12px",border:`1px ${entry.user?"dashed":"solid"} ${entry.error?"#855":C.line}`,background:"rgba(7,31,50,.88)",color:entry.error?C.danger:C.text}}>{entry.text}</div>
                </div>
              ))}
            </div>

            <div style={{position:"absolute",left:0,right:0,bottom:0,paddingTop:36,background:"linear-gradient(transparent,rgba(6,23,37,.99) 28%)"}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:8}}>
                <textarea value={input} onChange={(e)=>setInput(e.target.value)} onKeyDown={(e)=>{if((e.ctrlKey||e.metaKey)&&e.key==="Enter"){e.preventDefault();run();}}} spellCheck={false} placeholder='zdrobic("executable.website.in.browser")' style={{height:77,resize:"none",outline:"none",padding:"11px 12px",border:`1px solid ${C.line}`,background:"rgba(5,23,37,.95)",color:C.text,font:"inherit",fontSize:12}} />
                <button style={{...btn,minWidth:90}} onClick={run}>Execute</button>
              </div>
              <div style={{marginTop:6,fontSize:9,color:C.muted}}>CTRL/⌘ + ENTER = EXECUTE · ESC = INSTANT DRAWING VIEW</div>
            </div>
          </div>

          {masked && <div style={{position:"absolute",inset:0,zIndex:20,background:C.bg,display:"grid",placeItems:"center"}}><div style={{width:"70%",height:"55%",border:`1px solid ${C.line}`,position:"relative"}}><div style={{position:"absolute",left:"10%",top:"12%",width:"36%",height:"30%",border:`1px solid ${C.line}`}}/><div style={{position:"absolute",right:"10%",bottom:"12%",width:"34%",height:"38%",border:`1px dashed ${C.line}`}}/></div></div>}
        </section>

        <aside style={{padding:12,borderLeft:`1px solid ${C.line}`,background:C.panel,overflow:"auto"}}>
          <div style={{fontSize:9,color:C.muted,letterSpacing:".18em",textTransform:"uppercase",margin:"6px 0 10px"}}>Drawing Metadata</div>
          {[['FILE','ORANGE_A01'],['STATE',status],['REVISION','10'],['MODE','WEB'],['LANGUAGE','AUTO']].map(([k,v]) => <div key={k} style={{display:"grid",gridTemplateColumns:"1fr auto",gap:5,fontSize:10,lineHeight:1.7,color:C.muted}}><span>{k}</span><b style={{fontWeight:400,color:C.text}}>{v}</b></div>)}
          <div style={{height:130,border:`1px solid ${C.line}`,margin:"12px 0",position:"relative"}}><div style={{position:"absolute",left:12,top:14,width:66,height:42,border:`1px solid ${C.hi}`}}/><div style={{position:"absolute",right:12,bottom:15,width:80,height:52,border:`1px dashed ${C.hi}`}}/></div>
          <div style={{fontSize:9,color:C.muted,letterSpacing:".18em",textTransform:"uppercase",margin:"6px 0 10px"}}>Execution Model</div>
          <div style={{color:C.muted,fontSize:10,lineHeight:1.5}}>The parser runs in-browser. If a secure /api/command endpoint is configured, this page will use it automatically.</div>
        </aside>
      </main>

      <footer style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 10px",fontSize:9,color:C.muted,borderTop:`1px solid ${C.line}`,background:"rgba(5,20,33,.94)"}}><span>ORANGESOFT / DRAWING CONTROL SYSTEM</span><span>{time}</span></footer>
    </div>
  );
}
