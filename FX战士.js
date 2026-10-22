/**
 * FX-plugin —— FX 战士久留美 · 双市场合并账户版
 * 别名：拟股喵喵
 * 单文件版：plugins/example/FX战士.js
 *
 * 本次改动：
 *   - 押注金额 = 保证金，名义价值 = 押注金额 × 杠杆
 *   - 逐仓爆仓：每个仓位独立判定，亏损 ≥ 保证金就爆掉
 *   - 共享场爆仓自动退出活跃名单（两个场都空仓时）
 */

import plugin from "../../lib/plugins/plugin.js"
import _ from "lodash"
import fs from "fs"
import path from "path"

/* ============================================================
 *  游戏别名
 * ============================================================ */
const GAME_NAME = "FX 战士久留美"
const GAME_ALIAS = "拟股喵喵"
const GAME_FULL = `${GAME_NAME} · ${GAME_ALIAS}`

const GAME_NICKNAMES = [
  "股真人", "获利少年亡", "花千股", "股进奇谭", "股得败",
  "炒币战士", "久久的奇妙冒险", "股赌摇滚", "浪埋股士", "股市煽百首",
  "韭留没", "韭皇炒币", "爆仓姬","人在久途", "人在韭途", 
  "久久危机", "但愿人长久", "但愿人长韭","外汇少女的呢喃","股股嘎嘎",
  "股祸崽","炒利空的汇夜姬","某科学的炒币雌炮","磅多利之亿次买股","梦限大（炒外汇篇）",
  "哭泣的少女FX队","追冥利息","临股子","我不是股神","死亡币姬",
  "赌博妈失录","我推的外汇","Re：从零开始的爆仓生活","为没好的外汇献上韭菜","进击的韭菜",
  "福贺久留美，韭醉身姿如外汇化般","花千股","炒，死亡和杠杆","诓赌之元",
  "杠杆原理","与你加杠至生命尽头","炒炒炒西汇拟的100个FX股","炒姬飞下","帮坠母 一次买够！！！",
  "股疯传奇","Girl's Bank Cry","芳文跳","赛妈凉撸贸汇股娘","查理韭市",
  "日本人能飞","利磕立死","败钱女主太多了","韭韭的奇妙冒险市之海","以负之名",
  "喜扬扬与悔太浪之股股拐借大作战","开局股市买外汇","炒股不堪的你最可爱了","股之失","储门的市界",
  "绝命赌失","新逝寄外汇战士","在外汇市场加杠的四(死)人","股涨急弃人","上杉汇离亿",
  "惜红市首负","爱娃母寄卡","擅长加杠的韭菜","在屏幕后面加杠的韭人","我独自炒FX",
  "无值赚生~到了外汇市场就拿出真本事","21世纪外汇目录","韭菜同学转生后还是想炒股","韭菜同学韭魔了","落天医",
  "月挣零","储银未来","终赢贴投","哪炸之摸筒降市","注注瞎之竞股小英雄",
  "碧绿之嗨","憧憬成为华尔街之娘","飞人哉","经济的拒人","汇价的诱惑",
  "股灭之人","败完英镑","祸引股折","赢魂","杠杆雄心4",
  "加米启市恐倭","假面期市押几坨","骤输汇战","兜破仓穷","兜裸沓露",
  "待到秋来韭月八","魔法少女消元","千股万韭","凡人休线赚","灰尽赚线",
  "黯天 (台)危机","末绿的夜宴","王股保卫战","红绿回战","小飞侠逼得盘",
  "想吃掉我的外汇市场","我怎么能当你的证明人不行不行(外汇不行)","利滋与清盘","韭菜的幸负生活","股纪元",
  "飞耻人生","街角赌徒","外汇金刚:韭菜勇士崛起","汇赢的","抵家翱忑埋",
  "向外汇妈惜团","飞翔的少女","汇股娘","冬日韭心耐","股民低怜",
  "韭菜少女育成计划","跳楼姬","无量塌汇市","没股利","少女jump",
  "赚生亡女与韭菜欠金的外汇割命","朋友的韭","外汇冰火人","亿股又汰","来股市",
  "浪埋股市","感谢堆债，大孝姐才不玩外汇游戏","别当外汇酱了!","未闻韭名","邻家的韭菜同学",
  "韭菜盒子","戒赌吧宣传片","重赌未来易韭韭韭","牢股来股高盘碎乃果","股得money",
  "亡牌飞行元","妈戏之亡","债务降临到我身边","末日后韭垫","刺客股留凄",
  "胆大杠","跃动清春","炒股人公","大家一起飞扬扬","致炒FX的你",
  "跃汇大作战","放手一搏吧，别顾虑太多","天桥之下","寻找股恩慕(棍母)",
  "值无大战降市","难放股怨","60秒狂赌所","赌为妈传奇","我赌市界",
  "如果赌狗是一群美少女","姬动战市(杠)杆达FX","股神已死","汇完这个再去死","股跃防元",
  "我的外汇爆仓仓","开薪超人","坠梦赤字心","日本人会飞"
]

const _escapeReg = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
const _nickHelp = GAME_NICKNAMES.map(n => `${_escapeReg(n)}(帮助|玩法)`).join("|")
const _nickHelpFull = GAME_NICKNAMES.map(n => `${_escapeReg(n)}详细(帮助)?`).join("|")
const HELP_REG = `^#?(FX帮助|fx帮助|炒汇帮助|拟股喵喵帮助|${_nickHelp})$`
const HELP_FULL_REG = `^#?(FX详细(帮助)?|fx详细(帮助)?|拟股喵喵详细(帮助)?|${_nickHelpFull})$`

/* ============================================================
 *  Redis 兼容层
 * ============================================================ */
const RS = {
  async sadd(k, m) {
    try {
      if (typeof redis.sAdd === "function") return await redis.sAdd(k, m)
      return await redis.sadd(k, m)
    } catch (e) { logger.error("[FX-plugin] sadd 失败", e) }
  },
  async srem(k, m) {
    try {
      if (typeof redis.sRem === "function") return await redis.sRem(k, m)
      return await redis.srem(k, m)
    } catch (e) { logger.error("[FX-plugin] srem 失败", e) }
  },
  async sismember(k, m) {
    try {
      if (typeof redis.sIsMember === "function") return await redis.sIsMember(k, m)
      return await redis.sismember(k, m)
    } catch (e) { logger.error("[FX-plugin] sismember 失败", e); return false }
  },
  async smembers(k) {
    try {
      if (typeof redis.sMembers === "function") return await redis.sMembers(k)
      return await redis.smembers(k)
    } catch (e) { logger.error("[FX-plugin] smembers 失败", e); return [] }
  }
}

/* ============================================================
 *  配置区
 * ============================================================ */
const CONFIG = {
  initialMoney:    100000,
  defaultLeverage: 25,
  maxLeverage:     2000,
  stopOutRate:     0.5,
  warnRate:        1.2,
  subsidyMin:      3000,
  subsidyMax:      8000,
  // 押注金额（保证金）上下限
  minAmount:       1000,
  maxAmount:       100000000,
  blowupNotifyCdMs: 24 * 3600 * 1000,
  blackSwanChance: 0.02,
  loanAmount:      50000,
  loanDueMs:       3 * 24 * 3600 * 1000,
  loanDailyRate:   0.003,
  bankruptcyReset: 10000,
  watchProbMoney:  0.50,
  watchProbIntel:  0.75,
  watchProbBoth:   0.90,
  rooftopBonusMin: 100,
  rooftopBonusMax: 500,
  rooftopWindowMs: 5 * 60 * 1000,
  workCdMs:        4 * 3600 * 1000,
  bPlanWindowMs:   5 * 60 * 1000,
  bPlanMinBalance: 100,
  helpFileDir:     "resources/fx-help",
  helpFileName:    "拟股喵喵-详细帮助.txt",
  privateMsgDelay: 400,
  maxAdvanceDays:  100,
  multiDayBusyMs:  30000,
  stealAmount:     3000000,
  stealSuccessRate: 0.5
}

const LEVERAGE_ALIAS = { "稳": 5, "中": 25, "梭": 200, "疯": 2000 }
const LEVERAGE_TABLE = [
  { alias: "稳", lev: 5,    note: "逆向 20% 才爆" },
  { alias: "中", lev: 25,   note: "逆向 4% 才爆" },
  { alias: "梭", lev: 200,  note: "逆向 0.5% 才爆" },
  { alias: "疯", lev: 2000, note: "逆向 0.05% 就没了" }
]

const PAIRS = [
  { code: "USDJPY", alias: "美日", name: "美元/日元",   price: 150.250, precision: 3, volatility: 0.0025, drift: 0 },
  { code: "EURUSD", alias: "欧美", name: "欧元/美元",   price: 1.08500, precision: 5, volatility: 0.0022, drift: 0 },
  { code: "GBPUSD", alias: "镑美", name: "英镑/美元",   price: 1.26500, precision: 5, volatility: 0.0038, drift: 0 },
  { code: "AUDUSD", alias: "澳美", name: "澳元/美元",   price: 0.66500, precision: 5, volatility: 0.0030, drift: 0 },
  { code: "USDCNY", alias: "美中", name: "美元/人民币", price: 7.24500, precision: 4, volatility: 0.0012, drift: 0 },
  { code: "EURJPY", alias: "欧日", name: "欧元/日元",   price: 162.850, precision: 3, volatility: 0.0028, drift: 0 },
  { code: "XAUUSD", alias: "黄金", name: "黄金/美元",   price: 2350.50, precision: 2, volatility: 0.0035, drift: 0.0001 },
  { code: "EURCHF", alias: "欧瑞", name: "欧元/瑞郎",   price: 1.20000, precision: 5, volatility: 0.0008, drift: 0 },
  { code: "USDCHF", alias: "美瑞", name: "美元/瑞郎",   price: 0.88500, precision: 5, volatility: 0.0010, drift: 0 }
]

const PAIR_PATTERN = "[\\u4e00-\\u9fa5A-Za-z]{2,6}"
const LEV_PATTERN  = "(?:\\d+|稳|中|梭|疯)"

function findPair(input) {
  if (!input) return null
  const s = String(input).trim()
  const byCode = PAIRS.find(p => p.code === s.toUpperCase())
  if (byCode) return byCode
  return PAIRS.find(p => p.alias === s) || null
}
function parseLeverage(s) {
  if (s === undefined || s === null || s === "") return CONFIG.defaultLeverage
  if (LEVERAGE_ALIAS[s]) return LEVERAGE_ALIAS[s]
  const n = parseInt(s)
  return isNaN(n) ? null : n
}

function generateIntel() {
  const pair = PAIRS[Math.floor(Math.random() * PAIRS.length)]
  const dir = Math.random() > 0.5 ? 1 : -1
  const strength = 0.003 + Math.random() * 0.012
  return { code: pair.code, alias: pair.alias, dir, drift: dir * strength }
}

/* ============================================================
 *  打工池
 * ============================================================ */
const JOBS = [
  { name: "便利店",    pay: [500, 1200] },
  { name: "快递员",    pay: [600, 1400] },
  { name: "餐厅后厨",  pay: [700, 1500] },
  { name: "发传单",    pay: [300,  800] },
  { name: "家教",      pay: [1000, 2000] },
  { name: "搬运工",    pay: [800, 1600] },
  { name: "夜市摆摊",  pay: [400, 1800] }
]

const WORK_TALK_OK = [
  "客人络绎不绝，忙到脚不沾地。",
  "普普通通的一天，报酬到账。",
  "今天的班，没什么特别的。",
  "下班了。累，但钱到手了。",
  "你数了一整天的钱，都是别人的。"
]
const WORK_TALK_OVER = [
  "老板临时加了两小时的班。",
  "同事请假了，活全落在你身上。\n不过多劳多得。",
  "临下班来了个大单。\n你加班到深夜。"
]
const WORK_TALK_BAD = [
  "客人一直在闹，工资被扣了。",
  "货砸了，损失从工资里扣。",
  "主管莫名其妙找茬。\n今天白干一半。"
]
const WORK_TALK_JACKPOT = [
  "老板娘看你勤快，给了一大笔。",
  "客人留了笔超额小费。",
  "这活一个月只能碰上一次，你赶上了。"
]

const BPLAN_TALK_START = [
  "启动B计划！", "不成功，便成仁。", "这次我把剩下的全部押上。",
  "还有什么好怕的？反正已经这样了。", "翻本，就在这一把。",
  "赌狗，站起来！", "以命抵债。", "最后一搏。",
  "这不是赌博，这是我活着的意义。", "要么翻身，要么上天台。"
]

const BPLAN_TALK_RESULT = {
  jackpot: [
    "翻！身！了！！！\n那一瞬间，你的手在抖。",
    "成了！！！\n这就是赌狗的浪漫。",
    "命中注定的一把。\n你笑了，眼泪流了下来。"
  ],
  win: [
    "赢了。\n不是暴富，但活下来了。",
    "小赚。\n至少没有变得更惨。",
    "还行。\n这一把是正的。"
  ],
  bust: [
    "……", "又爆了。\n这次是真的什么都不剩了。",
    "B计划失败。\n天台就在前方。",
    "你盯着屏幕，屏幕也盯着你。",
    "钱没了。\n但你还在。"
  ]
}

const pick = arr => arr[Math.floor(Math.random() * arr.length)]

/* ============================================================
 *  黑天鹅事件库
 *  - 每次 tickMarket 后独立判定（每推进一天都可能触发）
 *  - pairs: "ALL" 表示系统性事件，影响所有货币对
 *  - inversePairs: 系统性事件里反向走的品种（如雷曼时黄金涨）
 * ============================================================ */
const BLACK_SWAN_EVENTS = [
  {
    name: "瑞士央行放弃汇率下限",
    desc: "瑞士央行宣布放弃欧元/瑞郎汇率下限！欧元/瑞郎瞬间崩盘！",
    pairs: ["EURCHF", "USDCHF"],
    jumpMin: 0.15, jumpMax: 0.30, direction: -1
  },
  {
    name: "雷曼海啸",
    desc: "雷曼兄弟宣布破产！全球金融市场陷入恐慌性抛售，避险资金涌入黄金！",
    pairs: "ALL",
    jumpMin: 0.03, jumpMax: 0.12, direction: -1,
    inversePairs: ["XAUUSD"]
  },
  {
    name: "黑色星期一",
    desc: "全球股市崩盘，避险资金涌入日元和瑞郎！",
    pairs: ["USDJPY", "EURJPY", "EURCHF", "USDCHF"],
    jumpMin: 0.04, jumpMax: 0.12, direction: -1
  },
  {
    name: "黄金避险潮",
    desc: "地缘政治骤然紧张，避险资金疯狂涌入黄金！",
    pairs: ["XAUUSD"],
    jumpMin: 0.05, jumpMax: 0.15, direction: 1
  },
  {
    name: "非农爆表",
    desc: "美国非农数据远超预期，美元指数狂飙！",
    pairs: ["USDJPY", "USDCNY", "USDCHF"],
    jumpMin: 0.02, jumpMax: 0.08, direction: 1
  },
  {
    name: "英国脱欧公投",
    desc: "英国意外脱欧！英镑和欧系货币暴跌！",
    pairs: ["GBPUSD", "EURJPY"],
    jumpMin: 0.08, jumpMax: 0.18, direction: -1
  },
  {
    name: "央妈出手",
    desc: "中国人民银行大举干预，人民币暴涨！",
    pairs: ["USDCNY"],
    jumpMin: 0.03, jumpMax: 0.10, direction: -1
  },
  {
    name: "澳央行意外降息",
    desc: "澳洲联储意外降息 50 个基点！澳元暴跌！",
    pairs: ["AUDUSD"],
    jumpMin: 0.04, jumpMax: 0.10, direction: -1
  },
  {
    name: "日元套息交易崩溃",
    desc: "日元套息交易大规模平仓，日元暴涨！",
    pairs: ["USDJPY", "EURJPY"],
    jumpMin: 0.05, jumpMax: 0.15, direction: -1
  },
  {
    name: "EUR/JPY 闪崩",
    desc: "流动性枯竭，EUR/JPY 盘中闪崩！",
    pairs: ["EURJPY"],
    jumpMin: 0.05, jumpMax: 0.12, direction: -1
  },
  {
    name: "神秘大单砸盘",
    desc: "神秘大单砸向美元/日元，市场一片哀嚎！",
    pairs: ["USDJPY"],
    jumpMin: 0.03, jumpMax: 0.08, direction: -1
  },
  {
    name: "英国央行紧急加息",
    desc: "英国央行紧急加息 200 基点，英镑暴涨！",
    pairs: ["GBPUSD"],
    jumpMin: 0.05, jumpMax: 0.12, direction: 1
  },
  {
    name: "欧洲央行意外降息",
    desc: "欧洲央行意外降息，欧元暴跌！",
    pairs: ["EURUSD", "EURJPY", "EURCHF"],
    jumpMin: 0.03, jumpMax: 0.08, direction: -1
  },
  {
    name: "日元干预",
    desc: "日本财务省出手干预汇市，USD/JPY 瞬间暴跌！",
    pairs: ["USDJPY"],
    jumpMin: 0.04, jumpMax: 0.10, direction: -1
  },
  {
    name: "美债上限危机",
    desc: "美国债务违约风险激增，美元承压，黄金暴涨！",
    pairs: ["USDJPY", "USDCNY"],
    jumpMin: 0.03, jumpMax: 0.08, direction: -1,
    inversePairs: ["XAUUSD"]
  }
]

/* ============================================================
 *  NPC 配置
 * ============================================================ */
const NPC_LIST = [
  {
    id: "kurumi", name: "久留美", style: "激进",
    revengeTalk: [
	"这次一定。", 
	"再赌一把，这次真的能翻本。", 
	"理性？理性能当饭吃吗？", 
	"只要再来一波，我就能全部回本……",
	"亏了这么久，赔率该轮到我了吧？",
	"现在买入，一定爆赚！",
    "我算过了，就是现在。",
    "再不上车就真的没机会了。",
	"母亲当年就是这么走的。我也快了。",
    "两千万。她攒了一辈子。我得把它赢回来。",
	],
    yoloTalk: [
	"梭哈才叫活过！", 
	"我就知道你会这么选。", 
	"这才是FX战士！", 
	"来吧，天台见。",
	"现在买入，一定爆赚！", 
	"现在就是最低点。跑什么？", 
	"满仓，全押，别看了。",
	"满仓，满仓！",
    "别问，问就是加。",
	"对，就是这种感觉。烧起来的感觉。",
    "活着不梭，和死了有什么区别。",
	"这不叫赌，这叫信仰。",
    "买入！立刻！马上！",
    "看到这根 K 线了吗？它在喊你加仓。",
    "再犹豫，机会就没了。",
    "上啊！别管那么多！",
	"FX，简单。",
	],
	momTalk: [
      "我妈那天，从阳台上跳下去的。两千万。全没了。",
      "我站在楼下，人群里，一句话没说。那天风很大。",
      "你说，两千万能买回一个人吗？我想试试看。",
      "她要是再多赌一把，是不是就不会走那一步了？",
      "我一直在想她。尤其是下单的时候。",
    ],
	catchphrase: "现在买入，一定爆赚！",
  },
  {
    id: "mochiko", name: "萌智子", style: "理性&双面",
    urgeTalk: [
    "对咯，就这么梭哈。",
    "对咯，就这么加仓。",
    "对咯，就这么干。",
    "就是这个气势，再来一把。",
    "别停啊，手感正好。",
    "犹豫就会败北。",
    "又一个大佬即将诞生。",
    "稳了稳了，这波稳了。",
    "我看好你哦。",
    "冲鸭。",
    ],
	warnTalk: [
	"维持率有点低了，我建议你砍仓。",
	"你现在的仓位很危险，别硬扛。", 
	"及时止损比什么都重要。",
	"砍不砍随你。只是我见过太多人，砍在最低点。",
    "维持率是有点低……但你这单的逻辑明明没问题，扛一下试试？",
    "止损当然可以。可你想过没有，反弹有时候就在明天。",
    "别急着砍。再看看，说不定还能回来。",
	"……我知道我说了你也未必听。但还是想说一句：砍了吧。",
	"对咯，就这么梭哈。",
    "砍仓？想什么呢。看下一根K线再说。",
    "别急着砍。反弹马上就来。",
    "收手？这么点钱就想跑？",
    "撑住。你会感谢现在的自己的。",
    "别听他们瞎扯。你的仓位没问题。",
    "再撑一天。就一天。",
	],
    profitTalk: [
	"见好就收，别让贪心毁了你。",
	"你已经赢了，别把赢的还回去。",
	"赚了就想跑？这么点就满足，那你也别玩 FX 了。",
    "落袋为安，是普通人的活法。当然，也挺好的。",
    "你已经赢了。现在只剩一个问题——赚这么点就够了吗？",
    "收手吧。不过说真的，你确定自己忍得住？",
	"对咯，赚了就跑。……不过你真的满足了吗？",
    "收手？也行。反正明天你还是会回来。",
    "赚这么点就跑？那不如不玩。",
    "行吧，你跑吧。我去看别人的热闹。",
    "你跑得掉吗？",
	],
	// 新增：智人tv 式怂恿
    hypeTalk: [
      "对咯，就这么梭哈。",
      "这才对嘛，加！",
      "买它买它买它！",
      "冲啊，看着都替你爽。",
      "再梭一次！最后一次！",
      "啊对对对，就是这个感觉。",
      "别停，别停，看着多刺激。",
      "爽！这才叫玩。",
    ],
    // 新增：表面关心、实际保持上瘾
    sootheTalk: [
      "别难过，先歇一会儿。",
      "深呼吸。钱还能赚回来。",
      "没事的，大家都爆过。",
      "下一次会好起来的。",
      "……下一次。",
    ],
  },
  {
    id: "mebuki", name: "芽吹", style: "直觉",
    tipTalk: [
	"我觉得美日该涨了，你觉得呢？", 
	"我刚才看了一眼，黄金好像要动。", 
	"你最近在玩什么？我跟你说，欧元那个……",
	"如果是久留美，应该会买入这个。",
    "久留美那单我也跟了，应该没事吧？",
    "我昨天梦到它涨了。这算不算内幕消息？",
	"我不太懂，但我梭了。",
    "看着挺便宜的，买了。",
    "我在想，久留美会怎么操作？",
    "刚才那个 K 线，久留美肯定会梭。",
    "我也不知道为什么，反正就是觉得该买。",
    "我跟你说，昨晚我做梦，梦到镑美暴涨。",
    "你猜我为什么押这个？不知道，直觉。",
	],
    loanTalk: [
	"没钱了？我这里有办法。", 
	"要不要借一点？我认识人。", 
	"学生贷款、信用贷……总能凑到的。",
	"借呗借不到？我帮你想想办法。",
	"借了再说嘛，反正要还的。",
  "欠着又不丢人，我也欠过。",	  
  "借钱？我也借过。没事，反正还不上也没关系。",
  "打工是不可能的，这辈子都不可能打工。",
  "借到就是赚到，别想那么多。",
  "我上次借的还没还呢……你别学我。",
	],
	// 新增
    workTalk: [
      "打……打工是不可能的，这辈子都不可能打工的。",
      "让我干，干活？我宁可去死。",
      "手是用来下单的，不是用来搬砖的。",
	  "别打工了，跟我一起赌吧。",
    ],
    followTalk: [
      "如果是久留美，应该会买入这个。",
      "久留美会怎么选？她一定会梭。",
      "久留美说过，这种时候就该上。",
    ],
  },
  {
    id: "anko", name: "安子", style: "保守",
    conservativeTalk: [
	"稳一点挺好的，别学她们。", 
	"我就觉得，慢慢来比什么都强。",
	"要不你来跟我一起画画？\n我教你，免费的哦。",
	]
  }
]

const NPC_SCENE_TALKS = {
  open: {
    kurumi: [
	"上！别犹豫。", 
	"这才像话。", 
	"多买点，怕什么。",
	"开就开大的。",
	"现在买入，一定爆赚！",
	"你看这走势，不买更待何时。",
	"就这个位置。上。",
	"母亲要是在，她也会买的。",
	"FX，简单。",
	"看到没，这就是机会。",
	],
    mochiko: [
	"杠杆别太高。", 
	"止损设了吗？", 
	"想清楚再下手。",
	"这个位置……想好了？反正我觉得不错。", 
	"小仓位试试。亏了也好再加。", 
	"你自己拿主意。我不劝你。", 
	"冲啊。我看好你。",
	"别用小的，用大的。",
	"对咯，就该这么开。",
    "这个位置，绝了。",
    "又一个大佬诞生了。",
	"对咯，就这么梭哈。", 
	"买它，就现在。", 
	"冲鸭，别犹豫。", 
	"看着真刺激。",
    "要不……再加点？",
	"开吧。你不上谁上。", 
	"犹豫就输了。", 
	"冲！",
	],
    mebuki: [
	"我觉得这个方向不错。",
	"我昨天梦到它涨了，真的。",
	"跟着感觉走。",
	"如果是久留美，应该会买入这个。", 
	"我跟了。你也上？",
	"我不懂，但我觉得能涨。",
	"久留美说过，这种时候就该上。",
    "我也不懂，反正看着挺香。",
	],
    anko: [
	"悠着点。", 
	"别梭哈。", 
	"慢慢来。",
	"要……要不还是去画画吧？",
	]
  },
  addon: {
    kurumi: [
	"加！再加！",
	"子弹打光才好。",
	"这才叫上头。",
	"满仓，冲！", 
	"现在不加上去，等涨了你哭。",
	"全部压进去。反正也没别的路了。",
    "现在买入，一定爆赚！",
	"对咯，就这么加。", 
	"全押上！", 
	"翻本就靠这一把了。",
	],
    mochiko: [
	"你已经够多了。",
	"加仓要谨慎。",
	"别把子弹打完。",
	"对咯，加仓就是这样加。",
	"加吧。反正已经这样了。", 
	"加多少？要不要全押？", 
	"有魄力。我喜欢。", 
	"都到这一步了，还犹豫什么。",
	"加到最大。",
	"再加点，不够看。",
	"就是你这种魄力。",
	"对咯，就这么加。", 
	"加！再加！",
	"梭到底！",
	"对咯，就这么梭哈。", 
	"加！怕什么。", 
	"再加点。还差一点。", 
	"加完你就能翻身了。",
	],
    mebuki: [
	"要加就加吧，我也不拦你。", 
	"反正我看好它。",
	"加吧加吧。",
	"我看久留美也这么加欸。",
	"久留美加仓加到一半，我就跟了。",
	"久留美说要加仓的。",
    "我全押了，你随意。",
	"久留美加多少，你加多少。",
    "她加我就加。",
	"久留美肯定也会加的。", 
	"加加加，管他呢。",
	],
    anko: [
	"……6。", 
	"你已经加了很多次了。", 
	"见好就收吧。",
	"不敢看了，我先去画画了。\n你加油。",
	]
  },
  close: {
    kurumi: [
	"啊？这就跑了？",
	"太早了！",
	"你居然真收手了。",
	"跑什么，我还没上车呢。",
	"这就怂了？",
	"别平！它还要涨！", 
	"再拿一会儿。",
	],
    mochiko: [
	"明智的选择。", 
	"落袋为安，不错。", 
	"就喜欢你这种理智的。",
	"啊，跑了？真扫兴。", 
	"赚这么点就满足？", 
	"下次记得多押点。这才哪到哪。", 
	"怂了？也行吧。",
    "下次记得多押点。",
    "对咯……（叹气）不对。",
	],
    mebuki: [
	"赚了就跑，挺好。",
	"接下来玩什么？", 
	"这就走啦？",
	"久留美还没跑呢，你再等等？",
	"啊？不玩了？",
    "我还没回本呢。",
	"久留美从来不跑的。",
	"要是我，我肯定不平。", 
	"久留美一般都不平的。",
	],
    anko: [
	"这样就对了。",
	"稳。", 
	"继续保持。",
	"不赖。\n现在来跟我一起画画吧？\n或者你看我画也行。",
	]
  },
  market: {
    kurumi: [
	"看什么呢，直接梭啊。",
	"光看有什么用。",
	"现在买入，一定爆赚！",
	"现在就是入场点。别看了。",
	"行情不等人。",
	],
    mochiko: [
	"看看就好，别冲动。", 
	"行情天天有，不必急。",
	"看有什么用，直接上啊。", 
	"行情不等人。光看是赚不到钱的。", 
	"盯久了就下不了手了。快。",
    "对咯，就是现在，你该动手了。",
	"再不上，这一波就没了。",
	"这个位置，久留美肯定上了。", 
	"不上白不上。",
	],
    mebuki: [
	"我猜明天该涨了。",
	"这个价格挺香的。",
	"久留美在买这个，你不上？",
	"如果是久留美，早就买了。",
	"久留美在的话，早就下单了。",
    "买入！听我的！",
	],
    anko: [
	"看看就好。", 
	"静观其变。",
	"可恶，走势好难猜。\n要不还是去画画吧？",
	]
  },
  steal: {
    kurumi: [
	"快跑！别回头！",
	"我可没教过你这么干。", 
	"怎么还学我……",
	"对不住了，父亲。",
	"……母亲当年也想这么干来着。",
	],
    mochiko: [
	"……你迟早要还的。",
	"这不是我教你的。", 
	"你是谁？我不认识你。",
	"你终于开窍了。", 
	"早该这么做了。", 
	"这才像个赌徒。", 
	"恭喜，你上道了。",
	"对咯，这条路你总算走对了。", 
	"早该这样。",
	"对咯，就该这么干。",
	],
    mebuki: [
	"哇，带上我！",
	"刺激！", 
	"下次算我一份。",
	"久留美说她也干过。",
	"这比打工强多了。",
	"打工是不可能的，这辈子都不可能打工的。",
	"久留美也偷过。",
	],
    anko: [
	"……", 
	"报警了。", 
	"我不认识你。",
	"你这是误入歧途了吧？\n不如像我一样老老实实画画。",
	]
  }
}

function npcInterject(npc, scene) {
  const pool = NPC_SCENE_TALKS[scene]
  if (!pool) return ""
  const lines = pool[npc.id]
  if (!lines || !lines.length) return ""
  return `\n\n${npc.name}：「${pick(lines)}」`
}

const ROOFTOP_TALKS = {
  first: ["🌃 你第一次来吧？坐。", "🌃 风挺大的，站里面点。", "🌃 别站太边上，我见过太多人了。", "🌃 想哭就哭吧，没人看见。"],
  repeat: ["🌃 又来了？", "🌃 第三次了吧。我数着呢。", "🌃 我给你留了个位置。", "🌃 你比我想的来得勤。"],
  veteran: ["🌃 你已经来了很多次了。", "🌃 这里的人都认识你了。", "🌃 久留美：「要不……我们搞个会员制？」", "🌃 你现在比我熟路。"],
  kurumiSpecial: [
    "🌃 久留美：「你也来了？」\n你：「嗯。」\n久留美：「第几次了？」\n你：「……数不清了。」\n久留美：「那还好，我欠了一亿。」",
    "🌃 久留美：「我跟你说个秘密。」\n你：「什么？」\n久留美：「我妈也来过这里。」",
    "🌃 久留美：「你看下面。」\n你：「嗯。」\n久留美：「明天还得上班。」"
  ]
}

const TALKS = {
  openLong: [
    "现在买入，一定爆赚！","这次一定。", "再赌一把，这次真的能翻本。", "理性？理性能当饭吃吗？",
    "只要再来一波，我就能全部回本……", "上吧，久留美。", "多头万岁，空头都是坏人。",
    "看这走势，不涨我吃键盘。", "买它，就现在。", "跌了这么久，该涨了。",
    "上一波亏的，这一波拿回来。", "别怕，涨是趋势。", "冲鸭，别犹豫。",
    "今天不赌，明天怎么翻倍？", "我已经看到账户翻倍的样子了。", "梭哈才叫活过。",
    "多头，安排。", "行情到这就该上攻了。", "加仓，不加后悔。",
    "别问，问就是买。", "感觉来了，上。"
  ],
  openShort: [
    "现在买入，一定爆赚！","跌吧，跌到所有人都哭出来。", "这次我在对的一边。", "空它，就现在。",
    "市场总是要回归的，对吧？", "笑着做空，哭着补仓。",
    "这波不空，天理难容。", "泡沫总要破的。", "空头才是最清醒的。",
    "看这K线，主力在出货。", "顶了，就是顶了。", "跌下来吧，别客气。",
    "空单已下，坐等收米。", "涨这么多，总要还的。", "跌是唯一的真相。",
    "这次我站在市场的对面。", "空头不死，跌势不止。", "薅一波就跑。",
    "这价格，是给空头送钱的。", "趋势向下，做空顺势。", "空，然后笑着离场。"
  ],
  revenge: [
    "母亲当年亏两千万的时候，也没停手。我为什么要停。",
    "母亲已经走了。我可不能白走。","上一把不算，这把才是真的。", "我就不信一直输。", "已经没什么可输的了。",
    "亏这么多，只能再赌一次。", "这次不一样，真的不一样。", "久留美不会停下的。",
    "冷静？冷静能让我回本吗？", "越亏越要加，不然怎么翻？", "再来一次，最后一次。",
    "我还能行。", "这是最后一梭了，我保证。", "亏的钱在等我。",
    "翻本就在今晚。", "已经这样了，还有什么好怕的。", "下注吧，命运在赌桌上。",
    "这次，我把剩下的都押上。", "我需要一场胜利。", "输太多，已经不会怕了。",
    "要不回来的话，我就去天台。", "反正都到这一步了。"
  ],
  blowup: [
    "别难过，我爆过更多次。下一把就翻本。",
    "天台的风很舒服吧？我熟。",
    "再来一次吧，这次真的会赢。",
    "……你看，我也站在这儿呢。",
    "钱没了可以再赚，但机会错过了就真的没了。下一把？",
    "哭完了吗？哭完了我们去开户。",
    "爆仓是成长的必经之路。", "至少你活着，久留美当年没这么幸运。",
    "明天太阳还会升起，行情还会再动。", "这一次，不是结束。",
    "记住这种感觉，下次就不会再犯了。", "你不是第一个，也不会是最后一个。",
    "天台排队，我前面。", "把眼泪擦掉，钱是赚回来的。",
    "这只是一次小失败，真的。", "你看，天还亮着呢。",
    "下一把别用 2000 倍了，好吗？", "我知道你很难过，但我也一样。",
    "我们都在天台上，只是楼层不同。", "重来，从零开始。",
    "我妈当年也是这么没的。她输了 2000 万。",
    "2000 万日元。我妈从阳台跳下去的时候，我就在看 K 线。",
    "你知道 2000 万是什么感觉吗？我妈知道。",
    "母亲走的那天，日经还在涨。",
    "别学我妈。但……我好像也没资格说这话。",
    "我一直在想，如果那天我劝住她，是不是就不一样了。",
    "跳下去只要三秒。还债要一辈子。"
  ],
  bigWin: [
    "见好就收，这才是成熟的大人。", "赚到就跑，懂吗？", "这一把的手感不错，收手吧。",
    "利润落袋，晚上加鸡腿。", "冷静，别让贪心毁了你。",
    "久留美当年要是有你这份理智就好了。", "做得不错，但别飘。",
    "这一波，你赢了。", "钱到手了，剩下的别贪。", "漂亮。这种时候最该警惕。",
    "再赌可能就没了，真的。", "收手吧，你是赢家。",
    "赚了就笑，亏了就哭，你已经笑了。", "记住这个感觉，明天继续。",
    "今晚可以睡个好觉了。", "下一把押小一点，稳住。",
    "这就是赢的滋味。", "别急着再下注，先喘口气。",
    "你已经比很多人强了。", "满意吗？不满意的话，明天再来。"
  ],
  bigLose: [
    "至少……还活着。", "没爆仓就是赢。", "还差的远呢，久留美当年输得比这惨。",
    "疼，但还能承受，对吧？", "亏了这么多，还有回头路吗？",
    "别急着补，先冷静一下。", "这一把算交学费。", "还能再来，别想不开。",
    "这不算什么，真的。", "及时止损，比什么都重要。",
    "输了就输了，人要往前看。", "账户还在，就还有机会。",
    "这就是市场的残酷。", "记住教训，下一次会更好。",
    "别硬扛，该砍就砍。", "痛完就好了。",
    "我把你从边缘拉回来了。", "今晚别赌了，睡一觉。",
    "明天是新的开始。", "你比我想象中镇定。"
  ],
  firstWin: [
    "第一把就赢，运气不错。", "开门红，好事。", "别飘，这只是开始。",
    "记住这种感觉，它会上瘾的。", "恭喜，你上钩了。", "庄家让你赢一把，接下来呢？",
    "第一桶金，好好珍惜。", "新手运气，别当真。", "这就是外汇的魅力。",
    "笑一个，你赚钱了。", "接下来才是真正的考验。", "第一把就赢的人，往往输得最惨。",
    "别急着加注，慢慢来。", "欢迎来到天堂，也是地狱。", "这只是开始，真的。",
    "赢的时候别忘了我说的。", "记住这个下午。", "你已经回不去了。",
    "恭喜入坑。", "久留美当年也是这样开始的。"
  ],
  nearBlowup: [
    "维持率有点低了……小心点。", "再跌一点就没了，你知道吗？",
    "该补保证金了，或者砍仓。", "别硬扛，扛不住的。",
    "我在旁边看着，替你紧张。", "这一刻是最折磨人的。",
    "撑过去，或者现在就撤。", "心脏受不了吧？", "冷静，还有选择。",
    "别赌最后那一口气。", "砍了吧，别等了。", "再赌真的会归零的。",
    "你知道该怎么做的。", "这种时候最容易做傻事。", "稳住，先保住本金。",
    "别问我，问你自己。", "下一根K线就是审判。",
    "我爆过，我懂这种感觉。", "退出还来得及。", "别学我。"
  ]
}

const DAILY_WATCH = [
  "📊 你盯着屏幕看了十分钟。\nK线动了一毫米，你的心动了三下。",
  "📊 盯盘的时候，时间过得很慢。\n亏钱的时候，时间过得很快。",
  "📊 今天的盘面告诉你一个道理：\n你不动，就不会亏。",
  "📊 你打开了交易软件。\n然后关掉了。\n然后又打开了。",
  "📊 今天行情很平淡。\n平淡得让你想搞点事情。",
  "📊 隔壁群有人在梭哈。\n你看了看自己的账户，沉默了。",
  "📊 你刷新了十几次行情。\n价格没变，你的心跳变了。"
]

/* ============================================================
 *  Redis Key
 * ============================================================ */
const K_SOLO_USER   = uid => `fx-plugin:solo:user:${uid}`
const K_SOLO_MARKET = uid => `fx-plugin:solo:market:${uid}`
const K_SOLO_DAY    = uid => `fx-plugin:solo:day:${uid}`

const K_SHARED_USER    = (gid, uid) => `fx-plugin:shared:user:${gid}:${uid}`
const K_SHARED_MARKET  = gid => `fx-plugin:shared:market:${gid}`
const K_SHARED_DAY     = gid => `fx-plugin:shared:day:${gid}`
const K_SHARED_USERSET = gid => `fx-plugin:shared:users:${gid}`
const K_SHARED_VOTES   = gid => `fx-plugin:shared:votes:${gid}`

const K_ACTIVE = gid => `fx-plugin:active:${gid}`

const K_RANK_KEY = (kind, gid) => gid
  ? `fx-plugin:rank:${kind}:g${gid}`
  : `fx-plugin:rank:${kind}`

const K_RANK_REBUILT = 'fx-plugin:rank:rebuilt'
const K_NAME_CACHE = uid => `fx-plugin:name:${uid}`

/* ============================================================
 *  操作锁
 * ============================================================ */
const userBusy = new Map()
function isUserBusy(uid) {
  const exp = userBusy.get(String(uid))
  if (!exp) return false
  if (exp <= Date.now()) { userBusy.delete(String(uid)); return false }
  return true
}
function setUserBusy(uid, ms = 8000) { userBusy.set(String(uid), Date.now() + ms) }
const pushLock = new Set()

/* ============================================================
 *  通用工具
 * ============================================================ */
function fmt(n) {
  return Number(n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")
}
function pct(n) { return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%` }
function arrow(n) { return n > 0.01 ? "📈" : n < -0.01 ? "📉" : "➖" }
function priceStr(n, precision = 4) { return Number(n).toFixed(precision) }
function gaussian() {
  let u = 0, v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}
function trendline(values, width = 16) {
  if (!values?.length || values.length < 2) return ""
  const v = values.slice(-(width + 1))
  const changes = []
  for (let i = 1; i < v.length; i++) changes.push((v[i] - v[i - 1]) / v[i - 1])
  const maxAbs = Math.max(...changes.map(Math.abs)) || 1
  let out = ""
  for (const d of changes) {
    const r = d / maxAbs
    if (r > 0.5) out += "⇈"
    else if (r > 0.05) out += "↗"
    else if (r < -0.5) out += "⇊"
    else if (r < -0.05) out += "↘"
    else out += "→"
  }
  return out
}
function overallTrend(values) {
  if (!values?.length || values.length < 2) return "➖"
  const first = values[0]
  const last = values[values.length - 1]
  if (last > first * 1.001) return "📈"
  if (last < first * 0.999) return "📉"
  return "➖"
}

function getGid(e) { return e.group_id ? `g${e.group_id}` : `u${e.user_id}` }
function getMode(e) {
  const m = String(e.msg || "").match(/^#?(独|共)/)
  if (!m) return null
  return m[1] === "独" ? "solo" : "shared"
}
const MODE_LABEL = { solo: "独立", shared: "共享" }
function isGroup(e) { return !!e.group_id }
function getEventGid(e) { return e.group_id ? e.group_id : null }

async function getNick(e, uid) {
  try {
    if (!e.group) return String(uid)
    const map = await e.group.getMemberMap()
    const m = map.get(Number(uid)) || map.get(String(uid))
    return m?.card || m?.nickname || String(uid)
  } catch { return String(uid) }
}

async function cacheUserName(uid, name) {
  if (!uid || !name) return
  try {
    await redis.set(K_NAME_CACHE(String(uid)), String(name))
  } catch {}
}

async function getNameFromCache(uid) {
  try {
    return await redis.get(K_NAME_CACHE(String(uid)))
  } catch { return null }
}

async function getDisplayName(e, uid) {
  const id = String(uid)
  const numId = Number(id)

  // 1) 当前群成员
  if (e?.group) {
    try {
      const map = await e.group.getMemberMap()
      const m = map.get(numId) || map.get(id)
      const nick = m?.card || m?.nickname
      if (nick) {
        cacheUserName(id, nick).catch(() => {})
        return nick
      }
    } catch {}
  }

  // 2) 好友列表
  try {
    const fl = Bot.fl?.get(numId)
    if (fl?.nickname) {
      cacheUserName(id, fl.nickname).catch(() => {})
      return fl.nickname
    }
  } catch {}

  // 3) 昵称缓存
  const cached = await getNameFromCache(id)
  if (cached) return cached

  // 4) fallback
  return `FX-${id.slice(-4)}`
}

/* ============================================================
 *  共享场投票
 * ============================================================ */
async function getSharedVotes(gid) {
  const raw = await redis.get(K_SHARED_VOTES(gid))
  if (!raw) return {}
  try {
    const v = JSON.parse(raw)
    return v && typeof v === "object" ? v : {}
  } catch { return {} }
}
async function setSharedVotes(gid, votes) {
  await redis.set(K_SHARED_VOTES(gid), JSON.stringify(votes))
}
async function clearSharedVotes(gid) {
  await redis.del(K_SHARED_VOTES(gid))
}
function voteThreshold(n) {
  return Math.floor(n / 2) + 1
}

/* ============================================================
 *  Redis zset 兼容
 * ============================================================ */
async function zsetSet(key, score, member) {
  const m = String(member)
  const s = Number(score) || 0
  try {
    if (typeof redis.zAdd === "function") {
      return await redis.zAdd(key, { score: s, value: m })
    }
    return await redis.zadd(key, s, m)
  } catch (err) {
    logger.debug(`[FX-plugin] zsetSet ${key} 失败: ${err.message}`)
  }
}
async function zsetTop(key, n = 10) {
  try {
    if (typeof redis.zRangeWithScores === "function") {
      const arr = await redis.zRangeWithScores(key, 0, n - 1, { REV: true })
      return (arr || []).map(it => ({ uid: String(it.value), score: Number(it.score) }))
    }
    const raw = await redis.zrevrange(key, 0, n - 1, "WITHSCORES")
    const out = []
    for (let i = 0; i < raw.length; i += 2) {
      out.push({ uid: String(raw[i]), score: parseFloat(raw[i + 1]) })
    }
    return out
  } catch (err) {
    logger.debug(`[FX-plugin] zsetTop ${key} 失败: ${err.message}`)
    return []
  }
}

/* ============================================================
 *  排行榜同步（双写：全服 + 群内）
 * ============================================================ */
async function syncRanks(uid, acc, gid = null) {
  try {
    if (!acc) return
    const s = acc.stats || {}
    const invested = s.totalInvested || 0
    const maxLev = s.maxLeverage || 0
    const sohaScore = invested * (1 + maxLev / 100)

    const values = {
      balance:  acc.balance || 0,
      profit:   s.fxProfit || 0,
      invested: sohaScore,
      loss:     s.fxLoss || 0,
      abs:      s.totalAbsPnL || 0,
      debt:     s.totalUnpaidDebt || 0
    }

    for (const kind of Object.keys(values)) {
      await zsetSet(K_RANK_KEY(kind, null), values[kind], uid)
    }
    if (gid) {
      for (const kind of Object.keys(values)) {
        await zsetSet(K_RANK_KEY(kind, gid), values[kind], uid)
      }
    }
  } catch (err) {
    logger.debug(`[FX-plugin] syncRanks 失败: ${err.message}`)
  }
}

/* ============================================================
 *  全量重建排行榜（仅全服榜）
 * ============================================================ */
async function rebuildAllRanks() {
  let count = 0
  try {
    let keys = []
    try {
      keys = await redis.keys(K_SOLO_USER('*'))
    } catch {
      if (typeof redis.keysAsync === 'function') {
        keys = await redis.keysAsync(K_SOLO_USER('*'))
      }
    }
    if (!keys || !keys.length) return 0

    for (const key of keys) {
      try {
        const raw = await redis.get(key)
        if (!raw) continue
        const acc = JSON.parse(raw)
        if (!acc.stats) acc.stats = defaultStats()
        const ds = defaultStats()
        for (const k of Object.keys(ds)) {
          if (acc.stats[k] === undefined) acc.stats[k] = ds[k]
        }
        const uid = key.split(':').pop()
        await syncRanks(uid, acc, null)
        count++
      } catch (err) {
        logger.debug(`[FX-plugin] rebuildAllRanks 单条失败: ${err.message}`)
      }
    }
  } catch (err) {
    logger.error('[FX-plugin] rebuildAllRanks 失败:', err)
  }
  return count
}

async function rebuildAllRanksOnce() {
  try {
    const done = await redis.get(K_RANK_REBUILT)
    if (done === '1') return 0
    const n = await rebuildAllRanks()
    await redis.set(K_RANK_REBUILT, '1')
    return n
  } catch (err) {
    logger.debug(`[FX-plugin] rebuildAllRanksOnce 失败: ${err.message}`)
    return 0
  }
}

/* ============================================================
 *  图片渲染（单文件 HTML 内嵌）
 * ============================================================ */
const FX_CSS = `
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:"Microsoft YaHei","PingFang SC","Noto Sans CJK SC",sans-serif;
     background:linear-gradient(135deg,#0a0e1a,#1a1f35);color:#e8e8e8;
     padding:20px;width:600px;min-height:100px;font-size:18px;line-height:1.5}
.card{background:rgba(255,255,255,0.04);border:1px solid rgba(212,175,55,0.3);
      border-radius:12px;padding:20px;margin-bottom:16px}
.card:last-child{margin-bottom:0}
.title{font-size:26px;color:#d4af37;font-weight:600;margin-bottom:16px;
       padding-bottom:12px;border-bottom:1px solid rgba(212,175,55,0.2)}
.section{margin-bottom:16px}
.section:last-child{margin-bottom:0}
.section-title{font-size:20px;color:#d4af37;margin-bottom:10px;font-weight:500}
.row{display:flex;justify-content:space-between;padding:6px 0;
     border-bottom:1px dashed rgba(255,255,255,0.05)}
.row:last-child{border-bottom:none}
.label{color:#a0a0a0}
.value{color:#e8e8e8;font-weight:500}
.up{color:#ff5555}
.down{color:#44ff88}
.warn{color:#ffaa44}
.danger{color:#ff2222}
.muted{color:#666;font-size:15px}
.divider{height:1px;background:rgba(212,175,55,0.15);margin:12px 0}
.footer{text-align:center;color:#666;font-size:14px;margin-top:20px;
        padding-top:12px;border-top:1px solid rgba(212,175,55,0.1)}
.tag{display:inline-block;padding:2px 8px;border-radius:10px;font-size:14px;
     background:rgba(212,175,55,0.2);color:#d4af37;margin-left:6px}
.quote{padding:12px 16px;background:rgba(212,175,55,0.08);
       border-left:4px solid #d4af37;margin:12px 0;font-style:italic;
       color:#ccc;font-size:16px;border-radius:0 6px 6px 0}
.pair-row{display:flex;justify-content:space-between;padding:8px 0;
          border-bottom:1px dashed rgba(255,255,255,0.05);font-size:18px}
.pair-row:last-child{border-bottom:none}
.pos-box{padding:12px;background:rgba(0,0,0,0.2);border-radius:8px;margin-bottom:10px}
.pos-box:last-child{margin-bottom:0}
.pos-head{display:flex;justify-content:space-between;align-items:center;
          margin-bottom:8px;font-size:20px;font-weight:600}
`

function wrapFxHtml(content) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>${FX_CSS}</style></head>
<body>${content}
<div class="footer">FX 战士久留美 · 拟股喵喵</div>
</body></html>`
}

const _fxTmpDir = path.join(process.cwd(), "temp/fx-render")
function ensureFxTmpDir() {
  if (!fs.existsSync(_fxTmpDir)) fs.mkdirSync(_fxTmpDir, { recursive: true })
}

function buildKlineHtml(pair, ohlc, opts = {}) {
  const data = (ohlc || []).slice(-40)
  if (!data.length) return `<div class="card"><div class="title">📊 ${pair.alias}</div><div>暂无数据</div></div>`

  // 【修改】适配 600px 宽度的容器
  const W = 540, H = 320
  const pL = 50, pR = 15, pT = 40, pB = 25
  const cW = W - pL - pR, cH = H - pT - pB

  const maxH = Math.max(...data.map(b => b.h))
  const minL = Math.min(...data.map(b => b.l))
  const range = maxH - minL || maxH * 0.001
  const y = v => pT + cH - ((v - minL) / range) * cH
  const barW = cW / data.length
  // 【修改】调宽柱体宽度
  const bodyW = Math.max(4, barW * 0.7)

  const f = pair.precision
  let svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg" style="display:block;background:#0d1220;border-radius:8px;margin:0 auto;">`

  // 网格 + 刻度
  for (let i = 0; i <= 4; i++) {
    const yy = pT + (cH / 4) * i
    const vv = maxH - (range / 4) * i
    svg += `<line x1="${pL}" y1="${yy}" x2="${W - pR}" y2="${yy}" stroke="rgba(255,255,255,0.06)" stroke-dasharray="3,3"/>`
    svg += `<text x="${pL - 8}" y="${yy + 4}" text-anchor="end" fill="#888" font-size="12">${vv.toFixed(f)}</text>`
  }

  // K线
  data.forEach((b, i) => {
    const cx = pL + i * barW + barW / 2
    const up = b.c >= b.o
    const color = up ? "#ff5555" : "#44ff88" // 红涨绿跌
    const yH = y(b.h), yL = y(b.l), yO = y(b.o), yC = y(b.c)
    const yT = Math.min(yO, yC)
    const yB = Math.max(yO, yC)
    const bh = Math.max(1.5, yB - yT) // 实体至少 1.5px 高
    // 影线加粗到 1.5px
    svg += `<line x1="${cx}" y1="${yH}" x2="${cx}" y2="${yL}" stroke="${color}" stroke-width="1.5"/>`
    svg += `<rect x="${cx - bodyW / 2}" y="${yT}" width="${bodyW}" height="${bh}" fill="${color}"/>`
  })

  const last = data[data.length - 1]
  const chg = ((last.c - last.o) / last.o) * 100
  const day = opts.day || "?"
  const modeLabel = opts.mode === "solo" ? "独立" : "共享"

  svg += `<text x="${pL}" y="24" fill="#d4af37" font-size="16" font-weight="600">${pair.name}（${pair.alias}）</text>`
  svg += `<text x="${W - pR}" y="24" text-anchor="end" fill="${chg >= 0 ? '#ff5555' : '#44ff88'}" font-size="15" font-weight="bold">${last.c.toFixed(f)} ${chg >= 0 ? "+" : ""}${chg.toFixed(2)}%</text>`
  svg += `</svg>`

  return `
    <div class="card">
      <div class="title">📊 ${modeLabel}场 · 第 ${day} 天 · ${pair.alias} K线（近 ${data.length} 根）</div>
      ${svg}
      <div class="muted" style="margin-top:12px;line-height:1.9;text-align:center;">
        最新 O ${last.o.toFixed(f)}　H ${last.h.toFixed(f)}　L ${last.l.toFixed(f)}　C ${last.c.toFixed(f)}<br>
        🔴 涨 / 🟢 跌　红柱收阳　绿柱收阴
      </div>
    </div>`
}

// 兼容 Miao-Yunzai 与 TRSS-Yunzai 的渲染函数（高清且防超时版）
async function renderFxHtml(e, content) {
  ensureFxTmpDir()
  const html = wrapFxHtml(content)

  // 统一的渲染参数：scale 1.5 保证清晰度，jpeg + quality 85 极大地压缩体积
  const renderOpts = {
    scale: 1.5,
    imgType: "jpeg",
    quality: 85
  }

  // 1) 优先走 TRSS-Yunzai 的 e.runtime.render
  if (e?.runtime?.render) {
    const resDir = path.join(process.cwd(), "plugins/example/resources")
    if (!fs.existsSync(resDir)) fs.mkdirSync(resDir, { recursive: true })
    
    const tmpName = `fx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.html`
    const tmpFile = path.join(resDir, tmpName)
    fs.writeFileSync(tmpFile, html, "utf8")
    
    try {
      const result = await e.runtime.render("example", tmpName, {}, { 
        retType: "base64", 
        ...renderOpts 
      })
      if (!result) throw new Error("runtime.render 返回空")
      return result
    } finally {
      try { fs.unlinkSync(tmpFile) } catch {}
    }
  }

  // 2) 回退到 Miao-Yunzai / 经典 Yunzai 的 Renderer 方式
  if (typeof Renderer !== "undefined" && typeof Renderer.getRenderer === "function") {
    const tmpFile = path.join(_fxTmpDir, `fx-${Date.now()}.html`)
    fs.writeFileSync(tmpFile, html, "utf8")
    try {
      const renderer = Renderer.getRenderer()
      return await renderer.render("fx-render", { tplFile: tmpFile, _res_path: "./" }, renderOpts)
    } finally {
      try { fs.unlinkSync(tmpFile) } catch {}
    }
  }

  throw new Error("未找到可用的渲染器")
}

// 发图片（失败降级为纯文本）
async function replyFxImage(e, content, plainFallback) {
  try {
    const img = await renderFxHtml(e, content)
    return await e.reply(img)
  } catch (err) {
    logger.error("[FX-plugin] 图片渲染失败，降级文本:", err)
    return e.reply(plainFallback || "❎ 图片生成失败，请重试")
  }
}

/* ============================================================
 *  说明书
 * ============================================================ */
function buildHelpNodes() {
  const pairTable = PAIRS.map(p => `${p.alias}（${p.code}）`).join("\n")
  const levTable = LEVERAGE_TABLE.map(l => `${l.alias} = ${l.lev}×，${l.note}`).join("\n")
  const nicknames = GAME_NICKNAMES.join(" / ")

  const pages = [
    { title: `💹 ${GAME_FULL}`, text:
      `一句话：这是个赌汇率的文字游戏。\n不用蹲点看盘，随时上线都能玩。\n\n` +
      `别名：${GAME_ALIAS}\n` +
      `两个市场：\n· 独立场（前缀 #独）\n· 共享场（前缀 #共，仅限群聊）\n\n` +
      `同一个账户，钱是同一份钱。\n\n` +
      `本作品也被叫做：\n${nicknames}` },
    { title: "① 货币对速查表", text: pairTable + `\n\n打中文或英文代码都行` },
    { title: "② 杠杆档位", text:
      levTable + `\n\n打数字也行（1~2000）：\n#独押涨 美日 10000 500\n\n` +
      `⚠️ 输入的是押注金额（保证金）\n名义价值 = 押注金额 × 杠杆` },
    { title: "③ 怎么开始", text:
      `【第 1 步】#开户\n　一次建号，拥有两套行情。\n\n` +
      `【第 2 步】想跟群友玩就发 #加入共享\n　#加入共享 会自动开户。\n\n` +
      `【第 3 步】开始交易。` },
    { title: "④ 独立场怎么玩", text:
      `#独行情　→ 看价格和OHLC\n` +
      `#独K线 美日 → 看蜡烛图\n` +
      `#独押涨 美日 10000 中\n` +
      `#独下一天 → 推进自己的一天\n` +
      `#独下10天 → 连推 10 天（最多 ${CONFIG.maxAdvanceDays} 天）\n\n` +
      `群聊私聊都能玩，数据同一份。` },
    { title: "⑤ 共享场怎么玩", text:
      `共享场只能在群聊里玩：\n\n` +
      `【1】#加入共享\n　自动开户 + 进入活跃名单\n\n` +
      `【2】正常玩\n　#共行情 / #共押涨 / #共下一天\n　#共K线 黄金 → 看蜡烛图\n　#共下10天：投票连推` },
    { title: "⑥ 共享场怎么开牌", text:
      `共享场是"过半推进制"：\n\n` +
      `每个人发 #共下一天 或 #共下N天，\n把自己的意愿天数投进去。\n` +
      `同一轮内重复发覆盖上一次。\n\n` +
      `当投票人数 ≥ 活跃人数的一半（向上取整），\n立即推进，取已投票人的最小值。\n\n` +
      `举例（活跃 4 人，需要 3 票）：\n` +
      `· A 投 1，B 投 5，C 投 3 → 立即推 1 天\n` +
      `· D 没投 → 也会被推进 1 天\n\n` +
      `为什么取最小？\n` +
      `因为行情全群共享，推多天风险大。\n` +
      `最保守的那个人说了算。` },
    { title: "⑦ 逐仓爆仓机制", text:
      `每个仓位独立计算，且爆仓判定看盘中！\n\n` +
      `· 输入的是押注金额（保证金）\n` +
      `· 名义价值 = 押注金额 × 杠杆\n` +
      `· 用当日K线的【最高/最低价】判定\n\n` +
      `💡 为什么我收盘明明是赚的却爆仓了？\n` +
      `因为真实外汇是实时盯市的！只要盘中\n` +
      `最低价（多单）或最高价（空单）跌穿/涨穿了\n` +
      `爆仓线，仓位就当场死亡，哪怕收盘又拉回去了。\n\n` +
      `爆仓逆向幅度 = 1 / 杠杆：\n` +
      `· 稳 5×   → 逆向 20% 才爆\n` +
      `· 中 25×  → 逆向 4% 才爆\n` +
      `· 梭 200× → 逆向 0.5% 就爆\n` +
      `· 疯 2000×→ 逆向 0.05% 就爆（碰一下就死）\n\n` +
      `爆仓最多亏光保证金，不会穿仓。` },
    { title: "⑧ 借钱 / 偷钱 / 破产 / B计划", text:
      `【#借钱加仓】\n` +
      `　余额不够时借 ¥${fmt(CONFIG.loanAmount)}，\n` +
      `　3 天内还清，否则日息累积。\n` +
      `　还债指令：#还债\n\n` +
      `【#偷钱】\n` +
      `　余额 < 10000 时的最后手段（有借款不能偷）。\n` +
      `　每个破产周期只有一次机会。\n` +
      `　成功：+¥${fmt(CONFIG.stealAmount)}\n` +
      `　失败：余额没收，罚金 5 万叠加原有负债，\n` +
      `　且 24 小时内无法申请破产（强制背负高债）。\n\n` +
      `【#个人破产】\n` +
      `　欠债后可用，清除所有负债（含借款），\n` +
      `　余额重置为 ¥${fmt(CONFIG.bankruptcyReset)}。\n` +
      `　但历史免除的负债会累积到【老赖榜】。\n\n` +
      `【#B计划】\n` +
      `　爆仓后 5 分钟内发。\n` +
      `　把余额全部押上，一把定生死。\n` +
      `　大概率归零，小概率翻倍，极小概率爆赚。` },
    { title: "⑨ 排行榜", text:
      `【本群榜】\n` +
      `　#排行榜 / #总榜\n` +
      `　#富豪榜 / #股神榜 / #梭哈榜\n` +
      `　#韭菜榜 / #刺激榜 / #老赖榜\n` +
      `　只显示本群玩家\n\n` +
      `【全服榜】\n` +
      `　前面加"全服"，如：\n` +
      `　#全服排行榜 / #全服富豪榜\n` +
      `　显示所有群的玩家\n\n` +
      `榜单说明：\n` +
      `　· 富豪榜：余额最多\n` +
      `　· 股神榜：外汇净盈利最多\n` +
      `　· 梭哈榜：累计押注 × 最大杠杆综合\n` +
      `　· 韭菜榜：外汇净亏损最多\n` +
      `　· 刺激榜：外汇+偷钱绝对盈亏和\n` +
      `　· 老赖榜：历史破产免除的欠款总和` },
    { title: "⑩ 指令速查", text:
      `通用：\n` +
      `　#开户 / #余额 / #拟股喵喵帮助\n` +
      `　#排行榜 / #全服排行榜 / #爆仓史\n` +
      `　#盯盘 / #偷钱 / #视奸 @某人\n\n` +
      `独立场（前缀 #独）：\n` +
      `　行情 / 下一天 / 下N天 / 领补助 / 看 XX / K线 XX\n` +
      `　押涨 / 押跌 / 平 XX / 全平 / 持仓\n\n` +
      `共享场（前缀 #共）：\n` +
      `　同上，仅限群聊\n` +
      `　#加入共享 / #退出共享 / #共享玩家\n\n` +
      `特殊：\n` +
      `　#天台 / #B计划 / #个人破产\n` +
      `　#借钱加仓 / #还债 / #打工 / #偷钱 / #还赃\n\n` +
      `走势图说明：\n` +
      `　⇈ 大涨　↗ 小涨　→ 平\n` +
      `　↘ 小跌　⇊ 大跌` },
    { title: "⑪ 常见问题", text:
      `【为什么不叫股票？】\n` +
      `能做空、最高 2000× 杠杆、货币对相对关系\n` +
      `——这些股票都没有。\n\n` +
      `【为什么是回合制，不是 T+0？】\n` +
      `价格只在 #下一天 时变动。\n` +
      `开仓后不推进就平仓，盈亏 = 0（相当于撤单）。\n\n` +
      `【为什么我盘中插针被爆了？】\n` +
      `真实外汇就是实时盯市的，本作使用当日\n` +
      `K线的最高/最低价判定爆仓。一旦触及，\n` +
      `哪怕收盘价格又回来了，也已经强平。\n\n` +
      `【黑天鹅有哪些？】\n` +
      `共 15 种随机事件（2%概率触发），包含：\n` +
      `瑞郎脱钩、雷曼海啸、黑色星期一、非农爆表、\n` +
      `英国脱欧等。系统性危机时，全市场暴跌，\n` +
      `但黄金会作为避险资产反向暴涨。\n\n` +
      `【完整设计说明】\n` +
      `去 Gitee 仓库 README 的「设计说明」小节` },
    { title: "⚠️ 最后提醒", text:
      `真实世界的外汇是真会亏真钱的。\n游戏里随便玩，现实里千万别碰。\n\n` +
      `久留美：「来吧，天台风景不错。」` }
  ]

  return pages.map(p => ({
    nickname: p.title,
    content: `【${p.title}】\n${p.text}`
  }))
}

function getHelpFilePath() {
  return path.join(process.cwd(), CONFIG.helpFileDir, CONFIG.helpFileName)
}

function buildPlainHelpText(nodes) {
  return nodes.map(n => {
    const body = String(n.content ?? "")
    if (body.startsWith("【")) return body
    return `【${n.nickname}】\n${body}`
  }).join("\n\n" + "=".repeat(36) + "\n\n")
}

async function ensureHelpFile(nodes) {
  const filePath = getHelpFilePath()
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true })
  const BOM = "\uFEFF"
  await fs.promises.writeFile(filePath, BOM + buildPlainHelpText(nodes), "utf8")
  return filePath
}

async function sendPrivateHelpFile(e, nodes) {
  const fileName = CONFIG.helpFileName
  let filePath = ""
  try {
    filePath = await ensureHelpFile(nodes)
    await e.bot.sendApi("upload_private_file", {
      user_id: Number(e.user_id),
      file: filePath,
      name: fileName
    })
    return true
  } catch (err) {
    logger.error("[FX-plugin] 私聊发送帮助文件失败，降级为逐条文本:", err)
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i]
      try {
        await e.reply(`【${n.nickname}】\n${n.content}`)
      } catch (e2) {
        logger.error(`[FX-plugin] 私聊降级第 ${i + 1} 条发送失败:`, e2)
      }
      if (i < nodes.length - 1) {
        await new Promise(r => setTimeout(r, CONFIG.privateMsgDelay))
      }
    }
    return true
  }
}

async function uploadGroupHelpFile(e, nodes) {
  const fileName = CONFIG.helpFileName
  const filePath = await ensureHelpFile(nodes)
  await e.bot.sendApi("upload_group_file", {
    group_id: Number(e.group_id),
    file: filePath,
    name: fileName
  })
  return filePath
}

async function sendForward(e, nodes) {
  const selfId = String(e.self_id || Bot.uin)

  // 保证每条消息 content 里都包含 nickname 文本，
  // 避免合并转发预览与点开内容不一致，或点开只看到「空仓」两字
  const forwardNodes = nodes.map(n => {
    const nick = String(n.nickname ?? "")
    const body = String(n.content ?? "")
    const nickBracket = `【${nick}】`
    let msg = body
    if (nick && !body.startsWith(nick) && !body.startsWith(nickBracket)) {
      msg = `${nick}\n${body}`
    }
    return {
      user_id: selfId,
      nickname: nick,
      message: msg
    }
  })

  try {
    const forwardMsg = await Bot.makeForwardMsg(forwardNodes)
    await e.reply(forwardMsg)
    return true
  } catch (err) {
    logger.error("[FX-plugin] 合并转发失败，降级为逐条纯文本:", err)
    for (let i = 0; i < forwardNodes.length; i++) {
      try {
        await e.reply(forwardNodes[i].message)
      } catch (e2) {}
      if (i < forwardNodes.length - 1) {
        await new Promise(r => setTimeout(r, CONFIG.privateMsgDelay))
      }
    }
    return true
  }
}

function buildSummaryNode(title, market, swan, extraInfo) {
  const lines = []
  const previewCount = 3

  if (swan) {
    lines.push(`⚠️ ${swan.eventName}：${swan.affected.length} 个货币对跳空`)
    lines.push("━━━━━━━━━━━━━━")
  }

  const shown = Math.min(previewCount, PAIRS.length)
  for (let i = 0; i < shown; i++) {
    const p = PAIRS[i]
    const st = market[p.code]
    if (!st) continue
    const chg = change(market, p.code)
    const mark = chg > 0.01 ? "▲" : chg < -0.01 ? "▼" : "━"
    lines.push(`${p.alias} ${priceStr(st.price, p.precision)} ${mark}${Math.abs(chg).toFixed(2)}%`)
  }

  if (PAIRS.length > shown) {
    lines.push(`…等 ${PAIRS.length} 个货币对`)
  }

  if (extraInfo) {
    lines.push("")
    lines.push(extraInfo)
  }

  return { nickname: title, content: `${title}\n${lines.join("\n")}` }
}

/* ============================================================
 *  市场
 * ============================================================ */
function ohlcToHistory(ohlc) {
  return Array.isArray(ohlc) ? ohlc.map(b => b.c) : []
}

// 从 p.price 反向生成 n 根 K 线，保证最后一根 close = p.price
function buildRandomOhlcList(p, n) {
  const reversed = []
  let cur = p.price
  for (let i = 0; i < n; i++) {
    const close = cur
    const open = Math.max(0.00001, close / (1 + (Math.random() - 0.5) * p.volatility * 2))
    const wick = p.volatility * 0.6
    const upper = Math.random() * wick
    const lower = Math.random() * wick
    const high = Math.max(open, close) * (1 + upper)
    const low  = Math.max(0.00001, Math.min(open, close) * (1 - lower))
    const f = 10 ** p.precision
    reversed.unshift({
      o: Math.round(open  * f) / f,
      h: Math.round(high  * f) / f,
      l: Math.round(low   * f) / f,
      c: Math.round(close * f) / f,
    })
    cur = open
  }
  return reversed
}

function initMarket() {
  const market = {}
  for (const p of PAIRS) {
    const ohlc = buildRandomOhlcList(p, 30)
    const history = ohlcToHistory(ohlc)
    market[p.code] = { price: history[history.length - 1], history, ohlc }
  }
  return market
}

function healOhlc(market) {
  let changed = false
  for (const p of PAIRS) {
    const st = market[p.code]
    if (!st) continue
    if (!Array.isArray(st.ohlc)) {
      if (Array.isArray(st.history) && st.history.length) {
        // 修复老数据：利用历史收盘价，反推合理的开盘、最高、最低价，让K线有实体和影线
        st.ohlc = st.history.map((c, i, arr) => {
          const o = i > 0 ? arr[i - 1] : c
          const high = Math.max(o, c) * (1 + Math.random() * p.volatility)
          const low = Math.min(o, c) * (1 - Math.random() * p.volatility)
          const f = 10 ** p.precision
          return {
            o: Math.round(o * f) / f,
            h: Math.round(high * f) / f,
            l: Math.round(low * f) / f,
            c: Math.round(c * f) / f
          }
        })
      } else {
        st.ohlc = buildRandomOhlcList(p, 30)
      }
      changed = true
    }
    const derived = ohlcToHistory(st.ohlc)
    if (!Array.isArray(st.history) || st.history.length !== derived.length) {
      st.history = derived
      changed = true
    }
    if (!st.price) {
      st.price = st.history[st.history.length - 1]
      changed = true
    }
  }
  return changed
}

function healMarket(market) {
  const a = ensurePairs(market)
  const b = healFlatHistory(market)
  const c = healOhlc(market)
  return a || b || c
}

function isFlatHistory(history) {
  if (!Array.isArray(history) || history.length < 2) return true
  const first = history[0]
  return history.every(v => v === first)
}
function ensurePairs(market) {
  let changed = false
  for (const p of PAIRS) {
    if (!market[p.code] || !Array.isArray(market[p.code].history)) {
      const history = []
      let cur = p.price
      for (let i = 0; i < 29; i++) {
        history.unshift(cur)
        cur = cur * (1 + (Math.random() - 0.5) * p.volatility * 2)
      }
      history.push(p.price)
      market[p.code] = { price: p.price, history }
      changed = true
    }
  }
  return changed
}
function healFlatHistory(market) {
  let changed = false
  for (const p of PAIRS) {
    const st = market[p.code]
    if (!st) continue
    if (isFlatHistory(st.history)) {
      const history = []
      let cur = st.price
      for (let i = 0; i < 29; i++) {
        history.unshift(cur)
        cur = cur * (1 + (Math.random() - 0.5) * p.volatility * 2)
      }
      history.push(st.price)
      st.history = history
      changed = true
    }
  }
  return changed
}

async function getSoloMarket(uid) {
  const raw = await redis.get(K_SOLO_MARKET(uid))
  if (raw) {
    try {
      const m = JSON.parse(raw)
      if (healMarket(m)) await redis.set(K_SOLO_MARKET(uid), JSON.stringify(m))
      return m
    } catch {}
  }
  const market = initMarket()
  await redis.set(K_SOLO_MARKET(uid), JSON.stringify(market))
  return market
}
async function saveSoloMarket(uid, market) {
  await redis.set(K_SOLO_MARKET(uid), JSON.stringify(market))
}
async function getSharedMarket(gid) {
  const raw = await redis.get(K_SHARED_MARKET(gid))
  if (raw) {
    try {
      const m = JSON.parse(raw)
      if (healMarket(m)) await redis.set(K_SHARED_MARKET(gid), JSON.stringify(m))
      return m
    } catch {}
  }
  const market = initMarket()
  await redis.set(K_SHARED_MARKET(gid), JSON.stringify(market))
  return market
}
async function saveSharedMarket(gid, market) {
  await redis.set(K_SHARED_MARKET(gid), JSON.stringify(market))
}
async function getDay(e, mode) {
  const key = mode === "solo" ? K_SOLO_DAY(e.user_id) : K_SHARED_DAY(getGid(e))
  const v = await redis.get(key)
  return v ? Number(v) : 1
}
function change(market, code) {
  const h = market[code]?.history
  if (!h || h.length < 2) return 0
  const prev = h[h.length - 2]
  if (!prev) return 0
  return ((h[h.length - 1] - prev) / prev) * 100
}

/* ============================================================
 *  账户
 * ============================================================ */
const posKey = (code, side) => `${code}:${side}`

// 兼容旧数据：旧仓位只有 amount（=名义价值），没有 notional/margin
// 新仓位：margin = 押注金额，notional = margin × 杠杆
function normalizePos(pos) {
  if (!pos) return pos
  if (pos.notional == null) pos.notional = pos.amount || 0
  if (pos.margin == null) pos.margin = 0
  return pos
}

function defaultStats() {
  return {
    totalInvested: 0,
    maxLeverage: 0,
    fxProfit: 0,
    fxLoss: 0,
    totalAbsPnL: 0,
    totalUnpaidDebt: 0,
    stealCount: 0,
    stealWin: 0,
    pendingStealDebt: 0,
    stealUsedThisCycle: false
  }
}

async function getSoloAccount(uid) {
  const raw = await redis.get(K_SOLO_USER(uid))
  if (!raw) return null
  try {
    const acc = JSON.parse(raw)
    if (acc.positionsSolo) {
      for (const k of Object.keys(acc.positionsSolo)) {
        normalizePos(acc.positionsSolo[k])
      }
    }
    return acc
  } catch { return null }
}

async function saveSoloAccount(uid, acc, gid = null) {
  await redis.set(K_SOLO_USER(uid), JSON.stringify(acc))
  syncRanks(uid, acc, gid).catch(() => {})
  return acc
}

async function getSharedAccount(gid, uid) {
  const raw = await redis.get(K_SHARED_USER(gid, uid))
  if (!raw) return null
  try {
    const acc = JSON.parse(raw)
    if (acc.positionsShared) {
      for (const k of Object.keys(acc.positionsShared)) {
        normalizePos(acc.positionsShared[k])
      }
    }
    return acc
  } catch { return null }
}
async function saveSharedAccount(gid, uid, acc) {
  await redis.set(K_SHARED_USER(gid, uid), JSON.stringify(acc))
  await RS.sadd(K_SHARED_USERSET(gid), String(uid))
  return acc
}

async function refreshRank(e, uid, gid = null) {
  try {
    const soloAcc = await getSoloAccount(uid)
    if (!soloAcc) return
    await syncRanks(uid, soloAcc, gid)
    // 顺手缓存请求者昵称
    if (e?.sender) {
      const nick = e.sender.card || e.sender.nickname
      if (nick) cacheUserName(uid, nick).catch(() => {})
    }
  } catch (err) {
    logger.error("[FX-plugin] 刷新排行榜失败", err)
  }
}

async function ensureSoloAccount(uid, gid = null) {
  let acc = await getSoloAccount(uid)
  if (acc) {
    let needSync = false
    if (acc.debt === undefined) acc.debt = 0
    if (acc.bankruptCount === undefined) acc.bankruptCount = 0
    if (acc.lastBankruptcy === undefined) acc.lastBankruptcy = 0
    if (acc.loan === undefined) acc.loan = null
    if (acc.lastWatch === undefined) acc.lastWatch = ""
    if (acc.rooftopCount === undefined) acc.rooftopCount = 0
    if (acc.intel === undefined) acc.intel = null
    if (acc.lastRooftopClaim === undefined) acc.lastRooftopClaim = 0
    if (acc.lastWorkAt === undefined) acc.lastWorkAt = 0
    if (acc.workCount === undefined) acc.workCount = 0
    if (acc.lastBPlanAt === undefined) acc.lastBPlanAt = 0
    if (acc.bPlanCount === undefined) acc.bPlanCount = 0
    if (acc.lastStealAt === undefined) acc.lastStealAt = 0
    if (acc.stats === undefined) {
      acc.stats = defaultStats()
      needSync = true
    }
    const ds = defaultStats()
    for (const k of Object.keys(ds)) {
      if (acc.stats[k] === undefined) {
        acc.stats[k] = ds[k]
        needSync = true
      }
    }
    if (needSync) {
      await syncRanks(uid, acc, gid)
    }
    return { acc, created: false }
  }
  acc = {
    balance: CONFIG.initialMoney,
    positionsSolo: {},
    lastSubsidy: "",
    blowups: 0,
    firstTrade: false,
    consecutiveLosses: 0,
    consecutiveWins: 0,
    everProfited: false,
    lastBlowupNotifyTime: 0,
    debt: 0,
    bankruptCount: 0,
    lastBankruptcy: 0,
    loan: null,
    lastWatch: "",
    rooftopCount: 0,
    intel: null,
    lastRooftopClaim: 0,
    lastWorkAt: 0,
    workCount: 0,
    lastBPlanAt: 0,
    bPlanCount: 0,
    lastStealAt: 0,
    stats: defaultStats(),
    createTime: Date.now()
  }
  await saveSoloAccount(uid, acc, gid)
  await getSoloMarket(uid)
  return { acc, created: true }
}
async function ensureSharedAccount(gid, uid) {
  let acc = await getSharedAccount(gid, uid)
  if (acc) return { acc, created: false }
  acc = { positionsShared: {}, createTime: Date.now() }
  await saveSharedAccount(gid, uid, acc)
  await getSharedMarket(gid)
  return { acc, created: true }
}

function getGroupNpc() {
  return NPC_LIST[Math.floor(Math.random() * NPC_LIST.length)]
}

/* ============================================================
 *  仓位计算
 *  - pnl 基于 notional（名义价值）
 *  - 爆仓判定基于 margin（保证金）
 * ============================================================ */
function calcPnL(pos, cur) {
  const diff = cur - pos.avgPrice
  const dir = pos.side === "long" ? 1 : -1
  const notional = pos.notional != null ? pos.notional : (pos.amount || 0)
  return (diff / pos.avgPrice) * notional * dir
}
function calcFloatingPnL(positions, market) {
  let sum = 0
  for (const pos of Object.values(positions || {})) {
    const cur = market[pos.code]?.price
    if (cur) sum += calcPnL(pos, cur)
  }
  return sum
}
function calcUsedMargin(positions) {
  let sum = 0
  for (const p of Object.values(positions || {})) sum += (p.margin || 0)
  return sum
}
async function calcOverall(gid, uid, soloAcc, sharedAcc) {
  const soloMarket = await getSoloMarket(uid)
  const soloFloat = calcFloatingPnL(soloAcc?.positionsSolo, soloMarket)
  const soloUsed = calcUsedMargin(soloAcc?.positionsSolo)

  let sharedFloat = 0, sharedUsed = 0
  if (gid && sharedAcc) {
    const sharedMarket = await getSharedMarket(gid)
    sharedFloat = calcFloatingPnL(sharedAcc.positionsShared, sharedMarket)
    sharedUsed = calcUsedMargin(sharedAcc.positionsShared)
  }

  const balance = (soloAcc?.balance ?? 0) - (soloAcc?.debt ?? 0)
  const totalFloat = soloFloat + sharedFloat
  const totalUsed = soloUsed + sharedUsed
  const equity = balance + totalFloat
  const free = equity - totalUsed
  const rate = totalUsed > 0 ? equity / totalUsed : Infinity
  return { soloFloat, sharedFloat, totalFloat, soloUsed, sharedUsed, totalUsed, equity, free, rate, balance }
}

/* ============================================================
 *  黑天鹅
 * ============================================================ */
async function checkBlackSwan(gid, uid, mode, market) {
  if (Math.random() > CONFIG.blackSwanChance) return null

  const evt = BLACK_SWAN_EVENTS[Math.floor(Math.random() * BLACK_SWAN_EVENTS.length)]

  let targetCodes
  if (evt.pairs === "ALL") {
    targetCodes = PAIRS.map(p => p.code)
  } else {
    targetCodes = evt.pairs.slice()
  }
  const inverseCodes = evt.inversePairs || []
  // 反向品种也要被纳入处理，即使它没出现在 evt.pairs 里
  for (const c of inverseCodes) {
    if (!targetCodes.includes(c)) targetCodes.push(c)
  }

  const affected = []
  for (const code of targetCodes) {
    const target = PAIRS.find(p => p.code === code)
    if (!target) continue
    const st = market[code]
    if (!st) continue

    const jumpBase = evt.jumpMin + Math.random() * (evt.jumpMax - evt.jumpMin)
    const baseDir = evt.direction !== undefined ? evt.direction : (Math.random() > 0.5 ? 1 : -1)
    const finalDir = inverseCodes.includes(code) ? -baseDir : baseDir

    const oldPrice = st.price
    const newPrice = st.price * (1 + jumpBase * finalDir)
    const f = 10 ** target.precision
    st.price = Math.max(0.00001, Math.round(newPrice * f) / f)
    st.history.push(st.price)
    if (st.history.length > 120) st.history.shift()

    if (Array.isArray(st.ohlc) && st.ohlc.length) {
      const bar = st.ohlc[st.ohlc.length - 1]
      bar.c = st.price
      bar.h = Math.max(bar.h, st.price, bar.o)
      bar.l = Math.min(bar.l, st.price, bar.o)
    }

    affected.push({
      pair: target,
      oldPrice,
      newPrice: st.price,
      jump: jumpBase * finalDir,
      direction: finalDir
    })
  }

  if (!affected.length) return null
  return { eventName: evt.name, eventDesc: evt.desc, affected }
}

/* ============================================================
 *  回合推进
 * ============================================================ */
async function tickMarket(gid, uid, mode) {
  const market = mode === "solo" ? await getSoloMarket(uid) : await getSharedMarket(gid)
  for (const p of PAIRS) {
    const st = market[p.code]
    if (!st) continue

    const open = st.price
    const drift = p.drift || 0
    const shock = gaussian() * p.volatility
    let closeRaw = open * (1 + drift + shock)
    closeRaw += (p.price - closeRaw) * 0.01
    closeRaw = Math.max(0.00001, closeRaw)
	
	// 【新增】如果算出来的收盘价和开盘价几乎一样（比如被精度截断），强行拉开一点，保证有实体
    if (Math.abs(closeRaw - open) < open * 0.00005) {
      closeRaw = open * (1 + (Math.random() > 0.5 ? 0.0001 : -0.0001))
    }

    // 盘中 wick：把当日波动"展开"，high 必须 >= max(o,c)，low 必须 <= min(o,c)
    const wickScale = Math.abs(shock) * 0.5 + p.volatility * 0.5
    const upperWick = Math.random() * wickScale
    const lowerWick = Math.random() * wickScale
    const highRaw = Math.max(open, closeRaw) * (1 + upperWick)
    const lowRaw  = Math.max(0.00001, Math.min(open, closeRaw) * (1 - lowerWick))

    const f = 10 ** p.precision
    const bar = {
      o: Math.round(open     * f) / f,
      h: Math.round(highRaw  * f) / f,
      l: Math.round(lowRaw   * f) / f,
      c: Math.round(closeRaw * f) / f,
    }

    st.price = bar.c
    if (!Array.isArray(st.ohlc)) st.ohlc = []
    if (!Array.isArray(st.history)) st.history = []
    st.ohlc.push(bar)
    st.history.push(bar.c)
    if (st.ohlc.length > 120) st.ohlc.shift()
    if (st.history.length > 120) st.history.shift()
  }
  if (mode === "solo") await saveSoloMarket(uid, market)
  else await saveSharedMarket(gid, market)
  return market
}

/* ============================================================
 *  逐仓爆仓检查
 *  - 遍历该玩家所有仓位，逐个检查 pnl <= -margin 的
 *  - 爆掉的仓位单独处理，未爆的保留
 * ============================================================ */
async function tryBlowup(gid, uid, soloAcc, sharedAcc, mode, eventGid = null) {
  const positions = mode === "solo" ? soloAcc?.positionsSolo : sharedAcc?.positionsShared
  if (!positions || !Object.keys(positions).length) return null

  const market = mode === "solo" ? await getSoloMarket(uid) : await getSharedMarket(gid)
  const closed = []
  let totalPnL = 0

  for (const key of Object.keys(positions)) {
    const pos = positions[key]
    const st  = market[pos.code]
    if (!st) continue
    const margin = pos.margin || 0
    if (margin <= 0) continue
    const notional = pos.notional ?? pos.amount ?? 0
    if (notional <= 0) continue

    const bar = (Array.isArray(st.ohlc) && st.ohlc.length)
      ? st.ohlc[st.ohlc.length - 1]
      : { o: st.price, h: st.price, l: st.price, c: st.price }

    let blown = false
    let triggerPrice = null

    if (pos.side === "long") {
      const blowupPrice = pos.avgPrice * (1 - margin / notional)
      // 盘中最低价触及爆仓价 → 爆
      if (bar.l <= blowupPrice) {
        blown = true
        triggerPrice = bar.o < blowupPrice ? bar.o : blowupPrice
      }
    } else {
      const blowupPrice = pos.avgPrice * (1 + margin / notional)
      // 盘中最高价触及爆仓价 → 爆
      if (bar.h >= blowupPrice) {
        blown = true
        triggerPrice = bar.o > blowupPrice ? bar.o : blowupPrice
      }
    }

    if (!blown) continue

    // 逐仓爆仓保护：最多亏掉保证金
    const actualPnL = -margin
    closed.push({ pos, pnl: actualPnL, triggerPrice, bar })
    totalPnL += actualPnL
    delete positions[key]
  }

  if (!closed.length) return null

  // 扣余额
  const newBalance = soloAcc.balance + totalPnL
  if (newBalance < 0) {
    soloAcc.debt = (soloAcc.debt || 0) + Math.abs(newBalance)
    soloAcc.balance = 0
  } else {
    soloAcc.balance = newBalance
  }

  // 统计
  soloAcc.stats = soloAcc.stats || defaultStats()
  soloAcc.stats.fxProfit = (soloAcc.stats.fxProfit || 0) + totalPnL
  if (totalPnL < 0) {
    soloAcc.stats.fxLoss = (soloAcc.stats.fxLoss || 0) + Math.abs(totalPnL)
  }
  soloAcc.stats.totalAbsPnL = (soloAcc.stats.totalAbsPnL || 0) + Math.abs(totalPnL)

  // 爆仓记录
  soloAcc.blowups = (soloAcc.blowups || 0) + 1
  soloAcc.consecutiveLosses = (soloAcc.consecutiveLosses || 0) + 1
  soloAcc.consecutiveWins = 0
  soloAcc.lastBlowup = { time: Date.now(), pnl: totalPnL, mode, count: closed.length }

  // 保存
  if (mode === "shared" && sharedAcc) {
    await saveSharedAccount(gid, uid, sharedAcc)
  }
  await saveSoloAccount(uid, soloAcc, eventGid)

  // 共享场：两个场都空仓 → 自动移出活跃名单
  if (mode === "shared" && gid) {
    try {
      const hasSharedPos = Object.keys(sharedAcc?.positionsShared || {}).length > 0
      const hasSoloPos = Object.keys(soloAcc?.positionsSolo || {}).length > 0
      if (!hasSharedPos && !hasSoloPos) {
        await RS.srem(K_ACTIVE(`${gid}`), uid)
        const votes = await getSharedVotes(`${gid}`)
        if (votes[String(uid)] !== undefined) {
          delete votes[String(uid)]
          await setSharedVotes(`${gid}`, votes)
        }
      }
    } catch {}
  }

  // 私聊爆仓通知
  const now = Date.now()
  const lastNotify = soloAcc.lastBlowupNotifyTime || 0
  const shouldNotify = (now - lastNotify) >= CONFIG.blowupNotifyCdMs

  try {
    const friend = Bot.pickFriend(Number(uid))
    const lines = closed.map(c => {
      const pair = PAIRS.find(p => p.code === c.pos.code)
      // 计算当时的爆仓线
      const notional = c.pos.notional ?? c.pos.amount ?? 0
      const margin = c.pos.margin || 0
      const blowupLine = c.pos.side === "long" 
        ? c.pos.avgPrice * (1 - margin / notional)
        : c.pos.avgPrice * (1 + margin / notional)
      
      const bar = c.bar || {}
      const triggerInfo = c.pos.side === "long"
        ? `当日最低跌至 ${priceStr(bar.l, pair.precision)}，击穿爆仓线 ${priceStr(blowupLine, pair.precision)}`
        : `当日最高涨至 ${priceStr(bar.h, pair.precision)}，击穿爆仓线 ${priceStr(blowupLine, pair.precision)}`

      return `· ${pair.name}(${pair.alias}) ${c.pos.side === "long" ? "多" : "空"}\n` +
             `  均价 ${priceStr(c.pos.avgPrice, pair.precision)} · 杠杆 ${c.pos.leverage}×\n` +
             `  💥 ${triggerInfo}\n` +
             `  保证金 ¥${fmt(margin)} → 爆仓全损`
    })

    if (shouldNotify) {
      await friend.sendMsg(`💥 爆仓警告（${MODE_LABEL[mode]}场）`)
      await new Promise(r => setTimeout(r, 2000))
      await friend.sendMsg(
        `━━━━━━━━━━━━━━\n` +
        `${closed.length} 个仓位被强平：\n` +
        lines.join("\n")
      )
      await new Promise(r => setTimeout(r, 2000))
      await friend.sendMsg(
        `━━━━━━━━━━━━━━\n` +
        `本场合计：${totalPnL >= 0 ? "+" : ""}¥${fmt(totalPnL)}\n` +
        `账户余额：¥${fmt(soloAcc.balance)}` +
        (soloAcc.debt > 0 ? `\n💀 负债：¥${fmt(soloAcc.debt)}` : "")
      )
      await new Promise(r => setTimeout(r, 2000))
      await friend.sendMsg(`久留美：「${pick(TALKS.blowup)}」`)
      soloAcc.lastBlowupNotifyTime = now
      await saveSoloAccount(uid, soloAcc, eventGid)
    } else {
      await friend.sendMsg(
        `💥 又爆了（${MODE_LABEL[mode]}场）\n` +
        `${closed.length} 个仓位被强平，亏损 ¥${fmt(Math.abs(totalPnL))}\n` +
        `剩余 ¥${fmt(soloAcc.balance)}` +
        (soloAcc.debt > 0 ? `\n负债：¥${fmt(soloAcc.debt)}` : "") +
        `\n（24h 内重复爆仓，详情不再刷屏）`
      )
    }
  } catch (err) {
    logger.error("[FX-plugin] 爆仓通知失败", err)
  }

  return { closed, totalPnL, count: closed.length }
}

async function checkStopOut(gid, mode, market, triggerUid, eventGid = null) {
  const blown = []
  if (mode === "solo") {
    const soloAcc = await getSoloAccount(triggerUid)
    if (!soloAcc) return blown
    const info = await tryBlowup(null, triggerUid, soloAcc, null, "solo", eventGid)
    if (info) blown.push({ uid: String(triggerUid), ...info })
    return blown
  }
  let users = []
  try { users = await RS.smembers(K_SHARED_USERSET(gid)) } catch { return blown }
  for (const uid of users) {
    const soloAcc = await getSoloAccount(uid)
    const sharedAcc = await getSharedAccount(gid, uid)
    if (!sharedAcc) continue
    const info = await tryBlowup(gid, uid, soloAcc, sharedAcc, "shared", eventGid)
    if (info) blown.push({ uid, ...info })
  }
  return blown
}

/* ============================================================
 *  插件主体
 * ============================================================ */
export class FXPlugin extends plugin {
  constructor() {
    super({
      name: "FX-plugin",
      dsc: `${GAME_FULL} · 双市场外汇模拟`,
      event: "message",
      priority: 5000,
      rule: [
        { reg: HELP_REG, fnc: "fxHelp" },
        { reg: HELP_FULL_REG, fnc: "fxHelpFull" },
        { reg: "^#?(上传|发送)?(FX|fx)?说明书$", fnc: "uploadHelpFile" },
        { reg: "^#?开户$", fnc: "openAccount" },
        { reg: "^#?加入共享$", fnc: "joinShared" },
        { reg: "^#?退出共享$", fnc: "quitShared" },
        { reg: "^#?共享玩家$", fnc: "activeList" },
        { reg: "^#?(独|共)(下一天|明天|推进|开盘)$", fnc: "nextDay" },
        { reg: "^#?(独|共)(下|推进)(\\d+)(?:天|日)$", fnc: "nextNDays" },
        { reg: "^#?(?:(独|共))?(领补助|签到)$", fnc: "claimSubsidy" },
        { reg: "^#?(独|共)(行情|汇率|大盘)$", fnc: "market" },
        { reg: `^#?(独|共)(看|查询)\\s*${PAIR_PATTERN}$`, fnc: "query" },
		{ reg: `^#?(独|共)(K线|k线|K图|蜡烛图)\\s*${PAIR_PATTERN}$`, fnc: "kline" },
        { reg: `^#?(独|共)(做多|押涨|买入)\\s*${PAIR_PATTERN}\\s*\\d+(?:\\.\\d+)?(?:\\s+${LEV_PATTERN})?$`, fnc: "openLong" },
        { reg: `^#?(独|共)(做空|押跌|卖出)\\s*${PAIR_PATTERN}\\s*\\d+(?:\\.\\d+)?(?:\\s+${LEV_PATTERN})?$`, fnc: "openShort" },
        { reg: `^#?(独|共)平仓?\\s*${PAIR_PATTERN}$`, fnc: "closeOne" },
        { reg: "^#?(独|共)(全平|一键平仓|平全部)$", fnc: "closeAll" },
        { reg: "^#?(独|共)(持仓|仓位|我的仓位)$", fnc: "portfolio" },
        { reg: "^#?(余额|资产|净值)$", fnc: "assets" },
        { reg: "^#?爆仓史$", fnc: "blowupHistory" },
        { reg: "^#?天台$", fnc: "rooftop" },
        { reg: "^#?(个人)?破产$", fnc: "bankruptcy" },
        { reg: "^#?借钱加仓$", fnc: "borrowMoney" },
        { reg: "^#?还债$", fnc: "repayLoan" },
        { reg: "^#?还赃$", fnc: "returnStolenMoney" },
        { reg: "^#?盯盘$", fnc: "dailyWatch" },
        { reg: "^#?(打工|FX打工)$", fnc: "work" },
        { reg: "^#?(启动)?B计划$|^#?b计划$", fnc: "bPlan" },
        { reg: "^#?偷钱$", fnc: "stealMoney" },
        { reg: "^#?我的NPC$", fnc: "myNpc" },
        { reg: "^#?视奸(?:\\s+.*)?$", fnc: "peek" },
        { reg: "^#?(FX)?(排行榜|总榜)$", fnc: "totalRank" },
        { reg: "^#?(FX)?全服(排行榜|总榜)$", fnc: "totalRank" },
        { reg: "^#?(富豪榜|天台榜|FX之巅)$", fnc: "richRank" },
        { reg: "^#?全服富豪榜$", fnc: "richRank" },
        { reg: "^#?股神榜$", fnc: "godRank" },
        { reg: "^#?全服股神榜$", fnc: "godRank" },
        { reg: "^#?梭哈榜$", fnc: "sohaRank" },
        { reg: "^#?全服梭哈榜$", fnc: "sohaRank" },
        { reg: "^#?韭菜榜$", fnc: "leekRank" },
        { reg: "^#?全服韭菜榜$", fnc: "leekRank" },
        { reg: "^#?刺激榜$", fnc: "thrillRank" },
        { reg: "^#?全服刺激榜$", fnc: "thrillRank" },
        { reg: "^#?老赖榜$", fnc: "debtRank" },
        { reg: "^#?全服老赖榜$", fnc: "debtRank" },
        { reg: "^#?刷新排行榜$", fnc: "refreshRankCmd" }
      ]
    })
  }

  async openAccount(e) {
    const uid = String(e.user_id)
    const gid = getEventGid(e)
    const { acc, created } = await ensureSoloAccount(uid, gid)
    if (!created) {
      return e.reply(`❎ 你已经开过户了\n余额：¥${fmt(acc.balance)}` +
        (acc.debt > 0 ? `\n负债：¥${fmt(acc.debt)}` : "") +
        `\n发送 #独行情 查看汇率`)
    }
    if (isGroup(e)) await ensureSharedAccount(getGid(e), uid)
    await refreshRank(e, uid, gid)

    const lines = [
      `🎉 开户成功`,
      `━━━━━━━━━━━━━━`,
      `游戏名：${GAME_FULL}`,
      `初始资金：¥${fmt(CONFIG.initialMoney)}`,
      `默认杠杆：${CONFIG.defaultLeverage}×（中档）`,
      `逐仓爆仓：亏损 ≥ 保证金就爆`,
      `━━━━━━━━━━━━━━`,
      `你已拥有独立场行情`,
      `· 群聊私聊共享同一份`,
      `· #独下一天 推进自己的一天`,
      `· #独下N天 连推 N 天`
    ]
    if (isGroup(e)) {
      lines.push(`👤 本群有 4 位 NPC：`)
      lines.push(`· 久留美（激进）—— "现在买入，一定爆赚！"`)
      lines.push(`· 萌智子（理性/双面）—— 冷静时怂恿你，爆仓时劝你收手`)
      lines.push(`· 芽吹（直觉/笨蛋）—— "打工是不可能的，这辈子都不可能打工的。"`)
      lines.push(`· 安子（保守）—— 4人里唯一正常人`)
      lines.push(`· 每次事件随机出现，发送 #我的NPC 查看`)
    }
    if (isGroup(e)) {
      lines.push(``)
      lines.push(`想跟群友一起玩？`)
      lines.push(`· 发送 #加入共享 参与共享场`)
    }
    lines.push(``)
    lines.push(`常用指令：`)
    lines.push(`· #独行情 / #独押涨 美日 1000 中`)
    lines.push(`· #余额 / #天台 / #盯盘 / #打工`)
    lines.push(`· #排行榜 看大佬排名`)
    lines.push(`· #拟股喵喵帮助 查看玩法`)
    lines.push(``)
    lines.push(`久留美：「老实赚钱很枯燥吧？」`)
    lines.push(`久留美：「要不要试试看，用FX……把人生翻个面？」`)
    return e.reply(lines.join("\n"))
  }

  async fxHelp(e) {
    return e.reply(
      `💹 ${GAME_FULL}\n` +
      `━━━━━━━━━━━━━━\n` +
      `这是个猜汇率涨跌的小游戏。\n` +
      `猜对了赚钱，猜错了亏钱。\n` +
      `输了不用还，赢了自己拿。\n\n` +
      `【3 步上手】\n` +
      `① 发 #开户\n` +
      `② 发 #独押涨 美日 1000 中\n` +
      `③ 发 #独下一天（或 #独下10天 连推）\n\n` +
      `看K线：发 #独K线 美日\n` +
      `输入的是押注金额（保证金），\n` +
      `名义价值 = 押注金额 × 杠杆。\n` +
      `━━━━━━━━━━━━━━\n` +
      `想深入了解：发 #FX详细\n` +
      `（或 #任意别名详细，如 #拟股喵喵详细）\n` +
      `也可以发 #上传说明书，把说明书存到群文件\n` +
      `常见设计问题在详细帮助的最后一页\n` +
      `久留美：「来吧，天台风景不错。」`
    )
  }

  async fxHelpFull(e) {
    const nodes = buildHelpNodes()
    return sendForward(e, nodes)
  }

  async uploadHelpFile(e) {
    const nodes = buildHelpNodes()
    if (!isGroup(e)) {
      return await sendPrivateHelpFile(e, nodes)
    }
    try {
      await uploadGroupHelpFile(e, nodes)
      return e.reply(`✅ 说明书已上传到群文件\n文件名：${CONFIG.helpFileName}`)
    } catch (err) {
      logger.error("[FX-plugin] 上传群文件失败:", err)
      return e.reply(`❌ 上传群文件失败：${err.message}\n（协议端可能未开启群文件上传权限）`)
    }
  }

  /* ============================================================
   *  #偷钱
   * ============================================================ */
  async stealMoney(e) {
    const uid = String(e.user_id)
    const gid = getEventGid(e)
    const soloAcc = await getSoloAccount(uid)
    if (!soloAcc) return e.reply("❎ 请先发送 #开户")

    soloAcc.stats = soloAcc.stats || defaultStats()

    if (soloAcc.stats.stealUsedThisCycle) {
      return e.reply(
        `❎ 本周期偷钱机会已用尽\n` +
        `（每个破产周期只有一次）\n` +
        `破产后重新开始`
      )
    }

    if (soloAcc.loan) {
      return e.reply(
        `❎ 你还有 ¥${fmt(soloAcc.loan.amount)} 的借款未还\n` +
        `带着借来的钱去偷，是想把牢底坐穿吗？\n` +
        `请先发送 #还债 还款`
      )
    }

    if (soloAcc.loan) {
      return e.reply(
        `❎ 你还有 ¥${fmt(soloAcc.loan.amount)} 的借款未还\n` +
        `带着负债去偷钱，是想把牢底坐穿吗？\n` +
        `请先发送 #还债 还款`
      )
    }

    if (soloAcc.balance >= CONFIG.bankruptcyReset) {
      return e.reply(
        `❎ 你还有 ¥${fmt(soloAcc.balance)}，不用偷\n` +
        `（余额 < ¥${fmt(CONFIG.bankruptcyReset)} 才能触发）`
      )
    }

    const now = Date.now()
    soloAcc.stats.stealUsedThisCycle = true
    soloAcc.stats.stealCount = (soloAcc.stats.stealCount || 0) + 1
    soloAcc.lastStealAt = now

    const success = Math.random() < CONFIG.stealSuccessRate
    let npcMsg = ""
    if (isGroup(e)) {
      const npc = getGroupNpc()
      npcMsg = npcInterject(npc, "steal")
    }

    if (success) {
      soloAcc.balance += CONFIG.stealAmount
      soloAcc.stats.stealWin = (soloAcc.stats.stealWin || 0) + 1
      soloAcc.stats.totalAbsPnL = (soloAcc.stats.totalAbsPnL || 0) + CONFIG.stealAmount
      soloAcc.stats.pendingStealDebt = (soloAcc.stats.pendingStealDebt || 0) + CONFIG.stealAmount

      await saveSoloAccount(uid, soloAcc, gid)
      await refreshRank(e, uid, gid)

      return e.reply(
        `💰 偷钱成功\n━━━━━━━━━━━━━━\n` +
        `到手：+¥${fmt(CONFIG.stealAmount)}\n` +
        `当前余额：¥${fmt(soloAcc.balance)}\n` +
        `待还赃：¥${fmt(soloAcc.stats.pendingStealDebt)}\n` +
        `━━━━━━━━━━━━━━\n` +
        `久留美：「快跑，别回头。」\n` +
        `（可用 #还赃 归还，不还也可以）` + npcMsg
      )
    }

    // 失败 → 平仓 + 重罚
    const pnlResult = await this._forceCloseForSteal(e, soloAcc)
    const debtAfterClose = soloAcc.debt || 0
    
    if (debtAfterClose > 0) {
      soloAcc.stats.totalUnpaidDebt = (soloAcc.stats.totalUnpaidDebt || 0) + debtAfterClose
    }

    // 【核心修改】把原有的债务加上偷窃罚款！
    soloAcc.debt = debtAfterClose + 50000 
    soloAcc.balance = 0  // 余额没收
    soloAcc.positionsSolo = {}
    soloAcc.bankruptCount = (soloAcc.bankruptCount || 0) + 1
    soloAcc.lastBankruptcy = now // 立刻进入破产冷却，让你 24h 内无法洗白
    soloAcc.loan = null
    soloAcc.rooftopCount = (soloAcc.rooftopCount || 0) + 1
    soloAcc.blowups = (soloAcc.blowups || 0) + 1
    soloAcc.lastBlowup = { time: now, pnl: -Math.abs(pnlResult.totalPnL), mode: "steal", count: 1 }

    soloAcc.stats.pendingStealDebt = 0
    soloAcc.stats.stealUsedThisCycle = false

    await saveSoloAccount(uid, soloAcc, gid)
    await refreshRank(e, uid, gid)

    return e.reply(
      `🚔 偷钱失败，你被捕了！\n━━━━━━━━━━━━━━\n` +
      `你被抓了，不仅身无分文，还背上了高额罚款！\n` +
      `━━━━━━━━━━━━━━\n` +
      `平仓盈亏：${pnlResult.totalPnL >= 0 ? "+" : ""}¥${fmt(pnlResult.totalPnL)}\n` +
      `余额没收：¥0.00\n` +
      `原有负债：¥${fmt(debtAfterClose)}\n` +
      `⛓️ 违法罚金：+¥50,000.00\n` +
      `━━━━━━━━━━━━━━\n` +
      `💀 当前总负债：¥${fmt(soloAcc.debt)}\n` +
      `⚠️ 24 小时内无法申请 #个人破产\n` +
      `现在，去 #打工 把钱还上吧。\n` +
      `━━━━━━━━━━━━━━\n` +
      `久留美：「天台的风我熟，监狱的风，你熟吗？」` + npcMsg
    )
  }

  async _forceCloseForSteal(e, soloAcc) {
    const uid = String(e.user_id)
    const market = await getSoloMarket(uid)
    const positions = soloAcc.positionsSolo || {}
    let totalPnL = 0
    for (const key of Object.keys(positions)) {
      const pos = positions[key]
      const cur = market[pos.code].price
      totalPnL += calcPnL(pos, cur)
    }
    soloAcc.positionsSolo = {}
    const newBalance = (soloAcc.balance || 0) + totalPnL
    if (newBalance < 0) {
      soloAcc.debt = (soloAcc.debt || 0) + Math.abs(newBalance)
      soloAcc.balance = 0
    } else {
      soloAcc.balance = newBalance
    }
    soloAcc.stats.fxProfit = (soloAcc.stats.fxProfit || 0) + totalPnL
    if (totalPnL < 0) {
      soloAcc.stats.fxLoss = (soloAcc.stats.fxLoss || 0) + Math.abs(totalPnL)
    }
    soloAcc.stats.totalAbsPnL = (soloAcc.stats.totalAbsPnL || 0) + Math.abs(totalPnL)
    return { totalPnL }
  }

  /* ============================================================
   *  #还赃
   * ============================================================ */
  async returnStolenMoney(e) {
    const uid = String(e.user_id)
    const gid = getEventGid(e)
    const soloAcc = await getSoloAccount(uid)
    if (!soloAcc) return e.reply("❎ 请先发送 #开户")

    soloAcc.stats = soloAcc.stats || defaultStats()
    const pending = soloAcc.stats.pendingStealDebt || 0

    if (pending <= 0) {
      return e.reply(`❎ 你没有待还的赃款`)
    }

    if (soloAcc.balance < pending) {
      return e.reply(
        `❎ 余额不足\n` +
        `待还：¥${fmt(pending)}\n` +
        `你有：¥${fmt(soloAcc.balance)}`
      )
    }

    soloAcc.balance -= pending
    soloAcc.stats.pendingStealDebt = 0
    await saveSoloAccount(uid, soloAcc, gid)
    await refreshRank(e, uid, gid)

    const STEAL_RETURN_TALKS = {
      kurumi: ["……你居然还了。", "归位好没有？别被父亲发现了。", "谢天谢地，终于还了。"],
      mochiko: ["我就知道你是理智的。", "明智的选择。", "还是你懂事。","……还了？你可真无聊。", "有钱不赚，你脑子没病吧？", "算了。反正你迟早会后悔的。","啧。没意思。"],
      mebuki: ["哇，你还回去了？", "真的假的？", "你这人……有点意思。","久留美是不是没还上？"],
      anko: ["这才对。", "有借有还。", "踏实点好。"]
    }

    let npcMsg = ""
    if (isGroup(e)) {
      const npc = getGroupNpc()
      const pool = STEAL_RETURN_TALKS[npc.id]
      if (pool && pool.length) {
        npcMsg = `\n${npc.name}：「${pick(pool)}」`
      }
    }

    return e.reply(
      `✅ 还赃成功\n━━━━━━━━━━━━━━\n` +
      `归还：¥${fmt(pending)}\n` +
      `余额：¥${fmt(soloAcc.balance)}\n` +
      `━━━━━━━━━━━━━━` + npcMsg
    )
  }

  /* ============================================================
   *  排行榜
   * ============================================================ */
  async _renderBoard(e, key, title, fmtFn, n = 10) {
    const list = await zsetTop(key, n * 3)
    const filtered = list.filter(it => it.score > 0).slice(0, n)
    if (!filtered.length) return null

    const medals = ["🥇", "🥈", "🥉"]
    const lines = []
    for (let i = 0; i < filtered.length; i++) {
      const it = filtered[i]
      const nick = await getDisplayName(e, it.uid)
      const prefix = medals[i] || ` ${i + 1}.`
      lines.push(`${prefix} ${nick}  ${fmtFn(it.score)}`)
    }

    return { nickname: title, content: `${title}\n${lines.join("\n")}` }
  }

  _boardFmt(type) {
    switch (type) {
      case "balance":  return s => `¥${fmt(s)}`
      case "profit":   return s => `+¥${fmt(s)}`
      case "invested": return s => `${fmt(s)} 分`
      case "loss":     return s => `-¥${fmt(s)}`
      case "abs":      return s => `¥${fmt(s)}`
      case "debt":     return s => `¥${fmt(s)}`
      default:         return s => `¥${fmt(s)}`
    }
  }

  _getRankScope(e) {
    const isGlobal = String(e.msg || "").includes("全服")
    if (isGlobal) return { gid: null, scope: "global", label: "全服" }
    if (isGroup(e)) return { gid: e.group_id, scope: "group", label: "本群" }
    return { gid: null, scope: "global", label: "全服" }
  }

  async totalRank(e) {
    await rebuildAllRanksOnce()
    const { gid, label } = this._getRankScope(e)

    const boards = [
      { kind: "balance",  title: "💰 富豪榜" },
      { kind: "profit",   title: "📈 股神榜" },
      { kind: "invested", title: "🎲 梭哈榜" },
      { kind: "loss",     title: "🥬 韭菜榜" },
      { kind: "abs",      title: "🎢 刺激榜" },
      { kind: "debt",     title: "💳 老赖榜" }
    ]

    const boardNodes = []
    for (const b of boards) {
      const key = K_RANK_KEY(b.kind, gid)
      const node = await this._renderBoard(e, key, b.title, this._boardFmt(b.kind), 5)
      if (node) boardNodes.push(node)
    }

    if (!boardNodes.length) {
      return e.reply(gid ? "📭 本群还没有人上榜，快去交易吧" : "📭 还没有人上榜，快去开户吧")
    }

    const header = {
      nickname: `🏆 ${label}排行榜总览`,
      content:
        `🏆 ${label}排行榜总览\n` +
        `━━━━━━━━━━━━━━\n` +
        `每个榜单显示前 5 名\n` +
        `想看完整的发对应单榜：\n` +
        `#富豪榜 / #股神榜 / #梭哈榜\n` +
        `#韭菜榜 / #刺激榜 / #老赖榜\n\n` +
        `想跨群看，前面加"全服"：\n` +
        `#全服排行榜 / #全服富豪榜 …`
    }

    return sendForward(e, [header, ...boardNodes])
  }

  async richRank(e) {
    await rebuildAllRanksOnce()
    const { gid, label } = this._getRankScope(e)
    const title = `💰 ${label}富豪榜`
    const node = await this._renderBoard(e, K_RANK_KEY("balance", gid), title, this._boardFmt("balance"), 10)
    if (!node) return e.reply(gid ? "📭 本群还没有人上榜" : "📭 还没有人上榜")
    return sendForward(e, [node])
  }

  async godRank(e) {
    await rebuildAllRanksOnce()
    const { gid, label } = this._getRankScope(e)
    const title = `📈 ${label}股神榜`
    const node = await this._renderBoard(e, K_RANK_KEY("profit", gid), title, this._boardFmt("profit"), 10)
    if (!node) return e.reply(gid ? "📭 本群还没有人上榜" : "📭 还没有人上榜")
    return sendForward(e, [node])
  }

  async sohaRank(e) {
    await rebuildAllRanksOnce()
    const { gid, label } = this._getRankScope(e)
    const title = `🎲 ${label}梭哈榜`
    const node = await this._renderBoard(e, K_RANK_KEY("invested", gid), title, this._boardFmt("invested"), 10)
    if (!node) return e.reply(gid ? "📭 本群还没有人上榜" : "📭 还没有人上榜")
    return sendForward(e, [node])
  }

  async leekRank(e) {
    await rebuildAllRanksOnce()
    const { gid, label } = this._getRankScope(e)
    const title = `🥬 ${label}韭菜榜`
    const node = await this._renderBoard(e, K_RANK_KEY("loss", gid), title, this._boardFmt("loss"), 10)
    if (!node) return e.reply(gid ? "📭 本群还没有人上榜" : "📭 还没有人上榜")
    return sendForward(e, [node])
  }

  async thrillRank(e) {
    await rebuildAllRanksOnce()
    const { gid, label } = this._getRankScope(e)
    const title = `🎢 ${label}刺激榜`
    const node = await this._renderBoard(e, K_RANK_KEY("abs", gid), title, this._boardFmt("abs"), 10)
    if (!node) return e.reply(gid ? "📭 本群还没有人上榜" : "📭 还没有人上榜")
    return sendForward(e, [node])
  }

  async debtRank(e) {
    await rebuildAllRanksOnce()
    const { gid, label } = this._getRankScope(e)
    const title = `💳 ${label}老赖榜`
    const node = await this._renderBoard(e, K_RANK_KEY("debt", gid), title, this._boardFmt("debt"), 10)
    if (!node) return e.reply(gid ? "📭 本群还没有人上榜" : "📭 还没有人上榜")
    return sendForward(e, [node])
  }

  async refreshRankCmd(e) {
    if (!e.isMaster) return e.reply("❎ 只有主人可以刷新排行榜")

    // 1) 重建全服榜 zset
    const n = await rebuildAllRanks()
    await redis.set(K_RANK_REBUILT, '1')

    // 2) 扫描机器人所在的群，缓存成员昵称
    let nameCount = 0
    try {
      const gl = Bot.gl
      if (gl && typeof gl.values === "function") {
        for (const g of gl.values()) {
          const gid = g?.group_id || g?.gid || (g?.group_code)
          if (!gid) continue
          try {
            const group = Bot.pickGroup(Number(gid))
            if (!group) continue
            const map = await group.getMemberMap()
            for (const [uid, m] of map) {
              const nick = m?.card || m?.nickname
              if (nick) {
                await cacheUserName(uid, nick)
                nameCount++
              }
            }
          } catch {}
        }
      }
    } catch (err) {
      logger.debug(`[FX-plugin] 缓存昵称失败: ${err.message}`)
    }

    return e.reply(
      `✅ 排行榜已刷新\n` +
      `同步了 ${n} 个账号\n` +
      `缓存了 ${nameCount} 个昵称\n` +
      `（群榜由玩家正常操作自然填充）`
    )
  }

  /* ============================================================
   *  多天推进
   * ============================================================ */
  async nextNDays(e) {
    const mode = getMode(e)
    if (!mode) return false
    const m = e.msg.match(/^#?(独|共)(?:下|推进)(\d+)(?:天|日)$/)
    if (!m) return false
    const n = parseInt(m[2])
    if (isNaN(n) || n < 1) return e.reply("❎ 天数必须是正整数")
    if (n > CONFIG.maxAdvanceDays) {
      return e.reply(`❎ 一次最多推进 ${CONFIG.maxAdvanceDays} 天`)
    }
    return mode === "solo"
      ? this._advanceSoloN(e, n)
      : this._advanceSharedN(e, n)
  }

  async _advanceSoloN(e, n) {
    const uid = String(e.user_id)
    const gid = getEventGid(e)
    if (isUserBusy(uid)) return e.reply("⚠️ 操作太快啦，喘口气再试")

    const soloAcc0 = await getSoloAccount(uid)
    if (!soloAcc0) return e.reply("❎ 请先发送 #开户")
    if (soloAcc0.debt > 0 && !soloAcc0.loan) {
      return e.reply(
        `💀 你已负债 ¥${fmt(soloAcc0.debt)}，无法操作\n` +
        `发送 #个人破产 申请免除债务，或 #还债 还款`
      )
    }

    setUserBusy(uid, 3000)

    const startOverall = await calcOverall(null, uid, soloAcc0, null)

    let advanced = 0
    let blownInfo = null
    const swanList = []
    let intelInfo = null
    const firstDay = await getDay(e, "solo")
    let lastDay = firstDay

    for (let i = 0; i < n; i++) {
      const day = await redis.incr(K_SOLO_DAY(uid))
      let market = await tickMarket(null, uid, "solo")
      advanced++
      lastDay = day

      let acc = await getSoloAccount(uid)
      if (acc.intel && i === 0) {
        const st = market[acc.intel.code]
        if (st) {
          st.price = st.price * (1 + acc.intel.drift)
          st.history[st.history.length - 1] = st.price
          intelInfo = { alias: acc.intel.alias, drift: acc.intel.drift, day }
          await saveSoloMarket(uid, market)
        }
        acc.intel = null
        await saveSoloAccount(uid, acc, gid)
      }

      const swan = await checkBlackSwan(null, uid, "solo", market)
      if (swan) {
        swanList.push({ ...swan, day })
        market = await getSoloMarket(uid)
      }

      const blown = await checkStopOut(null, "solo", market, uid, gid)
      if (blown && blown.length) {
        blownInfo = { day, list: blown }
        break
      }
    }

    const finalAcc = await getSoloAccount(uid)
    const finalMarket = await getSoloMarket(uid)
    const endOverall = await calcOverall(null, uid, finalAcc, null)

    await refreshRank(e, uid, gid)

    return await this._buildMultiDayNodes({
	  e,
      mode: "solo", advanced, planDays: n, firstDay, lastDay,
      startEquity: startOverall.equity, endEquity: endOverall.equity,
      finalAcc, finalMarket, blownInfo, swanList, intelInfo
    })
  }

  async _advanceSharedN(e, n) {
    const gid = getGid(e)
    const uid = String(e.user_id)

    if (!isGroup(e)) return e.reply("❎ 共享场只能在群聊里玩")

    const soloAcc = await getSoloAccount(uid)
    if (!soloAcc) return e.reply("❎ 请先发送 #开户")

    const active = await RS.smembers(K_ACTIVE(gid))
    if (!active.length) return e.reply("❎ 共享场当前没有活跃玩家，发送 #加入共享 参与")

    const isActive = active.includes(String(uid))
    if (!isActive) return e.reply(`❎ 你当前不在共享场活跃名单\n发送 #加入共享 参与共同推进`)

    const votes = await getSharedVotes(gid)
    votes[String(uid)] = n
    await setSharedVotes(gid, votes)

    const N = active.length
    const threshold = voteThreshold(N)
    const votedIds = active.filter(id => votes[String(id)] !== undefined)
    const votedCount = votedIds.length

    if (votedCount < threshold) {
      const lines = []
      for (const id of active) {
        const nick = await getNick(e, id)
        const v = votes[String(id)]
        lines.push(v !== undefined ? `✅ ${nick} — 投 ${v} 天` : `⏳ ${nick}`)
      }
      const myVote = n
      const minVote = Math.min(...votedIds.map(id => votes[String(id)]))
      return e.reply(
        `🗳️ 共享场投票 · 你投了 ${myVote} 天\n` +
        `━━━━━━━━━━━━━━\n` +
        `进度：${votedCount} / ${N}（过半 ${threshold} 即推进）\n` +
        `当前最小意愿：${minVote} 天\n\n` +
        lines.join("\n") +
        `\n━━━━━━━━━━━━━━\n` +
        `达到半数即推进，取已投票人的最小值\n` +
        `⚠️ 过半后即开牌，未投的群友也会被一起推进`
      )
    }

    const finalDays = Math.min(...votedIds.map(id => votes[String(id)]))
    await clearSharedVotes(gid)

    if (pushLock.has(gid)) return e.reply("⚠️ 上一轮推进处理中，请稍等一秒再试")
    pushLock.add(gid)

    try {
      const startOverall = {}
      for (const u of active) {
        const sAcc = await getSoloAccount(u)
        const shAcc = await getSharedAccount(gid, u)
        startOverall[u] = (await calcOverall(gid, u, sAcc, shAcc)).equity
      }
      const dayBefore = await redis.get(K_SHARED_DAY(gid))
      const firstDay = dayBefore ? Number(dayBefore) + 1 : 1

      let advanced = 0
      let lastDay = firstDay - 1
      const swanList = []
      let blownInfo = null

      for (let i = 0; i < finalDays; i++) {
        const day = await redis.incr(K_SHARED_DAY(gid))
        const market = await tickMarket(gid, uid, "shared")
        advanced++
        lastDay = day
        const swan = await checkBlackSwan(gid, uid, "shared", market)
        if (swan) swanList.push({ ...swan, day })
        const blown = await checkStopOut(gid, "shared", market, uid, gid)
        if (blown && blown.length) {
          blownInfo = { list: blown, day }
          break
        }
      }

      for (const u of active) {
        try {
          const sAcc = await getSoloAccount(u)
          await syncRanks(u, sAcc, gid)
        } catch (err) {
          logger.error("[FX-plugin] 批量刷新排行榜失败", err)
        }
      }

      const finalMarket = await getSharedMarket(gid)
      const finalAcc = await getSoloAccount(uid)
      const endEquity = (await calcOverall(gid, uid, finalAcc, await getSharedAccount(gid, uid))).equity

      const voteLines = []
      for (const id of votedIds) {
        const label = id === String(uid) ? "你" : await getNick(e, id)
        voteLines.push(`${label}=${votes[String(id)]}`)
      }
      const voteSummary = voteLines.join(" / ")

      return await this._buildMultiDayNodes({
		e,
        mode: "shared", advanced, planDays: finalDays, firstDay, lastDay,
        startEquity: startOverall[String(uid)] || 0, endEquity,
        finalAcc, finalMarket, blownInfo, swanList, intelInfo: null,
        sharedActiveCount: N, voteSummary, votedCount, threshold
      })
    } finally {
      pushLock.delete(gid)
    }
  }

  async _buildMultiDayNodes(ctx) {
    const {
      e,
      mode, advanced, planDays, firstDay, lastDay,
      startEquity, endEquity, finalAcc, finalMarket,
      blownInfo, swanList, intelInfo,
      sharedActiveCount, voteSummary, votedCount, threshold
    } = ctx

    const profit = endEquity - startEquity
    const profitRate = startEquity > 0 ? (profit / startEquity * 100) : 0
    const profitCls = profit >= 0 ? "up" : "down"

    let titleLine = `📅 ${MODE_LABEL[mode]}场 · 连推 ${advanced} 天`
    if (mode === "shared" && sharedActiveCount) {
      titleLine += ` · ${votedCount}/${sharedActiveCount} 票`
    }

    // 概览
    let overviewHtml = `
      <div class="row"><span class="label">天数</span>
        <span class="value">第 ${firstDay} 天 → 第 ${lastDay} 天</span></div>`
    if (mode === "shared" && voteSummary) {
      overviewHtml += `
        <div class="row"><span class="label">投票</span>
          <span class="value muted">${voteSummary}</span></div>
        <div class="row"><span class="label">阈值</span>
          <span class="value muted">${threshold} 票，取最小 ${planDays} 天</span></div>`
    }
    overviewHtml += `
      <div class="row"><span class="label">起始净值</span>
        <span class="value">¥${fmt(startEquity)}</span></div>
      <div class="row"><span class="label">结束净值</span>
        <span class="value">¥${fmt(endEquity)}</span></div>
      <div class="row"><span class="label">总变动</span>
        <span class="value ${profitCls}">${profit >= 0 ? "+" : ""}¥${fmt(profit)} (${pct(profitRate)})</span></div>
      <div class="row"><span class="label">余额</span>
        <span class="value">¥${fmt(finalAcc.balance)}</span></div>`
    if (finalAcc.debt > 0) {
      overviewHtml += `<div class="row"><span class="label">负债</span>
        <span class="value danger">¥${fmt(finalAcc.debt)}</span></div>`
    }
    if (finalAcc.loan) {
      overviewHtml += `<div class="row"><span class="label">未还借款</span>
        <span class="value warn">¥${fmt(finalAcc.loan.amount)}</span></div>`
    }
    if (finalAcc.stats?.pendingStealDebt > 0) {
      overviewHtml += `<div class="row"><span class="label">待还赃</span>
        <span class="value warn">¥${fmt(finalAcc.stats.pendingStealDebt)}</span></div>`
    }

    // 状态提示
    let statusHtml = ""
    if (blownInfo) {
      statusHtml = `<div class="quote danger">💥 第 ${blownInfo.day} 天爆仓，提前终止（原计划 ${planDays} 天）</div>`
    } else if (advanced === planDays) {
      statusHtml = `<div class="quote">✅ 全部 ${planDays} 天推进完成</div>`
    }

    // 爆仓事件
    let blownHtml = ""
    if (blownInfo) {
      const list = blownInfo.list || []
      const items = []
      for (const b of list) {
        const nick = await getNick(e, b.uid)
        items.push(`<div class="row">
          <span class="label">${nick}</span>
          <span class="value danger">${b.count || 1} 仓 · -¥${fmt(Math.abs(b.totalPnL))}</span>
        </div>`)
      }
      blownHtml = `<div class="section">
        <div class="section-title danger">💥 爆仓事件 · 第 ${blownInfo.day} 天</div>
        ${items.join("")}
      </div>`
    }

    // 黑天鹅（多事件版）
    let swanHtml = ""
    if (swanList.length) {
      const blocks = swanList.map(s => {
        const items = s.affected.map(a => `<div class="row">
          <span class="label">${a.pair.alias}</span>
          <span class="value warn">${priceStr(a.oldPrice, a.pair.precision)} → ${priceStr(a.newPrice, a.pair.precision)} (${a.jump >= 0 ? "+" : ""}${(a.jump * 100).toFixed(1)}%)</span>
        </div>`).join("")
        return `<div style="margin-bottom:12px">
          <div class="value warn" style="font-weight:600">📰 第 ${s.day} 天 · ${s.eventName}</div>
          <div class="muted" style="font-size:13px;margin:4px 0 6px">${s.eventDesc}</div>
          ${items}
        </div>`
      }).join("")
      swanHtml = `<div class="section">
        <div class="section-title warn">📰 黑天鹅 × ${swanList.length}</div>
        ${blocks}
      </div>`
    }

    // 情报
    let intelHtml = ""
    if (intelInfo) {
      intelHtml = `<div class="section">
        <div class="section-title">💡 情报生效 · 第 ${intelInfo.day} 天</div>
        <div class="row"><span class="label">${intelInfo.alias}</span>
          <span class="value ${intelInfo.drift >= 0 ? 'up' : 'down'}">${intelInfo.drift >= 0 ? "+" : ""}${(intelInfo.drift * 100).toFixed(2)}%</span></div>
      </div>`
    }

    // 最终市场
    const pairRows = PAIRS.map(p => {
      const st = finalMarket[p.code]
      if (!st) return ""
      const chg = change(finalMarket, p.code)
      const cls = chg > 0.01 ? "up" : chg < -0.01 ? "down" : ""
      const mark = chg > 0.01 ? "▲" : chg < -0.01 ? "▼" : "━"
      return `<div class="pair-row">
        <span class="label">${p.alias}</span>
        <span class="value ${cls}">${priceStr(st.price, p.precision)}
          <span class="muted">${mark} ${Math.abs(chg).toFixed(2)}%</span>
        </span>
      </div>`
    }).join("")

    const html = `
      <div class="card">
        <div class="title">${titleLine}</div>
        <div class="section">
          <div class="section-title">📊 概览</div>
          ${overviewHtml}
          ${statusHtml}
        </div>
        ${blownHtml}${swanHtml}${intelHtml}
        <div class="section">
          <div class="section-title">📊 最终市场 · 第 ${lastDay} 天</div>
          ${pairRows}
        </div>
      </div>`

    const plain = `${titleLine}\n起始 ¥${fmt(startEquity)} → 结束 ¥${fmt(endEquity)} (${pct(profitRate)})`

    return replyFxImage(e, html, plain)
  }

  async bPlan(e) {
    const uid = String(e.user_id)
    const gid = getEventGid(e)
    const soloAcc = await getSoloAccount(uid)
    if (!soloAcc) return e.reply("❎ 请先发送 #开户")

    const lb = soloAcc.lastBlowup
    if (!lb) {
      return e.reply(
        `❎ 你还没爆过仓，没到启动B计划的时候\n` +
        `（B计划是爆仓后的最后手段）`
      )
    }

    const now = Date.now()
    const withinWindow = (now - lb.time) < CONFIG.bPlanWindowMs
    const alreadyUsed = (soloAcc.lastBPlanAt || 0) >= lb.time

    if (!withinWindow) {
      return e.reply(
        `❎ 已经过了 5 分钟的B计划窗口\n` +
        `（B计划只在爆仓后 5 分钟内可用）`
      )
    }
    if (alreadyUsed) {
      return e.reply(`❎ 这次爆仓的B计划已经用过了\n下次爆仓再说`)
    }

    const balance = soloAcc.balance || 0
    if (balance < CONFIG.bPlanMinBalance) {
      return e.reply(
        `❎ 余额不足 ¥${CONFIG.bPlanMinBalance}，没什么可押的了\n` +
        `（先去 #打工 / #领补助 攒点本金吧）`
      )
    }

    soloAcc.balance = 0
    soloAcc.lastBPlanAt = now
    soloAcc.bPlanCount = (soloAcc.bPlanCount || 0) + 1

    const roll = Math.random()
    let multiplier = 0
    let resultType = "bust"

    if (roll < 0.70) {
      multiplier = 0; resultType = "bust"
    } else if (roll < 0.95) {
      multiplier = 2; resultType = "win"
    } else if (roll < 0.99) {
      multiplier = 3; resultType = "win"
    } else {
      multiplier = 10; resultType = "jackpot"
    }

    const payout = Math.floor(balance * multiplier)
    soloAcc.balance = payout
    if (resultType === "bust") soloAcc.balance = 0

    await saveSoloAccount(uid, soloAcc, gid)
    await refreshRank(e, uid, gid)

    let npcMsg = ""
    if (isGroup(e)) {
      const npc = getGroupNpc()
      if (npc.id === "kurumi") {
        if (resultType === "jackpot") npcMsg = `\n\n久留美：「我就知道你能做到！」`
        else if (resultType === "win") npcMsg = `\n\n久留美：「不错嘛。」`
        else npcMsg = `\n\n久留美：「……来吧，天台我等你。」`
      } else if (npc.id === "mochiko") {
        if (resultType === "bust") npcMsg = `\n\n萌智子：「我早就劝过你了……\n……我说什么来着。\n不过，你也没别的选择，对吧。」`
		else if (resultType === "jackpot") npcMsg = `\n\n萌智子：「哦？居然真的成了。下次记得加码。」`
        else npcMsg = `\n\n萌智子：「赢了？见好就收，这次是运气。\n……或者说，你才赚这么点就高兴了？」`
      } else if (npc.id === "mebuki") {
        if (resultType === "jackpot") npcMsg = `\n\n芽吹：「哇！你比我强多了！教教我！」`
        else if (resultType === "bust") npcMsg = `\n\n芽吹：「我懂……我也试过……后来我又借了钱继续玩。」`
		else npcMsg = `\n\n芽吹：「这就赢了？那我下次也这么押。」`
      } else if (npc.id === "anko") {
        npcMsg = `\n\n安子：「唉……」`
      }
    }

    const startTalk = pick(BPLAN_TALK_START)
    const resultTalk = pick(BPLAN_TALK_RESULT[resultType])

    let resultHeader, resultIcon
    if (resultType === "jackpot") { resultHeader = "🎊 B计划 · 大成功"; resultIcon = "💰💰💰" }
    else if (resultType === "win") { resultHeader = "✅ B计划 · 成功"; resultIcon = "💰" }
    else { resultHeader = "💀 B计划 · 失败"; resultIcon = "☠️" }

    let text = `${resultIcon} ${resultHeader}\n`
    text += `━━━━━━━━━━━━━━\n`
    text += `久留美：「${startTalk}」\n\n`
    text += `押上全部：¥${fmt(balance)}\n`
    if (multiplier === 0) {
      text += `结果：全部赔光\n\n`
    } else {
      text += `结果：× ${multiplier} 倍\n`
      text += `收获：¥${fmt(payout)}\n\n`
    }
    text += resultTalk + `\n\n`
    text += `当前余额：¥${fmt(soloAcc.balance)}`
    text += npcMsg
    return e.reply(text)
  }

  async work(e) {
    const uid = String(e.user_id)
    const gid = getEventGid(e)
    const soloAcc = await getSoloAccount(uid)
    if (!soloAcc) return e.reply("❎ 请先发送 #开户")

    const now = Date.now()
    const elapsed = now - (soloAcc.lastWorkAt || 0)
    if (elapsed < CONFIG.workCdMs) {
      const remain = Math.ceil((CONFIG.workCdMs - elapsed) / 60000)
      return e.reply(`😮‍💨 你刚下过班，累得抬不起手\n下次可打工：${remain} 分钟后`)
    }

    const job = pick(JOBS)
    const base = _.random(job.pay[0], job.pay[1])
    const roll = Math.random()
    let finalPay = base
    let eventEmoji = "💼"
    let talk = pick(WORK_TALK_OK)

    if (roll < 0.10) { finalPay = base * 2; eventEmoji = "🔥"; talk = pick(WORK_TALK_OVER) }
    else if (roll < 0.22) { finalPay = Math.max(100, Math.floor(base * 0.5)); eventEmoji = "😩"; talk = pick(WORK_TALK_BAD) }
    else if (roll < 0.27) { finalPay = base * 3; eventEmoji = "🎉"; talk = pick(WORK_TALK_JACKPOT) }

    soloAcc.balance += finalPay
    soloAcc.lastWorkAt = now
    soloAcc.workCount = (soloAcc.workCount || 0) + 1
    await saveSoloAccount(uid, soloAcc, gid)
    await refreshRank(e, uid, gid)

    let npcMsg = ""
    if (isGroup(e) && Math.random() < 0.30) {
      const npc = getGroupNpc()
      if (npc.id === "mebuki") { 
	      npcMsg = 
			  `\n\n芽吹：「咦，你也在这……？
			  \n${pick([...(npc.workTalk || [])])}」`+
		      `\n我跟你说，我昨天借钱又梭了一把。
		      \n（她一边说一边继续站在你旁边假装若无其事
		      \n……但是身上的工作服暴露了一切。）`		  
	  }
      else if (npc.id === "kurumi") {
		  npcMsg = 
		    `\n\n久留美：「${pick([
	    	"打工？那玩意儿能赚几个钱。",
		    "FX，简单。你却在这搬砖。",
		    "别干了。来赌一把。",
			])}」`
      }
      else if (npc.id === "mochiko") {     
          npcMsg = 
	    	`\n\n萌智子：「${pick([
		    "踏实工作挺好的。\n当然，那是给普通人说的。", 
		    "打工？你也就这点出息了。", 
	        "打这么多工，也赚不到一把梭的钱。",
		    "你打工的钱，够你亏几次？",
		    ])}」`
      }
      else if (npc.id === "anko") npcMsg = `\n\n安子：「辛苦了。要不要来跟我一起画画？」`
    }

    return e.reply(
      `${eventEmoji} 打工结束 · ${job.name}\n━━━━━━━━━━━━━━\n` +
      `${talk}\n\n收入：+¥${fmt(finalPay)}\n` +
      `余额：¥${fmt(soloAcc.balance)}\n` +
      `累计打工：${soloAcc.workCount} 次\n` +
      `━━━━━━━━━━━━━━\n下次可打工：4 小时后` + npcMsg
    )
  }

  async peek(e) {
    const myUid = String(e.user_id)
    const gid = getGid(e)

    let targetUid = null
    if (e.at) targetUid = String(e.at)
    else {
      const m = String(e.msg).match(/^#?视奸\s+(.+)$/)
      if (m && m[1]) {
        const numMatch = m[1].match(/\d{5,12}/)
        if (numMatch) targetUid = numMatch[0]
      }
    }
    if (!targetUid) targetUid = myUid

    const isSelf = targetUid === myUid
    const soloAcc = await getSoloAccount(targetUid)
    if (!soloAcc) {
      return e.reply(isSelf ? "❎ 你还没开户，发送 #开户" : "❎ 对方还没开户，没法看")
    }

    const sharedAcc = isGroup(e) ? await getSharedAccount(gid, targetUid) : null
    const nick = isSelf ? "你自己" : await getNick(e, targetUid)
    const overall = await calcOverall(isGroup(e) ? gid : null, targetUid, soloAcc, sharedAcc)
    const profit = overall.equity - CONFIG.initialMoney
    const rate = (profit / CONFIG.initialMoney) * 100
    const profitCls = profit >= 0 ? "up" : "down"

    let overviewHtml = `
      <div class="row"><span class="label">净值</span>
        <span class="value ${profitCls}">¥${fmt(overall.equity)} (${pct(rate)})</span></div>
      <div class="row"><span class="label">余额</span>
        <span class="value">¥${fmt(soloAcc.balance)}</span></div>`
    if (soloAcc.debt > 0) overviewHtml += `
      <div class="row"><span class="label">负债</span>
        <span class="value danger">¥${fmt(soloAcc.debt)}</span></div>`
    if (soloAcc.loan) overviewHtml += `
      <div class="row"><span class="label">未还借款</span>
        <span class="value warn">¥${fmt(soloAcc.loan.amount)}</span></div>`
    if (soloAcc.stats?.pendingStealDebt > 0) overviewHtml += `
      <div class="row"><span class="label">待还赃</span>
        <span class="value warn">¥${fmt(soloAcc.stats.pendingStealDebt)}</span></div>`
    if (soloAcc.intel) overviewHtml += `
      <div class="row"><span class="label">情报</span>
        <span class="value">手中攥着一份</span></div>`

    const statsHtml = `
      <div class="row"><span class="label">爆仓 / 破产 / 天台</span>
        <span class="value">${soloAcc.blowups || 0} / ${soloAcc.bankruptCount || 0} / ${soloAcc.rooftopCount || 0}</span></div>
      <div class="row"><span class="label">打工 / B计划 / 偷钱</span>
        <span class="value">${soloAcc.workCount || 0} / ${soloAcc.bPlanCount || 0} / ${soloAcc.stats?.stealCount || 0}</span></div>
      <div class="row"><span class="label">当前连胜/连败</span>
        <span class="value">${soloAcc.consecutiveWins || 0} / ${soloAcc.consecutiveLosses || 0}</span></div>`

    // 独立场持仓
    const soloPositions = Object.values(soloAcc.positionsSolo || {})
    let soloPosHtml = ""
    if (soloPositions.length) {
      const soloMarket = await getSoloMarket(targetUid)
      soloPosHtml = soloPositions.map(pos => {
        const pair = PAIRS.find(p => p.code === pos.code)
        return `<div class="pos-box">
          <div class="pos-head">
            <span>${pos.side === "long" ? "📈" : "📉"} ${pair.alias}</span>
            <span class="tag">${pos.leverage}×</span>
          </div>
          <div class="row"><span class="label">押注 / 名义</span>
            <span class="value">¥${fmt(pos.margin)} / ¥${fmt(pos.notional)}</span></div>
          <div class="row"><span class="label">开仓价</span>
            <span class="value">${priceStr(pos.avgPrice, pair.precision)}</span></div>
        </div>`
      }).join("")
    } else {
      soloPosHtml = `<div class="muted">空仓</div>`
    }

    // 共享场持仓
    let sharedPosHtml = ""
    if (isGroup(e)) {
      const sharedPositions = Object.values(sharedAcc?.positionsShared || {})
      if (sharedPositions.length) {
        const sharedMarket = await getSharedMarket(gid)
        sharedPosHtml = sharedPositions.map(pos => {
          const pair = PAIRS.find(p => p.code === pos.code)
          const cur = sharedMarket[pos.code]?.price
          const pnl = cur ? calcPnL(pos, cur) : 0
          const cls = pnl >= 0 ? "up" : "down"
          return `<div class="pos-box">
            <div class="pos-head">
              <span>${pos.side === "long" ? "📈" : "📉"} ${pair.alias}
                <span class="tag">${pos.leverage}×</span></span>
              <span class="${cls}">${pnl >= 0 ? "+" : ""}¥${fmt(pnl)}</span>
            </div>
            <div class="row"><span class="label">开仓 → 现价</span>
              <span class="value">${priceStr(pos.avgPrice, pair.precision)} → ${priceStr(cur, pair.precision)}</span></div>
          </div>`
        }).join("")
      } else {
        sharedPosHtml = `<div class="muted">空仓</div>`
      }
    }

    // 最近爆仓
    let blowupHtml = ""
    if (soloAcc.blowups && soloAcc.lastBlowup) {
      const lb = soloAcc.lastBlowup
      const time = new Date(lb.time).toLocaleString("zh-CN")
      const modeLabel = lb.mode ? (MODE_LABEL[lb.mode] || lb.mode) : "未知"
      blowupHtml = `<div class="section">
        <div class="section-title danger">💀 最近爆仓</div>
        <div class="row"><span class="label">时间</span><span class="value">${time}</span></div>
        <div class="row"><span class="label">市场</span><span class="value">${modeLabel}</span></div>
        <div class="row"><span class="label">当时亏损</span>
          <span class="value danger">${lb.pnl >= 0 ? "+" : ""}¥${fmt(lb.pnl)}</span></div>
      </div>`
    }

    const html = `
      <div class="card">
        <div class="title">👀 ${isSelf ? '你自己' : `视奸 ${nick}`}</div>
        <div class="section">
          <div class="section-title">💰 账户概览</div>
          ${overviewHtml}
        </div>
        <div class="section">
          <div class="section-title">📈 战绩</div>
          ${statsHtml}
        </div>
        <div class="section">
          <div class="section-title">📊 独立场持仓</div>
          ${soloPosHtml}
          <div class="muted" style="margin-top:8px">独立场行情是私密的，不显示盈亏</div>
        </div>
        ${isGroup(e) ? `<div class="section">
          <div class="section-title">📊 共享场持仓</div>
          ${sharedPosHtml}
        </div>` : ""}
        ${blowupHtml}
      </div>`

    return replyFxImage(e, html,
      `👀 ${nick} 净值 ¥${fmt(overall.equity)} (${pct(rate)})`
    )
  }

  async joinShared(e) {
    if (!isGroup(e)) return e.reply("❎ 共享场只能在群聊里玩")
    const gid = getGid(e)
    const uid = String(e.user_id)

    const { acc: soloAcc, created: soloCreated } = await ensureSoloAccount(uid, e.group_id)
    const { created: sharedCreated } = await ensureSharedAccount(gid, uid)

    const isActive = await RS.sismember(K_ACTIVE(gid), uid)
    if (isActive) return e.reply(`❎ 你已经在本群共享场活跃名单里了\n发送 #共享玩家 查看当前活跃名单`)

    await RS.sadd(K_ACTIVE(gid), uid)
    const active = await RS.smembers(K_ACTIVE(gid))
    await refreshRank(e, uid, e.group_id)

    let extra = ""
    if (soloCreated) extra += `\n\n📌 已顺手帮你开了独立场账户\n初始资金：¥${fmt(soloAcc.balance)}`
    if (sharedCreated && !soloCreated) extra += `\n\n📌 已顺手帮你开了本群共享场账户`

    return e.reply(
      `✅ 已加入本群共享场\n━━━━━━━━━━━━━━\n当前活跃玩家：${active.length} 人\n\n` +
      `共享场规则：\n· 过半人数投票即推进\n· 取已投票人里的最小天数\n` +
      `· 你暂时不玩可以发 #退出共享 挂机\n· 共享场和独立场共用一个钱包\n` +
      `· 两个场都空仓时会自动退出活跃名单\n\n` +
      `⚠️ 温馨提示：\n` +
      `共享场是「共进退」的，行情全群共用一份。\n` +
      `只要过半群友投了票，就算你没投，\n` +
      `也会被推进 —— 这是回合制的兜底，\n` +
      `最多被推几天，不会「天塌」。` + extra
    )
  }

  async quitShared(e) {
    if (!isGroup(e)) return e.reply("❎ 共享场只能在群聊里玩")
    const gid = getGid(e)
    const uid = String(e.user_id)
    const isMember = await RS.sismember(K_ACTIVE(gid), uid)
    if (!isMember) return e.reply("❎ 你本来就不在本群共享场活跃名单里")

    await RS.srem(K_ACTIVE(gid), uid)
    const votes = await getSharedVotes(gid)
    if (votes[String(uid)] !== undefined) {
      delete votes[String(uid)]
      await setSharedVotes(gid, votes)
    }

    const active = await RS.smembers(K_ACTIVE(gid))
    return e.reply(
      `✅ 已退出本群共享场\n━━━━━━━━━━━━━━\n你的共享场持仓仍保留，\n只是不再参与"共同推进"的判定。\n\n` +
      `当前活跃玩家：${active.length} 人\n\n想回来玩随时发 #加入共享`
    )
  }

  async activeList(e) {
    if (!isGroup(e)) return e.reply("❎ 共享场只能在群聊里玩")
    const gid = getGid(e)
    const active = await RS.smembers(K_ACTIVE(gid))
    const votes = await getSharedVotes(gid)
    if (!active.length) return e.reply("📭 本群还没有共享场玩家，发送 #加入共享 参与")

    const N = active.length
    const threshold = voteThreshold(N)
    const votedCount = active.filter(id => votes[String(id)] !== undefined).length

    const lines = []
    for (const uid of active) {
      const nick = await getNick(e, uid)
      const v = votes[String(uid)]
      lines.push(v !== undefined ? `✅ ${nick} — 投 ${v} 天` : `⏳ ${nick}`)
    }

    return e.reply(
      `📋 共享场 · 活跃玩家\n━━━━━━━━━━━━━━\n` +
      `进度：${votedCount} / ${N}（过半 ${threshold} 即推进）\n\n` +
      lines.join("\n") +
      `\n━━━━━━━━━━━━━━\n达到半数即推进，取已投票人的最小值`
    )
  }

  async rooftop(e) {
    const uid = String(e.user_id)
    const gid = getEventGid(e)
    const soloAcc = await getSoloAccount(uid)
    if (!soloAcc) return e.reply("❎ 请先发送 #开户")

    const count = (soloAcc.rooftopCount || 0) + 1
    soloAcc.rooftopCount = count

    const lb = soloAcc.lastBlowup
    let bonus = 0
    let bonusTip = ""
    if (lb) {
      const withinWindow = (Date.now() - lb.time) < CONFIG.rooftopWindowMs
      const alreadyClaimed = (soloAcc.lastRooftopClaim || 0) >= lb.time
      if (withinWindow && !alreadyClaimed) {
        bonus = _.random(CONFIG.rooftopBonusMin, CONFIG.rooftopBonusMax)
        soloAcc.balance += bonus
        soloAcc.lastRooftopClaim = Date.now()
        bonusTip = `\n\n💰 天台补助：+¥${fmt(bonus)}\n（雪中送炭，别想不开）`
      } else if (alreadyClaimed) {
        bonusTip = `\n\n（这次爆仓的补助已经领过了）`
      } else if (!withinWindow) {
        bonusTip = `\n\n（已经过了 5 分钟的补助窗口）`
      }
    } else {
      bonusTip = `\n\n（你还没爆过仓，没得领）`
    }

    await saveSoloAccount(uid, soloAcc, gid)
    await refreshRank(e, uid, gid)

    const npc = isGroup(e) ? getGroupNpc() : null
    let talk
    if (count >= 10) talk = pick(ROOFTOP_TALKS.veteran)
    else if (count >= 3) talk = pick(ROOFTOP_TALKS.repeat)
    else talk = pick(ROOFTOP_TALKS.first)

    if (npc?.id === "kurumi" && Math.random() < 0.50) {
      // 混入母亲相关台词
      const motherPool = [
        "🌃 久留美：「我妈也来过这里。2000 万。」",
        "🌃 久留美：「你知道 2000 万日元是什么感觉吗？我妈知道。」",
        "🌃 久留美：「我一直在想，如果那天我劝住她……算了，我也没资格劝你。」",
        "🌃 久留美：「FX，简单。简单到能让人从这里跳下去。」"
      ]
      talk = pick([...ROOFTOP_TALKS.kurumiSpecial, ...motherPool])
    }

    return e.reply(
      `🌃 第 ${count} 次上天台\n━━━━━━━━━━━━━━\n${talk}\n━━━━━━━━━━━━━━\n` +
      `（爆仓次数：${soloAcc.blowups || 0}）` + bonusTip
    )
  }

async bankruptcy(e) {
  const uid = String(e.user_id)
  const gid = getEventGid(e)
  const soloAcc = await getSoloAccount(uid)
  if (!soloAcc) return e.reply("❎ 请先发送 #开户")

        const totalDebt = (soloAcc.debt || 0) + (soloAcc.loan?.amount || 0)
    const balance = soloAcc.balance || 0

    // 如果没负债，且余额还能下注（≥最低下注额），才拒绝破产
    if (totalDebt <= 0 && balance >= CONFIG.minAmount) {
      return e.reply(
        `❎ 你当前账户还有 ¥${fmt(balance)}\n` +
        `（至少要输到连 ¥${fmt(CONFIG.minAmount)} 都凑不齐，才能申请破产重开）\n` +
        `发送 #余额 查看资产，或去 #打工 赚点本金`
      )
    }

  const now = Date.now()
  if (now - (soloAcc.lastBankruptcy || 0) < 24 * 3600 * 1000) {
    const remain = Math.ceil((24 * 3600 * 1000 - (now - soloAcc.lastBankruptcy)) / 3600000)
    return e.reply(`❎ 破产申请冷却中，还需 ${remain} 小时`)
  }

  const oldDebt = totalDebt
  soloAcc.debt = 0
  soloAcc.loan = null                    // ← 关键：破产时一并清除借款
  soloAcc.balance = CONFIG.bankruptcyReset
  soloAcc.positionsSolo = {}
  soloAcc.bankruptCount = (soloAcc.bankruptCount || 0) + 1
  soloAcc.lastBankruptcy = now

  soloAcc.stats = soloAcc.stats || defaultStats()
  soloAcc.stats.totalUnpaidDebt = (soloAcc.stats.totalUnpaidDebt || 0) + oldDebt
  soloAcc.stats.pendingStealDebt = 0
  soloAcc.stats.stealUsedThisCycle = false

    await saveSoloAccount(uid, soloAcc, gid)
    await refreshRank(e, uid, gid)

    const npc = isGroup(e) ? getGroupNpc() : null
    let extra = ""
    if (npc?.id === "mochiko") {
      extra = `\n\n萌智子：「${pick([
        "破产不是终点。我见过比你更惨的。（不过你也快了。）",
        "破产而已。我认识的人里，破产的比没破产的还多。再借就是了。",
        "恭喜清零。你现在，又可以从零开始了。",
		"恭喜，你离自由更近了。",
        "没事。重生才是赌狗的宿命。",
      ])}」`
    }
    else if (npc?.id === "mebuki") extra = `\n\n芽吹：「你比我强，我破产的时候还在按摩店打工……哦不对，我没打过工。」`

    let clearText = `免除负债：¥${fmt(oldDebt)}\n`
    if (oldDebt === 0) {
      clearText = `账户清零，免除负债：无\n`
    }

    return e.reply(
      `💀 个人破产申请成功\n━━━━━━━━━━━━━━\n` +
      clearText +
      `余额重置：¥${fmt(CONFIG.bankruptcyReset)}\n` +
      `累计破产：${soloAcc.bankruptCount} 次\n` +
      `━━━━━━━━━━━━━━\n` +
      `久留美：「我当年欠了一亿多，也是这么过来的。」\n` +
      `（拿着这 1 万块，去天台吹吹风，冷静一下吧。）` + extra
    )
  }

  async borrowMoney(e) {
    const uid = String(e.user_id)
    const gid = getEventGid(e)
    const soloAcc = await getSoloAccount(uid)
    if (!soloAcc) return e.reply("❎ 请先发送 #开户")

    if (soloAcc.loan) {
      return e.reply(
        `❎ 你已有一笔借款未还\n` +
        `金额：¥${fmt(soloAcc.loan.amount)}\n` +
        `到期时间：${new Date(soloAcc.loan.dueTime).toLocaleString("zh-CN")}\n` +
        `发送 #还债 还款`
      )
    }

    if (soloAcc.debt > 0) return e.reply("❎ 你已有负债，无法再借款\n发送 #个人破产 处理")

    soloAcc.balance += CONFIG.loanAmount
    soloAcc.loan = {
      amount: CONFIG.loanAmount,
      dueTime: Date.now() + CONFIG.loanDueMs,
      borrowedAt: Date.now()
    }
    await saveSoloAccount(uid, soloAcc, gid)
    await refreshRank(e, uid, gid)

    const npc = isGroup(e) ? getGroupNpc() : null
    let talk = `芽吹：「没钱了？我这里有办法。」`
    if (npc?.id === "mebuki") talk = pick(npc.loanTalk)

    return e.reply(
      `💰 借款成功\n━━━━━━━━━━━━━━\n` +
      `借款金额：¥${fmt(CONFIG.loanAmount)}\n` +
      `到期时间：${new Date(soloAcc.loan.dueTime).toLocaleString("zh-CN")}\n` +
      `日息：${(CONFIG.loanDailyRate * 100).toFixed(2)}%\n` +
      `━━━━━━━━━━━━━━\n${talk}\n` +
      `芽吹：「记得还哦。不还的话……后果自负。」`
    )
  }

  async repayLoan(e) {
    const uid = String(e.user_id)
    const gid = getEventGid(e)
    const soloAcc = await getSoloAccount(uid)
    if (!soloAcc) return e.reply("❎ 请先发送 #开户")
    if (!soloAcc.loan) return e.reply("❎ 你当前没有借款")

    const loan = soloAcc.loan
    if (soloAcc.balance < loan.amount) {
      return e.reply(`❎ 余额不足\n需要：¥${fmt(loan.amount)}\n你有：¥${fmt(soloAcc.balance)}`)
    }

    soloAcc.balance -= loan.amount
    soloAcc.loan = null
    await saveSoloAccount(uid, soloAcc, gid)
    await refreshRank(e, uid, gid)

    return e.reply(
      `✅ 还债成功\n━━━━━━━━━━━━━━\n` +
      `还款：¥${fmt(loan.amount)}\n` +
      `余额：¥${fmt(soloAcc.balance)}\n\n` +
      `芽吹：「不错，你有信用。」`
    )
  }

  async dailyWatch(e) {
    const uid = String(e.user_id)
    const gid = getEventGid(e)
    const soloAcc = await getSoloAccount(uid)
    if (!soloAcc) return e.reply("❎ 请先发送 #开户")

    const today = new Date().toLocaleDateString("zh-CN")
    if (soloAcc.lastWatch === today) {
      return e.reply("❎ 今天已经盯过盘了，明天再来")
    }
    soloAcc.lastWatch = today

    const roll = Math.random()
    let money = 0
    let intel = null
    let resultType = "none"

    if (roll < CONFIG.watchProbMoney) { money = _.random(800, 2500); resultType = "money" }
    else if (roll < CONFIG.watchProbIntel) { intel = generateIntel(); resultType = "intel" }
    else if (roll < CONFIG.watchProbBoth) { money = _.random(500, 1500); intel = generateIntel(); resultType = "both" }

    if (money > 0) soloAcc.balance += money
    if (intel) soloAcc.intel = intel
    await saveSoloAccount(uid, soloAcc, gid)
    if (money > 0) await refreshRank(e, uid, gid)

    let npcMsg = ""
    if (Math.random() < 0.50 && isGroup(e)) {
      const npc = getGroupNpc()
      if (npc.id === "kurumi") npcMsg = `\n\n久留美：「盯盘不如梭哈，你懂的。」`
      else if (npc.id === "mochiko") {
        const pool = ["今天没操作？好事。", "今天没动？胆子真小。", "光盯盘不下单，不如不看。"]
        npcMsg = `\n\n萌智子：「${pick(pool)}」`
      }
      else if (npc.id === "mebuki") npcMsg = `\n\n芽吹：「${pick(npc.tipTalk)}」`
      else if (npc.id === "anko") npcMsg = `\n\n安子：「看再多也不如不动。」`
    }

    let text = `📊 盯盘结束\n━━━━━━━━━━━━━━\n${pick(DAILY_WATCH)}\n\n`

    if (resultType === "money") {
      text += `💰 意外收获：+¥${fmt(money)}\n（今天行情看对了一点点）`
    } else if (resultType === "intel") {
      text += `💡 你隐约感觉：${intel.alias} 下次可能会${intel.dir > 0 ? "涨" : "跌"}\n（下次 #独下一天 时生效）`
    } else if (resultType === "both") {
      text += `💰 意外收获：+¥${fmt(money)}\n`
      text += `💡 你隐约感觉：${intel.alias} 下次可能会${intel.dir > 0 ? "涨" : "跌"}\n（情报下次 #独下一天 时生效）`
    } else {
      text += `今天什么也没发生。\n（只是又一个平淡的下午）`
    }

    text += `\n\n当前余额：¥${fmt(soloAcc.balance)}`
    text += npcMsg
    return e.reply(text)
  }

  async myNpc(e) {
    if (!isGroup(e)) return e.reply("❎ 只能在群聊里查看")
    const styleDesc = {
      "激进": "连亏时鼓励你加注，梭哈时欢呼，\n名言：老实赚钱，很枯燥吧？现在买入，一定爆赚！",
      "理性&双面": "维持率低时提醒你砍仓，盈利时劝你收手；\n冷静时疯狂怂恿你梭哈，快爆仓时劝你砍仓。\n两种人格无缝切换",
      "直觉&笨蛋": "随机推荐货币对，有时对有时错。\n啥也不懂就梭，参考久留美操作，名言：打工是不可能的（大概）",
      "保守": "4人里唯一正常人，领补助时有概率额外奖励"
    }
    const list = NPC_LIST
      .map(n => `· ${n.name}（${n.style}）— ${styleDesc[n.style] || "神秘角色"}`)
      .join("\n")
    return e.reply(
      `👤 本群 NPC（每次事件随机）\n━━━━━━━━━━━━━━\n${list}\n\n` +
      `开仓 / 加仓 / 平仓 / 爆仓 / 打工 / 盯盘时，\n随机一位会出来说句话。`
    )
  }

  async nextDay(e) {
    const mode = getMode(e)
    if (!mode) return false
    const gid = getGid(e)
    const uid = String(e.user_id)
    const eventGid = getEventGid(e)

    const soloAcc = await getSoloAccount(uid)
    if (!soloAcc) return e.reply("❎ 请先发送 #开户")
    if (soloAcc.debt > 0 && !soloAcc.loan) {
      return e.reply(
        `💀 你已负债 ¥${fmt(soloAcc.debt)}，无法操作\n` +
        `发送 #个人破产 申请免除债务，或 #还债 还款`
      )
    }
    if (mode === "shared" && !isGroup(e)) return e.reply("❎ 共享场只能在群聊里玩")

    if (mode === "solo") {
      const day = await redis.incr(K_SOLO_DAY(uid))
      const market = await tickMarket(null, uid, "solo")

      let intelResult = null
      if (soloAcc.intel) {
        const st = market[soloAcc.intel.code]
        if (st) {
          const before = st.price
          st.price = st.price * (1 + soloAcc.intel.drift)
          st.history[st.history.length - 1] = st.price
          intelResult = {
            alias: soloAcc.intel.alias,
            code: soloAcc.intel.code,
            drift: soloAcc.intel.drift,
            before,
            after: st.price
          }
          await saveSoloMarket(uid, market)
        }
        soloAcc.intel = null
        await saveSoloAccount(uid, soloAcc, eventGid)
      }

      const swan = await checkBlackSwan(null, uid, "solo", market)
      const blown = await checkStopOut(null, "solo", market, uid, eventGid)
      const soloAccNow = await getSoloAccount(uid)
      const sharedAccNow = isGroup(e) ? await getSharedAccount(gid, uid) : null
      await refreshRank(e, uid, eventGid)
      return this._replyTick(e, "solo", uid, day, market, blown, soloAccNow, sharedAccNow, null, swan, intelResult)
    }

    return this._advanceSharedN(e, 1)
  }

  async _replyTick(e, mode, uid, day, market, blown, soloAcc, sharedAcc, activeCount, swan, intelResult) {
    let title = `📅 ${MODE_LABEL[mode]}场 · 第 ${day} 天 · 收市`
    if (mode === "shared" && activeCount) title += ` · ${activeCount} 人投票`
    if (swan) title += ` · ⚠️ ${swan.eventName}`
    if (intelResult) title += ` · 💡情报生效`
    if (blown.length) title += ` · 💥 爆仓`

    // 货币对（带 OHLC）
    const pairRows = PAIRS.map(p => {
      const st = market[p.code]
      if (!st) return ""
      const chg = change(market, p.code)
      const cls = chg > 0.01 ? "up" : chg < -0.01 ? "down" : ""
      const mark = chg > 0.01 ? "▲" : chg < -0.01 ? "▼" : "━"
      
      // 【修复】把之前漏掉的趋势箭头拿回来
      const trend = trendline(st.history, 14)

      const bar = (Array.isArray(st.ohlc) && st.ohlc.length) ? st.ohlc[st.ohlc.length - 1] : null
      let ohlcLine = ""
      let ampStr = ""
      if (bar) {
        const amp = ((bar.h - bar.l) / bar.o) * 100
        ampStr = `振幅 ${amp.toFixed(2)}%`
        ohlcLine = `O ${priceStr(bar.o, p.precision)} · H ${priceStr(bar.h, p.precision)} · L ${priceStr(bar.l, p.precision)} · C ${priceStr(bar.c, p.precision)}`
      }

      return `<div class="pair-row" style="flex-direction:column;align-items:flex-start;gap:4px;padding:10px 0;">
        <div style="display:flex;justify-content:space-between;width:100%;font-size:18px;">
          <span class="label" style="font-weight:bold;">${p.alias} <span class="muted" style="font-weight:normal;font-size:14px;">${p.code}</span></span>
          <span class="value ${cls}">${priceStr(st.price, p.precision)}
            <span class="muted" style="font-size:15px;margin-left:6px">${mark} ${Math.abs(chg).toFixed(2)}%</span>
          </span>
        </div>
        <div style="display:flex;justify-content:space-between;width:100%;align-items:center;font-size:13px;color:#888;">
          <span style="letter-spacing:1px;color:#d4af37;opacity:0.8;">${trend}</span>
          <span>${ampStr}</span>
        </div>
        <div class="muted" style="font-size:13px;color:#666;">
          ${ohlcLine}
        </div>
      </div>`
    }).join("")

    // 黑天鹅（多事件版）
    let swanHtml = ""
    if (swan) {
      const items = swan.affected.map(a => `<div class="row">
        <span class="label">${a.pair.alias}</span>
        <span class="value warn">${priceStr(a.oldPrice, a.pair.precision)} → ${priceStr(a.newPrice, a.pair.precision)} (${a.jump >= 0 ? "+" : ""}${(a.jump * 100).toFixed(1)}%)</span>
      </div>`).join("")
      swanHtml = `<div class="section">
        <div class="section-title warn">📰 ${swan.eventName}</div>
        <div class="muted" style="margin-bottom:8px">${swan.eventDesc}</div>
        ${items}
      </div>`
    }

    // 爆仓
    let blownHtml = ""
    if (blown.length) {
      const items = []
      for (const b of blown) {
        const nick = await getNick(e, b.uid)
        items.push(`<div class="row">
          <span class="label">${nick}</span>
          <span class="value danger">${b.count || 1} 仓 · -¥${fmt(Math.abs(b.totalPnL))}</span>
        </div>`)
      }
      blownHtml = `<div class="section">
        <div class="section-title danger">💥 爆仓 ${blown.length} 人</div>
        ${items.join("")}
      </div>`
    }

    // 情报
    const intelHtml = intelResult ? `
      <div class="section">
        <div class="section-title">💡 情报生效</div>
        <div class="row"><span class="label">${intelResult.alias}</span>
          <span class="value ${intelResult.drift >= 0 ? 'up' : 'down'}">${intelResult.drift >= 0 ? "+" : ""}${(intelResult.drift * 100).toFixed(2)}%</span></div>
      </div>` : ""

    // 账户
    const positions = mode === "solo" ? soloAcc?.positionsSolo : sharedAcc?.positionsShared
    let acctHtml = ""
    if (positions && Object.keys(positions).length) {
      const float = calcFloatingPnL(positions, market)
      const used = calcUsedMargin(positions)
      const overall = await calcOverall(mode === "shared" ? getGid(e) : null, uid, soloAcc, sharedAcc)
      const cls = float >= 0 ? "up" : "down"
      let warnBox = ""
      if (overall.rate < CONFIG.warnRate) {
        if (isGroup(e)) {
          const npc = getGroupNpc()
          if (npc.id === "mochiko") {
            const talk = Math.random() < 0.5
              ? pick(npc.warnTalk)
              : pick([
                  "别急着砍。说不定还能回来。",
                  "这个位置砍了？你会后悔的。",
                  "再等等。真的。",
                  "对咯。再加一点，摊平成本。"
                ])
            warnBox = `<div class="quote">萌智子：「${talk}」</div>`
          } else {
            warnBox = `<div class="quote">⚠️ 接近强平\n久留美：「${pick(TALKS.nearBlowup)}」</div>`
          }
        } else {
          warnBox = `<div class="quote">⚠️ 接近强平</div>`
        }
      }
      acctHtml = `<div class="section">
        <div class="section-title">💼 你的账户</div>
        <div class="row"><span class="label">本场浮动</span>
          <span class="value ${cls}">${float >= 0 ? "+" : ""}¥${fmt(float)}</span></div>
        <div class="row"><span class="label">本场占用</span><span class="value">¥${fmt(used)}</span></div>
        <div class="row"><span class="label">总维持率</span>
          <span class="value ${overall.rate < CONFIG.warnRate ? 'warn' : ''}">${isFinite(overall.rate) ? (overall.rate * 100).toFixed(1) + "%" : "—"}</span></div>
        ${soloAcc.debt > 0 ? `<div class="row"><span class="label">负债</span><span class="value danger">¥${fmt(soloAcc.debt)}</span></div>` : ""}
        ${warnBox}
      </div>`
    } else {
      acctHtml = `<div class="section">
        <div class="section-title">💼 你的账户</div>
        <div class="muted">本场当前空仓</div>
      </div>`
    }

    const prefix = mode === "solo" ? "独" : "共"
    const html = `
      <div class="card">
        <div class="title">${title}</div>
        <div class="section">
          <div class="section-title">📊 货币对</div>
          ${pairRows}
        </div>
        ${swanHtml}${blownHtml}${acctHtml}${intelHtml}
        <div class="divider"></div>
        <div class="muted">#${prefix}持仓 看详情 | #${prefix}K线 美日 看K线 | #${prefix}下一天 再来一天</div>
      </div>`

    const plain = `${title}\n` +
      PAIRS.map(p => {
        const st = market[p.code]
        return st ? `${p.alias} ${priceStr(st.price, p.precision)}` : null
      }).filter(Boolean).join(" | ")

    return replyFxImage(e, html, plain)
  }

  async claimSubsidy(e) {
    const uid = String(e.user_id)
    const gid = getEventGid(e)
    const soloAcc = await getSoloAccount(uid)
    if (!soloAcc) return e.reply("❎ 请先发送 #开户")

    const today = new Date().toLocaleDateString("zh-CN")
    if (soloAcc.lastSubsidy === today) return e.reply("❎ 今天已经领过了，明天再来")

    const reward = _.random(CONFIG.subsidyMin, CONFIG.subsidyMax)
    soloAcc.balance += reward
    soloAcc.lastSubsidy = today
    await saveSoloAccount(uid, soloAcc, gid)
    await refreshRank(e, uid, gid)

    let extra = ""
    if (isGroup(e)) {
      const npc = getGroupNpc()
      if (npc.id === "anko" && Math.random() < 0.50) {
        const bonus = _.random(1000, 3000)
        soloAcc.balance += bonus
        await saveSoloAccount(uid, soloAcc, gid)
        await refreshRank(e, uid, gid)
        extra = `\n安子：「稳一点好。这是额外给你的 ¥${fmt(bonus)}。」`
      }
    }

    return e.reply(`✅ 补助金到账 ¥${fmt(reward)}\n当前余额：¥${fmt(soloAcc.balance)}` + extra)
  }

  async market(e) {
    const mode = getMode(e)
    if (!mode) return false
    const uid = String(e.user_id)
    const gid = getGid(e)
    const soloAcc = await getSoloAccount(uid)
    if (!soloAcc) return e.reply("❎ 请先发送 #开户")
    if (mode === "shared" && !isGroup(e)) return e.reply("❎ 共享场只能在群聊里玩")

    const m = mode === "solo" ? await getSoloMarket(uid) : await getSharedMarket(gid)
    const day = await getDay(e, mode)
    const prefix = mode === "solo" ? "独" : "共"

    const pairRows = PAIRS.map(p => {
      const st = m[p.code]
      if (!st) return ""
      const chg = change(m, p.code)
      const cls = chg > 0.01 ? "up" : chg < -0.01 ? "down" : ""
      const mark = chg > 0.01 ? "▲" : chg < -0.01 ? "▼" : "━"
      
      // 【修复】把之前漏掉的趋势箭头拿回来
      const trend = trendline(st.history, 14) 
      
      const bar = (Array.isArray(st.ohlc) && st.ohlc.length) ? st.ohlc[st.ohlc.length - 1] : null
      let ohlcLine = ""
      let ampStr = ""
      if (bar) {
        const amp  = ((bar.h - bar.l) / bar.o) * 100
        ampStr = `振幅 ${amp.toFixed(2)}%`
        ohlcLine = `O ${priceStr(bar.o, p.precision)} · H ${priceStr(bar.h, p.precision)} · L ${priceStr(bar.l, p.precision)} · C ${priceStr(bar.c, p.precision)}`
      }

      // 【美化】分三行：品种/价格 | 箭头/振幅 | OHLC
      return `<div class="pair-row" style="flex-direction:column;align-items:flex-start;gap:4px;padding:10px 0;">
        <div style="display:flex;justify-content:space-between;width:100%;font-size:18px;">
          <span class="label" style="font-weight:bold;">${p.alias} <span class="muted" style="font-weight:normal;font-size:14px;">${p.code}</span></span>
          <span class="value ${cls}">${priceStr(st.price, p.precision)}
            <span class="muted" style="font-size:15px;margin-left:6px">${mark} ${Math.abs(chg).toFixed(2)}%</span>
          </span>
        </div>
        <div style="display:flex;justify-content:space-between;width:100%;align-items:center;font-size:13px;color:#888;">
          <span style="letter-spacing:1px;color:#d4af37;opacity:0.8;">${trend}</span>
          <span>${ampStr}</span>
        </div>
        <div class="muted" style="font-size:13px;color:#666;">
          ${ohlcLine}
        </div>
      </div>`
    }).join("")

    const html = `
      <div class="card">
        <div class="title">💹 ${MODE_LABEL[mode]}场 · 第 ${day} 天</div>
        <div class="section">
          <div class="section-title">货币对行情</div>
          ${pairRows}
        </div>
        <div class="divider"></div>
        <div class="muted">#${prefix}K线 美日 看K线图 | #${prefix}看 美日 查详情</div>
      </div>`

    const plain = `💹 ${MODE_LABEL[mode]}场 · 第 ${day} 天\n` +
      PAIRS.map(p => {
        const st = m[p.code]
        if (!st) return null
        const chg = change(m, p.code)
        return `${p.alias} ${priceStr(st.price, p.precision)} (${pct(chg)})`
      }).filter(Boolean).join("\n")

    const result = await replyFxImage(e, html, plain)

    if (isGroup(e) && Math.random() < 0.15) {
      const npc = getGroupNpc()
      const npcMsg = npcInterject(npc, "market")
      if (npcMsg) { try { await e.reply(npcMsg.trim()) } catch {} }
    }
    return result
  }

  async query(e) {
    const mode = getMode(e)
    if (!mode) return false
    const m = e.msg.match(new RegExp(`^#?(独|共)(?:看|查询)\\s*(${PAIR_PATTERN})$`))
    if (!m) return false

    const gid = getGid(e)
    const uid = String(e.user_id)
    const pair = findPair(m[2])
    if (!pair) return e.reply(`❎ 查无此货币对：「${m[2]}」\n发送 #拟股喵喵帮助 查看货币对列表`)
    if (mode === "shared" && !isGroup(e)) return e.reply("❎ 共享场只能在群聊里玩")

    const soloAcc = await getSoloAccount(uid)
    if (!soloAcc) return e.reply("❎ 请先发送 #开户")

    const market = mode === "solo" ? await getSoloMarket(uid) : await getSharedMarket(gid)
    const st = market[pair.code]
    const chg = change(market, pair.code)

    let positions = {}
    if (mode === "solo") positions = soloAcc.positionsSolo
    else positions = (await getSharedAccount(gid, uid))?.positionsShared || {}

    const lines = []
    const longs = positions[posKey(pair.code, "long")]
    const shorts = positions[posKey(pair.code, "short")]
    if (longs) {
      const pnl = calcPnL(longs, st.price)
      lines.push(`   📈 多单 押¥${fmt(longs.margin)} 杠杆${longs.leverage}× @${priceStr(longs.avgPrice, pair.precision)}  ${pnl >= 0 ? "+" : ""}¥${fmt(pnl)}`)
    }
    if (shorts) {
      const pnl = calcPnL(shorts, st.price)
      lines.push(`   📉 空单 押¥${fmt(shorts.margin)} 杠杆${shorts.leverage}× @${priceStr(shorts.avgPrice, pair.precision)}  ${pnl >= 0 ? "+" : ""}¥${fmt(pnl)}`)
    }
    let extra = ""
    if (lines.length) extra = `\n━━━━━━━━━━━━━━\n💼 本场持仓\n` + lines.join("\n")

    let intelTip = ""
    if (mode === "solo" && soloAcc.intel && soloAcc.intel.code === pair.code) {
      intelTip = `\n💡 你有情报：${pair.alias} 下次可能会${soloAcc.intel.dir > 0 ? "涨" : "跌"}`
    }

    const slice = st.history.slice(-21)
    return e.reply(
      `${arrow(chg)} ${pair.name} · ${MODE_LABEL[mode]}场\n━━━━━━━━━━━━━━\n` +
      `代码：${pair.code}　别名：${pair.alias}\n` +
      `现价：${priceStr(st.price, pair.precision)}  ${pct(chg)}\n` +
      `基准：${priceStr(pair.price, pair.precision)}\n` +
      `波动率：${(pair.volatility * 100).toFixed(2)}%\n` +
      `━━━━━━━━━━━━━━\n` +
      `${overallTrend(slice)} ${trendline(st.history, 20)}\n` +
      `（⇈大涨 ↗小涨 →平 ↘小跌 ⇊大跌）` +
      intelTip + extra
    )
  }

  async kline(e) {
    const mode = getMode(e)
    if (!mode) return false
    const m = e.msg.match(new RegExp(`^#?(?:独|共)(?:K线|k线|K图|蜡烛图)\\s*(${PAIR_PATTERN})$`))
    if (!m) return false
    const pair = findPair(m[1])
    if (!pair) return e.reply(`❎ 查无此货币对：「${m[1]}」\n发送 #拟股喵喵帮助 查看货币对列表`)
    if (mode === "shared" && !isGroup(e)) return e.reply("❎ 共享场只能在群聊里玩")

    const uid = String(e.user_id)
    const gid = getGid(e)
    const soloAcc = await getSoloAccount(uid)
    if (!soloAcc) return e.reply("❎ 请先发送 #开户")

    const market = mode === "solo" ? await getSoloMarket(uid) : await getSharedMarket(gid)
    const st = market[pair.code]
    if (!st || !st.ohlc) return e.reply("❎ 行情数据缺失，请稍后再试")

    const day = await getDay(e, mode)
    const html = buildKlineHtml(pair, st.ohlc, { mode, day })
    return replyFxImage(e, html, `📊 ${pair.alias} K线（第 ${day} 天）`)
  }

  async _openPosition(e, side) {
    const mode = getMode(e)
    if (!mode) return false
    const gid = getGid(e)
    const uid = String(e.user_id)
    const eventGid = getEventGid(e)

    if (mode === "shared" && !isGroup(e)) return e.reply("❎ 共享场只能在群聊里玩")
    if (mode === "shared") {
      const isActive = await RS.sismember(K_ACTIVE(gid), uid)
      if (!isActive) return e.reply(`❎ 你当前不在共享场活跃名单\n发送 #加入共享 参与共同推进`)
    }
    if (isUserBusy(uid)) return e.reply("⚠️ 操作太快啦，喘口气再试")

    const verb = side === "long" ? "(?:做多|押涨|买入)" : "(?:做空|押跌|卖出)"
    const re = new RegExp(`^#?(?:独|共)${verb}\\s*(${PAIR_PATTERN})\\s*(\\d+(?:\\.\\d+)?)(?:\\s+(${LEV_PATTERN}))?$`)
    const m = e.msg.match(re)
    if (!m) return false

    const pair = findPair(m[1])
    // ⚠️ 玩家输入的是押注金额（保证金），不是名义价值
    const margin = parseFloat(m[2])
    const leverage = parseLeverage(m[3])

    if (!pair) return e.reply(`❎ 查无此货币对：「${m[1]}」\n发送 #拟股喵喵帮助 查看货币对列表`)
    if (leverage === null || leverage < 1 || leverage > CONFIG.maxLeverage) {
      return e.reply(`❎ 杠杆必须在 1 ~ ${CONFIG.maxLeverage} 之间\n可用别名：稳/中/梭/疯`)
    }
    if (margin < CONFIG.minAmount) return e.reply(`❎ 押注金额不能小于 ¥${fmt(CONFIG.minAmount)}`)
    if (margin > CONFIG.maxAmount) return e.reply(`❎ 押注金额不能大于 ¥${fmt(CONFIG.maxAmount)}`)

    const notional = margin * leverage

    const soloAcc = await getSoloAccount(uid)
    if (!soloAcc) return e.reply("❎ 请先发送 #开户")

    if (soloAcc.debt > 0 && !soloAcc.loan) {
      return e.reply(
        `💀 你已负债 ¥${fmt(soloAcc.debt)}，无法开新仓\n` +
        `发送 #个人破产 申请免除债务`
      )
    }

    let sharedAcc = null
    if (mode === "shared") sharedAcc = await getSharedAccount(gid, uid)
    if (mode === "shared" && !sharedAcc) return e.reply("❎ 共享场账户不存在，请发送 #加入共享")

    const market = mode === "solo" ? await getSoloMarket(uid) : await getSharedMarket(gid)
    const price = market[pair.code].price

    const overall = await calcOverall(mode === "shared" ? gid : null, uid, soloAcc, sharedAcc)
    if (overall.free < margin) {
      let hint = ""
      if (!soloAcc.stats?.stealUsedThisCycle
          && soloAcc.balance < CONFIG.bankruptcyReset
          && soloAcc.debt === 0) {
        hint = `\n\n💡 你已经穷途末路了\n` +
               `要不要试试 #偷钱 ？\n` +
               `（久留美偷她爸私房钱的招数）\n` +
               `⚠️ 50% 概率失败，失败强制破产`
      }
      return e.reply(
        `❎ 可用余额不足\n需要：¥${fmt(margin)}\n总可用：¥${fmt(overall.free)}\n` +
        `（独立场占用 ¥${fmt(overall.soloUsed)}、共享场占用 ¥${fmt(overall.sharedUsed)}）` +
        hint
      )
    }

    const positions = mode === "solo" ? soloAcc.positionsSolo : sharedAcc.positionsShared
    const key = posKey(pair.code, side)
    const reverseKey = posKey(pair.code, side === "long" ? "short" : "long")

    // 禁止同一货币对反向对开
    // 否则会形成无风险套利：一边爆仓封顶亏损，另一边无限盈利
    if (positions[reverseKey]) {
      const sideLabel = side === "long" ? "空" : "多"
      return e.reply(
        `❎ 你已持有 ${pair.alias} 的${sideLabel}仓\n` +
        `不能同时开反向仓位\n\n` +
        `想换方向请先平仓：\n` +
        `#${mode === "solo" ? "独" : "共"}平 ${pair.alias}`
      )
    }

    if (positions[key] && positions[key].leverage !== leverage) {
      return e.reply(
        `❎ 加仓杠杆必须与原仓位一致\n` +
        `━━━━━━━━━━━━━━\n` +
        `原仓位：${positions[key].leverage}×\n` +
        `本次输入：${leverage}×\n\n` +
        `如果想换杠杆，请先平掉原仓位：\n` +
        `#${mode === "solo" ? "独" : "共"}平 ${pair.alias}`
      )
    }

    const isAddOn = !!positions[key]
    if (isAddOn) {
      const p = positions[key]
      const oldNotional = p.notional ?? p.amount ?? 0
      p.avgPrice = (p.avgPrice * oldNotional + price * notional) / (oldNotional + notional)
      p.notional = oldNotional + notional
      p.amount = p.notional
      p.margin = (p.margin || 0) + margin
    } else {
      positions[key] = {
        code: pair.code,
        side,
        margin,
        notional,
        amount: notional,
        avgPrice: price,
        leverage,
        openTime: Date.now()
      }
    }

    soloAcc.stats = soloAcc.stats || defaultStats()
    soloAcc.stats.totalInvested = (soloAcc.stats.totalInvested || 0) + margin
    if (leverage > (soloAcc.stats.maxLeverage || 0)) {
      soloAcc.stats.maxLeverage = leverage
    }

    if (mode === "solo") await saveSoloAccount(uid, soloAcc, eventGid)
    else await saveSharedAccount(gid, uid, sharedAcc)
    await refreshRank(e, uid, eventGid)

    setUserBusy(uid, 8000)

    let firstTip = ""
    if (!soloAcc.firstTrade) {
      soloAcc.firstTrade = true
      await saveSoloAccount(uid, soloAcc, eventGid)
      firstTip =
        `\n\n💡 提示：\n` +
        `　做多/买入 = 押它涨，做空/卖出 = 押它跌。\n` +
        `　押注金额 = 你最多亏的钱。`
    }

    let intelTip = ""
    if (mode === "solo" && soloAcc.intel && soloAcc.intel.code === pair.code) {
      intelTip = `\n💡 你有情报：${pair.alias} 下次可能会${soloAcc.intel.dir > 0 ? "涨" : "跌"}`
    }

    let talk
    const npcMain = isGroup(e) ? getGroupNpc() : null

    if (soloAcc.consecutiveLosses >= 2 && npcMain?.id === "kurumi") {
      talk = pick(npcMain.revengeTalk)
    } else if (leverage >= 500 && npcMain?.id === "kurumi") {
      talk = pick(npcMain.yoloTalk)
    } else if (soloAcc.consecutiveLosses >= 2) {
      talk = pick(TALKS.revenge)
    } else {
      talk = pick(side === "long" ? TALKS.openLong : TALKS.openShort)
    }

    let npcSceneMsg = ""
    if (isGroup(e) && Math.random() < 0.30) {
      const npcScene = getGroupNpc()
      npcSceneMsg = npcInterject(npcScene, isAddOn ? "addon" : "open")
      // 芽吹有时会跟久留美看齐
      if (npcScene.id === "mebuki" && Math.random() < 0.5) {
        npcSceneMsg += `\n\n芽吹：「${pick(npcScene.followTalk)}」`
      }
    }

    const dir = side === "long" ? "📈 押涨" : "📉 押跌"
    const prefix = mode === "solo" ? "独" : "共"
    const overallAfter = await calcOverall(mode === "shared" ? gid : null, uid, soloAcc, sharedAcc)

    const pctToBlowup = (100 / leverage).toFixed(2)
    let blowupWarning = ""
    if (side === "long") {
      blowupWarning = `跌 ${pctToBlowup}% 你就归零`
    } else {
      blowupWarning = `涨 ${pctToBlowup}% 你就归零`
    }

    // 【新增】针对高杠杆的特殊警告
    if (leverage >= 200) {
      blowupWarning += `\n⚠️ 警告：当前货币对历史日均振幅约 ${(p.volatility * 200).toFixed(2)}%，`
      blowupWarning += `盘中随便一根下影线/上影线就能让你瞬间爆仓，哪怕收盘是涨的/跌的。`
    }

    const posBlock = isAddOn
      ? `本次加仓：¥${fmt(margin)}\n` +
        `杠杆：${leverage}×（与原仓位一致）\n` +
        `本次名义：¥${fmt(notional)}\n\n` +
        `当前总押注：¥${fmt(positions[key].margin)}\n` +
        `当前名义价值：¥${fmt(positions[key].notional)}\n` +
        `持仓均价：${priceStr(positions[key].avgPrice, pair.precision)}`
      : `押注金额：¥${fmt(margin)}\n` +
        `杠杆：${leverage}×\n` +
        `名义价值：¥${fmt(notional)}\n` +
        `开仓价：${priceStr(price, pair.precision)}`

    return e.reply(
      `✅ ${dir}${isAddOn ? "加仓" : "开仓"}成功 · ${MODE_LABEL[mode]}场\n━━━━━━━━━━━━━━\n` +
      `${pair.name}（${pair.alias}）\n${posBlock}\n` +
      `━━━━━━━━━━━━━━\n` +
      `⚠️ ${blowupWarning}\n` +
      `总维持率：${isFinite(overallAfter.rate) ? (overallAfter.rate * 100).toFixed(1) + "%" : "—"}\n` +
      `下注完成，等 #${prefix}下一天 开牌` +
      intelTip + `\n\n` +
      `久留美：「${talk}」` + firstTip + npcSceneMsg
    )
  }

  async openLong(e)  { return this._openPosition(e, "long") }
  async openShort(e) { return this._openPosition(e, "short") }

  async closeOne(e) {
    const mode = getMode(e)
    if (!mode) return false
    const gid = getGid(e)
    const uid = String(e.user_id)

    if (mode === "shared" && !isGroup(e)) return e.reply("❎ 共享场只能在群聊里玩")
    if (isUserBusy(uid)) return e.reply("⚠️ 操作太快啦，喘口气再试")

    const m = e.msg.match(new RegExp(`^#?(?:独|共)平仓?\\s*(${PAIR_PATTERN})$`))
    if (!m) return false

    const pair = findPair(m[1])
    if (!pair) return e.reply(`❎ 查无此货币对：「${m[1]}」`)

    const soloAcc = await getSoloAccount(uid)
    if (!soloAcc) return e.reply("❎ 请先发送 #开户")
    let sharedAcc = null
    if (mode === "shared") sharedAcc = await getSharedAccount(gid, uid)

    const positions = mode === "solo" ? soloAcc.positionsSolo : (sharedAcc?.positionsShared || {})
    const keys = [posKey(pair.code, "long"), posKey(pair.code, "short")].filter(k => positions[k])
    if (!keys.length) return e.reply(`❎ 你在${MODE_LABEL[mode]}场没有 ${pair.alias} 的持仓`)

    setUserBusy(uid, 8000)
    const market = mode === "solo" ? await getSoloMarket(uid) : await getSharedMarket(gid)
    return this._doClose(e, soloAcc, sharedAcc, keys, `平仓 ${pair.alias}`, gid, uid, mode, market)
  }

  async closeAll(e) {
    const mode = getMode(e)
    if (!mode) return false
    const gid = getGid(e)
    const uid = String(e.user_id)

    if (mode === "shared" && !isGroup(e)) return e.reply("❎ 共享场只能在群聊里玩")
    if (isUserBusy(uid)) return e.reply("⚠️ 操作太快啦，喘口气再试")

    const soloAcc = await getSoloAccount(uid)
    if (!soloAcc) return e.reply("❎ 请先发送 #开户")
    let sharedAcc = null
    if (mode === "shared") sharedAcc = await getSharedAccount(gid, uid)

    const positions = mode === "solo" ? soloAcc.positionsSolo : (sharedAcc?.positionsShared || {})
    const keys = Object.keys(positions || {})
    if (!keys.length) return e.reply(`❎ 你在${MODE_LABEL[mode]}场当前空仓`)

    setUserBusy(uid, 8000)
    const market = mode === "solo" ? await getSoloMarket(uid) : await getSharedMarket(gid)
    return this._doClose(e, soloAcc, sharedAcc, keys, "全平", gid, uid, mode, market)
  }

  async _doClose(e, soloAcc, sharedAcc, keys, title, gid, uid, mode, market) {
    const eventGid = getEventGid(e)
    const positions = mode === "solo" ? soloAcc.positionsSolo : sharedAcc.positionsShared
    let totalPnL = 0, totalMargin = 0
    const lines = []

    for (const key of keys) {
      const pos = positions[key]
      if (!pos) continue
      const pair = PAIRS.find(p => p.code === pos.code)
      const cur = market[pos.code].price
      const pnl = calcPnL(pos, cur)
      totalPnL += pnl
      totalMargin += (pos.margin || 0)
      lines.push(
        `· ${pair.name}(${pair.alias}) ${pos.side === "long" ? "多" : "空"} ` +
        `押¥${fmt(pos.margin)} ${pnl >= 0 ? "+" : ""}¥${fmt(pnl)}`
      )
      delete positions[key]
    }

    const newBalance = soloAcc.balance + totalPnL
    if (newBalance < 0 && soloAcc.debt === 0) {
      soloAcc.debt = Math.abs(newBalance)
      soloAcc.balance = 0
    } else {
      soloAcc.balance = Math.max(0, newBalance)
    }

    soloAcc.stats = soloAcc.stats || defaultStats()
    soloAcc.stats.fxProfit = (soloAcc.stats.fxProfit || 0) + totalPnL
    if (totalPnL < 0) {
      soloAcc.stats.fxLoss = (soloAcc.stats.fxLoss || 0) + Math.abs(totalPnL)
    }
    soloAcc.stats.totalAbsPnL = (soloAcc.stats.totalAbsPnL || 0) + Math.abs(totalPnL)

    if (totalPnL > 0) {
      soloAcc.consecutiveWins = (soloAcc.consecutiveWins || 0) + 1
      soloAcc.consecutiveLosses = 0
      if (!soloAcc.everProfited) soloAcc.everProfited = true
    } else if (totalPnL < 0) {
      soloAcc.consecutiveLosses = (soloAcc.consecutiveLosses || 0) + 1
      soloAcc.consecutiveWins = 0
    }

    if (mode === "solo") await saveSoloAccount(uid, soloAcc, eventGid)
    else { await saveSoloAccount(uid, soloAcc, eventGid); await saveSharedAccount(gid, uid, sharedAcc) }
    await refreshRank(e, uid, eventGid)

    const overall = await calcOverall(mode === "shared" ? gid : null, uid, soloAcc, sharedAcc)
    const rate = overall.totalUsed > 0 ? ((overall.equity / overall.totalUsed) * 100).toFixed(1) + "%" : "—"

    let talk = ""
    if (totalMargin > 0) {
      const pnlRate = totalPnL / totalMargin
      if (pnlRate >= 0.3) {
        if (soloAcc.consecutiveWins === 1 && soloAcc.everProfited) talk = `\n\n久留美：「${pick(TALKS.firstWin)}」`
        else talk = `\n\n久留美：「${pick(TALKS.bigWin)}」`
      } else if (pnlRate <= -0.3) {
        talk = `\n\n久留美：「${pick(TALKS.bigLose)}」`
      }
    }

    let npcSceneMsg = ""
    if (isGroup(e) && Math.random() < 0.30) {
      const npcScene = getGroupNpc()
      npcSceneMsg = npcInterject(npcScene, "close")
    }

    return e.reply(
      `✅ ${title} 完成 · ${MODE_LABEL[mode]}场\n━━━━━━━━━━━━━━\n` +
      lines.join("\n") +
      `\n━━━━━━━━━━━━━━\n` +
      `本场合计：${totalPnL >= 0 ? "+" : ""}¥${fmt(totalPnL)}\n` +
      `账户余额：¥${fmt(soloAcc.balance)}` +
      (soloAcc.debt > 0 ? `\n💀 负债：¥${fmt(soloAcc.debt)}` : "") +
      `\n总维持率：${rate}` + talk + npcSceneMsg
    )
  }

  async portfolio(e) {
    const mode = getMode(e)
    if (!mode) return false
    const gid = getGid(e)
    const uid = String(e.user_id)
    if (mode === "shared" && !isGroup(e)) return e.reply("❎ 共享场只能在群聊里玩")

    const soloAcc = await getSoloAccount(uid)
    if (!soloAcc) return e.reply("❎ 请先发送 #开户")
    let sharedAcc = null
    if (mode === "shared") sharedAcc = await getSharedAccount(gid, uid)

    const positions = mode === "solo" ? soloAcc.positionsSolo : (sharedAcc?.positionsShared || {})
    const entries = Object.values(positions || {})
    const prefix = mode === "solo" ? "独" : "共"

    if (!entries.length) {
      return e.reply(
        `💼 你目前 ${MODE_LABEL[mode]}场空仓\n余额：¥${fmt(soloAcc.balance)}` +
        (soloAcc.debt > 0 ? `\n负债：¥${fmt(soloAcc.debt)}` : "") +
        `\n发送 #${prefix}行情 挑一个吧`
      )
    }

    const market = mode === "solo" ? await getSoloMarket(uid) : await getSharedMarket(gid)
    const overall = await calcOverall(mode === "shared" ? gid : null, uid, soloAcc, sharedAcc)
    const keepRate = overall.totalUsed > 0 ? overall.equity / overall.totalUsed : 0
    let totalPnL = 0

    const posHtml = entries.map(pos => {
      const pair = PAIRS.find(p => p.code === pos.code)
      const cur = market[pos.code].price
      const pnl = calcPnL(pos, cur)
      const rate = (pnl / pos.margin) * 100
      totalPnL += pnl
      const cls = pnl >= 0 ? "up" : "down"
      return `<div class="pos-box">
        <div class="pos-head">
          <span>${pos.side === "long" ? "📈" : "📉"} ${pair.alias}
            <span class="tag">${pos.side === "long" ? "多" : "空"}</span>
            <span class="tag">${pos.leverage}×</span>
          </span>
          <span class="${cls}">${pnl >= 0 ? "+" : ""}¥${fmt(pnl)}</span>
        </div>
        <div class="row"><span class="label">押注 / 名义</span>
          <span class="value">¥${fmt(pos.margin)} / ¥${fmt(pos.notional)}</span></div>
        <div class="row"><span class="label">开仓 → 现价</span>
          <span class="value">${priceStr(pos.avgPrice, pair.precision)} → ${priceStr(cur, pair.precision)}</span></div>
        <div class="row"><span class="label">收益率</span>
          <span class="value ${cls}">${pct(rate)}</span></div>
      </div>`
    }).join("")

    const html = `
      <div class="card">
        <div class="title">💼 ${MODE_LABEL[mode]}场持仓</div>
        <div class="section">${posHtml}</div>
        <div class="divider"></div>
        <div class="row"><span class="label">本场浮盈</span>
          <span class="value ${totalPnL >= 0 ? 'up' : 'down'}">${totalPnL >= 0 ? "+" : ""}¥${fmt(totalPnL)}</span></div>
        <div class="row"><span class="label">本场占用</span>
          <span class="value">¥${fmt(calcUsedMargin(positions))}</span></div>
        <div class="row"><span class="label">账户余额</span>
          <span class="value">¥${fmt(soloAcc.balance)}</span></div>
        ${soloAcc.debt > 0 ? `<div class="row"><span class="label">负债</span><span class="value danger">¥${fmt(soloAcc.debt)}</span></div>` : ""}
        <div class="row"><span class="label">总占用</span>
          <span class="value">¥${fmt(overall.totalUsed)}</span></div>
        <div class="row"><span class="label">总维持率</span>
          <span class="value ${keepRate < CONFIG.warnRate ? 'warn' : ''}">${(keepRate * 100).toFixed(1)}%</span></div>
        ${keepRate < CONFIG.warnRate ? `<div class="quote">⚠️ 接近强平线（${(CONFIG.stopOutRate * 100).toFixed(0)}%）</div>` : ""}
        <div class="divider"></div>
        <div class="muted">想开牌就发 #${prefix}下一天</div>
      </div>`

    return replyFxImage(e, html,
      `💼 ${MODE_LABEL[mode]}场持仓 ${entries.length} 个\n余额 ¥${fmt(soloAcc.balance)}`
    )
  }

  async assets(e) {
    const uid = String(e.user_id)
    const gid = getGid(e)
    const soloAcc = await getSoloAccount(uid)
    if (!soloAcc) return e.reply("❎ 请先发送 #开户")

    const hasGroup = isGroup(e)
    const sharedAcc = hasGroup ? await getSharedAccount(gid, uid) : null
    const overall = await calcOverall(hasGroup ? gid : null, uid, soloAcc, sharedAcc)
    const profit = overall.equity - CONFIG.initialMoney
    const rate = (profit / CONFIG.initialMoney) * 100
    const profitCls = profit >= 0 ? "up" : "down"
    const s = soloAcc.stats || {}

    let overviewHtml = `
      <div class="row"><span class="label">净值</span>
        <span class="value ${profitCls}">¥${fmt(overall.equity)} (${pct(rate)})</span></div>`
    if (soloAcc.debt > 0) overviewHtml += `
      <div class="row"><span class="label">负债</span>
        <span class="value danger">¥${fmt(soloAcc.debt)}</span></div>`
    if (s.pendingStealDebt > 0) overviewHtml += `
      <div class="row"><span class="label">待还赃</span>
        <span class="value warn">¥${fmt(s.pendingStealDebt)}</span></div>`
    if (soloAcc.intel) overviewHtml += `
      <div class="row"><span class="label">情报待用</span>
        <span class="value">${soloAcc.intel.alias}</span></div>`

    let usageHtml = `
      <div class="row"><span class="label">独立场占用</span>
        <span class="value">¥${fmt(overall.soloUsed)}</span></div>`
    if (hasGroup) usageHtml += `
      <div class="row"><span class="label">共享场占用</span>
        <span class="value">¥${fmt(overall.sharedUsed)}</span></div>`
    usageHtml += `
      <div class="row"><span class="label">总占用</span>
        <span class="value">¥${fmt(overall.totalUsed)}</span></div>
      <div class="row"><span class="label">可用余额</span>
        <span class="value">¥${fmt(overall.free)}</span></div>
      <div class="row"><span class="label">总维持率</span>
        <span class="value">${isFinite(overall.rate) ? (overall.rate * 100).toFixed(1) + "%" : "—"}</span></div>`

    let statsHtml = `
      <div class="row"><span class="label">初始资金</span>
        <span class="value">¥${fmt(CONFIG.initialMoney)}</span></div>
      <div class="row"><span class="label">累计盈亏</span>
        <span class="value ${profitCls}">${profit >= 0 ? "+" : ""}¥${fmt(profit)} (${pct(rate)})</span></div>
      <div class="row"><span class="label">爆仓次数</span>
        <span class="value">${soloAcc.blowups || 0}</span></div>
      <div class="row"><span class="label">破产次数</span>
        <span class="value">${soloAcc.bankruptCount || 0}</span></div>
      <div class="row"><span class="label">上天台</span>
        <span class="value">${soloAcc.rooftopCount || 0}</span></div>
      <div class="row"><span class="label">累计打工</span>
        <span class="value">${soloAcc.workCount || 0}</span></div>
      <div class="row"><span class="label">B计划</span>
        <span class="value">${soloAcc.bPlanCount || 0}</span></div>
      <div class="row"><span class="label">偷钱</span>
        <span class="value">${s.stealCount || 0} 次（成功 ${s.stealWin || 0}）</span></div>
      <div class="row"><span class="label">当前连胜/连败</span>
        <span class="value">${soloAcc.consecutiveWins || 0} / ${soloAcc.consecutiveLosses || 0}</span></div>`
    if (soloAcc.loan) {
      statsHtml += `<div class="row"><span class="label">未还借款</span>
        <span class="value warn">¥${fmt(soloAcc.loan.amount)}</span></div>
        <div class="row"><span class="label">到期时间</span>
          <span class="value muted">${new Date(soloAcc.loan.dueTime).toLocaleString("zh-CN")}</span></div>`
    }

    const html = `
      <div class="card">
        <div class="title">${GAME_ALIAS} · 账户概览</div>
        <div class="section">
          <div class="section-title">💰 概览</div>
          ${overviewHtml}
        </div>
        <div class="section">
          <div class="section-title">📊 占用情况</div>
          ${usageHtml}
        </div>
        <div class="section">
          <div class="section-title">📈 战绩</div>
          ${statsHtml}
        </div>
      </div>`

    return replyFxImage(e, html,
      `💰 净值 ¥${fmt(overall.equity)} (${pct(rate)})`
    )
  }

  async blowupHistory(e) {
    const uid = String(e.user_id)
    const soloAcc = await getSoloAccount(uid)
    if (!soloAcc) return e.reply("❎ 请先发送 #开户")
    if (!soloAcc.blowups) return e.reply("✨ 你还没有爆过仓，稳如老狗")

    const lb = soloAcc.lastBlowup
    const time = lb ? new Date(lb.time).toLocaleString("zh-CN") : "—"
    const modeLabel = lb?.mode ? (MODE_LABEL[lb.mode] || lb.mode) : "未知"

    return e.reply(
      `💀 爆仓史\n━━━━━━━━━━━━━━\n` +
      `累计爆仓：${soloAcc.blowups} 次\n` +
      `最近一次：${time}\n` +
      `爆仓市场：${modeLabel}\n` +
      `当时亏损：${lb ? (lb.pnl >= 0 ? "+" : "") + "¥" + fmt(lb.pnl) : "—"}\n` +
      `个人破产：${soloAcc.bankruptCount || 0} 次\n` +
      `上天台：${soloAcc.rooftopCount || 0} 次\n` +
      `B计划：${soloAcc.bPlanCount || 0} 次\n` +
      `━━━━━━━━━━━━━━\n少女，这是第 ${soloAcc.blowups} 次上天台了。`
    )
  }
}