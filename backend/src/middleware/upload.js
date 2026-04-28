const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
const MAX_SIZE_MB = parseInt(process.env.MAX_FILE_SIZE_MB || '10', 10);

// Ensure upload directories exist
['invoices', 'products', 'avatars'].forEach(dir => {
  fs.mkdirSync(path.join(UPLOAD_DIR, dir), { recursive: true });
});

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const subDir = req.uploadSubDir || 'misc';
    const dir = path.join(UPLOAD_DIR, subDir);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

const fileFilter = (_req, file, cb) => {
  const allowedImg = /jpeg|jpg|png|gif|webp|pdf/;
  const allowedAudio = /mp3|mp4|m4a|wav|ogg|webm|aac/;
  const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
  const mime = file.mimetype;
  if (allowedImg.test(ext) || mime.startsWith('image/') || mime === 'application/pdf') {
    cb(null, true);
  } else if (allowedAudio.test(ext) || mime.startsWith('audio/') || mime.startsWith('video/webm')) {
    cb(null, true);
  } else {
    cb(new Error('Only image or audio files are allowed.'));
  }
};

const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE_MB * 1024 * 1024 },
  fileFilter,
});

/**
 * Middleware factory — sets subDir before multer runs.
 */
const uploadTo = (subDir) => (req, _res, next) => {
  req.uploadSubDir = subDir;
  next();
};

module.exports = { upload, uploadTo };
