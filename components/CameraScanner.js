import { useEffect, useRef, useState } from "react";

export default function CameraScanner({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const maskCanvasRef = useRef(null);
  const streamRef = useRef(null);
  const siluetaImg = useRef(new Image());

  const [stats, setStats] = useState({ bordes: 0, dentro: 0, fuera: 0 });

  useEffect(() => {
    // 🚀 Precargamos la silueta
    siluetaImg.current.src = "/plantilla_silueta.png";
    siluetaImg.current.onload = () => console.log("✅ Silueta cargada");

    // 🎥 Iniciamos cámara
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment",
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        });
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      } catch (err) {
        console.error("❌ Error cámara:", err);
      }
    }
    startCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  useEffect(() => {
    let interval;
    const processFrame = () => {
      if (!videoRef.current || !siluetaImg.current.complete) return;

      const video = videoRef.current;
      const overlayCanvas = overlayCanvasRef.current;
      const maskCanvas = maskCanvasRef.current;

      overlayCanvas.width = video.videoWidth;
      overlayCanvas.height = video.videoHeight;
      maskCanvas.width = video.videoWidth;
      maskCanvas.height = video.videoHeight;

      const oCtx = overlayCanvas.getContext("2d");
      const mCtx = maskCanvas.getContext("2d");

      // 📐 Calculamos tamaño y posición de la silueta
      const siluetaWidth = overlayCanvas.height * 0.70;
      const siluetaHeight = overlayCanvas.height * 0.70;
      const siluetaX = overlayCanvas.width / 2 - siluetaWidth / 2;
      const siluetaY = overlayCanvas.height * 0.15;

      // 🖤 Fondo oscuro en toda la pantalla
      oCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
      oCtx.fillStyle = "rgba(0,0,0,0.6)";
      oCtx.fillRect(0, 0, overlayCanvas.width, overlayCanvas.height);

      // ✂️ “Recortamos” el interior del PNG (queda claro)
      oCtx.globalCompositeOperation = "destination-out";
      oCtx.drawImage(siluetaImg.current, siluetaX, siluetaY, siluetaWidth, siluetaHeight);
      oCtx.globalCompositeOperation = "source-over";

      // 📊 Creamos la máscara para detección
      mCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
      mCtx.drawImage(siluetaImg.current, siluetaX, siluetaY, siluetaWidth, siluetaHeight);
      const maskData = mCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height).data;

      // 📸 Procesamos el video frame con OpenCV
      const processCanvas = document.createElement("canvas");
      processCanvas.width = video.videoWidth;
      processCanvas.height = video.videoHeight;
      const pCtx = processCanvas.getContext("2d");
      pCtx.drawImage(video, 0, 0);

      const src = new cv.Mat(processCanvas.height, processCanvas.width, cv.CV_8UC4);
      const gray = new cv.Mat();
      const edges = new cv.Mat();
      cv.imread(processCanvas, src);
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
      cv.Canny(gray, edges, 50, 150);

      let dentro = 0;
      let fuera = 0;

      for (let y = 0; y < edges.rows; y++) {
        for (let x = 0; x < edges.cols; x++) {
          if (edges.ucharPtr(y, x)[0] > 0) {
            const idx = (y * edges.cols + x) * 4 + 3; // alfa
            const alpha = maskData[idx];
            if (alpha > 50) {
              dentro++;
            } else {
              fuera++;
            }
          }
        }
      }

      setStats({ bordes: dentro + fuera, dentro, fuera });

      // 📷 CAPTURA AUTOMÁTICA si hay coincidencia real
      if (dentro > 1200 && fuera < 800) {
        takePhoto();
      }

      src.delete(); gray.delete(); edges.delete();
    };

    interval = setInterval(processFrame, 300);
    return () => clearInterval(interval);
  }, []);

  function takePhoto() {
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(videoRef.current, 0, 0);
    const imageData = canvas.toDataURL("image/jpeg");
    onCapture(imageData);
    onClose();
  }

  return (
    <div style={styles.container}>
      <video ref={videoRef} autoPlay playsInline style={styles.video} />

      {/* CANVAS DE OVERLAY Y MÁSCARA */}
      <canvas ref={overlayCanvasRef} style={styles.overlay} />
      <canvas ref={maskCanvasRef} style={{ display: "none" }} />

      {/* BOTÓN CERRAR */}
      <button onClick={onClose} style={styles.closeBtn}>✕</button>

      {/* INFO TEST */}
      <div style={styles.statsBox}>
        📊 <b>TEST INFO</b><br />
        📏 Bordes: {stats.bordes}<br />
        ✅ Dentro: {stats.dentro}<br />
        ❌ Fuera: {stats.fuera}
      </div>
    </div>
  );
}

const styles = {
  container: { position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", background: "black", zIndex: 9999 },
  video: { width: "100%", height: "100%", objectFit: "cover", position: "absolute" },
  overlay: { width: "100%", height: "100%", position: "absolute", top: 0, left: 0, pointerEvents: "none" },
  closeBtn: { position: "absolute", top: 20, right: 20, width: 40, height: 40, borderRadius: "50%", background: "rgba(0,0,0,0.6)", color: "white", fontSize: 24, border: "1px solid white", cursor: "pointer", zIndex: 1000 },
  statsBox: { position: "absolute", top: 20, left: 20, padding: "8px 12px", background: "rgba(0,0,0,0.7)", color: "white", fontSize: "14px", borderRadius: "8px", zIndex: 1000, lineHeight: "18px" }
};
