import React, { useState } from "react"
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native"
import { useRouter } from "expo-router"
import { createUserWithEmailAndPassword } from "../../services/firebaseConfig"
import { addUser, checkUserExistsByEmail } from "../../services/database"
import {
  hashPassword,
  generateRandomMasterKey,
  encryptWithPassword,
} from "../../utils/encryption"
import { colors } from "../../utils/theme"
import {
  checkPasswordStrength,
  generateStrongPassword,
  copyToClipboard,
} from "../../utils/passwordUtils"
import ErrorModal from "../../components/ErrorModal"
import { auth } from "../../services/firebaseConfig"

const RegisterScreen: React.FC = () => {
  const router = useRouter()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordHint, setPasswordHint] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [modalMessage, setModalMessage] = useState("")
  const [modalType, setModalType] = useState<"error" | "success" | "info">("info")

  const { isValid, requirements } = checkPasswordStrength(password)

  const showModal = (message: string, type: "error" | "success" | "info") => {
    setModalMessage(message)
    setModalType(type)
    setModalVisible(true)
  }

  const handleGeneratePassword = async () => {
    setIsGenerating(true)
    try {
      const newPassword = generateStrongPassword(16)
      setPassword(newPassword)
      setConfirmPassword(newPassword)
      await copyToClipboard(newPassword)
      showModal("Senha gerada e copiada para a área de transferência!", "success")
    } catch (error) {
      console.error("Erro ao gerar senha:", error)
      showModal("Erro ao gerar senha. Tente novamente.", "error")
    }
    setIsGenerating(false)
  }

  const handleRegister = async () => {
    if (!name || !email || !password || !confirmPassword) {
      showModal("Todos os campos obrigatórios devem ser preenchidos!", "error")
      return
    }

    if (password !== confirmPassword) {
      showModal("As senhas não coincidem!", "error")
      return
    }

    if (!isValid) {
      showModal("Sua senha não atende aos requisitos de segurança.", "error")
      return
    }

    try {
      const userExists = await checkUserExistsByEmail(email)
      if (userExists) throw new Error("EMAIL_ALREADY_EXISTS")
    
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      const firebaseUser = userCredential.user
    
      // Gera e criptografa masterKey
      const masterKey = await generateRandomMasterKey()
      const encryptedMasterKey = encryptWithPassword(masterKey, password)
    
      const hashedPassword = await hashPassword(password)
    
      // Tenta salvar localmente
      await addUser(
        name,
        email,
        hashedPassword,
        encryptedMasterKey,
        passwordHint || null
      )
    
      showModal("Conta criada com sucesso!", "success")

      if (encryptedMasterKey === "[ENCRYPTION_FAILED]") {
        throw new Error("FALHA_CRIPTO")
      }

      setTimeout(() => {
        setModalVisible(false)
        router.push({ pathname: "/", params: { email, password } })
      }, 2000)
    } catch (error: any) {
      console.error("❌ Erro ao criar conta:", error)
    
      // ⚠️ Se já tiver criado o usuário no Firebase, remove
      const currentUser = auth.currentUser
      if (currentUser) {
        try {
          await currentUser.delete()
          console.log("🧹 Usuário removido do Firebase após falha local.")
        } catch (deleteErr) {
          console.error("⚠️ Erro ao remover usuário do Firebase:", deleteErr)
        }
      }
    
      let errorMessage = "Falha ao criar conta."
      if (error.code === "auth/email-already-in-use") {
        errorMessage = "Este e-mail já está em uso."
      } else if (error.message === "EMAIL_ALREADY_EXISTS") {
        errorMessage = "Este e-mail já está cadastrado localmente."
      }
    
      showModal(errorMessage, "error")
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Criar Conta</Text>

      <TextInput style={styles.input} placeholder="Nome" value={name} onChangeText={setName} />
      <TextInput
        style={styles.input}
        placeholder="E-mail"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Senha"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <View style={styles.passwordStrengthContainer}>
        {requirements.map((req, index) => (
          <Text
            key={index}
            style={[styles.passwordRequirement, req.met && styles.passwordRequirementMet]}
          >
            {req.met ? "✅" : "❌"} {req.label}
          </Text>
        ))}
      </View>

      <TouchableOpacity
        style={styles.generateButton}
        onPress={handleGeneratePassword}
        disabled={isGenerating}
      >
        {isGenerating ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.generateButtonText}>🔒 Gerar Senha Segura</Text>
        )}
      </TouchableOpacity>

      <TextInput
        style={styles.input}
        placeholder="Confirmar Senha"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
      />
      <TextInput
        style={styles.input}
        placeholder="Dica de Senha (Opcional)"
        value={passwordHint}
        onChangeText={setPasswordHint}
      />

      <TouchableOpacity style={styles.button} onPress={handleRegister}>
        <Text style={styles.buttonText}>Criar Conta</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push({ pathname: "/" })}>
        <Text style={styles.link}>Já tem uma conta? Faça login</Text>
      </TouchableOpacity>

      <ErrorModal
        visible={modalVisible}
        message={modalMessage}
        type={modalType}
        onClose={() => setModalVisible(false)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: colors.lightGray,
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    color: colors.darkGray,
    marginBottom: 20,
  },
  input: {
    width: "90%",
    padding: 12,
    borderWidth: 1,
    borderColor: colors.mediumGray,
    borderRadius: 8,
    marginBottom: 10,
    backgroundColor: "#fff",
  },
  button: {
    backgroundColor: colors.yellow,
    padding: 12,
    borderRadius: 8,
    width: "90%",
    alignItems: "center",
    marginVertical: 10,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: colors.darkGray,
  },
  link: {
    color: colors.mediumGray,
    marginTop: 10,
  },
  generateButton: {
    backgroundColor: colors.darkGray,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginVertical: 10,
    flexDirection: "row",
    justifyContent: "center",
    width: "90%",
  },
  generateButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  passwordStrengthContainer: {
    alignSelf: "flex-start",
    paddingLeft: 20,
    marginBottom: 10,
  },
  passwordRequirement: {
    fontSize: 14,
    color: colors.mediumGray,
  },
  passwordRequirementMet: {
    color: colors.green,
  },
})

export default RegisterScreen
