import { useEffect, useRef, useState } from "react";

export default function CameraScanner({ onCapture, onClose }) {

  /* ───────── AJUSTES RÁPIDOS ───────── */
  const DEBUG        = true;        // ← false en prod

  // Umbrales principales
  const STROKE_TH    = 0.55;        // 55% de borde interno cayendo en el anillo
  const AREA_TH      = 40;          // 40% de área válida en la máscara
  const EDGE_MIN     = 1500;        // bordes totales mínimos (dentro+fuera)
  const IO_RATIO_TH  = 1.6;         // relación In/Out mínima (más robusto)

  // Luminancia + muestreos
  const LUMA_MIN     = 120;
  const LUMA_MAX     = 600;         // sube a 670–720 si hay sol fuerte
  const EDGE_T       = 70;          // umbral de diferencia de luminancia (borde)
  const SAMPLE_STEP  = 2;           // paso para bordes
  const AREA_STEP    = 3;           // paso para área
  const STROKE_W_PCT = 0.020;       // ~2% del lado menor

  // Robustez temporal (anti-parpadeo)
  const CONSEC_FRAMES = 3;          // frames seguidos cumpliendo

  /* ───────── REFS / STATE ───────── */
  const videoRef  = useRef(null);
  const streamRef = useRef(null);
  const doneRef   = useRef(false);

  const [ready,     setReady]     = useState(false);
  const [cover,     setCover]     = useState(true);
  const [maskD,     setMaskD]     = useState(null);
  const [barPct,    setBarPct]    = useState(0);     // barra = Stroke%
  const [flash,     setFlash]     = useState(false);

  /* ───── 1 · Cargar silueta (1 vez) ───── */
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

  /* ───── 2 · Abrir cámara ───── */
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
        streamRef.current = stream;
        videoRef.current.srcObject = stream;

        videoRef.current.onloadedmetadata = () => {
          setReady(true);
          setTimeout(() => setCover(false), 300); // transición suave
        };
      } catch {
        alert("No se pudo abrir la cámara");
        onClose();
      }
    })();
    return () => { cancelled = true; };
  }, [onClose]);

  /* ───── 3 · Loop detección ───── */
  useEffect(() => {
    if (!ready || !maskD || doneRef.current) return;

    const v = videoRef.current;
    const W = v.videoWidth;
    const H = v.videoHeight;
    if (!W || !H) return;

    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");

    const vb   = 1365.333;
    const path = new Path2D();
    path.addPath(new Path2D(maskD), new DOMMatrix().scale(W / vb, H / vb));
    const strokeW = Math.max(2, Math.round(Math.min(W, H) * STROKE_W_PCT));

    let consecutiveOk = 0;
    let alive = true;

    (function step() {
      if (!alive || doneRef.current) return;

      ctx.drawImage(v, 0, 0, W, H);
      const px = ctx.getImageData(0, 0, W, H).data;

      // -------- Bordes + contorno --------
      let insideEdges = 0, outsideEdges = 0, strokeEdges = 0;

      ctx.save();
      ctx.lineWidth = strokeW;

      for (let y = 0; y < H; y += SAMPLE_STEP) {
        for (let x = 0; x < W; x += SAMPLE_STEP) {
          const i  = (y * W + x) * 4;
          // vecino (x+SAMPLE_STEP, y) protegido por límites
          const nx = Math.min(x + SAMPLE_STEP, W - 1);
          const j  = (y * W + nx) * 4;

          const l1 = px[i] + px[i+1] + px[i+2];
          const l2 = px[j] + px[j+1] + px[j+2];

          if (Math.abs(l1 - l2) > EDGE_T) {
            if (ctx.isPointInPath(path, x, y)) {
              insideEdges++;
              if (ctx.isPointInStroke(path, x, y)) strokeEdges++;
            } else {
              outsideEdges++;
            }
          }
        }
      }
      ctx.restore();

      const strokeRatio = (strokeEdges / (insideEdges || 1)) * 100; // %
      setBarPct(strokeRatio);

      // -------- Área / luminancia --------
      let inMask = 0, validLum = 0;
      for (let y = 0; y < H; y += AREA_STEP) {
        for (let x = 0; x < W; x += AREA_STEP) {
          if (!ctx.isPointInPath(path, x, y)) continue;
          inMask++;
          const k = (y * W + x) * 4;
          const lum = px[k] + px[k+1] + px[k+2];
          if (lum > LUMA_MIN && lum < LUMA_MAX) validLum++;
        }
      }
      const fillArea = (validLum / (inMask || 1)) * 100;

      const edgesTot = insideEdges + outsideEdges;
      const ioRatio  = insideEdges / (outsideEdges + 1);

      // ---- DEBUG OSD ----
      if (DEBUG) {
        const dbg = document.getElementById("dbg");
        if (dbg) {
          dbg.textContent =
            `EdgesTot: ${edgesTot}\n` +
            `InEdges : ${insideEdges}\nOutEdges: ${outsideEdges}\n` +
            `Stroke% : ${strokeRatio.toFixed(1)}\n` +
            `Area%   : ${fillArea.toFixed(1)}\n` +
            `IO_Ratio: ${ioRatio.toFixed(2)}\n` +
            `Consec  : ${consecutiveOk}/${CONSEC_FRAMES}`;
        }
      }

      // ---- Decisión combinada + anti-parpadeo ----
      const ok =
        strokeRatio > STROKE_TH * 100 &&
        fillArea    > AREA_TH &&
        edgesTot    > EDGE_MIN &&
        ioRatio     > IO_RATIO_TH;

      if (ok) {
        consecutiveOk++;
        if (consecutiveOk >= CONSEC_FRAMES && !doneRef.current) {
          doneRef.current = true;
          shoot();
          return;
        }
      } else {
        consecutiveOk = 0;
      }

      setTimeout(step, 320);
    })();

    return () => { alive = false; };
  }, [ready, maskD]);

  /* ───── 4 · Captura ───── */
  function shoot() {
    setFlash(true);
    setTimeout(() => setFlash(false), 450);

    const v = videoRef.current;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;  c.height = v.videoHeight;
    c.getContext("2d").drawImage(v, 0, 0);

    c.toBlob(blob => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      onCapture(blob);
      onClose();
    }, "image/jpeg", 0.85);
  }

  /* ───── 5 · Cerrar manual ───── */
  function handleClose() {
    doneRef.current = true;
    streamRef.current?.getTracks().forEach(t => t.stop());
    onClose();
  }

  /* ───── UI ───── */
  return (
    <div className="wrap">
      {/* overlay de carga */}
      <div className={`cover ${cover ? "" : "hide"}`}>
        <div className="spinner" />
      </div>

      <video ref={videoRef} autoPlay playsInline className="cam" />

      {ready && maskD && (
        <>
          {/* máscara + contorno */}
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

          {/* barra + debug */}
          {DEBUG && (
            <>
              <div className="barBox">
                <div
                  className="bar"
                  style={{
                    width: `${Math.min(barPct, 100)}%`,
                    background: barPct > (STROKE_TH * 100) ? "#10cf48" : "#f2c522"
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

      <style jsx>{`
        .wrap{position:fixed;inset:0;z-index:9999;}

        .cover{position:absolute;inset:0;background:#000;display:flex;
               align-items:center;justify-content:center;transition:opacity .45s;opacity:1;}
        .cover.hide{opacity:0;pointer-events:none;}
        .spinner{width:46px;height:46px;border:4px solid #fff;border-top-color:transparent;
                 border-radius:50%;animation:spin .9s linear infinite;}
        @keyframes spin{to{transform:rotate(360deg);}}

        .cam{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;}
        .mask{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;}

        .barBox{position:absolute;bottom:16px;left:50%;transform:translateX(-50%);
                width:80%;height:12px;background:#444;border-radius:6px;overflow:hidden}
        .bar{height:100%;transition:width .25s}

        .cls{position:absolute;top:16px;right:16px;width:48px;height:48px;border:none;
             border-radius:50%;background:#035c3b;color:#fff;display:flex;
             align-items:center;justify-content:center;font-size:28px;cursor:pointer;}

        .dbg{position:absolute;top:16px;left:16px;background:rgba(0,0,0,.55);
             color:#fff;padding:6px 10px;font-size:13px;border-radius:4px;white-space:pre-line}

        .flash{position:absolute;inset:0;background:rgba(0,0,0,.78);
               display:flex;align-items:center;justify-content:center;
               color:#fff;font-size:1.3rem;pointer-events:none}
      `}</style>
    </div>
  );
}
