import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';
import { cacheService, CACHE_KEYS } from './cacheService';

export type KhataEntryType = 'GAVE' | 'GOT' | 'SETTLE'; // GAVE = Lent (Receivable), GOT = Borrowed (Payable), SETTLE = Settled

export interface KhataTransaction {
  id: string;
  personId: string;
  personName: string;
  type: KhataEntryType;
  settlementType?: 'RECEIVED' | 'PAID';
  amount: number;
  date: string; // ISO date string
  note?: string;
  dueDate?: string;
  createdAt: string;
}

export interface KhataPerson {
  id: string;
  name: string;
  phone?: string;
  color: string;
  totalGave: number; // Lent
  totalGot: number;  // Borrowed
  netBalance: number; // positive = Receivable, negative = Payable, 0 = Settled
  lastTxnDate: string;
  lastNote?: string;
  txnCount: number;
}

export interface KhataSummary {
  totalReceivable: number; // Total to receive (positive balances)
  totalPayable: number;    // Total to pay (negative balances)
  netBalance: number;      // Difference
  totalPersons: number;
}

// Legacy LocalStorage keys for one-time seamless migration to PostgreSQL DB
const LEGACY_STORAGE_KEYS = {
  PERSONS: '@accounts_book_persons_v2',
  TXNS: '@accounts_book_txns_v2',
  MIGRATED: '@accounts_book_migrated_to_db_v1',
};

// Data Mapper Helpers (Backend snake_case <-> Frontend camelCase)
function mapPersonFromApi(raw: any): KhataPerson {
  return {
    id: String(raw.id),
    name: raw.name || '',
    phone: raw.phone || undefined,
    color: raw.color || '#3B82F6',
    totalGave: Number(raw.total_gave ?? raw.totalGave ?? 0),
    totalGot: Number(raw.total_got ?? raw.totalGot ?? 0),
    netBalance: Number(raw.net_balance ?? raw.netBalance ?? 0),
    lastTxnDate: raw.last_txn_date || raw.lastTxnDate || raw.created_at || new Date().toISOString(),
    lastNote: raw.last_note || raw.lastNote || undefined,
    txnCount: Number(raw.txn_count ?? raw.txnCount ?? 0),
  };
}

function mapTxnFromApi(raw: any): KhataTransaction {
  return {
    id: String(raw.id),
    personId: String(raw.person_id ?? raw.personId),
    personName: raw.person_name || raw.personName || '',
    type: raw.type as KhataEntryType,
    settlementType: raw.settlement_type || raw.settlementType,
    amount: Number(raw.amount || 0),
    date: raw.date || raw.created_at || new Date().toISOString(),
    note: raw.note || undefined,
    dueDate: raw.due_date || raw.dueDate || undefined,
    createdAt: raw.created_at || raw.createdAt || new Date().toISOString(),
  };
}

function mapSummaryFromApi(raw: any): KhataSummary {
  return {
    totalReceivable: Number(raw.total_receivable ?? raw.totalReceivable ?? 0),
    totalPayable: Number(raw.total_payable ?? raw.totalPayable ?? 0),
    netBalance: Number(raw.net_balance ?? raw.netBalance ?? 0),
    totalPersons: Number(raw.total_persons ?? raw.totalPersons ?? 0),
  };
}

class KhataService {
  private migrationChecked = false;

  /**
   * One-time check to migrate any old local storage ledger items directly into PostgreSQL backend.
   */
  async ensureMigrated(): Promise<void> {
    if (this.migrationChecked) return;
    this.migrationChecked = true;

    try {
      const alreadyMigrated = await AsyncStorage.getItem(LEGACY_STORAGE_KEYS.MIGRATED);
      if (alreadyMigrated === 'true') return;

      const rawTxns = await AsyncStorage.getItem(LEGACY_STORAGE_KEYS.TXNS);
      if (rawTxns) {
        const txns = JSON.parse(rawTxns);
        if (Array.isArray(txns) && txns.length > 0) {
          const syncItems = txns.map((t: any) => ({
            person_name: t.personName || 'Contact',
            phone: t.phone || undefined,
            type: t.type || 'GAVE',
            amount: Number(t.amount || 0),
            date: t.date || new Date().toISOString(),
            note: t.note || undefined,
            due_date: t.dueDate || undefined,
          }));

          await api.post('/khata/sync', { items: syncItems });
          // Clean legacy keys once uploaded to main database
          await AsyncStorage.removeItem(LEGACY_STORAGE_KEYS.PERSONS);
          await AsyncStorage.removeItem(LEGACY_STORAGE_KEYS.TXNS);
        }
      }
      await AsyncStorage.setItem(LEGACY_STORAGE_KEYS.MIGRATED, 'true');
    } catch (e) {
      console.warn('[KhataService] Migration to database check:', e);
    }
  }

  /**
   * Fetch all contacts from the PostgreSQL backend database with indexed sorting.
   * Uses local cache for 0ms immediate render.
   */
  async getPersons(): Promise<KhataPerson[]> {
    await this.ensureMigrated();

    try {
      const response = await api.get('/khata/persons');
      const persons: KhataPerson[] = (response.data || []).map(mapPersonFromApi);

      // Refresh cache in background
      cacheService.set(CACHE_KEYS.KHATA_PERSONS, persons).catch(() => {});
      return persons;
    } catch (error) {
      console.warn('[KhataService] Error fetching persons from database, falling back to cache:', error);
      const cached = await cacheService.get<KhataPerson[]>(CACHE_KEYS.KHATA_PERSONS);
      return cached || [];
    }
  }

  /**
   * Fetch all transactions for a specific person from the PostgreSQL backend database.
   * Utilizes index `ix_khata_txns_person_id_date`.
   */
  async getPersonTransactions(personId: string): Promise<KhataTransaction[]> {
    try {
      const response = await api.get(`/khata/persons/${personId}/transactions`);
      return (response.data || []).map(mapTxnFromApi);
    } catch (error) {
      console.warn(`[KhataService] Error fetching transactions for person ${personId}:`, error);
      return [];
    }
  }

  /**
   * Add a new transaction (Lent or Borrowed) directly into the PostgreSQL database.
   */
  async addTransaction(payload: {
    personName: string;
    phone?: string;
    type: KhataEntryType;
    amount: number;
    note?: string;
    date?: string;
    dueDate?: string;
  }): Promise<{ transaction: KhataTransaction; person: KhataPerson }> {
    await this.ensureMigrated();

    const requestPayload = {
      person_name: payload.personName.trim(),
      phone: payload.phone?.trim() || null,
      type: payload.type,
      amount: Math.abs(Number(payload.amount)) || 0,
      note: payload.note?.trim() || null,
      date: payload.date || new Date().toISOString(),
      due_date: payload.dueDate || null,
    };

    const response = await api.post('/khata/transactions', requestPayload);
    const data = response.data;

    const mappedTxn = mapTxnFromApi(data.transaction);
    const mappedPerson = mapPersonFromApi(data.person);

    return { transaction: mappedTxn, person: mappedPerson };
  }

  /**
   * Edit an existing person (Name, Phone) in PostgreSQL database.
   */
  async editPerson(personId: string, updates: { name: string; phone?: string }): Promise<KhataPerson | null> {
    try {
      const response = await api.put(`/khata/persons/${personId}`, {
        name: updates.name.trim(),
        phone: updates.phone?.trim() || null,
      });
      return mapPersonFromApi(response.data);
    } catch (error) {
      console.warn(`[KhataService] Error editing person ${personId}:`, error);
      throw error;
    }
  }

  /**
   * Edit an existing transaction in PostgreSQL database.
   */
  async editTransaction(
    txnId: string,
    updates: {
      type: KhataEntryType;
      amount: number;
      note?: string;
      date?: string;
      dueDate?: string;
    }
  ): Promise<KhataTransaction | null> {
    try {
      const response = await api.put(`/khata/transactions/${txnId}`, {
        type: updates.type,
        amount: Math.abs(Number(updates.amount)) || 0,
        note: updates.note?.trim() || null,
        date: updates.date || null,
        due_date: updates.dueDate || null,
      });
      return mapTxnFromApi(response.data);
    } catch (error) {
      console.warn(`[KhataService] Error editing transaction ${txnId}:`, error);
      throw error;
    }
  }

  /**
   * Settle an entire account (Balance brought to 0) in PostgreSQL database.
   */
  async settlePerson(personId: string, note: string = 'Account settled'): Promise<KhataPerson | null> {
    try {
      const response = await api.post(`/khata/persons/${personId}/settle`, { note });
      return mapPersonFromApi(response.data);
    } catch (error) {
      console.warn(`[KhataService] Error settling person ${personId}:`, error);
      throw error;
    }
  }

  /**
   * Delete a transaction from the PostgreSQL database.
   */
  async deleteTransaction(txnId: string): Promise<void> {
    try {
      await api.delete(`/khata/transactions/${txnId}`);
    } catch (error) {
      console.warn(`[KhataService] Error deleting transaction ${txnId}:`, error);
      throw error;
    }
  }

  /**
   * Delete a person and all their ledger transactions permanently from the PostgreSQL database.
   */
  async deletePerson(personId: string): Promise<void> {
    try {
      await api.delete(`/khata/persons/${personId}`);
    } catch (error) {
      console.warn(`[KhataService] Error deleting person ${personId}:`, error);
      throw error;
    }
  }

  /**
   * Get overall summary from PostgreSQL backend database.
   */
  async getSummary(): Promise<KhataSummary> {
    try {
      const response = await api.get('/khata/summary');
      const sum = mapSummaryFromApi(response.data);
      cacheService.set(CACHE_KEYS.KHATA_SUMMARY, sum).catch(() => {});
      return sum;
    } catch (error) {
      console.warn('[KhataService] Error fetching summary from database, checking cache:', error);
      const cached = await cacheService.get<KhataSummary>(CACHE_KEYS.KHATA_SUMMARY);
      return cached || {
        totalReceivable: 0,
        totalPayable: 0,
        netBalance: 0,
        totalPersons: 0,
      };
    }
  }
}

export const khataService = new KhataService();
