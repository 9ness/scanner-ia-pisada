import { useEffect, useRef, useState } from "react";

export default function CameraScanner({ onCapture, onClose }) {
  /* ---------- refs & estado ---------- */
  const videoRef   = useRef(null);
  const canvasRef  = useRef(null);          // para procesado
  const streamRef  = useRef(null);
  const [stats, setStats] = useState({ total: 0, inside: 0, outside: 0 });
  const [flash,  setFlash] = useState(false);

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

      /* 4. contar pixels ---------------------- */
      let inside = 0, outside = 0, total = 0;
      for (let i = 0; i < edges.data.length; i += 4) {
        if (edges.data[i] !== 0) {            // blanco = borde
          total++;
          const alpha = maskData[i + 3];      // máscara opaca dentro
          if (alpha > 0) inside++; else outside++;
        }
      }
      setStats({ total, inside, outside });

      /* 5. disparar foto si coincide ---------- */
      const OK  = total > 8000 &&
                  inside > 2500 &&
                  inside / total > 0.40;      // ~40 % bordes dentro

      if (OK) {
        if (!flash) {                         // evita múltiples disparos
          setFlash(true);
          setTimeout(() => setFlash(false), 150);
          takePhoto();
        }
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
