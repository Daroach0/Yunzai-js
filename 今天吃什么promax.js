import plugin from '../../lib/plugins/plugin.js'
import fs from 'node:fs'
import co from "../../lib/common/common.js"
import { promisify } from "util"
import { pipeline } from "stream"
const food_path = "plugins/example/resources/img/foods/"
const files = fs.readdirSync(`${food_path}`)

let source = {}

await tp()
export class 今天吃什么 extends plugin {
  constructor () {
    super({
      name: '今天吃什么',
      dsc: '今天吃什么',
      event: 'message',
      priority: 500,
      rule: [
        {
          reg: '^#*[\u4e00-\u9fa5]+(吃|次|尝)(什么|啥)[呢捏啊鸭呀吖]?[~～.。,，!！、？]?$',
          fnc: 'jtcsm'
        },
		{
		  reg: '^#*加入套餐(.*)$',
		  fnc: 'jrtc'
		},
		{
		  reg: '^#*KHC菜单$',
		  fnc: 'cd'
		},
		{
		  reg: '^#*删除套餐(.*)$',
          fnc: 'sctc'		  
		}
      ]
    })
  }
async jtcsm(e) {
    if (files.length === 0) {
        e.reply("目前没有套餐，请先使用【加入套餐】添加食物图片。");
        return true;
    }

    let k = Math.floor(Math.random() * files.length); 
    let o = files[k].replace(/.jpg|.png/g, "").trim();

    // 提取关键词（“吃”或“次”）
    let keyword = ("吃"|"次"|"尝")
     if (e.msg.includes("吃")) {
        keyword = "吃";
     }
     if (e.msg.includes("次")) {
        keyword = "次";
     } 
     if (e.msg.includes("尝")) {
        keyword = "尝";
     }

    let userMsg = e.msg.replace(/我/g, "你"); // 将“我”替换为“你”
    userMsg = userMsg.replace(/(吃|次|尝)(什么|啥)/g, '').trim();

    let replyMsg;
    if (keyword === "吃") {
        replyMsg = `${userMsg}去${keyword}${o}吧~`;
    } 
    if (keyword === "次") {
        replyMsg = `${userMsg}去${keyword}${o}吧~`;
    }
    if (keyword === "尝") {
        replyMsg = `${userMsg}去${keyword}${o}吧~`;
    }
    
    let msg = [
        segment.at(e.user_id),
        replyMsg,
        segment.image(`${food_path}${files[k]}`)
    ];

    e.reply(msg);
    return true;
}

async jrtc(e){
	if (!e.isMaster) return e.reply("只有主人能上传!!!")
    let msg = e.msg.replace(/#|套餐|加入/g, "").trim();
  if (!fs.existsSync(food_path)) {
         fs.mkdirSync(food_path, { recursive: true });
     }
     const files = fs.readdirSync(food_path);
  if(!msg){
    e.reply("请输入套餐名");
	return true;
  }

    if (e.isGroup) {
      source = (await e.group.getChatHistory(e.source?.seq, 1)).pop()
    } else {
      source = (await e.friend.getChatHistory((e.source?.time + 1), 1)).pop()
    }
    let imageMessages = []
    if (source) {
      for (let val of source.message) {
        if (val.type === "image") {
          imageMessages.push(val.url)
        } else if (val.type === "xml") {
          let resid = val.data.match(/m_resid="(.*?)"/)[1]
          if (!resid) break
          let message = await Bot.getForwardMsg(resid)
          for (const item of message) {
            for (const i of item.message) {
              if (i.type === "image") {
                imageMessages.push(i.url)
              }
            }
          }
        }
      }
    } else {
      imageMessages = e.img
    }
    if (!imageMessages.length) return e.reply("消息中未找到图片，请将要发送的图片与消息一同发送或者引用要添加的图像哟~")
    try {
      let savePath
      let File
      if (!fs.existsSync(food_path)) fs.mkdirSync(food_path)
      for (let i = 0; i < imageMessages.length; i++) {
        File = fs.readdirSync(food_path)
        savePath = `${food_path}${msg}.jpg`
        await co.downFile(imageMessages[i], savePath)
      }
      e.reply(`已成功加入KHC(开花菜)豪华套餐${imageMessages.length}份`)
    } catch (err) {
      logger.error(err)
      e.reply("加入套餐失败")
    }
    return true
  }

async cd(e) {
    if (!fs.existsSync(food_path)) {
        e.reply("目前一道菜都没有，请使用【加入套餐】添加食物图片。");
        return true;
    }

    let files;
    try {
        files = fs.readdirSync(food_path);
    } catch (err) {
        logger.error("读取食物目录失败：", err);
        e.reply("读取食物目录失败，请检查插件配置。");
        return true;
    }

    if (files.length === 0) {
        e.reply("目前一道菜都没有，请使用【加入套餐】添加食物图片。");
        return true;
    }

    let msglist = [];
    msglist.push(`KHC(开花菜)套餐共${files.length}份，可输入【加入/删除套餐+(套餐名)】进行添加/删除`);

    for (let i = 0; i < files.length; i++) {
        let foodName = files[i].replace(/.jpg|.png/g, "").trim();
        msglist.push([
            `${i + 1}. ${foodName}`,
            segment.image(`file://${food_path}${files[i]}`)
        ]);
    }

    try {
        let msgRsg = await e.reply(await co.makeForwardMsg(e, msglist));
        if (!msgRsg) {
            e.reply("可能风控了，私聊查看试试", true);
        }
    } catch (err) {
        logger.error("发送消息失败：", err);
        e.reply("发送消息失败，请稍后重试。");
    }
}
async sctc(e){
	if (!e.isMaster) return this.reply("只有主人能删除!!!")
    let msg = e.msg.replace(/#|套餐|删除/g, "").trim();
    if (!msg) {
      return e.reply("没套餐名要不先【KHC菜单】查看下图片对应的套餐名...")
    }
    try {
      let File = fs.readdirSync(food_path)
      fs.unlinkSync(`${food_path}${msg}.jpg`)
      await e.reply("删除成功")
    } catch (err) {
      e.reply("删除失败，请检查套餐名是否正确")
    }
  }
}

async function tp() {
         if (!fs.existsSync(food_path)) {
             fs.mkdirSync(food_path, { recursive: true });
         }
     }