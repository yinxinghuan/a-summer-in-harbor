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
