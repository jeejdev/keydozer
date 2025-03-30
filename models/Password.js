export default class PasswordEntry {
    constructor(
      id,
      userId,             // Referência ao usuário dono da senha
      encryptedPassword,  // A senha criptografada com AES + masterKey
      serviceName,        // Nome do serviço (ex: "Facebook")
      username,           // Nome de usuário usado no serviço (pode ser email, nick, etc)
      url,                // URL opcional (ex: https://facebook.com)
      category,           // Categoria (ex: "Redes Sociais", "Banco", etc)
      notes,              // Notas adicionais, criptografadas também
      createdAt,          // Timestamp de criação
      updatedAt           // Timestamp de modificação
    ) {
      this.id = id;
      this.userId = userId;
      this.encryptedPassword = encryptedPassword;
      this.serviceName = serviceName;
      this.username = username;
      this.url = url;
      this.category = category;
      this.notes = notes;
      this.createdAt = createdAt;
      this.updatedAt = updatedAt;
    }
  }
  