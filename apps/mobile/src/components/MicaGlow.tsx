import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg'

/**
 * The orb's ambient glow, in the web orb's own language (`mica-orb.css`).
 *
 * The web glow is a radial gradient fading to transparent — teal at 55% in
 * the centre, 22% at 42%, gone by 72% — which is why it reads as a halo
 * rather than a disc. A solid circle with opacity cannot draw that: it has a
 * visible edge. This is the same three stops, so the phone's halo and the
 * web's halo are the same light.
 *
 * Pure pixels: no animation of its own. The caller wraps it in whatever
 * breathes (or nothing, under reduced motion) and animates opacity and scale
 * on that wrapper — both composited transforms, never a re-raster.
 */
export function MicaGlow({ size, testID }: { size: number; testID?: string }) {
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} testID={testID}>
      <Defs>
        <RadialGradient id="mica-glow" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#03C6B1" stopOpacity={0.55} />
          <Stop offset="42%" stopColor="#03C6B1" stopOpacity={0.22} />
          <Stop offset="72%" stopColor="#03C6B1" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={size / 2} cy={size / 2} r={size / 2} fill="url(#mica-glow)" />
    </Svg>
  )
}
