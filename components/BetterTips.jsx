import { footRecommendations } from '../utils/footRecs.js';
import styles from './BetterTips.module.css';

export default function BetterTips({ trendText, previewUrl }) {
    // 1️⃣ Detectamos el tipo de pie a partir del texto que ya usas:
    const footType = trendText.toLowerCase().includes('plano') ? 'plano' : 'cavo';
    const recs = footRecommendations[footType];

    return (
        <div className={styles.slide}>
            {/* Foto existente sin renombrar */}
            <div className={styles.photoWrapper}>
                <img src={previewUrl} alt="Plantilla analizada" />
            </div>

            <div className={styles.arrow}>➜</div>

            {/* Tarjeta de mejoras */}
            <div className={styles.card}>
                <h4>Mejoras&nbsp;necesarias</h4>
                <ul>
                    {recs.map(txt => <li key={txt}>{txt}</li>)}
                </ul>
            </div>
        </div>
    );
}
