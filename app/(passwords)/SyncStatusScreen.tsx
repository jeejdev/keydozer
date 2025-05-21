import React, { useEffect, useState } from "react"
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  LayoutAnimation,
  UIManager,
  Platform,
  ScrollView,
  TextInput,
  Alert,
  Clipboard,
} from "react-native"
import { colors } from "@/utils/theme"
import { useAuth } from "@/context/AuthContext"
import { getPasswordsByUserId } from "@/services/database"
import { db } from "@/services/firebaseConfig"
import { collection, getDocs } from "firebase/firestore"
import { decryptData, decryptWithPassword } from "@/utils/encryption"

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

interface SyncDiff {
  id: string | number
  service: string
  status: SyncStatus
  localPassword?: string
  remotePassword?: string
}

type SyncStatus =
  | "Somente no dispositivo"
  | "Somente na nuvem"
  | "Divergente (conteúdo diferente)"
  | "Sincronizado"

const statusStyles: Record<SyncStatus, { icon: string; color: string }> = {
  "Somente no dispositivo": { icon: "📱", color: "#E57373" },
  "Somente na nuvem": { icon: "☁️", color: "#64B5F6" },
  "Divergente (conteúdo diferente)": { icon: "⚠️", color: "#FFB74D" },
  Sincronizado: { icon: "✅", color: "#81C784" },
}

interface RemotePassword {
  id: string
encryptedPassword: string
serviceName: string
username: string
  category: string
  additionalInfo: string
}

const SyncStatusScreen = () => {
  const { localUser, setLocalUser } = useAuth()
  const [loading, setLoading] = useState(true)
  const [syncData, setSyncData] = useState<SyncDiff[]>([])
  const [filter, setFilter] = useState<string>("TODAS")
  const [localCount, setLocalCount] = useState(0)
  const [cloudCount, setCloudCount] = useState(0)
  const [inputPassword, setInputPassword] = useState("")

  const handleDecryptMasterKey = () => {
    if (!localUser) return
    const decryptedMasterKey = decryptWithPassword(localUser.encryptedMasterKey, inputPassword)
    if (!decryptedMasterKey) {
      Alert.alert("Erro", "Falha ao descriptografar a masterKey. Senha incorreta.")
      return
    }
    setLocalUser({ ...localUser, decryptedMasterKey })
  }

  const copyToClipboard = (text: string) => {
    Clipboard.setString(text)
    Alert.alert("Copiado!", "Senha copiada para a área de transferência.")
  }

  const compareData = async () => {
    try {
      console.log("🔍 Iniciando comparação de dados...")
      if (!localUser?.decryptedMasterKey) {
        console.warn("⚠️ MasterKey ausente.")
        setSyncData([])
        return
      }

      setLoading(true)

      const localPasswords = await getPasswordsByUserId(localUser.id)
      console.log("📦 Senhas locais:", localPasswords.length)

      const snap = await getDocs(collection(db, `users/${localUser.firebaseUid}/passwords`))
      const onlinePasswords = snap.docs.map((doc) => ({
        ...doc.data(),
        id: doc.id,
      })) as RemotePassword[]

      console.log("☁️ Senhas na nuvem:", onlinePasswords.length)

      setLocalCount(localPasswords.length)
      setCloudCount(onlinePasswords.length)

      const diffs: SyncDiff[] = []

      for (const local of localPasswords) {
        const decryptedService = decryptData(local.serviceName, localUser.decryptedMasterKey)
        const decryptedLocalPassword = decryptData(local.encryptedPassword, localUser.decryptedMasterKey)
        const match = onlinePasswords.find((p) => p.id === String(local.id))

        if (!match) {
          diffs.push({
            id: local.id,
            service: decryptedService,
            status: "Somente no dispositivo",
            localPassword: decryptedLocalPassword,
          })
        } else {
          const remoteService = decryptData(match.serviceName, localUser.decryptedMasterKey)
          const decryptedRemotePassword = decryptData(match.encryptedPassword, localUser.decryptedMasterKey)

          const isDifferent =
            match.encryptedPassword !== local.encryptedPassword ||
            decryptedService !== remoteService

          diffs.push({
            id: local.id,
            service: decryptedService,
            status: isDifferent ? "Divergente (conteúdo diferente)" : "Sincronizado",
            localPassword: decryptedLocalPassword,
            remotePassword: decryptedRemotePassword,
          })
        }
      }

      for (const remote of onlinePasswords) {
        const match = localPasswords.find((p) => String(p.id) === remote.id)
        if (!match) {
          const service = decryptData(remote.serviceName, localUser.decryptedMasterKey)
          const decryptedRemotePassword = decryptData(remote.encryptedPassword, localUser.decryptedMasterKey)
          diffs.push({
            id: remote.id,
            service,
            status: "Somente na nuvem",
            remotePassword: decryptedRemotePassword,
          })
        }
      }

      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
      setSyncData(diffs)
    } catch (err) {
      console.error("💥 Erro na comparação:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (localUser?.decryptedMasterKey) {
      compareData()
    }
  }, [localUser?.decryptedMasterKey])

  const filteredData = filter === "todos" ? syncData : syncData.filter((i) => i.status === filter)

  if (!localUser?.decryptedMasterKey) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>🔑 Digite sua senha para descriptografar a masterKey</Text>
        <TextInput
          placeholder="Senha"
          secureTextEntry
          style={styles.input}
          value={inputPassword}
          onChangeText={setInputPassword}
        />
        <TouchableOpacity style={styles.button} onPress={handleDecryptMasterKey}>
          <Text style={styles.buttonText}>Descriptografar</Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (loading) {
    return <ActivityIndicator size="large" color={colors.darkGray} style={{ marginTop: 20 }} />
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🔄 Sincronização com a Nuvem</Text>

      <Text style={styles.summary}>
        📱 Locais: {localCount} | ☁️ Nuvem: {cloudCount}
      </Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {["todos", "Somente no dispositivo", "Somente na nuvem", "Divergente (conteúdo diferente)", "Sincronizado"].map((status) => (
          <TouchableOpacity
            key={status}
            style={[styles.filterButton, filter === status && styles.activeFilterButton]}
            onPress={() => setFilter(status)}
          >
            <Text style={[styles.filterText, filter === status && styles.activeFilterText]}>
              {statusStyles[status as SyncStatus]?.icon || "🌐"} {status}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={filteredData}
        keyExtractor={(item) => `${item.id}`}
        renderItem={({ item }) => (
          <View style={[styles.itemCard, { borderColor: statusStyles[item.status]?.color }]}>
            <Text style={[styles.service, { color: statusStyles[item.status]?.color }]}>
              {statusStyles[item.status]?.icon} {item.service}
            </Text>
            <Text style={[styles.status, { color: statusStyles[item.status]?.color }]}>{item.status}</Text>

            {item.localPassword && (
              <TouchableOpacity onPress={() => copyToClipboard(item.localPassword!)}>
                <Text style={styles.password}>🔑 Local: {item.localPassword}</Text>
              </TouchableOpacity>
            )}

            {item.remotePassword && (
              <TouchableOpacity onPress={() => copyToClipboard(item.remotePassword!)}>
                <Text style={styles.password}>☁️ Nuvem: {item.remotePassword}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        ListEmptyComponent={
          <Text style={[styles.empty, { fontSize: 16, fontWeight: "bold", color: "#4CAF50" }]}>
            ✅ Tudo sincronizado com sucesso!
          </Text>
        }
      />

      <TouchableOpacity style={styles.button} onPress={compareData}>
        <Text style={styles.buttonText}>🔁 Atualizar Status</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.lightGray, padding: 20 },
  title: { fontSize: 22, fontWeight: "bold", marginBottom: 10, textAlign: "center", color: colors.darkGray },
  input: { borderWidth: 1, borderColor: colors.mediumGray, borderRadius: 8, padding: 10, backgroundColor: "#fff", marginBottom: 10 },
  buttonText: { color: colors.darkGray, fontWeight: "bold", fontSize: 16 },
  summary: { textAlign: "center", marginBottom: 10, fontSize: 16, color: colors.mediumGray },
  activeFilterButton: { backgroundColor: colors.darkGray },
  filterText: { fontSize: 14, color: colors.darkGray },
  activeFilterText: { color: "white" },
itemCard: {
  padding: 16,
  backgroundColor: colors.white,
  borderRadius: 12,
  marginBottom: 12,
  borderWidth: 2,
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 4,
  elevation: 3
},
button: {
  backgroundColor: colors.yellow,
  padding: 16,
  borderRadius: 12,
  marginTop: 20,
  alignItems: "center",
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.2,
  shadowRadius: 3,
  elevation: 4
},
filterButton: {
  backgroundColor: colors.white,
  borderRadius: 20,
  paddingHorizontal: 16,
  paddingVertical: 10,
  borderWidth: 1,
  borderColor: colors.mediumGray,
  marginRight: 10,
},
filterRow: {
  flexDirection: "row",
  flexWrap: "wrap",
  justifyContent: "center",
  marginBottom: 16
},
  service: { fontSize: 16, fontWeight: "bold" },
  status: { fontSize: 14, marginTop: 4 },
  password: { fontSize: 14, marginTop: 4, color: colors.mediumGray },
  empty: { textAlign: "center", marginTop: 30 },
})

export default SyncStatusScreen
