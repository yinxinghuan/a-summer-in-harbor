# 可直接消费的独立交接

本轮完成原生蟹美术、地面 profile、横移/退避消费者的本地准入，以及受限 AI 提案 v4 的免费确定性闭环。项目用途权利不再是本轮 blocker；实际素材库写入与正式激活仍分别由库 owner、唯一集成 owner 执行。本地准入不代表新物种已经上线。

## 接缝与权限

- 唯一集成/发布 owner：`01a10d0d-57fd-75d8-9d32-21d279e2d0a0`。
- 固定生产基线：`6bcf74e6cbc328c16c14d93add68142898e8487c`；公开源码基线：`ce6944b756efe8ed0ff0f7453673d5c82141cbbd`。后者只补 QA import，消费者源码与正式版本一致。
- 分支：`codex/harbor-crab-admission-20261007`；提交、tree、补丁 hash 以 `DELIVERABLES.json` 为准。补丁只应用到 ce694 或审查后 rebase 的独立副本；不要重复叠加旧 a843/a581 包。
- 用户持续开发授权来自父任务转达的 2026-10-06 用户消息，source thread `01a0f63e-747b-74c8-a592-bb52c77c2017`，Sentinel `Sentinel_087588a544308191ac231ce168d71c6e`。授权范围为独立代码、本地测试、规划与交接；本轮新增付费调用、生产部署、真实玩家档、库存写入、凭据/权限均为零。
- 国际用户、虚构现代北美海湾、原居民身份保持；产品英文主流程并支持中文本地化。中文工作语言不改变故事所在地。

## 本轮消费者

`src/animals/native-crab-profile.ts` 固定 `shore-crab-native-c1-v2@2`：手工识别八条步足的支撑/摆动投影及低壳，两个抬起的钳子不冒充地面；这是保守扫掠面，不是物理接触/承重模拟。下/上地面矩形 `[-15,-20,30,20]`；左 `[-8,-26,23,26]`；右 `[-15,-26,23,26]` 为完整反射。显示包络 `[-14,-24,28.5,24.5]` 单独保留 8 世界单位间隔。

`native-crab.ts` 实现朝向与横移轴分离、18/26 单位每秒、16 单位步幅、68 接近/92 恢复、最多64横向退避、0.8秒站停、dt上限40ms。退避到端点后保持警觉站姿，不向尚未离开的玩家走回；堵塞安全等待或隐藏。当前分钟/场景重新投影，暂停不前进，无离线追赶。旧重叠只调整/隐藏新蟹，不移动原人物。`observe()` 明确只返回 `fixtureOnly/activationAllowed=false` 候选。

`native-crab-art.ts` 直接消费固定 PNG 与 manifest，stand/A/B×四向共12帧；右向只做完整镜像与整帧1像素根位补偿。九个原件保持字节 pin；没有肢体后期拼接、换色冒充新物种或重新生成。固定根锚 `[0.5,88/128]`，整帧最近邻缩放 .056、renderer .5。本轮校正了纹理 key/列映射，真实 GPU 证实四列和三个姿态行。

接入时应复用当前 world、people、animal runtime，并供给已有动物地面体，以及包含完整人/物可见包络、NPC合法巡游走廊、原动物全日程领地/可能飞行高度的显示 guard。可参考 `_qa/animal-stand-space.ts`、`_qa/crab-c1-space.ts`；不要为了放下新蟹移动原居民/动物或修改岸边地形。可行空地位置与尺寸只是本作夹具，不是跨游戏默认出生点。

正式激活的剩余工程接缝：把经过准入的蟹能力注册到唯一动物实体/互动入口；将服务端当前姿态、邻近距离和安静状态校验接到已有观察 proof；若需要持久状态，加入可选、版本 pin 的读档校验。收藏复用现有知识页，奖励由作者规则和原子幂等结算决定；客户端不能自己领 proof。本轮故意未将蟹加入生产 Species/acceptedAnimals，也未建立第二套存档/收藏后端。这项正式接线属于集成 owner，不应把禁用兼容测试当成已经完成新增字段迁移。

## AI v4：已有事实选择，作者正文与规则

`server/animal-grounding.ts` 接受精确结构 `schema/id/revision/resident/theme/observations`，每条选择必须命中具体猫/鸥的真实时段、地点、行为；禁止自由 title/正文/奖励/新能力/proof 字段。2–4条观察、固定两个主题、已认识的四位居民；事实正文由中英固定模板编译。猫2上午院子晒太阳、猫3午后院子晒太阳；两只猫夜间院子睡眠都合法，不把正确夜间事实误删。

`server/animal-proposals.ts` 通过现有 gateway、测试 store、CAS/receipt，固定源 hash、choice/definition hash、session/version/cursor；只采纳可选委托定义，无采纳奖励。观察、收藏知识、分享后固定+1关系及重放幂等均复用原动物生活模块。历史已采纳版本读回不依赖新提案开关。未增加生产路由/接口或真实模型调用。

M1/M2 原响应及失败原样封存：包括599字符 finding 超长、错误的个体下午事实；不截短假装通过。新 parser 每 finding≤300、最多8；passed=true 必须无 finding。v4 免费 fixture 的提案→采纳→接委托→猫2观察→休息180分钟→鸥3观察→Owen分享→知识页 pin→幂等重放已经跑通。该证据属于真实权威模块的合成账号执行，不是正式 MiniApp。

## 验证与复现

- `evidence/regression-final.tap`：123/123；含原动物/动物生活、B1/B2种植与收藏、22居民、时间/连续移动/重叠/室外通路，以及新增原生6项和AI6项。
- `evidence/native-ground-matrix.json`：三岸图×四向×四时段=48场景；17,280 地面/显示安全帧；104重叠案例=16类方向阻挡+22居民×四向88合成旧重叠。实际时段只出现按日程在场居民，22人全集另有合成压力测试，不声称全部22人同时在三岸图。
- `evidence/native-crab/REPORT.json`：390×844/320×568，三图四向24/24；288案例截图、144实际rAF样本、24次通过当前连续移动 adapter 的正常避障靠近；暂停、完整纹理隐藏/恢复、原居民脚点和步态切帧通过，0浏览器错误/0外网请求。
- 此 QA 使用原 RPGJS/Pixi、正式地图/素材/连续移动 adapter，显式本地 fixture ack；复现了当前居民巡游合同，不含完整 Main/HUD/guest-shell、平台身份或生产 authority 服务。文件名虽沿用 `platform-layout-*`，验收范围仅为隔离 renderer 的比例/空间/运动。没有真实手机、Telegram、跨设备或新玩家理解证明。
- `evidence/production-entry-unchanged.json`：生产8个 `dist/assets` 逐字节一致，QA未入主bundle；新增public蟹包与NOTICE。不应把相同主bundle称作新蟹已经启用。
- build/typecheck、公开秘密、API base、UI静态扫描、diff检查通过。既有大chunk warning保留。早期真实失败在attempt1–8，不删除；仅清理本目录自己可再生Vite缓存后UI扫描通过，没放宽scanner。
- 上批794文件/原paid记录/SHA仍通过，见 `evidence/old-sealed-manifest-final.json`；未重写旧 HOLD/拒绝历史。

已有依赖，不安装。在 `source/` 运行 Node22：

```sh
export PATH=/Users/yin/.nvm/versions/node/v22.22.2/bin:$PATH
node --import tsx --test _qa/native-crab-admission.test.ts _qa/animal-grounding.test.ts
npm run build
node _qa/run-crab-c1.mjs
```

浏览器入口只监听回环5528、最长480秒，wrapper自动清理自己的进程；使用已有 Chromium。新目录须先建上级 evidence；不要指向生产数据库。单测写自己 metrics，旧 animal-modules 测试有历史 matrix 输出副作用，复跑整批时须只还原自己副本该历史文件，不能覆盖旧包。运行浏览器会生成本目录Vite缓存，不把依赖缓存glyph认成新增产品UI。

## 交付件与下一边界

`deliverables/ce694-to-native-crab-v4.patch` 是含二进制的直接补丁；`native-crab-v4.bundle` 为带 ce694 prerequisite 的本地分支包。`crab-native-consumer-v2.tar.gz` 供内部游戏/库 owner 消费，含9个接受原件、十条固定来源记录（拒绝原件不入接受素材）、权利依据副本、profile、geometry、消费者与最终审核。实际 inventory/catalog 不曾写入。

剩余真实边界仅为：集成 owner 正式能力/proof/可选存档接线与部署；库 owner 实际登记；若要测试真实 v4，父端取得新 AI-M3 批次许可，草拟1+独立复核1，最多2次、失败计入、禁止自动第三次，不借M1/M2/C1余额。价格未取得，不编造金额上限。狗新动作、挖洞能力仍未获额外授权/实现。无原生CUA，完整Telegram与真机QA未验证。
