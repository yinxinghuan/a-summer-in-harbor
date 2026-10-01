# @alteru/prolog-runner（未发布）

`makeProlog({directory, utilPath:'-', swipl:'swipl'})` 返回 `(compiled, cases) => results`。要求 Node 22.13+、已安装 SWI；调用者提供私有且只由本游戏服务写入的工件目录。编译器 0.2 走 evaluate_state，无需旧 util。

只供可信后台，compiled 必须来自受控编译流程；不能把模型/HTTP 上传的 rules.pl、路径或 resolverPath 原样传入。哈希文件名、module 名检查及 same_file 不是任意 Prolog 的安全沙箱，资源隔离与可信目录仍需容器层完成。参数中的可执行文件和路径属于部署配置，不是玩家输入。

原样保留每 factory 并发 2、15 秒超时、4 MiB 输出上限。服务必须复用同一 factory；每请求新建会绕过并发闸。统一 QuotaProvider、进程退出后的精确并发计数和输入上限在后续集成审计处理，本包尚未称生产安全完成。
