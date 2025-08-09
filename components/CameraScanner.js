import { useEffect, useRef, useState } from "react";

export default function CameraScanner({ onCapture, onClose }) {
  /* ===== Parámetros ===== */
  const DEBUG    = true;   // false en producción
  const DS       = 0.50;   // downscale del frame para cálculo
  const LOOP_MS  = 140;    // periodo del loop (ms)

  // Sampling
  const STEP_E = 2;        // paso muestreo para bordes
  const STEP_A = 3;        // paso muestreo para color / textura

  // Aro de comparación
  const STROKE_W_PCT = 0.016;  // grosor del aro exterior (1.6% del lado menor)

  // Detección de bordes / luminancia
  const EDGE_T   = 90;
  const LUMA_MIN = 110;
  const LUMA_MAX = 620;

  // Normalizaciones para Score
  const COLOR_NORM = 85;      // ΔRGB para llegar a 1.0 (≈ contraste de color “claro”)
  const TEX_RATIO_BASE = 0.9; // partimos de 0.9 → si out/in > 0.9 empieza a sumar
  const TEX_RATIO_SPAN = 0.7; // (ratio - base)/span → [0..1]

  const AREA_BASE = 82;       // % ocupación válida a partir del cual empieza a sumar
  const AREA_SPAN = 12;

  // Salvaguardas + disparo
  const NEED_EDGES_MIN  = 2800;  // escena con bordes mínimos
  const NEED_PIXIN_MIN  = 1600;  // píxeles muestreados válidos dentro
  const SHOOT_SCORE     = 72;    // umbral de disparo (0..100)
  const CONSEC_FRAMES   = 3;     // nº de frames seguidos para disparar

  /* ===== Refs/estado ===== */
  const videoRef  = useRef(null);
  const streamRef = useRef(null);
  const doneRef   = useRef(false);

  const [ready,  setReady]  = useState(false);
  const [cover,  setCover]  = useState(true);
  const [maskD,  setMaskD]  = useState(null);
  const [score,  setScore]  = useState(0);
  const [flash,  setFlash]  = useState(false);

  /* 1) Silueta */
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
        if (cancelled) { s.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = s;
        videoRef.current.srcObject = s;
        videoRef.current.onloadedmetadata = () => {
          setReady(true);
          setTimeout(() => setCover(false), 260);
        };
      } catch {
        alert("No se pudo abrir la cámara");
        onClose();
      }
    })();
    return () => { cancelled = true; };
  }, [onClose]);

  /* 3) Loop detección – Score por Color + Textura */
  useEffect(() => {
    if (!ready || !maskD || doneRef.current) return;

    const v = videoRef.current;
    const W = Math.round(v.videoWidth  * DS);
    const H = Math.round(v.videoHeight * DS);
    if (!W || !H) return;

    const canvas = document.createElement("canvas");
    canvas.width = W;  canvas.height = H;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    // Path escalado
    const vb   = 1365.333;
    const path = new Path2D();
    path.addPath(new Path2D(maskD), new DOMMatrix().scale(W / vb, H / vb));

    const strokeW = Math.max(2, Math.round(Math.min(W, H) * STROKE_W_PCT));

    let alive = true;
    let consecutiveOk = 0;

    (function step() {
      if (!alive || doneRef.current) return;

      ctx.drawImage(v, 0, 0, W, H);
      const data = ctx.getImageData(0, 0, W, H).data;

      /* --- BORDES totales (ruido general de la escena) --- */
      let edgesTot = 0;
      for (let y = 0; y < H; y += STEP_E) {
        const base = (y * W) << 2;
        for (let x = 0; x < W - 2; x += STEP_E) {
          const i  = base + (x << 2);
          const l1 = data[i] + data[i+1] + data[i+2];
          const l2 = data[i+8] + data[i+9] + data[i+10];
          const dif = l1 - l2;
          if (dif > EDGE_T || -dif > EDGE_T) edgesTot++;
        }
      }

      /* --- Medidas de color + textura dentro vs. anillo exterior --- */
      let inR=0, inG=0, inB=0, nIn=0, gradIn=0;
      let outR=0,outG=0,outB=0, nOut=0, gradOut=0;

      ctx.save(); ctx.lineWidth = strokeW;

      for (let y = 0; y < H; y += STEP_A) {
        const base = (y * W) << 2;
        for (let x = 0; x < W; x += STEP_A) {
          const i  = base + (x << 2);
          const r  = data[i], g = data[i+1], b = data[i+2];
          const lum = r + g + b;

          // Gradiente simple (diferencia con derecha+abajo si existen)
          let grad = 0;
          if (x < W - STEP_A) {
            const j = base + ((x + STEP_A) << 2);
            const lumR = data[j] + data[j+1] + data[j+2];
            grad += Math.abs(lum - lumR);
          }
          if (y < H - STEP_A) {
            const k = ((y + STEP_A) * W << 2) + (x << 2);
            const lumD = data[k] + data[k+1] + data[k+2];
            grad += Math.abs(lum - lumD);
          }

          const inStroke = ctx.isPointInStroke(path, x, y);
          const inPath   = ctx.isPointInPath(path, x, y);

          if (inPath && !inStroke) {                       // interior “limpio”
            if (lum > LUMA_MIN && lum < LUMA_MAX) {
              inR += r; inG += g; inB += b; gradIn += grad; nIn++;
            }
          } else if (inStroke && !inPath) {                // aro externo
            outR += r; outG += g; outB += b; gradOut += grad; nOut++;
          }
        }
      }
      ctx.restore();

      const pixIn = nIn;
      const areaPct = pixIn ? 100 : 0;   // si no hay interior útil, no sumamos área

      // Medias
      const mInR = nIn ? inR / nIn : 0, mInG = nIn ? inG / nIn : 0, mInB = nIn ? inB / nIn : 0;
      const mOutR = nOut ? outR / nOut : 0, mOutG = nOut ? outG / nOut : 0, mOutB = nOut ? outB / nOut : 0;

      // Diferencia de color (euclídea en RGB)
      const dR = mInR - mOutR, dG = mInG - mOutG, dB = mInB - mOutB;
      const colorDiff = Math.sqrt(dR*dR + dG*dG + dB*dB);
      const colorScore = Math.min(1, colorDiff / COLOR_NORM); // 0..1

      // Relación de textura: fuera vs. dentro
      const gIn  = nIn  ? gradIn / nIn  : 1;
      const gOut = nOut ? gradOut / nOut : 1;
      const texRatio   = gOut / Math.max(1e-3, gIn);         // >1 si fuera hay más textura
      const texScore   = Math.max(0, Math.min(1, (texRatio - TEX_RATIO_BASE) / TEX_RATIO_SPAN));

      // Ocupación del interior (si el interior es muy “quemado” o negro no suma)
      const areaScore  = Math.max(0, Math.min(1, ( (pixIn / Math.max(1, NEED_PIXIN_MIN)) * 100 - AREA_BASE) / AREA_SPAN ));

      // Score final (peso color + textura + un poco de área)
      const S = (0.50 * colorScore + 0.40 * texScore + 0.10 * areaScore) * 100;

      setScore(S);

      if (DEBUG) {
        const dbg = document.getElementById("dbg");
        if (dbg) dbg.textContent =
          `EdgesTot: ${edgesTot}\n` +
          `pixIn:    ${pixIn}\n` +
          `ΔColor:   ${colorDiff.toFixed(1)} (score ${(colorScore*100).toFixed(0)})\n` +
          `TexRatio: ${texRatio.toFixed(2)} (score ${(texScore*100).toFixed(0)})\n` +
          `Score%:   ${S.toFixed(1)}\n` +
          `Consec:   ${consecutiveOk}/${CONSEC_FRAMES}`;
      }

      const okFrame =
        edgesTot   >= NEED_EDGES_MIN &&
        pixIn      >= NEED_PIXIN_MIN &&
        S          >= SHOOT_SCORE;

      if (okFrame) {
        consecutiveOk++;
        if (consecutiveOk >= CONSEC_FRAMES && !doneRef.current) {
          doneRef.current = true; shoot(); return;
        }
      } else {
        consecutiveOk = 0;
      }

      setTimeout(step, LOOP_MS);
    })();

    return () => { alive = false; };
  }, [ready, maskD]);

  /* 4) Capturar */
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

  return (
    <div className="wrap">
      <div className={`cover ${cover ? "" : "hide"}`}><div className="spinner" /></div>
      <video ref={videoRef} autoPlay playsInline className="cam" />

      {ready && maskD && (
        <>
          <svg className="mask" viewBox="0 0 1365.333 1365.333" preserveAspectRatio="xMidYMid slice">
            <defs>
              <mask id="hole"><rect width="100%" height="100%" fill="#fff" /><path d={maskD} fill="#000" /></mask>
            </defs>
            <rect width="100%" height="100%" fill="rgba(0,0,0,0.55)" mask="url(#hole)" />
            <path d={maskD} fill="none" stroke="#fff" strokeWidth="3" />
          </svg>

          {DEBUG && (
            <>
              <div className="barBox">
                <div className="bar"
                  style={{ width: `${Math.min(score, 100)}%`,
                           background: score > 75 ? "#10cf48" : "#f2c522" }} />
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
