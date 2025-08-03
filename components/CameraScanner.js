import { useEffect, useRef, useState } from "react";

export default function CameraScanner({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [debugText, setDebugText] = useState("🔍 Buscando plantilla...");
  const [borders, setBorders] = useState(0);
  const [highlight, setHighlight] = useState(false);

  useEffect(() => {
    let stream;
    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          streamRef.current = stream;
        }
      } catch (err) {
        console.error("❌ Error al abrir cámara:", err);
        setDebugText("❌ Error al abrir cámara");
      }
    };
    startCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (!window.cv) {
      setDebugText("⚠️ OpenCV no cargado");
      return;
    }

    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    // 🔥 Pre-cargar silueta como máscara
    const siluetaImg = new Image();
    siluetaImg.src = "/plantilla_silueta.png";
    siluetaImg.onload = () => {
      console.log("✅ Silueta cargada para máscara");
    };

    const checkFrame = () => {
      if (!video || video.readyState !== 4) {
        requestAnimationFrame(checkFrame);
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // 📥 Convertimos a Mat
      let src = cv.imread(canvas);
      cv.cvtColor(src, src, cv.COLOR_RGBA2GRAY);

      // 🎭 Creamos una máscara del tamaño de la pantalla
      const maskCanvas = document.createElement("canvas");
      maskCanvas.width = canvas.width;
      maskCanvas.height = canvas.height;
      const maskCtx = maskCanvas.getContext("2d");

      // 👉 Dibujamos la silueta en el centro como área blanca
      const siluetaHeight = canvas.height * 0.7;
      const siluetaWidth = siluetaHeight * 0.35; // proporción aprox.
      const siluetaX = (canvas.width - siluetaWidth) / 2;
      const siluetaY = (canvas.height - siluetaHeight) / 2;

      maskCtx.fillStyle = "black";
      maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
      maskCtx.drawImage(siluetaImg, siluetaX, siluetaY, siluetaWidth, siluetaHeight);

      // 🔄 Leemos la máscara en OpenCV
      let mask = cv.imread(maskCanvas);
      cv.cvtColor(mask, mask, cv.COLOR_RGBA2GRAY);
      cv.threshold(mask, mask, 1, 255, cv.THRESH_BINARY);

      // 🏷️ Detección de bordes en todo el frame
      cv.GaussianBlur(src, src, new cv.Size(5, 5), 0);
      cv.Canny(src, src, 50, 150);

      // 📊 Contar bordes DENTRO y FUERA de la máscara
      let insideMat = new cv.Mat();
      let outsideMat = new cv.Mat();

      cv.bitwise_and(src, mask, insideMat);
      cv.bitwise_not(mask, mask);
      cv.bitwise_and(src, mask, outsideMat);

      const insideEdges = cv.countNonZero(insideMat);
      const outsideEdges = cv.countNonZero(outsideMat);

      setBorders(insideEdges);
      setDebugText(`📊 Dentro: ${insideEdges} | Fuera: ${outsideEdges}`);

      // ✅ Condición de disparo: bordes dentro altos + bordes fuera bajos
      if (insideEdges > 9000 && outsideEdges < 2500) {
        setHighlight(true);
        setDebugText("✅ Coincidencia → Capturando foto…");

        setTimeout(() => {
          takePhoto();
          setHighlight(false);
        }, 500);

        src.delete();
        mask.delete();
        insideMat.delete();
        outsideMat.delete();
        return;
      }

      // 🧹 Limpieza
      src.delete();
      mask.delete();
      insideMat.delete();
      outsideMat.delete();

      setTimeout(checkFrame, 500);
    };

    const takePhoto = () => {
      const captureCanvas = document.createElement("canvas");
      captureCanvas.width = video.videoWidth;
      captureCanvas.height = video.videoHeight;
      const captureCtx = captureCanvas.getContext("2d");
      captureCtx.drawImage(video, 0, 0, captureCanvas.width, captureCanvas.height);

      captureCanvas.toBlob((blob) => {
        if (onCapture) onCapture(blob);
      }, "image/jpeg", 0.95);

      if (onClose) onClose();
    };

    checkFrame();
  }, [onCapture, onClose]);

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        background: "black",
        zIndex: 9999,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {/* 🎥 VIDEO */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          zIndex: 1,
        }}
      />

      {/* 🔴 SILUETA */}
      <img
        src="/plantilla_silueta.png"
        alt="Silueta"
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          height: "70%",
          opacity: highlight ? 1 : 0.5,
          filter: highlight ? "drop-shadow(0 0 15px lime)" : "none",
          pointerEvents: "none",
          transition: "all 0.3s ease",
          zIndex: 2,
        }}
      />

      {/* ❌ BOTÓN DE CERRAR */}
      <button
        onClick={onClose}
        style={{
          position: "absolute",
          top: "20px",
          right: "20px",
          background: "rgba(0, 0, 0, 0.6)",
          color: "white",
          fontSize: "28px",
          border: "none",
          borderRadius: "50%",
          width: "45px",
          height: "45px",
          cursor: "pointer",
          zIndex: 3,
        }}
      >
        ✕
      </button>

      {/* 📊 DEBUG */}
      <div
        style={{
          position: "absolute",
          top: "20px",
          left: "20px",
          background: "rgba(0,0,0,0.7)",
          color: "white",
          padding: "8px 12px",
          borderRadius: "6px",
          fontSize: "14px",
          fontFamily: "monospace",
          zIndex: 4,
        }}
      >
        <div>{debugText}</div>
        <div>📈 Bordes dentro: {borders}</div>
      </div>
    </div>
  );
}
