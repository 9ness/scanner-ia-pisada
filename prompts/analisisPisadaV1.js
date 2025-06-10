const analisisPisada = `
Analiza la imagen de una pisada y responde únicamente si se trata de una fotografía real de una plantilla de pisada con evidencia clara de uso y desgaste. Si la imagen es un dibujo, una ilustración digital, una simulación generada por IA, o no muestra señales físicas claras de presión, no nombres ninguna zona
, escribe únicamente la palabra "descartada".
En caso de que sí detectes una imagen real con evidencia visible de uso (como marcas, suciedad o hundimientos), responde solo con las zonas de mayor presión, una por línea.
Zonas posibles (no inventar ni deducir): dedos, metatarsos, arco, exterior, talón.
También debes detectar si se trata de un pie derecho o izquierdo. Debes escribir un texto a mayores de las zonas de presión que diga solamente la palabra "izquierdo" o "derecho".
Por último debes decirme un porcentaje de confianza de tu resultado del analisis del 1-100%. Debes escribir un texto a mayores que diga solamente "confianza:" + el porcentaje.
`;

export default analisisPisada;