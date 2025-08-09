// prompts/analisisPisadaV1o4.js
const analisisPisada = `
analiza la imagen de una plantilla de pie usada.

regla de descarte (muy estricta):
• no descartes por sombras suaves, viñeteado, brillos o compresión. si la foto parece real pero la luz es mala, analiza igual y baja la confianza.
• responde "descartada" solo si: (a) no es una plantilla real de pie; (b) es dibujo/ia; o (c) no se aprecian señales de uso en absoluto.

salida (formato exacto, todo en minúsculas, sin texto extra):
• escribe únicamente las zonas de mayor presión, una por línea, usando solo: dedos | metatarsos | arco | exterior | talón
• si hay varias zonas, ordénalas de mayor a menor evidencia.
• añade una línea con únicamente: "izquierdo" o "derecho"
• añade una última línea con únicamente: "confianza: nn" (nn entero 1-100, sin %)

notas:
• si hay duda razonable, elige la opción más probable y refleja la incertidumbre solo bajando la confianza. no añadas explicaciones.
`;
export default analisisPisada;
