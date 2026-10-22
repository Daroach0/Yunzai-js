// ================= 抽头衔 更新日志 =================
// v1 初始版本：
// - 基础抽头衔功能（每日3次，冷却1小时）
// - 欧皇专属头衔及随机时长
// - 定时任务自动过期恢复头衔（防重复注册机制）
//
// v2 更新（2026-10-22）：
// - 新增：#当前欧皇 查询指令，合并转发展示群内所有欧皇及剩余时间
// - 新增：#当前欧皇 智能扫描，自动检测并清理已提前换掉头衔的无效记录
// - 新增：大量新头衔加入奖池（含性别、日常、抽象用语）
// - 优化：适配 SnowLuma 新版，移除临时空格兜底，恢复原生清空逻辑
// - 修复：提前抽到新头衔时，旧欧皇 key 残留未清理的问题
// - 修复：定时任务在接近分钟节点时（如30秒后过期）被漏扫的问题
// - 修复：热重载后 setTimeout 丢失及 API 实例失效的问题
// ===================================================

import plugin from '../../lib/plugins/plugin.js'
import schedule from "node-schedule";
import cfg from '../../lib/config/config.js'

// 每日使用次数
const userDailyUsage = new Map();
// 冷却时间
const userCooldown = new Map();
// 用户操作锁
const userBusy = new Map()

function isUserBusy(gid, uid) {
    const key = `${gid}:${uid}`
    const exp = userBusy.get(key)
    if (!exp) return false
    if (exp <= Date.now()) { userBusy.delete(key); return false }
    return true
}
function setUserBusy(gid, uid, ms = 10000) {
    userBusy.set(`${gid}:${uid}`, Date.now() + ms)
}

function isMasterQQ(userId) {
    if (!cfg.masterQQ) return false
    const id = String(userId)
    return Array.isArray(cfg.masterQQ)
        ? cfg.masterQQ.some(m => String(m) === id)
        : String(cfg.masterQQ) === id
}

async function punishNonMaster(e, msg) {
    try { await e.reply(msg) } catch { }
    if (e.member?.is_owner) return
    try { await e.group.muteMember(e.user_id, 300) } catch (err) {
        logger.debug(`[抽头衔] 禁言惩罚失败: ${err.message}`)
    }
}

// 成员信息三级兜底（缓存优先 + 超时）
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
                    no_cache: true,
                }),
                new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 3000)),
            ])
            const info = res?.data || res
            if (info?.role) {
                return { role: info.role, is_admin: info.role === 'admin' || info.role === 'owner', is_owner: info.role === 'owner', info }
            }
        }
    } catch (err) {
        logger.debug(`[抽头衔] sendApi 失败/超时: ${err.message}`)
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
        logger.debug(`[抽头衔] pickMember.getInfo 失败: ${err.message}`)
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
        logger.debug(`[抽头衔] getMemberMap 失败: ${err.message}`)
    }

    return null
}

// 清空头衔：新版 SnowLuma 已修复，直接用空字符串
async function clearTitle(e, groupId, userId) {
    try {
        if (e.bot?.sendApi) {
            const res = await e.bot.sendApi('set_group_special_title', {
                group_id: Number(groupId),
                user_id: Number(userId),
                special_title: '',
                duration: -1,
            })
            logger.info(`[抽头衔] 清空头衔返回: ${JSON.stringify(res)}`)
            return res
        }
        await e.group.setTitle(userId, '', -1)
        return true
    } catch (err) {
        logger.error(`[抽头衔] 清空头衔失败: ${err.message}`)
        return false
    }
}

export class example extends plugin {
    constructor() {
        super({
            name: "抽头衔",
            dsc: "如名字所说",
            event: "message.group",
            priority: 1,
            rule: [
                { reg: '^#?抽头衔$', fnc: 'ctx' },
                { reg: '^#?恢复默认头衔$', fnc: 'mr' },
                { reg: '^#?当前欧皇$', fnc: 'currentOuhuang' }
            ]
        });

        // 包含了所有历史头衔、空格兜底、以及新增的抽象词汇
        this.Title = [
            "花菜の⭐😡", "凑蓝桶", "湊蓝瞳", "臭男同", "抽南通", "🥦の星怒",
            "欧皇专属头衔", "0", "小南梁", "笑楠良", "魈兰粮", "挖掘机",
            "华彩嘚√", "想要索尼机子", "卧思可哀南梁", "入机",
            "1", "爱岛关子", "好女孩", "cbz", "好标志", "好男孩", "男标志", 
            "小草神杯子", " ", "滚木", "男神", "女神", "宝宝", "香铝铜",
            "？！强强！？", "？！弱弱！？", "？！拉拉！？", "？！给给！？", 
            "祥木", "久木", "顺直", "直男", "直女"
        ];

        this.resetDailyUsage();
    }

    async ctx(e) {
        if (!e.group.is_owner) return e.reply("伦家不是群主啦！");

        if (isUserBusy(e.group_id, e.user_id)) {
            return await e.reply('⚠️ 操作太快啦，请稍等几秒再试')
        }

        if (e.user_id === 936640630) {
            e.reply("枭南梁就是枭南梁抽什么头衔一边玩去");
            e.group.setTitle(e.user_id, "挖掘机枭南梁");
            return true
        }

        const maxDailyUsage = 3;
        const today = new Date().toDateString();
        const userUsage = userDailyUsage.get(e.user_id) || { date: today, count: 0 };
        if (userUsage.date !== today) {
            userUsage.date = today;
            userUsage.count = 0;
        }
        if (userUsage.count >= maxDailyUsage && !e.isMaster) {
            return e.reply("❎ 今日使用次数已达上限，大侠请明天再来", true);
        }

        const cooldownTime = 60 * 60 * 1000;
        const lastUseTime = userCooldown.get(e.user_id) || 0;
        const now = Date.now();
        if (now - lastUseTime < cooldownTime && !e.isMaster) {
            const remainingTime = Math.ceil((cooldownTime - (now - lastUseTime)) / 1000 / 60);
            return e.reply(`❎ 操作过于频繁，请 ${remainingTime} 分钟后再试！`, true);
        }

        setUserBusy(e.group_id, e.user_id, 10000)

        userCooldown.set(e.user_id, now);
        userUsage.count++;
        userDailyUsage.set(e.user_id, userUsage);

        const self = await getMemberFromMap(e, e.user_id)
        const currentTitle = self?.info?.title ?? ''

        const isTitleEmpty = !currentTitle || currentTitle.trim() === ''
        if (!isTitleEmpty && !this.Title.includes(currentTitle)) {
            return e.reply("你已拥有某菜亲自赋予的抽不到的专属头衔，请联系某菜申请修改", true);
        }

        const T = this.Title[Math.floor(Math.random() * this.Title.length)];
        const res = await e.group.setTitle(e.user_id, T);
        if (!res) return e.reply("❎ 未知错误", true);

        // 抽出新头衔时，必须先清掉可能存在的旧欧皇 key
        try {
            await redis.del(`Yz:ouhuang:${e.group_id}:${e.user_id}`)
        } catch { }

        if (T === "欧皇专属头衔") {
            let time = 5 * 60
            const rand_num = Math.random()
            if (rand_num < 0.2) time = rand(60, 300)
            else if (rand_num > 0.95) time = rand(10 * 24 * 60 * 60, 30 * 24 * 60 * 60)
            else if (rand_num > 0.85) time = rand(5 * 24 * 60 * 60, 10 * 24 * 60 * 60)
            else if (rand_num > 0.7) time = rand(1 * 24 * 60 * 60, 5 * 24 * 60 * 60)
            else time = rand(300, 1 * 24 * 60 * 60)

            e.reply(`本次欧皇时长：${formatTime(time)}`, true)
            await redis.set(
                `Yz:ouhuang:${e.group_id}:${e.user_id}`,
                JSON.stringify({ qq: e.user_id, gid: e.group_id, time }),
                { EX: time }
            )
            return true
        }

        e.reply(`✅ 恭喜你获得了新的头衔「${T}」并已更换`, true);
        return true;
    }

    async mr(e) {
        if (!isMasterQQ(e.user_id)) return await punishNonMaster(e, '你没资格恢复默认头衔啦')

        // 清理可能存在的欧皇 key
        try {
            await redis.del(`Yz:ouhuang:${e.group_id}:${e.user_id}`)
        } catch { }

        const res = await clearTitle(e, e.group_id, e.user_id)
        if (!res) {
            return e.reply('❌ 恢复失败，协议端可能不支持清空头衔', true)
        }
        return e.reply('头衔已恢复默认', true)
    }

    // 查看当前欧皇（带智能验证与清理）
    async currentOuhuang(e) {
        try {
            const keys = await redis.keys(`Yz:ouhuang:${e.group_id}:*`)
            if (keys.length === 0) {
                return await e.reply('本群当前没有欧皇哦~')
            }

            // 获取最新群成员列表用于校验
            const memberMap = await e.group.getMemberMap()
            
            const list = []
            let cleaned = 0
            
            for (const key of keys) {
                const raw = await redis.get(key)
                if (!raw) continue
                const ttl = await redis.ttl(key)
                
                if (ttl <= 0) {
                    await redis.del(key)
                    continue
                }

                try {
                    const data = JSON.parse(raw)
                    const m = memberMap.get(Number(data.qq)) || memberMap.get(String(data.qq))
                    
                    if (!m) {
                        // 用户已经不在群里了
                        await redis.del(key)
                        cleaned++
                        continue
                    }
                    
                    const realTitle = m.title || ''
                    // 校验真实头衔：如果不是欧皇，说明提前换掉了，顺手清理
                    if (realTitle !== '欧皇专属头衔' && realTitle !== '测试欧皇') {
                        await redis.del(key)
                        cleaned++
                        continue
                    }
                    
                    list.push({ 
                        qq: data.qq, 
                        ttl, 
                        nick: m.card || m.nickname || String(data.qq)
                    })
                } catch { }
            }

            if (list.length === 0) {
                let msg = '本群当前没有欧皇哦~'
                if (cleaned > 0) msg += `\n（已自动清理 ${cleaned} 位失效的欧皇记录）`
                return await e.reply(msg)
            }

            // 按剩余时间从短到长排序
            list.sort((a, b) => a.ttl - b.ttl)

            const nodes = []
            nodes.push({
                user_id: String(e.self_id),
                nickname: '欧皇列表',
                message: `当前群共有 ${list.length} 位欧皇：` + (cleaned > 0 ? `\n（已自动清理 ${cleaned} 条失效记录）` : '')
            })

            for (const item of list) {
                nodes.push({
                    user_id: String(e.self_id),
                    nickname: item.nick,
                    message: [
                        `欧皇：${item.nick} (${item.qq})\n`,
                        `剩余时间：${formatTime(item.ttl)}`
                    ]
                })
            }

            try {
                const forwardMsg = await Bot.makeForwardMsg(nodes)
                await e.reply(forwardMsg)
            } catch (err) {
                logger.error('[抽头衔] 当前欧皇合并转发失败:', err)
                const text = list.map((item, i) => {
                    return `${i + 1}. ${item.nick} (${item.qq}) - 剩余 ${formatTime(item.ttl)}`
                }).join('\n')
                await e.reply(`本群当前欧皇共 ${list.length} 人：\n${text}`)
            }
        } catch (err) {
            logger.error('[抽头衔] 查询当前欧皇失败:', err)
            return await e.reply(`❌ 查询失败: ${err.message}`)
        }
    }

    resetDailyUsage() {
        const now = new Date();
        const nextMidnight = new Date(now);
        nextMidnight.setHours(24, 0, 0, 0);
        const timeUntilMidnight = nextMidnight - now;
        setTimeout(() => {
            userDailyUsage.clear();
            this.resetDailyUsage();
        }, timeUntilMidnight);
    }
}

// ================= 欧皇过期定时任务 =================
if (!global.__ouhuangScheduleRegistered) {
    global.__ouhuangScheduleRegistered = true
    const scheduledKeys = new Set()

    async function processOuhuangKey(key) {
        try {
            const raw = await redis.get(key)
            if (!raw) {
                scheduledKeys.delete(key)
                return
            }
            await redis.del(key)

            let data
            try {
                data = JSON.parse(raw)
            } catch {
                scheduledKeys.delete(key)
                return
            }

            const g = Bot.pickGroup(Number(data.gid))
            if (!g) {
                scheduledKeys.delete(key)
                return
            }

            try {
                await g.sendMsg([
                    segment.at(Number(data.qq)),
                    `\n众所周知欧皇寿命极短\n——你的「欧皇专属头衔」已过期，已恢复为默认头衔。`
                ])
            } catch (err) {
                logger.error(`[抽头衔] 发送过期提示失败: ${err.message}`)
            }

            // 遍历 Bot.uin 寻找有效的 Bot 实例来调用 API
            try {
                let targetBot = null
                for (const uin of Bot.uin) {
                    if (Bot[uin].gl && Bot[uin].gl.has(Number(data.gid))) {
                        targetBot = Bot[uin]
                        break
                    }
                }

                if (targetBot && targetBot.sendApi) {
                    const res = await targetBot.sendApi('set_group_special_title', {
                        group_id: Number(data.gid),
                        user_id: Number(data.qq),
                        special_title: '', // 新版已修复
                        duration: -1,
                    })
                    logger.info(`[抽头衔] 定时清空头衔(通过bot实例)返回: ${JSON.stringify(res)}`)
                } else {
                    logger.warn(`[抽头衔] 未找到群 ${data.gid} 对应的 Bot 实例，尝试降级调用`)
                    await g.setTitle(data.qq, '', -1)
                }
            } catch (err) {
                logger.error(`[抽头衔] 定时清空头衔报错: ${err.message}`)
            }
        } catch (err) {
            logger.error(`[抽头衔] 处理欧皇过期失败: ${err.message}`)
        } finally {
            scheduledKeys.delete(key)
        }
    }

    schedule.scheduleJob("0 * * * * ?", async () => {
        try {
            const keys = await redis.keys(`Yz:ouhuang:*`)
            for (const key of keys) {
                if (scheduledKeys.has(key)) continue

                const ttl = await redis.ttl(key)
                
                // 如果已经过期或没设置过期时间，直接清理
                if (ttl === -2 || ttl === -1) {
                    await redis.del(key)
                    continue
                }

                // 【核心修复】只要还有剩余时间，立刻安排 setTimeout，避免漏扫
                if (ttl > 0) {
                    scheduledKeys.add(key)
                    setTimeout(() => processOuhuangKey(key), ttl * 1000)
                }
            }
        } catch (err) {
            logger.error(`[抽头衔] 欧皇过期监听失败: ${err.message}`)
        }
    })

    logger.info('[抽头衔] 欧皇过期定时任务已注册（本次进程仅一次）')
}

function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}
function formatTime(t) {
    let d = parseInt(t / 60 / 60 / 24)
    let h = parseInt(t / 60 / 60 % 24)
    let m = parseInt(t / 60 % 60)
    let s = parseInt(t % 60)
    let str = `${m}分${s}秒`
    if (d || h) str = `${h}小时` + str
    if (d) str = `${d}天` + str
    return str
}