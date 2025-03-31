import React, { useEffect, useState } from "react";
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
} from "react-native";
import { useAuth } from "../../context/AuthContext";
import {
  addPassword,
  deletePasswordById,
  getPasswordsByUserId,
  updatePasswordById,
} from "../../services/database";
import { decryptData, encryptData } from "../../utils/encryption";
import { copyToClipboard } from "../../utils/passwordUtils";
import { colors } from "../../utils/theme";
import ErrorModal from "../../components/ErrorModal";

const PasswordManagerScreen = () => {
  const { localUser } = useAuth();
  const [groupedPasswords, setGroupedPasswords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalVisible, setModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const [serviceName, setServiceName] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [category, setCategory] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [modalMessage, setModalMessage] = useState("");
  const [modalType, setModalType] = useState("info");
  const [errorVisible, setErrorVisible] = useState(false);

  const showModal = (message: string, type: string = "info") => {
    setModalMessage(message);
    setModalType(type);
    setErrorVisible(true);
  };

  const resetForm = () => {
    setSelectedId(null);
    setServiceName("");
    setPassword("");
    setUsername("");
    setUrl("");
    setNotes("");
    setCategory("");
    setShowPassword(false);
  };

  const loadPasswords = async () => {
    if (!localUser) return;
    setLoading(true);
    try {
      const passwords = await getPasswordsByUserId(localUser.id);
      const grouped: Record<string, any[]> = {};

      for (const entry of passwords) {
        const decryptedPassword = decryptData(
          entry.encryptedPassword,
          localUser.decryptedMasterKey || ""
        );
        const category = entry.category?.trim() || "Outros";
        if (!grouped[category]) grouped[category] = [];

        const decryptedNotes = decryptData(
          entry.notes || "",
          localUser.decryptedMasterKey || ""
        );
        grouped[category].push({
          ...entry,
          decryptedPassword,
          decryptedNotes,
        });
      }

      const sections = Object.entries(grouped).map(([title, data]) => ({
        title,
        data,
      }));
      setGroupedPasswords(sections);
    } catch (error) {
      console.error("Erro ao carregar senhas:", error);
      showModal("Erro ao carregar senhas.", "error");
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!serviceName || !password || !localUser) {
      showModal("Preencha todos os campos obrigatórios.", "error");
      return;
    }
    try {
      const encryptedPassword = encryptData(
        password,
        localUser.decryptedMasterKey || ""
      );
      const encryptedNotes = encryptData(
        notes || "",
        localUser.decryptedMasterKey || ""
      );

      if (isEditing && selectedId !== null) {
        await updatePasswordById(
          selectedId,
          encryptedPassword,
          serviceName,
          username,
          url,
          category,
          encryptedNotes
        );
      } else {
        await addPassword(
          localUser.id,
          encryptedPassword,
          serviceName,
          username,
          url,
          category,
          encryptedNotes
        );
      }

      showModal("Senha salva com sucesso!", "success");
      setModalVisible(false);
      resetForm();
      loadPasswords();
    } catch (e) {
      console.error("Erro ao salvar:", e);
      showModal("Erro ao salvar senha.", "error");
    }
  };

  const handleDelete = async (id: number) => {
    Alert.alert(
      "Confirmar exclusão",
      "Tem certeza que deseja excluir esta senha?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            await deletePasswordById(id);
            setModalVisible(false);
            resetForm();
            loadPasswords();
            showModal("Senha excluída com sucesso!", "success");
          },
        },
      ]
    );
  };

  const handleEdit = (item: any) => {
    setIsEditing(true);
    setSelectedId(item.id);
    setServiceName(item.serviceName);
    setPassword(item.decryptedPassword);
    setUsername(item.username);
    setUrl(item.url);
    setNotes(item.decryptedNotes || "");
    setCategory(item.category);
    setModalVisible(true);
  };

  useEffect(() => {
    loadPasswords();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Minhas Senhas</Text>

      {loading ? (
        <ActivityIndicator color={colors.darkGray} size="large" />
      ) : groupedPasswords.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            Nenhuma senha até agora 😶‍🌫️?!{"\n"}
            Crie uma clicando no botão abaixo! ⬇️
          </Text>
        </View>
      ) : (
        <SectionList
          sections={groupedPasswords}
          keyExtractor={(item) => `${item.id}`}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => handleEdit(item)}
              onLongPress={() => handleDelete(item.id)}
              style={styles.passwordCard}
            >
              <Text style={styles.cardTitle}>{item.serviceName}</Text>
              <Text style={styles.cardSubtitle}>👤 {item.username || "-"}</Text>
              <View style={styles.passwordRow}>
                <Text style={styles.cardSubtitle}>
                  🔑 {item.decryptedPassword}
                </Text>
                <TouchableOpacity
                  onPress={() => copyToClipboard(item.decryptedPassword)}
                >
                  <Text style={styles.copy}>📋</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.cardSubtitle}>🔗 {item.url || "-"}</Text>
              <Text style={styles.cardSubtitle}>
                📝 {item.decryptedNotes || "-"}
              </Text>
            </TouchableOpacity>
          )}
          renderSectionHeader={({ section: { title } }) => (
            <Text style={styles.sectionHeader}>{title}</Text>
          )}
        />
      )}

      <TouchableOpacity
        style={styles.button}
        onPress={() => {
          resetForm();
          setIsEditing(false);
          setModalVisible(true);
        }}
      >
        <Text style={styles.buttonText}>+ Adicionar Senha</Text>
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide">
        <ScrollView contentContainerStyle={styles.modalContainer}>
          <Text style={styles.title}>
            {isEditing ? "Editar Senha" : "Nova Senha"}
          </Text>

          <TextInput
            style={styles.input}
            placeholder="🔒 Nome do serviço"
            value={serviceName}
            onChangeText={setServiceName}
          />

          <View style={styles.passwordInputContainer}>
            <TextInput
              style={[styles.input, { flex: 1, marginRight: 8 }]}
              placeholder="🔑 Senha"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Text style={{ fontSize: 20 }}>{showPassword ? "🚫" : "👁️"}</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.input}
            placeholder="👤 Nome de usuário"
            value={username}
            onChangeText={setUsername}
          />
          <TextInput
            style={styles.input}
            placeholder="🔗 URL"
            value={url}
            onChangeText={setUrl}
          />
          <TextInput
            style={styles.input}
            placeholder="🗂 Categoria"
            value={category}
            onChangeText={setCategory}
          />
          <TextInput
            style={[styles.input, { height: 80 }]}
            placeholder="📝 Notas"
            multiline
            value={notes}
            onChangeText={setNotes}
          />

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

      <ErrorModal
        visible={errorVisible}
        message={modalMessage}
        type={modalType as any}
        onClose={() => setErrorVisible(false)}
      />
    </View>
  );
};

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
  emptyContainer: {
    backgroundColor: colors.white,
    padding: 20,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 50,
  },
  emptyText: {
    fontSize: 16,
    color: colors.mediumGray,
    textAlign: "center",
    lineHeight: 24,
  },
  passwordInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
});

export default PasswordManagerScreen;