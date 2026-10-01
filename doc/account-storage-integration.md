# 账号存档与已有后台接入 · 2026-10-01

## 用户确认与纠正

用户已确认长期后台 + 同 AlterU 账号跨设备续玩。用户指出后台由另一个 agent 开发；本任务应首先复用该实现，不能未经核对就要求用户找平台同事重新提供整套后台，也不能另行默认采购。

## 已核对事实

- 任务「RPG游戏升级优化」（01a0bf28-860c-7982-a6bc-e463998daf6b）已经完成真实 Linux/PG 游戏接入。《旧街》发布证据：`../dynamic-rpg-kit/evidence/oldstreet-release-20261001.md`；独立 world/schema/container，非空白待建后台。
- 本作已经通过冻结的 vendor/dynamic-runtime 使用同一套通用权威库；应继续增加本作接头与独立数据范围，不复制别的游戏世界、凭据或玩家数据。
- 已核对 `../dynamic-rpg-kit/deploy/finance-public-worker.mjs`：目前公开入口签发浏览器能力 cookie；这证明服务端存档隔离，尚不证明 AlterU 账号认证或跨设备恢复。
- 旧发布报告的 2026-10-01 18:02 截止已经过时。最新 `../dynamic-rpg-kit/evidence/finance-budget-only-20261001.md` 记录撤销固定截止并保留1000/800/900元预算保护；不等于海湾的长期托管授权。本任务不修改另一个 agent 管理的停机任务、预算或服务。
- 平台已有 `shared/save/useGameSave.ts`；其 `get/data/list` 返回最近六位用户的存档，再由客户端筛选。该合同不能作为私密凭证仓库，也不能保证任意老玩家的存档都在返回列表内。
- 本次阅读可见交接/代码，未找到已投入使用的服务端账号验证接口。此结论是“尚未找到完成证据”，不能扩大为“平台不存在此能力”。

## 接入顺序

1. 以已有 RPG 后台为基础，落实长期宿主与本作独立数据库/进程，不重复建设另一套规则服务。
2. 核对后台既有登录适配器或平台身份交换合同；复用稳定账号 ID。浏览器传入 user_id / telegram_id 不能单独作为服务端授权证据。
3. 同账号的新设备通过身份验证后读取已有旅程目录，再读取最新 head；空浏览器缓存不得自动覆盖服务器档案。
4. 平台普通 save 数据只存非秘密索引/显示信息；权威剧情仍只在 RPG 后台写入。不将 bearer capability、签名 cookie 或长期凭据放进可返回他人记录的列表。
5. 验收两个独立浏览器、账号切换、清缓存重新登录、账号 A 无法读 B、断线重放以及旧设备迟到请求不能覆盖新进度。

## 仍需实际完成

长期运行安排、账号验证的具体接头、真实 PG/双设备测试与主站部署。当前不把上述规划记为已完成，也不沿用纯浏览器身份作为用户已批准方案。

当前用户已恢复本批账号接入与验证，但禁止部署；新增凭据/安全权限先询问。

## 旧技能追溯（2026-10-01 本批只读核对）

用户提示这件事以前解决过，已扩大核对到旧技能、旧交付包、平台原始 API 文档和托管服务接头，不仅检查当前 RPG 技能。

| 既有方案/代码 | 实际完成的边界 | 本作可复用部分/缺口 |
| --- | --- | --- |
| `../.agents/skills/game-persistence/SKILL.md` 与 `../shared/save/useGameSave.ts` | 宿主附登录 token 调用平台存档；客户端按当前 ID 筛选最近六用户记录 | 已有认证传输成立；不提供本作 PG 请求的服务端账号验证结果 |
| `../.agents/skills/rpg-story-session-production/references/architecture.md` | 随云存档同步随机 capability，新设备持同一凭证恢复 owner 目录 | 旧技能明确 possession-based，并非账号验证；多用户可读存档不适合保存 bearer capability，本批不采用 |
| `../alteru-rpg-service/client/platform-proxy.mjs` 与其技能 `references/platform-integration.md` | 后台注入私有服务令牌和经验证的 actor；丢弃浏览器伪造的身份头 | 可复用可信代理边界；`yourExistingLoginVerifier` 是占位函数，不是已实现的 AlterU 校验器；旧 v1 SQLite 接口不是本作 PG 适配器 |
| `../stateful-action-authority-experiment/doc/platform-identity-contract.md` | 定义短期证明约束和合成测试 | 原文明确 claims 夹具不验证真实签名 |
| `/Users/yin/Downloads/aigram-runtime-api/doc/game-get-data-list.md` | 原始接口返回最近六个用户记录 | 已核对源文档，不靠猜测；不复制用户数据/凭证 |
| `/Users/yin/code/chataigram-web/src/core-stub/index.ts` | 设计用登录 hook 占位与 mock | 自注释明确真实接入位于 chataigram-app 组装项目；不能当作真实登录服务 |

结论：平台本身已有登录与认证代理。当前本机可见资料仍缺“把该已验证身份交给本作自有 PG 后台”的实际接线；不因此另建账号系统或把前端 ID 直接升级为写权限。真实双设备/不同账号验收仍待此接线，未用模拟账号冒充通过。

本批对白草稿与阅读游标已按部署（storage adapter）+ 权威旅程 ID + 人物分区。它只是展示缓存隔离；没有真实账号验证前，不宣称账号切换隔离完成。
