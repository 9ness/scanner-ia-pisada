import { useEffect, useRef, useState } from "react";

/**
 * CameraScanner (versión robusta)
 *
 * Cambios clave respecto a tu versión:
 * 1) "Stroke%" ahora mide CUÁNTO del aro (anillo alrededor del contorno SVG)
 *    está activado por bordes, respecto al TOTAL de puntos del aro (ringHit / ringPix),
 *    no respecto a todos los bordes de la escena. Esto lo vuelve independiente del fondo.
 * 2) Se cuenta también gradiente en Y (no solo en X) para detectar bordes horizontales.
 * 3) Regla de disparo simplificada y más explicativa:
 *      - ringHit% alto (borde pegado al contorno)
 *      - mayoría del borde en el lado INTERIOR (innerFrac)
 *      - área interior con luminancia válida (area%)
 *      - mínimos absolutos de estructura (edgesTot, nearIn)
 * 4) Umbrales reajustados a los valores que muestran tus capturas.
 */

export default function CameraScanner({ onCapture, onClose }) {
  /* ──────────────────────────────────────────────────────────────
   *  PARÁMETROS AJUSTABLES
   * ────────────────────────────────────────────────────────────── */
  const DEBUG            = true;            // false en prod

  // Aro (franja de evaluación pegada al contorno SVG)
  const STROKE_W_PCT     = 0.018;           // 1.8% del lado menor

  // Nuevos umbrales (ver notas al final para afinarlos)
  const RING_PCT_MIN     = 28.0;            // % del aro con borde (ringHit% ≥)
  const INNER_FRAC_MIN   = 0.55;            // fracción de borde del aro que cae dentro (nearIn/(nearIn+nearOut))
  const AREA_TH          = 85.0;            // % de área interior con luminancia válida
  const NEAR_IN_MIN      = 260;             // bordes mínimos en el aro por dentro
  const EDGES_TOT_MIN    = 12000;           // textura mínima global

  // Umbrales de luminancia y bordes
  const LUMA_MIN         = 110;             // abre un poco el rango vs tu versión
  const LUMA_MAX         = 640;
  const EDGE_T           = 100;             // diferencia de luminancia → borde (fácil de afinar)
  const SAMPLE_STEP      = 2;               // muestreo para bordes
  const AREA_STEP        = 3;               // muestreo para área

  // Anti-parpadeos
  const CONSEC_FRAMES    = 3;               // frames válidos consecutivos para disparar
  const LOOP_MS          = 180;             // ritmo del bucle (ms)

  /* ──────────────────────────────────────────────────────────────
   *  REFS / STATE
   * ────────────────────────────────────────────────────────────── */
  const videoRef  = useRef(null);
  const streamRef = useRef(null);
  const doneRef   = useRef(false);

  const [ready,   setReady]   = useState(false);
  const [cover,   setCover]   = useState(true);
  const [maskD,   setMaskD]   = useState(null);
  const [barPct,  setBarPct]  = useState(0);
  const [flash,   setFlash]   = useState(false);

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

  /* 2) Abrir cámara + overlay de carga */
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
          setTimeout(() => setCover(false), 300);
        };
      } catch {
        alert("No se pudo abrir la cámara");
        onClose();
      }
    })();
    return () => { cancelled = true; };
  }, [onClose]);

  /* 3) Loop de detección */
  useEffect(() => {
    if (!ready || !maskD || doneRef.current) return;

    const v = videoRef.current;
    const W = v.videoWidth;
    const H = v.videoHeight;
    if (!W || !H) return;

    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");

    // Path escalado al tamaño del vídeo (misma escala que el overlay)
    const vb = 1365.333;
    const path = new Path2D();
    path.addPath(new Path2D(maskD), new DOMMatrix().scale(W / vb, H / vb));

    // Aro de evaluación
    const strokeW = Math.max(2, Math.round(Math.min(W, H) * STROKE_W_PCT));

    let alive = true;
    let consecutiveOk = 0;

    (function step() {
      if (!alive || doneRef.current) return;

      ctx.drawImage(v, 0, 0, W, H);
      const px = ctx.getImageData(0, 0, W, H).data;

      // —— 1) Conteos de borde ——
      let edgesTot = 0;  // bordes globales (escena)
      let nearIn   = 0;  // bordes en aro y por dentro
      let nearOut  = 0;  // bordes en aro y por fuera
      let ringPix  = 0;  // nº de puntos muestreados que caen en el aro

      ctx.save();
      ctx.lineWidth = strokeW;
      ctx.lineJoin  = 'round';
      ctx.lineCap   = 'round';

      for (let y = 0; y < H; y += SAMPLE_STEP) {
        for (let x = 0; x < W; x += SAMPLE_STEP) {
          const i  = (y * W + x) * 4;
          const l1 = px[i] + px[i+1] + px[i+2];

          // vecino en X e Y (captura bordes verticales y horizontales)
          const jx = i + 4 * SAMPLE_STEP;
          const jy = i + 4 * W * SAMPLE_STEP;
          const lx = (jx < px.length) ? (px[jx] + px[jx+1] + px[jx+2]) : l1;
          const ly = (jy < px.length) ? (px[jy] + px[jy+1] + px[jy+2]) : l1;
          const diff = Math.max(Math.abs(l1 - lx), Math.abs(l1 - ly));

          const inStroke = ctx.isPointInStroke(path, x, y);
          if (inStroke) ringPix++;

          if (diff > EDGE_T) {
            edgesTot++;
            if (inStroke) {
              ctx.isPointInPath(path, x, y) ? nearIn++ : nearOut++;
            }
          }
        }
      }
      ctx.restore();

      // Porcentaje del aro cubierto por bordes
      const ringHitPct = ((nearIn + nearOut) / Math.max(1, ringPix)) * 100;
      // Fracción de borde del aro que cae por dentro
      const innerFrac  = (nearIn / Math.max(1, nearIn + nearOut));
      // Relación (para depurar solo)
      const ioRatio    = nearOut ? (nearIn / nearOut) : 9.99;

      // —— 2) Área interior con luminancia válida ——
      let pixIn = 0, validLum = 0;
      for (let y = 0; y < H; y += AREA_STEP) {
        for (let x = 0; x < W; x += AREA_STEP) {
          if (!ctx.isPointInPath(path, x, y)) continue;
          pixIn++;
          const k = (y * W + x) * 4;
          const lum = px[k] + px[k+1] + px[k+2];
          if (lum > LUMA_MIN && lum < LUMA_MAX) validLum++;
        }
      }
      const areaPct = (validLum / Math.max(1, pixIn)) * 100;

      setBarPct(ringHitPct);

      // —— 3) DEBUG ——
      if (DEBUG) {
        const dbg = document.getElementById("dbg");
        if (dbg) {
          dbg.textContent =
            `EdgesTot: ${edgesTot}\n` +
            `NearIn:   ${nearIn}\n` +
            `NearOut:  ${nearOut}\n` +
            `Stroke%:  ${ringHitPct.toFixed(1)}\n` +
            `Area%:    ${areaPct.toFixed(1)}\n` +
            `InnerFr:  ${innerFrac.toFixed(2)}\n` +
            `IO_Ratio: ${ioRatio.toFixed(2)}\n` +
            `Consec:   ${consecutiveOk}/${CONSEC_FRAMES}`;
        }
      }

      // —— 4) Regla de disparo (robusta y legible) ——
      const ok =
        edgesTot        >= EDGES_TOT_MIN   &&  // suficiente textura en escena
        ringHitPct      >= RING_PCT_MIN    &&  // aro activado por borde
        areaPct         >= AREA_TH         &&  // interior con luminancia plausible
        nearIn          >= NEAR_IN_MIN     &&  // borde "real" por dentro del aro
        innerFrac       >= INNER_FRAC_MIN;     // mayor parte del borde cae dentro

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
      // Cierra la cámara antes de salir
      try { streamRef.current?.getTracks().forEach(t => t.stop()); } catch {}
      onCapture(blob);
      onClose();
    }, "image/jpeg", 0.82);
  }

  /* 5) Cerrar manual */
  function handleClose() {
    doneRef.current = true;
    try { streamRef.current?.getTracks().forEach(t => t.stop()); } catch {}
    onClose();
  }

  /* ──────────────────────────────────────────────────────────────
   *  UI
   * ────────────────────────────────────────────────────────────── */
  return (
    <div className="wrap">
      {/* overlay “abriendo cámara” */}
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
                  style={{ width: `${Math.min(barPct, 100)}%`, background: barPct > 60 ? "#10cf48" : "#f2c522" }}
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
             background:#035c3b;color:#fff;display:flex;align-items:center;justify-content:center;
             font-size:28px;cursor:pointer}

        .dbg{position:absolute;top:16px;left:16px;background:rgba(0,0,0,.55);
             color:#fff;padding:6px 10px;font-size:13px;border-radius:4px;white-space:pre-line}

        .flash{position:absolute;inset:0;background:rgba(0,0,0,.78);
               display:flex;align-items:center;justify-content:center;
               color:#fff;font-size:1.3rem;pointer-events:none}
      `}</style>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
 * Notas para afinar rápido en pruebas reales
 *
 * 1) Si dispara poco aunque la plantilla esté bien encajada:
 *    - Baja EDGE_T a 90–95
 *    - Baja RING_PCT_MIN a 24–26
 *    - Baja INNER_FRAC_MIN a 0.52
 *
 * 2) Si dispara con falsos positivos:
 *    - Sube RING_PCT_MIN a 32–36
 *    - Sube INNER_FRAC_MIN a 0.60
 *    - Sube NEAR_IN_MIN a 320–380
 *
 * 3) Rendimiento/Pilas:
 *    - Aumentar SAMPLE_STEP a 3 reduce CPU a costa de sensibilidad.
 *    - LOOP_MS en 160–220ms es un buen rango.
 *
 * 4) Los números de depuración cambiarán respecto a tu versión:
 *    - "Stroke%" ahora suele estar ~25–70 en válidas, y mucho más bajo en no válidas.
 *    - "InnerFr" (0–1) debe ser > 0.55 cuando la coincidencia es real.
 *
 * 5) La compresión de captura está en 0.82 (JPEG). Sube/baja si necesitas tamaño/calidad.
 * ────────────────────────────────────────────────────────────── */
