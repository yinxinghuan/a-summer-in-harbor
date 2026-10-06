# 三位科技居民本地候选验接

状态：**AI本地可用，未发布**。唯一集成owner为`01a10d0d-57fd-75d8-9d32-21d279e2d0a0`。独立分支`codex/tech-nomads-owner-20261006`从实现候选`52bb6daa164b551ed20c40953d493b17d32ca1b9`推进，基于已发布动物提交`f6e6be82ee10e6422892754a1fc624147e217c2c`。没有混入B1/B2生活功能，不修改原工作树业务文件、正式玩家或共享素材库。

Harper、Tess、Noor三个atlas、三个256头像和三个512方肖像按最终制作交付逐字节接入；全22居民和3猫4鸥保留当前日程、关系及权威身份合同。三人新增方形资料图类，沿既有UI使用contain；原19人的资料图尺寸策略保持。NPC偏移0/0、脚锚64/122、scale56/108，主角8/12不套用到NPC。

## 固定来源与权利

最终制作目录`/Users/yin/code/games/harbor-tech-nomads-art-20261006/`；交付manifest SHA256 `3c4124720a6598ae4fa00c17067b836073aeef3bafdd93fd9a1c8cd44a5e5bb2`。独立核验935文件、173425146bytes零不匹配，81固定参考零变更。制作方35/42实际POST、30有效原生目标、5视觉拒绝；余7关闭不续用、费用未知。owner本轮模型和媒体调用均0。

`owner-rights-review.json`核实3份既有权利依据及30选中源SHA。旧人类权利记录不逐项列出新任务；同服务、同项目适用为AI应用判断，非新的人类法律声明或通用开源许可。保留业务项目使用权限和来源/处理记录；没有新增Library、上传或发布授权。`public/THIRD_PARTY_NOTICES.txt`包含对应说明并进入dist。注意现有`scripts/notices.mjs`会重建并覆盖人工追加的多批说明；后续发布须保存、合并并复查这些通知，不能仅运行生成器后认为义务完整。

## 本轮已验证

- `_qa/run-tech-nomads-offline.mjs`：37文件176/176通过。Node24输出spec footer，原helper只识别TAP导致首份JSON计数null；原始日志保留，`logs/nomads22-offline-summary.json`按真实footer导出176/176。helper已兼容两种footer。
- 23项针对性检查通过：3居民双分支双语、1440分钟日程、旧档、SQLite重开/CAS/重放/owner隔离，当前22居民和7动物的路径/碰撞/热点保护，消费者所有方向/姿态锚点。
- 当前22候选12个完整普通UI流程：3人×320/390×中英；介绍、伙伴前提、两分支选择、回家休息、真实地图再访、资料列表/卡/放大/历史和刷新。各本人/伙伴只+1关系、回忆0重复奖励，旧Mira关系2保持；资料阅读0业务写。
- 18日程地图夹具：3人各3地点×2尺寸，用实际Main/View/RPGJS和当前NPC脚点，夹具读地图0动作、0版本变更。自然巡游和遮挡保留，不强制选中目标或跳跃穿墙。
- `owner-consumer-pixel-audit.json`：9份RGBA消费图尺寸/透明/强品红0、9格右向整帧镜像一致。只读标准库解码，不改图。
- 最终构建、public secrets、API base、相对资源路径和通知文件另见最后封存日志。保留Vite既有classic storage/chunk大小提示，不把提示当构建失败。

实际浏览器使用独立合成旧档、真实HTTP handler和隔离SQLite权威；外网全部abort，guest shell被阻止，不监听端口。普通键盘步行到实际NPC、正常Interact及作者动作，不注入AlterU身份，不访问正式账号或原存档。地图近景夹具是在创建合成旧档时设置观察位置，不能冒充从出生点步行的证据；完整故事流程的移动使用真实键盘。制作方四向连续49轮隔离场景证据独立保留，不冒充本owner全部正式路线连续四向循环。

## 剩余验收与发布边界

正常AlterU MiniApp／作者Create→Published→Play与原正常session、本候选真实手机触控、第二账号/跨设备、官网资料UI、新玩家理解、本候选实际PG和两项HTTP listener套件均未验。不得把前次动物发布/PG证据继承成三人新版本通过。平台与网站未部署本候选；当前线上仍是19人动物提交f6e6be82。

科技新闻仍`NO_ADMITTED_TECH_ARTICLE`，职业观点是虚构背景，不冒称现实当日新闻；既有经济冻结来源与到期日期不改。真实资讯带来居民故事仍是后续目标，需单独来源审核。当前`src/release.ts`继承Mira标记，不能用此字符串证明三人上线；后续若发布须核对候选commit、实际前后端bundle和两个前端及唯一后端。

`../harper-owner-20261006/`是20人Harper先行检查点，已由本目录22人最终矩阵覆盖，不把旧Tess/Noor HOLD误当当前状态。原始试错日志、失败截图和合成SQLite在`/private/tmp/harbor-tech-nomads-owner-20261006/evidence/`保留；这里只封存有效报告和成功截图，`screenshots-manifest.json`列138份固定图。Mac Chromium默认沙箱曾MachPort拒绝；同一受限本地QA经明确范围的require_escalated获准后通过，没有绕过。系统Pillow x86_64扩展在arm64 Mac不能加载，改用只读标准库PNG审计，未安装或篡改依赖。

## 重现入口

使用Node24和`TMPDIR=/tmp`。构建`npm run build`；离线`node _qa/run-tech-nomads-offline.mjs`；PNG检查`python3 _qa/tech-nomads-pixel-audit.py`；美术消费检查`node scripts/audit-tech-nomads-art.mjs`。浏览器脚本`_qa/tech-nomads-owner-browser.ts`通过`QA_PERSON=harper|tess|noor`、`QA_OUTPUT=<独立目录名>`运行，两宽度两语言默认矩阵；`QA_MAP_SCENES=1`切为日程地图夹具。执行前看脚本具体支持的过滤环境变量，Mac Chromium如权限拒绝须报告确切目标并走审批，不改浏览器安全参数。
