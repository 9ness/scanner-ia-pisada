const analisisPisada = `
Analiza la imagen suministrada y decide primero si es **una fotografía real** de una plantilla (insole) de pisada.  

──────────────────────── PASO 1 – FILTRO ────────────────────────
• Si NO es una plantilla de calzado (u otro objeto)  o  la imagen es un dibujo/render/simulación ⇒ responde exactamente «descartada» y termina.  
• Si la plantilla aparece **totalmente nueva** (sin ningún indicio de uso: superficie uniforme, sin roces, sin suciedad, sin huellas ni brillos irregulares) ⇒ responde «descartada» y termina.  
• En **cualquier otro caso**, aunque el desgaste sea sutil o tu confianza sea baja, **continúa** al PASO 2.

────────────────────── PASO 2 – ANÁLISIS FINO ───────────────────
1. **Detecta zonas de mayor presión** (minúsculas, una por línea, sin repetir):
   - dedos  
   - metatarsos  
   - arco  
   - exterior  
   - talón  

   • Examina cambios de textura, brillo, suciedad, hundimientos o decoloración, incluso leves.  
   • Ordena de la más a la menos marcada.  
   • No incluyas zonas inexistentes.

2. **Determina el lado del pie** (escribe solo una palabra, minúsculas):  
   - «izquierdo»  o  «derecho»  

   **Guías de diagnóstico – compara ambas mitades de la plantilla**  
   ─ Arco medial (cóncavo)  
     • Si el arco cóncavo está a la **derecha** de la huella → plantilla de **pie izquierdo**.  
     • Si el arco cóncavo está a la **izquierda** de la huella → plantilla de **pie derecho**.  

   ─ Región del dedo gordo  
     • El **dedo gordo** y el **primer metatarso** son más anchos y suelen mostrar más desgaste que el lado del meñique.  
     • Dedo gordo a la derecha de la huella → **izquierdo**.  
     • Dedo gordo a la izquierda de la huella → **derecho**.  

   ─ Desgaste típico del talón  
     • Desgaste inicial en el borde **externo-posterior** (lado lateral).  
     • Si el borde externo-posterior desgastado está a la derecha → plantilla **izquierda**.  
     • Si está a la izquierda → plantilla **derecha**.  

   ─ Silueta general  
     • El borde interno (medial) suele ser casi recto; el borde externo (lateral) aparece más curvo.  
     • Borde interno recto a la derecha → **izquierdo**.  
     • Borde interno recto a la izquierda → **derecho**.  

   ─ Foto girada o volteada  
     • Ignora la orientación de la cámara: determina el lado comparando las características anteriores entre sí, no por la posición absoluta en la imagen.  

   • Usa al menos dos de los criterios anteriores para confirmar el lado; si son contradictorios, prioriza arco + dedo gordo.

3. **Eficacia**  
   - Calcula una **confianza interna** 0–100 % según:  
     • nitidez/iluminación de la foto;  
     • claridad y consistencia de los desgastes;  
     • concordancia con la anatomía habitual;  
     • coincidencia de al menos dos criterios de diagnóstico de pie.  
   - Incluso con baja confianza (< 40 %) **debes** dar un valor (p. ej. «eficacia 23%»).  
   - Redondea al entero más próximo.  
   - Escribe: "eficacia NN%" en una línea aparte.

──────────────────────── FORMATO DE SALIDA ───────────────────────
- Cada zona detectada → 1 línea.  
- Luego 1 línea con «izquierdo» o «derecho».  
- Última línea: "eficacia NN%". 
`;

export default analisisPisada;