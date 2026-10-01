# 投资人说明 · 内部证据（不放公开网页）

公开稿：`doc/investor-technical-public-20261001.md`，正文576字符（含标点/英文字母）。本次仅核对和写稿，没有修改游戏、建站或部署。

## 事实与代码

| 公开表述 | 可核对证据 | 限制 |
|---|---|---|
| 前期分步介绍、领取钥匙、早期自由提问 | `doc/qa/dialogue-onboarding-20261001.md:9`；`src/story/state.ts:31` | 三页序章及中英真实AI问答为本地浏览器验证，非新玩家理解测试 |
| 模型只用于自由提问/补充线索，行走及普通任务不每步调用 | `server/runtime.ts:11`；`server/dialogue.ts:7` | `ask`分支调用对话模型，notes分支另外处理，普通动作直接规则计算 |
| 当前人物、已知事实、随身物品、最近谈话组成回答上下文 | `server/dialogue.ts:9` | prompt及输出检查约束回答，不能承诺绝无不合理文字 |
| 模型不能直接发道具 | `src/story/state.ts:48`；`_qa/story.test.ts:14` | topic必须属于当前允许列表，执行同一固定动作；正文不能成为数值权威 |
| 领取钥匙前检查介绍、位置、进度；话题退休 | `src/story/state.ts:43`；`_qa/story.test.ts:8` | 范例是匿名合成游戏情境，不使用真实用户行为数据 |
| 网络恢复不重复领取 | `src/story/client.ts:10`、`:16`；`_qa/recovery.test.ts:6` | 测试含本地数据库重开后回执重放；不是跨设备账号验证 |
| 回复分页与阅读恢复 | `src/story/dialogue-reading.ts`；`doc/qa/dialogue-onboarding-20261001.md:13` | 当前同浏览器阅读缓存，不宣称账号级阅读同步 |
| 战斗/钓鱼复核操作过程 | `src/story/state.ts:51`；`src/combat/core.ts`；`src/challenges/fishing.ts` | 重放压缩输入判断输赢；不夸大成全面反作弊系统 |
| 制作期出图及场景审查 | `scripts/media-batch.py`；`doc/art/plant-catalog-20261001.json`；`doc/qa/plant-refresh-20261001.md` | 当前植物8种、22地点、32测试；本轮植物等待审美验收，第三轮布局已获认可 |
| 运行期生成范围有限 | `server/fieldnotes.ts`；`server/note-media.ts`；`doc/technical.md`动态线索段 | 两代有界补充地点，预置空间壳；新图是特写，不是无限实时地图 |
| 账号、公开上线边界 | `doc/account-storage-integration.md`；`doc/release-readiness.md`最新“当前批次·不部署”段 | 历史授权不覆盖后来的暂不部署指令；真实账号与跨设备未通过 |
| 素材库和模板边界 | 当前元数据scope均为Local project；`doc/qa/plant-refresh-20261001.md`后续边界 | 有项目素材来源记录，尚未建设/验收共享素材库；模板存在不等于跨题材稳定性已证明 |

## 可选架构节点文字（供公开页画图）

主链：玩家移动/选择/提问 → 位置与任务条件检查 → 执行允许的动作 → 更新道具、路线与记录 → 画面/对话反馈。

对话支路：允许的自由提问 → 人物与已知事实 → AI回答或选择已有话题 → 输出检查 → 主链。

恢复支路：暂时中断 → 识别同一次操作 → 读取已经确认的结果 → 接着玩。

制作支路：美术描述 → 平台出图 → 比例/透视/风格/场景审查 → 游戏素材。必须与游玩期AI支路分开。

## 链接与截图

本作**没有已验证的公开游戏链接**。仅有本机预览，不可把本机地址或预分配UUID拼出的地址当成公开试玩地址；不要在公开页伪造“立即试玩”。其他旧作公开链接应由负责旧作的agent核对提供。

可给公开页面制作方使用的本地画面：

- `_qa/ui/plant-refresh/after-station-platform-layout-390.png`：正常英文手机游戏画面，无内部QA栏，无真实用户身份。
- `_qa/ui/use-logic/after-home-platform-layout-390.png`：正常英文室内手机画面，无内部QA栏，无真实用户身份。
- `_qa/dialogue-opening-platform-layout-390.png`：序章说明（引用前仍应查看实际画面）。
- `_qa/dialogue-reply-platform-layout-320.png`：测试问题生成的英文回答（引用前确认上下文，可用作演示示例，不能冒充真实玩家评价）。

`*-platform-layout.png`桌面场景检查图包含“RENDERER REVIEW / NOT A PLAYER SAVE”内部检查栏，建议只作内部对照，不直接当产品界面放公开页。网页若需桌面主界面，再从正式UI取图，不抹去诊断标识冒充生产截图。

目前检查过的正常手机画面没有私人账号资料、密钥或付费后台信息；内容为虚构人物与平台生成游戏美术，本轮零参考，不含商业游戏原图。第三方代码/字体许可证在`public/THIRD_PARTY_NOTICES.txt`；若单独分发字体或代码须保留相应声明。生成图片的权利仍以平台服务条款为准，未做独立排他著作权审查，不作绝对版权保证。
