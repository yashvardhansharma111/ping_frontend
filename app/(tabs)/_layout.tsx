import { Tabs } from 'expo-router';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Ping } from '@/constants/theme';
import { View, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { useRef, useEffect } from 'react';
import * as Haptics from 'expo-haptics';
import {
  MapTrifold,
  Lightning,
  UsersThree,
  CalendarBlank,
  User,
} from 'phosphor-react-native';
import type { Icon } from 'phosphor-react-native';

function TabIcon({
  IconComp,
  label,
  focused,
  color,
}: {
  IconComp: Icon;
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
    outputRange: ['rgba(187,146,255,0)', 'rgba(187,146,255,0.2)'],
  });
  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] });
  const labelOpacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const labelTranslateY = anim.interpolate({ inputRange: [0, 1], outputRange: [4, 0] });
  const iconTranslateY = anim.interpolate({ inputRange: [0, 1], outputRange: [5, 0] });

  return (
    <Animated.View style={[s.iconWrap, { backgroundColor: bg, transform: [{ scale }] }]}>
      <Animated.View style={{ transform: [{ translateY: iconTranslateY }] }}>
        <IconComp size={22} color={color} weight={focused ? 'fill' : 'regular'} />
      </Animated.View>
      <Animated.Text
        style={[s.label, { color, opacity: labelOpacity, transform: [{ translateY: labelTranslateY }] }]}
      >
        {label}
      </Animated.Text>
    </Animated.View>
  );
}

const TAB_SCREENS = [
  { name: 'index',   label: 'Map',     Icon: MapTrifold },
  { name: 'explore', label: 'Explore', Icon: Lightning },
  { name: 'friends', label: 'Friends', Icon: UsersThree },
  { name: 'events',  label: 'Events',  Icon: CalendarBlank },
  { name: 'profile', label: 'Profile', Icon: User },
];

function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme() ?? 'dark';
  const c = Colors[scheme];

  return (
    <View
      style={[
        s.bar,
        {
          bottom: insets.bottom + 10,
          backgroundColor: scheme === 'dark' ? 'rgba(15,15,18,0.94)' : 'rgba(255,255,255,0.94)',
          borderColor: scheme === 'dark' ? 'rgba(187,146,255,0.22)' : 'rgba(143,99,244,0.14)',
          shadowOpacity: scheme === 'dark' ? 0.45 : 0.12,
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
          <TouchableOpacity key={route.key} style={s.tab} onPress={onPress} activeOpacity={0.7}>
            <TabIcon
              IconComp={cfg.Icon}
              label={cfg.label}
              focused={focused}
              color={focused ? c.tabIconSelected : c.tabIconDefault}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

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

const s = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 18,
    right: 18,
    height: 64,
    borderRadius: 30,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: Ping.purpleDim,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 24,
    elevation: 20,
  },
  tab: {
    flex: 1,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
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
    letterSpacing: 0.2,
  },
});
