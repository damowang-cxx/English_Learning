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

function stage({
  id,
  order,
  title,
  openingLineEn,
  openingLineZh,
  objective,
  slots,
  outcomes = [],
  hints,
  sampleAnswer,
  positionX,
  positionY,
}) {
  return {
    id,
    order,
    title,
    openingLineEn,
    openingLineZh,
    objective,
    slots,
    completion: {
      rule: 'Complete only when all required slots are clear and the learner has achieved the communication goal naturally.',
    },
    assessment: {
      scoringFocus: [
        'Communicative goal is completed',
        'Required information is clear enough',
        'Expression sounds natural in spoken English',
        'Tone is polite and appropriate',
      ],
      commonErrors: [
        'Answering with a very short sentence',
        'Not providing enough information to continue',
        'Using a tone that sounds too direct',
        'Missing the practical goal of the stage',
      ],
    },
    hints: {
      hints,
      sampleAnswer,
    },
    outcomes,
    positionX,
    positionY,
  }
}

function transition({
  id,
  fromStageId,
  outcomeKey,
  label,
  intent,
  keywords,
  examples,
  priority,
  toStageId,
  isFallback = 0,
}) {
  return {
    id,
    fromStageId,
    outcomeKey,
    label,
    condition: {
      intent,
      keywords,
      examples,
    },
    priority,
    isFallback,
    toStageId,
  }
}

loadEnvFile(path.join(process.cwd(), '.env'))
loadEnvFile(path.join(process.cwd(), '.env.local'))

const scenarioId = 'dlg_demo_meal_full_flow'
const startStageId = 'dlg_meal_select_meal_time'

const scenario = {
  id: scenarioId,
  title: 'Meal Planning, Ordering, and Checkout',
  description: 'A full Scenario Runtime v2 demo for deciding what to eat, choosing delivery or dine-in, making a reservation, ordering, and paying.',
  difficulty: 'lower-intermediate',
  userRole: 'Learner planning a meal',
  aiRole: 'Bilingual meal coach and restaurant staff',
  tags: ['daily', 'food', 'delivery', 'restaurant', 'beginner'],
  coverUrl: '',
  isPublished: 1,
  startStageId,
  roleVoice: 'marin',
  coachVoice: 'cedar',
}

const stages = [
  stage({
    id: startStageId,
    order: 1,
    title: 'Discuss Meal Time',
    openingLineEn: 'Which meal are we planning today: breakfast, lunch, or dinner?',
    openingLineZh: '我们今天先讨论哪一餐：早饭、中饭，还是晚饭？',
    objective: 'Help the learner choose the meal time they want to plan.',
    slots: [
      { key: 'meal_time', label: 'Meal time', required: true, description: 'breakfast, lunch, or dinner.' },
    ],
    outcomes: [
      { key: 'breakfast', label: 'Breakfast', description: 'The learner chooses breakfast.' },
      { key: 'lunch', label: 'Lunch', description: 'The learner chooses lunch.' },
      { key: 'dinner', label: 'Dinner', description: 'The learner chooses dinner.' },
    ],
    hints: [
      'You can answer simply: Let us plan lunch.',
      'If you are unsure, say: I am not sure. Maybe lunch?',
    ],
    sampleAnswer: 'Let us plan lunch today.',
    positionX: 120,
    positionY: 220,
  }),
  stage({
    id: 'dlg_meal_plan_breakfast',
    order: 2,
    title: 'Breakfast Plan',
    openingLineEn: 'For breakfast, would you rather order delivery or eat at a place nearby?',
    openingLineZh: '早饭的话，你更想点外卖，还是去附近店里吃？',
    objective: 'Help the learner decide whether breakfast should be delivery or dine-in.',
    slots: [
      { key: 'meal_mode', label: 'Meal mode', required: true, description: 'delivery or dine_in.' },
      { key: 'food_preference', label: 'Food preference', required: false, description: 'Preferred breakfast food.' },
      { key: 'time_constraint', label: 'Time constraint', required: false, description: 'How much time the learner has.' },
      { key: 'budget', label: 'Budget', required: false, description: 'Budget preference.' },
    ],
    outcomes: [
      { key: 'delivery', label: 'Delivery', description: 'The learner chooses delivery.' },
      { key: 'dine_in', label: 'Dine in', description: 'The learner chooses to eat out.' },
    ],
    hints: [
      'Try: I want to order delivery because I am in a hurry.',
      'Try: I would like to eat at a cafe nearby.',
    ],
    sampleAnswer: 'I want to order delivery because I do not have much time.',
    positionX: 520,
    positionY: 40,
  }),
  stage({
    id: 'dlg_meal_plan_lunch',
    order: 3,
    title: 'Lunch Plan',
    openingLineEn: 'For lunch, would you like delivery, or would you prefer to eat at a restaurant?',
    openingLineZh: '中饭的话，你想点外卖，还是去餐厅吃？',
    objective: 'Help the learner decide whether lunch should be delivery or dine-in.',
    slots: [
      { key: 'meal_mode', label: 'Meal mode', required: true, description: 'delivery or dine_in.' },
      { key: 'food_preference', label: 'Food preference', required: false, description: 'Preferred food or cuisine.' },
      { key: 'time_constraint', label: 'Time constraint', required: false, description: 'Time pressure or schedule.' },
      { key: 'budget', label: 'Budget', required: false, description: 'Budget preference.' },
    ],
    outcomes: [
      { key: 'delivery', label: 'Delivery', description: 'The learner chooses delivery.' },
      { key: 'dine_in', label: 'Dine in', description: 'The learner chooses to eat out.' },
    ],
    hints: [
      'Try: I would like to eat Cantonese food at a restaurant.',
      'Try: I want delivery because I have a meeting soon.',
    ],
    sampleAnswer: 'I would like to eat Cantonese food at a restaurant.',
    positionX: 520,
    positionY: 220,
  }),
  stage({
    id: 'dlg_meal_plan_dinner',
    order: 4,
    title: 'Dinner Plan',
    openingLineEn: 'For dinner, do you want to order delivery, or go out for a proper meal?',
    openingLineZh: '晚饭的话，你想点外卖，还是出去正式吃一顿？',
    objective: 'Help the learner decide whether dinner should be delivery or dine-in.',
    slots: [
      { key: 'meal_mode', label: 'Meal mode', required: true, description: 'delivery or dine_in.' },
      { key: 'food_preference', label: 'Food preference', required: false, description: 'Preferred dinner food.' },
      { key: 'time_constraint', label: 'Time constraint', required: false, description: 'Dinner time or schedule.' },
      { key: 'budget', label: 'Budget', required: false, description: 'Budget preference.' },
    ],
    outcomes: [
      { key: 'delivery', label: 'Delivery', description: 'The learner chooses delivery.' },
      { key: 'dine_in', label: 'Dine in', description: 'The learner chooses to eat out.' },
    ],
    hints: [
      'Try: I would like to go out for dinner tonight.',
      'Try: Delivery sounds better because I am tired.',
    ],
    sampleAnswer: 'I would like to go out for dinner tonight.',
    positionX: 520,
    positionY: 400,
  }),
  stage({
    id: 'dlg_meal_delivery_choose_food',
    order: 5,
    title: 'Delivery: Choose Food',
    openingLineEn: 'Okay, delivery it is. What would you like to order, and where should it be delivered?',
    openingLineZh: '好的，那就外卖。你想点什么？送到哪里？',
    objective: 'Help the learner choose delivery food and provide a delivery place.',
    slots: [
      { key: 'food_choice', label: 'Food choice', required: true, description: 'The food or restaurant for delivery.' },
      { key: 'delivery_place', label: 'Delivery place', required: true, description: 'Home, office, school, hotel, etc.' },
      { key: 'delivery_time', label: 'Delivery time', required: false, description: 'Now, ASAP, later, or a specific time.' },
      { key: 'budget', label: 'Budget', required: false, description: 'Budget preference.' },
      { key: 'dietary_need', label: 'Dietary need', required: false, description: 'No spicy food, vegetarian, allergy, etc.' },
    ],
    outcomes: [
      { key: 'place_delivery_order', label: 'Place delivery order', description: 'The learner is ready to place the delivery order.' },
    ],
    hints: [
      'Try: I would like to order beef noodles and have them delivered to my office.',
      'You can add a preference: Please make it less spicy.',
    ],
    sampleAnswer: 'I would like to order beef noodles and have them delivered to my office.',
    positionX: 940,
    positionY: 120,
  }),
  stage({
    id: 'dlg_meal_delivery_place_order',
    order: 6,
    title: 'Delivery: Place Order',
    openingLineEn: 'Great. Let us place the order. What exactly should we order, what is the address, and how would you like to pay?',
    openingLineZh: '很好。我们来下单吧。具体点什么？地址是什么？你想怎么支付？',
    objective: 'Help the learner place a delivery order with items, address, and payment method.',
    slots: [
      { key: 'order_items', label: 'Order items', required: true, description: 'Exact food and drink items.' },
      { key: 'delivery_address', label: 'Delivery address', required: true, description: 'The delivery address or clear location.' },
      { key: 'payment_method', label: 'Payment method', required: true, description: 'Card, cash, app payment, etc.' },
      { key: 'quantity', label: 'Quantity', required: false, description: 'Quantity of items.' },
      { key: 'special_request', label: 'Special request', required: false, description: 'Less spicy, no onions, extra sauce, etc.' },
    ],
    hints: [
      'Try: I would like one beef noodle soup and one iced tea.',
      'Try: Please deliver it to Building 2, Room 301. I will pay by card.',
    ],
    sampleAnswer: 'I would like one beef noodle soup and one iced tea. Please deliver it to Building 2, Room 301. I will pay by card.',
    positionX: 1360,
    positionY: 120,
  }),
  stage({
    id: 'dlg_meal_dine_in_choose_place',
    order: 7,
    title: 'Dine In: Choose Food and Place',
    openingLineEn: 'Nice. What kind of food do you want, and where would you like to eat?',
    openingLineZh: '不错。你想吃什么类型的菜？想去哪家店或哪个区域吃？',
    objective: 'Help the learner choose a cuisine or food type and a restaurant or area for dine-in.',
    slots: [
      { key: 'food_or_cuisine', label: 'Food or cuisine', required: true, description: 'Cuisine or dish preference.' },
      { key: 'restaurant_or_area', label: 'Restaurant or area', required: true, description: 'Restaurant name or area to eat in.' },
      { key: 'party_size', label: 'Party size', required: false, description: 'Number of people.' },
      { key: 'time', label: 'Time', required: false, description: 'When the learner wants to eat.' },
      { key: 'budget', label: 'Budget', required: false, description: 'Budget preference.' },
    ],
    outcomes: [
      { key: 'reservation_needed', label: 'Reservation needed', description: 'The learner wants or needs to make a reservation.' },
      { key: 'walk_in', label: 'Walk in', description: 'The learner will go directly without reservation.' },
    ],
    hints: [
      'Try: I want Cantonese food, and I know a good restaurant near the mall.',
      'If you need a reservation, say: We should book a table first.',
    ],
    sampleAnswer: 'I want Cantonese food, and I know a good restaurant near the mall. We should book a table first.',
    positionX: 940,
    positionY: 360,
  }),
  stage({
    id: 'dlg_meal_table_reservation',
    order: 8,
    title: 'Dine In: Make a Reservation',
    openingLineEn: 'Sure. Let us make a reservation. What restaurant, what time, how many people, and under what name?',
    openingLineZh: '好的。我们来订位。哪家餐厅？几点？几个人？用什么名字订？',
    objective: 'Help the learner make a restaurant reservation with the required details.',
    slots: [
      { key: 'restaurant_name', label: 'Restaurant name', required: true, description: 'The restaurant to reserve.' },
      { key: 'party_size', label: 'Party size', required: true, description: 'Number of diners.' },
      { key: 'reservation_time', label: 'Reservation time', required: true, description: 'Reservation date/time.' },
      { key: 'reservation_name', label: 'Reservation name', required: true, description: 'Name for the reservation.' },
      { key: 'phone', label: 'Phone', required: false, description: 'Phone number if needed.' },
      { key: 'seating_preference', label: 'Seating preference', required: false, description: 'Window, quiet table, non-smoking, etc.' },
    ],
    outcomes: [
      { key: 'arrive_restaurant', label: 'Arrive at restaurant', description: 'The reservation is complete and the learner can arrive.' },
    ],
    hints: [
      'Try: I would like to book a table for two at 7 p.m. under the name Wang.',
      'You can add: Could we have a quiet table, please?',
    ],
    sampleAnswer: 'I would like to book a table for two at 7 p.m. under the name Wang.',
    positionX: 1360,
    positionY: 300,
  }),
  stage({
    id: 'dlg_meal_arrival_seating',
    order: 9,
    title: 'Dine In: Arrival and Seating',
    openingLineEn: 'Welcome. Do you have a reservation, or would you like a table?',
    openingLineZh: '欢迎光临。你有订位吗？还是想现场要一张桌子？',
    objective: 'Help the learner enter the restaurant, mention a reservation or request a table, and confirm party size.',
    slots: [
      { key: 'reservation_or_table_request', label: 'Reservation or table request', required: true, description: 'Reservation name or walk-in table request.' },
      { key: 'party_size_confirmation', label: 'Party size confirmation', required: true, description: 'Number of people at arrival.' },
      { key: 'seating_preference', label: 'Seating preference', required: false, description: 'Window, quiet table, etc.' },
    ],
    outcomes: [
      { key: 'start_ordering', label: 'Start ordering', description: 'The learner is seated and ready to order.' },
    ],
    hints: [
      'Try: Yes, I have a reservation under Wang for two people.',
      'For walk-in: Could we have a table for two, please?',
    ],
    sampleAnswer: 'Yes, I have a reservation under Wang for two people.',
    positionX: 1760,
    positionY: 300,
  }),
  stage({
    id: 'dlg_meal_restaurant_order',
    order: 10,
    title: 'Dine In: Order Food',
    openingLineEn: 'Here is the menu. What would you like to order?',
    openingLineZh: '这是菜单。你想点什么？',
    objective: 'Help the learner order a main dish and drink politely, with optional preferences.',
    slots: [
      { key: 'main_dish', label: 'Main dish', required: true, description: 'The main dish the learner orders.' },
      { key: 'drink_or_no_drink', label: 'Drink or no drink', required: true, description: 'Drink choice or a clear refusal.' },
      { key: 'appetizer', label: 'Appetizer', required: false, description: 'Optional starter or side dish.' },
      { key: 'dietary_request', label: 'Dietary request', required: false, description: 'Less spicy, no peanuts, vegetarian, etc.' },
    ],
    outcomes: [
      { key: 'checkout', label: 'Checkout', description: 'The meal is ordered and the learner is ready to pay.' },
    ],
    hints: [
      'Try: I would like the roast duck rice, please.',
      'Try: Could I also have iced tea? Please make it less spicy.',
    ],
    sampleAnswer: 'I would like the roast duck rice and an iced tea, please. Could you make it less spicy?',
    positionX: 2160,
    positionY: 300,
  }),
  stage({
    id: 'dlg_meal_checkout',
    order: 11,
    title: 'Dine In: Checkout',
    openingLineEn: 'Whenever you are ready, you can ask for the bill. How would you like to pay?',
    openingLineZh: '如果准备好了，可以叫服务员买单。你想怎么支付？',
    objective: 'Help the learner ask for the bill and choose a payment method politely.',
    slots: [
      { key: 'ask_for_bill', label: 'Ask for bill', required: true, description: 'A polite request for the bill/check.' },
      { key: 'payment_method', label: 'Payment method', required: true, description: 'Card, cash, mobile pay, etc.' },
      { key: 'receipt', label: 'Receipt', required: false, description: 'Whether the learner wants a receipt.' },
      { key: 'split_bill', label: 'Split bill', required: false, description: 'Whether the bill should be split.' },
    ],
    hints: [
      'Try: Could we have the bill, please?',
      'Try: I will pay by card. Could I get a receipt?',
    ],
    sampleAnswer: 'Could we have the bill, please? I will pay by card, and could I get a receipt?',
    positionX: 2560,
    positionY: 300,
  }),
]

const transitions = [
  transition({
    id: 'dlg_meal_t_breakfast',
    fromStageId: startStageId,
    outcomeKey: 'breakfast',
    label: 'Breakfast',
    intent: 'Learner chooses breakfast.',
    keywords: ['breakfast', 'morning meal', '早饭', '早餐'],
    examples: ['Let us plan breakfast.', 'I want to talk about breakfast.'],
    priority: 10,
    toStageId: 'dlg_meal_plan_breakfast',
  }),
  transition({
    id: 'dlg_meal_t_lunch',
    fromStageId: startStageId,
    outcomeKey: 'lunch',
    label: 'Lunch',
    intent: 'Learner chooses lunch.',
    keywords: ['lunch', 'noon', '中饭', '午饭', '午餐'],
    examples: ['Let us plan lunch.', 'I want to decide what to eat for lunch.'],
    priority: 20,
    toStageId: 'dlg_meal_plan_lunch',
  }),
  transition({
    id: 'dlg_meal_t_dinner',
    fromStageId: startStageId,
    outcomeKey: 'dinner',
    label: 'Dinner',
    intent: 'Learner chooses dinner.',
    keywords: ['dinner', 'evening meal', '晚饭', '晚餐'],
    examples: ['Let us plan dinner.', 'I want to go out for dinner.'],
    priority: 30,
    toStageId: 'dlg_meal_plan_dinner',
  }),
  ...['breakfast', 'lunch', 'dinner'].flatMap((meal, mealIndex) => {
    const fromStageId = `dlg_meal_plan_${meal}`
    return [
      transition({
        id: `dlg_meal_t_${meal}_delivery`,
        fromStageId,
        outcomeKey: 'delivery',
        label: `${meal} delivery`,
        intent: `Learner chooses delivery for ${meal}.`,
        keywords: ['delivery', 'takeout', 'order online', '外卖', '点外卖'],
        examples: ['I want to order delivery.', 'Delivery sounds better.'],
        priority: mealIndex * 10 + 10,
        toStageId: 'dlg_meal_delivery_choose_food',
      }),
      transition({
        id: `dlg_meal_t_${meal}_dine_in`,
        fromStageId,
        outcomeKey: 'dine_in',
        label: `${meal} dine in`,
        intent: `Learner chooses to eat out or dine in for ${meal}.`,
        keywords: ['dine in', 'eat out', 'restaurant', 'go there', '堂食', '去店里'],
        examples: ['I want to eat at a restaurant.', 'Let us go there to eat.'],
        priority: mealIndex * 10 + 20,
        toStageId: 'dlg_meal_dine_in_choose_place',
      }),
    ]
  }),
  transition({
    id: 'dlg_meal_t_delivery_place_order',
    fromStageId: 'dlg_meal_delivery_choose_food',
    outcomeKey: 'place_delivery_order',
    label: 'Place delivery order',
    intent: 'Learner has chosen delivery food and place, and is ready to order.',
    keywords: ['order', 'place the order', 'address', '下单', '地址'],
    examples: ['I am ready to place the order.', 'Please deliver it to my office.'],
    priority: 10,
    toStageId: 'dlg_meal_delivery_place_order',
  }),
  transition({
    id: 'dlg_meal_t_dine_in_reservation',
    fromStageId: 'dlg_meal_dine_in_choose_place',
    outcomeKey: 'reservation_needed',
    label: 'Make a reservation',
    intent: 'Learner wants or needs to reserve a table before going to the restaurant.',
    keywords: ['reservation', 'book a table', 'reserve', '订位', '预约'],
    examples: ['We should book a table first.', 'I want to make a reservation.'],
    priority: 10,
    toStageId: 'dlg_meal_table_reservation',
  }),
  transition({
    id: 'dlg_meal_t_dine_in_walk_in',
    fromStageId: 'dlg_meal_dine_in_choose_place',
    outcomeKey: 'walk_in',
    label: 'Walk in',
    intent: 'Learner wants to go directly without reservation.',
    keywords: ['walk in', 'go directly', 'no reservation', '直接去', '不用订位'],
    examples: ['Let us just walk in.', 'I think we can go directly.'],
    priority: 20,
    toStageId: 'dlg_meal_arrival_seating',
  }),
  transition({
    id: 'dlg_meal_t_reservation_arrive',
    fromStageId: 'dlg_meal_table_reservation',
    outcomeKey: 'arrive_restaurant',
    label: 'Arrive at restaurant',
    intent: 'Reservation details are complete and learner can arrive at the restaurant.',
    keywords: ['reservation complete', 'arrive', 'go there', '到店'],
    examples: ['The reservation is under Wang at 7 p.m.', 'Now we can go to the restaurant.'],
    priority: 10,
    toStageId: 'dlg_meal_arrival_seating',
  }),
  transition({
    id: 'dlg_meal_t_arrival_order',
    fromStageId: 'dlg_meal_arrival_seating',
    outcomeKey: 'start_ordering',
    label: 'Start ordering',
    intent: 'Learner has entered and is seated, ready to order.',
    keywords: ['seated', 'ready to order', 'menu', '入座', '点餐'],
    examples: ['We have a reservation under Wang for two.', 'Could we have the menu?'],
    priority: 10,
    toStageId: 'dlg_meal_restaurant_order',
  }),
  transition({
    id: 'dlg_meal_t_order_checkout',
    fromStageId: 'dlg_meal_restaurant_order',
    outcomeKey: 'checkout',
    label: 'Checkout',
    intent: 'Learner has ordered food and is ready to ask for the bill.',
    keywords: ['bill', 'check', 'pay', '结账', '买单'],
    examples: ['That is all, thank you.', 'Could we have the bill now?'],
    priority: 10,
    toStageId: 'dlg_meal_checkout',
  }),
]

const db = new Database(getDatabasePath())

try {
  db.pragma('foreign_keys = ON')

  const stageTable = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'DialogueStage'")
    .get()

  if (!stageTable) {
    console.error('Dialogue v2 tables were not found. Run `npm run db:deploy` before seeding the meal scenario.')
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

      for (const item of stages) {
        insertStage.run(
          item.id,
          scenario.id,
          item.order,
          item.title,
          item.openingLineEn,
          item.openingLineZh,
          item.objective,
          json(item.slots),
          json(item.completion),
          json(item.assessment),
          json(item.hints),
          json(item.outcomes),
          item.positionX,
          item.positionY
        )
      }

      const insertTransition = db.prepare(
        `INSERT INTO DialogueTransition
          (id, scenarioId, fromStageId, outcomeKey, label, conditionJson, priority, isFallback, toStageId, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      )

      for (const item of transitions) {
        insertTransition.run(
          item.id,
          scenario.id,
          item.fromStageId,
          item.outcomeKey,
          item.label,
          json(item.condition),
          item.priority,
          item.isFallback,
          item.toStageId
        )
      }
    })()

    console.log(`Dialogue meal v2 scenario ready: ${scenario.id}`)
    console.log(`Title: ${scenario.title}`)
    console.log(`Stages: ${stages.length}`)
    console.log(`Transitions: ${transitions.length}`)
    console.log('Open it from /dialogue, or go directly to /dialogue/dlg_demo_meal_full_flow.')
  }
} finally {
  db.close()
}
