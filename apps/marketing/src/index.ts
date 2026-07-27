import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'
import apiRoutes from './routes/api'
import { seedTemplates } from './email/templates'

const app = express()
const PORT = parseInt(process.env.PORT || '3005')

app.use(cors())
app.use(express.json({ limit: '1mb' }))

// API routes
app.use('/api', apiRoutes)

// Serve static dashboard
app.use(express.static(path.resolve(__dirname, '../public')))

// Seed initial templates
seedTemplates()

app.listen(PORT, () => {
  console.log(`Marketing tool running on http://localhost:${PORT}`)
  console.log(`Dashboard: http://localhost:${PORT}`)
  console.log(`API: http://localhost:${PORT}/api`)
})
