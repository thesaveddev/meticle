# CareDesk - Healthcare Workforce Management Platform

## Tech Stack
- **Frontend**: React, TypeScript, MUI
- **Backend**: Node.js, Express, TypeScript (Modular Monolith)
- **Database**: PostgreSQL
- **Cache**: Redis

## Prerequisites
- Docker & Docker Compose
- Node.js 18+

## Getting Started

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Start Infrastructure**
   ```bash
   docker-compose up -d
   ```

3. **Running the application**
   - Backend: `npm run dev -w apps/api`
   - Frontend: `npm run dev -w apps/web`

## License
MIT
