export default class User {
  constructor(
    id,
    name,
    email,
    encryptedMasterKey,
    password,
    passwordHint,
    createdAt,
    decryptedMasterKey,
    firebaseUid
  ) {
    this.id = id
    this.name = name
    this.email = email
    this.encryptedMasterKey = encryptedMasterKey
    this.password = password
    this.passwordHint = passwordHint
    this.createdAt = createdAt
    this.decryptedMasterKey = decryptedMasterKey
    this.firebaseUid = firebaseUid
  }

  static fromRow(row) {
    return new User(
      row.id,
      row.name,
      row.email,
      row.encrypted_master_key,
      row.password,
      row.password_hint,
      row.created_at,
      null,
      row.firebase_uid || null
    )
  }
}
