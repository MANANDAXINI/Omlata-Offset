import { Router } from 'express'

const resources = {
  parties: { model: 'partyOption', label: 'Party' },
  gsm: { model: 'gsmOption', label: 'GSM' },
  'paper-types': { model: 'paperType', label: 'Paper type' },
  counters: { model: 'counterOption', label: 'Counter' },
  sizes: { model: 'paperSize', label: 'Size' },
  'printing-sides': { model: 'printingSideOption', label: 'Printing side' },
  quantities: { model: 'quantityOption', label: 'Quantity' },
}

function requireName(value, label) {
  const name = String(value ?? '').trim()
  if (!name) throw new Error(`${label} name is required`)
  return name
}

function requirePositiveInteger(value, label) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${label} must be a positive integer`)
  return parsed
}

function optionData(resource, body, partial = false) {
  const isNumeric = resource === 'gsm' || resource === 'counters' || resource === 'quantities'
  const data = {}
  if (!partial || body.name !== undefined || body.value !== undefined) {
    if (isNumeric) {
      const value = requirePositiveInteger(body.value, resources[resource].label)
      data.value = value
      data.label = String(body.label ?? value).trim() || String(value)
    } else {
      data.name = requireName(body.name, resources[resource].label)
    }
  }
  if (body.active !== undefined) data.active = Boolean(body.active)
  if (body.sortOrder !== undefined) {
    const sortOrder = Number(body.sortOrder)
    if (!Number.isInteger(sortOrder) || sortOrder < 0) throw new Error('sortOrder must be a non-negative integer')
    data.sortOrder = sortOrder
  }
  return data
}

function handleError(error, response) {
  if (error?.code === 'P2002') return response.status(409).json({ error: 'An option with that value already exists.' })
  if (error?.code === 'P2025') return response.status(404).json({ error: 'Option not found.' })
  return response.status(400).json({ error: error.message })
}

export function createCatalogRouter(prisma) {
  const router = Router()
  const numericPaths = new Set(['gsm', 'counters', 'quantities'])
  const orderBy = (path) => [{ sortOrder: 'asc' }, numericPaths.has(path) ? { value: 'asc' } : { name: 'asc' }]

  router.get('/', async (_request, response, next) => {
    try {
      const entries = await Promise.all(Object.entries(resources).map(async ([key, config]) => {
        const items = await prisma[config.model].findMany({ where: { active: true }, orderBy: orderBy(key) })
        return [key, items]
      }))
      const priceRules = await prisma.priceRule.findMany({ where: { amount: { gt: 0 } } })
      response.json({ ...Object.fromEntries(entries), priceRules })
    } catch (error) { next(error) }
  })

  router.post('/quote', async (request, response) => {
    try {
      const { paperTypeId, sizeId, printingSideId, quantityId } = request.body || {}
      if (!paperTypeId || !sizeId || !printingSideId || !quantityId) throw new Error('Paper type, size, printing side, and quantity are required')
      const priceRule = await prisma.priceRule.findUnique({ where: { paperTypeId_sizeId_printingSideId_quantityId: { paperTypeId, sizeId, printingSideId, quantityId } } })
      response.json({ amount: priceRule?.amount || 0, priceRule })
    } catch (error) { handleError(error, response) }
  })

  for (const [path, config] of Object.entries(resources)) {
    router.get(`/admin/${path}`, async (_request, response, next) => {
      try { response.json({ items: await prisma[config.model].findMany({ orderBy: orderBy(path) }) }) } catch (error) { next(error) }
    })
    router.post(`/admin/${path}`, async (request, response) => {
      try { response.status(201).json({ item: await prisma[config.model].create({ data: optionData(path, request.body || {}) }) }) } catch (error) { handleError(error, response) }
    })
    router.put(`/admin/${path}/:id`, async (request, response) => {
      try { response.json({ item: await prisma[config.model].update({ where: { id: request.params.id }, data: optionData(path, request.body || {}, true) }) }) } catch (error) { handleError(error, response) }
    })
    router.delete(`/admin/${path}/:id`, async (request, response) => {
      try { await prisma[config.model].delete({ where: { id: request.params.id } }); response.status(204).send() } catch (error) { handleError(error, response) }
    })
  }

  router.get('/admin/price-rules', async (_request, response, next) => {
    try { response.json({ items: await prisma.priceRule.findMany({ include: { paperType: true, size: true, printingSide: true, quantity: true } }) }) } catch (error) { next(error) }
  })
  router.post('/admin/price-rules', async (request, response) => {
    try {
      const { paperTypeId, sizeId, printingSideId, quantityId } = request.body || {}
      const amount = Number(request.body?.amount)
      if (!paperTypeId || !sizeId || !printingSideId || !quantityId || !Number.isFinite(amount) || amount < 0) throw new Error('Paper type, size, printing side, quantity, and a valid amount are required')
      const item = await prisma.priceRule.upsert({ where: { paperTypeId_sizeId_printingSideId_quantityId: { paperTypeId, sizeId, printingSideId, quantityId } }, update: { amount }, create: { paperTypeId, sizeId, printingSideId, quantityId, amount } })
      response.status(201).json({ item })
    } catch (error) { handleError(error, response) }
  })
  router.put('/admin/price-rules/:id', async (request, response) => {
    try {
      const amount = Number(request.body?.amount)
      if (!Number.isFinite(amount) || amount < 0) throw new Error('amount must be a non-negative number')
      response.json({ item: await prisma.priceRule.update({ where: { id: request.params.id }, data: { amount } }) })
    } catch (error) { handleError(error, response) }
  })
  router.delete('/admin/price-rules/:id', async (request, response) => {
    try { await prisma.priceRule.delete({ where: { id: request.params.id } }); response.status(204).send() } catch (error) { handleError(error, response) }
  })

  return router
}