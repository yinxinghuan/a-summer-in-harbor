# 《海湾新生活》继续点 · 2026-10-01

本地高保真首章已完成制作，用户授权完成游戏，尚未要求发布。国际用户，现代北美虚构海湾，en/zh 跟系统。20 个作者地点含 12 室外、8 室内，另有两代有界线索地点；五个大室外枢纽，不能改回盒子房间。

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
