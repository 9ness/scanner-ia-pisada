// components/CameraScanner.js
import { useEffect, useRef } from "react";

export default function CameraScanner({ onCapture, onClose }) {
  const videoRef   = useRef(null);
  const streamRef  = useRef(null);
  const overlayRef = useRef(null);     // canvas para dibujar overlay
  const path2DRef  = useRef(null);     // Path2D de la silueta
  const scaleRef   = useRef(1);
  const offXRef    = useRef(0);
  const offYRef    = useRef(0);

  /* ---------- 1. Cargar OpenCV una sola vez ---------- */
  useEffect(() => {
    if (window.cv) return;        // ya estaba
    const s = document.createElement("script");
    s.src   = "https://docs.opencv.org/4.7.0/opencv.js";
    document.body.appendChild(s);
  }, []);

  /* ---------- 2. Cargar SVG y construir Path2D ------- */
  useEffect(() => {
    fetch("/silueta.svg")
      .then(r => r.text())
      .then(text => {
        const svg   = new DOMParser().parseFromString(text, "image/svg+xml");
        const path  = svg.querySelector("path");
        const vb    = svg.querySelector("svg").getAttribute("viewBox").split(/\s+/);
        const vbH   = parseFloat(vb[3]);            // alto original
        path2DRef.current = new Path2D(path.getAttribute("d"));
        scaleRef.current  = vbH;                    // guardamos para luego
      })
      .catch(console.error);
  }, []);

  /* ---------- 3. Encender cámara --------------------- */
  useEffect(() => {
    (async () => {
      try {
        const st = await navigator.mediaDevices.getUserMedia({
          video: { facingMode:{ideal:"environment"}, width:{ideal:1920}, height:{ideal:1080} }
        });
        streamRef.current = st;
        if (videoRef.current) videoRef.current.srcObject = st;
      } catch (e) { console.error("❌ Cámara:", e); }
    })();
    return () => streamRef.current?.getTracks().forEach(t=>t.stop());
  }, []);

  /* ---------- 4. Bucle de detección ------------------ */
  useEffect(() => {
    const idDebug = "testInfo";
    if (!document.getElementById(idDebug)) {
      const dbg = document.createElement("div");
      dbg.id = idDebug;
      Object.assign(dbg.style, {
        position:"absolute",top:"18px",left:"18px",zIndex:10002,
        fontFamily:"monospace",fontSize:"15px",
        background:"rgba(0,0,0,.55)",color:"#fff",padding:"6px 10px",
        borderRadius:"8px",whiteSpace:"pre"
      });
      document.body.appendChild(dbg);
    }

    let running = true;
    const loop = () => {
      if (!running) return;
      const vid  = videoRef.current;
      const cv   = window.cv;
      const p2d  = path2DRef.current;
      const ov   = overlayRef.current;
      if (!vid || !cv || !p2d || vid.readyState<2) {
        requestAnimationFrame(loop); return;
      }

      /* --- preparar canvas tamaño vídeo --- */
      const W = vid.videoWidth , H = vid.videoHeight;
      ov.width  = W; ov.height = H;
      const ctx = ov.getContext("2d");

      /* --------- dibujar overlay ------------- */
      ctx.clearRect(0,0,W,H);
      ctx.fillStyle = "rgba(0,0,0,.55)";
      ctx.fillRect(0,0,W,H);

      /* cálculo de escala+offset sólo 1ª vez */
      if (scaleRef.current && !offXRef.current) {
        const scl = (H*0.7)/scaleRef.current;   // 70 % de alto visible
        scaleRef.current = scl;
        offYRef.current  = H*0.15;
        offXRef.current  = (W - scaleRef.current*scaleRef.current)/2; // viewBox cuadrado
      }
      ctx.save();
      ctx.translate(offXRef.current, offYRef.current);
      ctx.scale(scaleRef.current, scaleRef.current);
      ctx.globalCompositeOperation="destination-out";
      ctx.fill(p2d);              // agujero
      ctx.globalCompositeOperation="source-over";
      ctx.lineWidth = 6/scaleRef.current;
      ctx.strokeStyle="#00ff80";
      ctx.stroke(p2d);
      ctx.restore();

      /* --------- máscara blanca para conteo -------- */
      const mask = ctx.getImageData(0,0,W,H).data; // 4-component RGBA

      /* --------- frame → OpenCV -------------------- */
      const frame = cv.imread(vid);          // RGBA
      const gray  = new cv.Mat(); cv.cvtColor(frame, gray, cv.COLOR_RGBA2GRAY);
      const edges = new cv.Mat(); cv.Canny(gray, edges, 60,120);
      frame.delete(); gray.delete();

      /* ---- contar bordes dentro / fuera ---------- */
      const edgeData = edges.data;
      let total=0, inside=0;
      for (let i=0;i<edgeData.length;i++) {
        if (edgeData[i]) {
          total++;
          if (mask[i*4]===0) inside++;          // transparente => interior
        }
      }
      edges.delete();

      const outside = total - inside;
      document.getElementById(idDebug).textContent =
        `📈 TEST INFO\n📏 Bordes: ${total}\n✅ Dentro: ${inside}\n❌ Fuera: ${outside}`;

      /* --- decisión --- */
      if (total>120 && inside/total > 0.70) {
        // flash verde
        ctx.save();
        ctx.translate(offXRef.current, offYRef.current);
        ctx.scale(scaleRef.current, scaleRef.current);
        ctx.lineWidth = 14/scaleRef.current;
        ctx.strokeStyle="#00ff55";
        ctx.stroke(p2d);
        ctx.restore();

        // snapshot
        const snap = document.createElement("canvas");
        snap.width = W; snap.height = H;
        snap.getContext("2d").drawImage(vid,0,0);
        snap.toBlob(onCapture,"image/jpeg",0.88);
        running = false; return;
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);

    return () => { running=false; };
  }, [onCapture]);

  /* ---------- render --------------------------------- */
  return (
    <div style={{position:"fixed",inset:0,zIndex:9999}}>
      <video ref={videoRef}
             autoPlay playsInline
             style={{width:"100%",height:"100%",objectFit:"cover"}} />
      <canvas ref={overlayRef}
              style={{position:"absolute",inset:0,pointerEvents:"none"}} />
      <button onClick={onClose}
              style={{position:"absolute",top:15,right:15,width:42,height:42,
                      borderRadius:"50%",background:"rgba(0,0,0,.55)",
                      color:"#fff",fontSize:26,border:"1px solid #fff",
                      zIndex:10003}}>✕</button>
    </div>
  );
}
