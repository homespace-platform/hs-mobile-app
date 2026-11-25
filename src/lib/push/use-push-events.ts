import * as Notifications from 'expo-notifications';
import { useEffect, useRef } from 'react';

import { pushDataFromRequest, pushRouteFromData, type PushRoute } from '@/lib/push/pure';
import { notifyChatChanged, notifyNotificationsChanged } from '@/lib/realtime/connections';
import { refreshChatUnread } from '@/lib/unread-sync';

// App in foreground: still show the banner (no sound) so a push is never silently lost.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// Mount while signed in. Handles taps from any app state, including a cold start from a killed app,
// and refreshes counts/lists when a push arrives in the foreground.
export function usePushEvents(onOpen: (route: PushRoute) => void) {
  const handler = useRef(onOpen);
  handler.current = onOpen;

  useEffect(() => {
    const open = (response: Notifications.NotificationResponse) => {
      const route = pushRouteFromData(pushDataFromRequest(response.notification.request));
      if (route) handler.current(route);
    };
    // Handle the launching tap once; the response otherwise stays "last" for the whole session.
    const launch = Notifications.getLastNotificationResponse();
    if (launch) {
      Notifications.clearLastNotificationResponse();
      open(launch);
    }
    const tapped = Notifications.addNotificationResponseReceivedListener(open);
    const received = Notifications.addNotificationReceivedListener((notification) => {
      const data = pushDataFromRequest(notification.request) as { category?: unknown } | undefined;
      notifyNotificationsChanged();
      if (data?.category === 'CHAT') {
        void refreshChatUnread();
        notifyChatChanged();
      }
    });
    return () => {
      tapped.remove();
      received.remove();
    };
  }, []);
}
