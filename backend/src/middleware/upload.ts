import multer from 'multer'
import path from 'path'
import fs from 'fs'

// Ensure upload directories exist
const uploadsDir = path.resolve('./uploads')
const expenseDir = path.join(uploadsDir, 'expenses')

for (const dir of [uploadsDir, expenseDir]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

// Storage config for expense attachments
const expenseStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, expenseDir),
  filename: (req: any, file, cb) => {
    const uid = req.user?.id || 0
    const suffix = Date.now() + '-' + Math.round(Math.random() * 1e9)
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')
    cb(null, `exp-${uid}-${suffix}-${safeName}`)
  },
})

// Allowed file types: images, PDF, docs
const expenseFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowed = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain', 'text/csv',
  ]
  if (allowed.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error('Tipo de archivo no permitido. Se permiten: imágenes, PDF, Office, texto.'))
  }
}

export const expenseUpload = multer({
  storage: expenseStorage,
  limits: { fileSize: 10 * 1024 * 1024, files: 5 }, // 10MB, max 5
  fileFilter: expenseFilter,
})

export { uploadsDir, expenseDir }
