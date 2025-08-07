// components/CameraScanner.js
import { useEffect, useRef, useState } from "react";

export default function CameraScanner({ onCapture, onClose }) {

  /* ───── AJUSTES RÁPIDOS ─────────────────────────── */
  const DEBUG    = true;   // ← pon false en producción
  const FILL_TH  = 55;     // % mín. bordes
  const AREA_TH  = 60;     // % mín. superficie válida
  const EDGE_MIN = 250;    // bordes mínimos
  const LUMA_MIN = 120;    // rango de luminancia válido
  const LUMA_MAX = 600;

  /* ───── REFS / STATE ────────────────────────────── */
  const videoRef  = useRef(null);
  const streamRef = useRef(null);
  const doneRef   = useRef(false);

  const [ready,      setReady]      = useState(false);
  const [maskD,      setMaskD]      = useState(null);
  const [fillEdges,  setFillEdges]  = useState(0);
  const [fillArea,   setFillArea]   = useState(0);
  const [flash,      setFlash]      = useState(false);
  const [cover,      setCover]      = useState(true);  // overlay inicial

  /* ───── 1· Cargar silueta ───────────────────────── */
  useEffect(() => {
    fetch("/plantilla_silueta.svg")
      .then(r => r.text())
      .then(txt => {
        const d = new DOMParser()
          .parseFromString(txt, "image/svg+xml")
          .querySelector("path")?.getAttribute("d");
        if (d) setMaskD(d);
      });
  }, []);

  /* ───── 2· Abrir cámara ────────────────────────── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 } }
        });
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        streamRef.current       = stream;
        videoRef.current.srcObject = stream;

        videoRef.current.onloadedmetadata = () => {
          /* Cámara lista → quitamos overlay con fade */
          setReady(true);
          setTimeout(() => setCover(false), 300); // mismo retraso que antes
        };
      } catch {
        alert("No se pudo acceder a la cámara");
        onClose();
      }
    })();
    return () => { cancelled = true; };
  }, [onClose]);

  /* ───── 3· Loop detección ───────────────────────── */
  useEffect(() => {
    if (!ready || !maskD || doneRef.current) return;

    const v = videoRef.current;
    const W = v.videoWidth;
    const H = v.videoHeight;
    if (!W || !H) return;

    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");

    const vb = 1365.333;
    const path = new Path2D();
    path.addPath(new Path2D(maskD), new DOMMatrix().scale(W / vb, H / vb));

    let alive = true;
    (function step() {
      if (!alive || doneRef.current) return;

      ctx.drawImage(v, 0, 0, W, H);
      const px = ctx.getImageData(0, 0, W, H).data;

      /* —— Métrica bordes —— */
      let inEdg=0, edgeCnt=0;
      for (let y = 0; y < H; y += 2) {
        for (let x = 0; x < W; x += 2) {
          const i  = (y * W + x) * 4;
          const l1 = px[i] + px[i+1] + px[i+2];
          const l2 = px[i+8] + px[i+9] + px[i+10];
          if (Math.abs(l1 - l2) > 70) {
            edgeCnt++;
            if (ctx.isPointInPath(path, x, y)) inEdg++;
          }
        }
      }
      const pctEdges = (inEdg / (edgeCnt || 1)) * 100;

      /* —— Métrica superficie —— */
      let inMask = 0, validLum = 0;
      for (let y = 0; y < H; y += 3) {
        for (let x = 0; x < W; x += 3) {
          if (!ctx.isPointInPath(path, x, y)) continue;
          inMask++;
          const j = (y * W + x) * 4;
          const lum = px[j] + px[j+1] + px[j+2];
          if (lum > LUMA_MIN && lum < LUMA_MAX) validLum++;
        }
      }
      const pctArea = (validLum / (inMask || 1)) * 100;

      setFillEdges(pctEdges);
      setFillArea(pctArea);

      /* DEBUG info */
      if (DEBUG) {
        const dbg = document.getElementById("dbg");
        if (dbg) dbg.textContent =
          `Edges: ${edgeCnt}\nFillEdg%: ${pctEdges.toFixed(1)}\nFillArea%: ${pctArea.toFixed(1)}`;
      }

      /* Disparo */
      if (
        pctEdges > FILL_TH &&
        pctArea  > AREA_TH &&
        edgeCnt   > EDGE_MIN
      ) {
        doneRef.current = true;
        shoot(); return;
      }
      setTimeout(step, 350);
    })();

    return () => { alive = false; };
  }, [ready, maskD]);

  /* ───── 4· Captura ─────────────────────────────── */
  const shoot = () => {
    setFlash(true);
    setTimeout(() => setFlash(false), 500);

    const v = videoRef.current;
    const c = document.createElement("canvas");
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d").drawImage(v, 0, 0);

    c.toBlob(blob => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      onCapture(blob);
      onClose();
    }, "image/jpeg", 0.85);
  };

  /* ───── 5· Cerrar manual ───────────────────────── */
  const handleClose = () => {
    doneRef.current = true;
    streamRef.current?.getTracks().forEach(t => t.stop());
    onClose();
  };

  /* ───── JSX ────────────────────────────────────── */
  return (
    <div className="wrap">
      {/* Overlay negro + spinner (fade-out al ready) */}
      <div className={`cover ${cover ? "" : "hide"}`}>
        <div className="spinner" />
      </div>

      <video ref={videoRef} autoPlay playsInline className="cam" />

      {ready && maskD && (
        <>
          {/* silueta + contorno */}
          <svg className="mask" viewBox="0 0 1365.333 1365.333"
               preserveAspectRatio="xMidYMid slice">
            <defs>
              <mask id="hole">
                <rect width="100%" height="100%" fill="#fff" />
                <path d={maskD} fill="#000" />
              </mask>
            </defs>
            <rect width="100%" height="100%"
                  fill="rgba(0,0,0,0.55)" mask="url(#hole)" />
            <path d={maskD} fill="none" stroke="#fff" strokeWidth="3" />
          </svg>

          {DEBUG && (
            <>
              <div className="barBox">
                <div
                  className="bar"
                  style={{
                    width: `${Math.min(fillEdges, fillArea, 100)}%`,
                    background:
                      fillEdges > FILL_TH && fillArea > AREA_TH
                        ? "#10cf48" : "#f2c522"
                  }}
                />
              </div>
              <pre id="dbg" className="dbg" />
            </>
          )}

          <button className="cls" onClick={handleClose}>✕</button>
        </>
      )}

      {flash && <div className="flash">📸 Captura</div>}

      {/* —— estilos —— */}
      <style jsx>{`
        .wrap{position:fixed;inset:0;z-index:9999;}

        /* Overlay apertura */
        .cover{position:absolute;inset:0;background:#000;display:flex;
               align-items:center;justify-content:center;opacity:1;
               transition:opacity .45s ease;}
        .cover.hide{opacity:0;pointer-events:none;}
        .spinner{width:46px;height:46px;border:4px solid #fff;
                 border-top-color:transparent;border-radius:50%;
                 animation:spin .9s linear infinite;}
        @keyframes spin{to{transform:rotate(360deg);}}

        .cam{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;}
        .mask{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;}

        .barBox{position:absolute;bottom:16px;left:50%;
                transform:translateX(-50%);width:80%;height:12px;
                background:#444;border-radius:6px;overflow:hidden;}
        .bar{height:100%;transition:width .25s;}

        .dbg{position:absolute;top:16px;left:16px;background:rgba(0,0,0,.55);
             color:#fff;padding:6px 10px;font-size:13px;border-radius:4px;
             white-space:pre-line;}

        .cls{position:absolute;top:16px;right:16px;width:48px;height:48px;
             border:none;border-radius:50%;background:#035c3b;color:#fff;
             display:flex;align-items:center;justify-content:center;
             font-size:28px;cursor:pointer;}

        .flash{position:absolute;inset:0;background:rgba(0,0,0,.78);
               display:flex;align-items:center;justify-content:center;
               color:#fff;font-size:1.3rem;pointer-events:none;}
      `}</style>
    </div>
  );
}
