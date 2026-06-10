// backend/src/utils/localFileStorage.js
// Stores uploaded files as binary (bytea) in PostgreSQL.
// Zero Supabase Storage dependency — no egress costs.

const pool = require('../db');

/**
 * Store a file buffer in PostgreSQL and return a relative serve URL.
 *
 * For client uploads:  table = 'client_uploads',  idColumn = 'id'
 * For supplier docs:   table = 'supplier_documents', idColumn = 'id'
 *
 * The caller is responsible for inserting the row first and passing the row id,
 * OR we accept buffer + metadata and handle the full upsert.
 *
 * Simpler API: just call storeFile() to get back a { file_data, file_size }
 * object to include in your INSERT/UPDATE query.
 */

/**
 * Returns the columns to include in your INSERT when storing a file locally.
 * Usage:
 *   const fileFields = prepareFileFields(req.file);
 *   pool.query(`INSERT INTO client_uploads (..., ${fileFields.columns}) VALUES (..., ${fileFields.placeholders})`, [..., ...fileFields.values])
 *
 * @param {Express.Multer.File} file - multer file object (memoryStorage)
 * @returns {{ file_data: Buffer, file_size: number, file_url: null }}
 */
function prepareFileFields(file) {
  return {
    file_data: file.buffer,
    file_size: file.size,
    file_url: null,   // No Supabase URL — file is stored in DB
  };
}

/**
 * Stream a file stored in PostgreSQL to an Express response.
 *
 * @param {object} res - Express response object
 * @param {Buffer} fileData - Binary file data from DB
 * @param {string} mimeType - MIME type (e.g. 'application/pdf')
 * @param {string} fileName - Original file name for Content-Disposition
 * @param {'inline'|'attachment'} disposition - How to deliver the file
 */
function serveFile(res, fileData, mimeType, fileName, disposition = 'inline') {
  if (!fileData) {
    return res.status(404).json({ error: 'File data not found' });
  }
  const safe = encodeURIComponent(fileName).replace(/'/g, "%27");
  res.setHeader('Content-Type', mimeType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `${disposition}; filename*=UTF-8''${safe}`);
  res.setHeader('Content-Length', fileData.length);
  res.setHeader('Cache-Control', 'private, max-age=86400');
  res.send(fileData);
}

module.exports = { prepareFileFields, serveFile };
