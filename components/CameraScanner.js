import { useEffect, useRef, useState } from "react";

export default function CameraScanner({ onCapture, onClose }) {

/* ───── PARAMETROS RÁPIDOS ───────────────────────────────────── */
const DEBUG   = true;  // ← pon false en prod. (oculta barra y números)
const FILL_TH = 75;    // % mínimo para disparar la foto automática

/* ───── REFS / STATE ─────────────────────────────────────────── */
const videoRef  = useRef(null);
const streamRef = useRef(null);
const doneRef   = useRef(false);      // evita dobles capturas

const [ready,     setReady]     = useState(false);  // cámara OK
const [cover,     setCover]     = useState(true);   // overlay inicial
const [maskD,     setMaskD]     = useState(null);   // path del SVG
const [fillPct,   setFillPct]   = useState(0);      // % coincidencia
const [flash,     setFlash]     = useState(false);  // flash tras foto

/* ───── 1· Cargar silueta (solo 1 vez) ───────────────────────── */
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

/* ───── 2· Abrir cámara ─────────────────────────────────────── */
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
        /* esperamos 300 ms y quitamos suavemente el overlay */
        setTimeout(() => setCover(false), 300);
      };
    } catch {
      alert("No se pudo acceder a la cámara");
      onClose();
    }
  })();
  return () => { cancelled = true; };
}, [onClose]);

/* ───── 3· Loop de detección  ───────────────────────────────── */
useEffect(() => {
  if (!ready || !maskD || doneRef.current) return;

  const v = videoRef.current;
  const W = v.videoWidth;
  const H = v.videoHeight;
  if (!W || !H) return;

  const can = document.createElement("canvas");
  can.width = W;  can.height = H;
  const ctx = can.getContext("2d");

  /* escalamos path al tamaño del vídeo */
  const vb      = 1365.333;
  const scale   = new DOMMatrix().scale(W / vb, H / vb);
  const maskPth = new Path2D();
  maskPth.addPath(new Path2D(maskD), scale);

  let alive = true;
  function step() {
    if (!alive || doneRef.current) return;

    ctx.drawImage(v, 0, 0, W, H);
    const data = ctx.getImageData(0, 0, W, H).data;

    let inCnt = 0, outCnt = 0, edgeCnt = 0;
    for (let y = 0; y < H; y += 2) {
      for (let x = 0; x < W; x += 2) {
        const i  = (y * W + x) * 4;
        const l1 = data[i] + data[i+1] + data[i+2];
        const l2 = data[i+8] + data[i+9] + data[i+10];
        if (Math.abs(l1 - l2) > 70) {
          edgeCnt++;
          ctx.isPointInPath(maskPth, x, y) ? inCnt++ : outCnt++;
        }
      }
    }
    const pct = (inCnt / (edgeCnt || 1)) * 100;
    setFillPct(pct);

    if (DEBUG) {
      const dbg = document.getElementById("dbg");
      if (dbg)
        dbg.textContent =
          `Bordes: ${edgeCnt}\nDentro: ${inCnt}\nFuera: ${outCnt}\nFill%: ${pct.toFixed(1)}`;
    }

    if (pct > FILL_TH && edgeCnt > 250 && !doneRef.current) {
      doneRef.current = true;
      shoot();
      return;
    }
    setTimeout(step, 350);
  }
  step();

  return () => { alive = false; };
}, [ready, maskD]);

/* ───── 4· Captura ──────────────────────────────────────────── */
function shoot() {
  setFlash(true);
  setTimeout(() => setFlash(false), 500);

  const v = videoRef.current;
  const c = document.createElement("canvas");
  c.width = v.videoWidth;  c.height = v.videoHeight;
  c.getContext("2d").drawImage(v, 0, 0);

  c.toBlob(blob => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    onCapture(blob);  // devolvemos foto
    onClose();        // cerramos modal
  }, "image/jpeg", 0.85);
}

/* ───── 5· Cerrar manual ───────────────────────────────────── */
function handleClose() {
  doneRef.current = true;
  streamRef.current?.getTracks().forEach(t => t.stop());
  onClose();
}

/* ───── JSX ───────────────────────────────────────────────── */
return (
  <div className="wrap">

    {/* overlay “abriendo cámara” (se desvanece cuando cover=false) */}
    <div className={`cover ${cover ? "" : "hide"}`}>
      <div className="spinner" />
    </div>

    <video ref={videoRef} autoPlay playsInline className="cam" />

    {/* UI principal – solo cuando la cámara está lista */}
    {ready && maskD && (
      <>
        {/* máscara y contorno */}
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

        {/* barra + números (DEBUG) */}
        {DEBUG && (
          <>
            <div className="barBox">
              <div
                className="bar"
                style={{
                  width: `${Math.min(fillPct, 100)}%`,
                  background: fillPct > 75 ? "#10cf48" : "#f2c522"
                }}
              />
            </div>
            <pre id="dbg" className="dbg" />
          </>
        )}

        <button className="cls" onClick={handleClose}>✕</button>
      </>
    )}

    {/* flash tras captura */}
    {flash && <div className="flash">📸 Captura</div>}

    {/* ---------- estilos ---------- */}
    <style jsx>{`
      .wrap{position:fixed;inset:0;z-index:9999;}

      /* overlay inicial negro + spinner */
      .cover{position:absolute;inset:0;background:#000;display:flex;
             align-items:center;justify-content:center;
             transition:opacity .45s ease;opacity:1;}
      .cover.hide{opacity:0;pointer-events:none;}
      .spinner{
        width:46px;height:46px;border:4px solid #fff;border-top-color:transparent;
        border-radius:50%;animation:spin .9s linear infinite;
      }
      @keyframes spin{to{transform:rotate(360deg);}}

      /* vídeo */
      .cam{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;}

      /* overlays */
      .mask{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;}

      .barBox{position:absolute;bottom:16px;left:50%;transform:translateX(-50%);
              width:80%;height:12px;background:#444;border-radius:6px;overflow:hidden}
      .bar{height:100%;transition:width .25s}

      .cls{position:absolute;top:16px;right:16px;width:48px;height:48px;border:none;
           border-radius:50%;background:#035c3b;color:#fff;display:flex;
           align-items:center;justify-content:center;font-size:28px;cursor:pointer;}

      .dbg{position:absolute;top:16px;left:16px;background:rgba(0,0,0,.55);
           color:#fff;padding:6px 10px;font-size:13px;border-radius:4px;
           white-space:pre-line}

      .flash{position:absolute;inset:0;background:rgba(0,0,0,.78);
             display:flex;align-items:center;justify-content:center;
             color:#fff;font-size:1.3rem;pointer-events:none}
    `}</style>
  </div>
);
}
