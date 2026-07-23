import { Tabs } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Admin } from '@/constants/adminTheme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({ name, color, focused }: { name: IoniconName; color: string; focused: boolean }) {
  return (
    <View style={[tabIcon.wrap, focused && tabIcon.wrapOn]}>
      <Ionicons name={name} size={20} color={color} />
    </View>
  );
}

const tabIcon = StyleSheet.create({
  wrap: {
    width: 36,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wrapOn: {
    backgroundColor: Admin.accentSoft,
  },
});

export default function AdminLayout() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = 56 + Math.max(insets.bottom, 6);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Admin.accent,
        tabBarInactiveTintColor: Admin.muted,
        tabBarStyle: {
          backgroundColor: Admin.surface,
          borderTopColor: Admin.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: tabBarHeight,
          paddingBottom: Math.max(insets.bottom, 6),
          paddingTop: 6,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600', marginTop: 1 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? 'grid' : 'grid-outline'} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="users"
        options={{
          title: 'Users',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? 'people' : 'people-outline'} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="payments"
        options={{
          title: 'Pay',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? 'card' : 'card-outline'} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: 'Reports',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? 'flag' : 'flag-outline'} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: 'Events',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? 'calendar' : 'calendar-outline'} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="verifications"
        options={{
          title: 'Verify',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? 'shield-checkmark' : 'shield-checkmark-outline'} color={color} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
