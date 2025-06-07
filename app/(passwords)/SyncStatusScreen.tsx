import React, { useEffect, useState } from "react";
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
} from "react-native";
import { colors } from "@/utils/theme";
import { useAuth } from "@/context/AuthContext";
import { getPasswordsByUserId } from "@/services/database";
import { auth, db } from "@/services/firebaseConfig";
import { collection, doc, getDocs, setDoc } from "firebase/firestore";
import { decryptData, decryptWithPassword } from "@/utils/encryption";
import AsyncStorage from "@react-native-async-storage/async-storage";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface SyncDiff {
  id: string | number;
  service: string;
  status: SyncStatus;
  localPassword?: string;
  remotePassword?: string;
  localFullData?: any;
}

type SyncStatus =
  | "Somente no dispositivo"
  | "Somente na nuvem"
  | "Divergente (conteúdo diferente)"
  | "Sincronizado";

const statusStyles: Record<SyncStatus, { icon: string; color: string }> = {
  "Somente no dispositivo": { icon: "📱", color: "#E57373" },
  "Somente na nuvem": { icon: "☁️", color: "#64B5F6" },
  "Divergente (conteúdo diferente)": { icon: "⚠️", color: "#FFB74D" },
  Sincronizado: { icon: "✅", color: "#81C784" },
};

interface RemotePassword {
  id: string;
  encryptedPassword: string;
  serviceName: string;
  username: string;
  category: string;
  additionalInfo: string;
}

const SyncStatusScreen = () => {
  const { localUser, setLocalUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [syncData, setSyncData] = useState<SyncDiff[]>([]);
  const [diffsToSync, setDiffsToSync] = useState<SyncDiff[]>([]);
  const [filter, setFilter] = useState<string>("todos");
  const [localCount, setLocalCount] = useState(0);
  const [cloudCount, setCloudCount] = useState(0);
  const [passwordPromptVisible, setPasswordPromptVisible] = useState(false);
  const [inputPassword, setInputPassword] = useState("");

  useEffect(() => {
    console.log("[SyncStatusScreen] Montando tela");
    const checkRequirePassword = async () => {
      const requireSetting = await AsyncStorage.getItem("requirePasswordToView");
      const require = requireSetting === "true";
      console.log("[SyncStatusScreen] requirePasswordToView:", requireSetting);

      if (require || !localUser?.decryptedMasterKey) {
        setPasswordPromptVisible(true);
        console.log("[SyncStatusScreen] passwordPromptVisible: true");
      } else {
        setPasswordPromptVisible(false);
        console.log("[SyncStatusScreen] passwordPromptVisible: false");
        compareData();
      }
    };

    checkRequirePassword();
  }, []);

  const handleDecryptMasterKey = () => {
    if (!localUser) return;
    console.log("[SyncStatusScreen] User digitou senha:", inputPassword);
    console.log("[SyncStatusScreen] Descriptografando masterKey...");

    const decryptedMasterKey = decryptWithPassword(localUser.encryptedMasterKey, inputPassword);
    if (!decryptedMasterKey || decryptedMasterKey.startsWith("[DESCRIPTOGRAFIA_FALHOU]")) {
      Alert.alert("Erro", "Falha ao descriptografar a masterKey.");
      console.log("[SyncStatusScreen] Resultado: FALHA");
      return;
    }

    console.log("[SyncStatusScreen] Resultado: OK");
    setLocalUser({ ...localUser, decryptedMasterKey });
    setPasswordPromptVisible(false);
    console.log("[SyncStatusScreen] Chamando compareData()");
    compareData();
  };

  const syncToCloud = async () => {
    console.log("🚀 Iniciando sincronização manual...");
    for (const diff of diffsToSync) {
      if (diff.localFullData) {
        try {
          const ref = doc(db, `users/${localUser?.firebaseUid}/passwords/${diff.id}`);
          console.log(`☁️ Sincronizando senha ID ${diff.id} para Firestore...`);
          await setDoc(ref, {
            encryptedPassword: diff.localFullData.encryptedPassword,
            serviceName: diff.localFullData.serviceName,
            username: diff.localFullData.username,
            category: diff.localFullData.category,
            additionalInfo: diff.localFullData.additionalInfo,
          });
          console.log(`✅ Sincronização concluída para ID ${diff.id}`);
        } catch (err) {
          console.error("❌ Erro ao sincronizar:", err);
        }
      }
    }

    Alert.alert("✅ Sincronização concluída!", "Os dados foram atualizados na nuvem.");
    compareData(); // Recarrega após sincronizar
  };

  const compareData = async () => {
    if (!localUser?.decryptedMasterKey) {
      Alert.alert("Erro", "MasterKey não descriptografada.");
      return;
    }

    setLoading(true);
    console.log("🔍 Iniciando comparação de dados...");

    try {
      const localPasswords = await getPasswordsByUserId(localUser.id);
      setLocalCount(localPasswords.length);
      console.log(`📦 Senhas locais: ${localPasswords.length}`);

      if (!auth.currentUser) {
        Alert.alert("⚠️", "Você precisa estar logado na nuvem para sincronizar.");
        setLoading(false);
        return;
      }

      const snap = await getDocs(collection(db, `users/${localUser.firebaseUid}/passwords`));
      const onlinePasswords = snap.docs.map((doc) => ({
        ...doc.data(),
        id: doc.id,
      })) as RemotePassword[];

      setCloudCount(onlinePasswords.length);
      console.log(`☁️ Senhas na nuvem: ${onlinePasswords.length}`);

      const diffs: SyncDiff[] = [];
      const diffsToSyncTemp: SyncDiff[] = [];

      for (const local of localPasswords) {
        const decryptedService = decryptData(local.serviceName, localUser.decryptedMasterKey);
        const decryptedLocalPassword = decryptData(local.encryptedPassword, localUser.decryptedMasterKey);

        const match = onlinePasswords.find((p) => p.id === String(local.id));

        if (!match) {
          console.log(`⚠️ Senha local ID ${local.id} não encontrada na nuvem.`);
          const diff = {
            id: local.id,
            service: decryptedService,
            status: "Somente no dispositivo" as SyncStatus,
            localPassword: decryptedLocalPassword,
            localFullData: local,
          };
          diffs.push(diff);
          diffsToSyncTemp.push(diff);
        } else {
          const remoteService = decryptData(match.serviceName, localUser.decryptedMasterKey);
          const decryptedRemotePassword = decryptData(match.encryptedPassword, localUser.decryptedMasterKey);

          const isDifferent =
            decryptedLocalPassword !== decryptedRemotePassword || decryptedService !== remoteService;

          const diff = {
            id: local.id,
            service: decryptedService,
            status: (isDifferent ? "Divergente (conteúdo diferente)" : "Sincronizado") as SyncStatus,
            localPassword: decryptedLocalPassword,
            remotePassword: decryptedRemotePassword,
            localFullData: local,
          };

          diffs.push(diff);
          if (isDifferent) {
            diffsToSyncTemp.push(diff);
          }
        }
      }

      for (const remote of onlinePasswords) {
        const match = localPasswords.find((p) => String(p.id) === remote.id);
        if (!match) {
          const service = decryptData(remote.serviceName, localUser.decryptedMasterKey);
          const decryptedRemotePassword = decryptData(remote.encryptedPassword, localUser.decryptedMasterKey);
          const diff = {
            id: remote.id,
            service,
            status: "Somente na nuvem" as SyncStatus,
            remotePassword: decryptedRemotePassword,
          };
          diffs.push(diff);
        }
      }

      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setSyncData(diffs);
      setDiffsToSync(diffsToSyncTemp);
      console.log(`✅ Comparação finalizada. Diferenças: ${diffs.length}`);
    } catch (err) {
      console.error("💥 Erro na comparação:", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredData = filter === "todos" ? syncData : syncData.filter((i) => i.status === filter);

  if (passwordPromptVisible) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>🔑 Digite sua senha para visualizar o status de sincronização</Text>
        <TextInput
          placeholder="Senha"
          secureTextEntry
          style={styles.input}
          value={inputPassword}
          onChangeText={setInputPassword}
        />
        <TouchableOpacity style={styles.button} onPress={handleDecryptMasterKey}>
          <Text style={styles.buttonText}>Confirmar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return <ActivityIndicator size="large" color={colors.darkGray} style={{ marginTop: 20 }} />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🔄 Sincronização com a Nuvem</Text>
      <Text style={styles.summary}>📱 Locais: {localCount} | ☁️ Nuvem: {cloudCount}</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {["todos", "Somente no dispositivo", "Somente na nuvem", "Divergente (conteúdo diferente)", "Sincronizado"].map(
          (status) => (
            <TouchableOpacity
              key={status}
              style={[styles.filterButton, filter === status && styles.activeFilterButton]}
              onPress={() => setFilter(status)}
            >
              <Text style={[styles.filterText, filter === status && styles.activeFilterText]}>
                {statusStyles[status as SyncStatus]?.icon || "🌐"} {status}
              </Text>
            </TouchableOpacity>
          )
        )}
      </ScrollView>

      <FlatList
        data={filteredData}
        keyExtractor={(item) => `${item.id}`}
        renderItem={({ item }) => (
          <View style={[styles.itemCard, { borderColor: statusStyles[item.status].color }]}>
            <Text style={[styles.service, { color: statusStyles[item.status].color }]}>
              {statusStyles[item.status].icon} {item.service}
            </Text>
            <Text style={[styles.status, { color: statusStyles[item.status].color }]}>{item.status}</Text>

            {item.localPassword !== undefined && (
              <Text style={styles.passwordText}>🔑 Local: {item.localPassword}</Text>
            )}
            {item.remotePassword !== undefined && (
              <Text style={styles.passwordText}>☁️ Nuvem: {item.remotePassword}</Text>
            )}
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>✅ Tudo sincronizado com sucesso!</Text>}
      />

      <TouchableOpacity style={styles.button} onPress={compareData}>
        <Text style={styles.buttonText}>🔁 Verificar status das senhas</Text>
      </TouchableOpacity>

      {diffsToSync.length > 0 && (
        <TouchableOpacity
          style={[styles.button, { backgroundColor: "#FF9800" }]}
          onPress={() =>
            Alert.alert(
              "⚠️ Divergências detectadas",
              "Deseja sincronizar as divergências na nuvem?",
              [
                { text: "Cancelar", style: "cancel" },
                { text: "Sincronizar", onPress: syncToCloud },
              ],
              { cancelable: true }
            )
          }
        >
          <Text style={styles.buttonText}>☁️ Sincronizar agora ({diffsToSync.length})</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.lightGray, padding: 20 },
  title: { fontSize: 22, fontWeight: "bold", marginBottom: 10, textAlign: "center", color: colors.darkGray },
  input: { borderWidth: 1, borderColor: colors.mediumGray, borderRadius: 8, padding: 10, backgroundColor: "#fff", marginBottom: 10 },
  buttonText: { color: colors.darkGray, fontWeight: "bold", fontSize: 16 },
  summary: { textAlign: "center", marginBottom: 10, fontSize: 16, color: colors.mediumGray },
  activeFilterButton: { backgroundColor: colors.darkGray },
  filterText: { fontSize: 14, color: colors.darkGray },
  activeFilterText: { color: "white" },
  itemCard: { padding: 16, backgroundColor: colors.white, borderRadius: 12, marginBottom: 12, borderWidth: 2 },
  button: { backgroundColor: colors.yellow, padding: 16, borderRadius: 12, marginTop: 20, alignItems: "center" },
  filterButton: { backgroundColor: colors.white, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: colors.mediumGray, marginRight: 10 },
  filterRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", marginBottom: 16 },
  service: { fontSize: 16, fontWeight: "bold" },
  status: { fontSize: 14, marginTop: 4 },
  passwordText: { fontSize: 14, marginTop: 4, color: colors.darkGray },
  empty: { textAlign: "center", marginTop: 30, fontSize: 16, fontWeight: "bold", color: "#4CAF50" },
});

export default SyncStatusScreen;
