# 三位科技远程工作居民：独立实现交接

本候选基于动物集成本地commit `f6e6be82ee10e6422892754a1fc624147e217c2c`。已完成内容实现与确定性测试，当前 **新美术HOLD，未部署**。基线来自19人发布10c0983的动物候选，不能用旧00ffb14替换。

## 来源与范围

任务由源线程 `01a0f63e-747b-74c8-a592-bb52c77c2017` 转达用户需求：2026-10-06 07:50，用户 Sentinel_b068175c9b3c81919d3b2ec296179968 说“我想在游戏里面再加一些科技行业的或者AI行业的数字游民，是在远程工作的数字游民的居民”，08:28追问进度。此处是经授权任务转达记录，不伪装为本执行线程收到的用户直接发言。

唯一集成/发布owner：`01a10d0d-57fd-75d8-9d32-21d279e2d0a0`。本地执行目录 `/Users/yin/code/games/harbor-tech-nomads-implementation-20261006/source`，从本地基线clone，remote已删除。没有写owner工作树、当前官网、素材库或生产存档，没有部署/push，没有新服务、模型调用或生图。

本执行线程后收到转达：42 POST美术批次已独立批准，美术owner `01a11067-2419-7429-8e0c-bed409ee90bd`，输出 `/Users/yin/code/games/harbor-tech-nomads-art-20261006`。这不改变本实现线程0生成/0媒体POST边界。B1 owner `01a11011-f8c1-72d3-90ed-02a46c72509b` 的独立life模块未被修改；本候选不等待B1，不假设收藏能力存在。

冻结制作包完整保存于 `frozen-brief/`；manifest SHA256=`d08d29af987e21de902906580a96ab7bfe20776b66b24400adb5bef99d3f8bfb`。身份、年龄、24h日程、夜间离场与个人故事遵守role-manifest；source-references与renderer合同未改。

## 已完成

| 居民 | 职业/年龄 | 专注时段 | 故事真实前提 | 两条保存的选择 |
| --- | --- | --- | --- | --- |
| Harper Quinn | AI应用，31 | 咖啡馆08:00–11:00 | 认识Elena，实际听过新叶生活话题，再咨询记录是否自愿 | 记录一个愿意分享的观察 / 为新叶留空白 |
| Tess Moreno | 开源文档社区，43 | 咖啡馆13:00–16:00 | 认识Nell，实际听过空白明信片生活话题，再咨询不要求回信 | 写一行海景草稿 / 先保留空白卡片 |
| Noor Bennett | 科技产品研究，35 | 旧物店13:00–15:00 | 实际认识Grant，问今天愿不愿意聊天 | 安静陪坐 / 自愿另一次相约 |

21:00–06:00三人离场。时间来自存档游戏分钟；不引入外部日历或现实夏令时。专注时给具体再访时间，不调用问答resolver、不扣关系。两选项互斥，完成给本人及伙伴各+1关系，封顶100；60游戏分钟后分支回忆仅一次，无二次奖励。记录通过原关系/共同经历/谈话历史呈现；没有真的寄信、植物操作、应用上线、研究招募、收入或新道具。Casey仍休假，人物原文和原故事不改。

新 `techNomadsV1` 为可选schema1，旧13/19人Save缺字段仍原样可读；没有清空known、Mira历史、新闻pin、作物、战斗或动物记忆。三人的话题/flag单独以 `nomads-v1` 命名，选择跟原action receipt/CAS提交。

## 路线与准入

| 居民 | 06:00–12:00 | 12:00–17:00 | 17:00–21:00 |
| --- | --- | --- | --- |
| Harper | cafe (375,380) | garden (585,435) | coast (745,535) |
| Tess | market (485,515) | cafe (375,380) | dock (425,555) |
| Noor | coast (585,515) | secondhand (475,460) | courtyard (625,475) |

同咖啡馆脚点不同时出现；沿原horizontal ±24巡游、NPC脚点18×8和接近合同。测试同时保留其他居民、动态家具、原门口/菜畦/蕨苗可达。旧档人物重叠时只调整NPC，不挪玩家。配置22人，但缺图三人不注册sheet、不出现热点、不占动态碰撞或接受动作；当前实际renderer保持19人。

## 验证与重跑

使用Node22（本机 `/Users/yin/.nvm/versions/node/v22.22.2/bin/node`），在source内执行：

```sh
npm run build
node _qa/run-tech-nomads-offline.mjs
node --import tsx _qa/tech-nomads-pending-browser.ts
node scripts/audit-tech-nomads-art.mjs
node /Users/yin/code/games/scripts/audit-public-secrets.mjs "$PWD"
node /Users/yin/code/games/scripts/audit-game-api-base.mjs "$PWD"
```

离线runner明确排除3个要求真实QA PG配置的test文件，以及2个要求HTTP listener的test文件；不把缺配置或禁止监听当作通过。所有其他选中测试176/176通过。SQLite为临时隔离文件、无服务器。新增验证包括12条双语双分支、1440分钟日程、专注结束边界、夜间回访、旧档不改、畸形新记忆拒绝、receipt重放/竞争选择CAS/重开/owner隔离。几何1638个巡游脚点、2004条保护/接近路径；未来22人+3猫4鸥16080次可见帧保护检查。

未来22人检查用测试进程内临时 **SYNTHETIC_LOGIC_TEST_ONLY_NOT_ART_APPROVAL** 元数据，finally恢复；没有伪造PNG或把测试SHA写进构建。它证明逻辑与空间规则，不证明最终图集/视觉。

pending浏览器用实际固定dist的Main/View/RPGJS，4组320×568/390×844、en/zh，8张platform-layout截图。验证Mira与猫出现、人物/动物事件、移动、旧谈话查看、无横向溢出、关系查看不改authority head；新三人缺席。拦截静态资源与合成API，0 listener、0外网交付、0模型/媒体调用。生产guest-shell仍在源码；QA外网abort，因此本次没有external-guest验收。

## 美术接入交接与未覆盖

三个role均预留manifest固定路径：`public/art/npc-<id>.png`（384×512），`npc-<id>-avatar.png`（256×256），`npc-<id>-root-v2.png`（512×512）。`artAdmission` status=pending、hash/evidence=null、missing保留三种缺项；只读审计当前预期HOLD/退出1。不能复用其他人物脸、只改accepted、或把占位当合格人物发布。

owner收到最终美术后逐项核SHA/尺寸/来源与审批链，按冻结renderer-contract完成原RPGJS中的四方向A/stand/B/stand、停止、遮挡/碰撞、人物资料contain、长双语、320/390、关系分支/回忆验收，再更新各人的artAdmission。最终图与22人真实renderer、实际手机、MiniApp账号/跨设备/第二真实账号、实际QA PG/HTTP transport、新玩家理解均未新增验证；`comprehension unverified` 保持。

科技来源只保留来源要求和模板接缝，status=NO_ADMITTED_TECH_ARTICLE；没有抓新闻、来源卡或当日事件宣称。未来真实来源与模板需owner另行审核固定版本。本任务不扩大图库mutation、网络、发布或模型预算。

集成应在owner基于相同f6候选的副本中review差量；若B1或其他候选改了state/runtime/binding/data/View同一行，保留双方hook并重跑，不能用整文件覆盖生产。最终commit、binary patch、Git bundle、dist摘要和外部证据目录由交接根目录 `FINAL.md` / `receipt.json` 固定。
