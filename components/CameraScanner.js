import { useEffect, useRef, useState } from "react";

export default function CameraScanner({ onCapture, onClose }) {
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const [opencvReady, setOpencvReady] = useState(false);

    // ✅ 1. Cargar OpenCV una vez
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
                        facingMode: { ideal: "environment" }, // cámara trasera
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

    // ✅ 3. Tomar foto desde el stream
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

    // ✅ 4. Detección automática con OpenCV Template Matching
    useEffect(() => {
        if (!opencvReady) return;

        console.log("[CameraScanner] 🚀 OpenCV listo → activando detección");

        const video = videoRef.current;
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        // 📥 Cargar la silueta como imagen de referencia
        const refImg = new Image();
        refImg.src = "/plantilla_silueta.png";
        refImg.onload = () => {
            const refCanvas = document.createElement("canvas");
            refCanvas.width = refImg.width;
            refCanvas.height = refImg.height;
            refCanvas.getContext("2d").drawImage(refImg, 0, 0);

            const refMat = cv.imread(refCanvas);
            cv.cvtColor(refMat, refMat, cv.COLOR_RGBA2GRAY);

            // 🔄 Función de comprobación continua
            const checkFrame = () => {
                if (!video || video.readyState < 2) {
                    setTimeout(checkFrame, 800);
                    return;
                }

                // 🎥 Capturar frame de la cámara
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                ctx.drawImage(video, 0, 0);

                const frame = cv.imread(canvas);
                cv.cvtColor(frame, frame, cv.COLOR_RGBA2GRAY);

                // 🔍 Template Matching
                const result = new cv.Mat();
                cv.matchTemplate(frame, refMat, result, cv.TM_CCOEFF_NORMED);

                let minVal = { value: 0 };
                let maxVal = { value: 0 };
                let minLoc = { x: 0, y: 0 };
                let maxLoc = { x: 0, y: 0 };
                cv.minMaxLoc(result, minVal, maxVal, minLoc, maxLoc);

                console.log("📊 Nivel de coincidencia:", maxVal.value.toFixed(2));

                // 🎯 Si pasa del umbral (0.70), dispara foto
                if (maxVal.value > 0.70) {
                    console.log("✅ Plantilla detectada (MATCH > 0.70)");
                    takePhoto();
                    frame.delete();
                    result.delete();
                    return;
                }

                frame.delete();
                result.delete();
                setTimeout(checkFrame, 800); // volver a comprobar
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

            {/* 🔲 SILUETA – MÁS GRANDE (80% de la pantalla) */}
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
                    opacity: 0.55,
                    pointerEvents: "none",
                    zIndex: 1000
                }}
            />

            {/* ❌ BOTÓN CERRAR (pegado a la esquina) */}
            <button
                onClick={onClose}
                style={{
                    position: "absolute",
                    top: "12px",
                    right: "12px",
                    width: "40px",
                    height: "40px",
                    borderRadius: "50%",
                    background: "rgba(0, 0, 0, 0.6)",
                    color: "#fff",
                    fontSize: "22px",
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
