import 'dotenv/config'
import pg from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client.js'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

async function seedOptions(model, values, numeric = false) {
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]
    await prisma[model].upsert({
      where: numeric ? { value } : { name: value },
      update: { active: true, sortOrder: index },
      create: numeric ? { value, label: value.toLocaleString('en-IN'), sortOrder: index } : { name: value, sortOrder: index },
    })
  }
}

async function main() {
  await seedOptions('partyOption', ['PANCHASHEEL'])
  await seedOptions('gsmOption', [58, 70, 90, 120, 130, 250], true)
  await seedOptions('paperType', ['ART', 'MAP', 'DUPLEX', 'BOND', 'STICKER'])
  await seedOptions('counterOption', [500, 540, 550, 1000, 1100, 1200, 1500, 2000, 3000, 4000], true)
  await seedOptions('paperSize', ['A4', 'A3', '8.5 x 11'])
  await seedOptions('printingSideOption', ['1 SIDE', '2 SIDE', 'FRONT', 'BACK'])
  await seedOptions('quantityOption', [1000, 2000, 3000, 4000, 9000], true)
  console.log('Omlata dropdown catalog seeded.')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
}).finally(async () => {
  await prisma.$disconnect()
  await pool.end()
})