// components/LiquidBar.jsx
export default function LiquidBar({ pct = 0 }) {
    return (
        <div
            className="pv-track"
            role="progressbar"
            aria-valuenow={Math.round(pct)}
            aria-valuemin={0}
            aria-valuemax={100}
        >
            {/* líquido que crece */}
            <div className="pv-fill" style={{ width: `${pct}%` }}>
                {/* resplandor IA */}
                <div className="pv-glow" />
            </div>

            {/* porcentaje */}
            <span className="pv-label">{Math.round(pct)} %</span>
        </div>
    );
}
