import React, { useEffect, useState } from "react"
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SectionList,
  ActivityIndicator,
} from "react-native"
import { usePathname, useRouter } from "expo-router"
import { colors } from "../../utils/theme"
import { useAuth } from "../../context/AuthContext"
import { getPasswordsByUserId } from "../../services/database"
import { decryptData } from "../../utils/encryption"
import ErrorModal from "../../components/ErrorModal"


const PasswordListScreen: React.FC = () => {
  const { localUser } = useAuth()
  const router = useRouter()
  const [groupedPasswords, setGroupedPasswords] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalVisible, setModalVisible] = useState(false)
  const [modalMessage, setModalMessage] = useState("")

  const showModal = (message: string) => {
    setModalMessage(message)
    setModalVisible(true)
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

        grouped[category].push({
          ...entry,
          decryptedPassword,
        })
      }

      const sections = Object.entries(grouped).map(([title, data]) => ({ title, data }))
      setGroupedPasswords(sections)
    } catch (error) {
      console.error("Erro ao carregar senhas:", error)
      showModal("Erro ao carregar senhas. Tente novamente.")
    }
    setLoading(false)
  }

  useEffect(() => {
    loadPasswords()
  }, [])

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Minhas Senhas</Text>

      {loading ? (
        <ActivityIndicator color={colors.darkGray} size="large" />
      ) : (
        <SectionList
          sections={groupedPasswords}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          renderItem={({ item }) => (
            <View style={styles.passwordCard}>
              <Text style={styles.cardTitle}>{item.serviceName}</Text>
              <Text style={styles.cardSubtitle}>👤 {item.username || "-"}</Text>
              <Text style={styles.cardSubtitle}>🔑 {item.decryptedPassword}</Text>
              <Text style={styles.cardSubtitle}>🔗 {item.url || "-"}</Text>
              <Text style={styles.cardSubtitle}>📝 {item.notes ? "🔒 Notas salvas" : "-"}</Text>
            </View>
          )}
          renderSectionHeader={({ section: { title } }) => (
            <Text style={styles.sectionHeader}>{title}</Text>
          )}
          ListEmptyComponent={<Text style={{ textAlign: "center", marginTop: 30 }}>Nenhuma senha cadastrada.</Text>}
        />
      )}

<TouchableOpacity style={styles.button} onPress={() => router.push("/(passwords)/add")}>
  <Text style={styles.buttonText}>+ Adicionar Senha</Text>
</TouchableOpacity>

      <ErrorModal
        visible={modalVisible}
        message={modalMessage}
        onClose={() => setModalVisible(false)}
        type="error"
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
    marginVertical: 6,
    borderWidth: 1,
    borderColor: colors.mediumGray,
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
})

export default PasswordListScreen
