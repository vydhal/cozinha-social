import { createWriteStream, mkdirSync, writeFileSync } from 'fs'
import { join, extname } from 'path'
import { randomUUID } from 'crypto'
import type { MultipartFile } from '@fastify/multipart'
import { pipeline } from 'stream/promises'

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? '/app/uploads'
const UPLOAD_URL_BASE = process.env.UPLOAD_URL_BASE ?? '/uploads'
const ALLOWED_IMAGES = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.ico']

function ensureDir(dir: string) {
  mkdirSync(dir, { recursive: true })
}

export async function saveUpload(file: MultipartFile, subdir = ''): Promise<string> {
  const ext = extname(file.filename).toLowerCase()
  if (!ALLOWED_IMAGES.includes(ext)) {
    throw new Error(`Tipo de arquivo não suportado: ${ext}`)
  }

  const dir = subdir ? join(UPLOAD_DIR, subdir) : UPLOAD_DIR
  ensureDir(dir)

  const fileName = `${randomUUID()}${ext}`
  const filePath = join(dir, fileName)

  await pipeline(file.file, createWriteStream(filePath))

  return subdir ? `${UPLOAD_URL_BASE}/${subdir}/${fileName}` : `${UPLOAD_URL_BASE}/${fileName}`
}

export function saveBase64Image(base64: string, subdir = ''): string {
  const dir = subdir ? join(UPLOAD_DIR, subdir) : UPLOAD_DIR
  ensureDir(dir)
  const fileName = `${randomUUID()}.jpg`
  const filePath = join(dir, fileName)
  writeFileSync(filePath, Buffer.from(base64, 'base64'))
  return subdir ? `${UPLOAD_URL_BASE}/${subdir}/${fileName}` : `${UPLOAD_URL_BASE}/${fileName}`
}
