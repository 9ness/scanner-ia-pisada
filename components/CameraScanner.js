import { useEffect, useRef, useState } from "react";

export default function CameraScanner({ onCapture, onClose }) {
  const videoRef   = useRef(null);
  const streamRef  = useRef(null);
  const [ready, setReady] = useState(false);      // cámara estabilizada
  const [lockCnt, setLockCnt] = useState(0);      // detecciones consecutivas

  /* ───── Arrancar cámara ─────────────────────────────── */
  useEffect(() => {
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } }
        });
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        /* esperamos 1 s para que auto-exposición y foco se asienten */
        setTimeout(() => setReady(true), 1000);
      } catch (e) {
        alert("No se pudo abrir la cámara");
        onClose();
      }
    })();
    /* cleanup */
    return () => streamRef.current?.getTracks().forEach(t => t.stop());
  }, []);

  /* ───── Detección cada 400 ms ───────────────────────── */
  useEffect(() => {
    if (!ready) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    const svgMask = document.getElementById("plantilla-mask");  // el path
    const maskPath = new Path2D(svgMask?.getAttribute("d") || "");

    const W = video.videoWidth;
    const H = video.videoHeight;
    canvas.width = W;  canvas.height = H;

    const tick = () => {
      if (!video || video.readyState < 2) return req();  // frame no listo

      ctx.drawImage(video, 0, 0, W, H);
      const imgData = ctx.getImageData(0, 0, W, H).data;

      let inCnt = 0, outCnt = 0, edgeCnt = 0;
      const step = 4 * 4; // muestreo 4px

      for (let y = 0; y < H; y += 4) {
        for (let x = 0; x < W; x += 4) {
          const i = (y * W + x) * 4;
          const lum  = imgData[i] + imgData[i+1] + imgData[i+2];
          const lum2 = imgData[i+step] + imgData[i+step+1] + imgData[i+step+2];
          if (Math.abs(lum - lum2) > 80) {            // borde simple
            edgeCnt++;
            (ctx.isPointInPath(maskPath, x, y) ? inCnt : outCnt)++;
          }
        }
      }

      const fillPct    = inCnt  / (edgeCnt || 1) * 100;
      const outsidePct = outCnt / (edgeCnt || 1) * 100;

      // Mostrar info
      document.getElementById("dbg").textContent =
        `Bordes: ${edgeCnt}\nDentro: ${inCnt}\nFuera: ${outCnt}\nFill%: ${fillPct.toFixed(1)}`;

      const ok = fillPct > 15 && outsidePct < 4;

      setLockCnt(c => {
        const next = ok ? c + 1 : 0;
        if (next >= 3) takePhoto();
        return next;
      });

      req();
    };
    const req = () => setTimeout(tick, 400);
    req();
  }, [ready]);

  /* ───── Capturar frame y devolverlo al padre ────────── */
  const takePhoto = () => {
    const v = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext("2d").drawImage(v, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) onCapture(blob);
    }, "image/jpeg", 0.8);
  };

  return (
    <div className="cam-wrapper">
      <video ref={videoRef} autoPlay playsInline className="cam-video" />
      {/* Máscara SVG fija */}
      <svg className="mask-svg" viewBox="0 0 1365.333 1365.333">
        <defs>
          <mask id="hole">
            {/* exterior negro (oculta) */}
            <rect width="100%" height="100%" fill="black" />
            {/* interior blanco (se ve) */}
            <path id="plantilla-mask"
                  d="M669.33329,1261.0846c49.3713-9.3258 85.28282-53.7974 100.46952-124.418 ...."
                  fill="white" />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(0,0,0,0.55)" mask="url(#hole)" />
        {/* contorno visible para guiar */}
        <use href="#plantilla-mask" fill="none" stroke="white" strokeWidth="3" />
      </svg>

      {/* Botón cerrar */}
      <button className="cls-btn" onClick={onClose}>✕</button>

      {/* Debug */}
      <pre id="dbg" className="dbg" />

      {/* estilos */}
      <style jsx>{`
        .cam-wrapper{
          position:fixed;inset:0;z-index:9999;background:#000;display:flex;justify-content:center;align-items:center;
        }
        .cam-video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;}
        .mask-svg{position:absolute;inset:0;width:100%;height:100%;}
        .cls-btn{position:absolute;top:16px;right:16px;border:none;background:rgba(0,0,0,.6);
                 color:#fff;font-size:24px;width:44px;height:44px;border-radius:50%;cursor:pointer;}
        .dbg{position:absolute;top:16px;left:16px;background:rgba(0,0,0,.55);color:#fff;
             padding:6px 10px;font-size:13px;white-space:pre-line;border-radius:4px;}
      `}</style>
    </div>
  );
}
