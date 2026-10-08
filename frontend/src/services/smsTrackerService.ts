import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';

let RNNotificationListener: any = null;
try {
  RNNotificationListener = require('react-native-android-notification-listener').default;
} catch (e) {
  // Graceful fallback for non-Android / Expo Go
}

export interface ProcessedSmsRecord {
  id: string;
  rawText: string;
  sender?: string;
  timestamp: string;
  amount: number;
  merchant: string;
  category: string;
  type: string;
  refNumber?: string;
}

const STORAGE_KEYS = {
  SMS_AUTO_TRACKING_ENABLED: '@expense_ai_sms_tracking_enabled',
  PROCESSED_REF_NUMBERS: '@expense_ai_processed_sms_refs',
  RECENT_SMS_RECORDS: '@expense_ai_recent_sms_records',
};

class SmsTrackerService {
  /**
   * Checks if Android Notification Listener permission is granted.
   */
  async checkPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return true; // Simulation mode for web/iOS
    }

    try {
      if (RNNotificationListener && typeof RNNotificationListener.getPermissionStatus === 'function') {
        const status = await RNNotificationListener.getPermissionStatus();
        return status === 'authorized';
      }
      return false;
    } catch (e) {
      console.warn('Error checking notification listener permissions:', e);
      return false;
    }
  }

  /**
   * Prompts user to grant Android Notification Listener access.
   */
  async requestPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      await this.setAutoTrackingEnabled(true);
      return true;
    }

    try {
      if (RNNotificationListener && typeof RNNotificationListener.requestPermission === 'function') {
        RNNotificationListener.requestPermission();
        // Give time for user to toggle and return
        return true;
      }
      return false;
    } catch (e) {
      console.warn('Error requesting notification listener permissions:', e);
      return false;
    }
  }

  /**
   * Check if user has toggled auto-tracking ON in app settings.
   */
  async isAutoTrackingEnabled(): Promise<boolean> {
    try {
      const val = await AsyncStorage.getItem(STORAGE_KEYS.SMS_AUTO_TRACKING_ENABLED);
      return val === 'true';
    } catch {
      return false;
    }
  }

  /**
   * Enable or disable auto-tracking.
   */
  async setAutoTrackingEnabled(enabled: boolean): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SMS_AUTO_TRACKING_ENABLED, enabled ? 'true' : 'false');
    } catch (e) {
      console.warn('Failed to save SMS tracking setting:', e);
    }
  }

  /**
   * Checks whether an SMS or Notification is a valid financial transaction (not an OTP or marketing).
   */
  isFinancialSms(text: string): boolean {
    if (!text || typeof text !== 'string') return false;
    const textLower = text.toLowerCase();

    // Ignore OTP messages immediately
    if (
      (textLower.includes('otp') ||
        textLower.includes('verification code') ||
        textLower.includes('one time password') ||
        textLower.includes('login code')) &&
      !textLower.includes('debited') &&
      !textLower.includes('credited')
    ) {
      return false;
    }

    // Must have financial keywords
    const hasFinancialKeywords = [
      'debited',
      'credited',
      'spent',
      'paid',
      'transferred',
      'sent',
      'received',
      'vpa',
      'upi',
      'inr',
      'rs.',
      'rs ',
      'a/c',
      'acct',
    ].some((kw) => textLower.includes(kw));

    return hasFinancialKeywords;
  }

  /**
   * Processes a background notification received by RNAndroidNotificationListener.
   */
  async processIncomingNotification(notificationData: any): Promise<ProcessedSmsRecord | null> {
    try {
      const enabled = await this.isAutoTrackingEnabled();
      if (!enabled) return null;

      const title = notificationData?.title || '';
      const text = notificationData?.text || notificationData?.subText || '';
      const combined = `${title} ${text}`.trim();

      if (!this.isFinancialSms(combined)) {
        return null;
      }

      // Check deduplication
      const existingRefs = await this.getProcessedRefNumbers();
      // Extract reference number if present
      const refMatch = combined.match(/(?:ref(?:erence)?(?:\s*(?:no|id|num))?[:.\s]*|[#\-])([A-Za-z0-9]{8,16})/i);
      const refNumber = refMatch ? refMatch[1] : null;

      if (refNumber && existingRefs.includes(refNumber)) {
        return null; // Already processed
      }

      const record = await this.processSms(combined, title || 'Bank SMS Alert');

      if (record && refNumber) {
        await this.addProcessedRefNumber(refNumber);
      }

      return record;
    } catch (err) {
      console.warn('Error processing incoming background notification:', err);
      return null;
    }
  }

  /**
   * Ingest and parse an SMS text through AI backend (/transactions/auto-detect).
   */
  async processSms(text: string, sender: string = 'Bank SMS'): Promise<ProcessedSmsRecord | null> {
    if (!this.isFinancialSms(text)) {
      return null;
    }

    try {
      // 1. Post to backend auto-detect endpoint
      const response = await api.post('/transactions/auto-detect', {
        text,
        source: 'SMS',
      });

      const txn = response.data;

      // 2. Format processed record
      const record: ProcessedSmsRecord = {
        id: txn.id?.toString() || Date.now().toString(),
        rawText: text,
        sender,
        timestamp: txn.date || new Date().toISOString(),
        amount: parseFloat(txn.amount) || 0,
        merchant: txn.merchant || 'UPI Merchant',
        category: txn.category?.name || 'Others',
        type: txn.type || 'Expense',
        refNumber: txn.ref_number || undefined,
      };

      // 3. Cache to recent SMS records
      await this.saveRecentRecord(record);

      return record;
    } catch (error: any) {
      console.warn('Error auto-detecting SMS transaction:', error?.response?.data || error);
      throw error;
    }
  }

  /**
   * Deduplication reference numbers
   */
  private async getProcessedRefNumbers(): Promise<string[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.PROCESSED_REF_NUMBERS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  private async addProcessedRefNumber(ref: string): Promise<void> {
    try {
      const existing = await this.getProcessedRefNumbers();
      const updated = [ref, ...existing].slice(0, 200);
      await AsyncStorage.setItem(STORAGE_KEYS.PROCESSED_REF_NUMBERS, JSON.stringify(updated));
    } catch (e) {
      console.warn('Error caching ref number:', e);
    }
  }

  /**
   * Save processed SMS to local history for quick UI display.
   */
  private async saveRecentRecord(record: ProcessedSmsRecord): Promise<void> {
    try {
      const existing = await this.getRecentRecords();
      // Prepend and limit to 50 items
      const updated = [record, ...existing.filter((r) => r.id !== record.id)].slice(0, 50);
      await AsyncStorage.setItem(STORAGE_KEYS.RECENT_SMS_RECORDS, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed saving recent SMS record:', e);
    }
  }

  /**
   * Retrieve list of recently auto-tracked SMS transactions.
   */
  async getRecentRecords(): Promise<ProcessedSmsRecord[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.RECENT_SMS_RECORDS);
      if (data) {
        return JSON.parse(data);
      }
      return [];
    } catch {
      return [];
    }
  }

  /**
   * Clear recent records.
   */
  async clearRecentRecords(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.RECENT_SMS_RECORDS);
    } catch (e) {
      console.warn('Failed clearing recent SMS records:', e);
    }
  }

  /**
   * Realistic sample Indian Bank & UPI SMS messages for instant simulation & testing.
   */
  getSampleSmsList(): { title: string; subtitle: string; text: string; icon: string }[] {
    return [
      {
        title: 'HDFC Bank → Swiggy Food',
        subtitle: 'Food Delivery • ₹350.00',
        icon: '🍔',
        text: `Sent Rs. 350.00 from HDFC Bank A/C **1234 to SWIGGY on 08-10-26 via UPI Ref 428192849182. Bal: Rs. 14,250.00`,
      },
      {
        title: 'SBI UPI → Ramesh Tea Stall',
        subtitle: 'Tea & Snacks • ₹120.00',
        icon: '☕',
        text: `Dear UPI user A/C 9876 debited by 120.0 on 08Oct26 by transfer to Ramesh Tea Stall Ref No 428172918192 -SBI`,
      },
      {
        title: 'PhonePe → Rahul Sharma (P2P)',
        subtitle: 'Friend Transfer • ₹1,500.00',
        icon: '👤',
        text: `Paid Rs. 1,500.00 to Rahul Sharma using PhonePe UPI. UPI Ref ID 428192839182. Debited from A/c XX5678.`,
      },
      {
        title: 'ICICI Bank → Sharma Kirana Store',
        subtitle: 'Daily Grocery • ₹850.00',
        icon: '🛒',
        text: `ICICI Bank Acct XX456 debited for Rs 850.00 on 08-OCT-26; UPI/P2M/428192837192/Sharma Kirana Store. Avbl Bal Rs 45,210.00`,
      },
      {
        title: 'Axis Bank → Indian Oil Fuel',
        subtitle: 'Petrol Pump • ₹500.00',
        icon: '⛽',
        text: `INR 500.00 debited from A/c no. XX8899 on 08-10-2026 towards Indian Oil Petrol Pump via UPI Ref 428199201928. Avail Bal: INR 32,400.00`,
      },
      {
        title: 'Bank Credit → Company Salary',
        subtitle: 'Monthly Income • ₹45,000.00',
        icon: '💰',
        text: `Your A/C XX1234 is credited with INR 45,000.00 on 08-10-2026 by Tech Corp Salary. UPI Ref 428192801922. Available balance: INR 65,400.00`,
      },
    ];
  }
}

export const smsTrackerService = new SmsTrackerService();
