import fs from 'fs'
import path from 'path'
import Database from 'better-sqlite3'

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

loadEnvFile(path.join(process.cwd(), '.env'))
loadEnvFile(path.join(process.cwd(), '.env.local'))

const scenarioId = 'dlg_demo_restaurant_reservation'
const startNodeId = 'dlg_demo_restaurant_n1'

const scenario = {
  id: scenarioId,
  title: 'Restaurant Reservation Check-in',
  description: 'A short test scenario for checking in at a restaurant with a reservation. It is designed for testing Dialogue text, hint, answer reveal, and session progress flows.',
  difficulty: 'beginner',
  userRole: 'Guest with a dinner reservation',
  aiRole: 'Restaurant host',
  tags: ['restaurant', 'reservation', 'travel', 'beginner'],
  coverUrl: '',
  isPublished: 1,
  startNodeId,
  roleVoice: 'marin',
  coachVoice: 'cedar',
}

const nodes = [
  {
    id: startNodeId,
    order: 1,
    title: 'Arrival',
    roleLineEn: 'Good evening. Welcome to Harbor Table. Do you have a reservation?',
    roleLineZh: '晚上好，欢迎来到 Harbor Table。您有预订吗？',
    goal: 'Say that you have a reservation and give the name.',
    rubric: {
      requiredMeaning: ['Says there is a reservation', 'Gives the reservation name'],
      naturalPhrases: ['I have a reservation under Wang.', 'The reservation is under Wang.'],
      acceptableAnswers: ['Yes, I have a reservation under Wang.', 'Hi, the reservation is under Wang.'],
    },
    hint: {
      first: '先说明你有预订。',
      second: '可以用 under + 姓名表达“以某个名字预订”。',
      example: 'I have a reservation under Wang.',
    },
    sampleAnswer: 'Yes, I have a reservation under Wang.',
    retryLimit: 2,
    positionX: 120,
    positionY: 120,
  },
  {
    id: 'dlg_demo_restaurant_n2',
    order: 2,
    title: 'Party Size',
    roleLineEn: 'Great. I found it. How many people are in your party tonight?',
    roleLineZh: '好的，我找到了。今晚你们一共几位？',
    goal: 'Tell the host the party size.',
    rubric: {
      requiredMeaning: ['States the number of people'],
      naturalPhrases: ['There are four of us.', 'We have four people.'],
      acceptableAnswers: ['There are four of us.', 'We are a party of four.'],
    },
    hint: {
      first: '回答人数即可。',
      second: '更自然的说法是 There are ... of us.',
      example: 'There are four of us.',
    },
    sampleAnswer: 'There are four of us.',
    retryLimit: 2,
    positionX: 440,
    positionY: 120,
  },
  {
    id: 'dlg_demo_restaurant_n3',
    order: 3,
    title: 'Seating Preference',
    roleLineEn: 'Would you prefer a table by the window or somewhere quieter?',
    roleLineZh: '您想坐窗边，还是安静一点的位置？',
    goal: 'State a seating preference politely.',
    rubric: {
      requiredMeaning: ['Chooses a seating preference', 'Uses a polite tone'],
      naturalPhrases: ['A quieter table would be great, please.', 'By the window would be nice, please.'],
      acceptableAnswers: ['A quieter table would be great, please.', 'Could we sit by the window, please?'],
    },
    hint: {
      first: '选择一个座位偏好。',
      second: '用 please 或 would be great 会更礼貌。',
      example: 'A quieter table would be great, please.',
    },
    sampleAnswer: 'A quieter table would be great, please.',
    retryLimit: 2,
    positionX: 760,
    positionY: 120,
  },
  {
    id: 'dlg_demo_restaurant_n4',
    order: 4,
    title: 'Confirm',
    roleLineEn: 'Perfect. Please follow me, and I will show you to your table.',
    roleLineZh: '好的，请跟我来，我带您去座位。',
    goal: 'Acknowledge the host and respond naturally.',
    rubric: {
      requiredMeaning: ['Acknowledges the host politely'],
      naturalPhrases: ['Thank you.', 'Great, thank you.'],
      acceptableAnswers: ['Thank you.', 'Great, thank you.'],
    },
    hint: {
      first: '简单礼貌地回应即可。',
      second: 'Thank you 是最自然的回答。',
      example: 'Thank you.',
    },
    sampleAnswer: 'Thank you.',
    retryLimit: 1,
    positionX: 1080,
    positionY: 120,
  },
]

const edges = [
  { id: 'dlg_demo_restaurant_e1_pass', fromNodeId: 'dlg_demo_restaurant_n1', onResult: 'pass', toNodeId: 'dlg_demo_restaurant_n2' },
  { id: 'dlg_demo_restaurant_e1_max', fromNodeId: 'dlg_demo_restaurant_n1', onResult: 'max_retry', toNodeId: 'dlg_demo_restaurant_n2' },
  { id: 'dlg_demo_restaurant_e2_pass', fromNodeId: 'dlg_demo_restaurant_n2', onResult: 'pass', toNodeId: 'dlg_demo_restaurant_n3' },
  { id: 'dlg_demo_restaurant_e2_max', fromNodeId: 'dlg_demo_restaurant_n2', onResult: 'max_retry', toNodeId: 'dlg_demo_restaurant_n3' },
  { id: 'dlg_demo_restaurant_e3_pass', fromNodeId: 'dlg_demo_restaurant_n3', onResult: 'pass', toNodeId: 'dlg_demo_restaurant_n4' },
  { id: 'dlg_demo_restaurant_e3_max', fromNodeId: 'dlg_demo_restaurant_n3', onResult: 'max_retry', toNodeId: 'dlg_demo_restaurant_n4' },
]

const db = new Database(getDatabasePath())

try {
  db.pragma('foreign_keys = ON')

  const dialogueTable = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'DialogueScenario'")
    .get()

  if (!dialogueTable) {
    console.error('Dialogue tables were not found. Run `npx prisma migrate dev` before seeding the demo scenario.')
    process.exitCode = 1
  } else {
    db.transaction(() => {
      db.prepare('DELETE FROM DialogueScenario WHERE id = ?').run(scenario.id)

      db.prepare(
        `INSERT INTO DialogueScenario
          (id, title, description, difficulty, userRole, aiRole, tagsJson, coverUrl, isPublished, startNodeId, roleVoice, coachVoice, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      ).run(
        scenario.id,
        scenario.title,
        scenario.description,
        scenario.difficulty,
        scenario.userRole,
        scenario.aiRole,
        JSON.stringify(scenario.tags),
        scenario.coverUrl || null,
        scenario.isPublished,
        scenario.startNodeId,
        scenario.roleVoice,
        scenario.coachVoice
      )

      const insertNode = db.prepare(
        `INSERT INTO DialogueNode
          (id, scenarioId, "order", title, roleLineEn, roleLineZh, goal, rubricJson, hintJson, sampleAnswer, retryLimit, allowDynamicFollowup, positionX, positionY, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      )

      for (const node of nodes) {
        insertNode.run(
          node.id,
          scenario.id,
          node.order,
          node.title,
          node.roleLineEn,
          node.roleLineZh,
          node.goal,
          JSON.stringify(node.rubric),
          JSON.stringify(node.hint),
          node.sampleAnswer,
          node.retryLimit,
          0,
          node.positionX,
          node.positionY
        )
      }

      const insertEdge = db.prepare(
        `INSERT INTO DialogueEdge
          (id, scenarioId, fromNodeId, onResult, toNodeId, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      )

      for (const edge of edges) {
        insertEdge.run(edge.id, scenario.id, edge.fromNodeId, edge.onResult, edge.toNodeId)
      }
    })()

    console.log(`Dialogue demo scenario ready: ${scenario.id}`)
    console.log(`Title: ${scenario.title}`)
    console.log(`Nodes: ${nodes.length}`)
    console.log('Open it from /dialogue, or go directly to /dialogue/dlg_demo_restaurant_reservation.')
  }
} finally {
  db.close()
}
