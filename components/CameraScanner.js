// components/CameraScanner.jsx
import { useEffect, useRef, useState } from "react";

export default function CameraScanner({ onCapture, onClose }) {
  /* ---------------- refs ---------------- */
  const video  = useRef(null);
  const over   = useRef(null);     // overlay visible
  const maskCV = useRef(null);     // canvas binario para la detección
  const sRef   = useRef(null);     // stream

  /* ---------------- estado debug ---------------- */
  const [stats, setStats] = useState({ b: 0, in: 0, out: 0 });
  const showStats = true;          // ← pon false si no quieres verlos

  /* ---------------- silueta (puntos normalizados) ----------------
     Extraído de tu SVG: contorno 22 puntos, simplificado a 14       */
  const path = [
      [0.50,0.00],[0.63,0.07],[0.72,0.25],[0.70,0.40],
      [0.66,0.57],[0.67,0.73],[0.71,0.87],[0.63,1.00],
      [0.37,1.00],[0.29,0.87],[0.33,0.73],[0.34,0.57],
      [0.30,0.40],[0.28,0.25],[0.37,0.07]
  ]; // cierra solo

  /* ---------------- start / stop cámara ---------------- */
  useEffect(() => {
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode:"environment", width:{ideal:1280}, height:{ideal:720} }
        });
        video.current.srcObject = s;
        sRef.current = s;
      } catch(e){ console.error("cam",e); onClose(); }
    })();
    return () => sRef.current?.getTracks().forEach(t=>t.stop());
  }, []);

  /* ---------------- main loop cada 200 ms ---------------- */
  useEffect(() => {
    const id = setInterval(analyse, 200);
    return () => clearInterval(id);
  });

  function analyse() {
    if (!video.current || video.current.readyState<2) return;

    const vw = video.current.videoWidth;
    const vh = video.current.videoHeight;

    /* ===== 1. asegura canvases ===== */
    if (over.current.width!==vw){
      [over.current,maskCV.current].forEach(c => {
        c.width = vw; c.height = vh;
      });
    }

    /* ===== 2. dibuja overlay ===== */
    drawOverlay(vw,vh);

    /* ===== 3. máscara binaria ===== */
    const mCtx = maskCV.current.getContext("2d");
    mCtx.clearRect(0,0,vw,vh);
    drawSilhouette(mCtx, vw, vh, true);     // rellena en blanco

    const mData = mCtx.getImageData(0,0,vw,vh).data;

    /* ===== 4. bordes con OpenCV ===== */
    const tmp = document.createElement("canvas");
    tmp.width = vw; tmp.height = vh;
    tmp.getContext("2d").drawImage(video.current,0,0);
    const src = cv.imread(tmp); const g=new cv.Mat(); const e=new cv.Mat();
    cv.cvtColor(src,g,cv.COLOR_RGBA2GRAY); cv.Canny(g,e,50,120);

    let inside=0,outside=0;
    for (let y=0, p=0; y<vh; y++){
      for (let x=0; x<vw; x++, p++){
        if (e.ucharPtr(y,x)[0]){
          (mData[p*4+3] ? inside++ : outside++);
        }
      }
    }
    setStats({ b:inside+outside, in:inside, out:outside });

    /* ===== 5. disparo ===== */
    if (inside>2000 && outside<1200){
      flashGreen();
      snap(vw,vh);
    }

    src.delete(); g.delete(); e.delete();
  }

  /* ---------- capturar --------- */
  function snap(w,h){
    const c=document.createElement("canvas");
    c.width=w; c.height=h;
    c.getContext("2d").drawImage(video.current,0,0);
    onCapture(c.toDataURL("image/jpeg"));
    onClose();
  }

  function flashGreen(){
    const ctx = over.current.getContext("2d");
    ctx.save();
    ctx.strokeStyle="lime"; ctx.lineWidth=8;
    drawSilhouette(ctx, over.current.width, over.current.height, false);
    ctx.restore();
    setTimeout(drawOverlay, 350, over.current.width, over.current.height);
  }

  /* ---------- overlay + silueta ---------- */
  function drawOverlay(w,h){
    const ctx = over.current.getContext("2d");
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle="rgba(0,0,0,0.55)";
    ctx.fillRect(0,0,w,h);
    ctx.globalCompositeOperation="destination-out";
    drawSilhouette(ctx,w,h,false);
    ctx.globalCompositeOperation="source-over";
  }
  function drawSilhouette(ctx,w,h,fill){
    const S = h*0.70;               // alto = 70 %
    const offX = w/2 - S/2;
    const offY = h*0.15;
    ctx.beginPath();
    path.forEach(([px,py],i)=>{
      const X = offX + px*S;
      const Y = offY + py*S;
      i?ctx.lineTo(X,Y):ctx.moveTo(X,Y);
    });
    ctx.closePath();
    fill?ctx.fill():ctx.stroke();
  }

  /* ---------- render ---------- */
  return(
    <div style={st.wrap}>
      <video ref={video} autoPlay playsInline style={st.vid}/>
      <canvas ref={over} style={st.ov}/>
      <canvas ref={maskCV} style={{display:"none"}}/>
      {showStats && (
        <div style={st.box}>
          📊 <b>TEST INFO</b><br/>
          📏 Bordes: {stats.b}<br/>
          ✅ Dentro: {stats.in}<br/>
          ❌ Fuera: {stats.out}
        </div>
      )}
      <button onClick={onClose} style={st.close}>✕</button>
    </div>
  );
}

/* ---------- estilos ---------- */
const st = {
  wrap : {position:"fixed",inset:0,zIndex:9999,background:"#000"},
  vid  : {width:"100%",height:"100%",objectFit:"cover",position:"absolute"},
  ov   : {position:"absolute",inset:0,pointerEvents:"none"},
  close: {position:"absolute",top:15,right:15,width:40,height:40,borderRadius:"50%",
          background:"rgba(0,0,0,0.55)",color:"#fff",fontSize:24,border:"1px solid #fff",zIndex:1000},
  box  : {position:"absolute",top:15,left:15,background:"rgba(0,0,0,0.7)",
          color:"#fff",padding:"6px 10px",borderRadius:8,fontSize:14,lineHeight:"18px",zIndex:1000}
};
