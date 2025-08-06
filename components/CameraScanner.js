import { useEffect, useRef, useState } from "react";

export default function CameraScanner({ onCapture, onClose }) {
  const videoRef  = useRef(null);
  const streamRef = useRef(null);

  const [ready, setReady]         = useState(false);
  const [maskD, setMaskD]         = useState(null);
  const [fillPct, setFillPct]     = useState(0);
  const [flash, setFlash]         = useState(false);

  /** bandera global: impide dobles loops / dobles fotos */
  const doneRef = useRef(false);

  /* ───── 1· Cargar silueta ───────────────────────────── */
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

  /* ───── 2· Abrir cámara ─────────────────────────────── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 } }
        });
        if (cancelled) return s.getTracks().forEach(t => t.stop());
        streamRef.current = s;
        videoRef.current.srcObject = s;
        videoRef.current.onloadedmetadata = () => setReady(true);
      } catch {
        alert("No se pudo acceder a la cámara"); onClose();
      }
    })();
    return () => { cancelled = true; };
  }, [onClose]);

  /* ───── 3· Loop detección ───────────────────────────── */
  useEffect(() => {
    if (!ready || !maskD || doneRef.current) return;

    const v  = videoRef.current;
    const W  = v.videoWidth;
    const H  = v.videoHeight;
    if (!W || !H) return;

    const can = document.createElement("canvas");
    const ctx = can.getContext("2d");
    can.width = W;  can.height = H;

    /* escalar path al tamaño del vídeo */
    const vb = 1365.333;
    const scale = new DOMMatrix().scale(W / vb, H / vb);
    const mask  = new Path2D();       mask.addPath(new Path2D(maskD), scale);

    let alive = true;
    const step = () => {
      if (!alive || doneRef.current) return;

      ctx.drawImage(v, 0, 0, W, H);
      const d = ctx.getImageData(0, 0, W, H).data;

      let inCnt = 0, edgeCnt = 0, outCnt = 0;
      for (let y = 0; y < H; y += 2) {
        for (let x = 0; x < W; x += 2) {
          const i = (y * W + x) * 4;
          const l1 = d[i]+d[i+1]+d[i+2];
          const l2 = d[i+8]+d[i+9]+d[i+10];
          if (Math.abs(l1 - l2) > 70) {
            edgeCnt++;
            ctx.isPointInPath(mask, x, y) ? inCnt++ : outCnt++;
          }
        }
      }
      const pct = (inCnt / (edgeCnt || 1)) * 100;
      setFillPct(pct);

      /* DEBUG */
      const dbg = document.getElementById("dbg");
      if (dbg)
        dbg.textContent = `Bordes: ${edgeCnt}\nDentro: ${inCnt}\nFuera: ${outCnt}\nFill%:  ${pct.toFixed(1)}`;

      if (pct > 20 && edgeCnt > 100 && !doneRef.current) {
        doneRef.current = true;
        shoot();
        return;
      }
      setTimeout(step, 350);
    };
    step();

    return () => { alive = false; };
  }, [ready, maskD]);

  /* ───── 4· Capturar ─────────────────────────────────── */
  const shoot = () => {
    setFlash(true);
    setTimeout(() => setFlash(false), 600);

    const v = videoRef.current;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d").drawImage(v, 0, 0);

    c.toBlob(blob => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      onCapture(blob);   // <- entrega
      onClose();         // <- cierra
    }, "image/jpeg", 0.85);
  };

  /* ───── 5· Close manual ─────────────────────────────── */
  const handleClose = () => {
    doneRef.current = true;
    streamRef.current?.getTracks().forEach(t => t.stop());
    onClose();
  };

  /* ───── JSX ─────────────────────────────────────────── */
  return (
    <div className="wrap">
      <video ref={videoRef} autoPlay playsInline className="cam" />

      {/* máscara + contorno */}
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

      {/* barra progreso */}
      <div className="barBox">
        <div
          className="bar"
          style={{
            width: `${Math.min(fillPct, 100)}%`,
            background: fillPct > 75 ? "#10cf48" : "#f2c522"
          }}
        />
      </div>

      {/* DEBUG textbox */}
      <pre id="dbg" className="dbg" />

      {/* flash */}
      {flash && <div className="flash">📸 Captura</div>}

      <button className="cls" onClick={handleClose}>✕</button>

      <style jsx>{`
        .wrap {position:fixed;inset:0;z-index:9999;}
        .cam  {position:absolute;inset:0;width:100%;height:100%;object-fit:cover;}
        .mask {position:absolute;inset:0;width:100%;height:100%;pointer-events:none;}

        .barBox{position:absolute;bottom:16px;left:50%;transform:translateX(-50%);
                width:80%;height:12px;background:#444;border-radius:6px;overflow:hidden}
        .bar{height:100%;transition:width .2s}

        .cls{position:absolute;top:16px;right:16px;width:44px;height:44px;border:none;
             border-radius:50%;background:rgba(0,0,0,.6);color:#fff;font-size:24px;cursor:pointer}

        .dbg{position:absolute;top:16px;left:16px;background:rgba(0,0,0,.55);
             color:#fff;padding:6px 10px;font-size:13px;border-radius:4px;white-space:pre-line}

        .flash{position:absolute;inset:0;background:rgba(0,0,0,.75);display:flex;
               align-items:center;justify-content:center;color:#fff;font-size:1.3rem}
      `}</style>
    </div>
  );
}
