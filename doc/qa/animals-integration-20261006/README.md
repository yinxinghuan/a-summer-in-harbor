# 本地动物接入验收 — 2026-10-06

本报告由游戏 owner `01a10d0d-57fd-75d8-9d32-21d279e2d0a0` 记录。协调主端转达用户一期开发批准；范围为本地真实游戏接入、测试和提交前验收。没有动物正式发布、库存 mutation、云上传或新增生成批准。

当前候选来自已发布的 19 居民版本 `10c098326f91526e00b97c814c5f3b10f3c6a7ab`，独立分支 `codex/animals-integration-20261006`，工作树 `/private/tmp/harbor-animals-integration-20261006/source`。原项目 dirty master 未作为开发树，原存档未操作。正式主站与 Pages 仍是已发布版本。

## 可审核差量

- 仅 3 猫 + 4 海鸥；狗仅为算法测试 fixture，蟹没有实现，不宣称十二动物齐备。动物不进入 19 居民名册、人物关系或 known。
- 接入当前 19 居民（含 Mira）、各时段路线、现有 dynamicWorld、门口与全部菜畦保护区。服务器保守保留居民整条合法横向散步走廊；客户端同时提供真实脚点，动物安全区与服务端一致。
- 猫休息、散步、轻唤、抚摸和夜间睡眠；海鸥自主步行、靠近退避、振翅起落与安全落点。无动物对话模型请求。
- 同一个动物 projection 原子地产生图像、脚点、地面碰撞与热点；缺图/HOLD 时四者都不启用。RPGJS graphic 使用固定图集，ground depth 仍跟随脚点，飞行只改变图形偏移。
- `Main → binding → server/runtime → reducer → 原 authority CAS/receipt/store` 事务链完整。服务端校验当前地点、时段、允许动作、合法观察脚点、动态地形/居民保护和距离；没有新增身份信任源、数据表或动物单独数据库。
- 旧存档没有 animalsV1 时仍可读，校验不补写它。主动猫动作才增加可选 memory；每游戏日首次抚摸熟悉度 +1，上限 3，轻唤无增益。只正常推进版本、cursor、历史与提交位置；作物、现金、精力、时间、旧剧情和人物关系不因猫动作改变。
- 接收成功 receipt 后才做临时动画反应；切图、跳时、读档取消临时反应。夜间猫没有抚摸动作；海鸥没有猫动作。

## 来源、审核和权利边界

生产包 `/Users/yin/code/games/harbor-animals-phase1-20261006` 只读。接入补丁 SHA256 `2b6314615c97b91d109777cef43019c00ba69bb55dfeba4536f3c5bbb1dfe95a` 独立校验。生产者 v2 review、批准与连续运动总结副本在本目录，原件/旧预审没有覆盖。

猫图集 800×576 / 160×144 / scale .5，SHA256 `7b298237af7be8ec95635f9b0b55fe7e4880aad4df0751b46730ab7fb493972a`。海鸥图集 1120×640 / 224×160 / scale .5，SHA256 `0c3e6577e769eb26edcb42fccee17a11a58641e39c27299b8e7e7975df704802`。30 本征原图来源 SHA 与两个消费图集逐项核验，40 四向帧；整侧镜像保留，未修改图像或重新生成。

批准使用的 alias 是 `gpt-image-2.5-sunburst`，渠道为 AlterU Media v1 本批；不把 alias 写成独立核实的底层模型。生产者累计 43 POST 封账，本 owner 0 POST，不挪剩余额度。

生产者 runtimeEligible/libraryEligible 保留 false。候选 art.json 中 technical accepted 是本游戏本地消费技术接线与 QA 的判定；不改生产者结论、不表示库准入或正式上线。正式发布资格为 false。库 profile、标定与权利记录由库 owner 补足；未测项不记 PASS，也不等待素材库长期 5000 容量目标才开发游戏。

## 验证证据

- `regression-after-scene-fix-approved.txt`：179/179，0 fail/skip。含本次 36 项动物测试、54 个审核拒绝负例，当前19居民各时段/base/unlocked/dynamic几何、旧存档/观察脚点拒绝、SQLite和真实专用 QA PG并发CAS、丢回复重放、重启、owner隔离与旧状态不变。
- PG 仅专用 loopback QA，独立随机 schema 创建/清理；未连接正式 PG，未触碰原玩家旅程。
- `build-after-scene-fix.txt`：TypeScript + Vite 通过。存在原有大 chunk 提示和非 module storage-scope 提示，构建无失败。
- 最终固定构建、脚本/图集 SHA 在 `consumer-provenance.json`。HMR 开发树证据不充当最终构建验收。
- `ui-final-build-v3/`：320×568、390×844、1280×800；猫与海鸥连续真实 rAF、两移动宽度猫休息/轻唤/回休息、夜间无动作、Mira共场景、旧位置重叠、真实床小睡与地图切换，共12场景。保存原始PNG、WebM、事件/Pixi纹理/脚点trace、SQLite receipt后的持久状态。普通键鼠与实际可点位置，不 forceClick、不手动注入动物帧或移动。
- `ui-final-mira-walk/`：正常走路后的320/390共场景；390可见完整 Mira 与完整猫。320不宣称所有角色同屏。
- `ui-map-collision-v2/`：正常旧街→车站后持续方向键，267帧证明玩家停在猫地面边界且休息猫不被推动，两移动宽度通过。
- `external-guest-final-v6/`：真实公共 guest shell/impl GET。外部访客横幅与动物面板操作；同时保存仅QA隐藏横幅的已加载shell平台构图。字体CDN与外部分析请求在测试隔离中阻断，登录/Create导航未执行，不伪称平台实机。
- `browser-mechanical-audit-final.json` 与 `visual-review.json` 记录真实事件、frame/texture与移动热点同步、人工干预为无的AI目视结论。七维4分平均4；仅本地游戏消费范围。

## 失败历史与修正

保留初始测试/构建日志及所有失败截图，不删历史、不改失败为通过：

1. 初轮移动目标点击失败：object CSS pointer-events:none；加动物专属 pointer-events:auto，普通可见 mouse target 验证。
2. 海鸥离屏点击失败：QA先以普通方向键接近再点，未注入位置。
3. 开发HMR期间390海鸥空纹理：该轮不能做最终证据；冻结 dist 后复跑。
4. 首次固定预览无法读取：独立QA服务器Origin白名单未含5426，补齐仅本地端口，无生产Origin改动。
5. Pixi未暴露 worldAlpha，删除不成立的数值断言并明确限制，实际纹理帧/RGBA合成屏幕另验。
6. 访客实现脚本带版本查询，精确整URL白名单漏掉；只允许固定公共origin/path的GET；两个Close按钮的QA断言歧义改为Cat region。
7. 收口代码复查发现切图碰撞场景被闭包初始scene覆盖，删除UI刷新中的错误场景赋值；重新构建、179测试及两视口真实持续接触测试通过。
8. 切图QA第一路线错误使用旧出生点/向下走导致猫离屏；按真实Station出生点使用普通方向键重新接近。
9. 默认Mac沙箱拒绝 Chromium MachPort与QA loopback连接。没有绕过；限定目标的require_escalated工具审批获准后再执行。首次默认临时目录 `/var/folders/.../T/playwright-artifacts-*` 写入失败，改用已允许 `/tmp`。当前没有自动审批拒绝。拒绝/环境失败不算产品测试PASS。

## 当前阻塞及准确下一步

本地开发与本轮验收完成后保持候选，不自动发布。新增决定是本批3猫4鸥是否作为正式更新发布；先给主端此差量与证据。上线前需库owner完成适用权利/固定来源/profile记录，游戏owner核对消费者正式技术门禁；不把本地PASS等同库存准入。

真实MiniApp原正常session、真实手机触控、跨设备/第二账号尚未验。本任务用合成QA owner仅测本地事务，不注入平台假身份、不操作用户原存档。新闻/回合的独立QA仍等待用户正常打开MiniApp，动物任务不延后它。动物分支不包含 news-activity.local.patch，不混发布。

第一期核心仍是居民生活轨迹、昼夜、体能、种植收获销售经济、人物关系与真实资讯衍生故事。动物接入没有撤掉这些；第二期多地点自由开荒仍只有需求，没有开发。新闻冻结来源/到期日期保持原值，未冒充更新。

## 本地运行与经验沉淀

原owner预览/数据库待机未强停。本 owner HMR 5424 已停止；5425 独立SQLite QA服务和5426固定构建预览仅loopback待机供审核。只有本owner写本候选游戏；素材生产/库owner不写游戏，报告目录写入不表示开发权限转交。

经验在本目录 `RPG-WORKFLOW-LESSONS.md` 沉淀。后续共享规则应写 games/memory 及 build-spatial-story-game 的相关reference；技能更新要按当时明确批准范围，现有技能可读，不安装新技能。本轮没有修改共享技能或库，也没有重新造认证。

最终机械审核：4757个真实运动采样点，DOM热点/客户端事件最大脚点误差0.6097051981161469世界单位。最终固定JS为 `index-CTLgQvtZ.js`，SHA256 `750fed5673ec4144cd56c28810c0e85af523dc9a6cc2b7ba5699203ea2af9931`。

经验profile检查正确输入 `doc/experience-capabilities.json` 后PASS（13项）；首次误传不存在的 `doc/experience-profile.json` 的CLI失败日志保留，未据此改产品profile。原13项profile是既有文档，不表示新增动物库profile已补齐。
