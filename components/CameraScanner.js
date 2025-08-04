// src/components/CameraScanner.js

import { useEffect, useRef, useState } from "react";

export default function CameraScanner({ onCapture, onClose }) {
  const videoRef     = useRef(null);
  const streamRef    = useRef(null);
  const capturingRef = useRef(false);
  const [ready, setReady]       = useState(false);
  const [maskD, setMaskD]       = useState(null);
  const [lockCnt, setLockCnt]   = useState(0);
  const [captured, setCaptured] = useState(false);

  // 0) Carga tu SVG
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

  // 1) Arranca cámara y espera metadata
  useEffect(() => {
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 } }
        });
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        videoRef.current.addEventListener("loadedmetadata", () => setReady(true), { once: true });
      } catch {
        alert("No se pudo abrir la cámara");
        onClose();
      }
    })();
    return () => streamRef.current?.getTracks().forEach(t => t.stop());
  }, [onClose]);

  // 2) Detección cada 400 ms
  useEffect(() => {
    if (!ready || !maskD) return;

    const video = videoRef.current;
    const W = video.videoWidth, H = video.videoHeight;
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");

    // Prepara la máscara escalada
    const vb = { width: 1365.333, height: 1365.333 };
    const scaleX = W / vb.width, scaleY = H / vb.height;
    const raw = new Path2D(maskD), maskPath = new Path2D();
    maskPath.addPath(raw, new DOMMatrix().scale(scaleX, scaleY));

    let id;
    const tick = () => {
      if (video.readyState < 2) {
        id = setTimeout(tick, 400);
        return;
      }
      ctx.drawImage(video, 0, 0, W, H);
      const d = ctx.getImageData(0, 0, W, H).data;
      let inCnt = 0, outCnt = 0, edgeCnt = 0;
      for (let y = 0; y < H; y += 4) for (let x = 0; x < W; x += 4) {
        const i = (y * W + x) * 4;
        const l1 = d[i] + d[i+1] + d[i+2];
        const l2 = d[i+16] + d[i+17] + d[i+18];
        if (Math.abs(l1 - l2) > 80) {
          edgeCnt++;
          if (ctx.isPointInPath(maskPath, x, y)) inCnt++;
          else outCnt++;
        }
      }
      const fillPct = inCnt / (edgeCnt||1) * 100;
      const outsidePct = outCnt / (edgeCnt||1) * 100;
      document.getElementById("dbg").textContent =
        `Bordes: ${edgeCnt}\nDentro: ${inCnt}\nFuera: ${outCnt}\nFill%: ${fillPct.toFixed(1)}`;

      const ok = fillPct > 15 && outsidePct < 4;
      setLockCnt(c => {
        const next = ok ? c + 1 : 0;
        if (next >= 3) takePhoto();
        return next;
      });

      id = setTimeout(tick, 400);
    };
    tick();
    return () => clearTimeout(id);
  }, [ready, maskD]);

  // 3) Captura + callback
  const takePhoto = () => {
    if (capturingRef.current) return;     // evita dobles llamadas
    capturingRef.current = true;

    const v = videoRef.current;
    const c = document.createElement("canvas");
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d").drawImage(v, 0, 0);

    c.toBlob(blob => {
      if (!blob) return;
      setCaptured(true);
      setTimeout(() => setCaptured(false), 800);

      onCapture(blob);
      setLockCnt(0);                      // resetea detección
      setTimeout(() => onClose(), 300);   // deja 300 ms para pintar preview
    }, "image/jpeg", 0.8);
  };

  return (
    <div className="cam-wrapper">
      <video ref={videoRef} autoPlay playsInline className="cam-video" />

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
