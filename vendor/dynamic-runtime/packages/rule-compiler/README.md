# @alteru/rule-compiler（未发布）

封存编译器的原样抽取。`compile(rules)` 校验受限 DSL，产生双语投影、规则、manifest 和 witness。`game-definition` 是旧版呈现兼容接口，不是新的通用游戏 profile。

保持原边界：schema 1/2、恰好三个属性、≤32 地点、≤64 事实/动作、表达式深度≤6/节点≤64。三个属性的限制尚未泛化，不允许在金融游戏中编造属性凑数。

resolve/applyForTest/witness 仅用于离线测试和编译证据；浏览器不能再用它们否决服务端结果。输出仍是 offline-compiled-not-published，不是自动批准的动态提议。
