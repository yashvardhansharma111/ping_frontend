import { useEffect, useRef, useCallback } from 'react';
import { Animated, Keyboard, Platform, type LayoutChangeEvent } from 'react-native';

// Animated bottom inset that tracks the keyboard WITHOUT double-shifting.
// If the OS already shrank the window for the keyboard (Android adjustResize),
// the root's onLayout height drops and the inset only covers whatever the OS
// didn't. If the window didn't change (iOS / no-adjust), the full keyboard
// height is applied. Attach `onRootLayout` to the screen's root view.
export function useKeyboardInset() {
  const inset = useRef(new Animated.Value(0)).current;
  const fullH = useRef(0);
  const curH = useRef(0);
  const kbOpen = useRef(false);

  const onRootLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    curH.current = h;
    if (!kbOpen.current && h > fullH.current) fullH.current = h;
  }, []);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const show = Keyboard.addListener(showEvt, (e) => {
      kbOpen.current = true;
      const kb = e.endCoordinates.height;
      // Let a resize-driven layout pass land before measuring what the OS handled
      setTimeout(() => {
        const handledByOs = Math.max(0, fullH.current - curH.current);
        const target = Math.max(0, kb - handledByOs);
        Animated.timing(inset, { toValue: target, duration: 240, useNativeDriver: false }).start();
      }, Platform.OS === 'android' ? 60 : 0);
    });
    const hide = Keyboard.addListener(hideEvt, () => {
      kbOpen.current = false;
      Animated.timing(inset, { toValue: 0, duration: 200, useNativeDriver: false }).start();
    });
    return () => { show.remove(); hide.remove(); };
  }, [inset]);

  return { keyboardY: inset, onRootLayout };
}
