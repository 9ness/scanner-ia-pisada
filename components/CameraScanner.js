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

    const checkFrame = () => {
      if (!video || video.readyState !== 4) {
        requestAnimationFrame(checkFrame);
        return;
      }

      // 🖼️ Capturar frame
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // 🏷️ Definir área de detección (mitad de la pantalla)
      const detectX = canvas.width * 0.25;
      const detectY = canvas.height * 0.15;
      const detectWidth = canvas.width * 0.50;
      const detectHeight = canvas.height * 0.70;

      // 📥 Crear Mat y recortar solo el área de detección
      let src = cv.imread(canvas);
      let roi = src.roi(new cv.Rect(detectX, detectY, detectWidth, detectHeight));

      // 🔍 Detección de bordes
      cv.cvtColor(roi, roi, cv.COLOR_RGBA2GRAY);
      cv.GaussianBlur(roi, roi, new cv.Size(5, 5), 0);
      cv.Canny(roi, roi, 50, 150);

      // 📊 Contar bordes blancos
      let whitePixels = cv.countNonZero(roi);
      setBorders(whitePixels);
      setDebugText(`📊 Bordes detectados: ${whitePixels}`);

      // ✅ Si hay suficientes bordes, consideramos que hay plantilla
      if (whitePixels > 10000) {
        setHighlight(true);
        setDebugText("✅ Plantilla detectada, capturando foto...");

        setTimeout(() => {
          takePhoto();
          setHighlight(false);
        }, 500);

        src.delete();
        roi.delete();
        return;
      }

      // 🧹 Limpieza
      src.delete();
      roi.delete();

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
        ✕✕
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
        <div>📈 Bordes: {borders}</div>
      </div>
    </div>
  );
}
