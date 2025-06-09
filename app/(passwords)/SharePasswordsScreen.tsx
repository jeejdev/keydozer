import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from "react-native";
import { colors } from "@/utils/theme";
import { useAuth } from "@/context/AuthContext";
import { addPassword, getPasswordsByUserId } from "@/services/database";
import {
  collection,
  doc,
  getDocs,
  deleteDoc,
  setDoc,
  query,
  where,
  addDoc,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "@/services/firebaseConfig";
import {
  decryptData,
  encryptData,
  decryptWithPassword,
  generateRandomMasterKey,
} from "@/utils/encryption";
import { signInWithEmailAndPassword } from "firebase/auth";

export default function SharePasswordsScreen() {
  const { localUser, setLocalUser } = useAuth();

  const [localPasswords, setLocalPasswords] = useState<any[]>([]);
  const [selectedPasswords, setSelectedPasswords] = useState<string[]>([]);
  const [emailDestino, setEmailDestino] = useState("");

  const [sharedPasswordsToMe, setSharedPasswordsToMe] = useState<any[]>([]);

  const [passwordPromptVisible, setPasswordPromptVisible] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");

useEffect(() => {
  console.log("🎯 useEffect chamado. localUser:", localUser);

  if (!localUser?.decryptedMasterKey || !localUser?.firebaseUid) {
    console.log("🔒 Não há chave mestra ou firebaseUid. Solicitando senha...");
    setPasswordPromptVisible(true);
  } else {
    console.log("✅ localUser completo. Carregando senhas...");
    loadLocalPasswords();
    loadSharedPasswords();
  }
}, [localUser?.decryptedMasterKey, localUser?.firebaseUid]);

  const loadLocalPasswords = async () => {
    if (!localUser?.decryptedMasterKey) return;

    const passwords = await getPasswordsByUserId(localUser.id);

    const passwordsWithDecryptedService = passwords.map((p) => ({
      ...p,
      decryptedServiceName: decryptData(p.serviceName, localUser.decryptedMasterKey),
    }));

    setLocalPasswords(passwordsWithDecryptedService);
  };

  const loadSharedPasswords = async () => {
    if (!localUser?.firebaseUid) return;

    const q = query(
      collection(db, "sharedPasswords"),
      where("toUid", "==", localUser.firebaseUid)
    );
    const snap = await getDocs(q);
    const shared = snap.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    }));
    console.log("🔍 Shared passwords loaded:", shared);
    console.log("🔍 Shared passwords:", shared[0]);
    setSharedPasswordsToMe(shared);
  };

  const handleTogglePasswordSelect = (id: string) => {
    setSelectedPasswords((prev) =>
      prev.includes(id) ? prev.filter((pid) => pid !== id) : [...prev, id]
    );
  };


const handleSharePasswords = async () => {
  console.log("🟢 handleSharePasswords chamado. localUser:", localUser);

  if (!localUser?.decryptedMasterKey || !localUser?.firebaseUid) {
    setPasswordPromptVisible(true);
    return;
  }

  if (!emailDestino || selectedPasswords.length === 0) {
    Alert.alert(
      "Erro",
      "Digite um e-mail de destino e selecione pelo menos uma senha."
    );
    return;
  }

  if (emailDestino === localUser?.email) {
    Alert.alert("Erro", "Não é possível compartilhar senhas com você mesmo.");
    return;
  }

  try {
    console.log("🔍 Buscando usuário com e-mail:", emailDestino);
    const userSnap = await getDocs(
      query(collection(db, "users"), where("email", "==", emailDestino))
    );
    if (userSnap.empty) {
      Alert.alert(
        "Aviso",
        "Usuário não encontrado. Se ele se cadastrar depois, poderá receber a senha."
      );
      return;
    }

    const targetUser = userSnap.docs[0].data();
    const encryptedMasterKeyOfTarget = targetUser.encryptedMasterKey;

    console.log("🔑 Encrypted master key do destinatário:", encryptedMasterKeyOfTarget);

    // 👉 GERA temporarySharedKey:
    const temporarySharedKey = await generateRandomMasterKey();

    console.log("🔑 Temporary Shared Key (gerada):", temporarySharedKey);

    // 👉 Criptografa os campos com a temporarySharedKey:
    const passwordsToShare = localPasswords
      .filter((p) => selectedPasswords.includes(String(p.id)))
      .map((p) => {
        const plainService = decryptData(p.serviceName, localUser.decryptedMasterKey);
        const plainUsername = decryptData(p.username, localUser.decryptedMasterKey);
        const plainPassword = decryptData(p.encryptedPassword, localUser.decryptedMasterKey);
        const plainCategory = decryptData(p.category, localUser.decryptedMasterKey);
        const plainAdditionalInfo = decryptData(p.additionalInfo, localUser.decryptedMasterKey);

        return {
          id: String(p.id), // importante: id vai para acceptedPasswordsIds
          serviceName: encryptData(plainService, temporarySharedKey),
          username: encryptData(plainUsername, temporarySharedKey),
          password: encryptData(plainPassword, temporarySharedKey),
          category: encryptData(plainCategory, temporarySharedKey),
          additionalInfo: encryptData(plainAdditionalInfo, temporarySharedKey),
        };
      });

    console.log("🔥 localUser.firebaseUid:", localUser.firebaseUid);
    console.log("🔥 auth.currentUser?.uid:", auth.currentUser?.uid);

    // PROTEÇÃO: não deixa passar sem auth.currentUser confirmado
    if (!auth.currentUser?.uid) {
      console.error("❌ auth.currentUser ainda está null no momento do addDoc. Abortando.");
      Alert.alert(
        "Erro",
        "Logue com e-mail e senha antes de compartilhar senhas, por questão de segurança."
      );
      return;
    }

    console.log("✅ SANITY CHECK - Salvando sharedPasswords com temporarySharedKey e campos criptografados.");
    console.log({
      fromUid: localUser.firebaseUid,
      toUid: targetUser.firebaseUid,
      passwords: passwordsToShare,
      acceptedPasswordsIds: [],
      timestamp: Date.now(),
    });

    await addDoc(collection(db, "sharedPasswords"), {
    fromUid: localUser.firebaseUid,
    toUid: targetUser.firebaseUid,
    temporarySharedKey: temporarySharedKey,
    passwords: passwordsToShare,
    acceptedPasswordsIds: [],
    timestamp: Date.now(),
    })

    Alert.alert("✅ Sucesso", "Senhas compartilhadas com sucesso.");
    setSelectedPasswords([]);
    setEmailDestino("");
  } catch (err) {
    console.error("Erro ao compartilhar:", err);
    Alert.alert("Erro", "Não foi possível compartilhar as senhas.");
  }
};

const handleAcceptSharedPassword = async (sharedPasswordDoc: any) => {
  if (!localUser?.decryptedMasterKey) {
    setPasswordPromptVisible(true);
    return;
  }

  try {
    const {
    passwords,
    acceptedPasswordsIds = [],
    temporarySharedKey,
    } = sharedPasswordDoc;

    console.log("🔑 Temporary shared key decrypted:", temporarySharedKey);

    const newlyAcceptedIds: string[] = [];

    for (const p of passwords) {
      const decryptedService = decryptData(p.serviceName, temporarySharedKey);
      const decryptedUsername = decryptData(p.username, temporarySharedKey);
      const decryptedPassword = decryptData(p.password, temporarySharedKey);
      const decryptedCategory = decryptData(p.category, temporarySharedKey);
      const decryptedAdditionalInfo = decryptData(p.additionalInfo, temporarySharedKey);

      await addPassword(
         localUser.id,
         decryptedService,
         decryptedUsername,
         decryptedPassword,
         decryptedCategory,
         decryptedAdditionalInfo
       );

      console.log("Senha aceita:", decryptedService);

      if (p.id) {
        newlyAcceptedIds.push(p.id);
      }
    }

    const updatedAcceptedIds = Array.from(
      new Set([...(acceptedPasswordsIds || []), ...newlyAcceptedIds])
    );

    await updateDoc(doc(db, "sharedPasswords", sharedPasswordDoc.id), {
      acceptedPasswordsIds: updatedAcceptedIds,
    });

    await loadSharedPasswords();

    Alert.alert("✅ Senhas salvas!", "As senhas foram salvas no seu cofre.");
  } catch (err) {
    console.error("Erro ao aceitar senha compartilhada:", err);
    Alert.alert("Erro", "Não foi possível aceitar a senha.");
  }
};



  const handleRejectSharedPassword = async (sharedPasswordDoc: any) => {
    try {
      await deleteDoc(doc(db, "sharedPasswords", sharedPasswordDoc.id));
      await loadSharedPasswords();
      Alert.alert("❌ Senha recusada", "Senha compartilhada foi recusada.");
    } catch (err) {
      console.error("Erro ao rejeitar senha compartilhada:", err);
      Alert.alert("Erro", "Não foi possível rejeitar a senha.");
    }
  };

  const handleConfirmPassword = async () => {
    console.log("🟢 handleConfirmPassword chamado. localUser:", localUser);

    if (!localUser) return;

    try {
      console.log("🔐 Iniciando fluxo seguro de confirmação de senha e login no Firebase...");

      const decryptedMasterKey = decryptWithPassword(
        localUser.encryptedMasterKey,
        passwordInput
      );

      if (decryptedMasterKey.startsWith("[DESCRIPTOGRAFIA_FALHOU]")) {
        console.error("❌ Falha ao descriptografar masterKey com a senha fornecida.");
        Alert.alert(
          "Erro",
          "Falha ao descriptografar a chave mestra. Verifique sua senha."
        );
        return;
      }

      console.log("✅ MasterKey descriptografada com sucesso.");

    if (!auth.currentUser) {
    console.log("⚠️ auth.currentUser está null. Tentando login no Firebase...");

    const userCredential = await signInWithEmailAndPassword(
        auth,
        localUser.email,
        passwordInput
    );

    console.log("✅ signInWithEmailAndPassword OK. Aguardando confirmação do auth state...");

    // Aguarda auth state
    await new Promise<void>((resolve) => {
        const unsubscribe = auth.onAuthStateChanged((user) => {
        if (user) {
            console.log("✅ auth.currentUser.uid após onAuthStateChanged:", user.uid);
            unsubscribe();
            resolve();
        }
        });
    });
    }

      const updatedLocalUser = {
        ...localUser,
        decryptedMasterKey,
        firebaseUid: auth.currentUser?.uid,
      };

      console.log("✅ Atualizando localUser:", updatedLocalUser);

      setLocalUser(updatedLocalUser);

      await loadLocalPasswords();
      await loadSharedPasswords();

      setPasswordPromptVisible(false);
      setPasswordInput("");

      Alert.alert("✅", "Chave mestra desbloqueada com sucesso.");
    } catch (err) {
      console.error("❌ Erro inesperado ao confirmar senha e garantir login:", err);
      Alert.alert("Erro", "Erro inesperado ao confirmar a senha.");
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>📤 Compartilhar Senhas</Text>

      <Text style={styles.label}>E-mail do destinatário:</Text>
      <TextInput
        style={styles.input}
        placeholder="E-mail"
        value={emailDestino}
        onChangeText={setEmailDestino}
      />

      <Text style={styles.label}>Selecione as senhas:</Text>
      {localPasswords.map((p) => {
        const decryptedService = p.decryptedServiceName || "[Erro ao descriptografar]";
        const selected = selectedPasswords.includes(String(p.id));
        return (
          <TouchableOpacity
            key={p.id}
            style={[
              styles.passwordItem,
              selected && styles.passwordItemSelected,
            ]}
            onPress={() => handleTogglePasswordSelect(String(p.id))}
          >
            <Text>
              {selected ? "✅ " : "⬜ "} {decryptedService}
            </Text>
          </TouchableOpacity>
        );
      })}

      <TouchableOpacity style={styles.button} onPress={handleSharePasswords}>
        <Text style={styles.buttonText}>📤 Compartilhar Selecionadas</Text>
      </TouchableOpacity>

      <View
        style={{ height: 1, backgroundColor: colors.mediumGray, marginVertical: 20 }}
      />

      <Text style={styles.title}>📥 Últimas Recebidas</Text>

      {sharedPasswordsToMe.length === 0 && (
        <Text style={styles.empty}>Nenhuma senha recebida no momento.</Text>
      )}

{sharedPasswordsToMe.map((shared) => {
  // Descriptografa a temporarySharedKey para este shared
const temporarySharedKey = shared.temporarySharedKey;

  return (
    <View key={shared.id} style={styles.sharedCard}>
      <Text style={styles.sharedFrom}>
        Últimas Recebidas — Enviado por UID: {shared.fromUid}
      </Text>

      {shared.passwords.map((p: any, index: number) => {
        const serviceName = decryptData(p.serviceName, temporarySharedKey);
        const username = decryptData(p.username, temporarySharedKey);
        const password = decryptData(p.password, temporarySharedKey);
        const category = decryptData(p.category, temporarySharedKey);
        const additionalInfo = decryptData(p.additionalInfo, temporarySharedKey);

        const isAccepted = shared.acceptedPasswordsIds?.includes(p.id);

        return (
          <View
            key={index}
            style={{
              padding: 10,
              marginBottom: 10,
              backgroundColor: isAccepted ? "#e0ffe0" : "#fff8e0",
              borderRadius: 8,
              borderWidth: 1,
              borderColor: isAccepted ? "green" : "#FFA500",
            }}
          >
            <Text style={styles.sharedService}>
              {isAccepted ? "✅ Senha aceita" : "⚠️ Senha pendente"} {serviceName}
            </Text>
            <Text style={styles.sharedService}>👤 Usuário: {username}</Text>
            <Text style={styles.sharedService}>🔑 Senha: {password}</Text>
            <Text style={styles.sharedService}>📂 Categoria: {category}</Text>
            <Text style={styles.sharedService}>📝 Info adicional: {additionalInfo}</Text>
          </View>
        );
      })}

      <View style={{ flexDirection: "row", marginTop: 10 }}>
        <TouchableOpacity
          style={[styles.button, { flex: 1, marginRight: 5 }]}
          onPress={() => handleAcceptSharedPassword(shared)}
        >
          <Text style={styles.buttonText}>✅ Aceitar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.button,
            { flex: 1, backgroundColor: "#D32F2F", marginLeft: 5 },
          ]}
          onPress={() => handleRejectSharedPassword(shared)}
        >
          <Text style={styles.buttonText}>❌ Recusar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
})}


      {passwordPromptVisible && (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <View
            style={{
              backgroundColor: "#fff",
              padding: 20,
              borderRadius: 10,
              width: "85%",
            }}
          >
            <Text
              style={{
                fontSize: 16,
                fontWeight: "bold",
                marginBottom: 10,
              }}
            >
              🔐 Digite sua senha para desbloquear a chave mestra
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Senha da conta"
              secureTextEntry
              value={passwordInput}
              onChangeText={setPasswordInput}
            />
            <TouchableOpacity style={styles.button} onPress={handleConfirmPassword}>
              <Text style={styles.buttonText}>Confirmar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.button,
                { backgroundColor: "#D32F2F", marginTop: 10 },
              ]}
              onPress={() => {
                setPasswordPromptVisible(false);
                setPasswordInput("");
              }}
            >
              <Text style={[styles.buttonText, { color: "#fff" }]}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.lightGray, padding: 20 },
  title: { fontSize: 22, fontWeight: "bold", marginBottom: 10, color: colors.darkGray },
  label: { fontSize: 14, fontWeight: "bold", color: colors.darkGray, marginBottom: 5 },
  input: {
    borderWidth: 1,
    borderColor: colors.mediumGray,
    borderRadius: 8,
    padding: 10,
    backgroundColor: "#fff",
    marginBottom: 10,
  },
  button: {
    backgroundColor: colors.yellow,
    padding: 14,
    borderRadius: 10,
    marginTop: 10,
    alignItems: "center",
  },
  buttonText: { fontWeight: "bold", fontSize: 16, color: colors.darkGray },
  passwordItem: {
    padding: 12,
    backgroundColor: colors.white,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.mediumGray,
  },
  passwordItemSelected: {
    borderColor: colors.yellow,
    backgroundColor: "#fffbe6",
  },
  empty: { textAlign: "center", marginTop: 10, color: colors.mediumGray },
  sharedCard: {
    padding: 14,
    backgroundColor: colors.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.mediumGray,
    marginBottom: 15,
  },
  sharedFrom: { fontSize: 14, marginBottom: 6, color: colors.darkGray },
  sharedService: { fontSize: 14, color: colors.darkGray },
});
