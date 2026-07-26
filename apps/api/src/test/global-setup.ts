import { setupDatabase } from '../shared/database/setup'

export async function setup() {
  await setupDatabase()
}
