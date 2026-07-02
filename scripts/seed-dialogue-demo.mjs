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

function json(value) {
  return JSON.stringify(value)
}

loadEnvFile(path.join(process.cwd(), '.env'))
loadEnvFile(path.join(process.cwd(), '.env.local'))

const scenarioId = 'dlg_demo_restaurant_reservation'
const startStageId = 'dlg_demo_lunch_decision'

const scenario = {
  id: scenarioId,
  title: 'Lunch Decision and Ordering',
  description: 'A Scenario Runtime v2 demo. The first stage adapts across several turns until the learner chooses dine-in, delivery, or cooking at home.',
  difficulty: 'beginner',
  userRole: 'Learner deciding lunch',
  aiRole: 'Bilingual English coach',
  tags: ['daily', 'food', 'decision', 'beginner'],
  coverUrl: '',
  isPublished: 1,
  startStageId,
  roleVoice: 'marin',
  coachVoice: 'cedar',
}

const stages = [
  {
    id: startStageId,
    order: 1,
    title: 'Decide Lunch Plan',
    openingLineEn: 'What would you like to have for lunch today?',
    openingLineZh: '今天中午想吃什么？',
    objective: 'Help the learner decide a lunch category and meal mode through natural follow-up questions.',
    slots: [
      { key: 'meal_category', label: 'Meal category', required: true, description: 'Chinese food, Western food, noodles, etc.' },
      { key: 'meal_mode', label: 'Meal mode', required: true, description: 'dine_in, delivery, or cook_home.' },
      { key: 'cuisine', label: 'Cuisine', required: false, description: 'A cuisine preference such as Cantonese food.' },
      { key: 'restaurant_name', label: 'Restaurant name', required: false, description: 'A mentioned restaurant or place.' },
    ],
    completion: {
      rule: 'The learner has decided both what kind of lunch they want and whether they will dine in, order delivery, or cook at home.',
    },
    assessment: {
      scoringFocus: ['Clear lunch preference', 'Natural expression of choice', 'Enough detail to choose a branch'],
      commonErrors: ['Answering with only one word', 'Not saying dine in, delivery, or cook at home'],
    },
    hints: {
      hints: [
        'You can start with: I am not sure yet. What options do I have?',
        'Try saying the food type first, then the meal mode.',
      ],
      sampleAnswer: 'I would like Chinese food, and I think I want to eat at a restaurant.',
    },
    outcomes: [
      { key: 'dine_in', label: 'Dine in', description: 'The learner decides to go to a restaurant.' },
      { key: 'delivery', label: 'Delivery', description: 'The learner decides to order food delivery.' },
      { key: 'cook_home', label: 'Cook at home', description: 'The learner decides to cook at home.' },
    ],
    positionX: 120,
    positionY: 120,
  },
  {
    id: 'dlg_demo_restaurant_ordering',
    order: 2,
    title: 'Order at a Restaurant',
    openingLineEn: 'Great. You are at the restaurant now. What would you like to order?',
    openingLineZh: '好的。现在你到餐厅了，你想点什么？',
    objective: 'Let the learner order a dish and drink politely at a restaurant.',
    slots: [
      { key: 'dish_choice', label: 'Dish choice', required: true, description: 'The main dish the learner wants.' },
      { key: 'drink_choice', label: 'Drink choice', required: true, description: 'A drink or a clear no-drink choice.' },
    ],
    completion: {
      rule: 'The learner orders food and a drink politely enough for a restaurant server to understand.',
    },
    assessment: {
      scoringFocus: ['Polite ordering language', 'Dish and drink are clear'],
      commonErrors: ['Missing please', 'Not naming the item clearly'],
    },
    hints: {
      hints: ['Use: I would like..., please.', 'You can add: Could I also have...?'],
      sampleAnswer: 'I would like the roast duck rice, and could I have iced tea, please?',
    },
    outcomes: [],
    positionX: 520,
    positionY: 40,
  },
  {
    id: 'dlg_demo_delivery_ordering',
    order: 3,
    title: 'Order Delivery',
    openingLineEn: 'Sure. Let us order delivery. What would you like to get, and where should it be delivered?',
    openingLineZh: '可以，那我们点外卖。你想点什么？送到哪里？',
    objective: 'Let the learner choose delivery food and provide delivery information naturally.',
    slots: [
      { key: 'food_choice', label: 'Food choice', required: true, description: 'The food or restaurant for delivery.' },
      { key: 'delivery_place', label: 'Delivery place', required: true, description: 'Home, office, school, or another place.' },
    ],
    completion: {
      rule: 'The learner chooses delivery food and gives a delivery place.',
    },
    assessment: {
      scoringFocus: ['Clear order choice', 'Clear delivery place'],
      commonErrors: ['Forgetting delivery location', 'Using unclear pronouns'],
    },
    hints: {
      hints: ['Try: I would like to order..., and please deliver it to...'],
      sampleAnswer: 'I would like to order Cantonese noodles, and please deliver them to my office.',
    },
    outcomes: [],
    positionX: 520,
    positionY: 260,
  },
  {
    id: 'dlg_demo_cook_home',
    order: 4,
    title: 'Plan Cooking at Home',
    openingLineEn: 'Nice. If you cook at home, what dish will you make, and do you have the ingredients?',
    openingLineZh: '不错。如果在家做饭，你想做什么菜？食材够吗？',
    objective: 'Let the learner explain a home-cooking plan and ingredient readiness.',
    slots: [
      { key: 'dish_to_cook', label: 'Dish to cook', required: true, description: 'The dish the learner plans to cook.' },
      { key: 'ingredient_status', label: 'Ingredient status', required: true, description: 'Whether the learner has ingredients or needs to buy them.' },
    ],
    completion: {
      rule: 'The learner states what they will cook and whether ingredients are ready.',
    },
    assessment: {
      scoringFocus: ['Clear cooking plan', 'Clear ingredient status'],
      commonErrors: ['Only naming a dish without explaining ingredient readiness'],
    },
    hints: {
      hints: ['Try: I will make..., and I already have...'],
      sampleAnswer: 'I will make fried rice, and I already have eggs and vegetables at home.',
    },
    outcomes: [],
    positionX: 520,
    positionY: 480,
  },
]

const transitions = [
  {
    id: 'dlg_demo_lunch_to_dine_in',
    fromStageId: startStageId,
    outcomeKey: 'dine_in',
    label: 'Go to a restaurant',
    condition: {
      intent: 'Learner chooses to eat at a restaurant or dine in.',
      keywords: ['restaurant', 'eat out', 'dine in', 'go there'],
      examples: ['I want to eat at a restaurant.', 'Let us go there to eat.'],
    },
    priority: 10,
    isFallback: 0,
    toStageId: 'dlg_demo_restaurant_ordering',
  },
  {
    id: 'dlg_demo_lunch_to_delivery',
    fromStageId: startStageId,
    outcomeKey: 'delivery',
    label: 'Order delivery',
    condition: {
      intent: 'Learner chooses food delivery or takeout.',
      keywords: ['delivery', 'takeout', 'order online', '外卖'],
      examples: ['I want to order delivery.', 'Let us get takeout.'],
    },
    priority: 20,
    isFallback: 0,
    toStageId: 'dlg_demo_delivery_ordering',
  },
  {
    id: 'dlg_demo_lunch_to_cook_home',
    fromStageId: startStageId,
    outcomeKey: 'cook_home',
    label: 'Cook at home',
    condition: {
      intent: 'Learner chooses to cook at home.',
      keywords: ['cook', 'home', 'make lunch', '在家做'],
      examples: ['I will cook at home.', 'I want to make lunch myself.'],
    },
    priority: 30,
    isFallback: 0,
    toStageId: 'dlg_demo_cook_home',
  },
]

const db = new Database(getDatabasePath())

try {
  db.pragma('foreign_keys = ON')

  const dialogueTable = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'DialogueStage'")
    .get()

  if (!dialogueTable) {
    console.error('Dialogue v2 tables were not found. Run `npm run db:deploy` before seeding the demo scenario.')
    process.exitCode = 1
  } else {
    db.transaction(() => {
      db.prepare('DELETE FROM DialogueScenario WHERE id = ?').run(scenario.id)

      db.prepare(
        `INSERT INTO DialogueScenario
          (id, title, description, difficulty, userRole, aiRole, tagsJson, coverUrl, isPublished, startNodeId, startStageId, roleVoice, coachVoice, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      ).run(
        scenario.id,
        scenario.title,
        scenario.description,
        scenario.difficulty,
        scenario.userRole,
        scenario.aiRole,
        json(scenario.tags),
        scenario.coverUrl || null,
        scenario.isPublished,
        scenario.startStageId,
        scenario.roleVoice,
        scenario.coachVoice
      )

      const insertStage = db.prepare(
        `INSERT INTO DialogueStage
          (id, scenarioId, "order", title, openingLineEn, openingLineZh, objective, slotsJson, completionJson, assessmentJson, hintsJson, outcomesJson, positionX, positionY, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      )

      for (const stage of stages) {
        insertStage.run(
          stage.id,
          scenario.id,
          stage.order,
          stage.title,
          stage.openingLineEn,
          stage.openingLineZh,
          stage.objective,
          json(stage.slots),
          json(stage.completion),
          json(stage.assessment),
          json(stage.hints),
          json(stage.outcomes),
          stage.positionX,
          stage.positionY
        )
      }

      const insertTransition = db.prepare(
        `INSERT INTO DialogueTransition
          (id, scenarioId, fromStageId, outcomeKey, label, conditionJson, priority, isFallback, toStageId, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      )

      for (const transition of transitions) {
        insertTransition.run(
          transition.id,
          scenario.id,
          transition.fromStageId,
          transition.outcomeKey,
          transition.label,
          json(transition.condition),
          transition.priority,
          transition.isFallback,
          transition.toStageId
        )
      }
    })()

    console.log(`Dialogue v2 demo scenario ready: ${scenario.id}`)
    console.log(`Title: ${scenario.title}`)
    console.log(`Stages: ${stages.length}`)
    console.log('Open it from /dialogue, or go directly to /dialogue/dlg_demo_restaurant_reservation.')
  }
} finally {
  db.close()
}
