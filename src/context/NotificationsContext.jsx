import { createContext, useContext } from 'react';
import { useNotifications } from '../hooks/useNotifications.js';

// One shared poll/cache for notifications, same reasoning as ProfileContext:
// the unread badge on the avatar and the full list on /notifications need
// to agree with each other and with whatever just got marked read, so they
// share one instance instead of each running their own fetch.
const NotificationsContext = createContext(null);

export function NotificationsProvider({ children }) {
  const value = useNotifications();
  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotificationsContext() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error('useNotificationsContext must be used within a NotificationsProvider');
  }
  return ctx;
}
