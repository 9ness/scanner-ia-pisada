import { useEffect, useRef, useState } from "react";

export default function CameraScanner({ onCapture, onClose }) {
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const [opencvReady, setOpencvReady] = useState(false);

    useEffect(() => {
        // 📥 Cargar OpenCV
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

        // 🛑 Apagar cámara al cerrar
        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach((track) => track.stop());
            }
        };
    }, []);

    // 📸 Tomar foto
    const takePhoto = () => {
        const video = videoRef.current;
        if (!video) return;

        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(video, 0, 0);

        canvas.toBlob((blob) => {
            console.log("📸 FOTO AUTOMÁTICA REALIZADA");
            onCapture(blob);
        }, "image/jpeg");
    };

    useEffect(() => {
        if (!opencvReady) return;

        console.log("[CameraScanner] 🚀 Detección activada (modo DNI)");

        const video = videoRef.current;
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        // 📥 Cargar la silueta (template)
        const refImg = new Image();
        refImg.src = "/plantilla_silueta.png";
        refImg.onload = () => {
            console.log("✅ Silueta cargada");
            const refCanvas = document.createElement("canvas");
            refCanvas.width = refImg.width;
            refCanvas.height = refImg.height;
            refCanvas.getContext("2d").drawImage(refImg, 0, 0);

            const refMat = cv.imread(refCanvas);
            cv.cvtColor(refMat, refMat, cv.COLOR_RGBA2GRAY);

            // 🔄 Loop de comprobación
            const checkFrame = () => {
                if (!video || video.readyState < 2) {
                    setTimeout(checkFrame, 500);
                    return;
                }

                // 📸 Capturamos frame actual
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                ctx.drawImage(video, 0, 0);

                // 🔍 Convertimos a escala de grises
                const frame = cv.imread(canvas);
                cv.cvtColor(frame, frame, cv.COLOR_RGBA2GRAY);

                // 📐 MatchTemplate para ver si encaja con la silueta
                const result = new cv.Mat();
                cv.matchTemplate(frame, refMat, result, cv.TM_CCOEFF_NORMED);

                // 📊 Obtenemos mejor coincidencia
                let minVal = { value: 0 };
                let maxVal = { value: 0 };
                let minLoc = { x: 0, y: 0 };
                let maxLoc = { x: 0, y: 0 };
                cv.minMaxLoc(result, minVal, maxVal, minLoc, maxLoc);

                console.log("📊 Nivel de coincidencia:", maxVal.value.toFixed(2));

                // 🎯 Ajusta el umbral según pruebas (0.50-0.70)
                if (maxVal.value > 0.55) {
                    console.log("✅ Plantilla detectada dentro de la silueta → TOMANDO FOTO");
                    takePhoto();

                    // 🧹 Liberamos memoria y detenemos la detección
                    frame.delete();
                    result.delete();
                    return;
                }

                frame.delete();
                result.delete();

                // 🔄 Repetimos cada 700ms
                setTimeout(checkFrame, 700);
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
                    maxWidth: "75vw",
                    maxHeight: "75vh",
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
