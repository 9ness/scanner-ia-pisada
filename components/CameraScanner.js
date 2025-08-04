// src/components/CameraScanner.js

import { useEffect, useRef, useState } from "react";

export default function CameraScanner({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [metadataReady, setMetadataReady] = useState(false);
  const [lockCnt, setLockCnt] = useState(0);

  // ─── 1. Arrancar cámara y esperar metadata ─────────────────
  useEffect(() => {
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
          },
        });
        const video = videoRef.current;
        video.srcObject = stream;
        streamRef.current = stream;

        // Esperar a que cargue metadata (ancho/alto)
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

    // Cleanup: parar cámara al desmontar
    return () =>
      streamRef.current?.getTracks().forEach((track) => track.stop());
  }, [onClose]);

  // ─── 2. Detección cada 400 ms tras metadataReady ────────────
  useEffect(() => {
    if (!metadataReady) return;

    const video = videoRef.current;
    const W = video.videoWidth;
    const H = video.videoHeight;

    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");

    // Escalar Path2D del SVG a las dimensiones reales
    const svgEl = document.querySelector(".mask-svg");
    const vb = svgEl.viewBox.baseVal; // viewBox coords
    const scaleX = W / vb.width;
    const scaleY = H / vb.height;
    const rawD = document.getElementById("plantilla-mask").getAttribute("d");
    const maskPath = new Path2D();
    maskPath.addPath(
      new Path2D(rawD),
      new DOMMatrix().scale(scaleX, scaleY)
    );

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
      const step = 4 * 4;

      for (let y = 0; y < H; y += 4) {
        for (let x = 0; x < W; x += 4) {
          const i = (y * W + x) * 4;
          const lum = data[i] + data[i + 1] + data[i + 2];
          const lum2 =
            data[i + step] + data[i + step + 1] + data[i + step + 2];
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

  // ─── 3. Capturar y enviar al padre ─────────────────────────
  const takePhoto = () => {
    const v = videoRef.current;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d").drawImage(v, 0, 0);
    c.toBlob((blob) => {
      if (blob) onCapture(blob);
    }, "image/jpeg", 0.8);
  };

  return (
    <div className="cam-wrapper">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="cam-video"
      />
      <svg
        className="mask-svg"
        viewBox="0 0 1365.333 1365.333"
        preserveAspectRatio="none"
      >
        <defs>
          <mask id="hole">
            <rect width="100%" height="100%" fill="black" />
            <path
              id="plantilla-mask"
              d="M669.33329,1261.0846c49.3713-9.3258 85.28282-53.7974 100.46952-124.418 ...."
              fill="white"
            />
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.55)"
          mask="url(#hole)"
        />
        <use
          href="#plantilla-mask"
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
