# V14 Glass Architecture Migration

## Invariant

**Layout owns geometry. Pressable owns interaction. Glass owns appearance.**

Decorative glass must never own gestures or determine the geometry of FlatList/carousel/modal content.

## Rendering backends

- iOS 26+ when supported at runtime: `expo-glass-effect` (`GlassView`, `GlassContainer`).
- Android, web, Windows/Tauri, older iOS: existing `expo-blur` + custom gradients/reflection fallback.
- Runtime checks are centralized in `design-system/glassCapabilities.ts`.

## Primitives

- `GlassSurface`: content surface for cards, hero, tiles and sheets. Existing API retained.
- `GlassOverlay`: absolute decorative material; always `pointerEvents="none"`. Use for carousels, modal geometry and other gesture/layout owners.
- `GlassControl`: interaction primitive. `Pressable` owns touch target; material is an absolute non-interactive layer.
- `GlassControlGroup`: interaction-safe layout group. Native glass is rendered inside each control; the group itself stays a plain layout `View` so hit-testing remains deterministic. `GlassContainer` is reserved for future purely visual/direct-GlassView groups.

## Controls

Grade buttons, standard buttons, icon buttons, training next button and training choices use `GlassControl`. Compact controls use a 40 px visual height with a >=44 px touch target. Press feedback uses scale, not opacity.

Semantic control tones live in `design-system/glassSemantic.ts` (`neutral`, `accent`, `danger`, `warning`, `success`).

## 360 carousel

The FlatList and card wrapper remain geometry owners. Glass is restored only as `GlassOverlay`; it does not wrap the FlatList or own card sizing. Existing conditional Modal lifecycle fix remains required.

## Dependency

Run:

```bash
npx expo install expo-glass-effect
```

The project declares `expo-glass-effect ~57.0.3`, matching Expo SDK 57 documentation at migration time.
