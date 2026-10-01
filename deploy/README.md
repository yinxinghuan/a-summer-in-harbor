# 发布接头与待完成验证

状态：已实现，尚未在正式主站启用。不能将单元测试通过等同于已发布。

## 部署结构

- 前端与网关位于同一 UUID：`e78df027-7ef4-4d49-82eb-ea91f03d9fb3`。
- `worker/index.js` 只代理该游戏允许的 API。配置和签名密钥由部署器私有 bindings 注入。
- 网关签发浏览器能力 cookie，忽略浏览器传入的 owner；后台校验私有 edge 签名凭据。这不等于平台账号验证，换设备不自动恢复。该临时模式须用户明确接受后启用。
- `server/public.ts` 以独立 PostgreSQL 数据库 / schema 持久化唯一权威记录，不回退 SQLite。`server/index.ts` 仅供本地创作，不能公开代理它。
- GitHub Pages 仅分发同提交前端，入口链接至主站，不连接另一套后台。

## 私有配置

通过文件挂载 `HARBOR_CONFIG_FILE`、`HARBOR_EDGE_FILE`、`HARBOR_PG_PASSWORD_FILE`。三个文件必须为非符号链接的 0600 普通文件，均放在仓库外。配置字段：

| 字段 | 合同 |
| --- | --- |
| gameId | 上述 UUID |
| publicOrigin | `https://game.aiwaves.tech` |
| upstreamOrigin | 已验证的 HTTPS 后台域名，无子路径 |
| identityMode | 经用户同意的 `browser-capability-v1` |
| timePolicy / expiresAt | 本次获批复用现有预算保护：`user-approved-budget-only-20261001` / `null`；网关对应 `none`。固定时限模式仍要求未来毫秒；未知策略拒绝启动 |
| pgHost / database / user / schema | 新游戏独立范围；database、user 以 harbor_ 开头，schema 以 kit_ 开头 |
| port | 私有容器监听端口，1024–65535 |

后台代理只把 `/<UUID>/api/*` 转到容器 `/api/*`。容器端口不对公网暴露；不能改写其他游戏的路由、存档、角色或部署配置。

## 迁移与运行

1. 获批的宿主先建立独立数据库、迁移用户与运行用户；运行用户没有 DDL 权限。
2. 使用独立的 `HARBOR_MIGRATOR_USER` / `HARBOR_MIGRATOR_PASSWORD_FILE` 执行 `npm run migrate:public`，运行时不挂载迁移凭据。
3. Dockerfile 接受不可变 digest 的 已核实的 Node 22.22.2 + SWI-Prolog 10.0.2 基础镜像不可变 ID，在海湾独立层安装 Python/Pillow；本机 Node24 用 esbuild 产出 node22 服务端 bundle。
4. 容器以 uid 1000 运行，持久卷仅挂载 `.data`（Prolog 运行目录和图片 sidecar），数据库另行备份。限制 CPU / RAM / 日志；采用单实例，未验证水平扩容。
5. 在实际 PG 上验证创建存档、重复 action 重放、版本冲突、跨 owner 访问拒绝、重启恢复、自由问答以及动态线索与图片。冻结模块仍保留 environment=test 入口；本项目接头不代表通用生产 SDK 已通过认证。
6. 运行仓库外配置下的 `node --import tsx scripts/prepare-public-deploy.ts /private/tmp/harbor-public-deploy-<release>`，再由固定平台部署器部署该 staging 路径。不要复制私有 bindings 到源码目录。
7. 双部署同一提交后检查两个实际 bundle 的 `harbor-public-r1`，主站实际 API 与新玩家流程；Pages 只检查前端镜像与主站跳转。

截至本轮：网关单元测试已通过；实际 PG、容器、正式网络、重启恢复和双部署检查仍待执行。用户已选择长期后台；宿主、费用与维护方案待落实，浏览器身份模式尚未获同意。平台存档同步和后台账号验证需分别核对，不要默认平台缺乏跨设备存档能力。

## 2026-10-02 实机进展
用户已明确接受临时浏览器续玩并批准海湾专用配置。现有唯一 ECS 中建立独立 harbor_game / kit_harbor，harbor_runtime 无 DDL，迁移角色独立。海湾非 root 容器仅私网，不公开 PG；旧游戏路由保持。三条完整章节路线、幂等、PG 重开与其他 owner 拒绝已实测通过。旧固定截止已撤销，本次继承现有 1000 元预算/800 提醒/900 停机，无新购买或预算。Cookie 30 天且 bootstrap 刷新同一身份。平台账号绑定尚未完成。
