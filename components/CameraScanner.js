import { useEffect, useRef, useState } from "react";

export default function CameraScanner({ onCapture, onClose }) {

  /********** Ajustes rápidos **********/
  const DEBUG = true;            // ← pon false en producción
  const FILL_TH  = 55;           // % mínimo de BORDES que deben coincidir
  const AREA_TH  = 60;           // % mínimo de SUPERFICIE ocupada
  const LUMA_MIN = 120;          // rango válido de luminancia
  const LUMA_MAX = 600;          //    (descarta negro puro o reflejos blancos)

  /********** Refs y estado **********/
  const videoRef  = useRef(null);
  const streamRef = useRef(null);
  const doneRef   = useRef(false);

  const [ready,   setReady]   = useState(false);
  const [maskD,   setMaskD]   = useState(null);
  const [fillPct, setFillPct] = useState(0);    // para la barra (usa métrica de bordes)
  const [flash,   setFlash]   = useState(false);

  /********** 1· Cargar silueta una vez **********/
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

  /********** 2· Abrir cámara **********/
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
        videoRef.current.onloadedmetadata = () => setReady(true);
      } catch {
        alert("No se pudo acceder a la cámara");
        onClose();
      }
    })();
    return () => { cancelled = true; };
  }, [onClose]);

  /********** 3· Loop detección **********/
  useEffect(() => {
    if (!ready || !maskD || doneRef.current) return;

    const v  = videoRef.current;
    const W  = v.videoWidth;
    const H  = v.videoHeight;
    if (!W || !H) return;

    const can = document.createElement("canvas");
    can.width = W;  can.height = H;
    const ctx = can.getContext("2d");

    const vb = 1365.333;
    const scale = new DOMMatrix().scale(W / vb, H / vb);
    const maskPath = new Path2D();
    maskPath.addPath(new Path2D(maskD), scale);

    let alive = true;
    const step = () => {
      if (!alive || doneRef.current) return;

      ctx.drawImage(v, 0, 0, W, H);
      const data = ctx.getImageData(0, 0, W, H).data;

      /* --- Métrica 1 · BORDES --- */
      let inCnt = 0, outCnt = 0, edgeCnt = 0;
      for (let y = 0; y < H; y += 2) {
        for (let x = 0; x < W; x += 2) {
          const idx = (y * W + x) * 4;
          const l1  = data[idx] + data[idx+1] + data[idx+2];
          const l2  = data[idx+8] + data[idx+9] + data[idx+10];
          if (Math.abs(l1 - l2) > 70) {
            edgeCnt++;
            ctx.isPointInPath(maskPath, x, y) ? inCnt++ : outCnt++;
          }
        }
      }
      const fillEdges = (inCnt / (edgeCnt || 1)) * 100;

      /* --- Métrica 2 · SUPERFICIE --- */
      let pixValid = 0, pixInside = 0;
      for (let y = 0; y < H; y += 3) {
        for (let x = 0; x < W; x += 3) {
          if (!ctx.isPointInPath(maskPath, x, y)) continue;
          pixInside++;
          const idx = (y * W + x) * 4;
          const lum = data[idx] + data[idx+1] + data[idx+2];
          if (lum > LUMA_MIN && lum < LUMA_MAX) pixValid++;
        }
      }
      const fillArea = (pixValid / (pixInside || 1)) * 100;

      /* --- DEBUG info --- */
      if (DEBUG) {
        const dbg = document.getElementById("dbg");
        if (dbg) dbg.textContent =
          `Bordes: ${edgeCnt}\nDentro: ${inCnt}\nFuera: ${outCnt}\n` +
          `FillEdg%: ${fillEdges.toFixed(1)}\nFillArea%: ${fillArea.toFixed(1)}`;
      }

      /* Barra progreso usa la métrica de bordes (puedes cambiar a fillArea) */
      setFillPct(fillEdges);

      /* --- Condición de disparo combinada --- */
      if (
        fillEdges > FILL_TH &&
        fillArea  > AREA_TH &&
        edgeCnt   > 250 &&
        !doneRef.current
      ) {
        doneRef.current = true;
        shoot();
        return;
      }

      setTimeout(step, 350);
    };
    step();

    return () => { alive = false; };
  }, [ready, maskD]);

  /********** 4· Captura **********/
  const shoot = () => {
    setFlash(true);
    setTimeout(() => setFlash(false), 500);

    const v = videoRef.current;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;  c.height = v.videoHeight;
    c.getContext("2d").drawImage(v, 0, 0);

    c.toBlob(blob => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      onCapture(blob);
      onClose();
    }, "image/jpeg", 0.85);
  };

  /********** 5· Cerrar manual **********/
  const handleClose = () => {
    doneRef.current = true;
    streamRef.current?.getTracks().forEach(t => t.stop());
    onClose();
  };

  /********** JSX **********/
  return (
    <div className="wrap">
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
                  style={{
                    width: `${Math.min(fillPct, 100)}%`,
                    background: fillEdges > 75 ? "#10cf48" : "#f2c522"
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
        .wrap {position:fixed;inset:0;z-index:9999;}
        .cam  {position:absolute;inset:0;width:100%;height:100%;object-fit:cover;}
        .mask {position:absolute;inset:0;width:100%;height:100%;pointer-events:none;}
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
