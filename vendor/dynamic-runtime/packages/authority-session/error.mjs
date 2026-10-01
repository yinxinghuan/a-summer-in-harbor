export class AuthorityError extends Error {
  constructor(code,status=400){super(code);this.code=code;this.status=status;}
}
