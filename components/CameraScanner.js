// components/CameraScanner.js
import { useEffect, useRef } from "react";

export default function CameraScanner({ onClose, onCapture }) {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);

    useEffect(() => {
        // Abre la cámara (trasera en móvil)
        navigator.mediaDevices
            .getUserMedia({ video: { facingMode: "environment" } })
            .then((stream) => {
                streamRef.current = stream;
                if (videoRef.current) videoRef.current.srcObject = stream;
            })
            .catch((err) => console.error("❌ Error abriendo cámara", err));

        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach((track) => track.stop());
            }
        };
    }, []);

    // (opcional) Capturar foto manual (no la usamos de momento)
    const handleCapture = () => {
        if (!canvasRef.current || !videoRef.current) return;
        const ctx = canvasRef.current.getContext("2d");
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        ctx.drawImage(videoRef.current, 0, 0);
        canvasRef.current.toBlob((blob) => {
            if (onCapture) onCapture(blob);
        }, "image/jpeg");
    };

    return (
        <div className="camera-modal">
            {/* Cámara */}
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="camera-video"
            />

            {/* Silueta */}
            <img
                src="/plantilla_silueta.png"
                alt="Silueta plantilla"
                className="camera-overlay"
            />

            {/* Botón cerrar */}
            <button className="close-btn" onClick={onClose}>✕✕</button>

            {/* Canvas oculto para capturas */}
            <canvas ref={canvasRef} style={{ display: "none" }} />
        </div>
    );
}
