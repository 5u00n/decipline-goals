import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path, Polyline } from 'react-native-svg';

import { Text } from '../ui/Text.jsx';

/** Matches `global.css` :root `--primary` */
const PRIMARY_STROKE = 'hsl(240 5.9% 10%)';
const AREA_FILL = 'hsl(240 5.9% 10% / 0.18)';
const DOT_FILL = 'hsl(0 0% 100%)';

/**
 * @param {number} width
 * @param {number} height
 * @param {number} padH
 * @param {number} padV
 * @param {Array<{ pct?: number }>} points
 */
function layoutCoords(width, height, padH, padV, points) {
  const n = points.length;
  const innerW = Math.max(0, width - 2 * padH);
  const innerH = Math.max(0, height - 2 * padV);
  const bottomY = padV + innerH;
  const coords = [];
  for (let i = 0; i < n; i++) {
    const pct = Math.max(0, Math.min(100, points[i]?.pct ?? 0));
    const x =
      n === 1 ? padH + innerW / 2 : padH + (i / (n - 1)) * innerW;
    const y = padV + innerH * (1 - pct / 100);
    coords.push({ x, y });
  }
  return { coords, bottomY };
}

/**
 * Area under a line + stroke + circles at each sample. Width follows parent (`onLayout`).
 *
 * @param {object} props
 * @param {Array<{ pct?: number }>} props.points chronological daily completion % (0–100).
 * @param {number} [props.height]
 * @param {number} [props.paddingH]
 * @param {number} [props.paddingV]
 */
export function CompletionAreaLineChart({
  points = [],
  height = 96,
  paddingH = 8,
  paddingV = 8,
}) {
  const [w, setW] = useState(0);
  const n = points.length;
  const dotR = n > 45 ? 2 : n > 20 ? 2.5 : 3.5;

  const layout = useMemo(() => {
    if (w <= 0 || n === 0) {
      return null;
    }
    return layoutCoords(w, height, paddingH, paddingV, points);
  }, [w, height, paddingH, paddingV, points, n]);

  const areaPath = useMemo(() => {
    if (!layout?.coords?.length) {
      return '';
    }
    const { coords, bottomY } = layout;
    const first = coords[0];
    const last = coords[coords.length - 1];
    let d = `M ${first.x} ${bottomY} L ${first.x} ${first.y}`;
    for (let i = 1; i < coords.length; i += 1) {
      d += ` L ${coords[i].x} ${coords[i].y}`;
    }
    d += ` L ${last.x} ${bottomY} Z`;
    return d;
  }, [layout]);

  const polylinePts = useMemo(() => {
    if (!layout?.coords?.length) {
      return '';
    }
    return layout.coords.map((c) => `${c.x},${c.y}`).join(' ');
  }, [layout]);

  if (n === 0) {
    return (
      <View
        className="items-center justify-center"
        style={{ height }}
        accessibilityRole="image"
        accessibilityLabel="No chart data"
      >
        <Text className="text-xs text-muted-foreground">No data yet</Text>
      </View>
    );
  }

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel="Daily completion percentage chart"
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={{ width: '100%', height }}
    >
      {w > 0 && layout ? (
        <Svg width={w} height={height}>
          {areaPath ? <Path d={areaPath} fill={AREA_FILL} /> : null}
          <Polyline
            fill="none"
            points={polylinePts}
            stroke={PRIMARY_STROKE}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {layout.coords.map((c, i) => (
            <Circle
              key={i}
              cx={c.x}
              cy={c.y}
              fill={DOT_FILL}
              r={dotR}
              stroke={PRIMARY_STROKE}
              strokeWidth={1.5}
            />
          ))}
        </Svg>
      ) : null}
    </View>
  );
}
