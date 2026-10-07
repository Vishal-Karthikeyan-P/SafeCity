// score: 0 = high risk, 100 = safe
const STOPS: [number, [number, number, number]][] = [
    [100, [59, 130, 246]],  // blue
    [75, [34, 197, 94]],   // green
    [55, [234, 179, 8]],   // yellow
    [40, [249, 115, 22]],  // orange
    [20, [239, 68, 68]],   // red
    [0, [153, 27, 27]],   // dark red
]

export function scoreToRgb(score: number): [number, number, number] {
    const s = Math.max(0, Math.min(100, Number.isFinite(score) ? score : 100))
    for (let i = 0; i < STOPS.length - 1; i++) {
        const [hi, c1] = STOPS[i]
        const [lo, c2] = STOPS[i + 1]
        if (s <= hi && s >= lo) {
            const t = (hi - s) / (hi - lo)
            return [0, 1, 2].map((k) => Math.round(c1[k] + (c2[k] - c1[k]) * t)) as [number, number, number]
        }
    }
    return STOPS[0][1]
}

export const RISK_LEGEND_GRADIENT = `linear-gradient(to right, ${STOPS.map(
    ([score, [r, g, b]]) => `rgb(${r},${g},${b}) ${100 - score}%`
).join(', ')})`