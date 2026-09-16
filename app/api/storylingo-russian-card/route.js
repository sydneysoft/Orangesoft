import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(
    (
      <div style={{width:"1080px",height:"1350px",display:"flex",flexDirection:"column",justifyContent:"space-between",padding:"82px",background:"#090807",color:"#f7f0df",fontFamily:"Arial, sans-serif"}}>
        <div style={{display:"flex",flexDirection:"column"}}>
          <div style={{display:"flex",alignItems:"center",gap:"18px"}}>
            <div style={{width:"68px",height:"68px",borderRadius:"16px",display:"flex",alignItems:"center",justifyContent:"center",background:"#d7b76a",color:"#090807",fontSize:"34px",fontWeight:900}}>S</div>
            <div style={{display:"flex",flexDirection:"column"}}>
              <div style={{fontSize:"54px",fontWeight:900,letterSpacing:"-2px"}}>STORYLINGO</div>
              <div style={{fontSize:"21px",letterSpacing:"5px",color:"#d7b76a"}}>LEARN LANGUAGES THROUGH STORIES</div>
            </div>
          </div>

          <div style={{marginTop:"94px",fontSize:"150px",lineHeight:1}}>🇷🇺</div>
          <div style={{marginTop:"24px",fontSize:"84px",lineHeight:1.01,fontWeight:900,maxWidth:"900px"}}>Russian is now on StoryLingo.</div>
          <div style={{marginTop:"30px",fontSize:"34px",lineHeight:1.38,color:"#d9d1bf",maxWidth:"860px"}}>Read Universal Stories in Russian, switch between languages, explore vocabulary and practise words in context.</div>

          <div style={{display:"flex",gap:"14px",flexWrap:"wrap",marginTop:"42px"}}>
            {["THE LOST KEY","THE ILIAD","THE ODYSSEY"].map((label)=>(
              <div key={label} style={{display:"flex",padding:"14px 19px",border:"1px solid #4d4638",borderRadius:"999px",fontSize:"23px",background:"#151311"}}>{label}</div>
            ))}
          </div>
        </div>

        <div style={{display:"flex",flexDirection:"column",gap:"24px"}}>
          <div style={{display:"flex",gap:"18px"}}>
            {["READ","TRANSLATE","PRACTISE"].map((item)=>(
              <div key={item} style={{flex:1,display:"flex",flexDirection:"column",padding:"26px",border:"1px solid #3a352c",background:"#12100e"}}>
                <div style={{color:"#d7b76a",fontSize:"17px",letterSpacing:"3px"}}>RUSSIAN MODE</div>
                <div style={{marginTop:"10px",fontSize:"28px",fontWeight:800}}>{item}</div>
              </div>
            ))}
          </div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",borderTop:"1px solid #3a352c",paddingTop:"24px"}}>
            <div style={{fontSize:"26px",fontWeight:700}}>storylingo.uk</div>
            <div style={{fontSize:"20px",color:"#a99f8b"}}>🇬🇧 EN · 🇷🇺 RU · 🇵🇱 PL · 🇫🇷 FR · 🇩🇪 DE · 🇪🇸 ES</div>
          </div>
        </div>
      </div>
    ),
    { width: 1080, height: 1350 }
  );
}
