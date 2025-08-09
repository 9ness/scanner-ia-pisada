import { useEffect, useRef, useState } from "react";

export default function CameraScanner({ onCapture, onClose }) {
  /* ───── Ajustes ───── */
  const DEBUG        = true;     // false en prod

  // UMBRALES
  const STROKE_TH    = 0.58;     // % en aro-dentro respecto a aro-total (0–1)
  const AREA_TH      = 40;       // % de ocupación “válida” en la máscara
  const NEAR_MIN     = 600;      // nº mínimo de bordes en el aro-dentro
  const NEAR_IO_TH   = 1.4;      // más bordes en el aro-dentro que en el aro-fuera

  // Luminancia y bordes
  const LUMA_MIN     = 120;
  const LUMA_MAX     = 600;
  const EDGE_T       = 70;
  const SAMPLE_STEP  = 2;        // muestreo de bordes
  const AREA_STEP    = 3;        // muestreo de área
  const STROKE_W_PCT = 0.050;    // 5% del lado menor → tolerancia al desfase

  const CONSEC_FRAMES = 3;       // frames válidos seguidos para disparar

  /* ───── Refs / estado ───── */
  const videoRef  = useRef(null);
  const streamRef = useRef(null);
  const doneRef   = useRef(false);

  const [ready,  setReady]  = useState(false);
  const [cover,  setCover]  = useState(true);
  const [maskD,  setMaskD]  = useState(null);
  const [barPct, setBarPct] = useState(0);
  const [flash,  setFlash]  = useState(false);

  /* 1) Cargar silueta */
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

  /* 2) Abrir cámara */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 } }
        });
        if (cancelled) {
          s.getTracks().forEach(t => t.stop());
          return;
        }
        streamRef.current = s;
        videoRef.current.srcObject = s;
        videoRef.current.onloadedmetadata = () => {
          setReady(true);
          setTimeout(() => setCover(false), 300);
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
    const W = v.videoWidth;
    const H = v.videoHeight;
    if (!W || !H) return;

    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");

    // Path al tamaño del vídeo
    const vb   = 1365.333;
    const path = new Path2D();
    path.addPath(new Path2D(maskD), new DOMMatrix().scale(W / vb, H / vb));

    // franja del contorno
    const strokeW = Math.max(3, Math.round(Math.min(W, H) * STROKE_W_PCT));

    let alive = true;
    let consecutiveOk = 0;

    (function step() {
      if (!alive || doneRef.current) return;

      ctx.drawImage(v, 0, 0, W, H);
      const px = ctx.getImageData(0, 0, W, H).data;

      /* Bordes SOLO en torno al contorno */
      let nearIn = 0, nearOut = 0, totalEdges = 0;

      ctx.save();
      ctx.lineWidth = strokeW;       // esto define el ancho del "aro"
      for (let y = 0; y < H; y += SAMPLE_STEP) {
        for (let x = 0; x < W; x += SAMPLE_STEP) {
          const i  = (y * W + x) * 4;
          const l1 = px[i] + px[i+1] + px[i+2];
          const l2 = px[i + 4*SAMPLE_STEP] + px[i+1 + 4*SAMPLE_STEP] + px[i+2 + 4*SAMPLE_STEP];
          if (Math.abs(l1 - l2) > EDGE_T) {
            totalEdges++;
            if (ctx.isPointInStroke(path, x, y)) {
              // está en el aro
              ctx.isPointInPath(path, x, y) ? nearIn++ : nearOut++;
            }
          }
        }
      }
      ctx.restore();

      // ratio de bordes en el aro que caen por dentro
      const strokeRatio = nearIn / (nearIn + nearOut || 1);  // 0..1

      /* Área: luminancia dentro de la máscara */
      let pixelsIn = 0, validLum = 0;
      for (let y = 0; y < H; y += AREA_STEP) {
        for (let x = 0; x < W; x += AREA_STEP) {
          if (!ctx.isPointInPath(path, x, y)) continue;
          pixelsIn++;
          const j = (y * W + x) * 4;
          const lum = px[j] + px[j+1] + px[j+2];
          if (lum > LUMA_MIN && lum < LUMA_MAX) validLum++;
        }
      }
      const areaPct = (validLum / (pixelsIn || 1)) * 100;

      // para la barra mostramos StrokeRatio (en %)
      setBarPct(strokeRatio * 100);

      // Relación “aro dentro / aro fuera”
      const nearIORatio = nearIn / (nearOut + 1);

      if (DEBUG) {
        const dbg = document.getElementById("dbg");
        if (dbg) dbg.textContent =
          `EdgesTot: ${totalEdges}\n` +
          `NearIn:   ${nearIn}\n` +
          `NearOut:  ${nearOut}\n` +
          `Stroke%:  ${(strokeRatio*100).toFixed(1)}\n` +
          `Area%:    ${areaPct.toFixed(1)}\n` +
          `IO_Ratio: ${nearIORatio.toFixed(2)}\n` +
          `Consec:   ${consecutiveOk}/${CONSEC_FRAMES}`;
      }

      const ok =
        strokeRatio > STROKE_TH &&
        areaPct     > AREA_TH   &&
        nearIn      > NEAR_MIN  &&
        nearIORatio > NEAR_IO_TH;

      if (ok) {
        consecutiveOk++;
        if (consecutiveOk >= CONSEC_FRAMES && !doneRef.current) {
          doneRef.current = true;
          shoot(); return;
        }
      } else {
        consecutiveOk = 0;
      }

      setTimeout(step, 300);
    })();

    return () => { alive = false; };
  }, [ready, maskD]);

  /* 4) Capturar */
  function shoot() {
    setFlash(true);
    setTimeout(() => setFlash(false), 450);

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

  /* 5) Cerrar manual */
  function handleClose() {
    doneRef.current = true;
    streamRef.current?.getTracks().forEach(t => t.stop());
    onClose();
  }

  /* UI */
  return (
    <div className="wrap">
      {/* overlay de carga */}
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
        .cover{position:absolute;inset:0;background:#000;display:flex;
               align-items:center;justify-content:center;transition:opacity .45s;opacity:1}
        .cover.hide{opacity:0;pointer-events:none}
        .spinner{width:46px;height:46px;border:4px solid #fff;border-top-color:transparent;border-radius:50%;
                 animation:spin .9s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        .cam{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
        .mask{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
        .barBox{position:absolute;bottom:16px;left:50%;transform:translateX(-50%);
                width:80%;height:12px;background:#444;border-radius:6px;overflow:hidden}
        .bar{height:100%;transition:width .25s}
        .cls{position:absolute;top:16px;right:16px;width:48px;height:48px;border:none;border-radius:50%;
             background:#035c3b;color:#fff;display:flex;align-items:center;justify-content:center;font-size:28px;cursor:pointer}
        .dbg{position:absolute;top:16px;left:16px;background:rgba(0,0,0,.55);color:#fff;padding:6px 10px;font-size:13px;border-radius:4px;white-space:pre-line}
        .flash{position:absolute;inset:0;background:rgba(0,0,0,.78);display:flex;align-items:center;justify-content:center;color:#fff;font-size:1.3rem;pointer-events:none}
      `}</style>
    </div>
  );
}
