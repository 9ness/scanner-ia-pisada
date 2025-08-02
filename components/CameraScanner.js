import { useEffect, useRef, useState } from "react";

export default function CameraScanner({ onCapture, onClose }) {
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const [opencvReady, setOpencvReady] = useState(false);

    // ✅ 1. Arranca la cámara con resolución adaptable (HD si puede, si no baja)
    useEffect(() => {
        console.log("[CameraScanner] 🔄 Inicializando cámara...");
        let stream;

        const startCamera = async () => {
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: { ideal: "environment" }, // 📲 cámara trasera
                        width: { ideal: 1280 },               // 📈 pide HD (más seguro que 1920 directo)
                        height: { ideal: 720 }
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

        // ✅ Limpieza al cerrar
        return () => {
            console.log("[CameraScanner] 🛑 Cerrando cámara...");
            if (streamRef.current) {
                streamRef.current.getTracks().forEach((track) => track.stop());
            }
        };
    }, []);

    // ✅ 2. Carga OpenCV.js una vez
    useEffect(() => {
        console.log("[CameraScanner] ⬇️ Cargando OpenCV...");
        const script = document.createElement("script");
        script.src = "https://docs.opencv.org/4.7.0/opencv.js";
        script.async = true;
        script.onload = () => {
            console.log("✅ OpenCV cargado");
            setOpencvReady(true);
        };
        document.body.appendChild(script);
        return () => {
            document.body.removeChild(script);
        };
    }, []);

    // ✅ 3. Detección automática (muy simple de momento)
    useEffect(() => {
        if (!opencvReady) return;
        console.log("[CameraScanner] 🚀 OpenCV listo, arrancando detección automática...");

        const video = videoRef.current;
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        const checkFrame = () => {
            if (!video || video.readyState < 2) {
                setTimeout(checkFrame, 500);
                return;
            }

            // 📸 Capturamos frame en canvas
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            // ⚙️ OpenCV: bordes rápidos (esto luego lo refinamos)
            const src = cv.imread(canvas);
            const gray = new cv.Mat();
            const edges = new cv.Mat();
            cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
            cv.Canny(gray, edges, 50, 150);

            let whitePixels = cv.countNonZero(edges);

            console.log("📊 Bordes detectados:", whitePixels);

            if (whitePixels > 15000) {   // 🔥 si hay suficiente borde, tomamos foto
                console.log("📸 DETECCIÓN CORRECTA → FOTO AUTOMÁTICA");
                takePhoto();
                src.delete(); gray.delete(); edges.delete();
                return;
            }

            src.delete(); gray.delete(); edges.delete();
            setTimeout(checkFrame, 800); // vuelve a analizar cada 0.8s
        };

        checkFrame();
    }, [opencvReady]);

    // ✅ 4. Función para sacar foto y enviarla al index
    const takePhoto = () => {
        if (!videoRef.current) return;
        const canvas = document.createElement("canvas");
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        canvas.getContext("2d").drawImage(videoRef.current, 0, 0);
        canvas.toBlob((blob) => {
            onCapture(blob);
        }, "image/jpeg", 0.9);
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

            {/* SILUETA (más grande) */}
            <img
                src="/plantilla_silueta.png"
                alt="Silueta de plantilla"
                style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    width: "auto",
                    height: "85%",   // 🔥 Más grande para móviles
                    opacity: 0.5,
                    pointerEvents: "none",
                    zIndex: 1000
                }}
            />

            {/* BOTÓN DE CERRAR */}
            <button
                onClick={onClose}
                style={{
                    position: "absolute",
                    top: "20px",
                    right: "20px",
                    width: "45px",
                    height: "45px",
                    borderRadius: "50%",
                    background: "rgba(0, 0, 0, 0.6)",
                    color: "white",
                    fontSize: "24px",
                    fontWeight: "bold",
                    border: "1px solid rgba(255, 255, 255, 0.7)",
                    cursor: "pointer",
                    zIndex: 1001
                }}
            >
                ✕
            </button>
        </div>
    );
}
