import { useEffect, useRef, useState } from 'react';

export default function CameraScanner({ onCapture, onClose }) {
  const videoRef   = useRef(null);
  const canvasRef  = useRef(null);
  const streamRef  = useRef(null);
  const [maskReady,setMaskReady] = useState(false);
  const [flash,setFlash] = useState(false);
  const [debug,setDebug] = useState({b:0, inside:0, out:0, pct:0});

  /* ============ cargar SVG antes de mostrar máscara ============ */
  useEffect(()=>{
    const img=new Image();
    img.src='/plantilla_silueta.svg';
    img.onload = ()=> setMaskReady(true);
  },[]);

  /* ============ abrir cámara ============ */
  useEffect(()=>{
    (async()=>{
      try{
        const s = await navigator.mediaDevices.getUserMedia({
          video:{ facingMode:{ideal:'environment'} }
        });
        streamRef.current=s;
        if(videoRef.current){
          videoRef.current.srcObject=s;
        }
      }catch(e){ console.error('cam error',e); }
    })();
    return ()=> streamRef.current?.getTracks().forEach(t=>t.stop());
  },[]);

  /* ============ detección sencilla ============ */
  useEffect(()=>{
    if(!maskReady) return;
    const v = videoRef.current;
    const c = canvasRef.current;
    const ctx=c.getContext('2d');

    const loop = ()=>{
      if(!v.videoWidth){ requestAnimationFrame(loop); return; }

      c.width=v.videoWidth; c.height=v.videoHeight;
      ctx.drawImage(v,0,0,c.width,c.height);

      // leer algunos píxeles dentro de una elipse central (aprox)
      const imgData = ctx.getImageData(c.width*0.4,c.height*0.2,
                                       c.width*0.2,c.height*0.6).data;
      let bright=0;
      for(let i=0;i<imgData.length;i+=4){  // R,G,B
        const y = 0.2126*imgData[i]+0.7152*imgData[i+1]+0.0722*imgData[i+2];
        if(y>80) bright++;                 // umbral sencillísimo
      }
      const pct   = Math.round(100*bright/(imgData.length/4));

      setDebug({b:imgData.length/4,inside:bright,out:imgData.length/4-bright,pct});

      if(pct>8){                //  --- disparo si 8 % de zona central brillante
        snapshot();             //  (ajusta el 8 según tus pruebas)
        return;                 //  sale del loop
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);

    const snapshot=()=>{
      setFlash(true);
      setTimeout(()=>setFlash(false),150);

      const snap=document.createElement('canvas');
      snap.width=c.width; snap.height=c.height;
      snap.getContext('2d').drawImage(v,0,0,c.width,c.height);
      snap.toBlob(b=> onCapture && onCapture(b),'image/jpeg',0.9);
    };
  },[maskReady]);

  /* ============ estilos in-component ============ */
  const style=`
  #camera-cover{position:fixed;inset:0;z-index:9999;display:flex;
    justify-content:center;align-items:center;background:#000;}
  #camera-cover video{position:absolute;inset:0;width:100%;height:100%;
    object-fit:cover;}
  #mask-layer{position:absolute;inset:0;pointer-events:none;
    background:#000;opacity:.55;
    mask:url('/plantilla_silueta.svg') center/70% no-repeat;
    -webkit-mask:url('/plantilla_silueta.svg') center/70% no-repeat;
    transition:background .15s;}
  #mask-layer.flash{background:#00e000;opacity:.35;}
  #testBox{position:absolute;top:20px;left:20px;z-index:3;background:rgba(0,0,0,.5);
    color:#fff;font:14px/1.3 monospace;padding:6px 10px;border-radius:4px;}
  #closeBtn{position:absolute;top:20px;right:20px;z-index:3;width:44px;height:44px;
    border:none;border-radius:50%;font-size:28px;color:#fff;
    background:rgba(0,0,0,.55);}
  `;

  return (
    <>
      <style>{style}</style>

      <div id="camera-cover">
        <video ref={videoRef} autoPlay playsInline />
        <canvas ref={canvasRef} style={{display:'none'}} />

        {maskReady && (
          <div id="mask-layer" className={flash?'flash':''}/>
        )}

        <button id="closeBtn" onClick={onClose}>✕</button>

        <div id="testBox">
          Bordes: {debug.b}<br/>
          Dentro: {debug.inside}<br/>
          Fuera: {debug.out}<br/>
          Fill%: {debug.pct}
        </div>
      </div>
    </>
  );
}
