// src/components/CameraScanner.js

import { useEffect, useRef, useState } from "react";

export default function CameraScanner({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [metadataReady, setMetadataReady] = useState(false);
  const [lockCnt, setLockCnt] = useState(0);

  // ────────────────────────────────────────────────────────────────
  // Constante con la ruta SVG de tu silueta (copiada de public/plantilla_silueta.svg)
  const SILHOUETTE_D = `
    m 669.33329,1261.0846
    c 49.3713,-9.3258 85.28282,-53.7974 100.46952,-124.418
    6.10252,-28.3777 8.41069,-49.2898 12.87705,-116.6667
    11.56653,-174.48554 20.6809,-237.20229 52.02666,-357.99994
    25.94736,-99.99374 30.21209,-126.08563 28.93491,-177.0258
    C 862.27476,430.46436 851.69327,374.84829 830.73146,311.99998
    803.1523,229.31137 767.21215,156.71182 735.61417,119.8619
    726.42263,109.14262 709.44973,95.464206 698.37923,89.854361
    680.72967,80.91065 657.58186,78.989419 635.36769,84.624505
    590.05901,96.117996 551.52196,139.47971 527.86876,205.58181
    c -21.30918,59.55145 -33.24153,136.41124 -31.42506,202.41817
    1.63035,59.24413 9.50841,95.70197 37.35795,172.88412
    14.78057,40.96284 18.46581,52.71067 24.81826,79.11586
    9.40285,39.08471 12.88961,73.5655 11.59529,114.66666
    -1.09555,34.78968 -3.19911,51.90516 -18.76329,152.66666
    -13.9112,90.06022 -17.09786,120.16282 -17.14932,162.00002
    -0.0415,33.7573 1.98689,52.9697 8.18251,77.5016
    12.46314,49.3486 35.93874,78.8372 72.52688,91.1039
    17.05045,5.7165 35.15997,6.7652 54.32131,3.1458
    z
  `;

  // ─── 1. Arrancar cámara y esperar metadata ────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 } },
        });
        const video = videoRef.current;
        video.srcObject = stream;
        streamRef.current = stream;

        const onLoaded = () => {
          setMetadataReady(true);
          video.removeEventListener("loadedmetadata", onLoaded);
        };
        video.addEventListener("loadedmetadata", onLoaded);
      } catch (e) {
        alert("No se pudo abrir la cámara");
        onClose();
      }
    })();
    return () => streamRef.current?.getTracks().forEach((t) => t.stop());
  }, [onClose]);

  // ─── 2. Detección cada 400 ms tras metadataReady ───────────────────
  useEffect(() => {
    if (!metadataReady) return;

    const video = videoRef.current;
    const W = video.videoWidth;
    const H = video.videoHeight;

    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");

    // Escalar tu path desde el viewBox original al tamaño real del vídeo:
    const VB = { width: 1365.3333, height: 1365.3333 };
    const scaleX = W / VB.width;
    const scaleY = H / VB.height;
    const rawPath = new Path2D(SILHOUETTE_D);
    const maskPath = new Path2D();
    maskPath.addPath(rawPath, new DOMMatrix().scale(scaleX, scaleY));

    let timeoutId = null;
    const tick = () => {
      if (video.readyState < 2) {
        timeoutId = setTimeout(tick, 400);
        return;
      }

      ctx.drawImage(video, 0, 0, W, H);
      const data = ctx.getImageData(0, 0, W, H).data;

      let inCnt = 0,
        outCnt = 0,
        edgeCnt = 0;
      for (let y = 0; y < H; y += 4) {
        for (let x = 0; x < W; x += 4) {
          const i = (y * W + x) * 4;
          const lum = data[i] + data[i + 1] + data[i + 2];
          const lum2 =
            data[i + 16] + data[i + 17] + data[i + 18]; // muestra a 4 px de distancia
          if (Math.abs(lum - lum2) > 80) {
            edgeCnt++;
            if (ctx.isPointInPath(maskPath, x, y)) inCnt++;
            else outCnt++;
          }
        }
      }

      const fillPct = (inCnt / (edgeCnt || 1)) * 100;
      const outsidePct = (outCnt / (edgeCnt || 1)) * 100;

      document.getElementById(
        "dbg"
      ).textContent = `Bordes: ${edgeCnt}\nDentro: ${inCnt}\nFuera: ${outCnt}\nFill%: ${fillPct.toFixed(
        1
      )}`;

      const ok = fillPct > 15 && outsidePct < 4;
      setLockCnt((c) => {
        const next = ok ? c + 1 : 0;
        if (next >= 3) takePhoto();
        return next;
      });

      timeoutId = setTimeout(tick, 400);
    };

    tick();
    return () => clearTimeout(timeoutId);
  }, [metadataReady, onCapture]);

  // ─── 3. Capturar y enviar al padre ────────────────────────────────
  const takePhoto = () => {
    const v = videoRef.current;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d").drawImage(v, 0, 0);
    c.toBlob((blob) => blob && onCapture(blob), "image/jpeg", 0.8);
  };

  return (
    <div className="cam-wrapper">
      <video ref={videoRef} autoPlay playsInline className="cam-video" />

      {/* Máscara SVG superpuesta */}
      <svg
        className="mask-svg"
        viewBox="0 0 1365.3333 1365.3333"
        preserveAspectRatio="none"
      >
        <defs>
          <mask id="hole">
            <rect width="100%" height="100%" fill="black" />
            <path d={SILHOUETTE_D} fill="white" />
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.55)"
          mask="url(#hole)"
        />
        <path
          d={SILHOUETTE_D}
          fill="none"
          stroke="white"
          strokeWidth="3"
        />
      </svg>

      <button className="cls-btn" onClick={onClose}>
        ✕
      </button>
      <pre id="dbg" className="dbg" />

      <style jsx>{`
        .cam-wrapper {
          position: fixed;
          inset: 0;
          z-index: 9999;
        }
        .cam-video {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .mask-svg {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
        }
        .cls-btn {
          position: absolute;
          top: 16px;
          right: 16px;
          border: none;
          background: rgba(0, 0, 0, 0.6);
          color: #fff;
          font-size: 24px;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          cursor: pointer;
        }
        .dbg {
          position: absolute;
          top: 16px;
          left: 16px;
          background: rgba(0, 0, 0, 0.55);
          color: #fff;
          padding: 6px 10px;
          font-size: 13px;
          white-space: pre-line;
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
}
