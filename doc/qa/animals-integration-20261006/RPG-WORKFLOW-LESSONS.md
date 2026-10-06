# 动物消费接入经验

- 渲染、脚点、碰撞、热点必须来自同一个已准入projection。审核缺失/继承/额外字段不能通过；没图就不能留下隐形阻挡或热点。
- 生产者隔离renderer与18人fixture不足以证明正式19居民消费。读取当前rooms/residentRoutes/Mira/dynamicWorld，保留服务器合法居民走廊；客户端真实脚点不等于服务器已知临时位置。
- 临时运动按真实rAF推进，游戏时间按原事务推进。持久记忆沿原CAS/receipt/store；只在receipt接受后反应，切图/跳时/读档重置临时状态。
- 真实触点测试需elementFromPoint与正常mouse/键盘；locator超时应区分pointer-events、离屏和真实产品问题。不得用force click掩盖。
- 闭包第一次scene不能写回当前碰撞场景。常规切图后持续方向键碰撞测试应确认休息动物不被推动，不能只查切图后有纹理。
- HMR、异步NPC同步与测试字段缺失都可能让名义PASS失真。最终验收冻结dist、保存bundleSHA并读取实际RPGJS事件/Pixi纹理；未暴露worldAlpha时如实限制。
- 平台构图与外部guest横幅分开留证，保留真实shell。公共脚本可能含版本查询，应限制固定origin/path GET；不开放其他外部写入或改游戏padding。
- AI单图、同族、场景与技术门禁分别记录。游戏本地消费接受不意味着库profile/rights完成，也不等于发布批准；来源SHA/批准POST账和拒绝历史必须可追溯。

今后在批准共享技能回写时，将上述实证写入 `/Users/yin/code/games/.agents/skills/build-spatial-story-game/references/` 对应条目，并用 `/Users/yin/code/games/memory/` 索引链接。本次只保存项目证据，不改共享规则或原存档。
