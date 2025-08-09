import { useEffect, useRef, useState } from "react";

export default function CameraScanner({ onCapture, onClose }) {
  /* ==== Ajustes rápidos (DS y umbrales) ==== */
  const DEBUG         = true;      // false en prod
  const DS            = 0.50;      // downscale del frame (0.5 = 50%)
  const LOOP_MS       = 180;       // intervalo del loop

  // Aro y umbrales (calibrados para DS=0.5)
  const STROKE_W_PCT  = 0.015;     // ancho aro relativo al lado menor
  const STROKE_TH     = 6.5;       // % bordes en aro respecto a edges totales
  const AREA_TH       = 85;        // % luminancia válida dentro de la silueta
  const NEAR_MIN      = 180;       // mínimos bordes en aro y por dentro
  const EDGES_TOT_MIN = 6000;      // bordes totales mínimos (escena)

  // Ratio “dentro/fuera” del aro aceptable (alrededor de 1)
  const IO_LOW        = 0.75;
  const IO_HIGH       = 1.35;

  // Binarización simple de luminancia y borde
  const LUMA_MIN      = 120;
  const LUMA_MAX      = 600;
  const EDGE_T        = 90;

  const CONSEC_FRAMES = 3;         // anti-parpadeo

  /* ==== Refs / State ==== */
  const videoRef  = useRef(null);
  const streamRef = useRef(null);
  const doneRef   = useRef(false);

  const [ready,   setReady]   = useState(false);
  const [cover,   setCover]   = useState(true);
  const [maskD,   setMaskD]   = useState(null);
  const [barPct,  setBarPct]  = useState(0);
  const [flash,   setFlash]   = useState(false);

  /* 1) Carga silueta */
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

  /* 2) Abrir cámara + overlay */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 } }
        });
        if (cancelled) { s.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = s;
        videoRef.current.srcObject = s;
        videoRef.current.onloadedmetadata = () => {
          setReady(true);
          setTimeout(() => setCover(false), 280);
        };
      } catch {
        alert("No se pudo abrir la cámara");
        onClose();
      }
    })();
    return () => { cancelled = true; };
  }, [onClose]);

  /* 3) Loop detección */
  useEffect(() => {
    if (!ready || !maskD || doneRef.current) return;

    const v = videoRef.current;
    const W = Math.round(v.videoWidth  * DS);
    const H = Math.round(v.videoHeight * DS);
    if (!W || !H) return;

    const canvas = document.createElement("canvas");
    canvas.width = W;  canvas.height = H;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    const vb = 1365.333;
    const path = new Path2D();
    path.addPath(new Path2D(maskD), new DOMMatrix().scale(W / vb, H / vb));

    const strokeW = Math.max(2, Math.round(Math.min(W, H) * STROKE_W_PCT));

    let alive = true;
    let consecutiveOk = 0;

    (function step() {
      if (!alive || doneRef.current) return;

      ctx.drawImage(v, 0, 0, W, H);
      const px = ctx.getImageData(0, 0, W, H).data;

      // --- BORDES ---
      let edgesTot = 0, nearIn = 0, nearOut = 0;
      ctx.save();
      ctx.lineWidth = strokeW;

      for (let y = 0; y < H; y += 2) {
        const base = (y * W) << 2;
        for (let x = 0; x < W - 2; x += 2) {
          const i  = base + (x << 2);
          const l1 = px[i] + px[i+1] + px[i+2];
          const l2 = px[i+8] + px[i+9] + px[i+10];
          const diff = l1 - l2;
          if (diff > EDGE_T || -diff > EDGE_T) {
            edgesTot++;
            if (ctx.isPointInStroke(path, x, y)) {
              if (ctx.isPointInPath(path, x, y)) nearIn++;
              else nearOut++;
            }
          }
        }
      }
      ctx.restore();

      const strokePct = ((nearIn + nearOut) / Math.max(1, edgesTot)) * 100;
      const ioRatio   = nearOut ? (nearIn / nearOut) : 999;

      // --- ÁREA ---
      let pixIn = 0, validLum = 0;
      for (let y = 0; y < H; y += 3) {
        const base = (y * W) << 2;
        for (let x = 0; x < W; x += 3) {
          if (!ctx.isPointInPath(path, x, y)) continue;
          pixIn++;
          const j = base + (x << 2);
          const lum = px[j] + px[j+1] + px[j+2];
          if (lum > LUMA_MIN && lum < LUMA_MAX) validLum++;
        }
      }
      const areaPct = (validLum / Math.max(1, pixIn)) * 100;

      setBarPct(strokePct);

      if (DEBUG) {
        const dbg = document.getElementById("dbg");
        if (dbg) {
          dbg.textContent =
            `EdgesTot: ${edgesTot}\n` +
            `NearIn:   ${nearIn}\n` +
            `NearOut:  ${nearOut}\n` +
            `Stroke%:  ${strokePct.toFixed(1)}\n` +
            `Area%:    ${areaPct.toFixed(1)}\n` +
            `IO_Ratio: ${ioRatio.toFixed(2)}\n` +
            `Consec:   ${consecutiveOk}/${CONSEC_FRAMES}`;
        }
      }

      // --- Condición combinada ---
      const ok =
        edgesTot   >= EDGES_TOT_MIN &&
        strokePct  >= STROKE_TH    &&
        areaPct    >= AREA_TH      &&
        nearIn     >= NEAR_MIN     &&
        ioRatio    >= IO_LOW       &&
        ioRatio    <= IO_HIGH;

      if (ok) {
        consecutiveOk++;
        if (consecutiveOk >= CONSEC_FRAMES && !doneRef.current) {
          doneRef.current = true;
          shoot(); return;
        }
      } else {
        consecutiveOk = 0;
      }

      setTimeout(step, LOOP_MS);
    })();

    return () => { alive = false; };
  }, [ready, maskD]);

  /* 4) Captura */
  function shoot() {
    setFlash(true);
    setTimeout(() => setFlash(false), 420);
    const v = videoRef.current;
    const c = document.createElement("canvas");
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d").drawImage(v, 0, 0);
    c.toBlob((blob) => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      onCapture(blob);
      onClose();
    }, "image/jpeg", 0.85);
  }

  /* 5) Cerrar */
  function handleClose() {
    doneRef.current = true;
    streamRef.current?.getTracks().forEach(t => t.stop());
    onClose();
  }

  /* ==== UI ==== */
  return (
    <div className="wrap">
      <div className={`cover ${cover ? "" : "hide"}`}>
        <div className="spinner" />
      </div>

      <video ref={videoRef} autoPlay playsInline className="cam" />

      {ready && maskD && (
        <>
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

          {DEBUG && (
            <>
              <div className="barBox">
                <div
                  className="bar"
                  style={{ width: `${Math.min(barPct, 100)}%`, background: barPct > 75 ? "#10cf48" : "#f2c522" }}
                />
              </div>
              <pre id="dbg" className="dbg" />
            </>
          )}

          <button className="cls" onClick={handleClose}>✕</button>
        </>
      )}

      {flash && <div className="flash">📸 Captura</div>}

      <style jsx>{`
        .wrap{position:fixed;inset:0;z-index:9999;}
        .cover{position:absolute;inset:0;background:#000;display:flex;align-items:center;
               justify-content:center;opacity:1;transition:opacity .35s ease}
        .cover.hide{opacity:0;pointer-events:none}
        .spinner{width:46px;height:46px;border:4px solid #fff;border-top-color:transparent;border-radius:50%;
                 animation:spin .8s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        .cam{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
        .mask{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
        .barBox{position:absolute;bottom:16px;left:50%;transform:translateX(-50%);
                width:80%;height:12px;background:#444;border-radius:6px;overflow:hidden}
        .bar{height:100%;transition:width .18s}
        .cls{position:absolute;top:16px;right:16px;width:48px;height:48px;border:none;border-radius:50%;
             background:#035c3b;color:#fff;display:flex;align-items:center;justify-content:center;font-size:28px;cursor:pointer}
        .dbg{position:absolute;top:16px;left:16px;background:rgba(0,0,0,.55);color:#fff;padding:6px 10px;
             font-size:13px;border-radius:4px;white-space:pre-line}
        .flash{position:absolute;inset:0;background:rgba(0,0,0,.78);display:flex;align-items:center;
               justify-content:center;color:#fff;font-size:1.3rem;pointer-events:none}
      `}</style>
    </div>
  );
}
