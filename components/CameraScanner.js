import { useEffect, useRef, useState } from "react";

export default function CameraScanner({ onCapture, onClose }) {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [opencvReady, setOpencvReady] = useState(false);
    const [templateContours, setTemplateContours] = useState(null);

    useEffect(() => {
        // 1️⃣ Abrir cámara
        navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
            .then(stream => {
                console.log("✅ Cámara iniciada", stream);
                if (videoRef.current) videoRef.current.srcObject = stream;
            })
            .catch(err => console.error("❌ Error abriendo cámara", err));

        // 2️⃣ Esperar a que OpenCV esté cargado desde _app.js
        const checkOpenCV = setInterval(() => {
            if (window.cv) {
                setOpencvReady(true);
                clearInterval(checkOpenCV);
            }
        }, 100);

        // 3️⃣ Cleanup: parar la cámara y limpiar intervalos
        return () => {
            if (videoRef.current?.srcObject) {
                videoRef.current.srcObject.getTracks().forEach(track => track.stop());
            }
            clearInterval(checkOpenCV);
        };
    }, []);


    // 🔵 Cargar silueta como referencia
    useEffect(() => {
        if (!opencvReady) return;

        const img = new Image();
        img.src = "/plantilla_silueta.png";
        img.onload = () => {
            const tempCanvas = document.createElement("canvas");
            tempCanvas.width = img.width;
            tempCanvas.height = img.height;
            const ctx = tempCanvas.getContext("2d");
            ctx.drawImage(img, 0, 0);

            let src = cv.imread(tempCanvas);
            let gray = new cv.Mat();
            let edges = new cv.Mat();
            cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
            cv.Canny(gray, edges, 50, 150);

            let contours = new cv.MatVector();
            let hierarchy = new cv.Mat();
            cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
            if (contours.size() > 0) {
                setTemplateContours(contours.get(0));
            }

            src.delete(); gray.delete(); edges.delete(); hierarchy.delete();
        };
    }, [opencvReady]);

    // 🔄 Escanear cada 300ms para ver si la plantilla encaja
    useEffect(() => {
        if (!opencvReady || !templateContours) return;

        const interval = setInterval(() => {
            detectarEncaje();
        }, 300);

        return () => clearInterval(interval);
    }, [opencvReady, templateContours]);

    const detectarEncaje = () => {
        const canvas = canvasRef.current;
        const video = videoRef.current;
        if (!canvas || !video) return;

        const ctx = canvas.getContext("2d");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        let src = cv.imread(canvas);
        let gray = new cv.Mat();
        let edges = new cv.Mat();
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
        cv.Canny(gray, edges, 50, 150);

        let contours = new cv.MatVector();
        let hierarchy = new cv.Mat();
        cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

        if (contours.size() > 0) {
            let biggest = contours.get(0);
            for (let i = 1; i < contours.size(); i++) {
                if (cv.contourArea(contours.get(i)) > cv.contourArea(biggest)) {
                    biggest = contours.get(i);
                }
            }

            // 🔍 Comparar forma detectada con la silueta
            let similarity = cv.matchShapes(templateContours, biggest, cv.CONTOURS_MATCH_I1, 0);

            if (similarity < 0.15) {  // Ajusta el umbral si dispara demasiado pronto
                capturarFoto();
            }
        }

        src.delete(); gray.delete(); edges.delete(); contours.delete(); hierarchy.delete();
    };

    const capturarFoto = () => {
        const canvas = canvasRef.current;
        canvas.toBlob(blob => {
            if (onCapture) onCapture(blob);
        }, "image/jpeg", 0.9);
    };

    return (
        <div className="camera-wrapper">
            {/* VIDEO de la cámara */}
            <video ref={videoRef} autoPlay playsInline muted className="camera-feed" />

            {/* SILUETA sobre el vídeo */}
            <img src="/plantilla_silueta.png" alt="Silueta guía" className="foot-overlay" />

            {/* BOTÓN de cerrar */}
            <button onClick={onClose} className="close-btn">✖</button>

            {/* CANVAS oculto para procesar los frames */}
            <canvas ref={canvasRef} style={{ display: "none" }}></canvas>
        </div>
    );
}
