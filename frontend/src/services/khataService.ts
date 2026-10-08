import AsyncStorage from '@react-native-async-storage/async-storage';

export type KhataEntryType = 'GAVE' | 'GOT' | 'SETTLE'; // GAVE = Maine Diye (Lena Hai), GOT = Maine Liye (Dena Hai), SETTLE = Hisab Barabar

export interface KhataTransaction {
  id: string;
  personId: string;
  personName: string;
  type: KhataEntryType;
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
  totalGave: number; // Maine Diye (Total lent)
  totalGot: number;  // Maine Liye (Total borrowed)
  netBalance: number; // positive = Lena Hai, negative = Dena Hai, 0 = Hisab Barabar
  lastTxnDate: string;
  lastNote?: string;
  txnCount: number;
}

export interface KhataSummary {
  totalReceivable: number; // Kul Lena Hai (You will get)
  totalPayable: number;    // Kul Dena Hai (You will give)
  netBalance: number;      // Difference
  totalPersons: number;
}

const STORAGE_KEYS = {
  KHATA_PERSONS: '@expense_ai_khata_persons_v1',
  KHATA_TXNS: '@expense_ai_khata_txns_v1',
};

const AVATAR_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', 
  '#06B6D4', '#F97316', '#6366F1', '#14B8A6'
];

class KhataService {
  /**
   * Seed default initial sample if first launch so user sees immediate data.
   */
  private async ensureInitialized(): Promise<{ persons: KhataPerson[]; txns: KhataTransaction[] }> {
    try {
      const rawPersons = await AsyncStorage.getItem(STORAGE_KEYS.KHATA_PERSONS);
      const rawTxns = await AsyncStorage.getItem(STORAGE_KEYS.KHATA_TXNS);

      if (rawPersons && rawTxns) {
        return {
          persons: JSON.parse(rawPersons),
          txns: JSON.parse(rawTxns),
        };
      }

      // Initial realistic seed: Deepak gave Aniket ₹1,500 udhaar, Rahul gave Deepak ₹500
      const initialPersons: KhataPerson[] = [
        {
          id: 'person_aniket',
          name: 'Aniket Sharma',
          phone: '+91 98765 43210',
          color: '#3B82F6',
          totalGave: 2000,
          totalGot: 500,
          netBalance: 1500, // +1500 Lena Hai
          lastTxnDate: new Date(Date.now() - 86400000 * 2).toISOString(),
          lastNote: 'Dinner split & Petrol udhaar',
          txnCount: 2,
        },
        {
          id: 'person_rahul',
          name: 'Rahul Verma',
          phone: '+91 98123 45678',
          color: '#EF4444',
          totalGave: 0,
          totalGot: 800,
          netBalance: -800, // -800 Dena Hai
          lastTxnDate: new Date(Date.now() - 86400000 * 4).toISOString(),
          lastNote: 'Lunch bill share',
          txnCount: 1,
        },
        {
          id: 'person_priya',
          name: 'Priya Singh',
          phone: '+91 99887 76655',
          color: '#10B981',
          totalGave: 3500,
          totalGot: 0,
          netBalance: 3500, // +3500 Lena Hai
          lastTxnDate: new Date(Date.now() - 86400000 * 7).toISOString(),
          lastNote: 'Shopping advance',
          txnCount: 1,
        },
      ];

      const initialTxns: KhataTransaction[] = [
        {
          id: 'txn_1',
          personId: 'person_aniket',
          personName: 'Aniket Sharma',
          type: 'GAVE',
          amount: 2000,
          date: new Date(Date.now() - 86400000 * 5).toISOString(),
          note: 'Emergency cash udhaar diya',
          dueDate: new Date(Date.now() + 86400000 * 5).toISOString(),
          createdAt: new Date().toISOString(),
        },
        {
          id: 'txn_2',
          personId: 'person_aniket',
          personName: 'Aniket Sharma',
          type: 'GOT',
          amount: 500,
          date: new Date(Date.now() - 86400000 * 2).toISOString(),
          note: 'Partially returned ₹500 via UPI',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'txn_3',
          personId: 'person_rahul',
          personName: 'Rahul Verma',
          type: 'GOT',
          amount: 800,
          date: new Date(Date.now() - 86400000 * 4).toISOString(),
          note: 'Cafe bill paid by Rahul (mujhe dene hain)',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'txn_4',
          personId: 'person_priya',
          personName: 'Priya Singh',
          type: 'GAVE',
          amount: 3500,
          date: new Date(Date.now() - 86400000 * 7).toISOString(),
          note: 'Grocery bill covered',
          createdAt: new Date().toISOString(),
        },
      ];

      await AsyncStorage.setItem(STORAGE_KEYS.KHATA_PERSONS, JSON.stringify(initialPersons));
      await AsyncStorage.setItem(STORAGE_KEYS.KHATA_TXNS, JSON.stringify(initialTxns));

      return { persons: initialPersons, txns: initialTxns };
    } catch {
      return { persons: [], txns: [] };
    }
  }

  /**
   * Get all persons with recalculated net balances.
   */
  async getPersons(): Promise<KhataPerson[]> {
    const { persons } = await this.ensureInitialized();
    return persons.sort((a, b) => new Date(b.lastTxnDate).getTime() - new Date(a.lastTxnDate).getTime());
  }

  /**
   * Get all transactions for a specific person.
   */
  async getPersonTransactions(personId: string): Promise<KhataTransaction[]> {
    const { txns } = await this.ensureInitialized();
    return txns
      .filter((t) => t.personId === personId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  /**
   * Add a new transaction (Maine Diye or Maine Liye).
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
    const { persons, txns } = await this.ensureInitialized();
    const cleanName = payload.personName.trim();
    const amount = Math.abs(Number(payload.amount)) || 0;
    const dateStr = payload.date || new Date().toISOString();

    // Find or create person
    let person = persons.find((p) => p.name.toLowerCase() === cleanName.toLowerCase());

    if (!person) {
      const randomColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
      person = {
        id: `person_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: cleanName,
        phone: payload.phone?.trim(),
        color: randomColor,
        totalGave: 0,
        totalGot: 0,
        netBalance: 0,
        lastTxnDate: dateStr,
        lastNote: payload.note,
        txnCount: 0,
      };
      persons.push(person);
    } else if (payload.phone?.trim() && !person.phone) {
      person.phone = payload.phone.trim();
    }

    const newTxn: KhataTransaction = {
      id: `txn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      personId: person.id,
      personName: person.name,
      type: payload.type,
      amount,
      date: dateStr,
      note: payload.note?.trim(),
      dueDate: payload.dueDate,
      createdAt: new Date().toISOString(),
    };

    txns.push(newTxn);

    // Recalculate person statistics
    this.recalculatePerson(person, txns);
    person.lastTxnDate = dateStr;
    person.lastNote = payload.note || (payload.type === 'GAVE' ? 'Maine diye' : 'Maine liye');

    await AsyncStorage.setItem(STORAGE_KEYS.KHATA_PERSONS, JSON.stringify(persons));
    await AsyncStorage.setItem(STORAGE_KEYS.KHATA_TXNS, JSON.stringify(txns));

    return { transaction: newTxn, person };
  }

  /**
   * Settle an entire account (Hisab Barabar).
   */
  async settlePerson(personId: string, note: string = 'Hisab barabar kiya'): Promise<KhataPerson | null> {
    const { persons, txns } = await this.ensureInitialized();
    const person = persons.find((p) => p.id === personId);
    if (!person) return null;

    if (person.netBalance === 0) return person;

    // If netBalance > 0 (lena tha), person paid us back (type: 'GOT' settlement)
    // If netBalance < 0 (dena tha), we paid them back (type: 'GAVE' settlement)
    const settleType: KhataEntryType = person.netBalance > 0 ? 'GOT' : 'GAVE';
    const settleAmount = Math.abs(person.netBalance);

    const settleTxn: KhataTransaction = {
      id: `txn_${Date.now()}_settle`,
      personId: person.id,
      personName: person.name,
      type: 'SETTLE',
      amount: settleAmount,
      date: new Date().toISOString(),
      note: `${note} (₹${settleAmount.toLocaleString()})`,
      createdAt: new Date().toISOString(),
    };

    txns.push(settleTxn);
    this.recalculatePerson(person, txns);
    person.lastTxnDate = settleTxn.date;
    person.lastNote = '🤝 Hisab Barabar (Settled)';

    await AsyncStorage.setItem(STORAGE_KEYS.KHATA_PERSONS, JSON.stringify(persons));
    await AsyncStorage.setItem(STORAGE_KEYS.KHATA_TXNS, JSON.stringify(txns));

    return person;
  }

  /**
   * Delete a transaction.
   */
  async deleteTransaction(txnId: string): Promise<void> {
    const { persons, txns } = await this.ensureInitialized();
    const targetIdx = txns.findIndex((t) => t.id === txnId);
    if (targetIdx === -1) return;

    const personId = txns[targetIdx].personId;
    txns.splice(targetIdx, 1);

    const person = persons.find((p) => p.id === personId);
    if (person) {
      this.recalculatePerson(person, txns);
    }

    await AsyncStorage.setItem(STORAGE_KEYS.KHATA_PERSONS, JSON.stringify(persons));
    await AsyncStorage.setItem(STORAGE_KEYS.KHATA_TXNS, JSON.stringify(txns));
  }

  /**
   * Delete a person and all their transactions.
   */
  async deletePerson(personId: string): Promise<void> {
    const { persons, txns } = await this.ensureInitialized();
    const updatedPersons = persons.filter((p) => p.id !== personId);
    const updatedTxns = txns.filter((t) => t.personId !== personId);

    await AsyncStorage.setItem(STORAGE_KEYS.KHATA_PERSONS, JSON.stringify(updatedPersons));
    await AsyncStorage.setItem(STORAGE_KEYS.KHATA_TXNS, JSON.stringify(updatedTxns));
  }

  /**
   * Recalculate totals for a person.
   */
  private recalculatePerson(person: KhataPerson, txns: KhataTransaction[]): void {
    const personTxns = txns.filter((t) => t.personId === person.id);
    let gave = 0;
    let got = 0;

    for (const t of personTxns) {
      if (t.type === 'GAVE') gave += t.amount;
      else if (t.type === 'GOT') got += t.amount;
      else if (t.type === 'SETTLE') {
        // Settlement clears the previous gap
      }
    }

    person.totalGave = gave;
    person.totalGot = got;
    person.netBalance = gave - got;
    person.txnCount = personTxns.length;
  }

  /**
   * Get overall Khata summary for Dashboard & Header.
   */
  async getSummary(): Promise<KhataSummary> {
    const persons = await this.getPersons();
    let totalReceivable = 0; // Lena Hai (+ve)
    let totalPayable = 0;    // Dena Hai (-ve)

    for (const p of persons) {
      if (p.netBalance > 0) {
        totalReceivable += p.netBalance;
      } else if (p.netBalance < 0) {
        totalPayable += Math.abs(p.netBalance);
      }
    }

    return {
      totalReceivable,
      totalPayable,
      netBalance: totalReceivable - totalPayable,
      totalPersons: persons.length,
    };
  }
}

export const khataService = new KhataService();
