import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Modal } from "react-native";
import { colors } from "../utils/theme";

interface ErrorModalProps {
  visible: boolean;
  message: string;
  type?: "error" | "info" | "success"; // Suporte a diferentes tipos
  onClose: () => void;
}

const ErrorModal: React.FC<ErrorModalProps> = ({ visible, message, type = "error", onClose }) => {
  return (
    <Modal animationType="slide" transparent={true} visible={visible}>
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.modalContainer,
            type === "error"
              ? styles.errorContainer
              : type === "success"
              ? styles.successContainer
              : styles.infoContainer,
          ]}
        >
          <Text
            style={[
              styles.modalTitle,
              type === "error"
                ? styles.errorTitle
                : type === "success"
                ? styles.successTitle
                : styles.infoTitle,
            ]}
          >
            {type === "error" ? "⚠️ Erro" : type === "success" ? "✅ Sucesso" : "ℹ️ Aviso"}
          </Text>
          <Text style={styles.modalMessage}>{message}</Text>
          <TouchableOpacity
            style={[
              styles.modalButton,
              type === "error"
                ? styles.errorButton
                : type === "success"
                ? styles.successButton
                : styles.infoButton,
            ]}
            onPress={onClose}
          >
            <Text style={styles.modalButtonText}>Fechar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContainer: {
    width: "80%",
    padding: 20,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: colors.white, // Sempre fundo branco para contraste
  },
  errorContainer: {
    borderColor: colors.red,
    borderWidth: 2,
  },
  successContainer: {
    borderColor: colors.green,
    borderWidth: 2,
  },
  infoContainer: {
    borderColor: colors.blue,
    borderWidth: 2,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 10,
  },
  errorTitle: { color: colors.red },
  successTitle: { color: colors.green },
  infoTitle: { color: colors.blue },
  modalMessage: {
    fontSize: 16,
    color: colors.darkGray,
    textAlign: "center",
    marginBottom: 15,
  },
  modalButton: {
    padding: 12,
    borderRadius: 8,
    width: "80%",
    alignItems: "center",
    backgroundColor: colors.lightGray,
  },
  errorButton: { backgroundColor: colors.red },
  successButton: { backgroundColor: colors.green },
  infoButton: { backgroundColor: colors.blue },
  modalButtonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: colors.darkGray,
  },
});

export default ErrorModal;
