# B：受限动态素材候选（未部署）

当前在 e77275cb87314912624e0acc253ec69a4b1de9c8 上独立实现，没有包含固定包 A。原游戏脏工作区未覆盖。

## 已实现

- 五动作同 UUID 网关、16KiB 请求限制、可信 edge owner、两个精确新旅程的 QA 白名单、24小时到期、3600秒原 pin 续期。
- reader 只读库存和冻结 app-v2；只允许三件 @2、精确 profile/view/几何；客户端不传授权身份。
- 两表 SQL：server/dynamic-assets/migration.sql。PG adapter 与原 authority 使用同一 world advisory lock，packages/grants 与 async_media 侧附件在同事务写入。runtime DML 与 migrator DDL 分开，无新角色凭据。
- 对测试旅程供应固定槽位碰撞；前端逐包校验后在真实 RPGJS View 加载新增 sprite。普通玩家没有动态字段/碰撞。旧缓存客户端访问测试旅程前明确要求刷新。
- scripts/dynamic-live-canary.ts 为未执行的真实库存验收入口；私有 cookie 状态必须在仓库外，create仅建两个旅程，verify沿合法剧情动作进入三处场景，无模型调用。

## 已跑与没跑

54项本地测试通过（含6项新增）、TypeScript/Vite 构建、Node22目标服务端 bundle、凭据扫描、API base检查通过。正样本为明确标识的合成1px图，覆盖选择/精确字节/服务端归属/续期/失效与拒绝/整组回退/网关/碰撞隔离；这些不是实际 @2 美术的远程成功。

PG DDL/事务尚未在真实 PostgreSQL执行；只读挂载、生产五动作、实际 @2 query/select/blob、刷新重启/撤销/过期的远程验证和本轮浏览器 renderer 验收均未开始。新live canary脚本未运行。不得把候选称为已发布或生产验收通过。

## 停止原因与继续入口

素材库 owner 的同一 SendFile 在实际主对话批准证据补充后仍被自动审批拒绝；没有真实 @2 可读。因此游戏方没有远程命令、PG变更、Worker部署、QA旅程或24小时运行窗口。没有代传或换通道。

解阻后先由库 owner 完成原范围并提供实际 @2收据及服务器窗口释放，核对当前基线，再对本候选代码审查和真实 PG事务验收。按已批APPROVAL-SCOPE取得deploy.lock、备份、迁移两表、部署同commit前后端/Worker先off，再私下创建两旅程并设24小时名单。随后运行实际库存canary、浏览器场景、重启及隔离/撤销/到期/恢复验证。不要运行原pg-canary.ts，因为它另建多组通关旅程，不属于本次限定两个QA范围。

原APPROVAL-SCOPE中的身份边界不变：browser-capability-v1，不代表平台账号或跨设备续玩。
