import { useState, useEffect } from 'react';
import { Bell, Mail, Smartphone, Package, Truck, AlertCircle, Megaphone, Loader2 } from 'lucide-react';
import { notificationService, NotificationPreferences } from '../services/notificationService';

const NotificationSettings = () => {
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    email_enabled: true,
    push_enabled: true,
    order_confirmation: true,
    shipment_updates: true,
    delivery_alerts: true,
    marketing: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    loadPreferences();
    checkPushSupport();
  }, []);

  const loadPreferences = async () => {
    setLoading(true);
    const prefs = await notificationService.getPreferences();
    if (prefs) {
      setPreferences(prefs);
    }
    setLoading(false);
  };

  const checkPushSupport = async () => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window;
    setPushSupported(supported);
    
    if (supported && 'Notification' in window) {
      setPushPermission(Notification.permission);
    }
  };

  const handleToggle = async (key: keyof NotificationPreferences) => {
    const newValue = !preferences[key];
    setPreferences((prev) => ({ ...prev, [key]: newValue }));
    
    setSaving(true);
    await notificationService.updatePreferences({ [key]: newValue });
    setSaving(false);
  };

  const handleEnablePush = async () => {
    const permission = await notificationService.requestPermission();
    setPushPermission(permission);
    
    if (permission === 'granted') {
      await notificationService.init();
      await notificationService.subscribeToPush();
      setPreferences((prev) => ({ ...prev, push_enabled: true }));
      await notificationService.updatePreferences({ push_enabled: true });
    }
  };

  const handleDisablePush = async () => {
    await notificationService.unsubscribeFromPush();
    setPreferences((prev) => ({ ...prev, push_enabled: false }));
    await notificationService.updatePreferences({ push_enabled: false });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-gradient-to-r from-green-400/20 to-cyan-400/20 rounded-lg">
          <Bell className="w-6 h-6 text-cyan-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Notification Settings</h2>
          <p className="text-sm text-gray-400">Manage how you receive updates</p>
        </div>
        {saving && (
          <div className="ml-auto flex items-center gap-2 text-sm text-cyan-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            Saving...
          </div>
        )}
      </div>

      {/* Notification Channels */}
      <div className="space-y-4 mb-8">
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
          Notification Channels
        </h3>

        {/* Email Toggle */}
        <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
          <div className="flex items-center gap-3">
            <Mail className="w-5 h-5 text-green-400" />
            <div>
              <p className="font-medium text-white">Email Notifications</p>
              <p className="text-sm text-gray-400">Receive updates via email</p>
            </div>
          </div>
          <button
            onClick={() => handleToggle('email_enabled')}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              preferences.email_enabled
                ? 'bg-gradient-to-r from-green-400 to-cyan-400'
                : 'bg-gray-600'
            }`}
          >
            <span
              className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                preferences.email_enabled ? 'left-7' : 'left-1'
              }`}
            />
          </button>
        </div>

        {/* Push Toggle */}
        <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
          <div className="flex items-center gap-3">
            <Smartphone className="w-5 h-5 text-blue-400" />
            <div>
              <p className="font-medium text-white">Push Notifications</p>
              <p className="text-sm text-gray-400">
                {!pushSupported
                  ? 'Not supported in this browser'
                  : pushPermission === 'denied'
                  ? 'Blocked - enable in browser settings'
                  : 'Real-time alerts on your device'}
              </p>
            </div>
          </div>
          {pushSupported && pushPermission !== 'denied' && (
            preferences.push_enabled ? (
              <button
                onClick={handleDisablePush}
                className="relative w-12 h-6 rounded-full bg-gradient-to-r from-green-400 to-cyan-400 transition-colors"
              >
                <span className="absolute top-1 left-7 w-4 h-4 bg-white rounded-full" />
              </button>
            ) : (
              <button
                onClick={handleEnablePush}
                className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-medium rounded-lg text-sm transition-colors"
              >
                Enable
              </button>
            )
          )}
        </div>
      </div>

      {/* Notification Types */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
          Notification Types
        </h3>

        {/* Order Confirmation */}
        <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
          <div className="flex items-center gap-3">
            <Package className="w-5 h-5 text-emerald-400" />
            <div>
              <p className="font-medium text-white">Order Confirmations</p>
              <p className="text-sm text-gray-400">When your order is confirmed</p>
            </div>
          </div>
          <button
            onClick={() => handleToggle('order_confirmation')}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              preferences.order_confirmation
                ? 'bg-gradient-to-r from-green-400 to-cyan-400'
                : 'bg-gray-600'
            }`}
          >
            <span
              className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                preferences.order_confirmation ? 'left-7' : 'left-1'
              }`}
            />
          </button>
        </div>

        {/* Shipment Updates */}
        <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
          <div className="flex items-center gap-3">
            <Truck className="w-5 h-5 text-blue-400" />
            <div>
              <p className="font-medium text-white">Shipment Updates</p>
              <p className="text-sm text-gray-400">Tracking and delivery status</p>
            </div>
          </div>
          <button
            onClick={() => handleToggle('shipment_updates')}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              preferences.shipment_updates
                ? 'bg-gradient-to-r from-green-400 to-cyan-400'
                : 'bg-gray-600'
            }`}
          >
            <span
              className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                preferences.shipment_updates ? 'left-7' : 'left-1'
              }`}
            />
          </button>
        </div>

        {/* Delivery Alerts */}
        <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-400" />
            <div>
              <p className="font-medium text-white">Delivery Alerts</p>
              <p className="text-sm text-gray-400">Issues and exceptions</p>
            </div>
          </div>
          <button
            onClick={() => handleToggle('delivery_alerts')}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              preferences.delivery_alerts
                ? 'bg-gradient-to-r from-green-400 to-cyan-400'
                : 'bg-gray-600'
            }`}
          >
            <span
              className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                preferences.delivery_alerts ? 'left-7' : 'left-1'
              }`}
            />
          </button>
        </div>

        {/* Marketing */}
        <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
          <div className="flex items-center gap-3">
            <Megaphone className="w-5 h-5 text-purple-400" />
            <div>
              <p className="font-medium text-white">Marketing & Promotions</p>
              <p className="text-sm text-gray-400">Deals and special offers</p>
            </div>
          </div>
          <button
            onClick={() => handleToggle('marketing')}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              preferences.marketing
                ? 'bg-gradient-to-r from-green-400 to-cyan-400'
                : 'bg-gray-600'
            }`}
          >
            <span
              className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                preferences.marketing ? 'left-7' : 'left-1'
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotificationSettings;
