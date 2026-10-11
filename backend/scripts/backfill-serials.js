import 'dotenv/config'
import pg from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client.js'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

async function main() {
  const jobs = await prisma.job.findMany({
    where: { serialNumber: null },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { id: true },
  })

  for (const job of jobs) {
    await prisma.$transaction(async (tx) => {
      const serial = await tx.recordSerial.create({ data: {} })
      await tx.job.update({ where: { id: job.id }, data: { serialNumber: serial.number } })
    })
  }

  console.log(`Assigned serial numbers to ${jobs.length} existing job(s).`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
}).finally(async () => {
  await prisma.$disconnect()
  await pool.end()
})
