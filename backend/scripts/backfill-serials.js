import 'dotenv/config'
import pg from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client.js'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

async function main() {
  await prisma.$queryRaw`SELECT setval(pg_get_serial_sequence('"Job"', 'serialNumber'), GREATEST(COALESCE(MAX("serialNumber"), 1), 1), COUNT("serialNumber") > 0) FROM "Job"`
  await prisma.$queryRaw`SELECT setval(pg_get_serial_sequence('"Bill"', 'serialNumber'), GREATEST(COALESCE(MAX("serialNumber"), 1), 1), COUNT("serialNumber") > 0) FROM "Bill"`

  const jobs = await prisma.job.findMany({
    where: { serialNumber: null },
    orderBy: { id: 'asc' },
    select: { id: true },
  })

  for (const job of jobs) {
    const [next] = await prisma.$queryRaw`SELECT nextval(pg_get_serial_sequence('"Job"', 'serialNumber')) AS serial`
    await prisma.job.update({ where: { id: job.id }, data: { serialNumber: Number(next.serial) } })
  }

  console.log(`Synchronized independent job and bill serials; assigned ${jobs.length} missing job serial(s).`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
}).finally(async () => {
  await prisma.$disconnect()
  await pool.end()
})
