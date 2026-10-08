# Walking-only compatibility option — pending rule decision

The current published f01009e keeps the formal active-world rule: one game minute per four active foreground seconds, including standing. Panels, conversations, background/offline and challenges pause it. Movement itself does not add a second time charge. This P0 candidate changes transport scheduling only.

The earlier formal checkpoint 7019629 is identified by doc/active-play-owner-checkpoint-20261007.md as the release before formal active-time activation. The first-parent bf7993c candidate kept movement and active time behind localhost query gates; 6bcf74e enabled both formally. The earlier 0e9aea9 movement-only producer was delivered CLOSED and does not prove a public walking-only release. The exact release the user remembers is still unconfirmed; none of these should be presented as that release without its receipt.

If transport correction does not restore the desired experience, a narrow walking-only option can retain current art, menu, roads, cats/gulls/dog/crab, B2 and all existing saves. Do not revert the complete release or restore a database dump. Do not simply turn activePlayEnabled off: saves already containing activePlayClock suppress the separate movement-time path and would stop advancing time.

A compatible implementation needs a versioned authoritative policy that credits active time only from the distance actually admitted by the unchanged swept movement validator, at the existing 112 world units/second and four-second minute. Existing confirmed minutes and partial remainder are preserved, never rolled backward. Empty standing heartbeat contributes zero. Authored actions/rest/travel keep their current explicit atomic costs, replay and failure behavior. Offline time contributes zero. Migration must preserve optional confirmation/lease fields and avoid silently rewriting original players.

This is a gameplay rule change requiring a concrete user decision. At the unchanged rate, 448 units of walking advance one game minute. Standing no longer advances plant growth, schedules, orders, fatigue or recovery; longer periods of idle observation would leave the world clock fixed. Existing explicit costs still advance those same systems. A player can stand to pause an order deadline, so this behavior must be intentionally accepted, not disguised as a performance fix.

No walking-only code or standing-time change has been applied or published. The current plan is to verify the minimal transport fix first.
