import { Tabs } from 'expo-router';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { View, TouchableOpacity, StyleSheet, Animated, Text } from 'react-native';
import { useRef, useEffect } from 'react';
import * as Haptics from 'expo-haptics';
import useNotificationStore from '@/lib/stores/notificationStore';
import AddFriendModal from '@/components/AddFriendModal';
import {
  MapTrifold,
  Lightning,
  UsersThree,
  CalendarBlank,
  User,
} from 'phosphor-react-native';
import type { Icon } from 'phosphor-react-native';

function TabItem({
  IconComp,
  label,
  focused,
  scheme,
  badge,
}: {
  IconComp: Icon;
  label: string;
  focused: boolean;
  scheme: 'light' | 'dark';
  badge?: number;
}) {
  const anim = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: focused ? 1 : 0,
      useNativeDriver: false,
      damping: 20,
      mass: 0.6,
      stiffness: 280,
    }).start();
  }, [anim, focused]);

  const activeBg     = scheme === 'dark' ? '#7C3AED' : '#6545D9';
  const activeColor  = '#FFFFFF';
  const inactiveColor = scheme === 'dark' ? '#9494A8' : '#71717A';

  const pillWidth = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [38, 120],
  });

  const labelOpacity = anim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0, 1],
  });

  return (
    <Animated.View
      style={[
        s.itemContainer,
        {
          width: pillWidth,
          backgroundColor: focused ? activeBg : 'transparent',
        },
      ]}
    >
      <View style={s.iconWrap}>
        <IconComp
          size={21}
          color={focused ? activeColor : inactiveColor}
          weight={focused ? 'fill' : 'regular'}
        />
        {!!badge && badge > 0 && !focused && (
          <View style={s.badgeDot}>
            {badge <= 9 && <Text style={s.badgeText}>{badge}</Text>}
          </View>
        )}
      </View>
      {focused && (
        <Animated.Text
          numberOfLines={1}
          style={[
            s.activeLabel,
            {
              color: activeColor,
              opacity: labelOpacity,
            },
          ]}
        >
          {label}
        </Animated.Text>
      )}
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
  const friendRequestCount = useNotificationStore((s) => s.friendRequestCount);

  return (
    <View
      style={[
        s.bar,
        {
          bottom: Math.max(insets.bottom + 10, 16),
          backgroundColor: scheme === 'dark' ? 'rgba(16, 16, 22, 0.94)' : 'rgba(255, 255, 255, 0.96)',
          borderColor: scheme === 'dark' ? 'rgba(187, 146, 255, 0.2)' : 'rgba(143, 99, 244, 0.14)',
          shadowColor: scheme === 'dark' ? '#000000' : '#2A1850',
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
          <TouchableOpacity
            key={route.key}
            style={s.tab}
            onPress={onPress}
            activeOpacity={0.85}
          >
            <TabItem
              IconComp={cfg.Icon}
              label={cfg.label}
              focused={focused}
              scheme={scheme}
              badge={route.name === 'friends' ? friendRequestCount : undefined}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function TabLayout() {
  return (
    <View style={{ flex: 1 }}>
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
      <AddFriendModal />
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 28,
    right: 28,
    height: 60,
    borderRadius: 30,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 18,
    elevation: 12,
  },
  tab: {
    height: 62,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemContainer: {
    height: 42,
    borderRadius: 21,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    gap: 6,
  },
  activeLabel: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  iconWrap: {
    position: 'relative',
  },
  badgeDot: {
    position: 'absolute',
    top: -4,
    right: -5,
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
    borderWidth: 1.5,
    borderColor: '#10101A',
  },
  badgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#FFF',
    lineHeight: 10,
  },
});
