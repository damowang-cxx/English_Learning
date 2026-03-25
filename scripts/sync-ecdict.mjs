import fs from 'node:fs'
import https from 'node:https'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const ECDICT_URL = 'https://raw.githubusercontent.com/skywind3000/ECDICT/master/ecdict.csv'
const dataDir = path.join(process.cwd(), 'data')
const targetPath = path.join(dataDir, 'ecdict.source.csv')

function download(url, outputPath) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, (response) => {
      if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume()
        download(response.headers.location, outputPath).then(resolve).catch(reject)
        return
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ECDICT: HTTP ${response.statusCode || 'unknown'}`))
        response.resume()
        return
      }

      const fileStream = fs.createWriteStream(outputPath)
      response.pipe(fileStream)

      fileStream.on('finish', () => {
        fileStream.close(() => resolve())
      })

      fileStream.on('error', (error) => {
        fileStream.close(() => reject(error))
      })
    })

    request.on('error', reject)
  })
}

function downloadWithCurl(url, outputPath) {
  const result = spawnSync('curl', ['-L', url, '-o', outputPath], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })

  if (result.status !== 0) {
    throw new Error(`curl download failed with exit code ${result.status}`)
  }
}

async function main() {
  fs.mkdirSync(dataDir, { recursive: true })

  try {
    downloadWithCurl(ECDICT_URL, targetPath)
  } catch {
    await download(ECDICT_URL, targetPath)
  }

  console.log(`ECDICT CSV downloaded to ${targetPath}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
