//编程小白花菜（2253614815）突发奇想cv了很多如”日群友“”上机“”举办“之类的js插件，感谢这些插件的原作者们喵
//感谢鸭佬（1564571378）& 叶佬（1936472877）的热心帮助，没有他们这些将是一堆乱码awa
//支持v3系列崽
//记得把机器人设成群主
//有bug来🎭游戏尘寰🎭（537866105）群反馈
//前3代已废弃，忘(lan)记(de)写日志了
//v4更新日志：增加了主人不会被随机抢走管理，管理转让给主人不会被禁言
import plugin from '../../lib/plugins/plugin.js'
import cfg from '../../lib/config/config.js'
import _ from 'lodash'

const qiangcd = 43200;  //设置指定冷却时间1天，单位秒，可酌情自行修改
const rangcd = 21600;  //设置随机冷却时间1天，单位秒，可酌情自行修改
export class example extends plugin {
  constructor() {
    super({
      /** 功能名称 */
      name: '抢管理',
      /** 功能描述 */
      dsc: '简单开发示例',
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
        }
      ]
    })
  }

  async qiangadmin(e) {
    if (!e.group.is_owner)) {
      await e.reply("伦家不是群主啦！")
      return true
    }
    if (e.sender.role == 'admin' && !e.isMaster) {
      await e.reply([segment.at(e.user_id), "亲狗的爱管理，您可是被抢的一方哦？"])
      return true
    }
    let qq = e.message.filter(item => item.type == "at").map(item => item.qq)
    if (!e.at || e.at == e.self_id || !qq || !(/\d{5,}/.test(qq))) {
      await e.reply(["你抢谁呢！你抢谁呢！"])
      await e.group.muteMember(e.user_id, 600)
      return true
    }
    if (Array.isArray(cfg.masterQQ) ? cfg.masterQQ.includes(e.at) : cfg.masterQQ == e.at) {
      e.reply("TA不能被直接抢哦。")
      await e.group.muteMember(e.user_id, 600)
      return true
    }
    if (!e.group.pickMember(e.at).is_admin) {
      await e.reply('TA不是管理哦')
      await e.group.muteMember(e.user_id, 600)
      return true
    }
	if (e.sender.role == 'admin' && e.isMaster) {
      await e.reply([segment.at(e.user_id), "\n卡哇伊的狗修金sama，您既然是管理就别来捣乱哦？"])
      return true
    }
	if (e.isMaster && !e.sender.role == 'admin') {
      await e.reply("你是主人，没有cd")
    }
    const winCd = await redis.ttl(`getAdmin:win:${e.group_id}:${e.user_id}`)
    if (winCd > 0 && !e.isMaster) {
      await e.reply(`你还需要${secondsToHms(winCd)}之后才能抢哦`)
      return true
    }
    const loseCd = await redis.ttl(`getAdmin:lose:${e.at}:${e.user_id}`)
    if (loseCd > 0 && !e.isMaster) {
      await e.reply(`你还需要${secondsToHms(loseCd)}之后才能抢哦`)
      return true
    }

    if (_.random(1, 2) === 1) {
      let msg = [segment.at(e.user_id), "狠狠的把管理猿", segment.at(e.at), "给撅翻了！然后把ta衣服扒了自己穿上惹"]
      await e.reply(msg)
      await e.group.setAdmin(e.at, false)
      await e.group.muteMember(e.at, 3600)
      await e.group.setAdmin(e.user_id, true)
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
    if (e.sender.role == 'admin') {
      await e.reply([segment.at(e.user_id), "亲狗的爱管理，您可是被抢的一方哦？"])
      return true
    }
	if (e.isMaster) {
      await e.reply("你是主人，没有cd")
    }
    const winCd = await redis.ttl(`getAdmin:win:${e.group_id}:${e.user_id}`)
    if (winCd > 0 && !e.isMaster) {
      await e.reply(`你还需要${secondsToHms(winCd)}之后才能抢哦`)
      return true
    }

    // 随机不受对方CD限制
    const adminList = []
    for (const [key, value] of await e.group.getMemberMap()) {
      if (value.role == 'admin') adminList.push(key)
    }
    if (adminList.length == 0) {
      await e.reply('本群管理一个也没有哦')
      return true
    }
	const i = adminList[_.random(0, adminList.length - 1)]
    if (!(Array.isArray(cfg.masterQQ) ? cfg.masterQQ.includes(i) : cfg.masterQQ == i)) {
      if (_.random(1, 2) === 1) {
      
        let msg = [segment.at(e.user_id), "狠狠的把管理", segment.at(i), "给撅翻了！然后把ta衣服扒了自己穿上惹"]
        await e.reply(msg)
        await e.group.setAdmin(i, false)
        await e.group.muteMember(i, 3600)
        await e.group.setAdmin(e.user_id, true)
        await redis.setEx(`getAdmin:lose:${e.group_id}:${i}`, qiangcd, '1')
        await redis.setEx(`getAdmin:win:${e.group_id}:${e.user_id}`, qiangcd, '1')
      } else {
        await redis.setEx(`getAdmin:win:${e.group_id}:${i}`, qiangcd, '1')
        await redis.setEx(`getAdmin:lose:${e.group_id}:${e.user_id}`, qiangcd, '1')
        let msg = [segment.at(e.user_id), "抢管理失败，接受愤怒的管理们の调♂教♂吧！"]
        await e.reply(msg)
        await e.group.muteMember(e.user_id, 3600)
      }
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
      await common.sleep(2000)
      e.reply("您要真想来跟伦家抢群主的话……")
      await common.sleep(2000)
      e.reply("您还不如直接夺伦家滴舍哩~")
      return
    }
    let msg = [segment.at(e.user_id),"就凭你也配直视我？（散兵音）"]
    await this.e.reply(msg)
    setTimeout(async () => {
      await this.e.reply("轰————")
    }, 2000)
    e.group.muteMember(e.user_id, 3600)
    setTimeout(async () => {
      await this.e.reply("哼。")
    }, 2000)
    return true
  }

  async zradmin(e) {
    if (!e.group.is_owner) {
      e.reply("伦家不是群主啦！")
      return true
    }
    if (e.sender.role != 'admin') {
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
    if (e.group.pickMember(e.at).role == 'admin') {
      await e.reply('脱裤子放屁?')
      await e.group.muteMember(e.user_id, 600)
      return true
    }
    if (Array.isArray(cfg.masterQQ) ? cfg.masterQQ.includes(e.at) : cfg.masterQQ == e.at) 	{
	  let msg = [segment.at(e.user_id),"好眼光！奖励你一次额外的机会抢管理~"]
	  await e.reply(msg)
      await e.group.setAdmin(e.user_id, false)
	  await e.group.setAdmin(e.at, true)
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
    const getCd = await redis.ttl(`getAdmin:get:${e.at}:${e.user_id}`)
    if (getCd > 0 && !e.isMaster) {
      await e.reply(`TA还需要${secondsToHms(getCd)}之后才能转让哦`)
      return true
    }

    if (_.random(1, 2) === 1) {
      let msg = [segment.at(e.user_id), "面色潮红地脱下了自己的胖次并交给了", segment.at(e.at), "，请妥善使用哦~", "\n然后由于某种神秘力量而翻白眼吐舌昏了过去（被玩坏惹）……"]
      await e.reply(msg)
      await e.group.setAdmin(e.user_id, false)
      await e.group.muteMember(e.user_id, 3600) //转让怎么还禁言？因为已经昏了过去（确信）
      await e.group.setAdmin(e.at, true)
      await redis.setEx(`getAdmin:set:${e.group_id}:${e.user_id}`, rangcd, '1')
      await redis.setEx(`getAdmin:get:${e.group_id}:${e.at}`, rangcd, '1')
    } else {
      await redis.setEx(`getAdmin:set:${e.group_id}:${e.user_id}`, rangcd, '1')
      await redis.setEx(`getAdmin:set:${e.group_id}:${e.at}`, rangcd, '1')
      let msg = [segment.at(e.user_id), "脱自己的胖次脱到一半竟然由于某种神秘力量而卡住动不了了！而", segment.at(e.at), "由于见到这一幕太激动而糕巢昏了过去。。转让失败"]
      await e.reply(msg)
      await e.group.muteMember(e.user_id, 3600)
	  await e.group.muteMember(e.at, 3600) //转让失败两者都会被禁言
    }
    return true
  }

  async zrsjad(e) {
    if (!e.group.is_owner) {
      e.reply("伦家不是群主啦！")
      return true
    }
    if (e.sender.role != 'admin') {
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
      await this.e.reply([
	  `致敬传奇光杆司令_name_…`
	  .replace("_name_",conf.botAlias[0]),  
	  ])
	  await common.sleep(2000)
	  await e.reply("Man!"),
	  await common.sleep(2000)
	  await e.reply("What can I say…"),
	  await common.sleep(2000)
	  await e.reply([
	  `_name_ out.`
	  .replace("_name_",conf.botAlias[0]),  
	  ])
      await common.sleep(2000)
      await e.reply("呵↑呵↓呵.")
      return true
    }
    const i = memberList[_.random(0, memberList.length - 1)]
    if (_.random(1, 2) === 1) {
      let msg = [segment.at(e.user_id), "面色潮红地脱下了自己的胖次并交给了", segment.at(i), "，请妥善使用哦~", "\n然后翻白眼吐舌昏了过去（被玩坏惹）……"]
      await e.reply(msg)
      await e.group.setAdmin(i, true)
      await e.group.muteMember(e.user_id, 3600) //转让怎么还禁言？因为已经昏了过去（确信）
      await e.group.setAdmin(e.user_id, false)
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