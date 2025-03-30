import React, { useEffect, useState } from "react"
import {
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  View,
  Modal,
} from "react-native"
import { useRouter } from "expo-router"
import {
  auth,
  signOut,
  updateEmail,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  deleteUser,
} from "../../services/firebaseConfig"
import {
  deleteDatabase,
  updateUserName,
  getUserByEmail,
  updateUserEncryptedData
} from "../../services/database"
import { colors } from "../../utils/theme"
import {
  generateStrongPassword,
  copyToClipboard,
} from "../../utils/passwordUtils"
import ErrorModal from "../../components/ErrorModal"
import { useAuth } from "../../context/AuthContext"
import { decryptWithPassword, encryptWithPassword, hashPassword } from "../../utils/encryption"

const SettingsScreen: React.FC = () => {
  const router = useRouter()
  const { localUser } = useAuth()

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)

  const [modalVisible, setModalVisible] = useState(false)
  const [modalMessage, setModalMessage] = useState("")
  const [modalType, setModalType] = useState<"error" | "info" | "success">("info")

  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false)
  const [confirmText, setConfirmText] = useState("")

  const firebaseUser = auth.currentUser

  useEffect(() => {
    const fetchUserData = () => {
      if (firebaseUser) {
        setName(localUser?.name || firebaseUser.displayName || "Usuário")
        setEmail(firebaseUser.email || "")
      } else if (localUser) {
        setName(localUser.name)
        setEmail(localUser.email)
      }
    }

    fetchUserData()
  }, [localUser, firebaseUser])

  const showModal = (message: string, type: "error" | "info" | "success") => {
    setModalMessage(message)
    setModalType(type)
    setModalVisible(true)
  }

  const handleGeneratePassword = async () => {
    setIsGenerating(true)
    try {
      const newPass = generateStrongPassword(16)
      setNewPassword(newPass)
      await copyToClipboard(newPass)
      showModal("🔐 Senha gerada e copiada para a área de transferência.", "success")
    } catch (error) {
      showModal("Erro ao gerar senha. Tente novamente.", "error")
      console.error("Erro ao gerar senha:", error)
    }
    setIsGenerating(false)
  }

  const reauthenticateUser = async (): Promise<boolean> => {
    if (!firebaseUser || !currentPassword) {
      showModal("Digite sua senha atual para continuar.", "error")
      return false
    }

    try {
      const credential = EmailAuthProvider.credential(firebaseUser.email as string, currentPassword)
      await reauthenticateWithCredential(firebaseUser, credential)
      return true
    } catch (error) {
      showModal("Senha atual incorreta.", "error")
      console.error("Erro ao reautenticar:", error)
      return false
    }
  }

  const handleUpdateProfile = async () => {
    if (!firebaseUser || !localUser) {
      showModal("Você precisa estar logado para editar os dados.", "info")
      return
    }
  
    const isAuthenticated = await reauthenticateUser()
    if (!isAuthenticated) return
  
    try {
      if (email !== firebaseUser.email) {
        await updateEmail(firebaseUser, email)
      }
  
      let newEncryptedMasterKey = null
      let newHashedPassword = null
  
      if (newPassword) {
        await updatePassword(firebaseUser, newPassword)
  
        // 🔓 Descriptografa masterKey com senha atual
        const decryptedMasterKey = decryptWithPassword(localUser.encryptedMasterKey, currentPassword)
  
        if (!decryptedMasterKey) {
          showModal("Erro ao descriptografar a chave mestra. Verifique sua senha atual.", "error")
          return
        }
  
        // 🔐 Recriptografa com a nova senha
        newEncryptedMasterKey = encryptWithPassword(decryptedMasterKey, newPassword)
        newHashedPassword = await hashPassword(newPassword)
  
        // 🔄 Atualiza no banco
        await updateUserEncryptedData(localUser.email, newHashedPassword, newEncryptedMasterKey)
      }
  
      await updateUserName(email, name)
  
      showModal("✅ Dados atualizados com sucesso!", "success")
    } catch (error) {
      showModal("❌ Não foi possível atualizar os dados.", "error")
      console.error("Erro ao atualizar perfil:", error)
    }
  }
  

  const confirmDeleteAccount = () => {
    if (!currentPassword) {
      showModal("Digite sua senha atual antes de excluir a conta.", "error")
      return
    }
    setConfirmText("")
    setConfirmDeleteVisible(true)
  }

  const handleDeleteAccount = async () => {
    if (confirmText.trim().toLowerCase() !== "eu confirmo") return

    try {
      if (!firebaseUser) return
      const isAuthenticated = await reauthenticateUser()
      if (!isAuthenticated) return

      await deleteUser(firebaseUser)
      await deleteDatabase()

      showModal("✅ Conta e dados excluídos com sucesso!", "success")
      await signOut(auth)
      router.replace("/")
    } catch (error) {
      console.error("Erro ao excluir conta e dados:", error)
      showModal(
        "❌ Não foi possível excluir a conta e os dados. Verifique sua conexão e tente novamente mais tarde.",
        "error"
      )
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Configurações</Text>

      <Text style={styles.label}>Nome</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Nome" />

      <Text style={styles.label}>E-mail</Text>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        placeholder="E-mail"
      />

      <Text style={styles.label}>Senha Atual</Text>
      <TextInput
        style={styles.input}
        value={currentPassword}
        onChangeText={setCurrentPassword}
        secureTextEntry
        placeholder="Senha Atual"
      />

      <Text style={styles.label}>Nova Senha</Text>
      <TextInput
        style={styles.input}
        value={newPassword}
        onChangeText={setNewPassword}
        secureTextEntry
        placeholder="Nova Senha"
      />

      <TouchableOpacity
        style={styles.generateButton}
        onPress={handleGeneratePassword}
        disabled={isGenerating}
      >
        {isGenerating ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.generateButtonText}>🔐 Gerar Senha Segura</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={handleUpdateProfile}>
        <Text style={styles.buttonText}>Salvar Alterações</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.button, styles.deleteButton]} onPress={confirmDeleteAccount}>
        <Text style={[styles.buttonText, styles.deleteButtonText]}>Excluir Conta e Dados</Text>
      </TouchableOpacity>

      {/* Modal confirmação de exclusão */}
      <Modal
        visible={confirmDeleteVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setConfirmDeleteVisible(false)}
      >
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.5)" }}>
          <View style={{ backgroundColor: "white", padding: 20, borderRadius: 10, width: "85%" }}>
            <Text style={{ fontSize: 16, fontWeight: "bold", marginBottom: 10 }}>
              ⚠️ Essa ação é irreversível!
            </Text>
            <Text style={{ marginBottom: 10 }}>
              Se você realmente deseja excluir sua conta e todos os dados locais, digite abaixo:
            </Text>
            <Text style={{ fontWeight: "bold", marginBottom: 10 }}>
              "Eu confirmo"
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Digite aqui..."
              value={confirmText}
              onChangeText={setConfirmText}
            />

            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 10 }}>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: "#ccc", flex: 1, marginRight: 5 }]}
                onPress={() => setConfirmDeleteVisible(false)}
              >
                <Text style={{ fontWeight: "bold" }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: "#D32F2F", flex: 1, marginLeft: 5 }]}
                onPress={handleDeleteAccount}
                disabled={confirmText.trim().toLowerCase() !== "eu confirmo"}
              >
                <Text style={{ color: "#fff", fontWeight: "bold" }}>SIM</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <ErrorModal
        visible={modalVisible}
        message={modalMessage}
        type={modalType}
        onClose={() => setModalVisible(false)}
      />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
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
  label: {
    alignSelf: "flex-start",
    fontSize: 14,
    color: colors.darkGray,
    marginTop: 10,
  },
  input: {
    width: "100%",
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: "#fff",
    borderColor: colors.mediumGray,
    marginBottom: 10,
  },
  button: {
    backgroundColor: colors.yellow,
    padding: 12,
    borderRadius: 8,
    width: "100%",
    alignItems: "center",
    marginVertical: 10,
  },
  deleteButton: {
    backgroundColor: "#D32F2F",
  },
  deleteButtonText: {
    color: "#fff",
  },
  generateButton: {
    backgroundColor: colors.blue,
    padding: 12,
    borderRadius: 8,
    width: "100%",
    alignItems: "center",
    marginVertical: 10,
  },
  generateButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "bold",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: colors.darkGray,
  },
})

export default SettingsScreen
