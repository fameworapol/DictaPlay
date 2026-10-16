import 'fake-indexeddb/auto'
import { getDb, resetDbCacheForTests } from '../../src/lib/storage/db'

/** Wipes the fake IndexedDB database and the module-level connection cache between tests. */
export async function resetStorageForTests(): Promise<void> {
  // Close any open connection first — otherwise deleteDatabase only fires
  // "blocked" (never "success"), and the next test's open() call hangs
  // behind the still-pending delete.
  const db = await getDb()
  db?.close()
  resetDbCacheForTests()

  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('english-dictation')
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
    req.onblocked = () => resolve()
  })
}
