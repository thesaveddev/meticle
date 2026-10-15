import { setupDatabase } from '../shared/database/setup'
import { ensureRlsTestRole } from './rlsTestRole'
import { closeDatabasePools } from '../shared/database'
import { closeRedis } from '../shared/redis'
import { EventWorker } from '../modules/events/events.worker'
import { EmailQueue } from '../shared/utils/email.queue'

export async function setup() {
  await setupDatabase()

  // Anything that grants privileges or alters tables belongs here, before the
  // workers exist, and never inside a suite. The RLS suite's role needs both,
  // and doing it from its own beforeAll once deadlocked a parallel suite mid-run
  // — the reasoning and the measurement are in ./rlsTestRole.ts.
  await ensureRlsTestRole()

  process.env.VITEST = 'true'

  return async () => {
    EventWorker.stop()
    EmailQueue.stopProcessor()
    await closeRedis()
    await closeDatabasePools()
  }
}
