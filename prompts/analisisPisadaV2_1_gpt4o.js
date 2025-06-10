const analisisPisada =
    "Analiza la imagen suministrada y decide primero si es una fotografía real de una plantilla (insole) de pisada.\n\n" +
    "──────────────────────── PASO 1 – FILTRO ────────────────────────\n" +
    "• Si está claro que no es una plantilla de calzado, o si es evidentemente un dibujo, render o simulación, responde exactamente: descartada y termina.\n" +
    "• Si la plantilla parece completamente nueva, sin ningún signo visible de uso, puedes descartarla solo si estás completamente seguro. En caso de duda, desgaste mínimo, marcas o brillos irregulares, continúa al análisis.\n\n" +
    "────────────────────── PASO 2 – ANÁLISIS FINO ───────────────────\n" +
    "1. Detecta solo las zonas que muestran signos claros de desgaste o presión (una por línea, minúsculas, sin repetir):\n" +
    "- dedos\n" +
    "- metatarsos\n" +
    "- arco\n" +
    "- exterior\n" +
    "- talón\n\n" +
    "• Excluye zonas que no tengan marcas visibles, hundimientos, desgaste, decoloración o cambios de textura. Si una zona no tiene signos evidentes, no la menciones.\n" +
    "• El orden no importa. Solo deben aparecer las zonas reales de presión.\n\n" +
    "2. Determina el lado del pie (una palabra, minúsculas):\n" +
    "- izquierdo o derecho\n\n" +
    "Usa al menos dos de estos criterios para determinarlo:\n" +
    "- Arco medial (cóncavo) a la derecha → izquierdo\n" +
    "- Dedo gordo a la derecha → izquierdo\n" +
    "- Desgaste en talón externo derecho → izquierdo\n" +
    "- Borde recto a la derecha → izquierdo\n\n" +
    "Si los criterios son contradictorios, prioriza arco y dedo gordo.\n\n" +
    "3. Eficacia\n" +
    "- Estima un porcentaje de confianza (0 a 100 %) basado en: nitidez, claridad del desgaste, iluminación, y coincidencia con la anatomía del pie.\n" +
    "- Aunque la confianza sea baja (<40 %), debes dar un valor.\n" +
    "- Escribe: eficacia NN% (en una línea sola).\n\n" +
    "──────────────────────── FORMATO DE SALIDA ───────────────────────\n" +
    "- Una línea por cada zona con presión visible (no pongas zonas sin desgaste).\n" +
    "- Luego una línea con izquierdo o derecho.\n" +
    "- Última línea: eficacia NN%";


export default analisisPisada;