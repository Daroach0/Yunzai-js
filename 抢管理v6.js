//编程小白花菜（2253614815）突发奇想cv了很多如”日群友“”上机“”举办“之类的js插件，感谢这些插件的原作者们喵
//感谢鸭佬（1564571378）&叶佬（1936472877）的热心帮助，没有他们这些将是一堆乱码awa
//支持v3系列崽
//记得把机器人设成群主
//有bug来共享管理（537866105）群反馈
//前3代已废弃，忘(lan)记(de)写日志了
//v4更新日志：增加了主人不会被随机抢走管理，管理转让给主人不会被禁言
//v5更新日志：新增"查看当前管理"；权限判定统一改用 role；增加用户操作锁
//v6更新日志：新增战绩记录与欧非榜系统（总榜 + 6 个单榜），新增被抢榜
import plugin from '../../lib/plugins/plugin.js'
import cfg from '../../lib/config/config.js'
import _ from 'lodash'

const qiangcd = 43200;
const rangcd = 21600;
const RANK_TOP_N_OVERVIEW = 5;
const RANK_TOP_N_DETAIL = 10;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const conf = cfg

// ================= 通用工具 =================

function isMasterQQ(id) {
  if (!cfg.masterQQ) return false
  const sid = String(id)
  return Array.isArray(cfg.masterQQ)
    ? cfg.masterQQ.some(m => String(m) === sid)
    : String(cfg.masterQQ) === sid
}

async function punishNonMaster(e, msg) {
  try { await e.reply(msg) } catch { }
  if (e.member?.is_owner) return
  try { await e.group.muteMember(e.user_id, 300) } catch (err) {
    logger.debug(`[换管理] 禁言惩罚失败: ${err.message}`)
  }
}

const STATS_KEY = (gid) => `Yz:qiang:stats:${gid}`

// ================= 用户操作锁 =================
const userBusy = new Map()

function isUserBusy(groupId, userId) {
  const key = `${groupId}:${userId}`
  const exp = userBusy.get(key)
  if (!exp) return false
  if (exp <= Date.now()) { userBusy.delete(key); return false }
  return true
}

function setUserBusy(groupId, userId, ms = 10000) {
  userBusy.set(`${groupId}:${userId}`, Date.now() + ms)
}

// ================= 战绩统计 =================

async function getStats(groupId) {
  try {
    const data = await redis.get(STATS_KEY(groupId))
    if (!data) return {}
    const parsed = JSON.parse(data)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch (err) {
    logger.debug(`[换管理] 读取战绩失败: ${err.message}`)
    return {}
  }
}

async function setStats(groupId, stats) {
  await redis.set(STATS_KEY(groupId), JSON.stringify(stats))
}

async function recordStat(groupId, userId, field) {
  try {
    const stats = await getStats(groupId)
    const key = String(userId)
    if (!stats[key]) {
      stats[key] = {
        qw: 0, ql: 0, zw: 0, zl: 0,
        winStreak: 0, loseStreak: 0,
        maxWinStreak: 0, maxLoseStreak: 0,
        defendWin: 0, beQiang: 0
      }
    }
    const s = stats[key]
    s[field] = (s[field] || 0) + 1

    const isWin = field === 'qw' || field === 'zw'
    if (isWin) {
      s.winStreak = (s.winStreak || 0) + 1
      s.loseStreak = 0
      if (s.winStreak > (s.maxWinStreak || 0)) s.maxWinStreak = s.winStreak
    } else if (field === 'ql' || field === 'zl') {
      s.loseStreak = (s.loseStreak || 0) + 1
      s.winStreak = 0
      if (s.loseStreak > (s.maxLoseStreak || 0)) s.maxLoseStreak = s.loseStreak
    }

    await setStats(groupId, stats)
  } catch (err) {
    logger.debug(`[换管理] 记录战绩失败: ${err.message}`)
  }
}

function formatStat(s) {
  const qw = s?.qw || 0, ql = s?.ql || 0
  const zw = s?.zw || 0, zl = s?.zl || 0
  const win = qw + zw
  const lose = ql + zl
  const total = win + lose
  const rate = total > 0 ? (win / total * 100) : 0
  const loseRate = total > 0 ? (lose / total * 100) : 0
  return {
    qw, ql, zw, zl, win, lose, total, rate, loseRate,
    winStreak: s?.winStreak || 0,
    loseStreak: s?.loseStreak || 0,
    maxWinStreak: s?.maxWinStreak || 0,
    maxLoseStreak: s?.maxLoseStreak || 0,
    defendWin: s?.defendWin || 0,
    beQiang: s?.beQiang || 0
  }
}

// ================= 榜单辅助 =================

async function buildRankBase(e) {
  const stats = await getStats(e.group_id)
  const all = Object.entries(stats)
    .map(([uid, s]) => ({ uid: Number(uid), ...formatStat(s) }))
    .filter(x => !isNaN(x.uid) && x.total > 0)

  if (all.length === 0) return null

  const memberMap = await e.group.getMemberMap()
  const getNick = (id) => {
    const m = memberMap.get(Number(id)) || memberMap.get(String(id))
    return m?.card || m?.nickname || String(id)
  }
  return { all, getNick }
}

function formatBoard(list, topN, getNick, valueGetter) {
  const top = list.slice(0, topN)
  const lines = top.map((item, i) => {
    const icon = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`
    return `${icon} ${getNick(item.uid)} — ${valueGetter(item)}`
  }).join('\n')
  const tail = list.length > topN ? `\n…共 ${list.length} 人` : ''
  return lines + tail
}

const BOARD_DEFS = [
  { key: 'win', title: '🏆 胜榜', sort: (a, b) => b.win - a.win || b.rate - a.rate, fmt: x => `${x.win} 胜（胜率 ${x.rate.toFixed(1)}%）`, filter: null },
  { key: 'lose', title: '💀 败榜', sort: (a, b) => b.lose - a.lose || a.rate - b.rate, fmt: x => `${x.lose} 负（败率 ${x.loseRate.toFixed(1)}%）`, filter: null },
  { key: 'maxWinStreak', title: '🔥 连胜榜', sort: (a, b) => b.maxWinStreak - a.maxWinStreak || b.win - a.win, fmt: x => `${x.maxWinStreak} 连胜`, filter: null },
  { key: 'maxLoseStreak', title: '❄️ 连败榜', sort: (a, b) => b.maxLoseStreak - a.maxLoseStreak || b.lose - a.lose, fmt: x => `${x.maxLoseStreak} 连败`, filter: null },
  { key: 'defendWin', title: '🛡️ 守赢榜', sort: (a, b) => b.defendWin - a.defendWin, fmt: x => `${x.defendWin} 次`, filter: x => !isMasterQQ(x.uid) && x.defendWin > 0 },
  { key: 'beQiang', title: '⚔️ 被抢榜', sort: (a, b) => b.beQiang - a.beQiang, fmt: x => `${x.beQiang} 次`, filter: x => !isMasterQQ(x.uid) && x.beQiang > 0 }
]

// ================= 成员信息 =================

async function getMemberFromMap(e, userId) {
  const id = String(userId)
  const numId = Number(id)

  try {
    const cached = e.group.pickMember(numId) || e.group.pickMember(id)
    const info = cached?.info
    if (info?.role === 'admin' || info?.role === 'owner') {
      return { role: info.role, is_admin: true, is_owner: info.role === 'owner', info }
    }
  } catch { }

  try {
    if (e.bot?.sendApi) {
      const res = await Promise.race([
        e.bot.sendApi('get_group_member_info', {
          group_id: e.group_id,
          user_id: numId,
          no_cache: true
        }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 3000))
      ])
      const info = res?.data || res
      if (info?.role) {
        return { role: info.role, is_admin: info.role === 'admin' || info.role === 'owner', is_owner: info.role === 'owner', info }
      }
    }
  } catch (err) {
    logger.debug(`[换管理] sendApi 失败/超时: ${err.message}`)
  }

  try {
    const member = e.group.pickMember(numId, true) || e.group.pickMember(numId)
    if (member) {
      const info = (await member.getInfo?.()) || member.info
      if (info?.role) {
        return { role: info.role, is_admin: info.role === 'admin' || info.role === 'owner', is_owner: info.role === 'owner', info }
      }
    }
  } catch (err) {
    logger.debug(`[换管理] pickMember.getInfo 失败: ${err.message}`)
  }

  try {
    const memberMap = await e.group.getMemberMap()
    let info = memberMap.get(numId) || memberMap.get(id)
    if (!info) {
      for (const [k, v] of memberMap) {
        if (String(k) === id) { info = v; break }
      }
    }
    if (info?.role) {
      return { role: info.role, is_admin: info.role === 'admin' || info.role === 'owner', is_owner: info.role === 'owner', info }
    }
  } catch (err) {
    logger.debug(`[换管理] getMemberMap 失败: ${err.message}`)
  }

  return null
}

async function pickTarget(e) {
  if (!e.at) return null
  const atId = String(e.at)
  const numId = Number(atId)

  const fromApi = await getMemberFromMap(e, atId)
  if (fromApi) {
    return {
      user_id: atId,
      nickname: fromApi.info.card || fromApi.info.nickname || atId,
      role: fromApi.role,
      is_admin: fromApi.is_admin,
      raw: fromApi.info
    }
  }

  try {
    const member = e.group.pickMember(numId, true) || e.group.pickMember(numId)
    if (!member) return null
    const info = member.info || await member.getInfo?.()
    if (info) {
      return {
        user_id: atId,
        nickname: info.card || info.nickname || atId,
        role: info.role,
        is_admin: info.role === 'admin' || info.role === 'owner',
        raw: info
      }
    }
    return member
  } catch (err) {
    logger.debug(`[换管理] pickMember 失败: ${err.message}`)
  }

  return null
}

async function refreshMemberCache(group) {
  try {
    await group.getMemberMap()
    await sleep(500)
    await group.getMemberMap()
  } catch (err) {
    logger.debug(`[换管理] 刷新成员缓存失败: ${err.message}`)
  }
}

async function checkSelfIsAdminAndReject(e) {
  const self = await getMemberFromMap(e, e.user_id)
  const selfIsAdmin = self ? self.is_admin : false
  if (selfIsAdmin) {
    if (e.isMaster) {
      await e.reply([segment.at(e.user_id), "卡哇伊的狗修金sama，您既然是管理就别来捣乱哦？"])
    } else {
      await e.reply([segment.at(e.user_id), "亲狗的爱管理，您可是被抢的一方哦？"])
    }
    return true
  }
  return false
}

// ================= 插件主类 =================

export class example extends plugin {
  constructor() {
    super({
      name: '换管理',
      dsc: '换管理',
      event: 'message.group',
      priority: 500,
      rule: [
        { reg: '^#?(换管理)?欧非榜$', fnc: 'ouFeiRank' },
        { reg: '^#?(胜榜|败榜|连胜榜|连败榜|守赢榜|被抢榜)$', fnc: 'singleRank' },
        { reg: '^#?(我的|查看我的)?(换管理)?战绩.*$', fnc: 'myStats' },
        { reg: '^#?清空本群战绩$', fnc: 'resetStats' },
        { reg: '^抢管理.*$', fnc: 'qiangadmin' },
        { reg: '^抢随机管理$', fnc: 'qiangsjad' },
        { reg: '^抢群主$', fnc: 'qiangowner' },
        { reg: '^管理转让.*$', fnc: 'zradmin' },
        { reg: '^管理随机转让$', fnc: 'zrsjad' },
        { reg: '^查看当前管理$', fnc: 'Adminlist' }
      ]
    })
  }

  // ================= 榜单 =================

  async ouFeiRank(e) {
    try {
      const base = await buildRankBase(e)
      if (!base) return await e.reply('本群还没有战绩记录哦~')
      const { all, getNick } = base

      const header = `📊 换管理欧非榜速览（共 ${all.length} 人，每榜前 ${RANK_TOP_N_OVERVIEW}）\n想看完整榜单请发：#胜榜 #败榜 #连胜榜 #连败榜 #守赢榜 #被抢榜`

      const nodes = []
      for (let i = 0; i < BOARD_DEFS.length; i++) {
        const b = BOARD_DEFS[i]
        const list = [...all].sort(b.sort).filter(x => b.filter ? b.filter(x) : true)
        const text = list.length === 0 ? '暂无数据' : formatBoard(list, RANK_TOP_N_OVERVIEW, getNick, b.fmt)
        const content = i === 0 ? `${header}\n\n${b.title}\n${text}` : `${b.title}\n${text}`
        nodes.push({
          user_id: String(e.self_id),
          nickname: i === 0 ? '欧非榜' : b.title,
          message: content
        })
      }

      try {
        const forwardMsg = await Bot.makeForwardMsg(nodes)
        await e.reply(forwardMsg)
      } catch (err) {
        logger.error('[换管理] 欧非榜合并转发失败:', err)
        const text = BOARD_DEFS.map(b => {
          const list = [...all].sort(b.sort).filter(x => b.filter ? b.filter(x) : true)
          const t = list.length === 0 ? '暂无数据' : formatBoard(list, RANK_TOP_N_OVERVIEW, getNick, b.fmt)
          return `${b.title}\n${t}`
        }).join('\n\n')
        await e.reply(`📊 换管理欧非榜速览\n\n${text}`)
      }
    } catch (err) {
      logger.error('[换管理] 欧非榜查询失败:', err)
      return await e.reply(`❌ 查询失败: ${err.message}`)
    }
  }

  async singleRank(e) {
    try {
      const key = e.msg.match(/^#?(胜榜|败榜|连胜榜|连败榜|守赢榜|被抢榜)$/)[1]
      const b = BOARD_DEFS.find(x =>
        (key === '胜榜' && x.key === 'win') ||
        (key === '败榜' && x.key === 'lose') ||
        (key === '连胜榜' && x.key === 'maxWinStreak') ||
        (key === '连败榜' && x.key === 'maxLoseStreak') ||
        (key === '守赢榜' && x.key === 'defendWin') ||
        (key === '被抢榜' && x.key === 'beQiang')
      )
      if (!b) return

      const base = await buildRankBase(e)
      if (!base) return await e.reply('本群还没有战绩记录哦~')
      const { all, getNick } = base

      const list = [...all].sort(b.sort).filter(x => b.filter ? b.filter(x) : true)
      if (list.length === 0) {
        return await e.reply(`${b.title}\n\n暂无数据`)
      }

      const text = formatBoard(list, RANK_TOP_N_DETAIL, getNick, b.fmt)
      return await e.reply(`${b.title}（共 ${list.length} 人，前 ${RANK_TOP_N_DETAIL}）\n\n${text}`)
    } catch (err) {
      logger.error('[换管理] 单榜查询失败:', err)
      return await e.reply(`❌ 查询失败: ${err.message}`)
    }
  }

  async myStats(e) {
    try {
      const targetId = e.at ? String(e.at) : String(e.user_id)
      const isSelf = targetId === String(e.user_id)

      const stats = await getStats(e.group_id)
      const s = stats[targetId]

      let nick = targetId
      try {
        const memberMap = await e.group.getMemberMap()
        const m = memberMap.get(Number(targetId)) || memberMap.get(targetId)
        nick = m?.card || m?.nickname || targetId
      } catch { }

      if (!s) {
        return await e.reply([
          segment.at(targetId),
          isSelf ? '\n你还没有任何战绩哦~' : `\n${nick} 还没有任何战绩哦~`
        ])
      }

      const d = formatStat(s)
      const title = isSelf ? '【你的换管理战绩】' : `【${nick} 的换管理战绩】`

      return await e.reply([
        segment.at(targetId),
        `\n${title}\n`,
        `抢管理：${d.qw} 胜 / ${d.ql} 负\n`,
        `转让：${d.zw} 胜 / ${d.zl} 负\n`,
        `总战绩：${d.win} 胜 / ${d.lose} 负\n`,
        `胜率：${d.rate.toFixed(1)}% 败率：${d.loseRate.toFixed(1)}%\n`,
        `当前连胜：${d.winStreak} / 历史最高：${d.maxWinStreak}\n`,
        `当前连败：${d.loseStreak} / 历史最高：${d.maxLoseStreak}\n`,
        `守赢次数：${d.defendWin}\n`,
        `被抢次数：${d.beQiang}`
      ])
    } catch (err) {
      logger.error('[换管理] 战绩查询失败:', err)
      return await e.reply(`❌ 查询失败: ${err.message}`)
    }
  }

  async resetStats(e) {
    if (!isMasterQQ(e.user_id)) return await punishNonMaster(e, '你没资格清空战绩啦')
    try {
      await redis.del(STATS_KEY(e.group_id))
      return await e.reply('✅ 本群战绩已清空')
    } catch (err) {
      logger.error('[换管理] 清空战绩失败:', err)
      return await e.reply(`❌ 清空失败: ${err.message}`)
    }
  }

  // ================= 换管理主功能 =================

  async qiangadmin(e) {
    if (isUserBusy(e.group_id, e.user_id)) {
      return await e.reply('⚠️ 操作太快啦，请稍等几秒再试')
    }
    if (!e.group.is_owner) {
      await e.reply("伦家不是群主啦！")
      return true
    }
    if (await checkSelfIsAdminAndReject(e)) return true
    if (e.isMaster) await e.reply("你是主人，没有cd")

    if (!e.at || e.at == e.self_id) {
      await e.reply(["你抢谁呢！你抢谁呢！"])
      await e.group.muteMember(e.user_id, 600)
      return true
    }
    if (isMasterQQ(e.at)) {
      e.reply("TA不能被直接抢哦。")
      await e.group.muteMember(e.user_id, 600)
      return true
    }
    const target = await pickTarget(e)
    if (!target || !target.is_admin) {
      await e.reply('TA不是管理哦')
      await e.group.muteMember(e.user_id, 600)
      return true
    }
    const winCd = await redis.ttl(`getAdmin:win:${e.group_id}:${e.user_id}`)
    if (winCd > 0 && !e.isMaster) {
      await e.reply(`你还需要${secondsToHms(winCd)}之后才能抢哦`)
      return true
    }
    const loseCd = await redis.ttl(`getAdmin:lose:${e.group_id}:${e.at}:${e.user_id}`)
    if (loseCd > 0 && !e.isMaster) {
      await e.reply(`你还需要${secondsToHms(loseCd)}之后才能抢哦`)
      return true
    }

    setUserBusy(e.group_id, e.user_id, 10000)

    if (_.random(1, 2) === 1) {
      const msg = [segment.at(e.user_id), "狠狠地把管理猿", segment.at(e.at), "给撅翻了！然后把ta衣服扒了自己穿上惹"]
      await e.reply(msg)
      await e.group.setAdmin(e.at, false)
      await e.group.muteMember(e.at, 3600)
      await e.group.setAdmin(e.user_id, true)
      await refreshMemberCache(e.group)
      await redis.setEx(`getAdmin:lose:${e.group_id}:${e.at}`, qiangcd, '1')
      await redis.setEx(`getAdmin:win:${e.group_id}:${e.user_id}`, qiangcd, '1')
      await recordStat(e.group_id, e.user_id, 'qw')
      await recordStat(e.group_id, e.at, 'beQiang')
    } else {
      await redis.setEx(`getAdmin:win:${e.group_id}:${e.at}`, qiangcd, '1')
      const msg = [segment.at(e.user_id), "抢管理失败，接受愤怒的管理猿", segment.at(e.at), "の调♂教♂吧！"]
      await e.reply(msg)
      await e.group.muteMember(e.user_id, 3600)
      await recordStat(e.group_id, e.user_id, 'ql')
      await recordStat(e.group_id, e.at, 'defendWin')
    }
    return true
  }

  async qiangsjad(e) {
    if (isUserBusy(e.group_id, e.user_id)) {
      return await e.reply('⚠️ 操作太快啦，请稍等几秒再试')
    }
    if (!e.group.is_owner) {
      e.reply("伦家不是群主啦！")
      return true
    }
    if (await checkSelfIsAdminAndReject(e)) return true
    if (e.isMaster) await e.reply("你是主人，没有cd")

    const winCd = await redis.ttl(`getAdmin:win:${e.group_id}:${e.user_id}`)
    if (winCd > 0 && !e.isMaster) {
      await e.reply(`你还需要${secondsToHms(winCd)}之后才能抢哦`)
      return true
    }

    const adminList = []
    for (const [key, value] of await e.group.getMemberMap()) {
      if (value.role !== 'admin') continue
      if (isMasterQQ(key)) continue
      adminList.push(key)
    }
    if (adminList.length === 0) {
      await e.reply('本群没有可抢的管理员哦')
      return true
    }

    setUserBusy(e.group_id, e.user_id, 10000)

    const i = adminList[_.random(0, adminList.length - 1)]

    if (_.random(1, 2) === 1) {
      const msg = [segment.at(e.user_id), "狠狠地把管理", segment.at(i), "给撅翻了！然后把ta衣服扒了自己穿上惹"]
      await e.reply(msg)
      await e.group.setAdmin(i, false)
      await e.group.muteMember(i, 3600)
      await e.group.setAdmin(e.user_id, true)
      await refreshMemberCache(e.group)
      await redis.setEx(`getAdmin:lose:${e.group_id}:${i}`, qiangcd, '1')
      await redis.setEx(`getAdmin:win:${e.group_id}:${e.user_id}`, qiangcd, '1')
      await recordStat(e.group_id, e.user_id, 'qw')
      await recordStat(e.group_id, i, 'beQiang')
    } else {
      await redis.setEx(`getAdmin:win:${e.group_id}:${i}`, qiangcd, '1')
      await redis.setEx(`getAdmin:lose:${e.group_id}:${e.user_id}`, qiangcd, '1')
      const msg = [segment.at(e.user_id), "抢管理失败，接受愤怒的管理们の调♂教♂吧！"]
      await e.reply(msg)
      await e.group.muteMember(e.user_id, 3600)
      await recordStat(e.group_id, e.user_id, 'ql')
      await recordStat(e.group_id, i, 'defendWin')
    }
    return true
  }

  async qiangowner(e) {
    if (!e.group.is_owner) {
      e.reply('伦家不是群主啦！')
      return true
    }
    if (e.isMaster) {
      e.reply("亲爱滴主人sama")
      await sleep(2000)
      e.reply("您要真想来跟伦家抢群主的话……")
      await sleep(2000)
      e.reply("您还不如直接夺伦家滴舍哩~")
      return
    }
    const msg = [segment.at(e.user_id), "就凭你也配直视我？（散兵音）"]
    await e.reply(msg)
    const group = e.group
    setTimeout(() => { group.sendMsg("轰————") }, 2000)
    await e.group.muteMember(e.user_id, 3600)
    setTimeout(() => { group.sendMsg("哼。") }, 2000)
    return true
  }

  async zradmin(e) {
    if (isUserBusy(e.group_id, e.user_id)) {
      return await e.reply('⚠️ 操作太快啦，请稍等几秒再试')
    }
    if (!e.group.is_owner) {
      e.reply("伦家不是群主啦！")
      return true
    }
    const self = await getMemberFromMap(e, e.user_id)
    const selfIsAdmin = self ? self.is_admin : false

    if (!selfIsAdmin) {
      await e.reply("你又不是管理,转让个🍍")
      await e.group.muteMember(e.user_id, 600)
      return true
    }
    if (!e.at) {
      await e.reply("没at到人，你想转让给鬼呢!")
      await e.group.muteMember(e.user_id, 600)
      return true
    }
    if (e.at == e.self_id) {
      await e.reply("你什么意思，把齐天大圣封为弼马温？找抽呢你？")
      await e.group.muteMember(e.user_id, 600)
      return
    }
    const target = await pickTarget(e)
    if (target && target.role === 'admin') {
      await e.reply('脱裤子放屁?')
      await e.group.muteMember(e.user_id, 600)
      return true
    }

    setUserBusy(e.group_id, e.user_id, 10000)

    if (isMasterQQ(e.at)) {
      const msg = [segment.at(e.user_id), "好眼光！奖励你一次额外的机会抢管理~"]
      await e.reply(msg)
      await e.group.setAdmin(e.user_id, false)
      await e.group.setAdmin(e.at, true)
      await refreshMemberCache(e.group)
      await recordStat(e.group_id, e.user_id, 'zw')
      return true
    }
    if (e.isMaster) await e.reply("你是主人，没有cd")

    const setCd = await redis.ttl(`getAdmin:set:${e.group_id}:${e.user_id}`)
    if (setCd > 0 && !e.isMaster) {
      await e.reply(`你还需要${secondsToHms(setCd)}之后才能转让哦`)
      return true
    }
    const getCd = await redis.ttl(`getAdmin:get:${e.group_id}:${e.at}:${e.user_id}`)
    if (getCd > 0 && !e.isMaster) {
      await e.reply(`TA还需要${secondsToHms(getCd)}之后才能转让哦`)
      return true
    }

    if (_.random(1, 2) === 1) {
      const msg = [segment.at(e.user_id), "面色潮红地脱下了自己的胖次并交给了", segment.at(e.at), "，请妥善使用哦~", "\n然后由于某种神秘力量而翻白眼吐舌昏了过去（被玩坏惹）……"]
      await e.reply(msg)
      await e.group.setAdmin(e.user_id, false)
      await e.group.muteMember(e.user_id, 3600)
      await e.group.setAdmin(e.at, true)
      await refreshMemberCache(e.group)
      await redis.setEx(`getAdmin:set:${e.group_id}:${e.user_id}`, rangcd, '1')
      await redis.setEx(`getAdmin:get:${e.group_id}:${e.at}`, rangcd, '1')
      await recordStat(e.group_id, e.user_id, 'zw')
    } else {
      await redis.setEx(`getAdmin:set:${e.group_id}:${e.user_id}`, rangcd, '1')
      await redis.setEx(`getAdmin:set:${e.group_id}:${e.at}`, rangcd, '1')
      const msg = [segment.at(e.user_id), "脱自己的胖次脱到一半竟然由于某种神秘力量而卡住动不了了！而", segment.at(e.at), "由于见到这一幕太激动而糕巢昏了过去。。转让失败"]
      await e.reply(msg)
      await e.group.muteMember(e.user_id, 3600)
      await e.group.muteMember(e.at, 3600)
      await recordStat(e.group_id, e.user_id, 'zl')
    }
    return true
  }

  async zrsjad(e) {
    if (isUserBusy(e.group_id, e.user_id)) {
      return await e.reply('⚠️ 操作太快啦，请稍等几秒再试')
    }
    if (!e.group.is_owner) {
      e.reply("伦家不是群主啦！")
      return true
    }
    const self = await getMemberFromMap(e, e.user_id)
    const selfIsAdmin = self ? self.is_admin : false

    if (!selfIsAdmin) {
      await e.reply("你又不是管理,转让个🍍")
      await e.group.muteMember(e.user_id, 600)
      return true
    }
    if (e.isMaster) await e.reply("你是主人，没有cd")

    const setCd = await redis.ttl(`getAdmin:set:${e.group_id}:${e.user_id}`)
    if (setCd > 0 && !e.isMaster) {
      await e.reply(`你还需要${secondsToHms(setCd)}之后才能转让哦`)
      return true
    }

    const memberList = []
    for (const [key, value] of await e.group.getMemberMap()) {
      if (value.role === 'member') memberList.push(key)
    }
    if (memberList.length === 0) {
      await e.reply([
        `致敬传奇光杆司令_name_…`.replace("_name_", conf.botAlias[0])
      ])
      await sleep(2000); await e.reply("Man!")
      await sleep(2000); await e.reply("What can I say…")
      await sleep(2000); await e.reply([`_name_ out.`.replace("_name_", conf.botAlias[0])])
      await sleep(2000); await e.reply("呵↑呵↓呵.")
      return true
    }

    setUserBusy(e.group_id, e.user_id, 10000)

    const i = memberList[_.random(0, memberList.length - 1)]
    if (_.random(1, 2) === 1) {
      const msg = [segment.at(e.user_id), "面色潮红地脱下了自己的胖次并交给了", segment.at(i), "，请妥善使用哦~", "\n然后由于某种神秘力量而翻白眼吐舌昏了过去（被玩坏惹）……"]
      await e.reply(msg)
      await e.group.setAdmin(i, true)
      await e.group.muteMember(e.user_id, 3600)
      await e.group.setAdmin(e.user_id, false)
      await refreshMemberCache(e.group)
      await redis.setEx(`getAdmin:set:${e.group_id}:${e.user_id}`, rangcd, '1')
      await redis.setEx(`getAdmin:get:${e.group_id}:${i}`, rangcd, '1')
      await recordStat(e.group_id, e.user_id, 'zw')
    } else {
      await redis.setEx(`getAdmin:set:${e.group_id}:${e.user_id}`, rangcd, '1')
      const msg = [segment.at(e.user_id), "脱自己的胖次脱到一半竟然由于某种神秘力量而卡住动不了了！然后糕巢昏了过去。。转让失败"]
      await e.reply(msg)
      await e.group.muteMember(e.user_id, 3600)
      await recordStat(e.group_id, e.user_id, 'zl')
    }
    return true
  }

  async Adminlist(e) {
    if (!e.group) {
      await e.reply('请在群聊中使用该命令')
      return true
    }

    await refreshMemberCache(e.group)
    await sleep(1000)
    const memberMap = await e.group.getMemberMap()

    const admins = []
    let owner = null
    for (const [userId, info] of memberMap) {
      if (info.role === 'owner') {
        owner = { user_id: userId, nickname: info.card || info.nickname || String(userId) }
        continue
      }
      if (info.role === 'admin') {
        admins.push({ user_id: userId, nickname: info.card || info.nickname || String(userId) })
      }
    }

    const list = []
    if (!e.group.is_owner && owner) list.push({ ...owner, role: '群主' })
    for (const a of admins) list.push({ ...a, role: '管理' })

    if (list.length === 0) {
      await e.reply('本群当前没有管理员哦')
      return true
    }

    const nodes = list.map((admin, idx) => ({
      user_id: String(e.self_id),
      nickname: '管理员列表',
      message: [
        `${idx + 1}、${admin.nickname}【${admin.role}】\n`,
        segment.image(`https://q1.qlogo.cn/g?b=qq&s=640&nk=${admin.user_id}`)
      ]
    }))

    try {
      const forwardMsg = await Bot.makeForwardMsg(nodes)
      await e.reply(forwardMsg)
    } catch (err) {
      logger.error('[换管理] 合并转发失败:', err)
      const text = list.map((a, i) => `${i + 1}、${a.nickname}（${a.user_id}）【${a.role}】`).join('\n')
      await e.reply(`本群管理员共 ${list.length} 人：\n${text}`)
    }
    return true
  }
}

function secondsToHms(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const parts = []
  if (h > 0) parts.push(`${h} 小时`)
  if (m > 0 || h > 0) parts.push(`${m} 分钟`)
  parts.push(`${s} 秒`)
  return parts.join(' ')
}