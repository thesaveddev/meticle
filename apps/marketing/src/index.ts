import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'
import apiRoutes from './routes/api'
import unsubscribeRoutes from './routes/unsubscribe'
import { seedTemplates } from './email/templates'

const app = express()
const PORT = parseInt(process.env.PORT || '3005')

app.use(cors())
app.use(express.json({ limit: '1mb' }))
// The unsubscribe page confirms with a plain HTML form, and a mail client's
// one-click button posts a form body too — neither is JSON.
app.use(express.urlencoded({ extended: false }))

// API routes
app.use('/api', apiRoutes)

// Public opt-out. Outside `/api` because it is a link a recipient follows, not an
// endpoint the dashboard calls, and outside authentication because the people who
// use it have no account here.
app.use('/', unsubscribeRoutes)

// Serve static dashboard
app.use(express.static(path.resolve(__dirname, '../public')))

// Seed initial templates
seedTemplates()

app.listen(PORT, () => {
  console.log(`Marketing tool running on http://localhost:${PORT}`)
  console.log(`Dashboard: http://localhost:${PORT}`)
  console.log(`API: http://localhost:${PORT}/api`)
})
