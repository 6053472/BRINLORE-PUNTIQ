import 'dotenv/config'
import path from 'node:path'
import { defineConfig } from 'prisma/config'

// Met een config-bestand laadt Prisma .env niet meer zelf; dat doet dotenv hierboven.
export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    path: path.join('prisma', 'migrations'),
    seed: 'tsx prisma/seed.ts',
  },
})
