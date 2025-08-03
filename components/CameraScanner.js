import { useEffect, useRef, useState } from "react";

export default function CameraScanner({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const processCanvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const maskCanvasRef = useRef(null);
  const streamRef = useRef(null);
  const siluetaImgRef = useRef(null);

  const [stats, setStats] = useState({ bordes: 0, dentro: 0, fuera: 0 });

  useEffect(() => {
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } }
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
      if (!videoRef.current || !siluetaImgRef.current) return;

      const video = videoRef.current;
      const processCanvas = processCanvasRef.current;
      const overlayCanvas = overlayCanvasRef.current;
      const maskCanvas = maskCanvasRef.current;

      const ctx = processCanvas.getContext("2d");
      processCanvas.width = video.videoWidth;
      processCanvas.height = video.videoHeight;

      ctx.drawImage(video, 0, 0, processCanvas.width, processCanvas.height);

      // --- OpenCV: BORDES ---
      const src = new cv.Mat(processCanvas.height, processCanvas.width, cv.CV_8UC4);
      const gray = new cv.Mat();
      const edges = new cv.Mat();

      cv.imread(processCanvas, src);
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
      cv.Canny(gray, edges, 50, 150);

      // --- DIBUJAR OVERLAY OSCURO ---
      const oCtx = overlayCanvas.getContext("2d");
      overlayCanvas.width = video.videoWidth;
      overlayCanvas.height = video.videoHeight;

      oCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

      // Fondo oscuro completo
      oCtx.fillStyle = "rgba(0,0,0,0.6)";
      oCtx.fillRect(0, 0, overlayCanvas.width, overlayCanvas.height);

      // Recortamos el interior de la silueta
      const siluetaWidth = overlayCanvas.height * 0.70;
      const siluetaHeight = overlayCanvas.height * 0.70;
      const siluetaX = overlayCanvas.width / 2 - siluetaWidth / 2;
      const siluetaY = overlayCanvas.height * 0.15;

      oCtx.globalCompositeOperation = "destination-out";
      oCtx.drawImage(siluetaImgRef.current, siluetaX, siluetaY, siluetaWidth, siluetaHeight);
      oCtx.globalCompositeOperation = "source-over";

      // --- PREPARAR MÁSCARA (solo para detección)
      const mCtx = maskCanvas.getContext("2d");
      maskCanvas.width = video.videoWidth;
      maskCanvas.height = video.videoHeight;
      mCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
      mCtx.drawImage(siluetaImgRef.current, siluetaX, siluetaY, siluetaWidth, siluetaHeight);
      const maskData = mCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height).data;

      // --- DETECCIÓN REAL ---
      let dentro = 0;
      let fuera = 0;

      for (let y = 0; y < edges.rows; y++) {
        for (let x = 0; x < edges.cols; x++) {
          if (edges.ucharPtr(y, x)[0] > 0) {
            const idx = (y * edges.cols + x) * 4 + 3; // alfa del pixel
            const alpha = maskData[idx];
            if (alpha > 10) {
              // el pixel de la silueta tiene algo de opacidad
              dentro++;
            } else {
              fuera++;
            }
          }
        }
      }

      setStats({ bordes: dentro + fuera, dentro, fuera });

      // --- CAPTURA AUTOMÁTICA ---
      if (dentro > 1000 && fuera < 500) {
        takePhoto();
      }

      src.delete(); gray.delete(); edges.delete();
    };

    interval = setInterval(processFrame, 700);
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

      {/* CANVAS PROCESO Y OVERLAY */}
      <canvas ref={processCanvasRef} style={{ display: "none" }} />
      <canvas ref={overlayCanvasRef} style={styles.overlay} />
      <canvas ref={maskCanvasRef} style={{ display: "none" }} />

      {/* PNG DE LA SILUETA (oculto) */}
      <img
        ref={siluetaImgRef}
        src="/plantilla_silueta.png"
        style={{ display: "none" }}
        alt="silueta"
      />

      {/* BOTÓN CERRAR */}
      <button onClick={onClose} style={styles.closeBtn}>✕</button>

      {/* INFO */}
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
