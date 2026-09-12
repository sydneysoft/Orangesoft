"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const C={bg:"#061725",panel:"rgba(5,22,36,.82)",line:"#2b6b92",text:"#d7f2ff",muted:"#77a8c3",hi:"#9addff",danger:"#ffb6b6",ok:"#9ce6b2"};
const aliases=[[/\bxochu\b/gi,"хочу"],[/\bgavaret\b/gi,"говорити"],[/\bkole\b/gi,"коли"],[/\babo\b/gi,"або"],[/\bjesli\b/gi,"jeśli"],[/\bukrainski\b/gi,"український"],[/\bruski\b/gi,"російський"]];
const known=new Set(["reflect","zdrobic","inspect","modify","find","deploy"]);
const labels={reflect:"ANALYZE / ANSWER",zdrobic:"EXECUTE / CREATE",inspect:"INSPECT",modify:"MODIFY",find:"SEARCH",deploy:"DEPLOY"};

function normalize(value){let text=String(value||"").replace(/\./g," ").replace(/_/g," ");aliases.forEach(([p,r])=>text=text.replace(p,r));return text.replace(/\s+/g," ").trim();}
function splitTopLevel(text){const parts=[];let start=0,depth=0,quote=null,escape=false;for(let i=0;i<text.length;i++){const ch=text[i];if(escape){escape=false;continue}if(ch==="\\"){escape=true;continue}if(quote){if(ch===quote)quote=null;continue}if(ch==='"'||ch==="'"){quote=ch;continue}if(ch==='('){depth++;continue}if(ch===')'){depth=Math.max(0,depth-1);continue}if(ch==='.'&&depth===0){const part=text.slice(start,i).trim();if(part)parts.push(part);start=i+1}}const last=text.slice(start).trim();if(last)parts.push(last);return parts}
function unwrapQuoted(s){const t=s.trim();if((t.startsWith('"')&&t.endsWith('"'))||(t.startsWith("'")&&t.endsWith("'")))return t.slice(1,-1);return t}
function parseExpression(expr,path=""){const m=expr.match(/^([a-zA-Z_][\w-]*)\s*\(([\s\S]*)\)$/);if(!m)return [{id:path||"1",type:"unknown",raw:expr,body:expr,label:"UNKNOWN"}];const type=m[1].toLowerCase(),body=m[2].trim();const node={id:path||"1",type,raw:expr,body:unwrapQuoted(body),label:labels[type]||type.toUpperCase()};const out=[node];if(known.has(type)&&body&&!((body.startsWith('"')&&body.endsWith('"'))||(body.startsWith("'")&&body.endsWith("'")))){const nested=splitTopLevel(body);if(nested.length>1||nested.some(x=>/^[a-zA-Z_][\w-]*\s*\(/.test(x)))nested.forEach((child,i)=>out.push(...parseExpression(child,`${node.id}.${i+1}`)))}return out}
function parseProgram(raw){const plan=[];splitTopLevel(raw.trim()).forEach((expr,i)=>plan.push(...parseExpression(expr,String(i+1))));return plan}
function formatPlan(raw,plan){const lines=plan.map((s,i)=>`${i+1}. ${s.label}${s.body?` → ${normalize(s.body).slice(0,220)}`:""}`);const invalid=plan.some(s=>!known.has(s.type));return `COMMAND PROGRAM\n${lines.join("\n")}\n\n${invalid?"STATUS: SYNTAX ERROR":"STATUS: AGENT UNAVAILABLE"}\n${invalid?"The command contains an unsupported expression.":"The browser could not complete an authenticated agent request. No execution is being claimed."}\n\nRAW:\n${raw}`}

function imagePreviews(activity){
  const previews=[];
  const seen=new Set();
  for(const item of Array.isArray(activity)?activity:[]){
    if(item?.tool!=="write_repo_file"||item?.ok!==true)continue;
    const result=item.result||{};
    const repo=String(result.repo||"");
    const path=String(result.path||"");
    const commit=String(result.commit||"");
    if(!repo||!path||!commit||!(/\.(svg|png|jpe?g|webp|gif)$/i.test(path)))continue;
    const key=`${repo}:${commit}:${path}`;
    if(seen.has(key))continue;
    seen.add(key);
    const encodedPath=path.split("/").map(encodeURIComponent).join("/");
    previews.push({repo,path,commit,url:`https://raw.githubusercontent.com/${repo}/${commit}/${encodedPath}`});
  }
  return previews;
}

export default function BlueprintPage(){
  const [input,setInput]=useState("");
  const [masked,setMasked]=useState(false);
  const [status,setStatus]=useState("READY");
  const [agent,setAgent]=useState("DISCONNECTED");
  const [accessKey,setAccessKey]=useState("");
  const [seq,setSeq]=useState(2);
  const [entries,setEntries]=useState([{id:1,kind:"SYSTEM RESULT",text:'CONSOLE READY\nMODE: AGENT COMMAND PROGRAM\nCHAIN PARSER: ACTIVE\nBACKEND: /api/command\n\nSet AGENT KEY, then run:\nzdrobic("orangesoft.logo")',user:false,error:false,previews:[]}]);
  const logRef=useRef(null);

  useEffect(()=>{setAccessKey(sessionStorage.getItem("blueprint.key")||"");const fn=e=>{if(e.key==="Escape")setMasked(v=>!v)};window.addEventListener("keydown",fn);return()=>window.removeEventListener("keydown",fn)},[]);
  useEffect(()=>{if(logRef.current)logRef.current.scrollTop=logRef.current.scrollHeight},[entries]);
  const time=useMemo(()=>new Date().toLocaleString(),[entries,status]);

  function connectAgent(){
    const key=window.prompt("Blueprint access key (stored only for this browser tab/session):",accessKey);
    if(key===null)return;
    const clean=key.trim();
    setAccessKey(clean);
    if(clean){sessionStorage.setItem("blueprint.key",clean);setAgent("KEY SET")}
    else{sessionStorage.removeItem("blueprint.key");setAgent("DISCONNECTED")}
  }

  async function run(){
    const raw=input.trim();if(!raw)return;
    const plan=parseProgram(raw),invalid=plan.some(s=>!known.has(s.type)),commandId=seq,resultId=seq+1;
    setEntries(v=>[...v,{id:commandId,kind:"COMMAND",text:raw,user:true,error:invalid,previews:[]}]);setSeq(resultId+1);setInput("");setStatus("EXECUTING");
    let output=formatPlan(raw,plan),error=invalid,previews=[];
    if(!invalid){
      try{
        const response=await fetch("/api/command",{method:"POST",headers:{"content-type":"application/json",...(accessKey?{"x-blueprint-key":accessKey}:{})},body:JSON.stringify({raw,plan:plan.map(s=>({id:s.id,type:s.type,body:s.body,normalized:normalize(s.body)}))})});
        let data={};try{data=await response.json()}catch{}
        previews=imagePreviews(data?.activity);
        if(response.ok&&data?.executed===true){setAgent("CONNECTED");output=data.output||"EXECUTION COMPLETED";error=false}
        else{if(response.status===401)setAgent("AUTH REQUIRED");else if(response.status===503)setAgent("SERVER SETUP");else setAgent("DISCONNECTED");output=data?.output||formatPlan(raw,plan);error=true}
      }catch(e){setAgent("DISCONNECTED");output=`AGENT REQUEST FAILED\n${e instanceof Error?e.message:String(e)}\n\n${formatPlan(raw,plan)}`;error=true}
    }
    setEntries(v=>[...v,{id:resultId,kind:"SYSTEM RESULT",text:output,user:false,error,previews}]);setStatus("READY");
  }

  const btn={border:`1px solid ${C.line}`,background:"transparent",color:C.text,padding:"7px 10px",font:"inherit",fontSize:10,cursor:"pointer",textTransform:"uppercase",letterSpacing:".06em"};
  const metaColor=v=>v==="CONNECTED"||v==="SET"||v==="KEY SET"?C.ok:(String(v).includes("REQUIRED")||String(v).includes("MISSING")||v==="DISCONNECTED"||v==="SERVER SETUP")?C.danger:C.text;

  return <div style={{position:"fixed",inset:0,zIndex:9999,display:"grid",gridTemplateRows:"46px 1fr 26px",color:C.text,fontFamily:'ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono",monospace',backgroundColor:C.bg,backgroundImage:"linear-gradient(rgba(130,211,255,.13) 1px,transparent 1px),linear-gradient(90deg,rgba(130,211,255,.13) 1px,transparent 1px),linear-gradient(rgba(130,211,255,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(130,211,255,.045) 1px,transparent 1px)",backgroundSize:"32px 32px,32px 32px,8px 8px,8px 8px",overflow:"hidden"}}>
    <header style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 13px",borderBottom:`1px solid ${C.line}`,background:"rgba(5,20,33,.94)"}}>
      <div style={{display:"flex",gap:11,alignItems:"center",fontSize:11,letterSpacing:".14em",textTransform:"uppercase"}}><span style={{width:23,height:23,border:`1px solid ${C.hi}`,display:"grid",placeItems:"center",color:C.hi}}>+</span><span>ORANGESOFT / TECHNICAL DRAWING CONSOLE</span></div>
      <div style={{display:"flex",gap:7}}><button style={{...btn,borderColor:accessKey?C.ok:C.line}} onClick={connectAgent}>{accessKey?"Agent Key ✓":"Agent Key"}</button><button style={btn} onClick={()=>setMasked(v=>!v)}>Drawing View</button><button style={btn} onClick={()=>setEntries([])}>Clear</button></div>
    </header>
    <main style={{display:"grid",gridTemplateColumns:"210px minmax(0,1fr) 260px",minHeight:0}}>
      <aside style={{padding:12,borderRight:`1px solid ${C.line}`,background:C.panel,overflow:"auto"}}><div style={{fontSize:9,color:C.muted,letterSpacing:".18em",textTransform:"uppercase",margin:"6px 0 10px"}}>Command Grammar</div><div style={{fontSize:11,lineHeight:1.7}}>{[['reflect(...)','analyze / answer'],['zdrobic(...)','execute / create'],['inspect(...)','check / review'],['modify(...)','change / edit'],['find(...)','search'],['deploy(...)','publish']].map(([a,b])=><div key={a} style={{marginBottom:7}}><div style={{color:C.hi}}>{a}</div><div style={{color:C.muted,fontSize:10}}>{b}</div></div>)}</div><div style={{fontSize:9,color:C.muted,letterSpacing:".18em",textTransform:"uppercase",margin:"24px 0 10px"}}>Chains</div><div style={{color:C.muted,fontSize:10,lineHeight:1.55}}>Top-level dots chain operations.<br/><br/>reflect(...).zdrobic(modify().deploy())<br/><br/>Dots inside arguments still work as word separators.</div></aside>
      <section style={{position:"relative",padding:16,minWidth:0,overflow:"hidden"}}><div style={{position:"absolute",inset:16,border:`1px solid ${C.line}`,opacity:.4,pointerEvents:"none"}}/><div style={{height:"100%",maxWidth:960,margin:"auto",position:"relative",zIndex:2,display:"flex",flexDirection:"column"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"end",padding:"8px 0 11px",borderBottom:`1px solid ${C.line}`}}><h1 style={{margin:0,fontSize:17,fontWeight:500,letterSpacing:".14em",textTransform:"uppercase"}}>Command Console</h1><span style={{fontSize:9,color:C.muted}}>DWG A-01 · REV 13 · ARTIFACT PREVIEW</span></div><div ref={logRef} style={{flex:1,overflow:"auto",padding:"15px 5px 132px"}}>{entries.map(entry=><div key={entry.id} style={{maxWidth:"86%",margin:entry.user?"0 0 17px auto":"0 0 17px",textAlign:entry.user?"right":"left",fontSize:12,lineHeight:1.55}}><div style={{fontSize:9,color:C.muted,letterSpacing:".15em",textTransform:"uppercase",marginBottom:4}}>{entry.kind} {String(entry.id).padStart(3,"0")}</div><div style={{display:"inline-block",maxWidth:"100%",textAlign:"left",whiteSpace:"pre-wrap",overflowWrap:"anywhere",padding:"10px 12px",border:`1px ${entry.user?"dashed":"solid"} ${entry.error?"#855":C.line}`,background:"rgba(7,31,50,.88)",color:entry.error?C.danger:C.text}}>{entry.text}</div>{entry.previews?.length>0&&<div style={{display:"grid",gap:9,marginTop:9,textAlign:"left"}}>{entry.previews.map(preview=><div key={`${preview.commit}:${preview.path}`} style={{border:`1px solid ${C.line}`,background:"rgba(7,31,50,.94)",padding:8}}><div style={{fontSize:9,color:C.muted,letterSpacing:".13em",textTransform:"uppercase",marginBottom:7}}>Artifact Preview · {preview.path}</div><a href={preview.url} target="_blank" rel="noreferrer" style={{display:"block",background:"rgba(255,255,255,.96)",border:`1px solid ${C.line}`,padding:10}}><img src={preview.url} alt={preview.path} style={{display:"block",width:"100%",maxHeight:320,objectFit:"contain"}}/></a><div style={{marginTop:6,fontSize:9,color:C.muted}}>COMMIT {preview.commit.slice(0,12)} · CLICK IMAGE TO OPEN</div></div>)}</div>}</div>)}</div><div style={{position:"absolute",left:0,right:0,bottom:0,paddingTop:36,background:"linear-gradient(transparent,rgba(6,23,37,.99) 28%)"}}><div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:8}}><textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if((e.ctrlKey||e.metaKey)&&e.key==="Enter"){e.preventDefault();run()}}} spellCheck={false} placeholder='zdrobic("orangesoft.logo")' style={{height:77,resize:"none",outline:"none",padding:"11px 12px",border:`1px solid ${C.line}`,background:"rgba(5,23,37,.95)",color:C.text,font:"inherit",fontSize:12}}/><button style={{...btn,minWidth:90}} onClick={run}>Execute</button></div><div style={{marginTop:6,fontSize:9,color:C.muted}}>CTRL/⌘ + ENTER = EXECUTE · ESC = DRAWING VIEW · IMAGE WRITES SHOW PREVIEWS</div></div></div>{masked&&<div style={{position:"absolute",inset:0,zIndex:20,background:C.bg,display:"grid",placeItems:"center"}}><div style={{width:"70%",height:"55%",border:`1px solid ${C.line}`,position:"relative"}}><div style={{position:"absolute",left:"10%",top:"12%",width:"36%",height:"30%",border:`1px solid ${C.line}`}}/><div style={{position:"absolute",right:"10%",bottom:"12%",width:"34%",height:"38%",border:`1px dashed ${C.line}`}}/></div></div>}</section>
      <aside style={{padding:12,borderLeft:`1px solid ${C.line}`,background:C.panel,overflow:"auto"}}><div style={{fontSize:9,color:C.muted,letterSpacing:".18em",textTransform:"uppercase",margin:"6px 0 10px"}}>Execution State</div>{[['STATE',status],['PARSER','CONNECTED'],['BACKEND','/api/command'],['KEY',accessKey?'SET':'MISSING'],['AGENT',agent]].map(([k,v])=><div key={k} style={{display:"grid",gridTemplateColumns:"1fr auto",gap:5,fontSize:10,lineHeight:1.7,color:C.muted}}><span>{k}</span><b style={{fontWeight:400,color:metaColor(v)}}>{v}</b></div>)}<div style={{marginTop:18,fontSize:9,color:C.muted,letterSpacing:".18em",textTransform:"uppercase"}}>Security</div><div style={{marginTop:8,color:C.muted,fontSize:10,lineHeight:1.55}}>The access key stays in sessionStorage for this tab. OpenAI and GitHub credentials remain server-side. The backend is restricted to the OrangeSoft and StoryLingo repositories.</div></aside>
    </main>
    <footer style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 10px",fontSize:9,color:C.muted,borderTop:`1px solid ${C.line}`,background:"rgba(5,20,33,.94)"}}><span>ORANGESOFT / DRAWING CONTROL SYSTEM</span><span>{time}</span></footer>
  </div>
}
