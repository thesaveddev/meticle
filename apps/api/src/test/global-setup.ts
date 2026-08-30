import { setupDatabase } from '../shared/database/setup'
import { closeDatabasePools } from '../shared/database'
import { closeRedis } from '../shared/redis'
import { EventWorker } from '../modules/events/events.worker'
import { EmailQueue } from '../shared/utils/email.queue'

export async function setup() {
  await setupDatabase()
  process.env.VITEST = 'true'

  return async () => {
    EventWorker.stop()
    EmailQueue.stopProcessor()
    await closeRedis()
    await closeDatabasePools()
  }
}
