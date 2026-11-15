import { COMPLETION_RECORDS_VERSION, loadCompletionRecords, type CompletionAttempt, type CompletionData, type LoadedCompletions } from "../model/completionLedger";

/** Owns durable completion history; persist is main.persistAll, never a second writer. */
export class CompletionStore {
 private state: LoadedCompletions = { records: [], initialized: false };
 private readonly listeners = new Set<() => void>();
 constructor(private readonly deps: { persist: () => Promise<void>; capacity?: number }) {}
 load(data: unknown): void { this.state = loadCompletionRecords(data); this.emit(); }
 records(): CompletionAttempt[] { return structuredClone(this.state.records); }
 available(): boolean { return !this.state.quarantine && (this.state.records.length < (this.deps.capacity ?? 1000) || this.state.records.some(r => r.phase === "confirmed")); }
 async saveRecord(record: CompletionAttempt): Promise<void> {
  if (this.state.quarantine) throw new Error("Completion history needs attention");
  const records = this.state.records.filter(r => r.attemptId !== record.attemptId);
  const capacity = this.deps.capacity ?? 1000;
  while (records.length >= capacity) {
   const index = records.findIndex(r => r.phase === "confirmed");
   if (index < 0) throw new Error("Completion safety history is full");
   records.splice(index, 1);
  }
  records.push(structuredClone(record));
  const next = loadCompletionRecords({ completionRecordsVersion: COMPLETION_RECORDS_VERSION, completionRecords: records });
  if (next.quarantine) throw new Error("Invalid completion record");
  this.state = next;
  try { await this.deps.persist(); } finally { this.emit(); }
 }
 serialize(): CompletionData {
  if (this.state.quarantine) return structuredClone(this.state.quarantine);
  return this.state.initialized ? { completionRecordsVersion: COMPLETION_RECORDS_VERSION, completionRecords: this.records() } : {};
 }
 subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
 private emit(): void { for (const listener of this.listeners) { try { listener(); } catch { /* A view cannot discard history. */ } } }
}
