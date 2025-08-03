import { useEffect, useRef, useState } from "react";

export default function CameraScanner({ onCapture, onClose }) {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);

    // 🟢 Estado de debug para mostrar en pantalla
    const [borderCount, setBorderCount] = useState(0);
    const [statusText, setStatusText] = useState("🔍 Buscando plantilla…");

    useEffect(() => {
        let stream;

        const startCamera = async () => {
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: { ideal: "environment" },
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
                setStatusText("❌ Error al abrir cámara");
            }
        };

        startCamera();

        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach((track) => track.stop());
            }
        };
    }, []);

    // 📸 Captura automática
    useEffect(() => {
        if (!window.cv) {
            setStatusText("⚠️ OpenCV no cargado");
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

            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            // 🔍 Procesar con OpenCV
            let src = new cv.Mat(canvas.height, canvas.width, cv.CV_8UC4);
            cv.imread(canvas, src);
            cv.cvtColor(src, src, cv.COLOR_RGBA2GRAY);

            let edges = new cv.Mat();
            cv.Canny(src, edges, 50, 150);

            // 📊 Contamos píxeles blancos (bordes detectados)
            let whitePixels = cv.countNonZero(edges);
            setBorderCount(whitePixels);

            // 🟢 UMBRAL para considerar que hay “suficiente borde”
            if (whitePixels > 25000) {
                setStatusText("✅ Plantilla detectada, tomando foto...");
                takePhoto();
                src.delete();
                edges.delete();
                return; // ⛔ Deja de analizar frames
            } else {
                setStatusText("🔍 Buscando plantilla…");
            }

            src.delete();
            edges.delete();

            // 🔄 Repite cada 500ms
            setTimeout(checkFrame, 500);
        };

        const takePhoto = () => {
            // 📸 Saca la foto actual
            const captureCanvas = document.createElement("canvas");
            captureCanvas.width = video.videoWidth;
            captureCanvas.height = video.videoHeight;
            const captureCtx = captureCanvas.getContext("2d");
            captureCtx.drawImage(video, 0, 0, captureCanvas.width, captureCanvas.height);

            captureCanvas.toBlob((blob) => {
                if (onCapture) {
                    onCapture(blob);
                }
            }, "image/jpeg", 0.95);

            // 🔴 Cierra la cámara después de tomar la foto
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
                    opacity: 0.5,
                    pointerEvents: "none",
                    zIndex: 2
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
                    zIndex: 3
                }}
            >
                ✕✕
            </button>

            {/* 🟢 DEBUG BOX (ESQUINA SUPERIOR IZQUIERDA) */}
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
                    zIndex: 4
                }}
            >
                <div>{statusText}</div>
                <div>📊 Bordes: {borderCount}</div>
            </div>
        </div>
    );
}
