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
import AsyncStorage from "@react-native-async-storage/async-storage"
import { useFocusEffect } from "@react-navigation/native"
import { Ionicons } from "@expo/vector-icons"

const SettingsScreen: React.FC = () => {
  const router = useRouter()
  const { localUser } = useAuth()

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [modalMessage, setModalMessage] = useState("")
  const [modalType, setModalType] = useState<"error" | "info" | "success">("info")
  const [extrasVisible, setExtrasVisible] = useState(false)
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false)
  const [confirmText, setConfirmText] = useState("")
  const [requirePasswordToView, setRequirePasswordToView] = useState(false)
  const [savePasswordsToCloud, setSavePasswordsToCloud] = useState(true)

  const firebaseUser = auth.currentUser

  useEffect(() => {
    if (firebaseUser) {
      setName(localUser?.name || firebaseUser.displayName || "Usuário")
      setEmail(firebaseUser.email || "")
    } else if (localUser) {
      setName(localUser.name)
      setEmail(localUser.email)
    }
  }, [localUser, firebaseUser])

  useEffect(() => {
    const loadSettings = async () => {
      const viewValue = await AsyncStorage.getItem("requirePasswordToView")
      if (viewValue !== null) {
        setRequirePasswordToView(viewValue === "true")
      }

      const cloudValue = await AsyncStorage.getItem("savePasswordsToCloud")
      if (cloudValue !== null) {
        setSavePasswordsToCloud(cloudValue === "true")
      }
    }
    loadSettings()
  }, [])

  useFocusEffect(
    React.useCallback(() => {
      setCurrentPassword("")
    }, [])
  )

  const toggleRequirePasswordToView = async () => {
    if (!firebaseUser || !currentPassword) {
      showModal("Digite sua senha atual para continuar.", "error")
      return
    }

    try {
      const credential = EmailAuthProvider.credential(firebaseUser.email!, currentPassword)
      await reauthenticateWithCredential(firebaseUser, credential)
    } catch {
      showModal("Senha atual incorreta.", "error")
      return
    }

    const newValue = !requirePasswordToView
    setRequirePasswordToView(newValue)
    await AsyncStorage.setItem("requirePasswordToView", newValue.toString())
    showModal(
      newValue ? "🔐 Proteção para visualizar senhas ativada!" : "🔓 Proteção para visualizar senhas desativada.",
      "success"
    )
  }

  const toggleSavePasswordsToCloud = async () => {
    const newValue = !savePasswordsToCloud
    setSavePasswordsToCloud(newValue)
    await AsyncStorage.setItem("savePasswordsToCloud", newValue.toString())
    showModal(
      newValue
        ? "☁️ Salvamento automático na nuvem ativado."
        : "☁️ Salvamento automático na nuvem desativado.",
      "success"
    )
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
      const credential = EmailAuthProvider.credential(firebaseUser.email!, currentPassword)
      await reauthenticateWithCredential(firebaseUser, credential)

      await deleteUser(firebaseUser)
      await deleteDatabase()

      showModal("✅ Conta e dados excluídos com sucesso!", "success")
      await signOut(auth)
      router.replace("/")
    } catch (error) {
      showModal("❌ Não foi possível excluir a conta.", "error")
    }
  }

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
    }
    setIsGenerating(false)
  }

  const handleUpdateProfile = async () => {
    if (!firebaseUser || !localUser) {
      showModal("Você precisa estar logado para editar os dados.", "info")
      return
    }

    try {
      const credential = EmailAuthProvider.credential(firebaseUser.email!, currentPassword)
      await reauthenticateWithCredential(firebaseUser, credential)
    } catch (error) {
      showModal("Senha atual incorreta.", "error")
      return
    }

    try {
      if (email !== firebaseUser.email) {
        await updateEmail(firebaseUser, email)
      }

      if (newPassword) {
        await updatePassword(firebaseUser, newPassword)

        const decryptedMasterKey = decryptWithPassword(localUser.encryptedMasterKey, currentPassword)
        if (!decryptedMasterKey) {
          showModal("Erro ao descriptografar a chave mestra.", "error")
          return
        }

        const newEncryptedMasterKey = encryptWithPassword(decryptedMasterKey, newPassword)
        const newHashedPassword = await hashPassword(newPassword)

        await updateUserEncryptedData(localUser.email, newHashedPassword, newEncryptedMasterKey)
      }

      await updateUserName(email, name)

      showModal("✅ Dados atualizados com sucesso!", "success")
    } catch (error) {
      showModal("❌ Não foi possível atualizar os dados.", "error")
    }
  }

  const renderPasswordInput = (label: string, value: string, onChange: (v: string) => void, show: boolean, toggle: () => void, placeholder: string) => (
    <View style={{ width: "100%", marginBottom: 10 }}>
      <Text style={styles.label}>{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          value={value}
          onChangeText={onChange}
          secureTextEntry={!show}
          placeholder={placeholder}
        />
        <TouchableOpacity onPress={toggle} style={{ marginLeft: 8 }}>
          <Ionicons name={show ? "eye-off" : "eye"} size={24} color={colors.darkGray} />
        </TouchableOpacity>
      </View>
    </View>
  )

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

      {renderPasswordInput("Senha Atual", currentPassword, setCurrentPassword, showCurrentPassword, () => setShowCurrentPassword(!showCurrentPassword), "Senha Atual")}

      {renderPasswordInput("Nova Senha", newPassword, setNewPassword, showNewPassword, () => setShowNewPassword(!showNewPassword), "Nova Senha")}

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
        <Text style={styles.buttonTextSaveChanges}>💾 Salvar Alterações</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: colors.blue }]}
        onPress={() => setExtrasVisible(true)}
      >
        <Text style={styles.buttonText}>⚙️ Configurações Extras</Text>
      </TouchableOpacity>

<Modal visible={extrasVisible} animationType="slide" transparent>
  <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.5)" }}>
    <View style={{ backgroundColor: "white", padding: 20, borderRadius: 10, width: "85%" }}>

      {/* Proteção de Visualização */}
      <Text style={[styles.label, { marginTop: 10 }]}>
        🔒 Proteção de Visualização: {requirePasswordToView ? "Ativada" : "Desativada"}
      </Text>
      <TouchableOpacity
        style={[styles.button, { backgroundColor: colors.yellow }]}
        onPress={toggleRequirePasswordToView}
      >
        <Text style={styles.buttonText}>
          {requirePasswordToView ? "Desativar" : "Ativar"} Proteção de Visualização
        </Text>
      </TouchableOpacity>

      {/* Salvamento na Nuvem */}
      <Text style={[styles.label, { marginTop: 10 }]}>
        ☁️ Salvamento na Nuvem: {savePasswordsToCloud ? "Ativado" : "Desativado"}
      </Text>
      <TouchableOpacity
        style={[styles.button, { backgroundColor: colors.yellow }]}
        onPress={toggleSavePasswordsToCloud}
      >
        <Text style={styles.buttonText}>
          {savePasswordsToCloud ? "Desativar" : "Ativar"} Salvamento na Nuvem
        </Text>
      </TouchableOpacity>

      {/* Excluir conta */}
      <TouchableOpacity
        style={[styles.button, { backgroundColor: "#D32F2F", marginTop: 20 }]}
        onPress={confirmDeleteAccount}
      >
        <Text style={styles.buttonText}>🗑 Excluir Conta e Dados</Text>
      </TouchableOpacity>

      {/* Fechar */}
      <TouchableOpacity
        style={[styles.button, { backgroundColor: colors.mediumGray, marginTop: 10 }]}
        onPress={() => setExtrasVisible(false)}
      >
        <Text style={styles.buttonText}>✖️ Fechar</Text>
      </TouchableOpacity>

    </View>
  </View>
</Modal>


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
    color: colors.white,
  },
  buttonTextSaveChanges: {
    fontSize: 16,
    fontWeight: "bold",
    color: colors.darkGray,
  },
})

export default SettingsScreen
