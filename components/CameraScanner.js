import { useEffect, useRef, useState } from "react";

export default function CameraScanner({ onCapture, onClose }) {
  const videoRef     = useRef(null);
  const streamRef    = useRef(null);
  const [ready, setReady]       = useState(false);
  const [maskD, setMaskD]       = useState(null);
  const [captured, setCaptured] = useState(false);
  const [coincidencia, setCoincidencia] = useState(0);

  // FLAG para evitar capturas múltiples:
  const hasCapturedRef = useRef(false);

  // 0) Carga el SVG de la silueta
  useEffect(() => {
    fetch("/plantilla_silueta.svg")
      .then(r => r.text())
      .then(svg => {
        const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
        const p = doc.querySelector("path");
        if (p) setMaskD(p.getAttribute("d"));
      })
      .catch(() => console.warn("No se pudo cargar la silueta"));
  }, []);

  // 1) Arranca la cámara y espera metadata
  useEffect(() => {
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 } }
        });
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        videoRef.current.addEventListener("loadedmetadata", () => setReady(true), { once: true });
      } catch (err) {
        alert("No se pudo abrir la cámara");
        onClose();
      }
    })();
    return () => streamRef.current?.getTracks().forEach(t => t.stop());
  }, [onClose]);

  // 2) Loop de detección cada 400ms
  useEffect(() => {
    hasCapturedRef.current = false; // ← resetea el flag cada vez que abres cámara

    if (!ready || !maskD) return;

    const video = videoRef.current;
    const W = video.videoWidth;
    const H = video.videoHeight;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");

    const vb = { width: 1365.333, height: 1365.333 };
    const scaleX = W / vb.width;
    const scaleY = H / vb.height;
    const rawPath = new Path2D(maskD);
    const maskPath = new Path2D();
    maskPath.addPath(rawPath, new DOMMatrix().scale(scaleX, scaleY));

    let timeoutId = null;
    const tick = () => {
      if (hasCapturedRef.current) return; // ← no hace nada si ya se capturó

      if (video.readyState < 2) {
        timeoutId = setTimeout(tick, 400);
        return;
      }

      ctx.drawImage(video, 0, 0, W, H);
      const data = ctx.getImageData(0, 0, W, H).data;
      let inCnt = 0, outCnt = 0, edgeCnt = 0;

      for (let y = 0; y < H; y += 2) {
        for (let x = 0; x < W; x += 2) {
          const i = (y * W + x) * 4;
          const lum = data[i] + data[i+1] + data[i+2];
          const lum2 = data[i + 8] + data[i + 9] + data[i + 10];
          if (Math.abs(lum - lum2) > 70) {
            edgeCnt++;
            if (ctx.isPointInPath(maskPath, x, y)) inCnt++;
            else outCnt++;
          }
        }
      }

      const fillPct = (inCnt / (edgeCnt || 1)) * 100;
      const outsidePct = (outCnt / (edgeCnt || 1)) * 100;
      setCoincidencia(fillPct);

      const dbg = document.getElementById("dbg");
      if (dbg) {
        dbg.textContent =
          `Bordes: ${edgeCnt}\nDentro: ${inCnt}\nFuera: ${outCnt}\nFill%: ${fillPct.toFixed(1)}%`;
      }

      if (fillPct > 75 && outsidePct < 6 && edgeCnt > 500) {
        hasCapturedRef.current = true; // BLOQUEA MÁS CAPTURAS
        setTimeout(() => {
          takePhoto();
        }, 120);
        return;
      }

      timeoutId = setTimeout(tick, 400);
    };

    tick();
    return () => clearTimeout(timeoutId);
  }, [ready, maskD, onCapture]);

const takePhoto = () => {
  if (capturingRef.current) return; // Evita doble disparo
  capturingRef.current = true;
  const v = videoRef.current;
  const c = document.createElement("canvas");
  c.width = v.videoWidth;
  c.height = v.videoHeight;
  c.getContext("2d").drawImage(v, 0, 0);
  c.toBlob(blob => {
    if (blob) {
      setCaptured(true);
      setTimeout(() => setCaptured(false), 800);
      onCapture(blob);
    }
  }, "image/jpeg", 0.8);
};


  return (
    <div className="cam-wrapper">
      {!ready && (
        <div style={{color:'#fff',textAlign:'center',marginTop:'40%'}}>Cargando cámara...</div>
      )}
      <video ref={videoRef} autoPlay playsInline className="cam-video" style={{display: ready ? 'block' : 'none'}} />

      <div style={{
        width: '80%',
        height: '12px',
        background: '#444',
        borderRadius: '6px',
        margin: '14px auto',
        overflow: 'hidden',
        boxShadow: '0 0 5px #111',
      }}>
        <div style={{
          width: `${Math.min(coincidencia, 100)}%`,
          height: '100%',
          background: coincidencia > 75 ? '#10cf48' : '#f2c522',
          transition: 'width 0.2s, background 0.2s'
        }} />
      </div>

      {maskD && (
        <svg className="mask-svg" viewBox="0 0 1365.333 1365.333" preserveAspectRatio="xMidYMid slice">
          <defs>
            <mask id="hole">
              <rect width="100%" height="100%" fill="white" />
              <path d={maskD} fill="black" />
            </mask>
          </defs>
          <rect width="100%" height="100%" fill="rgba(0,0,0,0.55)" mask="url(#hole)" />
          <path d={maskD} fill="none" stroke="white" strokeWidth="3" />
        </svg>
      )}

      <button className="cls-btn" onClick={onClose}>✕</button>
      <pre id="dbg" className="dbg" />

      {captured && (
        <div className="capture-notice">📸 Captura realizada</div>
      )}

      <style jsx>{`
        .cam-wrapper {position:fixed;inset:0;z-index:9999;}
        .cam-video {position:absolute;inset:0;width:100%;height:100%;object-fit:cover;}
        .mask-svg {position:absolute;inset:0;width:100%;height:100%;pointer-events:none;}
        .cls-btn {position:absolute;top:16px;right:16px;border:none;background:rgba(0,0,0,0.6);
                  color:#fff;font-size:24px;width:44px;height:44px;border-radius:50%;cursor:pointer;}
        .dbg {position:absolute;top:16px;left:16px;background:rgba(0,0,0,0.55);color:#fff;
              padding:6px 10px;font-size:13px;white-space:pre-line;border-radius:4px;}
        .capture-notice {position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
                         background:rgba(0,0,0,0.7);color:#fff;padding:1rem 1.5rem;
                         border-radius:8px;font-size:1.2rem;pointer-events:none;}
      `}</style>
    </div>
  );
}
