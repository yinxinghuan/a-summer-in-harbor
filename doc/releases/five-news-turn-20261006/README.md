# 五居民、冻结新闻与回合功能发布候选 · 2026-10-06

执行owner：`01a10d0d-57fd-75d8-9d32-21d279e2d0a0`。隔离源：`/private/tmp/harbor-five-release-20261006/source`，分支`codex/five-residents-release-20261006`，基于`12ef2cf98cac6a1bea4f541511539fcf4860ec1a`加封存差量一次。原脏master、六人候选、美术目录、正式玩家存档和共享库不在本轮本地写入范围。

## 已批准范围

按CORE_RULES的小小银转达授权，parent正式核读用户“同意”，批准先发布五位新居民／18人，含已完成新闻与回合功能，Mira地图延期。精确proposal/approval IDs、时间及转达来源见`approval-relay.json`。不是本thread直接真人发言，不追加新授权。预算54/78是历史生产账，剩余24不授权再发POST；本任务0新生成、0新闻复抓。

五位Rowan/Jordan/Leila/Casey/Grant保留独立故事、日程、生活、关系、体能与植物经济。Mira authored JSON和旧存档known/flags/关系/历史保留；当前地图、角色、咨询话题、任务引导不呈现她，不发布地图占位。15PNG直接固定合格消费文件，来源/权利/55原件映射见`asset-provenance.json`。以前六人profile/五map真实本地320/390证据在`../../qa/resident-art-consumption-20261006-v2/`，不把那些历史证据说成本次过滤名单的新UI验证。

新闻采用唯一获准复核的既有官方RSS冻结版本：原发布2026-09-16T18:00:00.000Z，首次抓取2026-10-04T16:17:55.111Z，最后复核2026-10-05T18:59:16.076Z，到期2026-10-08T18:59:16.076Z（北京时间10月9日02:59:16.076）。不是新的新闻事实。复制生产catalog并显式部署ENV；到期阻止未开始故事，已开始pin可继续，无自动抓取或日期伪更新。

## 兼容和定向验证

28项定向测试全部通过：五居民三步双结局、关系、新闻到期/旧pin、回合玩法、真实SQLiteCAS/重放/重启/owner隔离及新兼容用例。另真实专用本机PostgreSQL回合CAS/重放/重启1项通过，账号HTTP新闻1项通过，共30项成功检查；不重报历史137为本轮结果。初始PG连接受到sandbox EPERM，精确升级后HTTP通过，PG首次角色yin不在专用库；沿既有文档harbor_qa正确角色通过。没有安装、重建PG或读取线上凭据/存档。

两处真实兼容缺口已修复：旧known含Mira时的AI上下文姓名投影与空间snapshot人物投影。仅投影过滤当前registry，不写迁移。新用例导入自有旧fixture到临时SQLite，证明中英13人时代save原样可重开，以及含Mira旧事实、暂停回合、作物、旧新闻pin普通动作可CAS/重放、不擦除旧事实。

最终TypeScript/Vite和esbuild后端构建通过；UI Foundation strict、公开凭据扫描与API base门禁通过。新增release marker`harbor-five-news-turn-20261006`，health增加sourceRelease便于版本核对，身份合同仍temporary-unverified。源码与产物license notice随构建分发；不隐藏guest-shell或改UUID。不增加数据库DDL。

## 实际部署状态与剩余门禁

截至`live-before.json`：主站与Pages实际bundle均`index-CRG__j05.js`，SHA256`ab0119d37eaec529b3fa71157151238b65e379456635ae66642575e29cff46bd`；远端main/master仍3295fbd。新候选尚未push、上传或对外部署，不能声称发布成功。

当前tool catalog没有CUA／浏览器／Telegram，也没有tool_search。正常AlterU作者Create→Published→Play入口只读复验待主端回传或工具恢复；已请求主端协作，不要求再次批准发布。不通过AppleScript、CDP、假ID、其他browser工具或原存档操作绕过。此门禁未解前不暴露发布候选。

完成入口证据后，沿既有唯一PG后端、当前immutable image增量层和固定AlterU部署器，同一commit发布主站与Pages；预先备份、保留配置/挂载/身份/数据库，catalog ENV是明确delta。没有新认证、第二数据库或DB回滚；产生新状态后回滚必须继续可读新news/turn状态，不能恢复旧DB快照。上线后核同commit实际HTML/bundle/15PNG/catalog/health及正常平台QA旅程，真实跨设备、第二账号、iPhone与玩家理解仍未验证。
