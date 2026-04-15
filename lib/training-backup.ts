import fs from 'fs'
import { promises as fsp } from 'fs'
import path from 'path'
import { createHash } from 'crypto'
import { prisma } from '@/lib/prisma'

const BACKUP_SCHEMA_VERSION = 1
const ALLOWED_PUBLIC_DIRS = new Set(['audio', 'video', 'video-covers'])
const DEFAULT_BACKUP_DIR = path.join(process.cwd(), 'storage', 'training-backups')

type BackupKind = 'manual' | 'safety'

export interface TrainingBackupCounts {
  listeningItems: number
  listeningSentences: number
  videoItems: number
  videoCaptions: number
  videoCharacters: number
  files: number
  totalFileBytes: number
}

export interface TrainingBackupFileRecord {
  publicPath: string
  objectSha256: string
  objectPath: string
  size: number
}

interface InternalTrainingBackupFileRecord extends TrainingBackupFileRecord {
  sourcePath: string
}

interface ListeningSentenceSnapshot {
  id: string
  text: string
  translation: string | null
  startTime: number
  endTime: number
  order: number
}

interface ListeningItemSnapshot {
  id: string
  title: string
  audioUrl: string
  createdAt: string
  updatedAt: string
  sentences: ListeningSentenceSnapshot[]
}

interface VideoCaptionSnapshot {
  id: string
  startTime: number
  endTime: number
  enText: string
  zhText: string | null
  speaker: string | null
  isKeySentence: boolean
  order: number
}

interface VideoCharacterSnapshot {
  id: string
  name: string
  avatarUrl: string | null
  order: number
}

interface VideoItemSnapshot {
  id: string
  title: string
  sourceTitle: string
  plotSummary: string
  tag: string
  mediaType: string
  mediaUrl: string
  coverUrl: string | null
  coverPositionX: number
  coverPositionY: number
  createdAt: string
  updatedAt: string
  captions: VideoCaptionSnapshot[]
  characters: VideoCharacterSnapshot[]
}

interface TrainingBackupPayload {
  listeningItems: ListeningItemSnapshot[]
  videoItems: VideoItemSnapshot[]
}

export interface TrainingBackupManifest {
  schemaVersion: number
  id: string
  kind: BackupKind
  createdAt: string
  dataHash: string
  counts: TrainingBackupCounts
  files: TrainingBackupFileRecord[]
  missingFiles: string[]
  payload: TrainingBackupPayload
}

export interface TrainingBackupSnapshotSummary {
  id: string
  kind: BackupKind
  createdAt: string
  dataHash: string
  counts: TrainingBackupCounts
  missingFiles: string[]
}

interface CurrentTrainingBackupState {
  dataHash: string
  counts: TrainingBackupCounts
  files: InternalTrainingBackupFileRecord[]
  missingFiles: string[]
  payload: TrainingBackupPayload
}

export class TrainingBackupError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TrainingBackupError'
  }
}

function getBackupRoot() {
  return path.resolve(process.env.TRAINING_BACKUP_DIR || DEFAULT_BACKUP_DIR)
}

function getSnapshotsDir() {
  return path.join(getBackupRoot(), 'snapshots')
}

function getObjectsDir() {
  return path.join(getBackupRoot(), 'objects')
}

function getPublicRoot() {
  return path.resolve(process.cwd(), 'public')
}

function toIsoString(value: Date) {
  return value.toISOString()
}

function hashJson(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

async function hashFile(filePath: string) {
  return new Promise<string>((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = fs.createReadStream(filePath)

    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('error', reject)
    stream.on('end', () => resolve(hash.digest('hex')))
  })
}

function getObjectPathForHash(sha256: string) {
  return path.join('objects', sha256.slice(0, 2), sha256)
}

function assertSafePublicPath(publicPath: string) {
  const normalizedPath = publicPath.replace(/\\/g, '/')

  if (!normalizedPath.startsWith('/')) {
    throw new TrainingBackupError(`Training media path must start with "/": ${publicPath}`)
  }

  const relativePath = normalizedPath.replace(/^\/+/, '')
  const segments = relativePath.split('/')
  const topLevelDir = segments[0]

  if (
    !topLevelDir ||
    !ALLOWED_PUBLIC_DIRS.has(topLevelDir) ||
    segments.some((segment) => !segment || segment === '.' || segment === '..' || segment.includes('\0'))
  ) {
    throw new TrainingBackupError(`Unsupported training media path: ${publicPath}`)
  }

  const resolvedPath = path.resolve(getPublicRoot(), relativePath)
  const publicRoot = getPublicRoot()

  if (resolvedPath !== publicRoot && !resolvedPath.startsWith(`${publicRoot}${path.sep}`)) {
    throw new TrainingBackupError(`Training media path escapes public directory: ${publicPath}`)
  }

  return {
    normalizedPath,
    relativePath,
    resolvedPath,
  }
}

function getDateForRestore(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    throw new TrainingBackupError(`Invalid backup date: ${value}`)
  }

  return date
}

function buildCounts(payload: TrainingBackupPayload, files: TrainingBackupFileRecord[]): TrainingBackupCounts {
  return {
    listeningItems: payload.listeningItems.length,
    listeningSentences: payload.listeningItems.reduce((sum, item) => sum + item.sentences.length, 0),
    videoItems: payload.videoItems.length,
    videoCaptions: payload.videoItems.reduce((sum, item) => sum + item.captions.length, 0),
    videoCharacters: payload.videoItems.reduce((sum, item) => sum + item.characters.length, 0),
    files: files.length,
    totalFileBytes: files.reduce((sum, file) => sum + file.size, 0),
  }
}

function getManifestDataHash(payload: TrainingBackupPayload, files: TrainingBackupFileRecord[], missingFiles: string[]) {
  return hashJson({
    schemaVersion: BACKUP_SCHEMA_VERSION,
    payload,
    files: files.map((file) => ({
      publicPath: file.publicPath,
      objectSha256: file.objectSha256,
      size: file.size,
    })),
    missingFiles,
  })
}

function toSnapshotSummary(manifest: TrainingBackupManifest): TrainingBackupSnapshotSummary {
  return {
    id: manifest.id,
    kind: manifest.kind,
    createdAt: manifest.createdAt,
    dataHash: manifest.dataHash,
    counts: manifest.counts,
    missingFiles: manifest.missingFiles,
  }
}

function toPublicFileRecord(file: InternalTrainingBackupFileRecord): TrainingBackupFileRecord {
  return {
    publicPath: file.publicPath,
    objectSha256: file.objectSha256,
    objectPath: file.objectPath,
    size: file.size,
  }
}

function buildSnapshotId(kind: BackupKind, dataHash: string) {
  const timestamp = new Date().toISOString().replace(/[-:.]/g, '').replace('Z', 'Z')
  return `${timestamp}-${kind}-${dataHash.slice(0, 10)}`
}

function sortSnapshots(snapshots: TrainingBackupSnapshotSummary[]) {
  return [...snapshots].sort((left, right) => right.createdAt.localeCompare(left.createdAt))
}

async function ensureBackupDirs() {
  await Promise.all([
    fsp.mkdir(getSnapshotsDir(), { recursive: true }),
    fsp.mkdir(getObjectsDir(), { recursive: true }),
  ])
}

async function readTrainingPayload(): Promise<TrainingBackupPayload> {
  const [listeningItems, videoItems] = await Promise.all([
    prisma.trainingItem.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        title: true,
        audioUrl: true,
        createdAt: true,
        updatedAt: true,
        sentences: {
          orderBy: { order: 'asc' },
          select: {
            id: true,
            text: true,
            translation: true,
            startTime: true,
            endTime: true,
            order: true,
          },
        },
      },
    }),
    prisma.videoTrainingItem.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        title: true,
        sourceTitle: true,
        plotSummary: true,
        tag: true,
        mediaType: true,
        mediaUrl: true,
        coverUrl: true,
        coverPositionX: true,
        coverPositionY: true,
        createdAt: true,
        updatedAt: true,
        captions: {
          orderBy: { order: 'asc' },
          select: {
            id: true,
            startTime: true,
            endTime: true,
            enText: true,
            zhText: true,
            speaker: true,
            isKeySentence: true,
            order: true,
          },
        },
        characters: {
          orderBy: { order: 'asc' },
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            order: true,
          },
        },
      },
    }),
  ])

  return {
    listeningItems: listeningItems.map((item) => ({
      id: item.id,
      title: item.title,
      audioUrl: item.audioUrl,
      createdAt: toIsoString(item.createdAt),
      updatedAt: toIsoString(item.updatedAt),
      sentences: item.sentences.map((sentence) => ({
        id: sentence.id,
        text: sentence.text,
        translation: sentence.translation,
        startTime: sentence.startTime,
        endTime: sentence.endTime,
        order: sentence.order,
      })),
    })),
    videoItems: videoItems.map((item) => ({
      id: item.id,
      title: item.title,
      sourceTitle: item.sourceTitle,
      plotSummary: item.plotSummary,
      tag: item.tag,
      mediaType: item.mediaType,
      mediaUrl: item.mediaUrl,
      coverUrl: item.coverUrl,
      coverPositionX: item.coverPositionX,
      coverPositionY: item.coverPositionY,
      createdAt: toIsoString(item.createdAt),
      updatedAt: toIsoString(item.updatedAt),
      captions: item.captions.map((caption) => ({
        id: caption.id,
        startTime: caption.startTime,
        endTime: caption.endTime,
        enText: caption.enText,
        zhText: caption.zhText,
        speaker: caption.speaker,
        isKeySentence: caption.isKeySentence,
        order: caption.order,
      })),
      characters: item.characters.map((character) => ({
        id: character.id,
        name: character.name,
        avatarUrl: character.avatarUrl,
        order: character.order,
      })),
    })),
  }
}

function collectReferencedPublicPaths(payload: TrainingBackupPayload) {
  const paths = new Set<string>()

  for (const item of payload.listeningItems) {
    paths.add(item.audioUrl)
  }

  for (const item of payload.videoItems) {
    paths.add(item.mediaUrl)

    if (item.coverUrl) {
      paths.add(item.coverUrl)
    }

    for (const character of item.characters) {
      if (character.avatarUrl) {
        paths.add(character.avatarUrl)
      }
    }
  }

  return Array.from(paths).sort((left, right) => left.localeCompare(right))
}

async function collectFileRecords(publicPaths: string[], allowMissingFiles: boolean) {
  const files: InternalTrainingBackupFileRecord[] = []
  const missingFiles: string[] = []

  for (const publicPath of publicPaths) {
    const safePath = assertSafePublicPath(publicPath)

    if (!fs.existsSync(safePath.resolvedPath) || !fs.statSync(safePath.resolvedPath).isFile()) {
      missingFiles.push(safePath.normalizedPath)
      continue
    }

    const [stat, objectSha256] = await Promise.all([
      fsp.stat(safePath.resolvedPath),
      hashFile(safePath.resolvedPath),
    ])

    files.push({
      publicPath: safePath.normalizedPath,
      objectSha256,
      objectPath: getObjectPathForHash(objectSha256).replace(/\\/g, '/'),
      size: stat.size,
      sourcePath: safePath.resolvedPath,
    })
  }

  if (missingFiles.length > 0 && !allowMissingFiles) {
    throw new TrainingBackupError(`Referenced training files are missing: ${missingFiles.join(', ')}`)
  }

  return {
    files,
    missingFiles,
  }
}

async function buildCurrentTrainingBackupState(allowMissingFiles = false): Promise<CurrentTrainingBackupState> {
  const payload = await readTrainingPayload()
  const publicPaths = collectReferencedPublicPaths(payload)
  const { files, missingFiles } = await collectFileRecords(publicPaths, allowMissingFiles)
  const publicFiles = files.map(toPublicFileRecord)
  const counts = buildCounts(payload, publicFiles)
  const dataHash = getManifestDataHash(payload, publicFiles, missingFiles)

  return {
    dataHash,
    counts,
    files,
    missingFiles,
    payload,
  }
}

async function copyObjectsForSnapshot(files: InternalTrainingBackupFileRecord[]) {
  for (const file of files) {
    const objectPath = path.join(getBackupRoot(), file.objectPath)

    if (fs.existsSync(objectPath)) {
      continue
    }

    await fsp.mkdir(path.dirname(objectPath), { recursive: true })
    await fsp.copyFile(file.sourcePath, objectPath)
  }
}

async function writeManifest(manifest: TrainingBackupManifest) {
  const snapshotDir = path.join(getSnapshotsDir(), manifest.id)
  await fsp.mkdir(snapshotDir, { recursive: true })
  await fsp.writeFile(path.join(snapshotDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
}

async function readManifestFromPath(manifestPath: string): Promise<TrainingBackupManifest> {
  const rawManifest = await fsp.readFile(manifestPath, 'utf8')
  const manifest = JSON.parse(rawManifest) as TrainingBackupManifest

  if (manifest.schemaVersion !== BACKUP_SCHEMA_VERSION || !manifest.id || !manifest.dataHash) {
    throw new TrainingBackupError(`Invalid training backup manifest: ${manifestPath}`)
  }

  return manifest
}

export async function listTrainingBackupSnapshots() {
  const snapshotsDir = getSnapshotsDir()

  if (!fs.existsSync(snapshotsDir)) {
    return [] satisfies TrainingBackupSnapshotSummary[]
  }

  const entries = await fsp.readdir(snapshotsDir, { withFileTypes: true })
  const snapshots: TrainingBackupSnapshotSummary[] = []

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue
    }

    try {
      const manifest = await readManifestFromPath(path.join(snapshotsDir, entry.name, 'manifest.json'))
      snapshots.push(toSnapshotSummary(manifest))
    } catch (error) {
      console.warn(`Skipping invalid training backup snapshot: ${entry.name}`, error)
    }
  }

  return sortSnapshots(snapshots)
}

export async function getTrainingBackupStatus() {
  await ensureBackupDirs()

  const [current, snapshots] = await Promise.all([
    buildCurrentTrainingBackupState(true),
    listTrainingBackupSnapshots(),
  ])
  const latestManualSnapshot = snapshots.find((snapshot) => snapshot.kind === 'manual') || null

  return {
    backupDir: getBackupRoot(),
    current: {
      dataHash: current.dataHash,
      counts: current.counts,
      missingFiles: current.missingFiles,
    },
    snapshots,
    latestSnapshot: latestManualSnapshot,
    isCurrentBackedUp: Boolean(
      latestManualSnapshot &&
      latestManualSnapshot.dataHash === current.dataHash &&
      current.missingFiles.length === 0
    ),
  }
}

export async function createTrainingBackupSnapshot({
  kind = 'manual',
  force = false,
  allowMissingFiles = false,
}: {
  kind?: BackupKind
  force?: boolean
  allowMissingFiles?: boolean
} = {}) {
  await ensureBackupDirs()

  const current = await buildCurrentTrainingBackupState(allowMissingFiles)
  const snapshots = await listTrainingBackupSnapshots()
  const latestManualSnapshot = snapshots.find((snapshot) => snapshot.kind === 'manual') || null

  if (!force && kind === 'manual' && latestManualSnapshot?.dataHash === current.dataHash) {
    return {
      status: 'noop' as const,
      snapshot: latestManualSnapshot,
      current: {
        dataHash: current.dataHash,
        counts: current.counts,
        missingFiles: current.missingFiles,
      },
      message: 'Current training content already matches the latest backup.',
    }
  }

  await copyObjectsForSnapshot(current.files)

  const manifestFiles = current.files.map(toPublicFileRecord)
  const manifest: TrainingBackupManifest = {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    id: buildSnapshotId(kind, current.dataHash),
    kind,
    createdAt: new Date().toISOString(),
    dataHash: current.dataHash,
    counts: current.counts,
    files: manifestFiles,
    missingFiles: current.missingFiles,
    payload: current.payload,
  }

  await writeManifest(manifest)

  return {
    status: 'created' as const,
    snapshot: toSnapshotSummary(manifest),
    current: {
      dataHash: current.dataHash,
      counts: current.counts,
      missingFiles: current.missingFiles,
    },
    message: kind === 'safety' ? 'Safety snapshot created.' : 'Training backup created.',
  }
}

async function loadTrainingBackupManifest(snapshotId: string) {
  const snapshots = await listTrainingBackupSnapshots()
  const snapshot = snapshots.find((entry) => entry.id === snapshotId)

  if (!snapshot) {
    throw new TrainingBackupError(`Training backup snapshot not found: ${snapshotId}`)
  }

  return readManifestFromPath(path.join(getSnapshotsDir(), snapshot.id, 'manifest.json'))
}

export async function validateTrainingBackupObjects(manifest: TrainingBackupManifest) {
  const problems: Array<{ publicPath: string; objectSha256: string; reason: string }> = []

  for (const file of manifest.files) {
    const objectPath = path.join(getBackupRoot(), file.objectPath)

    if (!fs.existsSync(objectPath) || !fs.statSync(objectPath).isFile()) {
      problems.push({
        publicPath: file.publicPath,
        objectSha256: file.objectSha256,
        reason: 'missing',
      })
      continue
    }

    const objectHash = await hashFile(objectPath)
    if (objectHash !== file.objectSha256) {
      problems.push({
        publicPath: file.publicPath,
        objectSha256: file.objectSha256,
        reason: 'hash mismatch',
      })
    }
  }

  return problems
}

export async function previewTrainingBackupRestore(snapshotId: string) {
  const manifest = await loadTrainingBackupManifest(snapshotId)
  const objectProblems = await validateTrainingBackupObjects(manifest)
  const current = await buildCurrentTrainingBackupState(true)

  return {
    snapshot: toSnapshotSummary(manifest),
    current: {
      dataHash: current.dataHash,
      counts: current.counts,
      missingFiles: current.missingFiles,
    },
    restore: {
      dataHash: manifest.dataHash,
      counts: manifest.counts,
      missingFiles: manifest.missingFiles,
      objectProblems,
    },
    canRestore: objectProblems.length === 0 && manifest.missingFiles.length === 0,
  }
}

async function copySnapshotFilesToPublic(manifest: TrainingBackupManifest) {
  for (const file of manifest.files) {
    const sourcePath = path.join(getBackupRoot(), file.objectPath)
    const targetPath = assertSafePublicPath(file.publicPath).resolvedPath

    await fsp.mkdir(path.dirname(targetPath), { recursive: true })
    await fsp.copyFile(sourcePath, targetPath)
  }
}

async function restoreTrainingData(payload: TrainingBackupPayload) {
  await prisma.$transaction(async (tx) => {
    await tx.videoCaptionNote.deleteMany()
    await tx.videoPhraseNote.deleteMany()
    await tx.videoCaption.deleteMany()
    await tx.videoCharacter.deleteMany()
    await tx.videoTrainingItem.deleteMany()
    await tx.userNote.deleteMany()
    await tx.sentence.deleteMany()
    await tx.trainingItem.deleteMany()

    for (const item of payload.listeningItems) {
      await tx.trainingItem.create({
        data: {
          id: item.id,
          title: item.title,
          audioUrl: item.audioUrl,
          createdAt: getDateForRestore(item.createdAt),
          updatedAt: getDateForRestore(item.updatedAt),
          sentences: {
            create: item.sentences.map((sentence) => ({
              id: sentence.id,
              text: sentence.text,
              translation: sentence.translation,
              startTime: sentence.startTime,
              endTime: sentence.endTime,
              order: sentence.order,
            })),
          },
        },
      })
    }

    for (const item of payload.videoItems) {
      await tx.videoTrainingItem.create({
        data: {
          id: item.id,
          title: item.title,
          sourceTitle: item.sourceTitle,
          plotSummary: item.plotSummary,
          tag: item.tag,
          mediaType: item.mediaType,
          mediaUrl: item.mediaUrl,
          coverUrl: item.coverUrl,
          coverPositionX: item.coverPositionX,
          coverPositionY: item.coverPositionY,
          createdAt: getDateForRestore(item.createdAt),
          updatedAt: getDateForRestore(item.updatedAt),
          captions: {
            create: item.captions.map((caption) => ({
              id: caption.id,
              startTime: caption.startTime,
              endTime: caption.endTime,
              enText: caption.enText,
              zhText: caption.zhText,
              speaker: caption.speaker,
              isKeySentence: caption.isKeySentence,
              order: caption.order,
            })),
          },
          characters: {
            create: item.characters.map((character) => ({
              id: character.id,
              name: character.name,
              avatarUrl: character.avatarUrl,
              order: character.order,
            })),
          },
        },
      })
    }
  })
}

export async function restoreTrainingBackupSnapshot(snapshotId: string) {
  await ensureBackupDirs()

  const manifest = await loadTrainingBackupManifest(snapshotId)
  const objectProblems = await validateTrainingBackupObjects(manifest)

  if (manifest.missingFiles.length > 0) {
    throw new TrainingBackupError(`Snapshot is incomplete and cannot be restored: ${manifest.missingFiles.join(', ')}`)
  }

  if (objectProblems.length > 0) {
    throw new TrainingBackupError('Snapshot object files are missing or corrupted.')
  }

  const safetySnapshot = await createTrainingBackupSnapshot({
    kind: 'safety',
    force: true,
    allowMissingFiles: true,
  })

  await copySnapshotFilesToPublic(manifest)
  await restoreTrainingData(manifest.payload)

  return {
    restored: true,
    snapshot: toSnapshotSummary(manifest),
    safetySnapshot: safetySnapshot.snapshot,
  }
}
