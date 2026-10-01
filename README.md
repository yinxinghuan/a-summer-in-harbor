# A Summer in Harbor · 海湾新生活

一个普通人来到海湾小镇度过夏天的 2D 开放探索 RPG。五个室外地区、室内外共二十处作者地点、渐进式入住引导、街坊交谈、三条解决通行问题的路线，以及切磋、走位、垂钓、修理和拼图。

## 本地启动

需要 Node 24、SWI-Prolog（生成规则检查）、Python + Pillow（素材与动态图片检查）。

```sh
npm ci
npm run server
# 另一个终端
npm run dev
```

打开 http://127.0.0.1:5234/ 。最终构建试玩 http://localhost:5235/ （先运行 `npm run preview`），当前保留在新玩家序章。权威端口 5236；存档在 `.data/preview.sqlite`，不要删除它来“修复”问题。首次平台生成需要可用的 AlterU 平台媒体/对话服务。没有网络时固定探索和已有话题仍可使用，生成请求会明确报错。

`npm test` 验证规则与恢复，`npm run build` 产出便携 `dist/`；`npm run preview` 在 5235 预览构建，仍需要本地权威服务。

## 状态与证据

当前是本地可玩制作版，未发布。不是多人世界或无限生成承诺。素材由平台服务新制，没有读旧游戏图片作为参考；同轮角色/门派生有明确记录。

已获上线授权，发布接头与镜像入口正在准备；实际部署前仍须确认托管期限与临时存档身份，详见 [发布状态](doc/release-readiness.md) 和 [部署合同](deploy/README.md)。

- [需求](doc/requirements.md)、[视觉](doc/visual.md)、[技术](doc/technical.md)
- [验收与限制](doc/qa/acceptance.md)、[技能试用评估](doc/skill-evaluation.md)
- [第三方许可](public/THIRD_PARTY_NOTICES.txt)

默认英文或中文跟随系统；方向键/WASD、点地面或圆形摇杆移动，靠近后使用行动按钮；地图可缩放拖动并返回已到访地点。对話可选择话题或自由输入。
