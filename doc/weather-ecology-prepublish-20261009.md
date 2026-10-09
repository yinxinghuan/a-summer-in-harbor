# 天气生态正式启用的接缝与发布约束

本候选基于 a245776 / 正式58，正式入口启用 ecology:true。预发布发现旧58存档第一次固定政策时，已有猫脚点会被重置到 homePoint；修复保留同场景同日程区间的当前可见脚点。真实单位失败前为(828,644)→(756,638)，修复后无瞬移。原夜间/跨时段日程、安全碰撞与速度不变。

旧档GET保持逐字节业务状态和数据库表指纹，不补pin、不追算历史。第一次确认动作在当前分钟建立 weatherEcologyV1；原生v2薄荷仍每游戏日最多提前60分钟，原株/叶/来源/数量保持。PG原CAS并发一胜一冲突、精确重放、重启、待机/移动以及暂停离线拒绝加算均需检查。

关闭第二期新开始使用 ecology:false；保留本候选的reader、settlement、compact delta和UI。已固定政策继续结算，既有recoverAt与雨额度不回退。不要部署raw58或第一期旧1fbb790作为第二期暴露后的回滚，也不恢复数据库快照。

实际58旧compact reader严格拒绝新增 weatherEcologyV1/mintRecovery；它保护数据但会暂停旧标签的探索，必须浏览器整页刷新加载新前端。游戏内“重新读取进度”不能替换旧JS。先发布同一commit的新主站与镜像前端并核对实际bundle，再启用现有后端；新reader已验证接受仍在线58后端的旧delta。保持原平台登录/旅程数据，刷新不清浏览器存储。

单一writer、既有容器用户/网络/挂载和vendor/news/config继续。后端仅在已固定58镜像上COPY新public.mjs；不安装软件、拉新镜像、迁移数据或更改Worker/认证/凭据。业务生态模块无付费模型/媒体调用；正文雨反应是手写内容。原对话和ECS持续计费及临时未验签身份风险保持既有范围。

复验入口：先 node _qa/build-weather-old58-reader.mjs，再执行 _qa/weather-ecology-client-transition.test.ts。隔离PG用新本地数据与明确HARBOR_WEATHER_ECOLOGY_QA_PG_URL，不运行生产public.ts或真实凭据配置。旧档UI场景使用原Main/View/RPGJS与正常暂停语义：首个确认回执未到时动物保持安全脚点，回执后按原速度到既有树下。

正常登录QA必须由持有已有平台账号的人，通过海湾正式主站原AlterU登录入口（或现有MiniApp正常会话的作者Create→Published→Play）执行，使用明确的独立测试旅程；本环境没有可把远程iOS登录交给本机Playwright的受支持控制/共享机制。缺项是测试执行者与其现有正常会话/测试旅程的确认，不是验证码、cookie、假身份或新建平台账号。当前不部署；主端需恢复发布范围后才执行。
