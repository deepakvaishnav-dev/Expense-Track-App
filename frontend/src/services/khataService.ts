import AsyncStorage from '@react-native-async-storage/async-storage';

export type KhataEntryType = 'GAVE' | 'GOT' | 'SETTLE'; // GAVE = Lent (Receivable), GOT = Borrowed (Payable), SETTLE = Settled

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

// Version 2 keys to ensure clean start without previous dummy data
const STORAGE_KEYS = {
  PERSONS: '@accounts_book_persons_v2',
  TXNS: '@accounts_book_txns_v2',
};

const AVATAR_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', 
  '#06B6D4', '#F97316', '#6366F1', '#14B8A6'
];

class KhataService {
  /**
   * Load clean persistent state (starts 100% empty, NO dummy data).
   */
  private async loadData(): Promise<{ persons: KhataPerson[]; txns: KhataTransaction[] }> {
    try {
      const rawPersons = await AsyncStorage.getItem(STORAGE_KEYS.PERSONS);
      const rawTxns = await AsyncStorage.getItem(STORAGE_KEYS.TXNS);

      const persons: KhataPerson[] = rawPersons ? JSON.parse(rawPersons) : [];
      const txns: KhataTransaction[] = rawTxns ? JSON.parse(rawTxns) : [];

      return { persons, txns };
    } catch {
      return { persons: [], txns: [] };
    }
  }

  private async saveData(persons: KhataPerson[], txns: KhataTransaction[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.PERSONS, JSON.stringify(persons));
      await AsyncStorage.setItem(STORAGE_KEYS.TXNS, JSON.stringify(txns));
    } catch (e) {
      console.warn('Error saving accounts book data:', e);
    }
  }

  /**
   * Get all persons sorted by most recent activity.
   */
  async getPersons(): Promise<KhataPerson[]> {
    const { persons } = await this.loadData();
    return persons.sort((a, b) => new Date(b.lastTxnDate).getTime() - new Date(a.lastTxnDate).getTime());
  }

  /**
   * Get all transactions for a specific person.
   */
  async getPersonTransactions(personId: string): Promise<KhataTransaction[]> {
    const { txns } = await this.loadData();
    return txns
      .filter((t) => t.personId === personId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  /**
   * Add a new transaction (Lent or Borrowed).
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
    const { persons, txns } = await this.loadData();
    const cleanName = payload.personName.trim();
    const amount = Math.abs(Number(payload.amount)) || 0;
    const dateStr = payload.date || new Date().toISOString();

    // Find existing person or create new
    let person = persons.find((p) => p.name.toLowerCase() === cleanName.toLowerCase());

    if (!person) {
      const randomColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
      person = {
        id: `person_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: cleanName,
        phone: payload.phone?.trim() || undefined,
        color: randomColor,
        totalGave: 0,
        totalGot: 0,
        netBalance: 0,
        lastTxnDate: dateStr,
        lastNote: payload.note,
        txnCount: 0,
      };
      persons.push(person);
    } else if (payload.phone?.trim()) {
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
    person.lastNote = payload.note || (payload.type === 'GAVE' ? 'Money Lent' : 'Money Borrowed');

    await this.saveData(persons, txns);
    return { transaction: newTxn, person };
  }

  /**
   * Edit an existing person (Name, Phone).
   */
  async editPerson(personId: string, updates: { name: string; phone?: string }): Promise<KhataPerson | null> {
    const { persons, txns } = await this.loadData();
    const person = persons.find((p) => p.id === personId);
    if (!person) return null;

    const newName = updates.name.trim();
    if (newName) {
      person.name = newName;
      // Update personName in their transactions
      txns.forEach((t) => {
        if (t.personId === personId) {
          t.personName = newName;
        }
      });
    }
    person.phone = updates.phone?.trim() || undefined;

    await this.saveData(persons, txns);
    return person;
  }

  /**
   * Edit an existing transaction.
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
    const { persons, txns } = await this.loadData();
    const txn = txns.find((t) => t.id === txnId);
    if (!txn) return null;

    txn.type = updates.type;
    txn.amount = Math.abs(Number(updates.amount)) || 0;
    txn.note = updates.note?.trim();
    if (updates.date) txn.date = updates.date;
    if (updates.dueDate !== undefined) txn.dueDate = updates.dueDate;

    const person = persons.find((p) => p.id === txn.personId);
    if (person) {
      this.recalculatePerson(person, txns);
    }

    await this.saveData(persons, txns);
    return txn;
  }

  /**
   * Settle an entire account (Balance brought to 0).
   */
  async settlePerson(personId: string, note: string = 'Account settled'): Promise<KhataPerson | null> {
    const { persons, txns } = await this.loadData();
    const person = persons.find((p) => p.id === personId);
    if (!person) return null;

    if (person.netBalance === 0) return person;

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
    person.lastNote = 'Settled';

    await this.saveData(persons, txns);
    return person;
  }

  /**
   * Delete a transaction.
   */
  async deleteTransaction(txnId: string): Promise<void> {
    const { persons, txns } = await this.loadData();
    const targetIdx = txns.findIndex((t) => t.id === txnId);
    if (targetIdx === -1) return;

    const personId = txns[targetIdx].personId;
    txns.splice(targetIdx, 1);

    const person = persons.find((p) => p.id === personId);
    if (person) {
      this.recalculatePerson(person, txns);
    }

    await this.saveData(persons, txns);
  }

  /**
   * Delete a person and all their transactions.
   */
  async deletePerson(personId: string): Promise<void> {
    const { persons, txns } = await this.loadData();
    const updatedPersons = persons.filter((p) => p.id !== personId);
    const updatedTxns = txns.filter((t) => t.personId !== personId);

    await this.saveData(updatedPersons, updatedTxns);
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
    }

    person.totalGave = gave;
    person.totalGot = got;
    person.netBalance = gave - got;
    person.txnCount = personTxns.length;
  }

  /**
   * Get overall summary for Dashboard & Header.
   */
  async getSummary(): Promise<KhataSummary> {
    const persons = await this.getPersons();
    let totalReceivable = 0; // Receivable (+ve)
    let totalPayable = 0;    // Payable (-ve)

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
