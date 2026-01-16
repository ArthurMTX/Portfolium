/**
 * usePushNotifications Hook
 * 
 * Manages Web Push notification subscriptions for the app.
 * Handles subscription, unsubscription, and permission management.
 */
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

// API base path
const API_BASE = '/api';

interface PushSubscriptionState {
  isSupported: boolean;
  isSubscribed: boolean;
  isLoading: boolean;
  permission: NotificationPermission | 'default';
  error: string | null;
}

interface PushNotificationsHook extends PushSubscriptionState {
  subscribe: () => Promise<boolean>;
  unsubscribe: () => Promise<boolean>;
  requestPermission: () => Promise<NotificationPermission>;
  sendTestNotification: () => Promise<boolean>;
}

/**
 * Convert a base64 string to Uint8Array for VAPID public key
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Convert ArrayBuffer to base64 string
 */
function arrayBufferToBase64(buffer: ArrayBuffer | null): string {
  if (!buffer) return '';
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

export function usePushNotifications(): PushNotificationsHook {
  const { token } = useAuth();
  
  const [state, setState] = useState<PushSubscriptionState>({
    isSupported: false,
    isSubscribed: false,
    isLoading: true,
    permission: 'default',
    error: null,
  });

  // Check if push notifications are supported
  const checkSupport = useCallback(() => {
    const isSupported = 
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window;
    
    return isSupported;
  }, []);

  // Get current permission state
  const getPermission = useCallback((): NotificationPermission => {
    if (!('Notification' in window)) return 'denied';
    return Notification.permission;
  }, []);

  // Check if user is currently subscribed
  const checkSubscription = useCallback(async (): Promise<boolean> => {
    if (!checkSupport()) return false;
    
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      return !!subscription;
    } catch {
      return false;
    }
  }, [checkSupport]);

  // Initialize state on mount
  useEffect(() => {
    const init = async () => {
      const isSupported = checkSupport();
      const permission = getPermission();
      const isSubscribed = await checkSubscription();
      
      setState({
        isSupported,
        isSubscribed,
        isLoading: false,
        permission,
        error: null,
      });
    };
    
    init();
  }, [checkSupport, checkSubscription, getPermission]);

  // Request notification permission
  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (!('Notification' in window)) {
      return 'denied';
    }
    
    try {
      const permission = await Notification.requestPermission();
      setState(prev => ({ ...prev, permission }));
      return permission;
    } catch {
      return 'denied';
    }
  }, []);

  // Subscribe to push notifications
  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!checkSupport() || !token) {
      setState(prev => ({ 
        ...prev, 
        error: 'Push notifications not supported or not logged in' 
      }));
      return false;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Request permission if not granted
      const permission = await requestPermission();
      if (permission !== 'granted') {
        setState(prev => ({ 
          ...prev, 
          isLoading: false, 
          permission,
          error: 'Notification permission denied' 
        }));
        return false;
      }

      // Get VAPID public key from server
      const vapidResponse = await fetch(`${API_BASE}/push/vapid-public-key`);
      const vapidData = await vapidResponse.json();
      
      if (!vapidData.is_configured || !vapidData.public_key) {
        setState(prev => ({ 
          ...prev, 
          isLoading: false, 
          error: 'Push notifications not configured on server' 
        }));
        return false;
      }

      console.log('VAPID public key received, waiting for service worker...');

      // Get service worker registration and wait for it to be active
      const registration = await navigator.serviceWorker.ready;
      
      // Extra check: ensure service worker is actually active
      if (!registration.active) {
        throw new Error('Service worker is not active');
      }

      console.log('Service worker ready, attempting push subscription...');
      console.log('Service worker state:', registration.active.state);

      // Subscribe to push
      let subscription;
      try {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidData.public_key),
        });
        console.log('Push subscription successful!');
      } catch (subError) {
        console.error('Push subscription error:', subError);
        throw new Error(`Failed to subscribe to push: ${subError instanceof Error ? subError.message : 'Unknown error'}`);
      }

      // Send subscription to server
      const subscribeResponse = await fetch(`${API_BASE}/push/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: arrayBufferToBase64(subscription.getKey('p256dh')),
            auth: arrayBufferToBase64(subscription.getKey('auth')),
          },
        }),
      });

      if (!subscribeResponse.ok) {
        const errorData = await subscribeResponse.json().catch(() => ({}));
        throw new Error(errorData.detail || `Failed to save subscription on server: ${subscribeResponse.status}`);
      }

      setState(prev => ({
        ...prev,
        isSubscribed: true,
        isLoading: false,
        permission: 'granted',
        error: null,
      }));

      return true;
    } catch (error) {
      console.error('Failed to subscribe to push:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to subscribe',
      }));
      return false;
    }
  }, [checkSupport, token, requestPermission]);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!checkSupport()) return false;

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Unsubscribe from push manager
        await subscription.unsubscribe();

        // Remove subscription from server
        if (token) {
          await fetch(`${API_BASE}/push/unsubscribe?endpoint=${encodeURIComponent(subscription.endpoint)}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });
        }
      }

      setState(prev => ({
        ...prev,
        isSubscribed: false,
        isLoading: false,
        error: null,
      }));

      return true;
    } catch (error) {
      console.error('Failed to unsubscribe from push:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to unsubscribe',
      }));
      return false;
    }
  }, [checkSupport, token]);

  // Send a test notification
  const sendTestNotification = useCallback(async (): Promise<boolean> => {
    if (!token) return false;

    try {
      const response = await fetch(`${API_BASE}/push/test`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to send test notification');
      }

      const data = await response.json();
      return data.success && data.sent > 0;
    } catch (error) {
      console.error('Failed to send test notification:', error);
      return false;
    }
  }, [token]);

  return {
    ...state,
    subscribe,
    unsubscribe,
    requestPermission,
    sendTestNotification,
  };
}

export default usePushNotifications;
