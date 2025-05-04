import React, { useState, useEffect } from "react"
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from "react-native"
import { useNavigation } from "@react-navigation/native"
import { useAuth } from "../../context/AuthContext"
import { getPasswordsByUserId } from "../../services/database"
import { decryptData } from "../../utils/encryption"
import { checkPasswordStrength } from "../../utils/passwordUtils"
import { colors } from "../../utils/theme"
import { EmailAuthProvider, reauthenticateWithCredential, auth } from "@/services/firebaseConfig"
import { PieChart } from "react-native-chart-kit"

const SecurityReportScreen = () => {
    const navigation = useNavigation()
    const { localUser } = useAuth()
    const [loading, setLoading] = useState(true)
    const [canViewReport, setCanViewReport] = useState(false)
    const [passwordInput, setPasswordInput] = useState("")
    const [reportData, setReportData] = useState({ total: 0, strong: 0, weak: 0 })
    const [weakPasswords, setWeakPasswords] = useState<any[]>([])
  
    const reauthenticateUser = async (inputPassword: string): Promise<boolean> => {
      const user = auth.currentUser
      if (!user) return false
  
      try {
        const credential = EmailAuthProvider.credential(user.email!, inputPassword)
        await reauthenticateWithCredential(user, credential)
        return true
      } catch (error) {
        return false
      }
    }
  
    const analyzePasswords = async () => {
      if (!localUser) return
  
      try {
        const passwords = await getPasswordsByUserId(localUser.id)
        let strong = 0
        let weak = 0
        const weakList: any[] = []
  
        for (const entry of passwords) {
          const decryptedPassword = decryptData(entry.encryptedPassword, localUser.decryptedMasterKey || "")
          const result = checkPasswordStrength(decryptedPassword)
  
          if (result.isValid) strong++
          else {
            weak++
            weakList.push({
              serviceName: entry.serviceName,
              username: entry.username,
              reasons: result.requirements.filter(r => !r.met).map(r => r.label),
            })
          }
        }
  
        setReportData({ total: passwords.length, strong, weak })
        setWeakPasswords(weakList)
      } catch (error) {
        console.error("Erro ao gerar relatório:", error)
      }
  
      setLoading(false)
    }
  
    const handleConfirmAccess = async () => {
      const success = await reauthenticateUser(passwordInput)
      if (success) {
        setCanViewReport(true)
        analyzePasswords()
      } else {
        alert("Senha incorreta.")
      }
      setPasswordInput("")
    }
  
    if (!canViewReport) {
      return (
        <View style={styles.centeredContainer}>
          <Text style={styles.title}>🔒 Relatório Protegido</Text>
          <Text style={{ marginVertical: 10 }}>Digite sua senha para gerar o relatório:</Text>
          <TextInput
            style={styles.input}
            placeholder="Senha da conta"
            secureTextEntry
            value={passwordInput}
            onChangeText={setPasswordInput}
          />
          <TouchableOpacity style={styles.button} onPress={handleConfirmAccess}>
            <Text style={styles.buttonText}>Confirmar</Text>
          </TouchableOpacity>
        </View>
      )
    }
  
    if (loading) {
      return <ActivityIndicator style={{ flex: 1 }} color={colors.darkGray} size="large" />
    }
  
    if (reportData.total === 0) {
      return (
        <View style={styles.centeredContainer}>
          <Text style={styles.title}>📊 Relatório de Segurança</Text>
          <Text style={{ marginTop: 10, fontSize: 16, color: colors.mediumGray }}>
            Nenhuma senha cadastrada para gerar relatório.
          </Text>
        </View>
      )
    }
  
    const chartData = [
      {
        name: "Fortes",
        count: reportData.strong,
        color: "#4CAF50",
        legendFontColor: "#333",
        legendFontSize: 14,
      },
      {
        name: "Fracas",
        count: reportData.weak,
        color: "#F44336",
        legendFontColor: "#333",
        legendFontSize: 14,
      },
    ]
  
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>📊 Relatório de Segurança</Text>
        <Text style={{ marginBottom: 16 }}>Total de senhas: {reportData.total}</Text>
  
        <PieChart
          data={chartData}
          width={Dimensions.get("window").width - 40}
          height={180}
          accessor="count"
          backgroundColor="transparent"
          paddingLeft="16"
          absolute
          chartConfig={{
            color: () => `#000`,
            labelColor: () => `#333`,
          }}
        />
  
        <Text style={{ marginTop: 20, fontWeight: "bold" }}>Senhas Fracas:</Text>
        {weakPasswords.map((pw, idx) => (
          <View key={idx} style={styles.weakCard}>
            <Text style={{ fontWeight: "bold" }}>{pw.serviceName}</Text>
            <Text style={{ fontSize: 13, color: colors.mediumGray }}>Usuário: {pw.username || "-"}</Text>
            {pw.reasons.map((r: string, i: number) => (
              <Text key={i} style={{ fontSize: 12 }}>• {r}</Text>
            ))}
          </View>
        ))}
      </ScrollView>
    )
  }
  
  const styles = StyleSheet.create({
    container: {
      padding: 20,
      backgroundColor: colors.lightGray,
      flexGrow: 1,
    },
    centeredContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
      backgroundColor: colors.lightGray,
    },
    title: {
      fontSize: 24,
      fontWeight: "bold",
      textAlign: "center",
      marginBottom: 16,
      color: colors.darkGray,
    },
    input: {
      backgroundColor: colors.white,
      padding: 12,
      borderRadius: 8,
      borderColor: colors.mediumGray,
      borderWidth: 1,
      width: "100%",
      marginBottom: 10,
    },
    button: {
      backgroundColor: colors.yellow,
      padding: 14,
      borderRadius: 8,
      alignItems: "center",
      width: "100%",
    },
    buttonText: {
      fontWeight: "bold",
      color: colors.darkGray,
      fontSize: 16,
    },
    weakCard: {
      backgroundColor: colors.white,
      borderRadius: 8,
      padding: 10,
      marginTop: 10,
      borderWidth: 1,
      borderColor: colors.mediumGray,
    },
  })
  
  export default SecurityReportScreen