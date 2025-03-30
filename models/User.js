export default class User {
  constructor(
    id,
    name,
    email,
    encryptedMasterKey,
    password,
    passwordHint,
    createdAt,
    decryptedMasterKey
  ) {
    this.id = id;
    this.name = name;
    this.email = email;
    this.encryptedMasterKey = encryptedMasterKey;
    this.password = password;
    this.passwordHint = passwordHint;
    this.createdAt = createdAt;
    this.decryptedMasterKey = decryptedMasterKey;
  }
}
