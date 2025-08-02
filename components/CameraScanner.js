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

    useEffect(() => {
        if (!opencvReady) return;
        console.log("✅ OpenCV cargado, iniciando detección automática");

        const video = videoRef.current;
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        const checkFrame = () => {
            if (!video) return;

            // Dibujamos frame en canvas
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            // Aquí simplificamos: convertimos a escala de grises y detectamos bordes
            const src = new cv.Mat(canvas.height, canvas.width, cv.CV_8UC4);
            const dst = new cv.Mat();
            cv.imread(canvas, src);
            cv.cvtColor(src, src, cv.COLOR_RGBA2GRAY);
            cv.Canny(src, dst, 50, 150);

            // 📌 En este punto podríamos buscar la silueta (template matching)
            // de momento solo hacemos un contador simple de bordes
            let whitePixels = cv.countNonZero(dst);

            if (whitePixels > 15000) {  // umbral ajustable
                console.log("📸 DETECCIÓN CORRECTA → foto tomada");
                takePhoto();   // tu función para sacar la foto
                return;
            }

            src.delete(); dst.delete();

            // 🔄 chequea cada 500 ms
            setTimeout(checkFrame, 500);
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
                alt="Silueta de plantilla"
                style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    width: "auto",
                    height: "70%",       // ⬅️ usa el 70% de la pantalla
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
                    width: "40px",
                    height: "40px",
                    borderRadius: "50%",
                    background: "rgba(0, 0, 0, 0.5)",   // fondo discreto
                    color: "white",
                    fontSize: "24px",
                    border: "1px solid rgba(255, 255, 255, 0.8)",  // borde fino
                    cursor: "pointer",
                    zIndex: 1001
                }}
            >
                ✕✕
            </button>

        </div>
    );
}
