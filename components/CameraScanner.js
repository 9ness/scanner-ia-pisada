import { useEffect, useRef, useState } from 'react';

export default function CameraScanner({ onCapture, onClose }) {
  /* ───── referencias ───── */
  const videoRef = useRef(null);
  const stream   = useRef(null);
  const dbgBox   = useRef(null);

  /* ───── openCV listo ───── */
  const [cvReady, setCvReady] = useState(false);
  useEffect(() => {
    if (window.cv) { setCvReady(true); return; }          // ya cargado
    const s = document.createElement('script');
    s.src = 'https://docs.opencv.org/4.x/opencv.js';
    s.onload = () => setCvReady(true);
    document.body.appendChild(s);
  }, []);

  /* ───── abrir cámara ───── */
  useEffect(() => {
    (async () => {
      try {
        const st = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal:'environment' }, width:1280, height:720 }
        });
        stream.current = st;
        if (videoRef.current) videoRef.current.srcObject = st;
      } catch (e) {
        alert('No se pudo abrir la cámara');
        onClose();
      }
    })();
    return () => stream.current?.getTracks().forEach(t=>t.stop());
  }, [onClose]);

  /* ───── detección ───── */
  useEffect(() => {
    if (!cvReady) return;

    const video  = videoRef.current;
    const canv   = document.createElement('canvas');
    const ctx    = canv.getContext('2d');

    const loop   = () => {
      if (!video || video.readyState < 2) { requestAnimationFrame(loop); return; }

      /* capturamos frame */
      const { videoWidth:w, videoHeight:h } = video;
      canv.width = w; canv.height = h;
      ctx.drawImage(video,0,0,w,h);

      /* Canny */
      const src = cv.imread(canv);                               // eslint-disable-line no-undef
      const gray = new cv.Mat();
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
      const edges = new cv.Mat();
      cv.Canny(gray, edges, 50, 150);
      gray.delete(); src.delete();

      /* bounding-box aproximado de la silueta (60 vw × 70 vh) */
      const boxW = w * 0.60;
      const boxH = h * 0.70;
      const boxX = (w - boxW)/2;
      const boxY = (h - boxH)/2;

      let total=0, inside=0;
      for (let y=0; y<edges.rows; y++){
        for (let x=0; x<edges.cols; x++){
          if (edges.ucharPtr(y,x)[0]!==0){
            total++;
            if (x>=boxX && x<=boxX+boxW && y>=boxY && y<=boxY+boxH) inside++;
          }
        }
      }
      edges.delete();

      const outside = total - inside;
      if (dbgBox.current){
        dbgBox.current.innerText =
`TEST INFO
Bordes:  ${total}
Dentro:   ${inside}
Fuera:    ${outside}`;
      }

      /* regla de disparo */
      if (total>2500 && inside/total > 0.70){
        // flash verde
        document.body.classList.add('flash-green');
        setTimeout(()=>document.body.classList.remove('flash-green'),140);

        /* foto */
        canv.toBlob(blob => {
          onCapture(blob);
        }, 'image/jpeg', 0.9);
        return; // detener loop
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }, [cvReady, onCapture]);

  /* ───── vista ───── */
  return (
    <div className="cam-modal">
      <video ref={videoRef} autoPlay playsInline muted className="cam-video"/>

      {/* máscara oscura con agujero */}
      <div className="mask-layer" />

      {/* silueta visible */}
      <img src="/plantilla_silueta.svg" alt="silueta" className="silueta-img"/>

      {/* debug */}
      <pre ref={dbgBox} className="debug-box"/>

      {/* cerrar */}
      <button className="close-btn" onClick={onClose}>✕</button>

      {/* ───── CSS in-component ───── */}
      <style jsx global>{`
        .cam-modal{position:fixed;inset:0;z-index:99999;background:#000;overflow:hidden;}
        .cam-video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;}

        /* agujero con mask-composite */
        .mask-layer{
          position:absolute;inset:0;background:rgba(0,0,0,.6);
          -webkit-mask:url('/plantilla_silueta.svg') center/60vw no-repeat;
                  mask:url('/plantilla_silueta.svg') center/60vw no-repeat;
          -webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;
          -webkit-mask-composite:destination-out;mask-composite:exclude;
          pointer-events:none;
        }

        /* contorno guía */
        .silueta-img{
          position:absolute;top:50%;left:50%;
          width:60vw;max-width:380px;transform:translate(-50%,-50%);
          opacity:.85;pointer-events:none;
        }

        .close-btn{
          position:absolute;top:18px;right:18px;z-index:10001;
          width:42px;height:42px;border-radius:50%;
          background:rgba(0,0,0,.45);border:1px solid #fff;
          color:#fff;font-size:24px;line-height:38px;text-align:center;
          cursor:pointer;
        }
        .debug-box{
          position:absolute;top:18px;left:18px;z-index:10001;
          background:rgba(0,0,0,.55);color:#fff;font-size:13px;
          padding:6px 10px;border-radius:4px;line-height:1.25;
          pointer-events:none;
        }

        /* destello verde al detectar */
        .flash-green .mask-layer{
          background:rgba(0,128,0,.55);
          transition:background 120ms;
        }
      `}</style>
    </div>
  );
}
