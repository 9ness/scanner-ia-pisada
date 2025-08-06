import { useEffect, useRef, useState } from "react";

export default function CameraScanner({ onCapture, onClose }) {
  const videoRef   = useRef(null);
  const streamRef  = useRef(null);
  const [ready, setReady]           = useState(false);
  const [maskD, setMaskD]           = useState(null);
  const [coincidencia, setCoinc]    = useState(0);
  const [showFlash, setShowFlash]   = useState(false);

  /* bandera global: evita disparos y desmontes dobles */
  const doneRef = useRef(false);

  /* ───── 1. Cargar SVG una vez ───────────────────────────── */
  useEffect(() => {
    fetch("/plantilla_silueta.svg")
      .then(r => r.text())
      .then(txt => {
        const d = new DOMParser().parseFromString(txt, "image/svg+xml")
                   .querySelector("path")?.getAttribute("d");
        if (d) setMaskD(d);
      });
  }, []);

  /* ───── 2. Abrir cámara ─────────────────────────────────── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 } }
        });
        if (cancelled) return s.getTracks().forEach(t => t.stop());
        streamRef.current           = s;
        videoRef.current.srcObject  = s;
        videoRef.current.onloadedmetadata = () => setReady(true);
      } catch {
        alert("No se pudo acceder a la cámara");
        onClose();
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [onClose]);

  /* ───── 3. Detección + disparo ──────────────────────────── */
  useEffect(() => {
    if (!ready || !maskD || doneRef.current) return;

    const v = videoRef.current;
    const W = v.videoWidth;
    const H = v.videoHeight;
    if (!W || !H) return;

    const can = document.createElement("canvas");
    can.width = W;
    can.height = H;
    const ctx  = can.getContext("2d");

    const vb = { w: 1365.333, h: 1365.333 };
    const sx = W / vb.w;
    const sy = H / vb.h;
    const p0 = new Path2D(maskD);
    const mask = new Path2D();
    mask.addPath(p0, new DOMMatrix().scale(sx, sy));

    let run = true;
    function loop() {
      if (!run || doneRef.current) return;

      ctx.drawImage(v, 0, 0, W, H);
      const d = ctx.getImageData(0, 0, W, H).data;
      let inCnt = 0, edgeCnt = 0;

      for (let y = 0; y < H; y += 2) {
        for (let x = 0; x < W; x += 2) {
          const i = (y * W + x) * 4,
                l1 = d[i] + d[i+1] + d[i+2],
                l2 = d[i+8] + d[i+9] + d[i+10];
          if (Math.abs(l1 - l2) > 70) {
            edgeCnt++;
            if (ctx.isPointInPath(mask, x, y)) inCnt++;
          }
        }
      }
      const fill = (inCnt / (edgeCnt || 1)) * 100;
      setCoinc(fill);

      if (fill > 75 && edgeCnt > 500 && !doneRef.current) {
        doneRef.current = true;
        flashAndShoot();
        return;
      }
      setTimeout(loop, 400);
    }
    loop();
    return () => { run = false; };
  }, [ready, maskD]);

  /* ───── 4. Capturar y cerrar ────────────────────────────── */
  const flashAndShoot = () => {
    setShowFlash(true);
    setTimeout(() => setShowFlash(false), 700);

    const v = videoRef.current;
    const c = document.createElement("canvas");
    c.width  = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d").drawImage(v, 0, 0);

    c.toBlob(blob => {
      if (!blob) return;
      onCapture(blob);   // entrega al padre
      onClose();         // cierra inmediatamente
    }, "image/jpeg", 0.85);
  };

  const handleClose = () => {
    doneRef.current = true;
    streamRef.current?.getTracks().forEach(t => t.stop());
    onClose();
  };

  /* ───── JSX ─────────────────────────────────────────────── */
  return (
    <div className="cam-wrap">
      <video ref={videoRef} autoPlay playsInline className="cam" />

      {/* Barra de porcentaje */}
      <div className="bar-shell">
        <div
          className="bar"
          style={{
            width: `${Math.min(coincidencia, 100)}%`,
            background: coincidencia > 75 ? "#10cf48" : "#f2c522"
          }}
        />
      </div>

      {/* Máscara */}
      {maskD && (
        <svg className="mask" viewBox="0 0 1365.333 1365.333" preserveAspectRatio="xMidYMid slice">
          <defs>
            <mask id="hole">
              <rect width="100%" height="100%" fill="#fff" />
              <path d={maskD} fill="#000" />
            </mask>
          </defs>
          <rect width="100%" height="100%" fill="rgba(0,0,0,0.55)" mask="url(#hole)" />
          <path d={maskD} fill="none" stroke="#fff" strokeWidth="3" />
        </svg>
      )}

      {/* Botón cerrar */}
      <button className="close" onClick={handleClose}>✕</button>

      {/* Flash de captura */}
      {showFlash && <div className="flash">📸 Captura</div>}

      {/* estilos in-component */}
      <style jsx>{`
        .cam-wrap {position:fixed;inset:0;z-index:9999;}
        .cam {position:absolute;inset:0;width:100%;height:100%;object-fit:cover;}
        .mask {position:absolute;inset:0;width:100%;height:100%;pointer-events:none;}
        .bar-shell{position:absolute;bottom:16px;left:50%;transform:translateX(-50%);
                   width:80%;height:12px;background:#444;border-radius:6px;overflow:hidden}
        .bar{height:100%;transition:width .2s}
        .close{position:absolute;top:16px;right:16px;border:none;background:rgba(0,0,0,.6);
               color:#fff;width:44px;height:44px;border-radius:50%;font-size:24px;cursor:pointer}
        .flash{position:absolute;inset:0;background:rgba(0,0,0,.7);color:#fff;
               display:flex;align-items:center;justify-content:center;font-size:1.4rem}
      `}</style>
    </div>
  );
}
