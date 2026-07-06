import { ReactNode } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GlassSurface } from '@/components/ui/glass/GlassSurface';
import { useAppTheme } from '@/services/theme';

export type BottomSheetOption = {
  id: string;
  title: string;
  subtitle?: string;
};

type Props = {
  visible: boolean;
  title: string;

  options?: BottomSheetOption[];
  selected?: string | string[];
  multi?: boolean;

  children?: ReactNode;

  onClose: () => void;
  onSelect?: (id: string) => void;

  height?: 'auto' | 'medium' | 'large' | 'fullscreen';
  scrollable?: boolean;
  showHandle?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
};

function isActiveValue(selected: string | string[] | undefined, id: string) {
  return Array.isArray(selected) ? selected.includes(id) : selected === id;
}

function heightStyle(height: Props['height']) {
  if (height === 'fullscreen') return { height: '94%' as const };
  if (height === 'large') return { maxHeight: '86%' as const };
  if (height === 'medium') return { maxHeight: '62%' as const };
  return {};
}

export function GlassBottomSheet({
  visible,
  title,

  options = [],
  selected,
  multi = false,

  children,

  onClose,
  onSelect,

  height = 'auto',
  scrollable = true,
  showHandle = true,
  contentStyle,
}: Props) {
  const { colors, scale } = useAppTheme();

  const hasCustomContent = !!children;
  const shouldScroll = scrollable && (hasCustomContent || options.length > 6);

  function handleSelect(id: string) {
    onSelect?.(id);
    if (!multi) onClose();
  }

  const body = hasCustomContent ? (
    children
  ) : (
    <>
      {options.map((item, index) => {
        const active = isActiveValue(selected, item.id);
        const isLast = index === options.length - 1;

        return (
          <Pressable
            key={item.id}
            style={[
              styles.row,
              {
                borderBottomColor: isLast ? 'transparent' : 'rgba(255,255,255,0.16)',
              },
            ]}
            onPress={() => handleSelect(item.id)}
          >
            <View style={styles.textBlock}>
              <Text
                style={[
                  styles.optionTitle,
                  {
                    color: active ? colors.accent : colors.textPrimary,
                    fontSize: scale(16),
                  },
                ]}
              >
                {item.title}
              </Text>

              {item.subtitle ? (
                <Text
                  style={[
                    styles.subtitle,
                    {
                      color: colors.textSecondary,
                      fontSize: scale(13),
                    },
                  ]}
                >
                  {item.subtitle}
                </Text>
              ) : null}
            </View>

            <Text
              style={[
                styles.check,
                {
                  color: active ? colors.accent : 'transparent',
                  fontSize: scale(24),
                },
              ]}
            >
              ✓
            </Text>
          </Pressable>
        );
      })}
    </>
  );

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.sheetOuter, heightStyle(height)]}>
          <GlassSurface
            variant="sheet"
            style={styles.sheetWrap}
            contentStyle={[styles.sheetContent, contentStyle]}
          >
            <SafeAreaView edges={['bottom']}>
              {showHandle ? <View style={styles.handle} /> : null}

              <Text style={[styles.title, { color: colors.textPrimary, fontSize: scale(18) }]}>
                {title}
              </Text>

              {shouldScroll ? (
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.scrollContent}
                >
                  {body}
                </ScrollView>
              ) : (
                <View>{body}</View>
              )}
            </SafeAreaView>
          </GlassSurface>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.30)',
  },
  sheetOuter: {
    width: '100%',
  },
  sheetWrap: {
    width: '100%',
  },
  sheetContent: {
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
  },
  scrollContent: {
    paddingBottom: 8,
  },
  handle: {
    width: 48,
    height: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.62)',
    alignSelf: 'center',
    marginBottom: 18,
  },
  title: {
    textAlign: 'center',
    fontWeight: '900',
    marginBottom: 16,
  },
  row: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  textBlock: {
    flex: 1,
    paddingRight: 12,
  },
  optionTitle: {
    fontWeight: '850',
  },
  subtitle: {
    marginTop: 3,
    fontWeight: '600',
  },
  check: {
    fontWeight: '900',
  },
});