# 《海湾新生活》技术文档

## 1. 技术栈

TypeScript、React 18、Vite 8（`base: './'`）。场景使用 RPGJS 5 beta34、CanvasEngine 2.2、PixiJS 8；没有每帧 Canvas2D 拼地面。Node 24 的本地权威服务使用当前技能导出的 async Story Session 测试候选和 SQLite。规则扩展由冻结 compiler、delta verifier 与本机 SWI-Prolog 验证。

这是可玩的本地制作版本。匿名能力只用于本地预览，不是平台账号认证；没有把 SQLite 测试驱动宣称为 PostgreSQL 生产服务。尚未发布、未登记平台目录。

## 2. 目录结构

- `src/world/`：20 个作者地点、2 个有条件扩展地点、地形、脚点碰撞、门、纹理与 RPGJS 装配。
- `src/engine/`：技能空间合同、距离步态、地图手势、前景柔和揭示。
- `src/story/`：双语 Cartridge、确定性任务、物品、关系、介绍与话题退休、空间绑定、待提交意图和存档客户端。
- `src/combat/`：不依赖镇名/UI/图片的固定步进战斗内核、三种遭遇配置；`src/challenges/`：钓鱼规则。
- `src/ui/`：战斗、钓鱼、地图、摇杆、统一图标；`src/main.tsx`：HUD、渐进对话、行囊、手记、修理与地图拼图。
- `server/`：同 UUID API、权威适配器、平台对话、动态线索与媒体旁路。
- `vendor/dynamic-runtime/`：技能冻结导出，版本与 SHA 见 `doc/runtime-upgrade.json`，没有修改其源文件。
- `public/art`、`public/map`、`public/audio`：运行素材；`doc/art`、`doc/audio`：原始平台请求、来源、哈希与处理记录。
- `_qa/`：独立测试和真实渲染诊断；诊断页面只在开发环境开放，不进入产品构建。

## 3. 核心模块

### 世界和输入

五个大室外枢纽（车站街、港口、市场街、海岸、山坡）各约 1280×880 世界单位；另有七处室外子地点与八处室内地点。主角和 NPC 可见高统一 56。大型场景由相机跟随，不整体缩成一张房间总览。水域阻挡从最上层地形分区导出；家具只挡实际落地部分。

门通过靠近、行动按钮、明确前往进入，不自动开门。室内北/南墙立面高 64、侧边盖厚 8；南墙与南门在角色接近时局部渐变揭示。地板、北墙、侧墙、南墙为独立缓存层。此有限地图关闭 RPGJS 默认点位区块 streaming，避免地面原点离玩家过远时整块消失。未来真正流式世界须改为按视觉范围准入，而非直接照搬此开关。

移动采用碰撞后实际位移推进四相步态；画面与 UI 不共享逐帧 React 更新。键盘、地面寻路、圆形触控摇杆共用移动规则。场景已做纹理裁紧与按显示尺寸处理，原素材不被覆盖；尚无真实 iPhone 长时间性能证明。

### 权威、恢复与对话

浏览器加载同 UUID `/api`；唯一持久写入者是 Story Session。每次意图先落本地 session 隔离日志，再携稳定 ID 提交；未知结果重试同 ID，随后读取最新 head，防止旧回执倒退进度。版本冲突、重复奖励、异主读取、事务回滚、重启后的回执重放均有测试。

NPC 首次接近只显示日常描述；正式介绍后才可问话和使用名字。固定话题一次性退场，服务入口可重复，谈话进入手记。自由输入先过人物、距离、版本与用量门禁；模型选合法话题时执行原动作，不能靠正文发奖励。阅读文字先出现，玩家明确翻完当前回复后才显示下一组选项；不再使用计时器自动放出选项，也不点击正文跳过。

### 战斗与小游戏

战斗 60Hz 固定规则步进，UI 记录压缩输入；服务端重放计算输赢，不能直接提交“胜利”。覆盖击败对手、绕障碍到达区域、坚持 20 秒三种模板；出招预备/有效/恢复、单次命中、闪避窗口、弹道与障碍 LOS 可配置。全部为可随时退出的练习。钓鱼为 30Hz 张力控制，同样重放；修灯和拼图提交精确解法。

### 动态线索与媒体

琼只在玩家已查看小桥并借到工具后提供线索。最多两代补充地点；每代一处、两条有先后的观察。平台生成候选 → 结构检查 → compiler/Prolog 检验与语义复核 → 同一权威 head 采纳。只能写补充知识，不发物品、不改主线、不过度承诺无限世界。地点的几何和安全出口预先存在；进入时细节图可继续生成，失败不阻断线索。

媒体请求先持久化稳定 UUID、提示词，结果走 `putMedia` 旁路，不推进故事 version/cursor。检查归属、格式、字节上限和 SHA。新运行时图片是补充特写，不冒充已经生成新正交场景和碰撞。模型语义审查曾放过重复内容及不存在的在场说话者；项目增加题材约束与人工内容检查，不能据此声称通用语义审查可靠。

### 声音与语言

地点音乐交叉淡入，练习另有音乐；脚步由真实距离触发，门、出手、成果有音效。一个 AudioContext、最多四个事件音，切后台暂停、静音持久化。平台音频原件保留，数值音量/削峰/淡出处理见 `doc/audio/mastering.json`；听感仍需人验证。

默认系统语言 zh/en，菜单可覆盖；同一故事始终是北美虚构海湾，中文不改写人物或货币。双语导出共享身份。Cartridge 的地图连线描述不能脱离空间适配器独立执行；近距离、道具、路线门禁仍由适配器确认。

## 4. 扩展点

- 新地点：修改 `world/data.ts` 与 `outdoors.ts`，导出共享布局，重装地图，验证脚点路径及实际连续转场。
- 新故事：修改 `story/state.ts`、描述与 Cartridge，保持固定 ID 和旧档语义；不得仅在 UI 增加不可执行选项。
- 新遭遇：复用 `combat/core.ts`，在 `presets.ts` 配置，加入权威绑定与 UI；提交可重放输入。
- 新美术：平台服务生成新根图/同批派生，记录来源与处理，经过真实角色相邻与动作循环检查再准入。
- 正式后台：`server/public.ts` 为新 PG 接头，`scripts/migrate-public.ts` 负责显式迁移，`server/http.ts` 共用业务路由；`server/index.ts` 继续只作为本地 SQLite authoring 入口。`worker/index.js` 验证来源并签发绑定游戏 UUID 的能力 cookie。这个临时浏览器身份方案尚待用户接受，不是平台账号验证；真实 PG 运行和恢复尚未验收。
- 发布：`scripts/prepare-public-deploy.ts` 将私有绑定写到仓库外 staging，`.github/workflows/deploy.yml` 构建同提交镜像。`src/ui/Mirror.tsx` 在 Pages 上引导到主站，不向原游戏后台发跨域存档请求。完整状态见 `doc/release-readiness.md`；不能把适配代码存在等同于已上线。

### 2026-10-01 阅读与前期引导修订

`src/story/dialogue-reading.ts` 按句子生成中英短页，并保存 `exchangeId/page/locale/finished`。缓存经 storage adapter 隔离部署，再按权威旅程 UUID 与人物分区；从已提交 history 恢复，不提交 action。切语言从同一回复第一页开始。finished 标记防止同一历史回执重新唤起已读回复，缓存不代表跨设备阅读状态或真实账号认证。

`client.ts` 在拿到对话回执时先登记阅读缓存；未知结果用原 action_id 恢复，成功后只清除与该问题相同的草稿。UI 草稿使用旅程/人物 key。存在 pending 时禁发新动作，并提供直接重新连接按钮。离开人物窗口会递增 UI epoch，迟到结果仍采纳权威进度，但不强行改回旧人物窗口。

初次 AI 体验成功由权威 `free-dialogue-experienced` 标记或旧档实际问答记录判断；点击邀请、输入问题、失败都不算完成。固定话题 ID 未变；桥的具体追问要求已检查桥，庭院开放时间要求已讨论住户需要，模型与按钮共用 availableTopics。

开场从两页改三页，分别解释来历、住宿目标、操作。开场 UI 游标按旅程存储。正文、自由提问入口、可编辑示例与下一步话题均有中英版本。账号现状和旧技能证据见 account-storage-integration.md；本批没有新增凭据、部署或真实账号验证完成声明。

### 2026-10-01 室外道路与像素 UI

`src/world/outdoors.ts` 的 `passages` 将出口、接近点、路标和方向统一；`data.ts`把它映射为已有portal ID，并装配独立路标。路面延伸与水域碰撞继续从同一layout导出。`View.tsx`只在190单位内显示路标目的地，65单位内转为底部行动；点击不会直接提交travel。`Map.tsx`同步区域地点方位。

`src/ui/pixel-theme.css`在基础样式之后加载，用CSS变量定义字体/颜色/边框。面板flex布局保持标题与关闭按钮固定，正文内部滚动；选项自动换行。字体位于public/fonts，notices脚本保留完整许可证。世界高度按实际可用视口/1.3计算，取消520单位上限，避免长屏角色被额外放大。

素材重做流程：平台media-batch生成 → scripts/prepare-outdoor-refresh.py处理七件素材 → export-world.ts导出布局 → assemble-maps.py重装缓存地图。新的草地只含材质，树、椅和路标仍是独立有脚点的精灵；处理脚本不修改几何透视。主prepare-art保留新增素材的metadata。准入状态与全套前后对照见doc/qa/outdoor-ui-20261001.md。DEV-only压力页位于_qa/ui-stress.html，不连接账号或写存档，不进入生产构建。

室内追加使用同一处理脚本的可选manifest参数：`python scripts/prepare-outdoor-refresh.py doc/art/interior-refresh-20261001.json`。`Prop.floorDecoration`仅用于无碰撞的平面地毯：独立源图等比装入base层，sheets/View不创建对应Y排序事件，防止遮住脚部。八个作者室内新增用途匹配的陈设，原任务entity ID/坐标保持。

### 场景陈设与朝向元数据（10月1日）
`src/world/dressing.ts` 在基础布置后应用地点专用物件，人物、门和剧情实体身份不变。方向资产各自携带世界尺寸与地面碰撞。`scripts/catalog-refresh.py` 从实际布局汇总来源与朝向家族，输出项目级记录，不是共享库。地形按世界坐标对齐纹理，离线合成缓存底图。


## 2026-10-01 · 空间使用逻辑第三轮

src/world/scene-use.ts在dressHarbor之后组织用途分区；move同步移动精灵锚点和footprint，type同步重算素材尺寸与接地范围。dailyUseSpaces提供10个可站立且从出生点可达的使用侧测试。scripts/export-world.ts和assemble-maps.py重导出地图。来源与使用比例见art/use-logic-catalog-20261001.json，验收见qa/use-logic-20261001.md。


## 2026-10-01 · 植物层次第四轮

src/world/planting.ts在organizeDailyLife之后添加/替换植物；_qa/planting.test.ts按outdoors最终地形层检查落地。植物来源与当前比例见art/plant-catalog-20261001.json；验收见qa/plant-refresh-20261001.md。


## 章节回顾补充 · 2026-10-02

`src/story/chapter.ts`从权威market-open和route-choice标记生成只读回顾；`src/ui/ChapterReview.tsx`呈现，本作main.tsx提供菜单/告示入口和固定继续探索按钮。open-route首次权威提交冻结route-choice，旧档不臆测历史选择。`_qa/chapter-completion.test.ts`完整走三种合法路线，检查回执重放、数据库重开、角色隔离和后续修桥不改原决定；可显式输出不含真实玩家的QA布局夹具。


## 发布运行环境（2026-10-02）
前端仍Node24构建；服务端用esbuild目标Node22，冻结vendor目录作为外部模块原样携带，避免Prolog resolver路径和CLI入口判定因打包变化。实际服务器Node22.22.2/SWI10.0.2/Pillow，非root容器，独立harbor_game/kit_harbor，运行角色无DDL。平台同UUID Worker以私有绑定访问海湾专用HTTPS路径；现有预算保护保持，无新购。账号暂为明确获准browser capability，30日cookie在bootstrap续期，非AlterU账号认证。

## 2026-10-03 B：受限动态素材验证

新增 server/dynamic-assets：现有浏览器能力身份与两个新 QA 旅程白名单绑定；五个同 UUID 动作；只读 inventory catalog → 精确用途/视角/几何筛选 → 共享 selector → 固定 grant。PG 同事务提交 packages/grants 与 async_media 附件，不推进剧情游标。元数据只接受三个精确 @2；无新生图。默认 off，QA 文件到期关闭；普通玩家/旧档没有附加对象。前端 src/dynamic-assets 经逐字节与授权检查后整组挂载 RPGJS；三个预审槽位的碰撞由同一 layout 合同供应，图片不可改变几何。实际远程验收状态以本轮 release 回执为准，不能把本地测试说成平台账号接入。

## 2026-10-04 上下文举例

`src/story/question-examples.ts` 从现有Save和questProgress选择只读双语候选，缺少已知上下文时给泛问；不依赖新schema。`src/ui/ExampleAssist.tsx`管理轮换/预览/明确替换，接受受控value/onChange、inputId、locale、disabled；父组件以包含相关上下文与候选的key重置临时状态并沿用draftKey持久化。示例只写草稿，ask/send仍走既有权威链。角色/动作/生成房间是否需要例子取决于是否实际存在自由输入。扩展人物内容在game-owned适配器内完成，不能只按known角色推断所有知识已公开。移动端面板遮罩仅对直接按在背景的pointer-down关闭，防止打开面板的尾随click误关。定向证据见doc/qa/examples-20261004。

## 2026-10-04 居民与统一游戏时间（本地候选）
- `src/world/residents.ts`：一个权威存档分钟、旧档默认、单调推进/睡眠、时段、四居民路线、活动、受限散步位置和蕨苗阶段；不读取现实时间。
- `src/story/resident-life.ts`：兴趣→追问→邀请→时段相聚→回忆；稳定话题flag、一次关系影响。原9NPC新增生活话题；无新主线锁。
- `state.ts`在唯一行动提交中推进travel 20分钟、nap 180分钟、sleep到下一个09:00；自由阅读/模型回答不推进。`fernStartedAt`只写一次，阶段为纯派生。`runtime.ts`验证可选字段，SQLite/原PG存储序列化合同不另增第二写入者。
- `View.tsx`保留单个RPGJS实例；注册所有已作者化日程事件，缺席清空graphic且不占动态碰撞；活动时移动脚点共用于碰撞/热点/接近/提交。走廊内移动是本地环境表现，提交脚点须通过规则走廊准入，非服务器逐帧NPC模拟。
- `dialogue-context.ts`提供已提交兴趣/相聚/关系；`question-examples.ts`只读当前可见/已知事实，示例不消耗模型。本地QA注入固定回复，不调用外部AI。
- `_qa/residents-server.ts`仅127.0.0.1:5258，合成玩家和隔离SQLite；`_qa/residents.vite.ts`仅5257。不会修改原5234/5236服务。测试页面仍是真实App与RPGJS。
- 扩展：日程在residentRoutes添加，话题在resident-life增加；植物按相同权威分钟导出，不加独立timer。生产账号接线属于另一个候选，本批保留正式版browser-capability边界。

### 已知日程与抵达估算
`src/story/resident-guide.ts`集中管理日程话题、known+talk:routine双条件、当前/下一时段说明与visited快捷前往的+20分钟估算。`resident-life.ts`的一次性routine话题写原有对话历史；`main.tsx`手记仅设置mapFocus；`ui/Map.tsx`显示目的地提醒，保留原visited/busy/current可用性规则。无新计时器、存档写入者或地图解锁。`_qa/resident-guide.test.ts`覆盖4组规则；浏览器`_qa/run-resident-guide.mjs`覆盖5组，使用真实本地SQLite和合成玩家、固定模型回复，禁止外部请求；不代表平台账号或真实模型通过。


## 2026-10-04 最终居民美术集成

最终美术通过 residentPeople.art → NPC sheet/关系页肖像消费；植物通过 sheets.ts 的三阶段图形 id 消费。时间/约会权威模型沿用居民分支，关系 UI 不写入虚构亲密度。该批不依赖账号 PG 接入。

## 2026-10-04 本地生活模块

- `src/story/crops.ts`：数据驱动三作物、湿润时间、阶段、买卖选项和原子状态变更。Save新增可选`plots`；缺省空，不修改已有fernStartedAt。每块菜畦保存crop/grown/updatedAt/wetUntil，以提交的townMinutes结算，现实离线不推进。
- `src/story/fatigue.ts`：可选awakeMinutes，整数小时阈值按差值结算，拆分多个10分钟动作与一个长动作同结果。旅行/田间劳动增加，休息重置/减少。
- `src/world/residents.ts`：13人三时段路线，夜间休息；玛拉工具袋归还前停留车站。人物位置、互动准入、NPC碰撞共用配置。三时段之间是在下一次权威时间推进时切换场景，不宣称连续跨地图步行。
- `src/story/town-news.ts`：单条已核实官方信息的固定本地样例，无运行时网络请求。新闻ID/version事实，与虚构Casey/丹妮分支分开。独立flags持久化参与、核对、婉拒和回顾。已核对便条在山坡花园出现，使用现有noticeboard素材。未来正式采集器、审核、TTL/更正传播仍未实现。
- `server/runtime.ts`：兼容旧Save并验证可选新字段。所有作物/金钱/剧情动作继续走既有AsyncSessionAuthority版本与幂等事务。前端不独立写plots或cash。
- `_qa/townlife-server.ts`/`townlife-vite.mjs`：仅127.0.0.1:5267/5266、合成玩家SQLite、本地回复、无模型与媒体调用。不是正式PG或账号测试。

## 2026-10-04 本地RSS适配层（尚未生产启用）

- `server/news/collector.mjs` 固定美联储货币政策RSS、HTTPS+TLS、公网IPv4绑定、禁止重定向、10秒/512KiB、无XML外部实体。原子文件写入+独占锁；canonical URL+标题/description hash去重；记录原发布日期、首次抓取、最近核对、72小时缓存/30天发布时效上限。失败不写新catalog。同URL变化追加revision并暂缓选用；不推断它一定是事实纠错，缺项也不当作来源撤回。
- `scripts/collect-news-once.mjs --once` 只手动运行，写`.data/news/catalog.json`，不建立服务或排程。不读取页面图片，不调用模型。
- `server/news/runtime.ts:withNewsRuntime` 只在本地QA显式接线，给新旅程选择一条当时有效来源；旧存档不静默替换。原authority事务保存edition和剧情选择。`projectNews`是只读状态投影，不改事件版本；正常游戏API的可选`newsProject`未在正式public入口启用。
- 来源变化或找不到已固定版本：停止新的相关选择；单纯到期阻止开始新故事，已开始虚构故事可继续。已发生选择保留原来源snapshot。RSS未反映的正文更正不可检测，真实生产内容审核/更正传播仍需补足，不能宣称覆盖全部外部更正。
- `_qa/news-server.ts`、`_qa/news-vite.mjs`只绑定5271/5270，`HARBOR_LOCAL_NEWS_CATALOG`明确选择本地catalog。合成测试路径与真实采集输出分开，87回归测试，320/390浏览器验收；没有模型、PG、ECS写入。


## 2026-10-05 本地验证增量：资讯与作物

仅独立候选、无部署。账号证据见doc/qa/account-pg-20261005（账号候选）；真实资讯证据见doc/qa/real-news-20261005、作物接入缺件见doc/crop-library-20261005（资讯候选）。不混淆账号验真、PG隔离、资讯模板与素材实际可用状态。未涉及另一候选的功能不标为本候选已集成。


## 2026-10-05 作物12图集成（本地验收）
`world/crop-art.json`固定12图、来源hash、每物种共享缩放与根部anchor；`crop-art.ts`首次解码强洋红透明并缓存data URL，原图不改。`sheets.ts`注册9阶段和原程序化土床标记；`View.tsx`将plots纳入latest ref、按plot key更新三个RPGJS事件，深度与主角共用空间引擎。仅状态变化setGraphic；没有逐帧图片加工或第二生长时钟。`ui/CropImage.tsx`将3产物以同一透明适配显示在原背包。菜畦移至道路右侧630/700/770,630，approach由原object生成；原plot ID不变、无新碰撞，现有存档位置仍合法。源码保留c3558b07训练销毁/恢复修复。回归与来源见doc/qa/crops-integrated-20261005/README.md；未部署，不包含账号及下一批6居民分支。

返回以同步 ref 防重并立即冻结模拟/输入；真实 authority 确认后卸载。请求结果不明时，继续通过现有 pending 请求 ID/connect 恢复；不创建第二次奖励请求。挑战期间停发世界 checkpoint，刷新保留服务器 activeChallenge 并要求重新显式开始。规则、确定性回放和服务器奖励不变。


## 2026-10-05 新增6位居民本地候选

明确范围、人物表、规则、82项回归与6条浏览器流程、素材待交付边界见`doc/qa/residents-next6-20261005/PLAN.md`和`README.md`。19人候选只在本地验证，原c3558b07线上保持。人物计划不等于合格美术，临时图不进入发布验收。

## 2026-10-05 新闻／19居民／回合制本地整合（当前状态，以本节为准）

基于发布3295fbd建立隔离工作副本，保留账号、12张作物图与c3558b07即时训练修复。a28eb286的六位居民功能按文件合入，冲突处同时保留news/crops/nextTopics；不是以旧分支覆盖当前发布源码。旧文档中“13人／未接账号／作物未交付”是历史阶段，不代表此整合版。

- `server/news/configured.ts`：可选`HARBOR_NEWS_CATALOG`读取<=512KiB冻结JSON，校验后每进程固定快照；`public.ts`与账号transport传递同一runtime和只读newsProject。未设置则原行为保留，不自动抓取。新旅程初始化及旧未读旅程第一次留言行动固定版本；旧已读故事不替换。创建、读、行动和checkpoint的响应都投影当前可用状态，版本不因此变化。更换来源快照需重启服务，未建立自动更正传播。
- `src/story/next-residents.json`、`next-neighbors.ts`：6人作息、独立三步故事、双结局、回顾、关系，合计19人。新6人artStatus保持QA临时复用素材，未宣称美术发布通过。
- `src/turn-combat/core.ts`：确定性单人对单人规则，意图、出招、防守、反击、恢复、补给、轮数上限。没有身份、金钱或小镇依赖；还不是通用多人/队伍系统。
- `src/story/turn-battle.ts`：海湾准入、旧奖励共用、点心、暂停/恢复、游戏时钟、首次报酬与满钱包延领。可选turnBattle保存固定schema/config、实例、phase和逐轮日志。server/runtime在读取和行动处验证；原authority的幂等和CAS为唯一写入者，未改数据库DDL和线上旧档。
- `src/ui/TurnBattle.tsx`：普通React面板覆盖保留的RPGJS地图；不创建/销毁Pixi应用。输入确认后展示结果，暂停允许世界继续；重读沿原pending意图恢复。c3558b07旧Combat纹理销毁合同保留。新动作通过state/binding受服务端验证，客户端不传伤害或胜利。
- 暂停局阻止另开小游戏，但不阻止居民、种植、旅行和休息；双方本场状态与小镇体力分开。新补给仅packed-snack，作物和任务物不作为战斗消耗品。
- 本地测试入口`_qa/next-batch-server.ts`、`_qa/next-batch-vite.mjs`只监听5331/5330。可在`/qa/start`创建合成测试旅程；不应部署QA服务。免费问答使用本地固定回复，不调用模型。

证据与限制见`doc/qa/next-batch-20261005/README.md`。未发布，未新增付费生成，未变更生产账号存档；临时前端ID身份的既有安全局限不变。

## 2026-10-06 本地收口增量

`src/main.tsx`保留封存的柜台描述去重修复，并区分菜单即时切磋和回合练习说明；`src/ui/TurnBattle.tsx`首屏使用短指引，展开区保留归零和回拳馆续局说明。无新规则、数据库DDL、身份合同或新闻采集器。`_qa/news-configured.test.ts`注入测试时钟证明到期前1毫秒可开始、准确到期阻止未读、已开始可继续完成，同一冻结文件和日期不变。

本轮以12ef2cf为固定基础，增量patch包含原先未提交的柜台修复一次，不能再叠加旧patch。12项新闻/回合定向测试与1项HTTP账号新闻测试通过；历史137项仅为交接证据，不重复宣称为新整批结果。Vite构建、UI静态检查、公开凭据和API路径检查通过。普通浏览器本地fixture不证明Telegram账号绑定；详情、可复现基础和限制见`qa/takeover-closeout-20261006/README.md`。


### 2026-10-06 本地后续差量
本地next-batch QA明确采用doc/qa/real-news-rechecked-20261006/catalog.json；仅更新同一事实核对/有效期，首次抓取及原发布时间保持。生产仍是显式HARBOR_NEWS_CATALOG opt-in。Rowan.mapArt独立绑定合格动作图集；资料图art仍为显式QA占位，完整UI消费图未准入。详情doc/qa/rowan-local-integration-20261006/README.md。未发布。

### 2026-10-06 组件分别消费，五地图/十二资料图
nextPeople现在分别转发art（既有root-v2肖像路径）、avatarArt（关系列表256方头像）、mapArt（NPC图集）。六人art/avatarArt绑定独立身份；五人mapArt绑定独立图集，Mira.mapArt沿旧占位，避免资料通过导致请求不存在的地图PNG。原13人fallback不变。NPC anchor[.5,122/128]、scale56/108、偏移0/0和16 phase/方向合同保留；英雄8/12偏移不抄给NPC。17消费PNG源/候选/dist SHA及57固定原件映射核对，11项居民/关系测试和最终build通过。当前仅本地合成账号UI，无iPhone或正式平台本批验证。

## 2026-10-06 五居民／新闻／回合发布候选（覆盖前述本地六人状态）
`nextResidents`只将五位已准入居民投影为 playable people/routes/topics，18人总数。Mira JSON及既有存档known/关系/历史/事实原样保留，dialogueContext和spatialSnapshot只投影当前存在人物，未做迁移或删除。暂停回合、作物与旧新闻pin在真实SQLite重开、CAS和重放下验证。冻结复核目录完整复制至server/news/frozen-catalog-20261006.json，bundler复制到dist-server/news，部署明确设HARBOR_NEWS_CATALOG；无采集器。最后复核2026-10-05T18:59:16.076Z，到期2026-10-08T18:59:16.076Z，原发布2026-09-16T18:00:00.000Z。release marker=harbor-five-news-turn-20261006，同源health新增sourceRelease。具体验证与实际部署状态见releases/five-news-turn-20261006/README.md，不能将候选构建当线上成功。

## 2026-10-06 动物一期本地接线（基于已发布19人10c0983）

本段覆盖此前18人／Mira待接入的历史描述。当前发布基线19人，动物改动只在 `codex/animals-integration-20261006` 独立工作树开发，未上线，未修改正式存档或身份合同。

- `src/animals/`：制作方8模块原样接入；新增 `art.ts` 固定两图集／40方向帧来源并共同筛选启用个体，`game.ts` 从当前 rooms、19名 residentRoutes、游戏时间及 dynamicWorld 构建场景ctx和互动准入。3猫／4鸥，狗只是独立算法夹具，蟹未实现。
- transient运动复用单一createAnimalRuntime，真实RPGJS帧驱动步态／地面避让／翼拍／落地。主角、居民和动物共享场景足点：客户端读取实际NPC脚点，权威端保守保留居民合法巡游走廊，避免将未持久化位置误作可信服务端事实。动物原子投影统一图形、地面碰撞与热点；flight只上移graphic，排序仍用地面foot。
- `world/data.ts`只为已准入个体加入object实体；不加入people、known或人物关系。`binding.ts`先做同一动物互动准入，再以可信slot中已验证的actorPosition偏移进行原spatialBinding距离检查，无豁免整个动物类别。
- Save可选 `animalsV1`，读取时缺字段保持原样，非法schema、未知catID、非法熟悉度或未来抚摸时刻拒绝。call/pet仅在原authority.prepare→CAS→head/history/cursor/receipt事务写入，没有新的数据库、DDL、后台计时器或AI调用。原时间、现金、物品、居民关系、新闻pin与战斗状态保留；熟悉度0–3，每日首次pet最多+1。
- Main传持久动物记忆给View，只有服务器回执成功才触发短时注意反馈，熟悉猫标签取自保存结果。map touch仅approach，动物44px以上触控目标随当前foot同步；同一目标位置变化仍刷新near。scene/journey/读档reset暂态，clock提交reconcile；暂停dt0，旧档重叠只移动动物。
- 两PNG保持制作方SHA和锚点／等比scale0.5，不在消费端重画或变形。候选art.json的technical accepted限定为本作本地集成开发的消费合同；制作方审核v2、通用库runtime/libraryEligible=false和权利／profile待核状态另存原件，不转写为正式上架。正式发布仍需主端审阅本批差量／验收与剩余门禁。

本地QA服务 `_qa/animals-owner-server.ts` 仅回环5425、独立SQLite合成旅程，5424开发预览与5426固定dist预览；均不可部署。验证日志与原始失败/修复记录在 `doc/qa/animals-integration-20261006/`。真实MiniApp新闻／回合QA仍按独立合同等待用户正常打开，不由动物改动替代。真实iPhone、跨设备、第二真实账号与玩家理解没有新增证明。

## 2026-10-06 科技数字游民独立实现与本地验接（基于动物提交 f6e6be82）

本节是独立副本增量，不改上述发布记录。配置及本地准入总数均22；新3人的`artAdmission`已由唯一集成owner在最终消费字节、原renderer、日程、资料UI及权利验收后设为accepted，missing为空。线上仍19人，本候选未发布。

- 技术栈和运行方式保持 React/TypeScript/Vite、RPGJS/Pixi、既有 AsyncSessionAuthority 与 SQLite/PG 适配器；无新服务、模型、网络采集或数据库DDL。
- `src/world/tech-nomads.json` 保存3人固定身份、24h半开时间段、9个业务脚点、双语文案、职业观点、故事两选项和固定美术准入/SHA。`tech-nomads.ts` 投影角色/路线，依据唯一游戏分钟解析活动、专注婉拒、下一可聊时间和美术准入。未认识伙伴的名字在活动、日程提示和上下文中替换为邻居。
- `src/story/tech-nomads.ts` 使用独立 `nomads-v1-*` 话题和故事flag，不修改 B1 life 模块或 `neighbors2`。Save仅增可选 `techNomadsV1:{schema:1,stories:{[id]:{choice,completedAt,recalledAt?}}}`；旧字段缺省不初始化、不迁移或清空。故事要求既有 introduction 和伙伴生活事实；选择互斥、本人及伙伴各+1关系，60游戏分钟后可回忆一次且不再奖励。只保存真实话题/个人选择，不创建B1尚未挂载的收藏物。
- `state.ts` 复用 existing topic/action 提交；`binding.ts` 登记动作但仍验证当前人物/场景/距离；`runtime.ts` 验证可选记忆并在专注时直接提交已作者化婉拒，保留提问历史，不调用 resolver、不误标一次自由AI对话体验。版本、幂等、CAS、owner隔离和receipt仍由原authority事务负责。
- `data.ts` 增配置实体，`sheets.ts` 只为美术已准入者注册图集；`View.tsx`、故事动作和 `animals/game.ts` 共用 `presentEntity`。pending、夜间和不在当前场景时图形/热点/居民碰撞同时缺席。三人使用原NPC锚点、等比缩放、24单位巡游和原遮挡排序；没有另一renderer或改主角偏移。
- `relationships.ts`、`resident-guide.ts`、`question-examples.ts` 和 `server/dialogue-context.ts` 复用现有关系、手记、历史与问答入口。关系不依赖临时UI状态；日程提示只在认识且学习routine后开放。`newsStory` 仅保存冻结来源准入要求和拟议模板；无已准入科技文章、无当日新闻断言，不接入旧经济资讯的采集或来源pin。

扩展点：调日程/职业观点/故事文字/脚点修改 `world/tech-nomads.json`；调故事前提、关系和回访修改 `story/tech-nomads.ts`；未来真实科技来源由owner先完成原来源审核及固定版本后另接模板。本次已核对3类实际PNG尺寸与SHA及原renderer后更新`artAdmission`；以后替换仍不能只改status绕过证据。

确定性验证入口 `_qa/run-tech-nomads-offline.mjs`；三居民两分支两语言、1440分钟日程、旧档、SQLite重开/重放/CAS、未来22人动态几何与3猫4鸥见 `_qa/tech-nomads.test.ts`。`_qa/tech-nomads-pending-browser.ts` 只拦截读取独立dist和合成旧Save，不监听端口，外网全部abort；320×568/390×844双语验证原19人、猫、移动、关系历史和pending缺席。该pending浏览器脚本是制作前历史夹具，不代表当前准入状态。当前`_qa/tech-nomads-owner-browser.ts`对真实Main/View/RPGJS构建、实际handler和隔离SQLite跑12故事/资料完整流程与18日程视图；仅合成旧档，不监听端口、外网abort、无正式身份。37文件176/176离线及23针对性检查通过。三人`portraitShape:square`只调整这些人的contain尺寸，原19人规则保持。只读美术审计`scripts/audit-tech-nomads-art.mjs`应报告本地PASS；平台/手机/SiteUI/新玩家理解、本候选PG与HTTP listener仍未验证，详见`qa/tech-nomads-owner-20261006/README.md`。
