# 六人资料图与五套地图本地消费验收 · 2026-10-06

游戏owner thread `01a10d0d-57fd-75d8-9d32-21d279e2d0a0`，同Mac候选 `/private/tmp/harbor-next-20261005`，分支 `codex/news-residents-turn-20261005`，HEAD `12ef2cf98cac6a1bea4f541511539fcf4860ec1a`。用户经小小银明确批准合格组件分别本地接入，不等待整批/共享库。独立美术owner只写其生产目录；本任务0生成、0外部采集/上传/发布，未改其目录、共享库/技能或真实存档。

## 来源与预算

只读 `/Users/yin/code/games/harbor-residents-art-20261006`，封存其manifest SHA256 `a73528706a8f898f1927a19250c1331646c42e65379d4fda1a94f62af0f9dee6`。17份消费图与57条固定原件映射全部核hash。五套各9来源request/task/model/n/size、同ID恢复、右方向三整帧镜像、60格alpha边界/脚底核对；12资料图原件/native/消费SHA、nearest采样与不透明内部RGB独立核对。既有业务权利及适用范围单独封存，非新法律声明/通用开源授权。

`producer-CALL_LEDGER.json`记录54/78 POST、剩余24，费用字段未知；主端最新要求停止新增POST，余量不视为可继续派发授权；恢复/失败计入总数，本任务未追加调用。Mira原修订task `mt_8cbaa6eecd3ef2a93d491a6c2ad4c4ff`仍running且超240秒窗口，属于独立生产owner继续公共GET的原任务，不新ID重扣。

## 实际消费结果

|居民|资料头像/肖像|实际本地地图|剩余|
|---|---|---|---|
|Rowan|两图通过并接入|独立图集通过并接入|本批正式平台/实机验证|
|Jordan|两图通过并接入|独立图集通过并接入|同上|
|Leila|两图通过并接入|独立图集通过并接入|同上|
|Casey|两图通过并接入|独立图集通过并接入|同上|
|Grant|两图通过并接入|独立图集通过并接入|同上|
|Mira|两图通过并接入|明确QA占位（旧mapArt），地图HOLD|原task终态与合格九姿态家族|

六人 `art` 消费 `public/art/<id>-root-v2.png`，新可选 `avatarArt`消费相识列表 `<id>-avatar.png`，`mapArt`分别指定NPC图集。Mira保留原mapArt占位，不请求不存在的npc-mira；原13人、19人总量、剧情/日程/经济/关系规则保留，未冒充整批美术完成。NPC偏移0/0，未抄隔离可动hero的8/12。关系列表方头像自适应64/56px，其余角色原fallback保留。

CUA在本地IAB正常开场、菜单→People & stories逐人查看：320×568和390×844，6头像加载256方，12次资料卡与12次放大图加载512×640，人物完整、可见轮廓无粉边，页面及320资料面板无横向溢出。26份资料截图与profile-ui-checks.json；五居民10份实际地图截图与map-ui-checks.json，canvas=1、scrollWidth=viewport，显示真实候选NPC/主角及场景遮挡。Leila经过田块的遮挡属正常场景深度；320目标HUD可能遮住地图上方人物，不属于图集裁断。浏览器本轮最终error日志为空。

独立原renderer五套320/390各四方向A/stand/B和停步stand证据读取并核验，摘要在source-audit.json。本任务实际候选只检查地图/绑定与场景，不把它声称为重新录制全部动作。没有iPhone实机、本批正式平台接入、第二真实账号或跨设备隔离的新结论。

12图机械strong-magenta计数0使用既有严格定义：alpha>0、R/B>180、G<110、min(R,B)-G>80。另做包含阈值等号检查，各肖像4/2/7/2/1/2（共18）边界候选像素，头像0，坐标均留在source-audit.json。三背景源审查图及实际放大图已目视复验，AI可用；不声称所有粉色RGB绝对为零。首次包含等号断言与生产口径不同，改为分别报告，不改PNG或放宽原生产规则。

11项居民/关系测试通过（含真实SQLite响应重放、重启和owner隔离；这是合成本地账号），最终TypeScript/Vite build通过。构建原有大chunk和普通storage-script提示仍在，无新构建错误；历史137项未整批重跑。消费contract对6人96个phase/方向及17复制图逐项验证，dist SHA最终核对见final-verification.json。

## 运行与权限边界

当前默认Node18不能跑Vite/--import，改用交接已有Node24；默认Python3 Pillow架构冲突，改用既有miniconda Pillow。无安装。`ps -p 18799`默认sandbox拒绝后正常自动review允许只读元数据；核对其cwd/entry为本任务5331 QA，仅SIGTERM该QA并沿同entry/SQLite重启，新增明确合成six-profile-review夹具；其他预览/PG/正式服务不动。系统临时目录 `/var/folders/_x/ww8zbmss7_13pf2zk142gsl80000gn/T/six-neighbor-XXXXXX` 写被拒绝，测试转入已授权 `/tmp` 通过，失败日志保留。当前API新session93137继续待机。

## 下一步与批准

Mira合格地图交付后独立核来源、家族、当前NPC绑定及320/390场景；不重新生成已通过五家族，不让Library5000目标或审批拒绝阻塞本地消费。批次仍未正式发布；主端需要另行决定发布范围/时点，以及安排真实跨设备、第二真实账号与iPhone/玩家理解验证。仍沿既有platform guest shell与本期front-end ID信任决定，不另造认证。新闻仍是旧事实复核的新快照（到北京时间10月9日02:59:16.076，原发布日9月16日），本轮未再采集。种植提示补丁已经包含于完整差量一次，不再叠加旧补丁。

经验先记于项目doc/skill-evaluation.md；本轮未覆写原交接/旧sealed报告、共享技能或个人memory。新durable交付路径见原项目doc/qa/candidate-art-followup-20261006-v2/README.md；该完整差量相对HEAD12ef，可替代之前差量，不累叠旧patch。
