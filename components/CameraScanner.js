import { useEffect, useRef, useState } from "react";

export default function CameraScanner({ onCapture, onClose }) {
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const [opencvReady, setOpencvReady] = useState(false);

    // ✅ 1. Cargar OpenCV
    useEffect(() => {
        console.log("[CameraScanner] 📥 Cargando OpenCV...");
        const script = document.createElement("script");
        script.src = "https://docs.opencv.org/4.7.0/opencv.js";
        script.async = true;
        script.onload = () => {
            console.log("✅ OpenCV cargado");
            setOpencvReady(true);
        };
        document.body.appendChild(script);
    }, []);

    // ✅ 2. Iniciar cámara (ideal 1080p)
    useEffect(() => {
        const startCamera = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
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
            }
        };
        startCamera();

        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    // ✅ 3. Función para tomar la foto
    const takePhoto = () => {
        const video = videoRef.current;
        if (!video) return;

        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(video, 0, 0);

        canvas.toBlob(blob => {
            console.log("📸 Foto tomada automáticamente");
            onCapture(blob);
        }, "image/jpeg");
    };

    // ✅ 4. Template Matching (detección automática)
    useEffect(() => {
        if (!opencvReady) return;

        console.log("[CameraScanner] 🚀 OpenCV listo, iniciando detección automática...");

        const video = videoRef.current;
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        // 📥 Cargar la imagen de referencia (silueta)
        const refImg = new Image();
        refImg.src = "/plantilla_silueta.png";
        refImg.onload = () => {
            const refCanvas = document.createElement("canvas");
            refCanvas.width = refImg.width;
            refCanvas.height = refImg.height;
            refCanvas.getContext("2d").drawImage(refImg, 0, 0);

            const refMat = cv.imread(refCanvas);
            cv.cvtColor(refMat, refMat, cv.COLOR_RGBA2GRAY);

            // 🔁 Comprobar cada 800 ms si hay coincidencia
            const checkFrame = () => {
                if (!video || video.readyState < 2) {
                    setTimeout(checkFrame, 800);
                    return;
                }

                // 🎥 Capturar frame
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                ctx.drawImage(video, 0, 0);

                const frame = cv.imread(canvas);
                cv.cvtColor(frame, frame, cv.COLOR_RGBA2GRAY);

                // 📊 Template Matching
                const result = new cv.Mat();
                cv.matchTemplate(frame, refMat, result, cv.TM_CCOEFF_NORMED);

                let minVal = { value: 0 };
                let maxVal = { value: 0 };
                let minLoc = { x: 0, y: 0 };
                let maxLoc = { x: 0, y: 0 };

                cv.minMaxLoc(result, minVal, maxVal, minLoc, maxLoc);

                console.log("📈 Nivel de coincidencia:", maxVal.value);

                if (maxVal.value > 0.70) { // 🎯 Ajusta el umbral (0.70 está bien para empezar)
                    console.log("✅ Plantilla detectada con suficiente coincidencia");
                    takePhoto();
                    frame.delete(); result.delete(); return;
                }

                frame.delete(); result.delete();
                setTimeout(checkFrame, 800);
            };

            checkFrame();
        };
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
                overflow: "hidden"
            }}
        >
            {/* 🎥 VIDEO DE LA CÁMARA */}
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

            {/* 🔲 SILUETA */}
            <img
                src="/plantilla_silueta.png"
                alt="Silueta de plantilla"
                style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    maxWidth: "70vw",
                    maxHeight: "70vh",
                    opacity: 0.5,
                    pointerEvents: "none",
                    zIndex: 1000
                }}
            />

            {/* ❌ BOTÓN CERRAR – AHORA ESTÁ “LIMPIO” Y ENCUDRADO */}
            <button
                onClick={onClose}
                style={{
                    position: "absolute",
                    top: "20px",
                    right: "20px",
                    padding: "8px 14px",
                    background: "rgba(255, 255, 255, 0.9)",
                    color: "#000",
                    fontSize: "22px",
                    fontWeight: "bold",
                    border: "none",
                    borderRadius: "8px",
                    boxShadow: "0 2px 6px rgba(0, 0, 0, 0.3)",
                    cursor: "pointer",
                    zIndex: 1001,
                    transition: "background 0.2s ease-in-out"
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,1)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.9)"}
            >
                ✕
            </button>
        </div>
    );
}
