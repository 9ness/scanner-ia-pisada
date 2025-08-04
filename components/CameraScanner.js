import { useEffect, useRef, useState } from "react";

export default function CameraScanner({ onCapture, onClose }) {
  const videoRef   = useRef(null);
  const streamRef  = useRef(null);
  const [opencvOK, setOpencvOK]   = useState(false);
  const [maskReady, setMaskReady] = useState(false);   // svg cargado
  const [flash, setFlash]         = useState(false);   // destello
  const [testTxt, setTestTxt]     = useState("cargando…");

  /* ---------- 1. Cargar OpenCV asíncrono ---------- */
  useEffect(() => {
    if (window.cv) { setOpencvOK(true); return; }
    const s = document.createElement("script");
    s.src = "https://docs.opencv.org/4.x/opencv.js";
    s.async = true;
    s.onload = () => cv['onRuntimeInitialized']=() => setOpencvOK(true);
    document.body.appendChild(s);
  }, []);

  /* ---------- 2. Pre-cargar la silueta SVG ---------- */
  useEffect(()=>{
    const img = new Image();
    img.src = "/plantilla_silueta.svg";
    img.onload = () => setMaskReady(true);
  },[]);

  /* ---------- 3. Iniciar / parar cámara ---------- */
  useEffect(()=>{
    let stream;
    (async ()=>{
      try{
        stream = await navigator.mediaDevices.getUserMedia({
          video:{ facingMode:{ideal:"environment"}, width:{ideal:1280}, height:{ideal:720}}
        });
        if(videoRef.current){
          videoRef.current.srcObject = stream;
          streamRef.current = stream;
        }
      }catch(e){ console.error("No cam:",e); }
    })();
    return ()=> stream && stream.getTracks().forEach(t=>t.stop());
  },[]);

  /* ---------- 4. Detección simplificada ---------- */
  useEffect(()=>{
    if(!opencvOK) return;
    const video  = videoRef.current;
    const canvas = document.createElement("canvas");
    const ctx    = canvas.getContext("2d");

    const check = () =>{
      if(!video || video.readyState<2){ requestAnimationFrame(check); return; }

      /* volcado frame */
      canvas.width  = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video,0,0,canvas.width,canvas.height);

      /* analiza color interior de silueta: sample en el centro */
      const { width:hW, height:hH } = canvas;
      const cx = hW/2, cy = hH/2;
      const data = ctx.getImageData(cx-5,cy-5,10,10).data;
      let bright=0;
      for(let i=0;i<data.length;i+=4) bright += data[i]+data[i+1]+data[i+2];
      const avg = bright/(data.length/4);   // 0-765

      /* detección muy simplificada:
         – si la zona está claramente ‘verde’ (plantilla),
         – y contraste > umbral, dispara.  */
      const isGreen = avg>120 && data[1]>data[0] && data[1]>data[2];  // verde dominante
      const fillPct = Math.round(avg/765*100);

      setTestTxt(`TEST INFO\nBrilloMed: ${Math.round(avg)}\nFill%: ${fillPct}`);

      if(isGreen && fillPct>15){
        /* destello */
        setFlash(true);
        setTimeout(()=>setFlash(false),150);

        /* captura */
        canvas.toBlob(b=>{
          if(b) onCapture(b);
        },"image/jpeg",0.9);
        return; // terminar
      }
      requestAnimationFrame(check);
    };
    check();

  },[opencvOK,onCapture]);

  /* ---------- 5. Render ---------- */
  return(
    <div id="camera-cover">
      <video ref={videoRef} autoPlay playsInline muted />

      {/* máscara solo cuando svg cargado  */}
      {maskReady && <div id="mask-layer" className={flash?'flash':''}/>}

      {/* HUD & close */}
      <pre id="testBox">{testTxt}</pre>
      <button id="closeBtn" onClick={onClose}>×</button>
    </div>
  );
}
