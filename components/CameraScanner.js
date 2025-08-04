import { useEffect, useRef, useState } from "react";

export default function CameraScanner({ onCapture, onClose }) {
  /* ---------- refs & estado ---------- */
  const videoRef   = useRef(null);
  const canvasRef  = useRef(null);          // para procesado
  const streamRef  = useRef(null);
  const [stats, setStats] = useState({ total: 0, inside: 0, outside: 0 });
  const [flash,  setFlash] = useState(false);
  /*  Ajustes rápidos  */
const MIN_EDGES_TOTAL   = 8000;
const MIN_EDGES_INSIDE  = 4000;
const MIN_RATIO_INSIDE  = 0.45;
const MIN_FILL_INSIDE   = 0.18;   // 18 %


  /* ---------- iniciar cámara ---------- */
  useEffect(() => {
    (async () => {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width:  { ideal: 1280 },
          height: { ideal: 720  }
        }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      startLoop();               // comienza análisis
    })();

    /* limpiar al desmontar */
    return () => {
      if (streamRef.current)
        streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, []);

  /* ---------- bucle de análisis ---------- */
  const startLoop = () => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    const ctx    = canvas.getContext("2d");

    const svgImg = new Image();
    svgImg.src   = "/plantilla_silueta.svg";   // misma ruta
    svgImg.onload = () => loop();              // inicia cuando cargue

    const loop = () => {
      if (!video || video.readyState < 2) return requestAnimationFrame(loop);

      /* 1. pinta frame en canvas -------------- */
      canvas.width  = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      /* 2. Canny + contorno ------------------- */
      const src = cv.imread(canvas);
      cv.cvtColor(src, src, cv.COLOR_RGBA2GRAY);
      cv.GaussianBlur(src, src, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);
      const edges = new cv.Mat();
      cv.Canny(src, edges, 40, 100);           // umbrales suaves

      /* 3. contorno silueta → Path2D ---------- */
      // Usamos el <img> del SVG y lo dibujamos sobre un off-screen canvas
      const maskCanvas = document.createElement("canvas");
      maskCanvas.width  = canvas.width;
      maskCanvas.height = canvas.height;
      const mCtx = maskCanvas.getContext("2d");
      mCtx.drawImage(svgImg, 0, 0, maskCanvas.width, maskCanvas.height);
      const maskData = mCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height).data;
/******** 4-5. contar y decidir disparo ********/
let insideEdges = 0, totalEdges = 0, satPixels = 0, maskPixels = 0;
for (let y = 0; y < canvas.height; y += 1) {
  for (let x = 0; x < canvas.width; x += 1) {
    const idx = (y * canvas.width + x) * 4;
    const edge = edges.data[idx] !== 0;
    if (edge) totalEdges++;

    // máscara alfa
    const alpha = maskData[idx + 3];
    if (alpha > 0) {                 // punto está dentro del SVG
      maskPixels++;
      if (edge) insideEdges++;

      // saturación: usamos R/G/B para descartar gris liso
      const r = src.data[idx], g = src.data[idx+1], b = src.data[idx+2];
      const max = Math.max(r,g,b), min = Math.min(r,g,b);
      if (max - min > 25) satPixels++;   // 25 ≈ umbral de saturación
    }
  }
}
const ratioInside = totalEdges ? insideEdges / totalEdges : 0;
const fillInside  = maskPixels ? satPixels  / maskPixels  : 0;

setStats({
  total: totalEdges,
  inside: insideEdges,
  outside: totalEdges - insideEdges,
  fill: fillInside.toFixed(2)
});

/* criterio */
const ok =
  totalEdges  > MIN_EDGES_TOTAL   &&
  insideEdges > MIN_EDGES_INSIDE  &&
  ratioInside > MIN_RATIO_INSIDE  &&
  fillInside  > MIN_FILL_INSIDE;

if (ok && !flash) {
  setFlash(true); setTimeout(() => setFlash(false),150);
  takePhoto();
}


      /* limpiar */
      src.delete(); edges.delete();

      requestAnimationFrame(loop);
    };
  };

  /* ---------- capturar ---------- */
  const takePhoto = () => {
    // frame actual → blob
    const canvas = document.createElement("canvas");
    const v  = videoRef.current;
    canvas.width  = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext("2d").drawImage(v, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(blob => {
      onCapture(blob);     // envía al padre
      onClose();           // cierra modal
    }, "image/jpeg", 0.9);
  };

  /* ---------- UI ---------- */
  return (
    <div className="camera-modal">
      {/* vídeo */}
      <video ref={videoRef} className="camera-video" playsInline muted />

      {/* overlay con máscara */}
      <div className={`overlay-mask ${flash ? "flash" : ""}`} />

      {/* TEST INFO */}
      <div className="test-box">
        <strong>TEST INFO</strong><br/>
        Bordes:&nbsp; {stats.total}<br/>
        Dentro:&nbsp; {stats.inside}<br/>
        Fuera:&nbsp;&nbsp; {stats.outside}
        Fill%:&nbsp; {Math.round(stats.fill*100)}
      </div>

      {/* canvas hidden para OpenCV */}
      <canvas ref={canvasRef} style={{ display:"none" }} />

      {/* cerrar */}
      <button className="close-btn" onClick={onClose}>✕</button>

      {/* === estilos in-file === */}
      <style jsx>{`
        .camera-modal{
          position:fixed;inset:0;background:#000;z-index:9999;
          display:flex;justify-content:center;align-items:center;
        }
        .camera-video{width:100%;height:100%;object-fit:cover;}
        .overlay-mask{
          position:absolute;inset:0;
          background:rgba(0,0,0,.55);       /* sombra fuera */
          -webkit-mask: url('/plantilla_silueta.svg') no-repeat 50% 50% / contain;
          mask:         url('/plantilla_silueta.svg') no-repeat 50% 50% / contain;
          pointer-events:none;transition:background-color .15s;
        }
        .overlay-mask.flash{background:rgba(0,255,0,.3);}
        .test-box{
          position:absolute;top:28px;left:32px;
          background:rgba(0,0,0,.6);color:#fff;
          font-family:monospace;font-size:15px;
          padding:8px 11px;border-radius:3px;
        }
        .close-btn{
          position:absolute;top:28px;right:28px;
          width:46px;height:46px;border-radius:50%;
          background:rgba(0,0,0,.55);color:#fff;border:none;
          font-size:28px;line-height:46px;cursor:pointer;
        }
      `}</style>
    </div>
  );
}
