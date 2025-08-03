import { useEffect, useRef, useState } from "react";

export default function CameraScanner({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const [stats, setStats] = useState({ bordes: 0, dentro: 0, fuera: 0 });
  const [highlight, setHighlight] = useState(false);

  useEffect(() => {
    let stream;
    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
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
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    let interval;
    const processFrame = () => {
      if (!videoRef.current) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Dibuja frame de la cámara en el canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // ---- OpenCV DETECCIÓN ----
      const src = new cv.Mat(canvas.height, canvas.width, cv.CV_8UC4);
      const gray = new cv.Mat();
      const edges = new cv.Mat();

      cv.imread(canvas, src);
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
      cv.Canny(gray, edges, 50, 150);

      // ----- CONTEO DE PIXELES -----
      let dentro = 0;
      let fuera = 0;
      for (let y = 0; y < edges.rows; y++) {
        for (let x = 0; x < edges.cols; x++) {
          if (edges.ucharPtr(y, x)[0] > 0) {
            // calculamos si está dentro de la silueta
            if (isInsideSilhouette(x, y, edges.cols, edges.rows)) {
              dentro++;
            } else {
              fuera++;
            }
          }
        }
      }

      setStats({ bordes: dentro + fuera, dentro, fuera });

      // ---- DISPARO AUTOMÁTICO ----
      if (dentro > 1200 && fuera < 2500) {
        setHighlight(true);
        setTimeout(() => {
          takePhoto();
          setHighlight(false);
        }, 500);
      }

      src.delete(); gray.delete(); edges.delete();
    };

    interval = setInterval(processFrame, 700);
    return () => clearInterval(interval);
  }, []);

  function isInsideSilhouette(x, y, w, h) {
    // simulamos silueta: ocupa centro, 60% ancho y 70% alto
    const sx = w * 0.2;
    const ex = w * 0.8;
    const sy = h * 0.15;
    const ey = h * 0.85;
    return x > sx && x < ex && y > sy && y < ey;
  }

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
      {/* VIDEO */}
      <video ref={videoRef} autoPlay playsInline style={styles.video} />

      {/* CANVAS AUX PARA PROCESO */}
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {/* MÁSCARA OSCURA */}
      <div
        style={{
          ...styles.overlay,
          backgroundColor: highlight ? "rgba(0,255,0,0.2)" : "rgba(0,0,0,0.5)",
        }}
      >
        <div style={styles.cutout}></div>
      </div>

      {/* PNG DE SILUETA */}
      <img
        src="/plantilla_silueta.png"
        alt="Silueta plantilla"
        style={styles.silueta}
      />

      {/* BOTÓN CERRAR */}
      <button onClick={onClose} style={styles.closeBtn}>
        ✕
      </button>

      {/* CAJA DE TEST */}
      <div style={styles.statsBox}>
        📊 <b>TEST INFO</b>
        <br />
        📏 Bordes: {stats.bordes}
        <br />
        ✅ Dentro: {stats.dentro}
        <br />
        ❌ Fuera: {stats.fuera}
      </div>
    </div>
  );
}

const styles = {
  container: {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100vw",
    height: "100vh",
    background: "black",
    zIndex: 9999,
  },
  video: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    position: "absolute",
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    backdropFilter: "none",
  },
  cutout: {
    position: "absolute",
    top: "15%",
    left: "20%",
    width: "60%",
    height: "70%",
    boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)",
    borderRadius: "40% / 50%",
    pointerEvents: "none",
  },
  silueta: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    height: "70%",
    zIndex: 10,
    opacity: 0.6,
  },
  closeBtn: {
    position: "absolute",
    top: 20,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: "50%",
    background: "rgba(0, 0, 0, 0.6)",
    color: "white",
    fontSize: 24,
    border: "1px solid white",
    cursor: "pointer",
    zIndex: 1000,
  },
  statsBox: {
    position: "absolute",
    top: 20,
    left: 20,
    padding: "8px 12px",
    background: "rgba(0,0,0,0.7)",
    color: "white",
    fontSize: "14px",
    borderRadius: "8px",
    zIndex: 1000,
    lineHeight: "18px",
  },
};
