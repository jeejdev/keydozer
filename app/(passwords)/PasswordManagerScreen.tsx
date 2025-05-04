import React, { useState } from "react"
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  ToastAndroid
} from "react-native"
import { useFocusEffect, useNavigation } from "@react-navigation/native"
import { useAuth } from "../../context/AuthContext"
import {
  addPassword,
  deletePasswordById,
  getPasswordsByUserId,
  updatePasswordById,
} from "../../services/database"
import { decryptData, encryptData } from "../../utils/encryption"
import { copyToClipboard, checkPasswordStrength } from "../../utils/passwordUtils"
import { colors } from "../../utils/theme"
import ErrorModal from "../../components/ErrorModal"
import { auth, EmailAuthProvider, reauthenticateWithCredential } from "@/services/firebaseConfig"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { Ionicons } from '@expo/vector-icons'
import QRCode from 'react-native-qrcode-svg'

const PasswordManagerScreen = () => {
  const navigation = useNavigation()
  const { localUser } = useAuth()
  const [groupedPasswords, setGroupedPasswords] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalVisible, setModalVisible] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [serviceName, setServiceName] = useState("")
  const [password, setPassword] = useState("")
  const [username, setUsername] = useState("")
  const [additionalInfo, setAdditionalInfo] = useState("")
  const [category, setCategory] = useState("")
  const [modalMessage, setModalMessage] = useState("")
  const [modalType, setModalType] = useState("info")
  const [errorVisible, setErrorVisible] = useState(false)
  const [canViewPasswords, setCanViewPasswords] = useState(false)
  const [passwordPromptVisible, setPasswordPromptVisible] = useState(false)
  const [passwordInput, setPasswordInput] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [qrData, setQrData] = useState<string | null>(null)
  const [qrModalVisible, setQrModalVisible] = useState(false)
  const [weakPasswordInfo, setWeakPasswordInfo] = useState<{service: string, reasons: string[]} | null>(null)

  const showModal = (message: string, type: string = "info") => {
    setModalMessage(message)
    setModalType(type)
    setErrorVisible(true)
  }

  const resetForm = () => {
    setSelectedId(null)
    setServiceName("")
    setPassword("")
    setUsername("")
    setAdditionalInfo("")
    setCategory("")
  }

  const reauthenticateUser = async (inputPassword: string): Promise<boolean> => {
    const user = auth.currentUser
    if (!user) return false

    try {
      const credential = EmailAuthProvider.credential(user.email!, inputPassword)
      await reauthenticateWithCredential(user, credential)
      return true
    } catch (error) {
      showModal("Senha incorreta. Tente novamente.", "error")
      setPasswordPromptVisible(true)
      return false
    }
  }

  const loadPasswords = async () => {
    if (!localUser) return
    setLoading(true)

    try {
      const passwords = await getPasswordsByUserId(localUser.id)
      const grouped: Record<string, any[]> = {}

      for (const entry of passwords) {
        const decryptedPassword = decryptData(entry.encryptedPassword, localUser.decryptedMasterKey || "")
        const category = entry.category?.trim() || "Outros"
        if (!grouped[category]) grouped[category] = []

        const decryptedadditionalInfo = decryptData(entry.additionalInfo || "", localUser.decryptedMasterKey || "")
        grouped[category].push({
          ...entry,
          decryptedPassword,
          decryptedadditionalInfo,
        })
      }

      const sections = Object.entries(grouped).map(([title, data]) => ({ title, data }))
      setGroupedPasswords(sections)
    } catch (error) {
      console.error("Erro ao carregar senhas:", error)
      showModal("Erro ao carregar senhas.", "error")
    }

    setLoading(false)
  }

  useFocusEffect(
    React.useCallback(() => {
      const checkProtectionAndLoad = async () => {
        setCanViewPasswords(false)
        const setting = await AsyncStorage.getItem("requirePasswordToView")
        const require = setting === "true"

        if (require) {
          setPasswordPromptVisible(true)
        } else {
          setCanViewPasswords(true)
          loadPasswords()
        }
      }

      checkProtectionAndLoad()
    }, [])
  )

  const confirmPasswordView = async () => {
    const success = await reauthenticateUser(passwordInput)
    if (success) {
      setPasswordPromptVisible(false)
      setCanViewPasswords(true)
      loadPasswords()
    }
    setPasswordInput("")
  }

  const handleCancelPasswordPrompt = () => {
    setPasswordPromptVisible(false)
    navigation.goBack()
  }

  const handleSave = async () => {
    if (!serviceName || !password || !localUser) {
      showModal("Preencha todos os campos obrigatórios.", "error")
      return
    }
    try {
      const encryptedPassword = encryptData(password, localUser.decryptedMasterKey || "")
      const encryptedadditionalInfo = encryptData(additionalInfo || "", localUser.decryptedMasterKey || "")

      if (isEditing && selectedId !== null) {
        await updatePasswordById(
          selectedId,
          encryptedPassword,
          serviceName,
          username,
          category,
          encryptedadditionalInfo
        )
      } else {
        await addPassword(
          localUser.id,
          encryptedPassword,
          serviceName,
          username,
          category,
          encryptedadditionalInfo
        )
      }

      showModal("Senha salva com sucesso!", "success")
      setModalVisible(false)
      resetForm()
      loadPasswords()
    } catch (e) {
      console.error("Erro ao salvar:", e)
      showModal("Erro ao salvar senha.", "error")
    }
  }

  const handleDelete = async (id: number) => {
    Alert.alert("Confirmar exclusão", "Tem certeza que deseja excluir esta senha?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: async () => {
          await deletePasswordById(id)
          setModalVisible(false)
          resetForm()
          loadPasswords()
          showModal("Senha excluída com sucesso!", "success")
        },
      },
    ])
  }

  const generateQRData = (item: any) => {
    const payload = JSON.stringify({
      serviceName: item.serviceName,
      password: item.decryptedPassword,
      username: item.username,
      category: item.category,
      additionalInfo: item.decryptedadditionalInfo,
    })
    setQrData(payload)
    setQrModalVisible(true)
  }

  const handleEdit = (item: any) => {
    setIsEditing(true)
    setSelectedId(item.id)
    setServiceName(item.serviceName)
    setPassword(item.decryptedPassword)
    setUsername(item.username)
    setAdditionalInfo(item.decryptedadditionalInfo || "")
    setCategory(item.category)
    setModalVisible(true)
  }

  const allCategories = groupedPasswords.map(section => section.title)

  const shouldShowFilters = !loading && canViewPasswords && groupedPasswords.length > 0

  const filteredSections = categoryFilter
    ? groupedPasswords.filter(section => section.title === categoryFilter)
    : groupedPasswords

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Minhas Senhas</Text>

      {shouldShowFilters && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterContainer}
          contentContainerStyle={{ alignItems: 'center' }}
        >
          {["Todas", ...allCategories].map((cat, idx) => (
            <TouchableOpacity
              key={idx}
              onPress={() => setCategoryFilter(cat === "Todas" ? null : cat)}
              style={{
                paddingVertical: 6,
                paddingHorizontal: 12,
                marginRight: 8,
                borderRadius: 20,
                backgroundColor:
                  categoryFilter === cat || (cat === "Todas" && !categoryFilter)
                    ? colors.yellow
                    : colors.white,
                borderWidth: 1,
                borderColor: colors.mediumGray,
              }}
            >
              <Text style={{ fontWeight: "bold", color: colors.darkGray }}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

       <Modal visible={qrModalVisible} animationType="slide">
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          {qrData && <QRCode value={qrData} size={250} />}
          <TouchableOpacity style={styles.button} onPress={() => setQrModalVisible(false)}>
            <Text style={styles.buttonText}>Fechar</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {loading ? (
        <ActivityIndicator color={colors.darkGray} size="large" />
      ) : filteredSections.length === 0 ? (
        <Text style={{ textAlign: "center", marginTop: 32, fontSize: 16, color: colors.mediumGray }}>
          Nenhuma senha criada ainda, crie clicando ali embaixo, ó 👇
        </Text>
      ) : (
        <SectionList
          sections={filteredSections}
          keyExtractor={(item) => `${item.id}`}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => handleEdit(item)}
              onLongPress={() => handleDelete(item.id)}
              style={styles.passwordCard}
            >
              <Text style={styles.cardTitle}>{item.serviceName}</Text>
              <Text style={styles.cardSubtitle}>👤 {item.username || "-"}</Text>
              <Text style={styles.cardSubtitle}>
                🔑 {canViewPasswords ? item.decryptedPassword : "******"}
              </Text>
              <Text style={styles.cardSubtitle}>
                📝 {canViewPasswords ? item.decryptedadditionalInfo || "-" : "******"}
              </Text>
          
              {canViewPasswords && (
                <View style={styles.actionButtons}>
                  {/* WARNING */}
                  {!checkPasswordStrength(item.decryptedPassword).isValid && (
                    <TouchableOpacity
                      onPress={() => {
                        const { requirements } = checkPasswordStrength(item.decryptedPassword)
                        const failed = requirements.filter(r => !r.met).map(r => r.label)
                        setWeakPasswordInfo({ service: item.serviceName, reasons: failed })
                      }}
                      style={styles.iconButton}
                    >
                      <Ionicons name="warning" size={26} color="#FFA000" />
                    </TouchableOpacity>
                  )}
                  
                  <TouchableOpacity
                    onPress={() => {
                      copyToClipboard(item.decryptedPassword)
                      ToastAndroid.show("Senha copiada!", ToastAndroid.SHORT)
                    }}
                    style={styles.iconButton}
                  >
                    <Ionicons name="copy" size={26} color={colors.darkGray} />
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    onPress={() => generateQRData(item)}
                    style={styles.iconButton}
                  >
                    <Ionicons name="qr-code" size={26} color={colors.darkGray} />
                  </TouchableOpacity>
                </View>
              )}

            </TouchableOpacity>
          )}
          
          renderSectionHeader={({ section: { title } }) => (
            <Text style={styles.sectionHeader}>{title}</Text>
          )}
        />
      )}


      <TouchableOpacity style={styles.button} onPress={() => {
        resetForm()
        setIsEditing(false)
        setModalVisible(true)
      }}>
        <Text style={styles.buttonText}>+ Adicionar Senha</Text>
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide">
  <ScrollView contentContainerStyle={styles.modalContainer}>
    <Text style={styles.title}>{isEditing ? "Editar Senha" : "Nova Senha"}</Text>

    <View style={{ marginBottom: 10 }}>
      <Text style={{ marginBottom: 4 }}>🔒 Nome do serviço</Text>
      <TextInput style={styles.input} value={serviceName} onChangeText={setServiceName} />
    </View>

    <View style={{ marginBottom: 10 }}>
      <Text style={{ marginBottom: 4 }}>🔑 Senha</Text>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
        />
        <TouchableOpacity onPress={() => setShowPassword(prev => !prev)} style={{ marginLeft: 10 }}>
          <Ionicons name={showPassword ? "eye-off" : "eye"} size={24} color={colors.darkGray} />
        </TouchableOpacity>
      </View>
    </View>

    <View style={{ marginBottom: 10 }}>
      <Text style={{ marginBottom: 4 }}>👤 Nome de usuário</Text>
      <TextInput style={styles.input} value={username} onChangeText={setUsername} />
    </View>

    <View style={{ marginBottom: 10 }}>
      <Text style={{ marginBottom: 4 }}>🗂 Categoria</Text>
      <TextInput style={styles.input} value={category} onChangeText={setCategory} />
    </View>

    <View style={{ marginBottom: 10 }}>
      <Text style={{ marginBottom: 4 }}>📝 Informações adicionais</Text>
      <TextInput
        style={[styles.input, { height: 80 }]}
        multiline
        value={additionalInfo}
        onChangeText={setAdditionalInfo}
      />
    </View>

    <TouchableOpacity style={styles.button} onPress={handleSave}>
      <Text style={styles.buttonText}>Salvar</Text>
    </TouchableOpacity>

    <TouchableOpacity
      style={[styles.button, { backgroundColor: colors.mediumGray }]}
      onPress={() => setModalVisible(false)}
    >
      <Text style={styles.buttonText}>Cancelar</Text>
    </TouchableOpacity>

    {isEditing && selectedId !== null && (
      <TouchableOpacity
        style={[styles.button, { backgroundColor: "#D32F2F" }]}
        onPress={() => handleDelete(selectedId)}
      >
        <Text style={[styles.buttonText, { color: "#fff" }]}>Excluir</Text>
      </TouchableOpacity>
    )}
  </ScrollView>
</Modal>


      <Modal visible={passwordPromptVisible} animationType="fade" transparent>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.5)" }}>
          <View style={{ backgroundColor: "white", padding: 20, borderRadius: 10, width: "85%" }}>
            <Text style={{ fontSize: 16, fontWeight: "bold", marginBottom: 10 }}>
              🔒 Proteção ativada
            </Text>
            <Text style={{ marginBottom: 10 }}>
              Digite sua senha para visualizar as senhas salvas:
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Senha da conta"
              value={passwordInput}
              onChangeText={setPasswordInput}
              secureTextEntry
            />
            <TouchableOpacity style={[styles.button, { marginTop: 10 }]} onPress={confirmPasswordView}>
              <Text style={styles.buttonText}>Confirmar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: "#D32F2F", marginTop: 10 }]} onPress={handleCancelPasswordPrompt}
            >
              <Text style={{ color: "#fff", fontWeight: "bold" }}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={!!weakPasswordInfo} transparent animationType="slide">
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: "rgba(0,0,0,0.5)" }}>
            <View style={{ backgroundColor: "#fff", padding: 20, borderRadius: 10, width: "85%" }}>
              <Text style={{ fontSize: 18, fontWeight: "bold", marginBottom: 10 }}>
                ⚠ Senha fraca detectada
              </Text>
              <Text style={{ marginBottom: 10 }}>
                A senha de <Text style={{ fontWeight: "bold" }}>{weakPasswordInfo?.service}</Text> apresenta os seguintes problemas:
              </Text>
              {weakPasswordInfo?.reasons.map((reason, idx) => (
                <Text key={idx}>• {reason}</Text>
              ))}
              <TouchableOpacity style={[styles.button, { marginTop: 20 }]} onPress={() => setWeakPasswordInfo(null)}>
                <Text style={styles.buttonText}>Entendi</Text>
              </TouchableOpacity>
            </View>
          </View>
      </Modal>

      <ErrorModal
        visible={errorVisible}
        message={modalMessage}
        type={modalType as any}
        onClose={() => {
          setErrorVisible(false)
          if (modalType === "error") setPasswordPromptVisible(true)
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.lightGray,
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 16,
    color: colors.darkGray,
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: "bold",
    backgroundColor: colors.mediumGray,
    color: colors.white,
    padding: 8,
    borderRadius: 4,
    marginTop: 10,
  },
  passwordCard: {
    backgroundColor: colors.white,
    borderRadius: 8,
    padding: 12,
    paddingBottom: 56,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: colors.mediumGray,
    position: 'relative',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: colors.darkGray,
  },
  cardSubtitle: {
    fontSize: 14,
    color: colors.mediumGray,
    marginTop: 2,
  },
  passwordRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  copy: {
    fontSize: 18,
    marginLeft: 8,
  },
  button: {
    marginTop: 20,
    backgroundColor: colors.yellow,
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonText: {
    fontWeight: "bold",
    color: colors.darkGray,
    fontSize: 16,
  },
  modalContainer: {
    padding: 20,
    backgroundColor: colors.lightGray,
    flexGrow: 1,
  },
  input: {
    backgroundColor: colors.white,
    padding: 12,
    borderRadius: 8,
    borderColor: colors.mediumGray,
    borderWidth: 1,
    marginBottom: 10,
  },
  filterContainer: {
    maxHeight: Dimensions.get('window').height * 0.1,
    marginBottom: 10,
  },
  actionButtons: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
  },
  
  iconButton: {
    backgroundColor: colors.lightGray,
    padding: 10,
    borderRadius: 8,
    marginLeft: 8,
  },
})

export default PasswordManagerScreen