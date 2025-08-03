import { useEffect, useRef, useState } from "react";

export default function CameraScanner({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [opencvReady, setOpencvReady] = useState(false);

  useEffect(() => {
    // 📥 Cargar OpenCV solo una vez
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
    // 🎥 Encender cámara trasera
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
      // 🔴 Apaga la cámara al desmontar
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // 📸 FUNCIÓN: Tomar foto actual y mandarla al flujo normal
  const takePhoto = () => {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0);

    // 🔥 Simula “Seleccionar imagen”
    canvas.toBlob((blob) => {
      console.log("📸 FOTO AUTOMÁTICA HECHA ✔");
      if (navigator.vibrate) navigator.vibrate(200); // vibración móvil
      onCapture(blob); // 🔄 la pasa al flujo principal (como si fuera de galería)
      onClose(); // 🚪 cierra la cámara
    }, "image/jpeg");
  };

  // 🔍 DETECCIÓN
  useEffect(() => {
    if (!opencvReady) return;

    console.log("[CameraScanner] 🔍 Modo detección activo");

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

      // 🔄 Procesamiento con OpenCV
      const src = cv.imread(canvas);
      const gray = new cv.Mat();
      const edges = new cv.Mat();

      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
      cv.GaussianBlur(gray, gray, new cv.Size(5, 5), 0);
      cv.Canny(gray, edges, 50, 150);

      // 📦 ZONA CENTRAL (donde está la silueta)
      const x = Math.floor(edges.cols * 0.2);
      const y = Math.floor(edges.rows * 0.2);
      const w = Math.floor(edges.cols * 0.6);
      const h = Math.floor(edges.rows * 0.6);
      const roi = edges.roi(new cv.Rect(x, y, w, h));

      // 📊 Contamos bordes
      const whitePixels = cv.countNonZero(roi);
      console.log("📊 Bordes detectados:", whitePixels);

      // 🎯 UMBRAL (ajústalo, baja a 1500 si quieres más sensibilidad)
      if (whitePixels > 2500) {
        console.log("✅ Plantilla detectada → ¡FOTO!");
        takePhoto();
        // 🧹 limpieza
        src.delete(); gray.delete(); edges.delete(); roi.delete();
        return; // 🚪 paramos el loop
      }

      // 🧹 limpieza
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

      {/* 🦶 SILUETA (más grande y centrada) */}
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
          opacity: 0.5,
          pointerEvents: "none",
          zIndex: 1000,
        }}
      />

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
        ✕✕
      </button>
    </div>
  );
}
