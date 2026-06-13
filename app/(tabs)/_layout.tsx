import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Ping } from '@/constants/theme';
import { View, StyleSheet, Animated } from 'react-native';
import { useRef, useEffect } from 'react';
import * as Haptics from 'expo-haptics';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({
  name,
  nameFilled,
  focused,
  color,
}: {
  name: IoniconName;
  nameFilled: IoniconName;
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
  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] });
  const dotOpacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  return (
    <Animated.View style={[s.iconWrap, { backgroundColor: bg, transform: [{ scale }] }]}>
      <Ionicons name={focused ? nameFilled : name} size={22} color={color} />
      <Animated.View style={[s.dot, { backgroundColor: color, opacity: dotOpacity }]} />
    </Animated.View>
  );
}

export default function TabLayout() {
  const scheme = useColorScheme() ?? 'dark';
  const c = Colors[scheme];
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Ping.purpleLight,
        tabBarInactiveTintColor: scheme === 'dark' ? '#4A4870' : '#9BA1A6',
        tabBarShowLabel: false,
        tabBarStyle: {
          position: 'absolute',
          bottom: insets.bottom + 10,
          left: 18,
          right: 18,
          borderRadius: 30,
          height: 64,
          backgroundColor: scheme === 'dark' ? 'rgba(12,12,28,0.97)' : 'rgba(255,255,255,0.97)',
          borderTopWidth: 1,
          borderColor: scheme === 'dark' ? 'rgba(124,58,237,0.25)' : 'rgba(124,58,237,0.12)',
          shadowColor: Ping.purple,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: scheme === 'dark' ? 0.4 : 0.15,
          shadowRadius: 24,
          elevation: 20,
          paddingBottom: 0,
          paddingTop: 0,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Map',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="map-outline" nameFilled="map" focused={focused} color={color} />
          ),
        }}
        listeners={{ tabPress: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light) }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Activities',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="flash-outline" nameFilled="flash" focused={focused} color={color} />
          ),
        }}
        listeners={{ tabPress: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light) }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: 'Friends',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="people-outline" nameFilled="people" focused={focused} color={color} />
          ),
        }}
        listeners={{ tabPress: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light) }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="person-outline" nameFilled="person" focused={focused} color={color} />
          ),
        }}
        listeners={{ tabPress: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light) }}
      />
    </Tabs>
  );
}

const s = StyleSheet.create({
  iconWrap: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    gap: 3,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginTop: -2,
  },
});
