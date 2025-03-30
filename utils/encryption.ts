import { getRandomBytesAsync, digestStringAsync, CryptoDigestAlgorithm } from "expo-crypto"
import CryptoJS from "react-native-crypto-js"

// 🔐 Gera uma chave mestra aleatória de 256 bits (32 bytes)
export const generateRandomMasterKey = async (): Promise<string> => {
  console.log("🔄 Gerando masterKey aleatória...")
  try {
    const bytes = await getRandomBytesAsync(32)
    const key = Array.from(bytes)
      .map((b) => ("0" + b.toString(16)).slice(-2))
      .join("")
    console.log("✅ MasterKey gerada:", key)
    return key
  } catch (error) {
    console.error("❌ Erro ao gerar masterKey:", error)
    throw error
  }
}

// Criptografa a masterKey com a senha do usuário
export const encryptWithPassword = (data: string, password: string): string => {
  console.log("🔐 Criptografando com react-native-crypto-js...")
  try {
    const encrypted = CryptoJS.AES.encrypt(data, password).toString()
    console.log("✅ Encriptado:", encrypted)
    return encrypted
  } catch (error) {
    console.error("❌ Erro ao criptografar:", error)
    return "[ENCRYPTION_FAILED]"
  }
}

// 🔐 Descriptografa a masterKey usando a senha do usuário
export const decryptWithPassword = (encryptedData: string, password: string): string => {
  console.log("🔓 Tentando descriptografar...")
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedData, password)
    const decrypted = bytes.toString(CryptoJS.enc.Utf8)
    console.log("✅ Descriptografado:", decrypted)
    return decrypted
  } catch (error) {
    console.error("❌ Erro ao descriptografar:", error)
    return ""
  }
}

// 🔐 Criptografa dados sensíveis com a masterKey
export const encryptData = (data: string, masterKey: string): string => {
  console.log("🔐 Criptografando dado com masterKey...")
  try {
    const result = CryptoJS.AES.encrypt(data, masterKey).toString()
    console.log("✅ Dado criptografado:", result)
    return result
  } catch (error) {
    console.error("❌ Erro ao criptografar dados:", error)
    return ""
  }
}

// 🔐 Descriptografa com a masterKey
export const decryptData = (encryptedData: string, masterKey: string): string => {
  console.log("🔓 Tentando descriptografar dado com masterKey...")
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedData, masterKey)
    const result = bytes.toString(CryptoJS.enc.Utf8)
    console.log("✅ Dado descriptografado:", result)
    return result
  } catch (error) {
    console.error("❌ Erro ao descriptografar com masterKey:", error)
    return ""
  }
}

// 🔐 Gera hash da senha do usuário
export const hashPassword = async (password: string): Promise<string> => {
  console.log("🔁 Gerando hash da senha do usuário...")
  try {
    const hash = await digestStringAsync(CryptoDigestAlgorithm.SHA256, password)
    console.log("✅ Hash gerado:", hash)
    return hash
  } catch (error) {
    console.error("❌ Erro ao gerar hash da senha:", error)
    throw error
  }
}
