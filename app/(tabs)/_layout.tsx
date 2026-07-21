import { Tabs, useRouter } from 'expo-router';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Ping } from '@/constants/theme';
import { View, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { useRef, useEffect } from 'react';
import * as Haptics from 'expo-haptics';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

// ── Animated tab icon ─────────────────────────────────────────────────────────

function TabIcon({
  name,
  nameFilled,
  label,
  focused,
  color,
}: {
  name: IoniconName;
  nameFilled: IoniconName;
  label: string;
  focused: boolean;
  color: string;
}) {
  const anim = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: focused ? 1 : 0,
      useNativeDriver: false,
      damping: 14,
      mass: 0.8,
      stiffness: 220,
    }).start();
  }, [focused]);

  const bg = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(124,58,237,0)', 'rgba(124,58,237,0.18)'],
  });
  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] });
  const labelOpacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const labelTranslateY = anim.interpolate({ inputRange: [0, 1], outputRange: [4, 0] });
  const iconTranslateY = anim.interpolate({ inputRange: [0, 1], outputRange: [5, 0] });

  return (
    <Animated.View style={[s.iconWrap, { backgroundColor: bg, transform: [{ scale }] }]}>
      <Animated.View style={{ transform: [{ translateY: iconTranslateY }] }}>
        <Ionicons name={focused ? nameFilled : name} size={21} color={color} />
      </Animated.View>
      <Animated.Text
        style={[s.label, { color, opacity: labelOpacity, transform: [{ translateY: labelTranslateY }] }]}
      >
        {label}
      </Animated.Text>
    </Animated.View>
  );
}

// ── Tab config ────────────────────────────────────────────────────────────────

const TAB_SCREENS = [
  { name: 'index',   label: 'Map',     icon: 'map-outline' as IoniconName,      iconFilled: 'map' as IoniconName },
  { name: 'explore', label: 'Explore', icon: 'flash-outline' as IoniconName,    iconFilled: 'flash' as IoniconName },
  { name: 'friends', label: 'Friends', icon: 'people-outline' as IoniconName,   iconFilled: 'people' as IoniconName },
  { name: 'events',  label: 'Events',  icon: 'calendar-outline' as IoniconName, iconFilled: 'calendar' as IoniconName },
  { name: 'profile', label: 'Profile', icon: 'person-outline' as IoniconName,   iconFilled: 'person' as IoniconName },
];

// ── Fully custom tab bar — gives pixel-perfect vertical centering ──────────────

function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme() ?? 'dark';
  const activeColor = scheme === 'dark' ? Ping.purpleLight : Ping.purple;
  const inactiveColor = scheme === 'dark' ? '#4A4870' : '#A89CC8';

  return (
    <View
      style={[
        s.bar,
        {
          bottom: insets.bottom + 10,
          backgroundColor: scheme === 'dark' ? 'rgba(12,12,28,0.97)' : 'rgba(255,255,255,0.97)',
          borderColor: scheme === 'dark' ? 'rgba(124,58,237,0.25)' : 'rgba(124,58,237,0.12)',
          shadowOpacity: scheme === 'dark' ? 0.4 : 0.15,
        },
      ]}
    >
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const cfg = TAB_SCREENS.find((t) => t.name === route.name) ?? TAB_SCREENS[0];

        function onPress() {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }

        return (
          <TouchableOpacity
            key={route.key}
            style={s.tab}
            onPress={onPress}
            activeOpacity={0.7}
          >
            <TabIcon
              name={cfg.icon}
              nameFilled={cfg.iconFilled}
              label={cfg.label}
              focused={focused}
              color={focused ? activeColor : inactiveColor}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ── Layout ────────────────────────────────────────────────────────────────────

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index"   options={{ title: 'Map' }} />
      <Tabs.Screen name="explore" options={{ title: 'Activities' }} />
      <Tabs.Screen name="friends" options={{ title: 'Friends' }} />
      <Tabs.Screen name="events"  options={{ title: 'Events' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 18,
    right: 18,
    height: 64,
    borderRadius: 30,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',        // vertical center for all children
    shadowColor: Ping.purple,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 24,
    elevation: 20,
  },
  tab: {
    flex: 1,
    height: 64,                  // fill the full bar height
    alignItems: 'center',        // horizontal center
    justifyContent: 'center',    // vertical center — this is the key fix
  },
  iconWrap: {
    width: 56,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    gap: 2,
  },
  label: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.3,
    lineHeight: 11,
  },
});
