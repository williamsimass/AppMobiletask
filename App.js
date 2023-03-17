import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  Keyboard,
  Alert,
  Modal,
} from "react-native";
import * as SQLite from "expo-sqlite";
import * as Notifications from "expo-notifications";
import { IconButton, Menu, Provider } from "react-native-paper";
import * as MailComposer from 'expo-mail-composer'

const db = SQLite.openDatabase("tasks.db");

export default function App() {
  const [taskDescription, setTaskDescription] = useState("");
  const [taskDateTime, setTaskDateTime] = useState("");
  const [tasks, setTasks] = useState([]);
  const [menuVisible, setMenuVisible] = useState(false);
  const [contactModalVisible, setContactModalVisible] = useState(false)
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");

  const sendEmail = async () => {
  try {
    await MailComposer.composeAsync({
      recipients: ['dev.wb10@gmail.com'],
      subject: 'Sugestão do aplicativo',
      body: `Nome: ${name}\n\nMensagem: ${message}`,
    });
    Alert.alert('Sucesso', 'E-mail enviado com sucesso!');
    setContactModalVisible(false)
    setName('');
    setMessage('');
  } catch (error) {
    Alert.alert('Erro', 'Ocorreu um erro ao enviar o e-mail.');
  }
};

  useEffect(() => {
    requestNotificationPermission();
    db.transaction((tx) => {
      tx.executeSql(
        "CREATE TABLE IF NOT EXISTS tasks (id INTEGER PRIMARY KEY, description TEXT, dateTime TEXT, completed INTEGER);",
        [],
        () => {
          loadTasks();
        }
      );
    });
  }, []);

  const storeTasks = async (tasks) => {
    db.transaction((tx) => {
      tx.executeSql("DELETE FROM tasks;");
      tasks.forEach((task) => {
        tx.executeSql(
          "INSERT INTO tasks (id, description, dateTime, completed) VALUES (?, ?, ?, ?);",
          [
            parseInt(task.id),
            task.description,
            task.dateTime,
            task.completed ? 1 : 0,
          ]
        );
      });
    });
  };

  const loadTasks = () => {
    db.transaction((tx) => {
      tx.executeSql("SELECT * FROM tasks;", [], (_, { rows }) => {
        const loadedTasks = rows._array.map((task) => ({
          id: task.id.toString(),
          description: task.description,
          dateTime: task.dateTime,
          completed: !!task.completed,
        }));
        setTasks(loadedTasks);
      });
    });
  };



  // Notificação
  const scheduleHourlyNotification = async (taskDescription) => {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("hourly-reminder", {
      name: "Lembrete de atividades",
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: true, 
    });
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: taskDescription,
      body: "Lembre da sua atividade!",
      sound: true, 
    },
    trigger: {
      seconds: 135 * 135, 
      repeats: true,
    },
    channelId: "hourly-reminder",
  });
};

const requestNotificationPermission = async () => {
  if (Platform.OS === 'android') {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      alert('As notificações estão desabilitadas. Algumas funcionalidades do aplicativo podem não funcionar corretamente.');
      return;
    }
  }
};

  // Função para adicionar uma nova tarefa
  const addTask = async () => {
    if (!taskDescription || !taskDateTime) return;

    const newTask = {
      id: new Date().getTime().toString(),
      description: taskDescription,
      dateTime: taskDateTime,
      completed: false,
    };

    setTasks((prevTasks) => {
      const updatedTasks = [...prevTasks, newTask];
      storeTasks(updatedTasks);
      scheduleReminder(newTask);
      scheduleHourlyNotification(taskDescription);
      return updatedTasks;
    });

    setTaskDescription("");
    setTaskDateTime("");
    Keyboard.dismiss();

     // Agenda a notificação de 1 em 1 hora
  scheduleHourlyNotification();
  };

  // Função para remover uma tarefa
  const removeTask = (taskId) => {
    setTasks((prevTasks) => {
      const updatedTasks = prevTasks.filter((task) => task.id !== taskId);
      storeTasks(updatedTasks);
      return updatedTasks;
    });

    Notifications.cancelScheduledNotificationAsync(taskId);
  };

  // Função para marcar uma tarefa como concluída
  const toggleTaskCompletion = (taskId) => {
    setTasks((prevTasks) => {
      const updatedTasks = prevTasks.map((task) => {
        if (task.id === taskId) {
          task.completed = !task.completed;
        }
        return task;
      });

      storeTasks(updatedTasks);
      return updatedTasks;
    });

    Notifications.cancelScheduledNotificationAsync(taskId);
  };

  // Função para agendar lembretes de tarefas
  const scheduleReminder = async (task) => {
    const taskDateTime = new Date(task.dateTime);
    const oneHourBefore = new Date(taskDateTime.getTime() - 60 * 60 * 1000);
    const tenMinutesBefore = new Date(taskDateTime.getTime() - 10 * 60 * 1000);

    if (oneHourBefore > new Date()) {
      await Notifications.scheduleNotificationAsync({
        identifier: task.id + "-1h",
        content: {
          title: "Lembrete de Tarefa",
          body: `Sua tarefa "${task.description}" começa em 1 hora. Data e hora da tarefa: ${task.dateTime}`,
        },
        trigger: oneHourBefore,
      });
    }

    if (tenMinutesBefore > new Date()) {
      await Notifications.scheduleNotificationAsync({
        identifier: task.id + "-10m",
        content: {
          title: "Lembrete de Tarefa",
          body: `Sua tarefa "${task.description}" começa em 10 minutos. Data e hora da tarefa: ${task.dateTime}`,
        },
        trigger: tenMinutesBefore,
      });
    }
  };

 const styles = StyleSheet.create({
      container: {
        flex: 1,
        backgroundColor: "#fff",
        paddingTop: 85,
      },
      customText: {
        fontSize: 24,
        fontWeight: "bold",
        textAlign: "center",
        paddingLeft: 16,
      },
      headerTitle: {
        flex: 1,
      },
      inputContainer: {
        paddingHorizontal: 30,
        paddingBottom: 20,
        alignItems: "center",
        justifyContent: "center",
        marginTop: 20,
      },
      input: {
        width: "100%",
        height: 60,
        borderWidth: 1,
        borderColor: "black",
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 5,
        marginBottom: 30,
        marginTop: 20,
      },
      taskItem: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: "black",
      },
      completedTask: {
        textDecorationLine: "line-through",
        textDecorationStyle: "solid",
        textDecorationColor: "red",
      },
      addButton: {
        backgroundColor: "#3f51b5",
        width: 300,
        height: 60,
        justifyContent: "center",
        borderRadius: 20,
      },
      addButtonText: {
        textAlign: "center",
        color: "#fff",
      },
      removeButton: {
        backgroundColor: "#f44336",
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 20,
      },
      removeButtonText: {
        color: "#fff",
      },
      header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 15,
      },
      centeredView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 22,
  },
  modalView: {
    margin: 20,
    backgroundColor: "white",
    borderRadius: 20,
    padding: 35,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalText: {
    marginBottom: 15,
    textAlign: "center",
    fontSize: 20,
    fontWeight: "bold",
    width:100,
    height:100,
  },
    modalButtonsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    marginTop: 20,
  },
  button: {
    borderRadius: 20,
    padding: 10,
    paddingHorizontal: 20,
    elevation: 2,
    backgroundColor:'#FFB266',
  },
  textStyle: {
    color: "black",
    fontWeight: "bold",
    textAlign: "center",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
  },
});
 return (
  <Provider>
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTitle}>
          <Text style={styles.customText}>Minhas Tarefas</Text>
        </View>
        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={
            <IconButton
              icon="dots-vertical"
              size={24}
              onPress={() => setMenuVisible(true)}
            />
          }
        >
          <Menu.Item
            onPress={() => {
              setContactModalVisible(true);
              setMenuVisible(false);
            }}
            title="Sugestões"
          />
        </Menu>
      </View>
      

      <View style={styles.inputContainer}>
        <TextInput
        multiline={true}
        numberOfLines={4}
          style={styles.input}
          placeholder="Descrição da tarefa"
          onChangeText={setTaskDescription}
          value={taskDescription}
        />
        <TextInput
         multiline={true}
          numberOfLines={4}
          style={styles.input}
          placeholder="Data e hora (Ex:20/05 as 13:00)"
          onChangeText={setTaskDateTime}
          value={taskDateTime}
        />
        <TouchableOpacity style={styles.addButton} onPress={addTask}>
          <Text style={styles.addButtonText}>Adicionar Tarefa</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={tasks}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.taskItem}>
            <Text
              style={item.completed ? styles.completedTask : null}
              onPress={() => toggleTaskCompletion(item.id)}
            >
              {item.description} ({item.dateTime})
            </Text>
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => removeTask(item.id)}
            >
              <Text style={styles.removeButtonText}>Remover</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
     <View>
      <Modal
        animationType="slide"
        transparent={true}
        visible={contactModalVisible}
        onRequestClose={() => {
          setContactModalVisible(!contactModalVisible);
        }}
      >
        <View style={styles.centeredView}>
          <View style={styles.modalView}>
            <Text style={styles.modalTitle}>Formulário de Contato</Text>
            <TextInput
              style={styles.input}
              placeholder="Nome"
              onChangeText={setName}
              value={name}
            />
            <TextInput
              style={styles.input}
              placeholder="Mensagem"
              onChangeText={setMessage}
              value={message}
              multiline={true}
              numberOfLines={4}
            />
            <View style={styles.modalButtonsContainer}>
             <TouchableOpacity
  style={styles.button}
  onPress={() => sendEmail()}
>
  <Text style={styles.textStyle}>Enviar</Text>
</TouchableOpacity>
              <TouchableOpacity
                style={styles.button}
                onPress={() => setContactModalVisible(false)}
              >
                <Text style={styles.textStyle}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  </Provider>
);
}