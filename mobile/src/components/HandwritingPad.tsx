import { useCallback, useRef, useState } from "react";
import { LayoutChangeEvent, PanResponder, StyleSheet, View } from "react-native";
import Svg, { Polyline } from "react-native-svg";

export type StrokePayload = { version: 1; lines: Array<Array<{ x: number; y: number }>> };

type Props = {
  onChange: (payload: StrokePayload) => void;
};

export function strokesToSvgString(strokes: StrokePayload): string {
  const parts = strokes.lines
    .filter((line) => line.length > 1)
    .map((line) => {
      const pts = line.map((p) => `${p.x * 100},${p.y * 100}`).join(" ");
      return `<polyline points="${pts}" fill="none" stroke="#111" stroke-width="0.35" stroke-linecap="round" stroke-linejoin="round"/>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="120">${parts}</svg>`;
}

export default function HandwritingPad({ onChange }: Props) {
  const [layout, setLayout] = useState({ w: 1, h: 1 });
  const linesRef = useRef<Array<Array<{ x: number; y: number }>>>([]);
  const currentRef = useRef<Array<{ x: number; y: number }>>([]);
  const [, bump] = useState(0);

  const pushPayload = useCallback(() => {
    onChange({ version: 1, lines: linesRef.current.map((l) => [...l]) });
  }, [onChange]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const { locationX, locationY } = e.nativeEvent;
        const x = layout.w > 0 ? Math.min(1, Math.max(0, locationX / layout.w)) : 0;
        const y = layout.h > 0 ? Math.min(1, Math.max(0, locationY / layout.h)) : 0;
        currentRef.current = [{ x, y }];
        bump((n) => n + 1);
      },
      onPanResponderMove: (e) => {
        const { locationX, locationY } = e.nativeEvent;
        const x = layout.w > 0 ? Math.min(1, Math.max(0, locationX / layout.w)) : 0;
        const y = layout.h > 0 ? Math.min(1, Math.max(0, locationY / layout.h)) : 0;
        currentRef.current.push({ x, y });
        bump((n) => n + 1);
      },
      onPanResponderRelease: () => {
        if (currentRef.current.length > 1) {
          linesRef.current.push([...currentRef.current]);
        }
        currentRef.current = [];
        pushPayload();
        bump((n) => n + 1);
      },
    })
  ).current;

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setLayout({ w: width || 1, h: height || 1 });
  };

  const allLines = [...linesRef.current, currentRef.current].filter((l) => l.length >= 2);

  return (
    <View style={styles.wrap} onLayout={onLayout} {...panResponder.panHandlers}>
      <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        {allLines.map((line, idx) => (
          <Polyline
            key={idx}
            points={line.map((p) => `${p.x * 100},${p.y * 100}`).join(" ")}
            fill="none"
            stroke="#38bdf8"
            strokeWidth={0.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: 200,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "transparent",
    overflow: "hidden",
  },
});
