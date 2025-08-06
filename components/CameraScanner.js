import { useEffect, useRef, useState } from "react";

export default function CameraScanner({ onCapture, onClose }) {
  /********** Ajustes rápidos **********/
  const DEBUG = true;          // ← pon false en producción (barra + números)
  const FILL_TH = 15;          // % mínimo para disparar (bájalo para test)

  /********** Refs y estado **********/
  const videoRef  = useRef(null);
  const streamRef = useRef(null);
  const doneRef   = useRef(false);          // evita dobles capturas

  const [ready,     setReady]     = useState(false);  // cámara lista
  const [maskD,     setMaskD]     = useState(null);   // path del SVG
  const [fillPct,   setFillPct]   = useState(0);      // % dentro-silueta
  const [flash,     setFlash]     = useState(false);  // flash visual

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

  /********** 3· Loop de detección **********/
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

      let inCnt = 0, outCnt = 0, edgeCnt = 0;
      for (let y = 0; y < H; y += 2) {
        for (let x = 0; x < W; x += 2) {
          const idx  = (y * W + x) * 4;
          const l1   = data[idx] + data[idx+1] + data[idx+2];
          const l2   = data[idx+8] + data[idx+9] + data[idx+10];
          if (Math.abs(l1 - l2) > 70) {
            edgeCnt++;
            ctx.isPointInPath(maskPath, x, y) ? inCnt++ : outCnt++;
          }
        }
      }
      const pct = (inCnt / (edgeCnt || 1)) * 100;
      setFillPct(pct);

      if (DEBUG) {
        const dbg = document.getElementById("dbg");
        if (dbg) dbg.textContent =
          `Bordes: ${edgeCnt}\nDentro: ${inCnt}\nFuera: ${outCnt}\nFill%: ${pct.toFixed(1)}`;
      }

      if (pct > FILL_TH && edgeCnt > 250 && !doneRef.current) {
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
    // flash visual
    setFlash(true);
    setTimeout(() => setFlash(false), 500);

    const v = videoRef.current;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d").drawImage(v, 0, 0);

    c.toBlob(blob => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      onCapture(blob);   // entrega al padre
      onClose();         // cierra modal
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

      {/* Solo mostramos elementos cuando la cámara ya está lista */}
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

          {/* barra progreso (solo debug) */}
          {DEBUG && (
            <div className="barBox">
              <div
                className="bar"
                style={{
                  width: `${Math.min(fillPct, 100)}%`,
                  background: fillPct > 75 ? "#10cf48" : "#f2c522"
                }}
              />
            </div>
          )}

          {/* DEBUG textbox */}
          {DEBUG && <pre id="dbg" className="dbg" />}
        </>
      )}

      {/* flash */}
      {flash && <div className="flash">📸 Captura</div>}

      {/* botón cerrar (solo tras ready para no verse antes) */}
      {ready && (
        <button className="cls" onClick={handleClose}>✕</button>
      )}

      <style jsx>{`
        .wrap {position:fixed;inset:0;z-index:9999;}
        .cam  {position:absolute;inset:0;width:100%;height:100%;object-fit:cover;}

        .mask {position:absolute;inset:0;width:100%;height:100%;pointer-events:none;}

        .barBox{position:absolute;bottom:16px;left:50%;transform:translateX(-50%);
                width:80%;height:12px;background:#444;border-radius:6px;overflow:hidden}
        .bar{height:100%;transition:width .25s}

        .cls{position:absolute;top:16px;right:16px;width:48px;height:48px;border:none;
             border-radius:50%;background:#035c3b;color:#fff;display:flex;
             align-items:center;justify-content:center;font-size:28px;
             line-height:1;cursor:pointer}

        .dbg{position:absolute;top:16px;left:16px;background:rgba(0,0,0,.55);
             color:#fff;padding:6px 10px;font-size:13px;border-radius:4px;white-space:pre-line}

        .flash{position:absolute;inset:0;background:rgba(0,0,0,.78);
               display:flex;align-items:center;justify-content:center;
               color:#fff;font-size:1.3rem;pointer-events:none}
      `}</style>
    </div>
  );
}
