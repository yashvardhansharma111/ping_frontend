import { create } from 'zustand';

interface NotificationState {
  friendRequestCount: number;
  setFriendRequestCount: (n: number) => void;
  showAddFriend: boolean;
  setShowAddFriend: (v: boolean) => void;
  friendIds: Set<string>;
  pendingIds: Set<string>;
  setFriendSets: (friendIds: Set<string>, pendingIds: Set<string>) => void;
  addFriendOnSentCallback: (() => void) | null;
  setAddFriendOnSent: (cb: () => void) => void;
}

const useNotificationStore = create<NotificationState>((set) => ({
  friendRequestCount: 0,
  setFriendRequestCount: (n) => set({ friendRequestCount: n }),
  showAddFriend: false,
  setShowAddFriend: (v) => set({ showAddFriend: v }),
  friendIds: new Set(),
  pendingIds: new Set(),
  setFriendSets: (friendIds, pendingIds) => set({ friendIds, pendingIds }),
  addFriendOnSentCallback: null,
  setAddFriendOnSent: (cb) => set({ addFriendOnSentCallback: cb }),
}));

export default useNotificationStore;
