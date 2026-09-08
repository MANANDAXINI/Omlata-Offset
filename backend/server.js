import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import pg from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from './generated/prisma/client.js'
import { createCatalogRouter } from './src/catalog.js'

const { Pool } = pg
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
const app = express()
const port = Number(process.env.PORT) || 4000

app.use(cors())
app.use(express.json())
app.use('/api/catalog', createCatalogRouter(prisma))

const fields = ['date', 'partyName', 'gsm', 'paperType', 'quantity', 'counter', 'jobDetails']

function parseId(value) {
  const id = Number(value)
  if (!Number.isInteger(id) || id < 1) throw new HttpError(400, 'id must be a positive integer')
  return id
}

function parseInteger(value, field, { min = 0 } = {}) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < min) {
    throw new HttpError(400, `${field} must be an integer greater than or equal to ${min}`)
  }
  return parsed
}

function parseDate(value, field = 'date') {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new HttpError(400, `${field} must use YYYY-MM-DD format`)
  }
  const date = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new HttpError(400, `${field} must be a valid calendar date`)
  }
  return date
}

async function validateJobInput(body, { partial = false } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'Request body must be a JSON object')
  }

  const input = { ...body }
  const data = {}
  const references = [
    ['partyOptionId', 'partyOption', 'partyName'],
    ['gsmOptionId', 'gsmOption', 'gsm'],
    ['paperTypeId', 'paperType', 'paperType'],
    ['counterOptionId', 'counterOption', 'counter'],
  ]
  for (const [idField, model, targetField] of references) {
    if (body[idField] === undefined) continue
    const option = await prisma[model].findUnique({ where: { id: String(body[idField]) } })
    if (!option || option.active === false) throw new HttpError(400, `${idField} is not an active dropdown option`)
    input[targetField] = 'value' in option ? option.value : option.name
    data[idField] = option.id
  }
  for (const [idField, model] of [['sizeId', 'paperSize'], ['printingSideId', 'printingSideOption'], ['quantityOptionId', 'quantityOption']]) {
    if (body[idField] === undefined) continue
    const option = await prisma[model].findUnique({ where: { id: String(body[idField]) } })
    if (!option || option.active === false) throw new HttpError(400, `${idField} is not an active dropdown option`)
    data[idField] = option.id
    if (idField === 'quantityOptionId') input.quantity = option.value
  }
  const required = ['date', 'partyName', 'gsm', 'paperType', 'quantity', 'counter', 'jobDetails']
  for (const field of required) {
    if (!partial && input[field] === undefined) throw new HttpError(400, `${field} is required`)
    if (partial && input[field] === undefined) continue
    if (input[field] === null || input[field] === '') throw new HttpError(400, `${field} cannot be empty`)

    if (field === 'date') data[field] = parseDate(input[field])
    else if (['gsm', 'quantity', 'counter'].includes(field)) {
      data[field] = parseInteger(input[field], field, { min: field === 'gsm' ? 1 : 0 })
    } else {
      if (typeof input[field] !== 'string' || input[field].trim().length === 0) {
        throw new HttpError(400, `${field} must be a non-empty string`)
      }
      data[field] = input[field].trim()
    }
  }
  return data
}

function buildFilters(query) {
  const where = {}
  if (query.partyName) where.partyName = { contains: String(query.partyName).trim(), mode: 'insensitive' }
  if (query.paperType) where.paperType = { equals: String(query.paperType).trim(), mode: 'insensitive' }
  if (query.jobDetails) where.jobDetails = { contains: String(query.jobDetails).trim(), mode: 'insensitive' }
  if (query.search) {
    const search = String(query.search).trim()
    where.OR = [
      { partyName: { contains: search, mode: 'insensitive' } },
      { paperType: { contains: search, mode: 'insensitive' } },
      { jobDetails: { contains: search, mode: 'insensitive' } },
    ]
  }

  const dateFrom = query.dateFrom ? parseDate(query.dateFrom, 'dateFrom') : undefined
  const dateTo = query.dateTo ? parseDate(query.dateTo, 'dateTo') : undefined
  if (dateFrom || dateTo) where.date = { ...(dateFrom && { gte: dateFrom }), ...(dateTo && { lte: dateTo }) }

  for (const field of ['gsm', 'quantity', 'counter']) {
    const min = query[`${field}Min`] !== undefined ? parseInteger(query[`${field}Min`], `${field}Min`) : undefined
    const max = query[`${field}Max`] !== undefined ? parseInteger(query[`${field}Max`], `${field}Max`) : undefined
    if (min !== undefined || max !== undefined) where[field] = { ...(min !== undefined && { gte: min }), ...(max !== undefined && { lte: max }) }
  }
  return where
}

class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

app.get('/health', (_request, response) => response.json({ status: 'ok' }))

app.get('/api/jobs', async (request, response) => {
  const page = request.query.page === undefined ? 1 : parseInteger(request.query.page, 'page', { min: 1 })
  const limit = request.query.limit === undefined ? 25 : Math.min(parseInteger(request.query.limit, 'limit', { min: 1 }), 100)
  const allowedSortFields = ['date', 'partyName', 'gsm', 'paperType', 'quantity', 'counter', 'createdAt']
  const sortBy = allowedSortFields.includes(request.query.sortBy) ? request.query.sortBy : 'date'
  const sortOrder = request.query.sortOrder === 'asc' ? 'asc' : 'desc'
  const where = buildFilters(request.query)
  const [data, total] = await Promise.all([
    prisma.job.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { [sortBy]: sortOrder } }),
    prisma.job.count({ where }),
  ])
  response.json({ data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } })
})

app.get('/api/jobs/name/:partyName', async (request, response) => {
  const data = await prisma.job.findMany({
    where: { partyName: { equals: request.params.partyName, mode: 'insensitive' } },
    orderBy: { date: 'desc' },
  })
  response.json({ data })
})

app.get('/api/jobs/:id', async (request, response) => {
  const job = await prisma.job.findUnique({ where: { id: parseId(request.params.id) } })
  if (!job) throw new HttpError(404, 'Job not found')
  response.json(job)
})

app.post('/api/jobs', async (request, response) => {
  const job = await prisma.job.create({ data: await validateJobInput(request.body) })
  response.status(201).json(job)
})

app.patch('/api/jobs/:id', async (request, response) => {
  const job = await prisma.job.update({ where: { id: parseId(request.params.id) }, data: await validateJobInput(request.body, { partial: true }) })
  response.json(job)
})

app.put('/api/jobs/:id', async (request, response) => {
  const job = await prisma.job.update({ where: { id: parseId(request.params.id) }, data: await validateJobInput(request.body) })
  response.json(job)
})

app.delete('/api/jobs/:id', async (request, response) => {
  await prisma.job.delete({ where: { id: parseId(request.params.id) } })
  response.status(204).send()
})

app.use((error, _request, response, _next) => {
  if (error instanceof HttpError) return response.status(error.status).json({ error: error.message })
  if (error?.code === 'P2025') return response.status(404).json({ error: 'Job not found' })
  if (error instanceof SyntaxError && error.status === 400) return response.status(400).json({ error: 'Request body contains invalid JSON' })
  console.error(error)
  return response.status(500).json({ error: 'Internal server error' })
})

const server = app.listen(port, () => console.log(`Omlata Offset API listening on port ${port}`))

async function shutdown() {
  server.close()
  await prisma.$disconnect()
  await pool.end()
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)