import { useEffect, useRef, useState } from "react";

export default function CameraScanner({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [opencvReady, setOpencvReady] = useState(false);
  const [detectionState, setDetectionState] = useState("scanning"); // scanning | detected | captured

  useEffect(() => {
    // 📥 Carga OpenCV
    const script = document.createElement("script");
    script.src = "https://docs.opencv.org/4.7.0/opencv.js";
    script.async = true;
    script.onload = () => {
      console.log("✅ OpenCV cargado");
      setOpencvReady(true);
    };
    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    // 🎥 Cámara trasera
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
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
      }
    };
    startCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // 📸 Tomar foto y mandarla al flujo principal
  const takePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0);

    canvas.toBlob((blob) => {
      console.log("📸 FOTO AUTOMÁTICA HECHA ✔");
      if (navigator.vibrate) navigator.vibrate(300); // vibración móvil
      setDetectionState("captured"); // muestra texto de captura
      onCapture(blob);
      // ⏳ cierra la cámara 1s después de disparar
      setTimeout(() => {
        onClose();
      }, 1000);
    }, "image/jpeg");
  };

  // 🔍 Detección
  useEffect(() => {
    if (!opencvReady) return;

    console.log("[CameraScanner] 🔍 Iniciando detección");

    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    const checkFrame = () => {
      if (!video || video.readyState < 2) {
        setTimeout(checkFrame, 400);
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);

      // 🔄 Procesar imagen con OpenCV
      const src = cv.imread(canvas);
      const gray = new cv.Mat();
      const edges = new cv.Mat();

      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
      cv.GaussianBlur(gray, gray, new cv.Size(5, 5), 0);
      cv.Canny(gray, edges, 50, 150);

      // 📦 Zona central de la pantalla (donde está la silueta)
      const x = Math.floor(edges.cols * 0.2);
      const y = Math.floor(edges.rows * 0.2);
      const w = Math.floor(edges.cols * 0.6);
      const h = Math.floor(edges.rows * 0.6);
      const roi = edges.roi(new cv.Rect(x, y, w, h));

      const whitePixels = cv.countNonZero(roi);
      console.log("📊 Bordes detectados:", whitePixels);

      // 🎯 BAJO umbral para ver si funciona YA
      if (whitePixels > 800 && detectionState === "scanning") {
        console.log("✅ Plantilla detectada → ¡FOTO!");
        setDetectionState("detected"); // cambia overlay a verde
        takePhoto();
        // 🧹 limpieza
        src.delete(); gray.delete(); edges.delete(); roi.delete();
        return;
      }

      src.delete(); gray.delete(); edges.delete(); roi.delete();
      setTimeout(checkFrame, 400);
    };

    checkFrame();
  }, [opencvReady]);

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
        overflow: "hidden",
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

      {/* 🦶 SILUETA */}
      <img
        src="/plantilla_silueta.png"
        alt="Silueta de plantilla"
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          maxWidth: "80vw",
          maxHeight: "80vh",
          opacity: detectionState === "detected" ? 0.8 : 0.5,
          border: detectionState === "detected" ? "4px solid lime" : "none",
          borderRadius: "12px",
          pointerEvents: "none",
          zIndex: 1000,
        }}
      />

      {/* ✅ TEXTO DE CAPTURA */}
      {detectionState === "captured" && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            color: "lime",
            fontSize: "28px",
            fontWeight: "bold",
            background: "rgba(0, 0, 0, 0.7)",
            padding: "12px 18px",
            borderRadius: "8px",
            zIndex: 2000,
          }}
        >
          📸 ¡Foto tomada!
        </div>
      )}

      {/* ❌ BOTÓN DE CERRAR */}
      <button
        onClick={onClose}
        style={{
          position: "absolute",
          top: "15px",
          right: "15px",
          width: "42px",
          height: "42px",
          borderRadius: "50%",
          background: "rgba(0, 0, 0, 0.7)",
          color: "#fff",
          fontSize: "20px",
          border: "none",
          cursor: "pointer",
          zIndex: 2000,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        ✕
      </button>
    </div>
  );
}
