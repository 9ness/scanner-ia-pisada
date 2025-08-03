import { useEffect, useRef, useState } from "react";

export default function CameraScanner({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [statusText, setStatusText] = useState("📷 Escanea tu plantilla");
  const [testInfo, setTestInfo] = useState({ bordes: 0, dentro: 0, fuera: 0 });

  useEffect(() => {
    let stream;
    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
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

  // Simulación de detección automática para TEST
  useEffect(() => {
    const checkFrame = () => {
      // 🔢 Simulación de detección: genera números aleatorios para test
      const bordes = Math.floor(Math.random() * 7000);
      const dentro = Math.floor(Math.random() * 5000);
      const fuera = Math.floor(Math.random() * 15000);

      setTestInfo({ bordes, dentro, fuera });

      // Repetir cada medio segundo
      setTimeout(checkFrame, 500);
    };
    checkFrame();
  }, []);

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
      {/* 🎥 VIDEO EN TIEMPO REAL */}
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

      {/* 🕶️ CAPA OSCURA CON MÁSCARA DE LA PLANTILLA */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          background: "rgba(0, 0, 0, 0.65)", // oscurece TODO
          WebkitMaskImage: "url('/plantilla_silueta.png')",
          WebkitMaskRepeat: "no-repeat",
          WebkitMaskPosition: "center",
          WebkitMaskSize: "60vw auto", // tamaño relativo de la plantilla
          maskImage: "url('/plantilla_silueta.png')",
          maskRepeat: "no-repeat",
          maskPosition: "center",
          maskSize: "60vw auto",
          maskComposite: "exclude",
          zIndex: 2,
        }}
      />

      {/* 🔲 PNG DE LA SILUETA EN BLANCO (para que el usuario la vea) */}
      <img
        src="/plantilla_silueta.png"
        alt="Silueta"
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "60vw",
          maxWidth: "350px",
          opacity: 1,
          pointerEvents: "none",
          zIndex: 3,
        }}
      />

      {/* 📊 TEST INFO – NÚMEROS EN PANTALLA */}
      <div
        style={{
          position: "absolute",
          top: "15px",
          left: "15px",
          background: "rgba(0, 0, 0, 0.7)",
          color: "white",
          padding: "8px 12px",
          borderRadius: "8px",
          fontSize: "14px",
          lineHeight: "18px",
          zIndex: 4,
        }}
      >
        <div>📊 <b>TEST INFO</b></div>
        <div>🔢 Bordes: {testInfo.bordes}</div>
        <div>✅ Dentro: {testInfo.dentro}</div>
        <div>❌ Fuera: {testInfo.fuera}</div>
      </div>

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
          background: "rgba(0, 0, 0, 0.7)",
          color: "white",
          fontSize: "24px",
          border: "none",
          cursor: "pointer",
          zIndex: 5,
        }}
      >
        ✕
      </button>
    </div>
  );
}
