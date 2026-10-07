# 人物关系成长 v1.0：现状、迁移与 owner 接缝

唯一owner：01a10d0d-57fd-75d8-9d32-21d279e2d0a0。授权由小小银转达，用户2026-10-07 04:58UTC Sentinel_6a3e711c0b508191b1c26124487d8a88同意五阶段方案。范围只限独立本地切片；无生产、正式发布、模型/媒体、预算或凭据变更。

## 实际来源与功能差异

只读来源 `harbor-camera-owner-release-20261007/source` HEAD d6444954c4eeab93655e4cc02ca38637809d70d2，树275ebe20ab6a65ad42f7b6b9e73a74ddb248932b。重启后原Git树对象缺失，通过原stage0索引逐blob SHA和tree ID核验，在本目录重建2652个文件与自包含Git；旧a-summer HEAD 00ffb145不是正式基线。公开线上bundle index-CoGwq-Xf.js SHA256 b7990348323ef5e014c3074d61e3cb8a13c059a10f25c9cd15a42fe98ce0dbd1验证原关系页与听歌/工具袋标记；health仍报旧sourceRelease，所以不据它声称提交匹配。没有读取生产玩家存档。

d644已有known、relations -100..100、工具袋+3、码头听歌每人+1、科技游民个人选择、话题生命周期、日程与历史。原“阶段”是We have met / We have talked / Shared experiences，只根据历史与完成支线；不存在五阶段数字阈值。此补丁保留原功能，仅叠加阶段、多日问候、逐阶段个人话题及三位试点的完整新承诺/活动，旧事情不重复造。

Mara的小约定：读山坡花园门边便条再回来；Avery：观察营地旧图的可辨地名；Samira：看气象站潮汐/步道记录。观察不完成原地图拼图，不修改借道，不预报天气。Mara在车站街，Avery/Samira在其码头日程时共同活动；错过可改日。第二次活动是自愿私事交流，无恋爱默认。

## 规则版本与精确迁移

可选根 `relationshipsV1={schema:1,rules:'relationships-v1.0',migratedAt,residents}`，mapVersion和旧Save字段版本不变。未认识是陌生；已认识是相识。熟悉：2个发生互动的游戏日，3种稳定互动（known算已有介绍），2类。信任：3日、4类、至少一次已兑现承诺和一次已完成共同活动。亲近：5日、以上条件、第二个不同活动、信任私事和共同回忆话题。按1440分钟划游戏日，日期仅来自被提交的当面互动，不是登录或经过午夜；独自观察只记承诺证据，不计相处日。

GET、directory、upgrade、关系投影不写迁移。合法介绍/成长话题或原支线完成首次提交才写可选根；原关系值、known（包括暂缓人物）、flags、历史、库存和其它模块原样保留。迁移时记录关系原值与可验证历史事实；bag-returned算已兑现，residents:song-shared算一次共同经历，不填未知日期、不补发奖励、跳过重复同类小委托/相聚。迁移后才完成原支线时，在原事务内用story-toolbag / story-song记录当时权威分钟和社交日，不覆写legacy快照，不再发奖励；共享歌声同时记录实际参与的Avery与Samira。高数值本身不提升阶段。旧档没有新记录时显示相识和原历史事情；不会伪装过去曾有五阶段结论。旧负数仍保留；新首次爱好/私事各+1，承诺+2，两个活动各+1，问候/观察/邀请/回忆0；旧算法上限100。

未知schema/rules拒读；不自动降级或清空。新根只允许试点身份、稳定动作、过去权威分钟、严格字段与里程碑前置；不保存客户端提供的阶段。下一版本须新规则标识和明示转换，不更改v1.0含义。

## 原子、身份与时间

所有新动作走原Story Session action/CAS/receipt事务，单个head包含数值、记忆和约定；无第二数据库、计时器、localStorage关系真源。重复action_id返回原回执；不同请求争版本只成功一个；回执失败回滚head/event；prepare不改head，commit重验。

createRuntime第三参数 `{relationshipClock:(head)=>head.townMinutes??540}` 是服务端可注入端口，必须返回已提交head分钟；与存档分钟不同拒绝。函数也接受明确minute以便固定测试，不接受客户端minute/关系证据。地图作者先提交自然时间，再通过现有action使用该head；关系模块不自创站立、走路或后台计时，不增加对话耗时。

使用原账号验证、旅程绑定、身份epoch与pending/action恢复；前端换账号后旧响应不能回写。SQLite证明本地原子/重放/合成账号隔离，不替代真实PostgreSQL、真实平台账号或跨设备验收。

## B2 / 猫鸥 / 样本接缝

只读对照主owner evidence/RELATIONSHIP-FACT-CHECK.md；固定候选5bca5483d2dfab36efe89acc138437d7b92a60f6基于d644，未发布。其Mara/Ruth verified observation share给+1与知识页，仍归animal-life规则。此补丁不导入B2、动物源码或额外包装plants。

本补丁的structuredClone/返回head保留未识别的lifeV1、land、animalNotebookV1等字段，不裁剪whole Save。B2唯一组合工厂可把createRuntime作为base；关系字段纳入既有Save内容绑定，使LifeView知道head版本/人物变化。sample/record/brief并非社交接触，不计相处日，不重做登记，不由关系UI消费或清除sample。share已结算的关系值保留；目前不把animalNotebook页面擅自算成新阶段里程碑。后续要将动物分享加入成长证据，须在animalNotebook registry准入后的原share事务内接入受限事件，按稳定ref+sourceAction唯一化，已有页面无日期不得补造；不得再加同一+1。

组合后必须覆盖identity scope/epoch、真实journey、version/cursor/minutes、known、relations、relationshipsV1、notebook和sample绑定；异步LifeView不匹配拒绝按钮，观察sample过期仍遵循动物规则。时钟/自然移动引起的样本刷新由地图/B2作者合同掌管。此候选只保持自己的观察事实，无瞬时sample；不能拿它的观察有效性替代猫鸥样本验证。

## 受限叙事

relationship-narrative无网络/供应商依赖：候选仅schema、journey、basisVersion、person、lineId五字段，选当前可见作者句子；额外text、points、stage、reward、romance、错误版本/旅程/人物全部拒绝。未准入候选用现有作者对白。自由问答不得映射rg-*规则动作，兑现/活动需玩家显式点击；AI无阶段/数值/奖励/解锁权限。本轮真实调用0。

## 体验与待验

普通按钮按既有即时busy/禁重复反馈；成功进入分页对白并刷新人物/约定，错误保留已提交进展并提示重新读取；静音/低动效延续旧系统。目标320×568与390×844。测试多日通过loopback权威分钟注入，关系进展不注入；导航用正常键盘激活接近按钮和指针操作，无force。真实手机触控、MiniApp、真实PG/账号/跨设备、新玩家理解、B2/地图组合与正式发布仍需owner独立验收。

## Sole-owner published-clock integration
The independent producer's third-parameter contract is adapted here: createRuntime(resolveDialogue, notes, motion, {relationshipClock}) uses a fourth options argument. Production preserves its existing motion callback and uses committed townMinutes by default, after outer foreground settlement. This owner integrates on09366b5 under the user's05:42 continued-work/ready-release authorization. No whole Main/View/runtime replacement.
