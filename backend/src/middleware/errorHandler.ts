import { Request, Response, NextFunction } from 'express'

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  console.error('❌ Error:', err.message)

  if (process.env.NODE_ENV === 'development') {
    console.error(err.stack)
  }

  res.status(500).json({
    error: 'Error interno del servidor',
    ...(process.env.NODE_ENV === 'development' && { details: err.message }),
  })
}

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: 'Ruta no encontrada' })
}
