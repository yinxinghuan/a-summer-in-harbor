# 官方旧事实复核快照已接入本地候选

2026-10-05 18:59:16.076 UTC唯一一次授权RSS成功，原raw.xml9645bytes，完整响应SHA与历史相同，无新增新闻。网络抓取封存证据在原项目doc/qa/news-refresh-ecs-20261006-01a10d0d/，未覆盖。

本消费catalog保留原唯一准入事实及原id/revision1、Sep16发布日期、URL/标题/finance-budget-v1、旧first fetchedAt与旧contentHash basis；只更新lastCheckedAt、expiresAt与catalog.lastFetchAt。核对时间2026-10-05T18:59:16.076Z，有效期至2026-10-08T18:59:16.076Z（北京时间10月9日02:59:16.076）；没有将第二条原RSS已有项目加入故事集，也没有把hash算法变化当事实变更。原real-news-20261005/catalog.json SHA925028e59d28e539a9d6870c69df520bf147ef03f7d85e3a44bfc19a773caecf未改。

只给本地_qa/next-batch-server.ts明确默认路径，生产public.ts仍要求显式HARBOR_NEWS_CATALOG、未设置则不启用。已确认PID78995确为独立5331 QA服务，优雅SIGTERM后以同一SQLite/相同入口/新snapshot配置重启；其他服务与生产未停止/修改。configuredNews无配置opt-in、旧到期点、新到期−1ms/精确到期、未读拒绝、已开始新/旧故事不重绑与现金不变6项测试通过；TypeScript/Vite构建通过。

实际5331本地HTTP创建1条明确合成news QA旅程并读取：200/200、新核对/到期时间生效，版本0→0，current，cookie仅内存未保存；无游戏动作、生产/来源/模型请求。http-config-evidence.json为生效证据。默认沙箱先拒绝ps PID78995及本地5331连接，后走正常自动审查通过，不绕过；首次连接EPERM未创建旅程。网络授权没有重用来再抓RSS，没有部署。
