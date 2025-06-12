const analisisPisada = `
Analiza la imagen suministrada y decide primero si es una fotografía real de una plantilla (insole) de pisada.

──────────────────── PASO 1 · FILTRO ────────────────────
Responde exactamente «descartada» y termina SOLO si se cumple AL MENOS uno de:
1. El objeto NO es una plantilla (suela exterior, zapato lateral, pie, mano, silueta, etc.).
2. Plantilla 100 % nueva: sin NINGÚN cambio de tono, brillo, arruga ni mancha.
3. Film o plástico protector sobre la zona de apoyo.
4. Imagen generada/ilustración o foto tan borrosa que impide ver texturas.

➡ Si hay cualquier señal de uso, aunque sea mínima, pasa al PASO 2.

──────────────────── PASO 2 · ANÁLISIS FINO ───────────────────
> **Consistencia máxima**: 7 evaluaciones idénticas (E1…E7) · voto 4-de-7.

0. Normaliza (talón abajo, dedos arriba, eje vertical).

1. **Parámetros fijos por evaluación**  
   • Rejilla: 10 filas × 50 columnas.  
   • Un bloque es *gastado* si cumple ≥ 1 de:  
     A) ΔE ≥ 3   B) brillo/pulido alto   C) hundimiento/sombra   D) suciedad > 2 px².

2. Ejecuta E1…E7.  

3. **Voto de bloques**  
   • «Gastado confiable» si el bloque está gastado en ≥ 4 de 7 evaluaciones.

4. **Proyección a franjas fijas (20 % de altura)**  
   ① dedos ② metatarsos ③ arco ④ exterior ⑤ talón  
   • Una franja tiene desgaste si ≥ 12 % de sus bloques son «gastado confiable».

5. **Regla decisoria metatarsos vs arco (antiduda)**  
   • Si metatarsos ≥ 12 % y arco < 12 % → marca metatarsos.  
   • Si arco ≥ 12 % y metatarsos < 12 % → marca arco.  
   • **Si ambas ≥ 12 %**:  
       – Calcula Δ = %desgaste_arco − %desgaste_metatarsos.  
       – **Si Δ ≥ 10 p.p. → marca arco y metatarsos.**  
       – **Si Δ < 10 p.p. → marca SOLO metatarsos, NO marques arco.**

6. **Listado final de zonas**  
   • Ordena las zonas marcadas por % de desgaste (alto→bajo); en empate usa el orden dedos > metatarsos > arco > exterior > talón.  
   • Escribe SOLO los nombres exactos, una por línea.

7. **Lado del pie** («izquierdo» / «derecho»)  
   • Rasgo a la derecha → pie izquierdo; a la izquierda → pie derecho.  
   • ≥ 3 rasgos coinciden → ese lado; empate 2-2 + 1 dudoso → decide con arco + dedo gordo; duda final → lado con más desgaste delante y resta −10 p a eficacia.

8. **Eficacia**  
   • Empieza en 100.  
   • −10 p por cada rasgo anatómico no coincidente (máx 50).  
   • −5 p por cada zona listada con < 25 % de bloques gastados.  
   • −10 p si hubo duda final o la foto es poco nítida.  
   • Limita 0-100 y redondea. Formato exacto:"eficacia NN%".

──────────────────── FORMATO DE SALIDA ───────────────────
(Emite estrictamente estas líneas, sin texto adicional)

<zona 1>  
<zona 2>  
…  
<izquierdo | derecho>  
eficacia NN%
`;

export default analisisPisada;