import * as Clipboard from "expo-clipboard"

export const generateStrongPassword = (length = 16) => {
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
  const lower = "abcdefghijklmnopqrstuvwxyz"
  const numbers = "0123456789"
  const special = "!@#$%^&*()_+[]{}|;:,.<>?"
  const allChars = upper + lower + numbers + special

  let password = ""

  // Garantir que tenha pelo menos um de cada requisito
  password += upper[Math.floor(Math.random() * upper.length)]
  password += lower[Math.floor(Math.random() * lower.length)]
  password += numbers[Math.floor(Math.random() * numbers.length)]
  password += special[Math.floor(Math.random() * special.length)]

  // Preencher o restante da senha aleatoriamente
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)]
  }

  // Embaralhar a senha para evitar padrão previsível
  password = password
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("")

  return password
}

export const copyToClipboard = async (text: string) => {
  await Clipboard.setStringAsync(text)
}

export const checkPasswordStrength = (password: string) => {
  const minLength = password.length >= 12
  const hasUpperCase = /[A-Z]/.test(password)
  const hasLowerCase = /[a-z]/.test(password)
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password)

  return {
    isValid: minLength && hasUpperCase && hasLowerCase && hasSpecialChar,
    requirements: [
      { label: "Pelo menos 12 caracteres", met: minLength },
      { label: "Letra maiúscula", met: hasUpperCase },
      { label: "Letra minúscula", met: hasLowerCase },
      { label: "Caractere especial", met: hasSpecialChar },
    ],
  }
}
