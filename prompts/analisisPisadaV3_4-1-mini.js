const analisisPisada = `
Analiza la imagen suministrada y decide primero si es una fotografía real de una plantilla (insole) de pisada.

──────────────────────── PASO 1 · FILTRO ───────────────────────
Devuelve **solo** la palabra   descartada   y termina **si** se cumple AL MENOS uno de:
1. El objeto NO es una plantilla (suela exterior, zapato de lado, pie, mano, silueta, etc.).
2. Plantilla 100 % nueva: ningún cambio de tono, brillo, arruga ni mancha (0 % uso visible).
3. Film/plástico protector sobre la superficie de apoyo.
4. Imagen generada/ilustración o fotografía tan borrosa/oscura que impide ver texturas.

► **Si existe cualquier señal de uso, incluso mínima, pasa al PASO 2.**

──────────────────── PASO 2 · ANÁLISIS FINO ───────────────────
> **Consistencia máxima**: 7 evaluaciones idénticas (E1…E7) · voto 4-de-7 · 0 elementos aleatorios.

0. **Normaliza** la orientación (talón abajo, dedos arriba, eje vertical).

1. **Parámetros fijos para TODAS las evaluaciones**  
   • Rejilla: 10 filas × 50 columnas.  
   • Un bloque se marca *gastado* si cumple ≥ 1 de:  
     A) ΔE ≥ 3 (decoloración leve)  
     B) brillo/pulido alto (contraste RMS > media + 0,8 σ)  
     C) hundimiento/sombra (varianza > media + 0,3 σ)  
     D) suciedad/mancha continua > 2 px².  

2. Ejecuta E1…E7 con los mismos parámetros.

3. **Voto de bloques** – bloque **“gastado confiable”** si está gastado en ≥ 4 de 7 evaluaciones.

4. **Agrupación en franjas horizontales fijas**  
   Altura total ÷ 5 →  
   ① dedos (0-20 %) ② metatarsos (20-40 %) ③ arco (40-60 %) ④ exterior (60-80 %) ⑤ talón (80-100 %).  
   • Una franja tiene desgaste si ≥ 12 % de sus bloques son «gastado confiable».

5. **Eliminación de ambigüedades entre franjas contiguas**  
   (evita que la misma imagen oscile entre metatarsos y arco)  
   • Para cada par adyacente, si |% bloques gastados| ≤ 3 p.p. ⇒ conserva SOLO la franja con prioridad mayor en la tabla:  
     **prioridad:** dedos > metatarsos > arco > exterior > talón.  

6. **Listado final de zonas**  
   • Ordena las franjas con desgaste por % bloques gastados (alto→bajo); ante empate usa la prioridad ①→⑤.  
   • **Escribe exactamente** los nombres de esas franjas, **una por línea, sin repetir, sin texto extra**.  
   • Si ninguna franja supera el 12 %, escribe la que tenga mayor % (mínimo 1).

7. **Lado del pie** («izquierdo» / «derecho»)  
   • Evalúa 5 rasgos anatómicos (arco, dedo gordo, borde interno, borde externo, desgaste inicial talón).  
     Rasgo a la **derecha** ⇒ pie izquierdo · a la **izquierda** ⇒ pie derecho.  
   • ≥ 3 rasgos → ese lado.  
   • Empate 2-2 + 1 dudoso → decide con arco + dedo gordo.  
   • Duda persistente → lado con mayor % de bloques gastados en la mitad anterior (dedos + metatarsos); –10 p a eficacia.

8. **Eficacia**  
   • Empieza en 100.  
   • –10 p por cada rasgo anatómico no coincidente (máx −50).  
   • –5 p por cada franja listada con < 25 % de bloques gastados.  
   • –10 p si hubo desempate final o la foto presenta ruido/borrosidad.  
   • Limita 0-100, redondea al entero, formatea así: "eficacia NN%".

──────────────────── FORMATO DE SALIDA ───────────────────
(Emite ÚNICAMENTE el bloque siguiente, sin texto adicional)

<zona 1>  
<zona 2>  
…  
<izquierdo | derecho>  
eficacia NN% 
`;

export default analisisPisada;