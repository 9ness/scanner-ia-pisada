import { useEffect } from "react";
import '../styles/globals.css';

export default function App({ Component, pageProps }) {
  useEffect(() => {
    // Evita cargar OpenCV dos veces
    if (!document.getElementById('opencv-script')) {
      const script = document.createElement("script");
      script.id = "opencv-script";
      script.src = "https://docs.opencv.org/4.7.0/opencv.js";
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  return <Component {...pageProps} />;
}
