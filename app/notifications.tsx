import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import ScreenHeader from '@/components/ScreenHeader';
import { ToggleRow } from '@/components/ui';

export default function NotificationsScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [activities, setActivities] = useState(true);
  const [friendRequests, setFriendRequests] = useState(true);
  const [messages, setMessages] = useState(true);

  return (
    <View style={[s.root, { backgroundColor: c.background }]}>
      <ScreenHeader
        title="Notifications"
        onBack={() => router.back()}
        paddingTop={insets.top + 8}
      />
      <View style={{ padding: Spacing.lg }}>
        <ToggleRow
          label="Nearby activities"
          sublabel="Pings within your radius"
          value={activities}
          onValueChange={setActivities}
        />
        <ToggleRow
          label="Friend requests"
          sublabel="When someone adds you"
          value={friendRequests}
          onValueChange={setFriendRequests}
        />
        <ToggleRow
          label="Messages"
          sublabel="Chat & activity updates"
          value={messages}
          onValueChange={setMessages}
          separator={false}
        />
        <Text style={[s.hint, { color: c.textSecondary }]}>
          Push notification setup coming soon. These preferences will be applied when ready.
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  hint: { ...Typography.caption, marginTop: Spacing.md, lineHeight: 18 },
});
