import { Ionicons } from '@expo/vector-icons';
import { BottomTabBarProps } from "expo-router/js-tabs";
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/contexts/ThemeContext';
import { glassTokens } from '@/design-system/glass';

import { GlassSurface } from './glass/GlassSurface';

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  index: 'home',
  explore: 'play-circle',
  reading: 'book',
  voice: 'mic',
  weak: 'flash',
  settings: 'settings',
};

const BASE_TAB_BAR_HEIGHT = 62;
const BASE_ACTIVE_CAPSULE_WIDTH = 58;
const BASE_ACTIVE_CAPSULE_HEIGHT = 48;

export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { theme, themeName } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: viewportWidth } = useWindowDimensions();

  const uiScale = useMemo(
    () =>
      Platform.OS === 'web'
        ? Math.max(
            0.76,
            Math.min(
              1.08,
              viewportWidth / 390,
            ),
          )
        : 1,
    [viewportWidth],
  );

  const tabBarHeight =
    Math.round(
      BASE_TAB_BAR_HEIGHT * uiScale,
    );

  const activeCapsuleWidth =
    Math.round(
      BASE_ACTIVE_CAPSULE_WIDTH * uiScale,
    );

  const activeCapsuleHeight =
    Math.max(
      38,
      Math.round(
        BASE_ACTIVE_CAPSULE_HEIGHT * uiScale,
      ),
    );

  const styles = useMemo(
    () =>
      createStyles(
        uiScale,
        tabBarHeight,
        activeCapsuleWidth,
        activeCapsuleHeight,
      ),
    [
      uiScale,
      tabBarHeight,
      activeCapsuleWidth,
      activeCapsuleHeight,
    ],
  );

  const isDark = themeName === 'dark';
  const material = isDark ? glassTokens.dark : glassTokens.light;

  const translateX = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  const [barWidth, setBarWidth] = useState(0);

  const tabCount = state.routes.length;

  const itemWidth = useMemo(
    () => (barWidth > 0 ? barWidth / tabCount : 0),
    [barWidth, tabCount],
  );

  useEffect(() => {
    if (!itemWidth) return;

    Animated.parallel([
      Animated.spring(translateX, {
        toValue:
          state.index * itemWidth +
          itemWidth / 2 -
          activeCapsuleWidth / 2,
        useNativeDriver: true,
        speed: 22,
        bounciness: 9,
      }),
      Animated.sequence([
        Animated.spring(scale, {
          toValue: 0.96,
          useNativeDriver: true,
          speed: 28,
          bounciness: 4,
        }),
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
          speed: 24,
          bounciness: 9,
        }),
      ]),
    ]).start();
  }, [
    state.index,
    itemWidth,
    activeCapsuleWidth,
    translateX,
    scale,
  ]);

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        {
          bottom:
            Platform.OS === 'web'
              ? Math.max(
                  8,
                  Math.round(12 * uiScale),
                )
              : Math.max(
                  insets.bottom - 18,
                  Platform.OS === 'ios'
                    ? -8
                    : -4,
                ),
        },
      ]}
    >
      <GlassSurface
        variant="tabBar"
        dark={isDark}
        shadow
        glow
        edge
        border
        bottomDepth
        sideRefraction
        highlight={false}
        contentStyle={styles.barOuter}
      >
        <View
          style={styles.measureWrap}
          onLayout={(event) => setBarWidth(event.nativeEvent.layout.width)}
        >
          {barWidth > 0 ? (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.activeCapsule,
                {
                  transform: [{ translateX }, { scale }],
                },
              ]}
            >
              <GlassSurface
                variant="tabActive"
                dark={isDark}
                intensity={glassTokens.blur.crystal}
                borderColor={`${theme.accent}88`}
                shadow
                glow
                edge
                border
                highlight={false}
                sideRefraction
                bottomDepth
                contentStyle={styles.activeCapsuleInner}
              />
            </Animated.View>
          ) : null}

          <View style={styles.itemsRow}>
            {state.routes.map((route, index) => {
              const focused = state.index === index;
              const { options } = descriptors[route.key];
              const iconName = ICONS[route.name] || 'ellipse';

              const onPress = () => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });

                if (!focused && !event.defaultPrevented) {
                  navigation.navigate(route.name, route.params);
                }
              };

              const onLongPress = () => {
                navigation.emit({
                  type: 'tabLongPress',
                  target: route.key,
                });
              };

              return (
                <Pressable
                  key={route.key}
                  accessibilityRole="button"
                  accessibilityState={focused ? { selected: true } : {}}
                  accessibilityLabel={options.tabBarAccessibilityLabel}
                  testID={options.tabBarButtonTestID}
                  onPress={onPress}
                  onLongPress={onLongPress}
                  style={({ pressed }) => [
                    styles.item,
                    pressed && styles.pressed,
                  ]}
                >
                  <Ionicons
                    name={iconName}
                    size={
                      focused
                        ? Math.max(
                            20,
                            Math.round(26 * uiScale),
                          )
                        : Math.max(
                            18,
                            Math.round(23 * uiScale),
                          )
                    }
                    color={focused ? theme.accent : material.iconInactive}
                  />
                </Pressable>
              );
            })}
          </View>
        </View>
      </GlassSurface>
    </View>
  );
}

const createStyles = (
  uiScale: number,
  tabBarHeight: number,
  activeCapsuleWidth: number,
  activeCapsuleHeight: number,
) => {
  const s = (value: number) =>
    Math.round(value * uiScale);

  return StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: s(18),
    right: s(18),
  },

  barOuter: {
    height: tabBarHeight,
    paddingHorizontal: s(8),
    justifyContent: 'center',
  },

  measureWrap: {
    flex: 1,
    position: 'relative',
    justifyContent: 'center',
  },

  itemsRow: {
    height: tabBarHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    zIndex: 2,
  },

  item: {
    flex: 1,
    height: tabBarHeight,
    alignItems: 'center',
    justifyContent: 'center',
  },

  pressed: {
    transform: [{ scale: glassTokens.animation.iconPressScale }],
    opacity: 0.9,
  },

  activeCapsule: {
    position: 'absolute',
    top: (tabBarHeight - activeCapsuleHeight) / 2,
    left: 0,
    width: activeCapsuleWidth,
    height: activeCapsuleHeight,
    zIndex: 1,
  },

  activeCapsuleInner: {
    width: activeCapsuleWidth,
    height: activeCapsuleHeight,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
};