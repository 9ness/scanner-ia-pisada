import { useEffect, useRef, useState } from "react";

export default function CameraScanner({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [ctxOverlay, setCtxOverlay] = useState(null);

  useEffect(() => {
    console.log("[CameraScanner] 🔄 Inicializando cámara...");
    let stream;

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" }, // 📲 trasera
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          }
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
      console.log("[CameraScanner] 🛑 Cerrando cámara...");
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // 🟢 Efecto parpadeo verde al detectar
  const flashGreen = () => {
    if (!ctxOverlay) return;
    ctxOverlay.save();
    ctxOverlay.strokeStyle = "lime";
    ctxOverlay.lineWidth = 6;
    ctxOverlay.strokeRect(
      window.innerWidth * 0.225,
      window.innerHeight * 0.15,
      window.innerWidth * 0.55,
      window.innerHeight * 0.7
    );
    setTimeout(() => drawOverlay(ctxOverlay), 500);
  };

  // 🎯 Dibuja el overlay oscuro con agujero
  const drawOverlay = (ctx) => {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // 🔳 Fondo oscuro
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // 🕳 Silueta (rectángulo central)
    const siluetaWidth = ctx.canvas.width * 0.55;
    const siluetaHeight = ctx.canvas.height * 0.7;
    const siluetaX = (ctx.canvas.width - siluetaWidth) / 2;
    const siluetaY = (ctx.canvas.height - siluetaHeight) / 2;

    // “Agujero” transparente
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = "rgba(0,0,0,1)";
    ctx.fillRect(siluetaX, siluetaY, siluetaWidth, siluetaHeight);

    // Volvemos a normal
    ctx.globalCompositeOperation = "source-over";

    // Borde blanco fino
    ctx.strokeStyle = "white";
    ctx.lineWidth = 3;
    ctx.strokeRect(siluetaX, siluetaY, siluetaWidth, siluetaHeight);
  };

  // 🖼 Captura manual (puedes llamarla cuando haya coincidencia real)
  const takePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const imgData = canvas.toDataURL("image/jpeg");
    onCapture(imgData);
    flashGreen();
    onClose(); // 🔥 Sale de la cámara tras capturar
  };

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
        overflow: "hidden"
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
          zIndex: 1
        }}
      />

      {/* 🔲 CANVAS OVERLAY OSCURO */}
      <canvas
        ref={(canvas) => {
          if (!canvas) return;
          canvas.width = window.innerWidth;
          canvas.height = window.innerHeight;
          const ctx = canvas.getContext("2d");
          setCtxOverlay(ctx);
          drawOverlay(ctx);
        }}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          zIndex: 1000,
          width: "100vw",
          height: "100vh",
          pointerEvents: "none"
        }}
      />

      {/* ❌ BOTÓN DE CERRAR */}
      <button
        onClick={onClose}
        style={{
          position: "absolute",
          top: "20px",
          right: "20px",
          width: "40px",
          height: "40px",
          borderRadius: "50%",
          background: "rgba(0, 0, 0, 0.6)",
          color: "white",
          fontSize: "22px",
          fontWeight: "bold",
          border: "1px solid white",
          cursor: "pointer",
          zIndex: 2000
        }}
      >
        ✕
      </button>

      {/* 📸 BOTÓN DE TEST CAPTURA (puedes quitarlo luego) */}
      <button
        onClick={takePhoto}
        style={{
          position: "absolute",
          bottom: "30px",
          background: "limegreen",
          color: "white",
          padding: "12px 20px",
          border: "none",
          borderRadius: "8px",
          fontSize: "18px",
          fontWeight: "bold",
          zIndex: 2000
        }}
      >
        CAPTURAR TEST
      </button>
    </div>
  );
}
