import fs from 'fs'
import path from 'path'
import Database from 'better-sqlite3'
import { randomBytes, scryptSync } from 'crypto'

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return
  }

  const content = fs.readFileSync(filePath, 'utf8')

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()

    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) {
      continue
    }

    const [rawKey, ...rawValueParts] = trimmed.split('=')
    const key = rawKey.trim()
    let value = rawValueParts.join('=').trim()

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }

    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}

function getDatabasePath() {
  const databaseUrl = process.env.DATABASE_URL || 'file:./prisma/dev.db'
  const filePath = databaseUrl.replace(/^file:/, '')
  return path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath)
}

function createId() {
  return `usr_${randomBytes(16).toString('hex')}`
}

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const key = scryptSync(password, salt, 64)
  return `scrypt:${salt}:${key.toString('hex')}`
}

function migrateDefaultUserNotes(db, adminId) {
  const defaultNotes = db.prepare('SELECT id, sentenceId, words, notes FROM UserNote WHERE userId = ?').all('default')
  const findAdminNote = db.prepare('SELECT id, words, notes FROM UserNote WHERE sentenceId = ? AND userId = ?')
  const updateAdminNote = db.prepare('UPDATE UserNote SET words = ?, notes = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?')
  const deleteNote = db.prepare('DELETE FROM UserNote WHERE id = ?')
  const moveNote = db.prepare('UPDATE UserNote SET userId = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?')

  for (const note of defaultNotes) {
    const existing = findAdminNote.get(note.sentenceId, adminId)

    if (existing) {
      updateAdminNote.run(existing.words || note.words || '', existing.notes || note.notes || '', existing.id)
      deleteNote.run(note.id)
    } else {
      moveNote.run(adminId, note.id)
    }
  }
}

function migrateDefaultLearningStats(db, adminId) {
  const defaultStats = db.prepare(
    'SELECT id, dateKey, studySeconds, audioSeconds, dictationSeconds FROM LearningDailyStat WHERE userId = ?'
  ).all('default')
  const findAdminStat = db.prepare('SELECT id FROM LearningDailyStat WHERE userId = ? AND dateKey = ?')
  const mergeStat = db.prepare(
    'UPDATE LearningDailyStat SET studySeconds = studySeconds + ?, audioSeconds = audioSeconds + ?, dictationSeconds = dictationSeconds + ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?'
  )
  const deleteStat = db.prepare('DELETE FROM LearningDailyStat WHERE id = ?')
  const moveStat = db.prepare('UPDATE LearningDailyStat SET userId = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?')

  for (const stat of defaultStats) {
    const existing = findAdminStat.get(adminId, stat.dateKey)

    if (existing) {
      mergeStat.run(stat.studySeconds, stat.audioSeconds, stat.dictationSeconds, existing.id)
      deleteStat.run(stat.id)
    } else {
      moveStat.run(adminId, stat.id)
    }
  }
}

loadEnvFile(path.join(process.cwd(), '.env'))
loadEnvFile(path.join(process.cwd(), '.env.local'))

const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase()
const password = process.env.ADMIN_PASSWORD || ''
const name = (process.env.ADMIN_NAME || 'Administrator').trim()

if (!email || !password) {
  console.error('ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env.local before running this seed.')
  process.exit(1)
}

if (password.length < 8) {
  console.error('ADMIN_PASSWORD must be at least 8 characters.')
  process.exit(1)
}

const db = new Database(getDatabasePath())

db.transaction(() => {
  const existingAdmin = db.prepare('SELECT id FROM User WHERE email = ?').get(email)
  const passwordHash = hashPassword(password)
  let adminId = existingAdmin?.id

  if (adminId) {
    db.prepare(
      'UPDATE User SET name = ?, passwordHash = ?, role = ?, isActive = 1, updatedAt = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(name, passwordHash, 'ADMIN', adminId)
  } else {
    adminId = createId()
    db.prepare(
      'INSERT INTO User (id, email, name, passwordHash, role, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)'
    ).run(adminId, email, name, passwordHash, 'ADMIN')
  }

  migrateDefaultUserNotes(db, adminId)
  db.prepare('UPDATE VideoPhraseNote SET userId = ?, updatedAt = CURRENT_TIMESTAMP WHERE userId = ?').run(adminId, 'default')
  migrateDefaultLearningStats(db, adminId)

  console.log(`Admin ready: ${email}`)
  console.log('Default personal learning data migrated to admin user. Training content was not modified.')
})()

db.close()
