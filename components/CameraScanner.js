/********************************************************************
 * CameraScanner.js  –  modal de cámara con detección automática
 *******************************************************************/
import { useEffect, useRef, useState } from 'react';

export default function CameraScanner({ onCapture, onClose }) {
  /* ───────── refs & estado ───────── */
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);        // canvas de trabajo
  const streamRef = useRef(null);
  const [stats, setStats] = useState({ total: 0, inside: 0, outside: 0, fill: 0 });
  const [flash, setFlash] = useState(false);

  /* ───────── umbrales (ajusta con tus números) ───────── */
  const MIN_EDGES_TOTAL  = 8000;   // bordes en toda la imagen
  const MIN_EDGES_INSIDE = 4000;   // bordes sólo dentro silueta
  const MIN_RATIO_INSIDE = 0.45;   // inside / total
  const MIN_FILL_INSIDE  = 0.18;   // % píxeles “vivos” dentro

  /* ───────── abrir cámara ───────── */
  useEffect(() => {
    (async () => {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width:  { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      startLoop();
    })();

    return () => streamRef.current?.getTracks().forEach(t => t.stop());
  }, []);

  /* ───────── bucle de análisis ───────── */
  const startLoop = () => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    const ctx    = canvas.getContext('2d');

    /* precargamos la máscara SVG como <img> */
    const svgImg = new Image();
    svgImg.src   = '/plantilla_silueta.svg';
    svgImg.onload = loop;

    function loop() {
      if (!video || video.readyState < 2) return requestAnimationFrame(loop);

      /* 1. pintar frame */
      canvas.width  = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      /* 2. convertir a gris y Canny (OpenCV) */
      const src = cv.imread(canvas);
      cv.cvtColor(src, src, cv.COLOR_RGBA2GRAY);
      cv.GaussianBlur(src, src, new cv.Size(5, 5), 0, 0);
      const edges = new cv.Mat();
      cv.Canny(src, edges, 40, 100);

      /* 3. dibujar SVG en un canvas off-screen para sacar alfa */
      const mCan = document.createElement('canvas');
      mCan.width = canvas.width; mCan.height = canvas.height;
      const mCtx = mCan.getContext('2d');
      mCtx.drawImage(svgImg, 0, 0, mCan.width, mCan.height);
      const maskData = mCtx.getImageData(0, 0, mCan.width, mCan.height).data;

      /* 4. recuento de bordes */
      let tot = 0, inEdge = 0, sat = 0, maskPx = 0;
      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const idx = (y * canvas.width + x) * 4;
          const edge = edges.data[idx] !== 0;
          if (edge) tot++;

          const alpha = maskData[idx + 3];
          if (alpha > 0) {          // dentro de la silueta
            maskPx++;
            if (edge) inEdge++;

            // “vida” / saturación rudimentaria
            const r = src.data[idx], g = src.data[idx+1], b = src.data[idx+2];
            const diff = Math.max(r, g, b) - Math.min(r, g, b);
            if (diff > 25) sat++;
          }
        }
      }
      const ratio = tot ? inEdge / tot : 0;
      const fill  = maskPx ? sat    / maskPx : 0;

      setStats({ total: tot, inside: inEdge, outside: tot - inEdge, fill });

      const ok =
        tot      > MIN_EDGES_TOTAL  &&
        inEdge   > MIN_EDGES_INSIDE &&
        ratio    > MIN_RATIO_INSIDE &&
        fill     > MIN_FILL_INSIDE;

      if (ok && !flash) {
        setFlash(true);
        setTimeout(() => setFlash(false), 120);
        takePhoto();
      }

      src.delete(); edges.delete();
      requestAnimationFrame(loop);
    }
  };

  /* ───────── disparo foto ───────── */
  const takePhoto = () => {
    const v = videoRef.current;
    const snap = document.createElement('canvas');
    snap.width  = v.videoWidth;
    snap.height = v.videoHeight;
    snap.getContext('2d').drawImage(v, 0, 0, snap.width, snap.height);

    snap.toBlob(blob => {
      onCapture(blob);
      onClose();          // cerrar modal
    }, 'image/jpeg', 0.9);
  };

  /* ───────── UI ───────── */
  return (
    <div id="camera-cover">
      <video ref={videoRef} playsInline muted />

      {/*   capa con máscara   */}
      <div id="mask-layer" className={flash ? 'flash' : ''} />

      {/*   info   */}
      <pre id="testBox">
        TEST INFO{'\n'}
        Bordes:  {stats.total}{'\n'}
        Dentro:  {stats.inside}{'\n'}
        Fuera:   {stats.outside}{'\n'}
        Fill%:   {Math.round(stats.fill*100)}
      </pre>

      <button id="closeBtn" onClick={onClose}>✕</button>

      {/* canvas oculto para OpenCV */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* ——— estilos infile ——— */}
      <style jsx>{`
        #camera-cover{
          position:fixed;inset:0;background:#000;
          display:flex;justify-content:center;align-items:center;
          overflow:hidden;z-index:9999;
        }
        #camera-cover video{
          position:absolute;inset:0;width:100%;height:100%;object-fit:cover;
        }
      `}</style>
    </div>
  );
}
