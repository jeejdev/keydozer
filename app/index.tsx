import { useState, useEffect } from "react"
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  StyleSheet,
  Modal,
} from "react-native"
import { useRouter, useLocalSearchParams } from "expo-router"
import { MaterialIcons } from "@expo/vector-icons"
import AsyncStorage from "@react-native-async-storage/async-storage"
import * as FileSystem from "expo-file-system"
import * as LocalAuthentication from "expo-local-authentication"

import {
  getAllUsers,
  initDB,
  deleteDatabase,
  getUserByEmail,
  addUser,
  addPassword,
  getPasswordsByUserId,
  deleteUserByEmail,
  updateUserEncryptedData,
} from "../services/database"
import { colors } from "../utils/theme"
import ErrorModal from "../components/ErrorModal"
import User from "../models/User"
import { loginUser } from "../services/authService"
import { useAuth } from "../context/AuthContext"
import {
  decryptWithPassword,
  encryptData,
  encryptWithPassword,
  generateRandomMasterKey,
  hashPassword,
} from "@/utils/encryption"
import { auth, db } from "@/services/firebaseConfig"
import { collection, doc, getDoc, getDocs, setDoc, addDoc } from "firebase/firestore"
import { ScrollView } from "react-native"
import { copyToClipboard, generateStrongPassword } from "@/utils/passwordUtils"

const LoginScreen: React.FC = () => {
  const router = useRouter()
  const { setLocalUser } = useAuth()

  const DEV_EMAIL = "novaconta@gmail.com"
  const DEV_PASSWORD = "*K(Yg*A<;Fy*8.^6"

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [errorModalVisible, setErrorModalVisible] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [suggestedUser, setSuggestedUser] = useState<User | null>(null)
  const [storedPassword, setStoredPassword] = useState<string | null>(null)

  const [show2FAModal, setShow2FAModal] = useState(false)
  const [input2FACode, setInput2FACode] = useState("")
  const [expected2FACode, setExpected2FACode] = useState<string | null>(null)

  const [newPasswordModalVisible, setNewPasswordModalVisible] = useState(false)
  const [newPasswordValue, setNewPasswordValue] = useState("")

  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false)
  const [forgotQuestions, setForgotQuestions] = useState<any[]>([])
  const [forgotAnswers, setForgotAnswers] = useState<string[]>([])

  const [decryptedMasterKey, setDecryptedMasterKey] = useState<string | null>(null)
  const [tempLocalUser, setTempLocalUser] = useState<User | null>(null)

  const [modalType, setModalType] = useState<"error" | "success" | "info">("info")

  const showModal = (message: string, type: "error" | "success" | "info") => {
    setErrorMessage(message)
    setModalType(type)
    setErrorModalVisible(true)
  }

  const params = useLocalSearchParams()
  const isFirstLogin = params.firstLogin === "true"

  const showError = (message: string) => {
    setErrorMessage(message)
    setErrorModalVisible(true)
  }

  useEffect(() => {
    const init = async () => {
      try {
        const dbPath = FileSystem.documentDirectory + "SQLite/keydozer.db"
        const fileInfo = await FileSystem.getInfoAsync(dbPath)
        if (!fileInfo.exists) await initDB()

        const lastEmail = await AsyncStorage.getItem("lastLoggedInEmail")
        if (lastEmail) {
          const user = await getUserByEmail(lastEmail)
          if (user && user.encryptedMasterKey) {
            setSuggestedUser(user)
            const savedPass = await AsyncStorage.getItem(`password:${lastEmail}`)
            setStoredPassword(savedPass)
            console.log("🔑 Senha armazenada:", !!savedPass)
          } else {
            console.log("⚠️ Usuário encontrado mas sem MasterKey.")
          }
        }
      } catch (error) {
        showError("Erro ao inicializar o app.")
        console.error("❌ Erro no init:", error)
      } finally {
        setIsLoading(false)
      }
    }
    init()
  }, [])

  const handleLogin = async () => {
    if (isLoading) return

    try {
      console.log("🔐 Iniciando login com:", email)
      let localUser = await getUserByEmail(email)

      const offlineLoginAllowed = await AsyncStorage.getItem(`offlineLoginAllowed:${email}`)

      if (localUser && offlineLoginAllowed === "true") {
        console.log("⚠️ Tentando login offline com senha digitada...")

        const decryptedKey = decryptWithPassword(localUser.encryptedMasterKey, password)
        if (decryptedKey) {
          console.log("✅ Login offline realizado com sucesso.")
          setLocalUser({ ...localUser, decryptedMasterKey: decryptedKey })
          await AsyncStorage.setItem("lastLoggedInEmail", email)
          await AsyncStorage.setItem(`password:${email}`, password)
          router.replace("/home")
          return
        } else {
          console.log("❌ Falha no login offline com senha digitada. Prosseguindo com login online.")
        }
      }

      await loginUser(email, password)
      const firebaseUser = auth.currentUser
      if (!firebaseUser) throw new Error("Usuário Firebase não disponível")

      const userDoc = await getDoc(doc(db, "users", firebaseUser.uid))
      if (!userDoc.exists()) {
        showError("Conta não encontrada. Crie uma conta antes de tentar logar.")
        return
      }

      const userData = userDoc.data()

      if (!localUser) {
        console.log("🆕 Primeiro login. Buscando dados no Firestore...")
        await addUser(
          userData.name || "Nova Conta",
          email,
          await hashPassword(password),
          userData.encryptedMasterKey,
          userData.passwordHint || null,
          firebaseUser.uid,
          userData.has_2fa === 1,
          userData.twofa_secret || null
        )
        localUser = await getUserByEmail(email)
        if (!localUser) {
          showError("Erro ao salvar o usuário localmente.")
          return
        }
        console.log("✅ Usuário salvo localmente.")
      } else {
        console.log("✅ Usuário local encontrado.")
      }

      const decryptedKey = decryptWithPassword(localUser.encryptedMasterKey, password)
      if (!decryptedKey) {
        showError("Falha ao descriptografar sua chave mestra. Verifique sua senha.")
        return
      }

      setDecryptedMasterKey(decryptedKey)
      setTempLocalUser(localUser)

      if (userData.has_2fa === 1) {
        console.log("🔐 Usuário com 2FA ativo. Gerando novo token e enviando e-mail...")

        const token = Math.floor(100000 + Math.random() * 900000).toString()
        const expiry = new Date()
        expiry.setMinutes(expiry.getMinutes() + 5)

        await setDoc(doc(db, "users", firebaseUser.uid), {
          twofa_secret: token,
          twofa_email_token_expiry: expiry.toISOString(),
        }, { merge: true })

        await addDoc(collection(db, "mail"), {
          to: [firebaseUser.email],
          message: {
            subject: "Seu código 2FA do Keydozer",
            text: `Seu código de verificação é: ${token}. Ele expira em 5 minutos.`,
          },
        })

        console.log("📧 Código 2FA enviado para o e-mail.")
        setExpected2FACode(token)
        setShow2FAModal(true)

        return
      }

      // prosseguir normalmente se 2FA não está ativo
      setLocalUser({ ...localUser, decryptedMasterKey: decryptedKey })
      await AsyncStorage.setItem("lastLoggedInEmail", email)
      await AsyncStorage.setItem(`password:${email}`, password)

      if (isFirstLogin) {
        console.log("☁️ Sincronizando senhas da nuvem...")
        const passwordsCol = collection(db, "users", firebaseUser.uid, "passwords")
        const passwordsSnapshot = await getDocs(passwordsCol)

        await AsyncStorage.setItem("savePasswordsToCloud", "true")
        console.log("☁️ Salvamento na nuvem ativado por padrão.")

        for (const docSnap of passwordsSnapshot.docs) {
          const data = docSnap.data()
          const encryptedPassword = encryptData(data.password, decryptedKey)
          const encryptedAdditionalInfo = encryptData(data.additionalInfo || "", decryptedKey)

          await addPassword(
            localUser.id,
            encryptedPassword,
            data.serviceName,
            data.username,
            data.category,
            encryptedAdditionalInfo
          )
        }
        console.log("✅ Sincronização de senhas concluída.")
      }

      router.replace("/home")
    } catch (error: any) {
      console.error("❌ Erro no login:", error)
      if (
        error.code === "auth/invalid-credential" ||
        error.code === "auth/user-not-found" ||
        error.code === "auth/wrong-password"
      ) {
        showError("E-mail ou senha incorretos.")
      } else {
        showError("Erro ao fazer login. Tente novamente mais tarde.")
      }
    }
  }

    const handleForgotPassword = async () => {
    try {
      if (!email) {
        showError("Digite o e-mail da conta para recuperar.")
        return
      }

      const usersQuery = await getDocs(collection(db, "users"))
      const userDoc = usersQuery.docs.find(doc => doc.data().email === email)

      if (!userDoc) {
        showError("Usuário não encontrado.")
        return
      }

      const userData = userDoc.data()
      const questions = JSON.parse(userData.securityQuestions || "[]")

      if (!questions.length) {
        showError("Usuário não possui perguntas de segurança configuradas.")
        return
      }

      setForgotQuestions(questions)
      setForgotAnswers(Array(questions.length).fill(""))
      setShowForgotPasswordModal(true)
    } catch (err) {
      console.error("Erro no esqueci a senha:", err)
      showError("Erro ao buscar perguntas de segurança.")
    }
  }

  const handleConfirmForgotPassword = async () => {
    try {
      for (let i = 0; i < forgotQuestions.length; i++) {
        const answerHash = forgotQuestions[i].answerHash
        const userAnswer = forgotAnswers[i]?.trim()

        const hashed = await hashPassword(userAnswer)

        if (hashed !== answerHash) {
          showError(`Resposta incorreta para: "${forgotQuestions[i].question}"`)
          return
        }
      }

      // Se chegou aqui → respostas corretas → resetar a senha
      const newPassword = generateStrongPassword(16)
      const newHashedPassword = await hashPassword(newPassword)
      const newMasterKey = await generateRandomMasterKey()
      const encryptedMasterKey = encryptWithPassword(newMasterKey, newPassword)

      console.log("🆕 Nova senha gerada:", newPassword)
      console.log("🔑 Nova senha hash:", newHashedPassword)
      console.log("🔐 Nova encryptedMasterKey:", encryptedMasterKey)

      const usersQuery = await getDocs(collection(db, "users"))
      const userDoc = usersQuery.docs.find(doc => doc.data().email === email)
      if (!userDoc) {
        showError("Usuário não encontrado.")
        return
      }

      await setDoc(doc(db, "users", userDoc.id), {
        password: newHashedPassword,
        encryptedMasterKey,
        twofa_secret: "",
        twofa_email_token_expiry: null,
      }, { merge: true })

      // Zera senha no SQLite tbm
      //await deleteUserByEmail(email)

      await AsyncStorage.setItem(`offlineLoginAllowed:${email}`, "true")

      await updateUserEncryptedData(email, newHashedPassword, encryptedMasterKey)
      setNewPasswordValue(newPassword)
      setNewPasswordModalVisible(true)
      setShowForgotPasswordModal(false)
      setForgotQuestions([])
      setForgotAnswers([])

    } catch (err) {
      console.error("Erro ao confirmar respostas:", err)
      showError("Erro ao validar respostas.")
    }
  }

  const handleVerify2FACode = () => {
    if (input2FACode === expected2FACode && tempLocalUser && decryptedMasterKey) {
      console.log("✅ Código 2FA válido. Prosseguindo para home...")
      setShow2FAModal(false)
      setInput2FACode("")
      setExpected2FACode(null)

      setLocalUser({ ...tempLocalUser, decryptedMasterKey })
      router.replace("/home")
    } else {
      showError("Código 2FA inválido. Verifique o e-mail e tente novamente.")
    }
  }

  const handleBiometricLogin = async () => {
    console.log("🔐 Iniciando login biométrico...")

    try {
      const compatible = await LocalAuthentication.hasHardwareAsync()
      const enrolled = await LocalAuthentication.isEnrolledAsync()

      if (!compatible || !enrolled) {
        showError("Seu dispositivo não suporta biometria.")
        return
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Autentique para continuar",
        fallbackLabel: "Usar senha",
      })

      if (!result.success) return
      console.log("✅ Biometria autenticada!")

      const lastEmail = await AsyncStorage.getItem("lastLoggedInEmail")
      if (!lastEmail) {
        showError("Nenhum usuário encontrado. Faça login manualmente.")
        return
      }

      const localUser = await getUserByEmail(lastEmail)
      if (!localUser) {
        showError("Usuário local não encontrado após autenticação.")
        return
      }

      const savedPass = await AsyncStorage.getItem(`password:${lastEmail}`)
      if (!savedPass) {
        showError("Senha não disponível. Faça login manualmente.")
        return
      }

      const decryptedMasterKey = decryptWithPassword(
        localUser.encryptedMasterKey,
        savedPass
      )
      if (!decryptedMasterKey) {
        showError("Erro ao descriptografar. Faça login manualmente.")
        return
      }

      // Não exige autenticação Firebase na biometria
      console.log("⚠️ Login biométrico realizado apenas localmente.")

      setLocalUser({ ...localUser, decryptedMasterKey })
      router.replace("/home")
    } catch (error) {
      console.error("❌ Erro no login biométrico:", error)
      showError("Erro ao logar com biometria.")
    }
  }

  const handleDeleteDB = async () => {
    try {
      await deleteDatabase()
    } catch (err) {
      console.error("❌ Erro ao excluir banco local:", err)
    }
  }

  const autofillTestAccount = () => {
    setEmail(DEV_EMAIL)
    setPassword(DEV_PASSWORD)
  }

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.yellow} />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Image source={require("../assets/images/logo.png")} style={styles.logo} />

      {suggestedUser && suggestedUser.encryptedMasterKey && storedPassword ? (
        <View style={{ alignItems: "center", marginBottom: 30 }}>
          <Text style={styles.title}>Bem-vindo de volta, {suggestedUser.name}</Text>
          <TouchableOpacity style={styles.button} onPress={handleBiometricLogin}>
            <Text style={styles.buttonText}>🔐 Logar com biometria</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setSuggestedUser(null)}>
            <Text style={styles.link}>Não é {suggestedUser.name}? Logar com outra conta</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <Text style={styles.title}>Login</Text>
          <TextInput
            style={styles.input}
            placeholder="E-mail"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Senha"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <MaterialIcons
                name={showPassword ? "visibility-off" : "visibility"}
                size={24}
                color={colors.mediumGray}
              />
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.button} onPress={handleLogin}>
            <Text style={styles.buttonText}>Entrar</Text>
          </TouchableOpacity>

          <View style={{ 
            flexDirection: "row", 
            justifyContent: "space-between", 
            width: "90%"
          }}>
            <TouchableOpacity onPress={handleForgotPassword}>
              <Text style={styles.link}>Esqueci minha senha</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push("/register")}>
              <Text style={styles.link}>Novo aqui? Criar conta</Text>
            </TouchableOpacity>
          </View>

          {process.env.EXPO_PUBLIC_DEVELOPMENT_MODE === "True" && (
            <>
              <TouchableOpacity style={[styles.button, { backgroundColor: colors.green }]} onPress={autofillTestAccount}>
                <Text style={styles.buttonText}>[DEV] Preencher Conta de Teste</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, { backgroundColor: colors.blue }]}
                onPress={async () => {
                  const allUsers = await getAllUsers()
                  console.log("🔍 ==== USUÁRIOS DO SQLITE ====\n", allUsers)
                }}
              >
                <Text style={styles.buttonText}>[DEV] Ver Banco Local</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, { backgroundColor: "#D32F2F" }]}
                onPress={handleDeleteDB}
              >
                <Text style={{ color: "#fff", fontWeight: "bold" }}>
                  [DEV] Excluir Banco de Dados
                </Text>
              </TouchableOpacity>
            </>
          )}
        </>
      )}

      <Modal visible={showForgotPasswordModal} animationType="slide" transparent={true}>
        <View style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "rgba(0,0,0,0.5)",
          padding: 20,
        }}>
          <View style={{
            backgroundColor: "#fff",
            borderRadius: 12,
            padding: 20,
            width: "90%",
            maxHeight: "80%",
          }}>
            <ScrollView>
              <Text style={{ fontSize: 20, fontWeight: "bold", marginBottom: 10, textAlign: "center" }}>
                Recuperação de Conta
              </Text>

              {forgotQuestions.map((q, index) => (
                <View key={index} style={{ marginBottom: 10 }}>
                  <Text style={{ marginBottom: 4 }}>{q.question}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Sua resposta"
                    value={forgotAnswers[index]}
                    onChangeText={(text) => {
                      const newAnswers = [...forgotAnswers]
                      newAnswers[index] = text
                      setForgotAnswers(newAnswers)
                    }}
                  />
                </View>
              ))}

              <TouchableOpacity
                style={[styles.button, { backgroundColor: colors.green }]}
                onPress={handleConfirmForgotPassword}
              >
                <Text style={styles.buttonText}>Confirmar Respostas</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, { backgroundColor: "#D32F2F" }]}
                onPress={() => {
                  setShowForgotPasswordModal(false)
                  setForgotQuestions([])
                  setForgotAnswers([])
                }}
              >
                <Text style={[styles.buttonText, { color: "#fff" }]}>Cancelar</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={newPasswordModalVisible} animationType="fade" transparent={true}>
        <View style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "rgba(0,0,0,0.5)",
          padding: 20,
        }}>
          <View style={{
            backgroundColor: "#fff",
            borderRadius: 12,
            padding: 20,
            width: "90%",
            alignItems: "center",
          }}>
            <Text style={{
              fontSize: 20,
              fontWeight: "bold",
              marginBottom: 10,
              textAlign: "center",
            }}>
              🎉 Senha Resetada
            </Text>

            <Text style={{
              fontSize: 16,
              color: colors.darkGray,
              marginBottom: 10,
              textAlign: "center",
            }}>
              Sua nova senha é:
            </Text>

            <Text selectable style={{
              fontSize: 18,
              fontWeight: "bold",
              color: colors.blue,
              marginBottom: 20,
            }}>
              {newPasswordValue}
            </Text>

            <TouchableOpacity
              style={[styles.button, { backgroundColor: colors.green, width: "100%" }]}
              onPress={async () => {
                await copyToClipboard(newPasswordValue)
                console.log("📋 Senha copiada para clipboard:", newPasswordValue)
                alert("Senha copiada!")
              }}
            >
              <Text style={styles.buttonText}>Copiar senha</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, { backgroundColor: "#D32F2F", width: "100%" }]}
              onPress={() => {
                setNewPasswordModalVisible(false)
                setNewPasswordValue("")
              }}
            >
              <Text style={[styles.buttonText, { color: "#fff" }]}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {show2FAModal && (
        <View style={{
          position: "absolute",
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: "rgba(0,0,0,0.5)",
          justifyContent: "center",
          alignItems: "center",
          padding: 20,
        }}>
          <View style={{
            backgroundColor: "#fff",
            borderRadius: 8,
            padding: 20,
            width: "90%",
            alignItems: "center",
          }}>
            <Text style={{ fontSize: 18, fontWeight: "bold", marginBottom: 10 }}>
              Digite o código 2FA
            </Text>
            <Text style={{ fontSize: 14, color: colors.mediumGray, marginBottom: 20, textAlign: "center" }}>
              Enviamos um código para seu e-mail. Insira-o abaixo para continuar.
            </Text>
            <TextInput
              style={{
                width: "100%",
                padding: 12,
                borderWidth: 1,
                borderColor: colors.mediumGray,
                borderRadius: 8,
                marginBottom: 20,
                textAlign: "center",
                fontSize: 18,
              }}
              keyboardType="number-pad"
              maxLength={6}
              value={input2FACode}
              onChangeText={setInput2FACode}
              placeholder="Código 2FA"
            />
            <TouchableOpacity
              style={[styles.button, { width: "100%" }]}
              onPress={handleVerify2FACode}
            >
              <Text style={styles.buttonText}>Verificar Código</Text>
            </TouchableOpacity>

            {/* BOTÃO DE FECHAR */}
            <TouchableOpacity
              style={[styles.button, { backgroundColor: "#D32F2F", width: "100%" }]}
              onPress={() => {
                // Ao fechar o modal, resetar os estados relacionados ao 2FA:
                setShow2FAModal(false)
                setInput2FACode("")
                setExpected2FACode(null)
                setTempLocalUser(null)
                setDecryptedMasterKey(null)
              }}
            >
              <Text style={[styles.buttonText, { color: "#fff" }]}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <ErrorModal
        visible={errorModalVisible}
        message={errorMessage}
        type={modalType}
        onClose={() => setErrorModalVisible(false)}
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
  logo: {
    width: 140,
    height: 100,
    resizeMode: "contain",
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: colors.darkGray,
    marginBottom: 15,
    textAlign: "center",
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
  passwordContainer: {
    width: "90%",
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.mediumGray,
    borderRadius: 8,
    marginBottom: 10,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 12,
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
    textAlign: "center",
  },
})

export default LoginScreen