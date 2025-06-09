import React, { useEffect, useState } from "react"
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  TextInput,
} from "react-native"
import { useAuth } from "@/context/AuthContext"
import { db } from "@/services/firebaseConfig"
import { doc, setDoc, getDoc } from "firebase/firestore"
import { colors } from "@/utils/theme"
import { useNavigation } from "@react-navigation/native"
import { collection, addDoc } from "firebase/firestore"

const Enable2FAScreen = () => {
  const { localUser } = useAuth()
  const [loading, setLoading] = useState(true)
  const [has2FAEnabled, setHas2FAEnabled] = useState(false)
  const [awaitingCode, setAwaitingCode] = useState(false)
  const [enteredCode, setEnteredCode] = useState("")
  const navigation = useNavigation()

  useEffect(() => {
    if (!localUser?.firebaseUid) {
      Alert.alert("Erro", "Usuário não autenticado.")
      navigation.goBack()
      return
    }

    const load2FAStatus = async () => {
      try {
        const userRef = doc(db, "users", localUser.firebaseUid)
        const userSnap = await getDoc(userRef)

        if (userSnap.exists()) {
          const userData = userSnap.data()
          if (userData.has_2fa) {
            setHas2FAEnabled(true)
          } else {
            setHas2FAEnabled(false)
          }
        }

        setLoading(false)
      } catch (e) {
        console.error("Erro ao carregar status 2FA:", e)
        Alert.alert("Erro", "Erro ao carregar status 2FA.")
        navigation.goBack()
      }
    }

    load2FAStatus()
  }, [])

  const handleEnable2FA = async () => {
    if (!localUser?.firebaseUid || !localUser?.email) return

    try {
      const token = Math.floor(100000 + Math.random() * 900000).toString()
      const expiry = new Date()
      expiry.setMinutes(expiry.getMinutes() + 5)

      const userRef = doc(db, "users", localUser.firebaseUid)
      await setDoc(
        userRef,
        {
          twofa_secret: token,
          twofa_email_token_expiry: expiry.toISOString(),
        },
        { merge: true }
      )

      await addDoc(collection(db, "mail"), {
        to: [localUser.email],
        message: {
          subject: "Seu código para ativar 2FA no Keydozer",
          text: `Seu código de verificação é: ${token}. Ele expira em 5 minutos.`,
        },
      })

      Alert.alert("Código enviado", "Um código foi enviado para seu e-mail. Insira-o abaixo para concluir a ativação.")
      setAwaitingCode(true)
    } catch (e) {
      console.error("Erro ao ativar 2FA:", e)
      Alert.alert("Erro", "Erro ao ativar 2FA.")
    }
  }

  const handleConfirmCode = async () => {
    if (!localUser?.firebaseUid) return

    try {
      const userRef = doc(db, "users", localUser.firebaseUid)
      const userSnap = await getDoc(userRef)

      if (!userSnap.exists()) throw new Error("USER_NOT_FOUND")

      const data = userSnap.data()
      const validToken = data?.twofa_secret
      const expiry = new Date(data?.twofa_email_token_expiry)

      if (!validToken || !expiry) throw new Error("NO_TOKEN")

      const now = new Date()
      if (now > expiry) throw new Error("EXPIRED")

      if (enteredCode !== validToken) {
        Alert.alert("Erro", "Código incorreto.")
        return
      }

      await setDoc(
        userRef,
        {
          has_2fa: 1,
          twofa_secret: "",
          twofa_email_token_expiry: null,
        },
        { merge: true }
      )

      Alert.alert("Sucesso", "2FA foi ativado com sucesso.")
      setHas2FAEnabled(true)
      setAwaitingCode(false)
      setEnteredCode("")
    } catch (e: any) {
      console.error("Erro ao confirmar código 2FA:", e)
      let msg = "Erro ao confirmar código."
      if (e.message === "EXPIRED") msg = "O código expirou. Tente novamente."
      Alert.alert("Erro", msg)
    }
  }

  const handleDisable2FA = async () => {
    if (!localUser?.firebaseUid) return

    try {
      const userRef = doc(db, "users", localUser.firebaseUid)
      await setDoc(
        userRef,
        {
          has_2fa: 0,
          twofa_secret: "",
          twofa_email_token_expiry: null,
        },
        { merge: true }
      )
      Alert.alert("2FA Desativado", "A autenticação 2FA foi desativada.")
      setHas2FAEnabled(false)
    } catch (e) {
      console.error("Erro ao desativar 2FA:", e)
      Alert.alert("Erro", "Erro ao desativar 2FA.")
    }
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.darkGray} />
      </View>
    )
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Autenticação 2FA</Text>
      <Text style={styles.instructions}>
        {`Seu e-mail: ${localUser?.email}\n\nQuando o 2FA estiver ativo, você receberá um código temporário por e-mail sempre que fizer login no Keydozer.\n\nEste código deve ser informado para concluir o login.`}
      </Text>

      {has2FAEnabled ? (
        <>
          <Text style={styles.statusText}>✅ 2FA está ATIVADO.</Text>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: "#D32F2F" }]}
            onPress={handleDisable2FA}
          >
            <Text style={[styles.buttonText, { color: "#fff" }]}>Desativar 2FA</Text>
          </TouchableOpacity>
        </>
      ) : awaitingCode ? (
        <>
          <Text style={styles.statusText}>Digite o código de 6 dígitos enviado por e-mail:</Text>
          <TextInput
            style={[
              styles.button,
              {
                padding: 10,
                textAlign: "center",
                backgroundColor: "#fff",
                borderWidth: 1,
                borderColor: colors.mediumGray,
                color: colors.darkGray,
              },
            ]}
            keyboardType="number-pad"
            maxLength={6}
            value={enteredCode}
            onChangeText={setEnteredCode}
          />
          <TouchableOpacity style={styles.button} onPress={handleConfirmCode}>
            <Text style={styles.buttonText}>Confirmar Código</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={styles.statusText}>⚠️ 2FA não está ativado.</Text>
          <TouchableOpacity style={styles.button} onPress={handleEnable2FA}>
            <Text style={styles.buttonText}>Ativar 2FA por e-mail</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  )
}

export default Enable2FAScreen

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: colors.lightGray,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: colors.darkGray,
    marginBottom: 10,
    textAlign: "center",
  },
  instructions: {
    fontSize: 16,
    color: colors.mediumGray,
    textAlign: "center",
    marginBottom: 20,
  },
  statusText: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.darkGray,
    marginBottom: 20,
  },
  button: {
    marginTop: 20,
    backgroundColor: colors.yellow,
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
    width: "80%",
  },
  buttonText: {
    fontWeight: "bold",
    color: colors.darkGray,
    fontSize: 16,
  },
})
