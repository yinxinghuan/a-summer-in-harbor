# 动物AI合同V5（游戏端执行描述）

本文件字段说明从本次schema快照自动生成。源码真源为`server/animal-contract-schema.ts`；修改合同后须重新导出说明，不能单独手改数值。既有Game Chat只有messages接口得到确认；此描述不是服务端原生JSON Schema能力声明。

生成只选择原有能力中的观察，正文由作者编译。生成schema1与新审核V2分开；已采用定义保留旧revision/ref/hash。字符串长度按UTF-16 code units，不截断。

## 生成字段与确定性约束

- $: exactly schema, id, revision, resident, theme, observations; all required; extra keys forbidden
- $.schema: exactly 1
- $.id: 11..49 UTF-16 code units; pattern=^animals:[a-z][a-z0-9-]{2,40}$
- $.revision: exactly 1
- $.resident: 4..4 UTF-16 code units; enum=["mara","ruth","owen","dani"]
- $.theme: 11..16 UTF-16 code units; enum=["compare-routines","leave-space"]
- $.observations: 2..4 elements (inclusive)
- $.observations[]: exactly animal, behavior, period, scene; all required; extra keys forbidden
- $.observations[].animal: 12..13 UTF-16 code units; enum=["harbor-cat-1","harbor-cat-2","harbor-cat-3","harbor-gull-1","harbor-gull-2","harbor-gull-3","harbor-gull-4"]
- $.observations[].behavior: 5..11 UTF-16 code units; enum=["sun-rest","sleep","shore-space"]
- $.observations[].period: 5..9 UTF-16 code units; enum=["morning","afternoon","evening","night"]
- $.observations[].scene: 3..16 UTF-16 code units; enum=["station","home","cafe","grocery","harbor","dock","workshop","gym","market","bazaar","secondhand","courtyard","coast","beach","path","lighthouse","hill","garden","camp","weather","workshop-annex-1","workshop-annex-2"]
- ANIMAL_SCHEDULE_MISMATCH: Each cat sun-rest/sleep must match its own registered period, scene and activity; shore-space requires a registered gull slot. A group does not move or co-locate individuals.
- ANIMAL_DUPLICATE_REQUIREMENT: Each individual+behavior pair occurs once, even if different periods are named.
- ANIMAL_UNKNOWN_RESIDENT: The resident must be in the introduced knownResidents list.
- ANIMAL_THEME_MISMATCH: leave-space requires at least one shore-space gull observation.
- ANIMAL_COSMETIC_DUPLICATE: The id and sorted individual+behavior requirements must not duplicate an existing commission.

## 合法生成示例

例子由同一schema、已有个体事实、引入居民与去重条件生成。它只是结构示例，不是一次模型响应。

```json
{
  "schema": 1,
  "id": "animals:schema-example-1",
  "revision": 1,
  "resident": "mara",
  "theme": "compare-routines",
  "observations": [
    {
      "animal": "harbor-cat-1",
      "behavior": "sun-rest",
      "period": "morning",
      "scene": "station"
    },
    {
      "animal": "harbor-cat-2",
      "behavior": "sun-rest",
      "period": "morning",
      "scene": "courtyard"
    }
  ]
}
```

## 独立审核字段

- $: exactly format, passed, findings; all required; extra keys forbidden
- $.format: exactly "harbor-animal-review-v2"
- $.passed: boolean
- $.findings: 0..8 elements (inclusive)
- $.findings[]: exactly observationId, factId, ruleId; all required; extra keys forbidden
- $.findings[].observationId: 5..5 UTF-16 code units; or null; pattern=^obs-[1-4]$
- $.findings[].factId: 69..69 UTF-16 code units; or null; pattern=^fact:[a-f0-9]{64}$
- $.findings[].ruleId: 19..28 UTF-16 code units; enum=["ANIMAL_GROUNDED_FIELDS","ANIMAL_OBSERVATION_FIELDS","ANIMAL_OBSERVATION_COUNT","ANIMAL_KNOWN_ANIMAL","ANIMAL_SCHEDULE_MISMATCH","ANIMAL_DUPLICATE_REQUIREMENT","ANIMAL_UNKNOWN_RESIDENT","ANIMAL_THEME_MISMATCH","ANIMAL_COSMETIC_DUPLICATE"]
- passed=true requires findings=[]; passed=false requires at least one actual problem
- observationId and factId must both be null for a story-level issue, otherwise both must match one exact packet observation
- Every finding must match a deterministic issue; cite all distinct issues; no free-text reasons, positive commentary or overrides

合法通过格式：

```json
{"format":"harbor-animal-review-v2","passed":true,"findings":[]}
```

拒绝finding必须精确三字段`observationId/factId/ruleId`，从该候选的引用与有限规则中选择；顶层问题双null。代码匹配每个引用和实际违规，再生成双语理由。自由理由、正向finding、错误引用、漏报、对正确事实误报都不转成通过。原V1仅作历史回归；M2原599字符finding保持拒绝，不转换或截短。

## 引用与准入边界

observationId是本候选的位置编号；factId固定四个声明字段和完整登记日程hash，原候选整体另有rawCandidateHash。非法statement不会因计算引用被修剪，生成仍在原对象上拒绝。审核看待查事实/schema/引用，但看不到服务端判定；返回后由每次调用自己的私有packet复核，没有跨提案可变闭包。

合法候选及可信通过才能进入原artifact/CAS流程，采用不加现金/物品/关系；观察和分享必须走原姿态/邻近证明、固定知识页和+1关系、原子幂等结算。factId是内容引用，不是观察完成proof。

本轮109项免费回归、2557种合法组合与完整本地命令流程仅证明工程合同，不能作为模型准确率、MiniApp/实体手机或新玩家理解验收。新合同未调用真实模型；下一轮须新批准、新账本，最多2次，不借旧额度。
