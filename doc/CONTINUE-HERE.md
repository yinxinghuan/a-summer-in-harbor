# 《海湾新生活》继续点 · 2026-10-01

本地高保真首章已完成制作，用户最新明确授权完成并上线。国际用户，现代北美虚构海湾，en/zh 跟系统。20 个作者地点含 12 室外、8 室内，另有两代有界线索地点；五个大室外枢纽，不能改回盒子房间。

- UUID e78df027-7ef4-4d49-82eb-ea91f03d9fb3；独立项目，旧游戏修改保留。
- Node24：`/Users/yin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin`；Pillow：`/Users/yin/miniconda3/bin/python3`。
- `npm run server` 端口5236（不是 watch）；`npm run dev` 5234，`npm run preview`5235。`.data/preview.sqlite` 是玩家存档，不可删除来重置问题。
- 当前测试玩家已经通过修桥路线开放集市，继续自由探索。使用界面完成，未注入进度。
- 当前是本地 authoring authority，不是生产认证/PG。未建远端仓库，未平台入库、未上线。
- 完整证据与限制读 `doc/qa/acceptance.md`；技能应用/补充读 `doc/skill-evaluation.md`；最终结构读 `doc/technical.md`。
- 已写回共享技能两项：室外大图层 streaming/原点裁剪风险、地图固定触控标签 Fit 边界。战斗内核可复用但尚未经第二题材验证。
- 素材全由平台新制；根图零旧作参考，同批人物/门派生有记录。Mara 不巡游；不要把未通过步态硬放回来。
- 待用户试玩：真实手机持续性能、声音听感、引导理解。60–90分钟是设计目标，尚无净时长证据。

最终构建试玩使用 `http://localhost:5235/`，与 127.0.0.1 的已通关 QA cookie 分开，保留新玩家序章。最终规则测试 22/22、构建通过。大地图画布采用 overflow:clip 防止焦点滚动；室内 clamp 在小于视口的轴上对称扩展。

## 10 月 1 日发布准备

- 新增独立 PG 接头、共享 HTTP 路由、同 UUID Worker 网关、私有 staging 脚本、Pages workflow、镜像引导入口、在线错误文案。未部署，不能宣称 PG 实测通过。
- 当前 23/23 测试与构建通过；密钥/API 路径扫描通过；窄屏镜像截图 `_qa/mirror-platform-layout-320.png`。发布身份测试用的是 transport mock；之前本地持久化测试仍是 SQLite。
- 读 `deploy/README.md` 与 `doc/release-readiness.md` 继续；实际 PG 重启/并发、容器以及主站端到端是后续必过项。
- 已向用户发出两项待答复：服务器到 2026-10-01 18:02 北京时间的现有授权之后怎样托管；是否接受首版浏览器能力身份（换设备不自动恢复）。没有答复前不要续费、修改停机期限或公开启用该身份模式。
- 服务器配置和凭据不在仓库；不复制旧金融游戏的 UUID、存档、token 或私有配置。基础容器镜像需实机验证 Node24 + SWI + Pillow。
- 用户远程尚未试玩本作，“序章自由对话”只是确认问题，不是试玩结果。
