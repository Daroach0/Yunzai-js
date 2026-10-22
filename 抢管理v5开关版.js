//编程小白花菜（2253614815）突发奇想cv了很多如”日群友“”上机“”举办“之类的js插件，感谢这些插件的原作者们喵
//感谢鸭佬（1564571378）&叶佬（1936472877）的热心帮助，没有他们这些将是一堆乱码awa
//支持v3系列崽
//记得把机器人设成群主
//有bug来共享管理（537866105）群反馈
//前3代已废弃，忘(lan)记(de)写日志了
//v4更新日志：增加了主人不会被随机抢走管理，管理转让给主人不会被禁言
//v5更新日志：新增"查看当前管理"、群开关、换管理许可证；权限判定统一改用 role，兼容 NapCat/SnowLuma 下 is_admin 缓存不同步的问题；增加用户操作锁
import plugin from '../../lib/plugins/plugin.js'
import cfg from '../../lib/config/config.js'
import _ from 'lodash'

const qiangcd = 43200;
const rangcd = 21600;

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

function getMasterList() {
  if (Array.isArray(cfg.masterQQ)) return cfg.masterQQ.map(Number).filter(n => !isNaN(n))
  return cfg.masterQQ ? [Number(cfg.masterQQ)].filter(n => !isNaN(n)) : []
}

/**
 * 非主人乱发指令时的处理：回复 + 禁言 5 分钟
 */
async function punishNonMaster(e, msg) {
  try { await e.reply(msg) } catch { }
  if (e.member?.is_owner) return
  try {
    await e.group.muteMember(e.user_id, 300)
  } catch (err) {
    logger.debug(`[换管理] 禁言惩罚失败: ${err.message}`)
  }
}

const ENABLE_KEY = (gid) => `Yz:qiang:group:${gid}:enabled`
const CARD_KEY = (gid) => `Yz:qiang:card:${gid}`

// ================= 用户操作锁 =================
const userBusy = new Map()

function isUserBusy(groupId, userId) {
  const key = `${groupId}:${userId}`
  const exp = userBusy.get(key)
  if (!exp) return false
  if (exp <= Date.now()) {
    userBusy.delete(key)
    return false
  }
  return true
}

function setUserBusy(groupId, userId, ms = 10000) {
  const key = `${groupId}:${userId}`
  userBusy.set(key, Date.now() + ms)
}

async function isGroupEnabled(groupId) {
  const v = await redis.get(ENABLE_KEY(groupId))
  return v === '1'
}

async function getCards(groupId) {
  try {
    const data = await redis.get(CARD_KEY(groupId))
    if (!data) return []
    const parsed = JSON.parse(data)
    return Array.isArray(parsed) ? parsed.map(Number).filter(n => !isNaN(n)) : []
  } catch (err) {
    logger.debug(`[换管理] 读取许可证失败: ${err.message}`)
    return []
  }
}

async function setCards(groupId, list) {
  const clean = [...new Set(list.map(Number).filter(n => !isNaN(n)))]
  await redis.set(CARD_KEY(groupId), JSON.stringify(clean))
}

async function hasCard(groupId, userId) {
  if (isMasterQQ(userId)) return true
  const cards = await getCards(groupId)
  return cards.map(String).includes(String(userId))
}

async function checkQiangPermission(e) {
  if (!await isGroupEnabled(e.group_id)) return false
  if (e.isMaster) return true
  if (!await hasCard(e.group_id, e.user_id)) {
    await e.reply('❌ 你没有换管理许可证')
    return false
  }
  return true
}

// ================= 退群自动除名监听 =================

Bot.on('notice.group.decrease', async (e) => {
  try {
    const botUin = (e.bot ?? Bot)?.uin
    if (botUin && String(e.user_id) === String(botUin)) return

    const userId = Number(e.user_id)
    if (!userId) return

    const cards = await getCards(e.group_id)
    if (!cards.includes(userId)) return

    const idx = cards.indexOf(userId)
    cards.splice(idx, 1)
    await setCards(e.group_id, cards)
    logger.info(`[换管理] ${userId} 退群，已从许可证名单除名`)
  } catch (err) {
    logger.debug(`[换管理] 退群监听失败: ${err.message}`)
  }
})

// ================= 成员信息 =================

async function getMemberFromMap(e, userId) {
  const id = String(userId)
  const numId = Number(id)

  try {
    if (e.bot?.sendApi) {
      const res = await e.bot.sendApi('get_group_member_info', {
        group_id: e.group_id,
        user_id: numId,
        no_cache: true,
      })
      const info = res?.data || res
      if (info?.role) {
        return {
          role: info.role,
          is_admin: info.role === 'admin' || info.role === 'owner',
          is_owner: info.role === 'owner',
          info,
        }
      }
    }
  } catch (err) {
    logger.debug(`[换管理] sendApi get_group_member_info 失败: ${err.message}`)
  }

  try {
    let member = e.group.pickMember(numId, true) || e.group.pickMember(numId)
    if (member) {
      const info = (await member.getInfo?.()) || member.info
      if (info?.role) {
        return {
          role: info.role,
          is_admin: info.role === 'admin' || info.role === 'owner',
          is_owner: info.role === 'owner',
          info,
        }
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
      return {
        role: info.role,
        is_admin: info.role === 'admin' || info.role === 'owner',
        is_owner: info.role === 'owner',
        info,
      }
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
      raw: fromApi.info,
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
        raw: info,
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
      name: '抢管理',
      dsc: '抢管理',
      event: 'message.group',
      priority: 500,
      rule: [
        { reg: '^#?开启换管理$', fnc: 'enableGroup' },
        { reg: '^#?关闭换管理$', fnc: 'disableGroup' },
        { reg: '^#?全体发证$', fnc: 'addCardAll' },
        { reg: '^#?全体收证$', fnc: 'delCardAll' },
        { reg: '^#?发证.*$', fnc: 'addCard' },
        { reg: '^#?收证.*$', fnc: 'delCard' },
        { reg: '^#?许可证名单$', fnc: 'cardList' },
        { reg: '^抢管理.*$', fnc: 'qiangadmin' },
        { reg: '^抢随机管理$', fnc: 'qiangsjad' },
        { reg: '^抢群主$', fnc: 'qiangowner' },
        { reg: '^管理转让.*$', fnc: 'zradmin' },
        { reg: '^管理随机转让$', fnc: 'zrsjad' },
        { reg: '^查看当前管理$', fnc: 'Adminlist' }
      ]
    })
  }

  // ================= 开关 =================

  async enableGroup(e) {
    if (!isMasterQQ(e.user_id)) return await punishNonMaster(e, '你没资格开启换管理啦')
    await redis.set(ENABLE_KEY(e.group_id), '1')

    const memberMap = await e.group.getMemberMap()
    const memberIds = new Set([...memberMap.keys()].map(Number))
    const cards = await getCards(e.group_id)

    const cleaned = cards.filter(id => memberIds.has(Number(id)))
    const removedCount = cards.length - cleaned.length

    const masters = getMasterList()
    let added = 0
    for (const m of masters) {
      if (memberIds.has(m) && !cleaned.includes(m)) {
        cleaned.push(m)
        added++
      }
    }
    await setCards(e.group_id, cleaned)

    await e.reply(`✅ 本群换管理功能已开启（清理 ${removedCount} 位不在群成员，写入 ${added} 位超级用户）`)
  }

  async disableGroup(e) {
    if (!isMasterQQ(e.user_id)) return await punishNonMaster(e, '你没资格关闭换管理啦')
    await redis.del(ENABLE_KEY(e.group_id))
    await e.reply(`✅ 本群换管理功能已关闭`)
  }

  // ================= 许可证 =================

  async addCard(e) {
    if (!isMasterQQ(e.user_id)) return await punishNonMaster(e, '你没资格发证啦')
    if (!e.at) return e.reply('你要给谁发证？', true)
    const target = Number(e.at)
    if (isMasterQQ(target)) return e.reply('对方是超级用户，无需发证', true)

    const cards = await getCards(e.group_id)
    if (!cards.includes(target)) cards.push(target)
    await setCards(e.group_id, cards)
    return e.reply('✅ 已发证', true)
  }

  async delCard(e) {
    if (!isMasterQQ(e.user_id)) return await punishNonMaster(e, '你没资格收证啦')
    if (!e.at) return e.reply('你要收谁的证？', true)
    const target = Number(e.at)
    if (isMasterQQ(target)) return e.reply('对方是超级用户，收证无效', true)

    let cards = await getCards(e.group_id)
    const idx = cards.indexOf(target)
    if (idx === -1) return e.reply('TA没有换管理许可证', true)
    cards.splice(idx, 1)
    await setCards(e.group_id, cards)
    return e.reply('✅ 已收证', true)
  }

  async addCardAll(e) {
    if (!isMasterQQ(e.user_id)) return await punishNonMaster(e, '你没资格发证啦')
    const memberMap = await e.group.getMemberMap()
    const targets = [...memberMap.keys()].map(Number).filter(id => !isNaN(id))
    const cards = await getCards(e.group_id)
    for (const t of targets) {
      if (!cards.includes(t)) cards.push(t)
    }
    await setCards(e.group_id, cards)
    return e.reply(`✅ 已全体发证（${targets.length}人，超级用户默认已有）`, true)
  }

  async delCardAll(e) {
    if (!isMasterQQ(e.user_id)) return await punishNonMaster(e, '你没资格收证啦')
    const cards = await getCards(e.group_id)
    const before = cards.length
    const remaining = cards.filter(id => isMasterQQ(id))
    await setCards(e.group_id, remaining)
    return e.reply(`✅ 已全体收证（原有${before}人，剩余${remaining.length}人，超级用户不受影响）`, true)
  }

  async cardList(e) {
    try {
      const cards = await getCards(e.group_id)
      if (cards.length === 0) {
        return await e.reply('本群当前没有换管理许可证持有者')
      }

      const memberMap = await e.group.getMemberMap()
      const memberIds = [...memberMap.keys()].map(Number).filter(n => !isNaN(n))
      const allIn = memberIds.length > 0 && memberIds.every(id => cards.includes(id))
      if (allIn) {
        return await e.reply('别查了，大家都可以来玩啦')
      }

      const getNick = (id) => {
        const m = memberMap.get(Number(id)) || memberMap.get(String(id))
        return m?.card || m?.nickname || String(id)
      }

      const nodes = cards.map((id, i) => {
        const tag = isMasterQQ(id) ? ' 【超级用户】' : ''
        return {
          user_id: String(e.self_id),
          nickname: '许可证名单',
          message: [
            `${i + 1}. ${getNick(id)}（${id}）${tag}\n`,
            segment.image(`https://q1.qlogo.cn/g?b=qq&s=100&nk=${id}`)
          ]
        }
      })

      try {
        const forwardMsg = await Bot.makeForwardMsg(nodes)
        await e.reply(forwardMsg)
      } catch (err) {
        logger.error('[换管理] 合并转发失败:', err)
        const text = cards.map((id, i) => {
          const tag = isMasterQQ(id) ? ' 【超级用户】' : ''
          return `${i + 1}. ${getNick(id)}（${id}）${tag}`
        }).join('\n')
        await e.reply(`本群换管理许可证共 ${cards.length} 人：\n${text}`)
      }
    } catch (err) {
      logger.error('[换管理] 许可证名单查询失败:', err)
      return await e.reply(`❌ 查询失败: ${err.message}`)
    }
  }

  // ================= 换管理主功能 =================

  async qiangadmin(e) {
    if (isUserBusy(e.group_id, e.user_id)) {
      return await e.reply('⚠️ 操作太快啦，请稍等几秒再试')
    }

    if (!await checkQiangPermission(e)) return true
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
      let msg = [segment.at(e.user_id), "狠狠地把管理猿", segment.at(e.at), "给撅翻了！然后把ta衣服扒了自己穿上惹"]
      await e.reply(msg)
      await e.group.setAdmin(e.at, false)
      await e.group.muteMember(e.at, 3600)
      await e.group.setAdmin(e.user_id, true)
      await refreshMemberCache(e.group)
      await redis.setEx(`getAdmin:lose:${e.group_id}:${e.at}`, qiangcd, '1')
      await redis.setEx(`getAdmin:win:${e.group_id}:${e.user_id}`, qiangcd, '1')
    } else {
      await redis.setEx(`getAdmin:win:${e.group_id}:${e.at}`, qiangcd, '1')
      let msg = [segment.at(e.user_id), "抢管理失败，接受愤怒的管理猿",segment.at(e.at),"の调♂教♂吧！"]
      await e.reply(msg)
      await e.group.muteMember(e.user_id, 3600)
    }
    return true
  }

  async qiangsjad(e) {
    if (isUserBusy(e.group_id, e.user_id)) {
      return await e.reply('⚠️ 操作太快啦，请稍等几秒再试')
    }

    if (!await checkQiangPermission(e)) return true
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
    if (adminList.length == 0) {
      await e.reply('本群没有可抢的管理员哦')
      return true
    }

    setUserBusy(e.group_id, e.user_id, 10000)

    const i = adminList[_.random(0, adminList.length - 1)]

    if (_.random(1, 2) === 1) {
      let msg = [segment.at(e.user_id), "狠狠地把管理", segment.at(i), "给撅翻了！然后把ta衣服扒了自己穿上惹"]
      await e.reply(msg)
      await e.group.setAdmin(i, false)
      await e.group.muteMember(i, 3600)
      await e.group.setAdmin(e.user_id, true)
      await refreshMemberCache(e.group)
      await redis.setEx(`getAdmin:lose:${e.group_id}:${i}`, qiangcd, '1')
      await redis.setEx(`getAdmin:win:${e.group_id}:${e.user_id}`, qiangcd, '1')
    } else {
      await redis.setEx(`getAdmin:win:${e.group_id}:${i}`, qiangcd, '1')
      await redis.setEx(`getAdmin:lose:${e.group_id}:${e.user_id}`, qiangcd, '1')
      let msg = [segment.at(e.user_id), "抢管理失败，接受愤怒的管理们の调♂教♂吧！"]
      await e.reply(msg)
      await e.group.muteMember(e.user_id, 3600)
    }
    return true
  }

  async qiangowner(e) {
    if (!await isGroupEnabled(e.group_id)) return true
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
    let msg = [segment.at(e.user_id),"就凭你也配直视我？（散兵音）"]
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

    if (!await checkQiangPermission(e)) return true
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
    if (target && target.role == 'admin') {
      await e.reply('脱裤子放屁?')
      await e.group.muteMember(e.user_id, 600)
      return true
    }

    setUserBusy(e.group_id, e.user_id, 10000)

    if (isMasterQQ(e.at)) {
      let msg = [segment.at(e.user_id),"好眼光！奖励你一次额外的机会抢管理~"]
      await e.reply(msg)
      await e.group.setAdmin(e.user_id, false)
      await e.group.setAdmin(e.at, true)
      await refreshMemberCache(e.group)
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
      let msg = [segment.at(e.user_id), "面色潮红地脱下了自己的胖次并交给了", segment.at(e.at), "，请妥善使用哦~", "\n然后由于某种神秘力量而翻白眼吐舌昏了过去（被玩坏惹）……"]
      await e.reply(msg)
      await e.group.setAdmin(e.user_id, false)
      await e.group.muteMember(e.user_id, 3600)
      await e.group.setAdmin(e.at, true)
      await refreshMemberCache(e.group)
      await redis.setEx(`getAdmin:set:${e.group_id}:${e.user_id}`, rangcd, '1')
      await redis.setEx(`getAdmin:get:${e.group_id}:${e.at}`, rangcd, '1')
    } else {
      await redis.setEx(`getAdmin:set:${e.group_id}:${e.user_id}`, rangcd, '1')
      await redis.setEx(`getAdmin:set:${e.group_id}:${e.at}`, rangcd, '1')
      let msg = [segment.at(e.user_id), "脱自己的胖次脱到一半竟然由于某种神秘力量而卡住动不了了！而", segment.at(e.at), "由于见到这一幕太激动而糕巢昏了过去。。转让失败"]
      await e.reply(msg)
      await e.group.muteMember(e.user_id, 3600)
      await e.group.muteMember(e.at, 3600)
    }
    return true
  }

  async zrsjad(e) {
    if (isUserBusy(e.group_id, e.user_id)) {
      return await e.reply('⚠️ 操作太快啦，请稍等几秒再试')
    }

    if (!await checkQiangPermission(e)) return true
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
      if (value.role == 'member') memberList.push(key)
    }
    if (memberList.length == 0) {
      await e.reply([
        `致敬传奇光杆司令_name_…`.replace("_name_", conf.botAlias[0]),
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
      let msg = [segment.at(e.user_id), "面色潮红地脱下了自己的胖次并交给了", segment.at(i), "，请妥善使用哦~", "\n然后由于某种神秘力量而翻白眼吐舌昏了过去（被玩坏惹）……"]
      await e.reply(msg)
      await e.group.setAdmin(i, true)
      await e.group.muteMember(e.user_id, 3600)
      await e.group.setAdmin(e.user_id, false)
      await refreshMemberCache(e.group)
      await redis.setEx(`getAdmin:set:${e.group_id}:${e.user_id}`, rangcd, '1')
      await redis.setEx(`getAdmin:get:${e.group_id}:${i}`, rangcd, '1')
    } else {
      await redis.setEx(`getAdmin:set:${e.group_id}:${e.user_id}`, rangcd, '1')
      let msg = [segment.at(e.user_id), "脱自己的胖次脱到一半竟然由于某种神秘力量而卡住动不了了！然后糕巢昏了过去。。转让失败"]
      await e.reply(msg)
      await e.group.muteMember(e.user_id, 3600)
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