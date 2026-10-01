// The source remains byte-identical to the sealed Sep24 compiler.
// resolve/applyForTest/witness are offline oracles, never a second client authority.
export {
  COMPILER_VERSION, canonical, sha256, validate, compile, domainPatch,
  initialState, meets, meetsExpression, resolve, applyForTest, witness, wireEffect,
} from './src/compile.mjs';
