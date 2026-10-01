#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { randomUUID } from 'node:crypto'

const DEFAULT_BASE_URL = 'https://game.aiwaves.tech/alteru-media/api'

function usage() {
  return `Usage:
  node generate-audio.mjs --session-id <stable-id> --kind <music|sfx> \\
    --prompt <english-prompt> --duration <0.5-120> --output <file.mp3>

Options:
  --request-id <uuid>  Reuse after an ambiguous timeout; omit for a new generation.
  --base-url <url>     Override only for local or staging QA.
  --help               Show this message.
`
}

function parseArgs(argv) {
  const values = new Map()
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index]
    if (key === '--help') return { help: true }
    if (!key?.startsWith('--')) throw new Error(`Unexpected argument: ${key}`)
    const value = argv[index + 1]
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${key}`)
    values.set(key.slice(2), value)
    index += 1
  }
  return Object.fromEntries(values)
}

function required(value, label) {
  const normalized = String(value ?? '').trim()
  if (!normalized) throw new Error(`${label} is required`)
  return normalized
}

async function responseJson(response) {
  try {
    return await response.json()
  } catch {
    return null
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    process.stdout.write(usage())
    return
  }

  const sessionId = required(options['session-id'], '--session-id')
  const kind = required(options.kind, '--kind')
  if (kind !== 'music' && kind !== 'sfx') throw new Error('--kind must be music or sfx')
  const prompt = required(options.prompt, '--prompt')
  const durationSeconds = Number(options.duration)
  if (!Number.isFinite(durationSeconds) || durationSeconds < 0.5 || durationSeconds > 120) {
    throw new Error('--duration must be between 0.5 and 120 seconds')
  }
  const output = path.resolve(required(options.output, '--output'))
  const requestId = options['request-id'] ? required(options['request-id'], '--request-id') : randomUUID()
  const baseUrl = (options['base-url'] ?? DEFAULT_BASE_URL).replace(/\/+$/, '')

  try {
    await fs.access(output)
    throw new Error(`Refusing to overwrite existing file: ${output}`)
  } catch (cause) {
    if (cause?.code !== 'ENOENT') throw cause
  }
  await fs.mkdir(path.dirname(output), { recursive: true })

  const response = await fetch(`${baseUrl}/v1/audio/generations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      request_id: requestId,
      session_id: sessionId,
      kind,
      prompt,
      duration_seconds: durationSeconds,
    }),
    signal: AbortSignal.timeout(330_000),
  })
  const body = await responseJson(response)
  if (!response.ok) {
    const error = body?.error ?? {}
    const retry = error.details?.retry_after_seconds
    throw new Error(`${error.code ?? `HTTP_${response.status}`}: ${error.message ?? 'Media generation failed'}${retry ? ` (retry after ${retry}s)` : ''}`)
  }
  if (body?.status !== 'succeeded' || body?.media?.type !== 'audio' || !body.media.url) {
    throw new Error(`Audio task did not complete synchronously (task_id=${body?.task_id ?? 'unknown'})`)
  }

  const download = await fetch(body.media.url, { signal: AbortSignal.timeout(120_000) })
  if (!download.ok) throw new Error(`Audio download failed with HTTP ${download.status}`)
  const contentType = download.headers.get('Content-Type') ?? ''
  if (!/^audio\//i.test(contentType)) throw new Error(`Unexpected audio content type: ${contentType || 'missing'}`)
  const bytes = new Uint8Array(await download.arrayBuffer())
  if (bytes.length < 1_024) throw new Error(`Audio output is unexpectedly small (${bytes.length} bytes)`)

  const temporary = `${output}.part-${randomUUID()}`
  await fs.writeFile(temporary, bytes, { flag: 'wx' })
  await fs.rename(temporary, output)
  process.stdout.write(`${JSON.stringify({
    task_id: body.task_id,
    request_id: requestId,
    kind: body.media.kind,
    duration_seconds: body.media.duration_seconds,
    timing_ms: body.timing_ms,
    bytes: bytes.length,
    output,
  }, null, 2)}\n`)
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
