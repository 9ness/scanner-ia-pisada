import { useEffect, useRef, useState } from "react";

export default function CameraScanner({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [maskD, setMaskD] = useState(null);
  const [coincidencia, setCoincidencia] = useState(0);
  const [captured, setCaptured] = useState(false);

  // Flag para evitar dobles capturas y doble desmontaje
  const doneRef = useRef(false);

  // 1. Carga la silueta SVG una vez
  useEffect(() => {
    fetch("/plantilla_silueta.svg")
      .then(r => r.text())
      .then(svg => {
        const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
        const p = doc.querySelector("path");
        if (p) setMaskD(p.getAttribute("d"));
      })
      .catch(() => console.warn("No se pudo cargar la silueta"));
  }, []);

  // 2. Arranca la cámara
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 } }
        });
        if (cancelled) {
          // Si desmonta justo antes de llegar aquí, no hagas nada
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        videoRef.current.onloadedmetadata = () => setReady(true);
      } catch {
        alert("No se pudo abrir la cámara");
        onClose();
      }
    })();
    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, [onClose]);

  // 3. Loop de detección y captura
  useEffect(() => {
    if (!ready || !maskD || doneRef.current) return;

    const video = videoRef.current;
    const W = video.videoWidth;
    const H = video.videoHeight;
    if (!W || !H) return;

    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");

    // Escalar Path2D del SVG al tamaño real del vídeo
    const vb = { width: 1365.333, height: 1365.333 };
    const scaleX = W / vb.width;
    const scaleY = H / vb.height;
    const rawPath = new Path2D(maskD);
    const maskPath = new Path2D();
    maskPath.addPath(rawPath, new DOMMatrix().scale(scaleX, scaleY));

    let running = true;
    function tick() {
      if (!running || doneRef.current) return;

      ctx.drawImage(video, 0, 0, W, H);
      const data = ctx.getImageData(0, 0, W, H).data;
      let inCnt = 0, outCnt = 0, edgeCnt = 0;

      for (let y = 0; y < H; y += 2) {
        for (let x = 0; x < W; x += 2) {
          const i = (y * W + x) * 4;
          const lum = data[i] + data[i+1] + data[i+2];
          const lum2 = data[i + 8] + data[i + 9] + data[i + 10];
          if (Math.abs(lum - lum2) > 70) {
            edgeCnt++;
            if (ctx.isPointInPath(maskPath, x, y)) inCnt++;
            else outCnt++;
          }
        }
      }

      const fillPct = (inCnt / (edgeCnt || 1)) * 100;
      setCoincidencia(fillPct);

      // Notifica visualmente
      if (document.getElementById("dbg")) {
        document.getElementById("dbg").textContent =
          `Bordes: ${edgeCnt}\nDentro: ${inCnt}\nFuera: ${outCnt}\nFill%: ${fillPct.toFixed(1)}%`;
      }

      // Lógica de captura
      if (fillPct > 75 && edgeCnt > 500 && !doneRef.current) {
        doneRef.current = true;
        // Captura foto y cierra
        setCaptured(true);
        setTimeout(() => setCaptured(false), 700);
        setTimeout(() => {
          takePhoto();
        }, 250);
        return;
      }

      setTimeout(tick, 400);
    }

    tick();

    return () => { running = false; };
  }, [ready, maskD, onCapture]);

  // 4. Función para sacar la foto y cerrar
  const takePhoto = () => {
    const v = videoRef.current;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d").drawImage(v, 0, 0);
    c.toBlob(blob => {
      if (blob) {
        onCapture(blob); // El padre debe cerrar el modal
      }
    }, "image/jpeg", 0.8);
  };

  // 5. Al cerrar, resetea el flag y limpia stream
  const handleClose = () => {
    doneRef.current = true;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }
    onClose();
  };

  return (
    <div className="cam-wrapper">
      <video ref={videoRef} autoPlay playsInline className="cam-video" />

      {/* Barra coincidencia */}
      <div style={{
        width: '80%',
        height: '12px',
        background: '#444',
        borderRadius: '6px',
        margin: '14px auto',
        overflow: 'hidden',
        boxShadow: '0 0 5px #111',
      }}>
        <div style={{
          width: `${Math.min(coincidencia, 100)}%`,
          height: '100%',
          background: coincidencia > 75 ? '#10cf48' : '#f2c522',
          transition: 'width 0.2s, background 0.2s'
        }} />
      </div>

      {maskD && (
        <svg className="mask-svg" viewBox="0 0 1365.333 1365.333" preserveAspectRatio="xMidYMid slice">
          <defs>
            <mask id="hole">
              <rect width="100%" height="100%" fill="white" />
              <path d={maskD} fill="black" />
            </mask>
          </defs>
          <rect width="100%" height="100%" fill="rgba(0,0,0,0.55)" mask="url(#hole)" />
          <path d={maskD} fill="none" stroke="white" strokeWidth="3" />
        </svg>
      )}

      <button className="cls-btn" onClick={handleClose}>✕</button>
      <pre id="dbg" className="dbg" />
      {captured && (
        <div className="capture-notice">📸 Captura realizada</div>
      )}
      <style jsx>{`
        .cam-wrapper {position:fixed;inset:0;z-index:9999;}
        .cam-video {position:absolute;inset:0;width:100%;height:100%;object-fit:cover;}
        .mask-svg {position:absolute;inset:0;width:100%;height:100%;pointer-events:none;}
        .cls-btn {position:absolute;top:16px;right:16px;border:none;background:rgba(0,0,0,0.6);
                  color:#fff;font-size:24px;width:44px;height:44px;border-radius:50%;cursor:pointer;}
        .dbg {position:absolute;top:16px;left:16px;background:rgba(0,0,0,0.55);color:#fff;
              padding:6px 10px;font-size:13px;white-space:pre-line;border-radius:4px;}
        .capture-notice {position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
                         background:rgba(0,0,0,0.7);color:#fff;padding:1rem 1.5rem;
                         border-radius:8px;font-size:1.2rem;pointer-events:none;}
      `}</style>
    </div>
  );
}
