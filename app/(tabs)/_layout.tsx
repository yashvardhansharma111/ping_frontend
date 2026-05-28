import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Ping } from '@/constants/theme';
import { View, StyleSheet } from 'react-native';

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
  return (
    <View style={[s.iconWrap, focused && s.iconWrapActive]}>
      <Ionicons name={focused ? nameFilled : name} size={22} color={color} />
      {focused && <View style={[s.dot, { backgroundColor: color }]} />}
    </View>
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
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Activities',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="flash-outline" nameFilled="flash" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: 'Friends',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="people-outline" nameFilled="people" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="person-outline" nameFilled="person" focused={focused} color={color} />
          ),
        }}
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
  iconWrapActive: {
    backgroundColor: 'rgba(124,58,237,0.15)',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginTop: -2,
  },
});
