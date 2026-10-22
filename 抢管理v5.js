//编程小白花菜（2253614815）突发奇想cv了很多如”日群友“”上机“”举办“之类的js插件，感谢这些插件的原作者们喵
//感谢鸭佬（1564571378）&叶佬（1936472877）的热心帮助，没有他们这些将是一堆乱码awa
//支持v3系列崽
//记得把机器人设成群主
//有bug来共享管理（537866105）群反馈
//前3代已废弃，忘(lan)记(de)写日志了
//v4更新日志：增加了主人不会被随机抢走管理，管理转让给主人不会被禁言
//v5更新日志：新增"查看当前管理"；权限判定统一改用 role，兼容 NapCat/SnowLuma 下 is_admin 缓存不同步的问题
import plugin from '../../lib/plugins/plugin.js'
import cfg from '../../lib/config/config.js'
import _ from 'lodash'

const qiangcd = 43200;  //设置指定冷却时间1天，单位秒，可酌情自行修改
const rangcd = 21600;  //设置随机冷却时间1天，单位秒，可酌情自行修改

// [FIX] 兼容旧写法，替代 common.sleep
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
// [FIX] 兼容旧写法，conf 指向 cfg
const conf = cfg

/**
 * [核心] 拿指定成员的准确 role
 * 优先级：
 *   1) 直接调用 OneBot API get_group_member_info（带 no_cache，强制协议端拉新）
 *   2) pickMember(id, true).getInfo()
 *   3) getMemberMap()
 */
async function getMemberFromMap(e, userId) {
  const id = String(userId)
  const numId = Number(id)

  // ---- 1) OneBot API 强制拉取 ----
  try {
    if (e.bot?.sendApi) {
      const res = await e.bot.sendApi('get_group_member_info', {
        group_id: e.group_id,
        user_id: numId,
        no_cache: true,
      })
      // 不同适配器可能把数据包在 data 里
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
    logger.debug(`[抢管理] sendApi get_group_member_info 失败: ${err.message}`)
  }

  // ---- 2) pickMember + getInfo ----
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
    logger.debug(`[抢管理] pickMember.getInfo 失败: ${err.message}`)
  }

  // ---- 3) 退化到 getMemberMap ----
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
    logger.debug(`[抢管理] getMemberMap 失败: ${err.message}`)
  }

  return null
}

/**
 * [核心] 安全获取被 at 的群成员
 */
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
    logger.debug(`[抢管理] pickMember 失败: ${err.message}`)
  }

  return null
}

/**
 * [辅助] setAdmin 之后主动刷一次成员缓存
 * 双刷 + sleep，尽量让 NapCat/SnowLuma 协议端同步完
 */
async function refreshMemberCache(group) {
  try {
    await group.getMemberMap()
    await sleep(500)
    await group.getMemberMap()
  } catch (err) {
    logger.debug(`[抢管理] 刷新成员缓存失败: ${err.message}`)
  }
}

/**
 * [辅助] 判断某个 id 是不是主人
 */
function isMasterQQ(id) {
  const sid = String(id)
  return Array.isArray(cfg.masterQQ)
    ? cfg.masterQQ.some(m => String(m) === sid)
    : String(cfg.masterQQ) === sid
}

/**
 * [辅助] 自己是管理则拒绝，按主人/非主人给不同文案
 */
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

export class example extends plugin {
  constructor() {
    super({
      /** 功能名称 */
      name: '抢管理v5',
      /** 功能描述 */
      dsc: '抢管理v5',
      /** https://oicqjs.github.io/oicq/#events */
      event: 'message.group',
      /** 优先级，数字越小等级越高 */
      priority: 500,
      rule: [
        {
          /** 命令正则匹配 */
          reg: '^抢管理.*$',
          /** 执行方法 */
          fnc: 'qiangadmin'
        },
        {
          /** 命令正则匹配 */
          reg: '^抢随机管理$',
          /** 执行方法 */
          fnc: 'qiangsjad'
        },
        {
          /** 命令正则匹配 */
          reg: '^抢群主$',
          /** 执行方法 */
          fnc: 'qiangowner'
        }, {
          /** 命令正则匹配 */
          reg: '^管理转让.*$',
          /** 执行方法 */
          fnc: 'zradmin'
        },
        {
          /** 命令正则匹配 */
          reg: '^管理随机转让$',
          /** 执行方法 */
          fnc: 'zrsjad'
        },
        {
          /** [新增] 查看当前管理 */
          reg: '^查看当前管理$',
          /** 执行方法 */
          fnc: 'Adminlist'
        }
      ]
    })
  }

  async qiangadmin(e) {
    if (!e.group.is_owner) {
      await e.reply("伦家不是群主啦！")
      return true
    }
    if (await checkSelfIsAdminAndReject(e)) return true
    if (e.isMaster) {
      await e.reply("你是主人，没有cd")
    }

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
    if (!e.group.is_owner) {
      e.reply("伦家不是群主啦！")
      return true
    }
    if (await checkSelfIsAdminAndReject(e)) return true
    if (e.isMaster) {
      await e.reply("你是主人，没有cd")
    }

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
    setTimeout(() => {
      group.sendMsg("轰————")
    }, 2000)
    await e.group.muteMember(e.user_id, 3600)
    setTimeout(() => {
      group.sendMsg("哼。")
    }, 2000)
    return true
  }

  async zradmin(e) {
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
    if (isMasterQQ(e.at)) {
      let msg = [segment.at(e.user_id),"好眼光！奖励你一次额外的机会抢管理~"]
      await e.reply(msg)
      await e.group.setAdmin(e.user_id, false)
      await e.group.setAdmin(e.at, true)
      await refreshMemberCache(e.group)
      return true
    }
    if (e.isMaster) {
      await e.reply("你是主人，没有cd")
    }

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
    if (e.isMaster) {
      await e.reply("你是主人，没有cd")
    }
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
        `致敬传奇光杆司令_name_…`
          .replace("_name_", conf.botAlias[0]),
      ])
      await sleep(2000)
      await e.reply("Man!")
      await sleep(2000)
      await e.reply("What can I say…")
      await sleep(2000)
      await e.reply([
        `_name_ out.`
          .replace("_name_", conf.botAlias[0]),
      ])
      await sleep(2000)
      await e.reply("呵↑呵↓呵.")
      return true
    }
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

  // [新增] 查看当前管理
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
        owner = {
          user_id: userId,
          nickname: info.card || info.nickname || String(userId),
        }
        continue
      }
      if (info.role === 'admin') {
        admins.push({
          user_id: userId,
          nickname: info.card || info.nickname || String(userId),
        })
      }
    }

    const list = []
    if (!e.group.is_owner && owner) {
      list.push({ ...owner, role: '群主' })
    }
    for (const a of admins) {
      list.push({ ...a, role: '管理' })
    }

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
      logger.error('[抢管理] 合并转发失败:', err)
      const text = list.map((a, i) => `${i + 1}、${a.nickname}（${a.user_id}）【${a.role}】`).join('\n')
      await e.reply(`本群管理员共 ${list.length} 人：\n${text}`)
    }
    return true
  }
}

function secondsToHms(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const parts = [];
  if (h > 0) {
    parts.push(`${h} 小时`);
  }
  if (m > 0 || h > 0) {
    parts.push(`${m} 分钟`);
  }
  parts.push(`${s} 秒`);
  return parts.join(' ');
}