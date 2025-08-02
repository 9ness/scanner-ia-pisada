import { useEffect, useRef } from "react";

export default function CameraScanner({ onCapture, onClose }) {
    const videoRef = useRef(null);
    const streamRef = useRef(null);

    useEffect(() => {
        console.log("[CameraScanner] 🔄 Inicializando cámara...");
        let stream;

        const startCamera = async () => {
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: "environment" }
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
            {/* VIDEO DE LA CÁMARA */}
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

            {/* SILUETA 🔥 */}
            <img
                src="/plantilla_silueta.png"
                alt="Silueta plantilla"
                style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    width: "50%",          // 📏 Ajusta el tamaño visible de la plantilla
                    maxWidth: "300px",     // 📏 Máximo para que no sea gigante
                    opacity: 0.5,
                    zIndex: 2,
                    pointerEvents: "none"  // ✅ No bloquea interacción
                }}
            />

            {/* BOTÓN DE CERRAR */}
            <button
                onClick={onClose}
                style={{
                    position: "absolute",
                    top: "20px",
                    right: "20px",
                    background: "rgba(0,0,0,0.6)",
                    color: "white",
                    border: "none",
                    padding: "12px",
                    borderRadius: "50%",
                    fontSize: "20px",
                    zIndex: 3,
                    cursor: "pointer",
                }}
            >
                ✕
            </button>
        </div>
    );
}
