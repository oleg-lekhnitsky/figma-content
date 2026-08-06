import { createError } from 'h3'

export const appError = (statusCode: number, code: string, message: string, details?: unknown) =>
  createError({ statusCode, statusMessage: message, data: { error: { code, message, ...(details === undefined ? {} : { details }) } } })

export const databaseError = (operation: string, cause: unknown) => {
  console.error(`Database operation failed: ${operation}`, cause)
  return appError(500, 'INTERNAL_ERROR', 'The request could not be completed.')
}
