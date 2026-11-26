export function jsonToSchema(value: unknown): Record<string, unknown> {
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    ...schemaFor(value)
  }
}

function schemaFor(value: unknown): Record<string, unknown> {
  if (value === null) {
    return { type: 'null' }
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return { type: 'array' }
    }
    const items = uniqueSchemas(value.map((item) => schemaFor(item)))
    if (items.length === 1) {
      return { type: 'array', items: items[0] }
    }
    return { type: 'array', items: { anyOf: items } }
  }
  if (typeof value === 'object') {
    const properties: Record<string, unknown> = {}
    const required: string[] = []
    for (const [key, item] of Object.entries(value)) {
      properties[key] = schemaFor(item)
      required.push(key)
    }
    return {
      type: 'object',
      properties,
      required,
      additionalProperties: false
    }
  }
  if (typeof value === 'number') {
    return { type: Number.isInteger(value) ? 'integer' : 'number' }
  }
  if (typeof value === 'boolean') {
    return { type: 'boolean' }
  }
  return { type: 'string' }
}

function uniqueSchemas(schemas: Record<string, unknown>[]): Record<string, unknown>[] {
  const seen = new Set<string>()
  const unique: Record<string, unknown>[] = []
  for (const schema of schemas) {
    const key = JSON.stringify(schema)
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    unique.push(schema)
  }
  return unique
}
