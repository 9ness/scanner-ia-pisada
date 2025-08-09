import { useEffect, useRef, useState } from "react";

export default function CameraScanner({ onCapture, onClose }) {
  /* === Parámetros === */
  const DEBUG   = true;
  const DS      = 0.58;        // downscale del frame para cálculo
  const LOOP_MS = 130;

  // muestreo
  const STEP_TEX = 3;          // sampling para color/tex
  const STEP_EDG = 2;          // sampling para bordes globales
  const STEP_RING = 4;         // sampling para aro (ring step)

  // aro del contorno
  const STROKE_W_PCT = 0.016;  // grosor relativo del aro

  // limites y normalizaciones
  const EDGE_T   = 90;
  const LUMA_MIN = 110;
  const LUMA_MAX = 620;
  const HUE_NORM = 45;         // ΔHue (grados) → 1.0
  const SAT_NORM = 0.30;       // ΔSat (0..1)   → 1.0
  const TEX_BASE = 0.9;        // inicio para texScore
  const TEX_SPAN = 0.7;        // (ratio - base)/span
  const RSTEP_NORM = 120;      // media del salto lum en aro para score 1.0

  // disparo y salvaguardas
  const SHOOT_SCORE   = 60;    // 0..100
  const CONSEC_N      = 3;     // fotogramas seguidos
  const MIN_EDGES     = 2400;  // bordes globales
  const MIN_PIXIN     = 1500;  // pixeles válidos dentro

  /* === Refs/Estado === */
  const videoRef  = useRef(null);
  const streamRef = useRef(null);
  const doneRef   = useRef(false);

  const [ready, setReady]   = useState(false);
  const [cover, setCover]   = useState(true);
  const [maskD, setMaskD]   = useState(null);
  const [score, setScore]   = useState(0);
  const [flash, setFlash]   = useState(false);

  /* utils */
  function rgb2hsv(r,g,b){
    const rr=r/255, gg=g/255, bb=b/255;
    const max=Math.max(rr,gg,bb), min=Math.min(rr,gg,bb);
    const d=max-min;
    let h=0, s=max===0?0:d/max, v=max;
    if(d!==0){
      switch(max){
        case rr: h=((gg-bb)/d + (gg<bb?6:0)); break;
        case gg: h=((bb-rr)/d + 2); break;
        case bb: h=((rr-gg)/d + 4); break;
      }
      h*=60;
    }
    return [h,s,v];
  }
  const hueDist = (a,b)=>{ let d=Math.abs(a-b); return d>180?360-d:d; };

  /* 1) Silueta */
  useEffect(() => {
    fetch("/plantilla_silueta.svg")
      .then(r => r.text())
      .then(txt => {
        const d = new DOMParser()
          .parseFromString(txt, "image/svg+xml")
          .querySelector("path")?.getAttribute("d");
        if (d) setMaskD(d);
      });
  }, []);

  /* 2) Cámara */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 } }
        });
        if (cancelled) { s.getTracks().forEach(t=>t.stop()); return; }
        streamRef.current = s;
        videoRef.current.srcObject = s;
        videoRef.current.onloadedmetadata = () => {
          setReady(true);
          setTimeout(()=>setCover(false), 260);
        };
      } catch {
        alert("No se pudo abrir la cámara");
        onClose();
      }
    })();
    return () => { cancelled = true; };
  }, [onClose]);

  /* 3) Loop detección */
  useEffect(() => {
    if (!ready || !maskD || doneRef.current) return;

    const v = videoRef.current;
    const W = Math.round(v.videoWidth  * DS);
    const H = Math.round(v.videoHeight * DS);
    if (!W || !H) return;

    const can = document.createElement("canvas");
    can.width = W; can.height = H;
    const ctx = can.getContext("2d", { willReadFrequently: true });

    const vb = 1365.333;
    const path = new Path2D();
    path.addPath(new Path2D(maskD), new DOMMatrix().scale(W/vb, H/vb));
    const strokeW = Math.max(2, Math.round(Math.min(W,H)*STROKE_W_PCT));

    let alive = true;
    let consec = 0;

    (function step(){
      if(!alive || doneRef.current) return;

      ctx.drawImage(v,0,0,W,H);
      const data = ctx.getImageData(0,0,W,H).data;

      /* bordes globales */
      let edgesTot=0;
      for(let y=0;y<H;y+=STEP_EDG){
        const base=(y*W)<<2;
        for(let x=0;x<W-2;x+=STEP_EDG){
          const i=base+(x<<2);
          const l1=data[i]+data[i+1]+data[i+2];
          const l2=data[i+8]+data[i+9]+data[i+10];
          const d=l1-l2;
          if(d>EDGE_T || -d>EDGE_T) edgesTot++;
        }
      }

      /* color/tex interior y aro exterior */
      let nIn=0, nOut=0, pixIn=0;
      let hueIn=0, satIn=0, hueOut=0, satOut=0;
      let gIn=0, gOut=0;

      ctx.save(); ctx.lineWidth = strokeW;

      for(let y=0;y<H;y+=STEP_TEX){
        const base=(y*W)<<2;
        for(let x=0;x<W;x+=STEP_TEX){
          const i=base+(x<<2);
          const r=data[i], g=data[i+1], b=data[i+2];
          const lum=r+g+b;

          let grad=0;
          if(x<W-STEP_TEX){
            const j=base+((x+STEP_TEX)<<2);
            grad+=Math.abs(lum-(data[j]+data[j+1]+data[j+2]));
          }
          if(y<H-STEP_TEX){
            const k=((y+STEP_TEX)*W<<2)+(x<<2);
            grad+=Math.abs(lum-(data[k]+data[k+1]+data[k+2]));
          }

          const inStroke = ctx.isPointInStroke(path,x,y);
          const inPath   = ctx.isPointInPath(path,x,y);

          if(inPath && !inStroke){
            if(lum>LUMA_MIN && lum<LUMA_MAX){
              pixIn++; nIn++;
              const [h,s]=rgb2hsv(r,g,b);
              hueIn+=h; satIn+=s; gIn+=grad;
            }
          } else if(inStroke && !inPath){
            nOut++;
            const [h,s]=rgb2hsv(r,g,b);
            hueOut+=h; satOut+=s; gOut+=grad;
          }
        }
      }
      ctx.restore();

      const mHueIn  = nIn ? hueIn/nIn  : 0;
      const mSatIn  = nIn ? satIn/nIn  : 0;
      const mHueOut = nOut? hueOut/nOut: 0;
      const mSatOut = nOut? satOut/nOut: 0;

      const dHue = hueDist(mHueIn, mHueOut);
      const dSat = Math.abs(mSatIn - mSatOut);

      const hueScore = Math.min(1, dHue/HUE_NORM);
      const satScore = Math.min(1, dSat/SAT_NORM);

      const gInMean  = nIn  ? gIn/nIn  : 1;
      const gOutMean = nOut ? gOut/nOut: 1;
      const texRatio = gOutMean / Math.max(1e-3, gInMean);
      const texScore = Math.max(0, Math.min(1, (texRatio - TEX_BASE)/TEX_SPAN));

      /* --- RING STEP: salto interior ↔ exterior --- */
      let stepSum=0, stepCnt=0;
      ctx.save(); ctx.lineWidth = strokeW;
      for(let y=0;y<H;y+=STEP_RING){
        for(let x=0;x<W;x+=STEP_RING){
          if(!ctx.isPointInStroke(path,x,y)) continue;
          // buscamos un par cerca (dentro y fuera) para medir el salto
          let inL = -1, outL = -1;
          for(let dy=-2; dy<=2; dy++){
            for(let dx=-2; dx<=2; dx++){
              const xx=x+dx, yy=y+dy;
              if(xx<0||yy<0||xx>=W||yy>=H) continue;
              const j=((yy*W+xx)<<2);
              const lum=data[j]+data[j+1]+data[j+2];
              if(ctx.isPointInPath(path,xx,yy)) { inL = lum; }
              else { outL = lum; }
              if(inL>=0 && outL>=0) break;
            }
            if(inL>=0 && outL>=0) break;
          }
          if(inL>=0 && outL>=0){
            stepSum += Math.abs(inL - outL);
            stepCnt++;
          }
        }
      }
      ctx.restore();
      const ringMean = stepCnt ? stepSum/stepCnt : 0;
      const ringScore = Math.min(1, ringMean / RSTEP_NORM);

      /* Score total */
      const S = (0.40*ringScore + 0.30*(0.65*hueScore + 0.35*satScore) + 0.30*texScore) * 100;
      setScore(S);

      if(DEBUG){
        const dbg=document.getElementById("dbg");
        if(dbg) dbg.textContent =
          `EdgesTot: ${edgesTot}\n`+
          `pixIn:    ${pixIn}\n`+
          `ΔHue:     ${dHue.toFixed(1)} (score ${(hueScore*100).toFixed(0)})\n`+
          `ΔSat:     ${dSat.toFixed(2)} (score ${(satScore*100).toFixed(0)})\n`+
          `TexRatio: ${texRatio.toFixed(2)} (score ${(texScore*100).toFixed(0)})\n`+
          `RingStep: ${ringMean.toFixed(1)} (score ${(ringScore*100).toFixed(0)})\n`+
          `Score%:   ${S.toFixed(1)}\n`+
          `Consec:   ${consec}/${CONSEC_N}`;
      }

      const ok = (edgesTot>=MIN_EDGES) && (pixIn>=MIN_PIXIN) && (S>=SHOOT_SCORE);
      if(ok){ consec++; if(consec>=CONSEC_N && !doneRef.current){ doneRef.current=true; shoot(); return; } }
      else    consec=0;

      setTimeout(step, LOOP_MS);
    })();

    return ()=>{ alive=false; };
  }, [ready, maskD]);

  /* 4) Captura */
  function shoot(){
    setFlash(true); setTimeout(()=>setFlash(false),420);
    const v=videoRef.current;
    const c=document.createElement("canvas");
    c.width=v.videoWidth; c.height=v.videoHeight;
    c.getContext("2d").drawImage(v,0,0);
    c.toBlob((blob)=>{
      streamRef.current?.getTracks().forEach(t=>t.stop());
      onCapture(blob); onClose();
    },"image/jpeg",0.85);
  }

  /* 5) Cerrar */
  function handleClose(){
    doneRef.current=true;
    streamRef.current?.getTracks().forEach(t=>t.stop());
    onClose();
  }

  return (
    <div className="wrap">
      <div className={`cover ${cover ? "" : "hide"}`}><div className="spinner"/></div>
      <video ref={videoRef} autoPlay playsInline className="cam"/>

      {ready && maskD && (
        <>
          <svg className="mask" viewBox="0 0 1365.333 1365.333" preserveAspectRatio="xMidYMid slice">
            <defs>
              <mask id="hole"><rect width="100%" height="100%" fill="#fff"/><path d={maskD} fill="#000"/></mask>
            </defs>
            <rect width="100%" height="100%" fill="rgba(0,0,0,0.55)" mask="url(#hole)"/>
            <path d={maskD} fill="none" stroke="#fff" strokeWidth="3"/>
          </svg>

          {DEBUG && (
            <>
              <div className="barBox">
                <div className="bar" style={{ width: `${Math.min(score,100)}%`, background: score>75 ? "#10cf48" : "#f2c522" }}/>
              </div>
              <pre id="dbg" className="dbg"/>
            </>
          )}
          <button className="cls" onClick={handleClose}>✕</button>
        </>
      )}

      {flash && <div className="flash">📸 Captura</div>}

      <style jsx>{`
        .wrap{position:fixed;inset:0;z-index:9999;}
        .cover{position:absolute;inset:0;background:#000;display:flex;align-items:center;justify-content:center;opacity:1;transition:opacity .35s ease}
        .cover.hide{opacity:0;pointer-events:none}
        .spinner{width:46px;height:46px;border:4px solid #fff;border-top-color:transparent;border-radius:50%;animation:spin .8s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        .cam{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
        .mask{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
        .barBox{position:absolute;bottom:16px;left:50%;transform:translateX(-50%);width:80%;height:12px;background:#444;border-radius:6px;overflow:hidden}
        .bar{height:100%;transition:width .18s}
        .cls{position:absolute;top:16px;right:16px;width:48px;height:48px;border:none;border-radius:50%;background:#035c3b;color:#fff;display:flex;align-items:center;justify-content:center;font-size:28px;cursor:pointer}
        .dbg{position:absolute;top:16px;left:16px;background:rgba(0,0,0,.55);color:#fff;padding:6px 10px;font-size:13px;border-radius:4px;white-space:pre-line}
        .flash{position:absolute;inset:0;background:rgba(0,0,0,.78);display:flex;align-items:center;justify-content:center;color:#fff;font-size:1.3rem;pointer-events:none}
      `}</style>
    </div>
  );
}
