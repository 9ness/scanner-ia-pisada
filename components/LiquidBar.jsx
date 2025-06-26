export default function LiquidBar({ pct }) {
    return (
        <div className="pv-track">
            <div className="pv-fill" style={{ width: `${pct}%` }} />
            <span className="pv-label"
            >{Math.round(pct)} %</span>
        </div>
    );
}