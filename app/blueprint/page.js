"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const C={bg:"#080b0f",panel:"#0f1319",panel2:"#121821",line:"#26303b",text:"#edf4f8",muted:"#82909d",accent:"#ff7a3d",cloud:"#8ee6ad",local:"#7fc7ff",danger:"#ff9b9b"};
const known=new Set(["reflect","zdrobic","inspect","modify","find","deploy"]);
const labels={reflect:"REFLECT",zdrobic:"EXECUTE",inspect:"INSPECT",modify:"MODIFY",find:"SEARCH",deploy:"DEPLOY"};
const aliases=[[/\bxochu\b/gi,"хочу"],[/\bgavaret\b/gi,"говорити"],[/\bkole\b/gi,"коли"],[/\babo\b/gi,"або"],[/\bjesli\b/gi,"jeśli"],[/\bukrainski\b/gi,"український"],[/\bruski\b/gi,"російський"]];

function normalize(value){let text=String(value||"").replace(/\./g," ").replace(/_/g," ");aliases.forEach(([p,r])=>text=text.replace(p,r));return text.replace(/\s+/g," ").trim()}
function splitTopLevel(text){const parts=[];let start=0,depth=0,quote=null,escape=false;for(let i=0;i<text.length;i++){const ch=text[i];if(escape){escape=false;continue}if(ch==="\\"){escape=true;continue}if(quote){if(ch===quote)quote=null;continue}if(ch==='"'||ch==="'"){quote=ch;continue}if(ch==='('){depth++;continue}if(ch===')'){depth=Math.max(0,depth-1);continue}if(ch==='.'&&depth===0){const part=text.slice(start,i).trim();if(part)parts.push(part);start=i+1}}const last=text.slice(start).trim();if(last)parts.push(last);return parts}
function unwrapQuoted(s){const t=s.trim();if((t.startsWith('"')&&t.endsWith('"'))||(t.startsWith("'")&&t.endsWith("'")))return t.slice(1,-1);return t}
function parseExpression(expr,path=""){const m=expr.match(/^([a-zA-Z_][\w-]*)\s*\(([\s\S]*)\)$/);if(!m)return [{id:path||"1",type:"unknown",raw:expr,body:expr,label:"UNKNOWN"}];const type=m[1].toLowerCase(),body=m[2].trim();return [{id:path||"1",type,raw:expr,body:unwrapQuoted(body),label:labels[type]||type.toUpperCase()}]}
function parseProgram(raw){const text=raw.trim();if(!/^(reflect|zdrobic|inspect|modify|find|deploy)\s*\(/i.test(text))return [{id:"1",type:"reflect",raw:text,body:text,label:labels.reflect,implicit:true}];const plan=[];splitTopLevel(text).forEach((expr,i)=>plan.push(...parseExpression(expr,String(i+1))));return plan}
function makePayload(raw,plan){return {raw,plan:plan.map(s=>({id:s.id,type:s.type,body:s.body,normalized:normalize(s.body)}))}}
function imagePreviews(activity){const previews=[],seen=new Set();for(const item of Array.isArray(activity)?activity:[]){if(item?.tool!=="write_repo_file"||item?.ok!==true)continue;const result=item.result||{},repo=String(result.repo||""),path=String(result.path||""),commit=String(result.commit||"");if(!repo||!path||!commit||!(/\.(svg|png|jpe?g|webp|gif)$/i.test(path)))continue;const key=`${repo}:${commit}:${path}`;if(seen.has(key))continue;seen.add(key);previews.push({repo,path,commit,url:`https://raw.githubusercontent.com/${repo}/${commit}/${path.split("/").map(encodeURIComponent).join("/")}`})}return previews}
function safeResponse(data){if(!data||typeof data!=="object")return data;const clone={...data};delete clone.token;delete clone.accessKey;delete clone.secret;return clone}

export default function BlueprintPage(){
  const [provider,setProvider]=useState("cloud");
  const [accessKey,setAccessKey]=useState("");
  const [input,setInput]=useState("");
  const [status,setStatus]=useState("READY");
  const [agent,setAgent]=useState("DISCONNECTED");
  const [seq,setSeq]=useState(3);
  const [entries,setEntries]=useState([
    {id:1,user:false,kind:"SYSTEM",text:"Blueprint Playground online. Choose Cloud or Local, then ask normally or use Blueprint commands.",error:false,previews:[]},
    {id:2,user:false,kind:"SYSTEM",text:"Plain text → reflect(...) automatically. Local handles chat/reasoning. Cloud keeps repository tools and deployments.",error:false,previews:[]}
  ]);
  const [inspector,setInspector]=useState("request");
  const [lastRequest,setLastRequest]=useState(null);
  const [lastResponse,setLastResponse]=useState(null);
  const [lastActivity,setLastActivity]=useState([]);
  const [latency,setLatency]=useState(null);
  const [privacy,setPrivacy]=useState(false);
  const logRef=useRef(null);

  useEffect(()=>{setAccessKey(sessionStorage.getItem("blueprint.key")||"");const saved=sessionStorage.getItem("blueprint.provider");if(saved==="cloud"||saved==="local")setProvider(saved);const fn=e=>{if(e.key==="Escape")setPrivacy(v=>!v)};window.addEventListener("keydown",fn);return()=>window.removeEventListener("keydown",fn)},[]);
  useEffect(()=>{if(logRef.current)logRef.current.scrollTop=logRef.current.scrollHeight},[entries,status]);

  const endpoint=provider==="local"?"/api/command/local":"/api/command";
  const providerName=provider==="local"?"Ollama":"Groq";
  const modelName=provider==="local"?"blueprint-local":"gpt-oss-120b";
  const providerColor=provider==="local"?C.local:C.cloud;
  const time=useMemo(()=>new Date().toLocaleTimeString(),[entries,status]);

  function chooseProvider(next){setProvider(next);setAgent("DISCONNECTED");sessionStorage.setItem("blueprint.provider",next);setEntries(v=>[...v,{id:Date.now(),user:false,kind:"SYSTEM",text:next==="local"?"LOCAL selected · Vercel → secure bridge → Ollama → blueprint-local":"CLOUD selected · Vercel → Groq → gpt-oss-120b + repository tools",error:false,previews:[]}])}
  function connectAgent(){const key=window.prompt("Blueprint access key (stored only for this browser session):",accessKey);if(key===null)return;const clean=key.trim();setAccessKey(clean);if(clean){sessionStorage.setItem("blueprint.key",clean);setAgent("KEY SET")}else{sessionStorage.removeItem("blueprint.key");setAgent("DISCONNECTED")}}

  async function run(){
    const raw=input.trim();if(!raw||status==="RUNNING")return;
    const plan=parseProgram(raw),invalid=plan.some(s=>!known.has(s.type)),payload=makePayload(raw,plan),commandId=seq,resultId=seq+1;
    setSeq(resultId+1);setInput("");setStatus("RUNNING");setLatency(null);setLastRequest({method:"POST",endpoint,provider:providerName,model:modelName,...payload});setInspector("request");
    setEntries(v=>[...v,{id:commandId,user:true,kind:plan[0]?.implicit?"PROMPT":`COMMAND · ${plan.map(s=>s.label).join(" + ")}`,text:raw,error:invalid,previews:[]}]);
    if(invalid){setEntries(v=>[...v,{id:resultId,user:false,kind:"ERROR",text:"Unsupported Blueprint command syntax.",error:true,previews:[]}]);setStatus("READY");return}
    const started=performance.now();
    try{
      const response=await fetch(endpoint,{method:"POST",headers:{"content-type":"application/json",...(accessKey?{"x-blueprint-key":accessKey}:{})},body:JSON.stringify(payload)});
      let data={};try{data=await response.json()}catch{data={output:`HTTP ${response.status}`}}
      const ms=Math.round(performance.now()-started);setLatency(ms);setLastResponse({status:response.status,ok:response.ok,...safeResponse(data)});setLastActivity(Array.isArray(data?.activity)?data.activity:[]);setInspector("response");
      const previews=imagePreviews(data?.activity);
      if(response.ok&&data?.executed===true){setAgent("CONNECTED");setEntries(v=>[...v,{id:resultId,user:false,kind:`${providerName.toUpperCase()} · ${modelName}`,text:data.output||"Completed.",error:false,previews}])}
      else{if(response.status===401)setAgent("AUTH REQUIRED");else if(response.status===409&&provider==="local")setAgent("LOCAL CHAT ONLY");else if(response.status===503)setAgent("SERVER SETUP");else setAgent("DISCONNECTED");setEntries(v=>[...v,{id:resultId,user:false,kind:"ERROR",text:data?.output||`Request failed with HTTP ${response.status}.`,error:true,previews}])}
    }catch(e){const ms=Math.round(performance.now()-started);setLatency(ms);setAgent("DISCONNECTED");const message=e instanceof Error?e.message:String(e);setLastResponse({ok:false,error:message});setInspector("response");setEntries(v=>[...v,{id:resultId,user:false,kind:"ERROR",text:`Agent request failed: ${message}`,error:true,previews:[]}])}
    setStatus("READY");
  }

  const button=(active=false,color=C.accent)=>({border:`1px solid ${active?color:C.line}`,background:active?`${color}18`:"transparent",color:active?color:C.text,borderRadius:7,padding:"8px 11px",font:"inherit",fontSize:11,cursor:"pointer"});
  const label={fontSize:10,textTransform:"uppercase",letterSpacing:".12em",color:C.muted,marginBottom:7};
  const card={border:`1px solid ${C.line}`,background:C.panel,borderRadius:10};
  const tabStyle=active=>({border:0,borderBottom:`2px solid ${active?C.accent:"transparent"}`,background:"transparent",color:active?C.text:C.muted,padding:"9px 10px",font:"inherit",fontSize:10,cursor:"pointer"});
  const stateColor=agent==="CONNECTED"||agent==="KEY SET"?C.cloud:agent==="LOCAL CHAT ONLY"?C.local:agent==="DISCONNECTED"?C.muted:C.danger;

  return <div style={{position:"fixed",inset:0,zIndex:9999,display:"grid",gridTemplateRows:"52px 1fr 28px",background:C.bg,color:C.text,fontFamily:'ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono",monospace',overflow:"hidden"}}>
    <header style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,padding:"0 14px",borderBottom:`1px solid ${C.line}`,background:"#0b0f14"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0}}><div style={{width:27,height:27,borderRadius:7,background:C.accent,color:"#111",display:"grid",placeItems:"center",fontWeight:900}}>B</div><div><div style={{fontSize:12,fontWeight:700,letterSpacing:".04em"}}>BLUEPRINT PLAYGROUND</div><div style={{fontSize:9,color:C.muted}}>OrangeSoft AI command + inference console · REV 18</div></div></div>
      <div style={{display:"flex",alignItems:"center",gap:7}}><button style={button(provider==="cloud",C.cloud)} onClick={()=>chooseProvider("cloud")}>● Cloud · Groq</button><button style={button(provider==="local",C.local)} onClick={()=>chooseProvider("local")}>● Local · Ollama</button><button style={button(Boolean(accessKey),C.cloud)} onClick={connectAgent}>{accessKey?"Agent Key ✓":"Agent Key"}</button><button style={button(false)} onClick={()=>setPrivacy(v=>!v)}>Drawing View</button></div>
    </header>

    <main style={{display:"grid",gridTemplateColumns:"230px minmax(360px,1fr) 330px",gap:0,minHeight:0}}>
      <aside style={{borderRight:`1px solid ${C.line}`,padding:14,overflow:"auto",background:"#0b0f14"}}>
        <div style={label}>Inference</div>
        <div style={{...card,padding:11,marginBottom:12}}><div style={{fontSize:10,color:C.muted,marginBottom:5}}>Provider</div><div style={{fontSize:13,color:providerColor,fontWeight:700}}>{providerName}</div></div>
        <div style={{...card,padding:11,marginBottom:12}}><div style={{fontSize:10,color:C.muted,marginBottom:5}}>Model</div><select value={modelName} disabled style={{width:"100%",border:`1px solid ${C.line}`,background:C.panel2,color:C.text,borderRadius:6,padding:"8px",font:"inherit",fontSize:11}}><option>{modelName}</option></select></div>
        <div style={{...card,padding:11,marginBottom:18}}><div style={{fontSize:10,color:C.muted,marginBottom:7}}>Route</div><div style={{fontSize:10,lineHeight:1.55,color:C.text,overflowWrap:"anywhere"}}>{provider==="local"?"Browser → Vercel → ngrok bridge → Ollama":"Browser → Vercel → Groq API"}</div></div>

        <div style={label}>Blueprint commands</div>
        {[['plain text','auto reflect'],['reflect(...)','reason / answer'],['zdrobic(...)','execute / create'],['inspect(...)','inspect repo'],['modify(...)','change file'],['find(...)','search'],['deploy(...)','deploy']].map(([a,b])=><div key={a} style={{padding:"7px 0",borderBottom:`1px solid ${C.line}`,fontSize:10}}><div style={{color:C.text}}>{a}</div><div style={{color:C.muted,marginTop:2}}>{b}</div></div>)}
        {provider==="local"&&<div style={{marginTop:14,padding:10,border:`1px solid ${C.local}55`,borderRadius:8,color:C.muted,fontSize:10,lineHeight:1.55}}><b style={{color:C.local}}>LOCAL MODE</b><br/>Normal chat and reflect(...) run on your Mac. Repo tools still require Cloud.</div>}
      </aside>

      <section style={{display:"grid",gridTemplateRows:"auto 1fr auto",minHeight:0,padding:"0 18px",background:"radial-gradient(circle at 50% -20%,rgba(255,122,61,.08),transparent 42%)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"13px 2px 10px",borderBottom:`1px solid ${C.line}`}}><div><div style={{fontSize:13,fontWeight:700}}>Chat / Command</div><div style={{fontSize:9,color:C.muted,marginTop:2}}>Plain language or Blueprint syntax</div></div><div style={{display:"flex",gap:12,fontSize:9,color:C.muted}}><span>STATE <b style={{color:status==="READY"?C.cloud:C.accent}}>{status}</b></span><span>LATENCY <b style={{color:C.text}}>{latency===null?"—":`${latency} ms`}</b></span></div></div>
        <div ref={logRef} style={{overflow:"auto",padding:"18px 2px 28px"}}>{entries.map(entry=><div key={entry.id} style={{display:"flex",justifyContent:entry.user?"flex-end":"flex-start",marginBottom:16}}><div style={{maxWidth:"82%"}}><div style={{fontSize:9,color:C.muted,marginBottom:5,textAlign:entry.user?"right":"left"}}>{entry.kind} · {String(entry.id).padStart(3,"0")}</div><div style={{border:`1px solid ${entry.error?"#6f3939":entry.user?C.accent:C.line}`,background:entry.user?"rgba(255,122,61,.08)":C.panel,borderRadius:10,padding:"11px 13px",fontSize:12,lineHeight:1.55,whiteSpace:"pre-wrap",overflowWrap:"anywhere",color:entry.error?C.danger:C.text}}>{entry.text}</div>{entry.previews?.length>0&&<div style={{display:"grid",gap:8,marginTop:8}}>{entry.previews.map(p=><a key={`${p.commit}:${p.path}`} href={p.url} target="_blank" rel="noreferrer" style={{display:"block",border:`1px solid ${C.line}`,borderRadius:9,padding:8,background:C.panel,textDecoration:"none"}}><div style={{fontSize:9,color:C.muted,marginBottom:7}}>{p.path}</div><img src={p.url} alt={p.path} style={{display:"block",width:"100%",maxHeight:280,objectFit:"contain",background:"white",borderRadius:5}}/></a>)}</div>}</div></div>)}</div>
        <div style={{padding:"12px 0 15px",borderTop:`1px solid ${C.line}`}}><div style={{...card,padding:8,display:"grid",gridTemplateColumns:"1fr auto",gap:8,boxShadow:"0 16px 44px rgba(0,0,0,.28)"}}><textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if((e.metaKey||e.ctrlKey)&&e.key==="Enter"){e.preventDefault();run()}}} placeholder={provider==="local"?"Ask Blueprint Local anything…":"Ask Blueprint or run zdrobic(...), inspect(...), deploy(...)"} spellCheck={false} style={{height:76,resize:"none",border:0,outline:"none",background:"transparent",color:C.text,font:"inherit",fontSize:12,padding:"8px"}}/><button onClick={run} disabled={status==="RUNNING"} style={{alignSelf:"end",border:0,borderRadius:7,background:status==="RUNNING"?C.line:C.accent,color:"#111",font:"inherit",fontWeight:800,fontSize:11,padding:"11px 15px",cursor:status==="RUNNING"?"default":"pointer"}}>{status==="RUNNING"?"RUNNING…":"RUN"}</button></div><div style={{display:"flex",justifyContent:"space-between",marginTop:6,fontSize:9,color:C.muted}}><span>⌘/CTRL + ENTER to run · ESC drawing view</span><span>{providerName} · {modelName}</span></div></div>
      </section>

      <aside style={{borderLeft:`1px solid ${C.line}`,display:"grid",gridTemplateRows:"auto auto 1fr",minHeight:0,background:"#0b0f14"}}>
        <div style={{padding:14,borderBottom:`1px solid ${C.line}`}}><div style={label}>Session</div>{[['PROVIDER',providerName],['MODEL',modelName],['ENDPOINT',endpoint],['AGENT',agent],['KEY',accessKey?'SET':'MISSING'],['LATENCY',latency===null?'—':`${latency} ms`]].map(([k,v])=><div key={k} style={{display:"grid",gridTemplateColumns:"78px 1fr",gap:7,fontSize:10,lineHeight:1.8}}><span style={{color:C.muted}}>{k}</span><span style={{color:k==="AGENT"?stateColor:k==="PROVIDER"?providerColor:C.text,overflowWrap:"anywhere"}}>{v}</span></div>)}</div>
        <div style={{display:"flex",padding:"0 8px",borderBottom:`1px solid ${C.line}`}}>{[['request','Request'],['response','Response'],['tools','Tools']].map(([id,name])=><button key={id} style={tabStyle(inspector===id)} onClick={()=>setInspector(id)}>{name}{id==="tools"&&lastActivity.length?` (${lastActivity.length})`:""}</button>)}</div>
        <div style={{overflow:"auto",padding:12}}>{inspector==="request"&&<><div style={label}>Last request</div><pre style={{margin:0,fontSize:10,lineHeight:1.5,color:lastRequest?C.text:C.muted,whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{lastRequest?JSON.stringify(lastRequest,null,2):"Run a prompt to inspect the request payload."}</pre></>}{inspector==="response"&&<><div style={label}>Last response</div><pre style={{margin:0,fontSize:10,lineHeight:1.5,color:lastResponse?C.text:C.muted,whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{lastResponse?JSON.stringify(lastResponse,null,2):"No response yet."}</pre></>}{inspector==="tools"&&<><div style={label}>Tool activity</div>{lastActivity.length?lastActivity.map((a,i)=><div key={i} style={{...card,padding:9,marginBottom:8,fontSize:10}}><div style={{color:C.text}}>{a.tool||`tool ${i+1}`}</div><div style={{color:a.ok===false?C.danger:C.muted,marginTop:4}}>{a.ok===false?"failed":"completed"}</div></div>):<div style={{fontSize:10,color:C.muted,lineHeight:1.5}}>No tool calls on the last request. Local chat currently does not expose repo tools.</div>}</>}</div>
      </aside>
    </main>

    <footer style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 12px",borderTop:`1px solid ${C.line}`,background:"#0b0f14",fontSize:9,color:C.muted}}><span>ORANGESOFT · BLUEPRINT · {providerName.toUpperCase()}</span><span>{time}</span></footer>

    {privacy&&<div style={{position:"fixed",inset:52,zIndex:10000,background:"#07111b",backgroundImage:"linear-gradient(rgba(127,199,255,.13) 1px,transparent 1px),linear-gradient(90deg,rgba(127,199,255,.13) 1px,transparent 1px)",backgroundSize:"32px 32px",display:"grid",placeItems:"center"}}><div style={{width:"72%",height:"56%",border:`1px solid #295779`,position:"relative"}}><div style={{position:"absolute",left:"8%",top:"12%",width:"42%",height:"28%",border:"1px solid #295779"}}/><div style={{position:"absolute",right:"9%",bottom:"13%",width:"35%",height:"38%",border:"1px dashed #295779"}}/><div style={{position:"absolute",left:18,top:14,fontSize:10,color:"#6b9fbd"}}>BLUEPRINT DRAWING VIEW · ESC TO RETURN</div></div></div>}
  </div>
}
