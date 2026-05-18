import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { CHAT_MESSAGES, type Message } from '../data/mockData';

export default function ChatScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; name: string; initials: string; color: string }>();
  const conversationId = params.id ?? '1';
  const playerName = params.name ?? 'Player';
  const initials = params.initials ?? '??';
  const avatarColor = params.color ?? '#16a34a';

  const [messages, setMessages] = useState<Message[]>(
    CHAT_MESSAGES[conversationId] ?? []
  );
  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList>(null);

  const sendMessage = () => {
    const text = inputText.trim();
    if (!text) return;
    const newMsg: Message = {
      id: String(Date.now()),
      conversationId,
      text,
      sent: true,
      time: 'Now',
    };
    setMessages((prev) => [...prev, newMsg]);
    setInputText('');
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#16a34a" />
      <SafeAreaView style={styles.safeHeader}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={[styles.headerAvatar, { backgroundColor: avatarColor }]}>
            <Text style={styles.headerAvatarText}>{initials}</Text>
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.headerName}>{playerName}</Text>
            <View style={styles.onlineRow}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineText}>Online</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.headerAction}>
            <Ionicons name="ellipsis-vertical" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messageList}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item, index }) => {
          const showTime =
            index === 0 || messages[index - 1]?.sent !== item.sent;
          return <MessageBubble message={item} showTime={showTime} />;
        }}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <SafeAreaView style={styles.inputSafe}>
          <View style={styles.inputRow}>
            <TouchableOpacity style={styles.attachBtn}>
              <Ionicons name="attach" size={22} color="#9ca3af" />
            </TouchableOpacity>
            <TextInput
              style={styles.input}
              placeholder="Type a message..."
              placeholderTextColor="#9ca3af"
              value={inputText}
              onChangeText={setInputText}
              multiline
              onSubmitEditing={sendMessage}
              returnKeyType="send"
            />
            <TouchableOpacity
              style={[styles.sendBtn, inputText.trim() && styles.sendBtnActive]}
              onPress={sendMessage}
              disabled={!inputText.trim()}
            >
              <Ionicons
                name="send"
                size={18}
                color={inputText.trim() ? '#fff' : '#9ca3af'}
              />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}

function MessageBubble({ message, showTime }: { message: Message; showTime: boolean }) {
  return (
    <View style={[styles.bubbleWrapper, message.sent ? styles.bubbleRight : styles.bubbleLeft]}>
      <View style={[styles.bubble, message.sent ? styles.bubbleSent : styles.bubbleReceived]}>
        <Text style={[styles.bubbleText, message.sent ? styles.bubbleTextSent : styles.bubbleTextReceived]}>
          {message.text}
        </Text>
      </View>
      <Text style={[styles.bubbleTime, message.sent ? styles.bubbleTimeRight : styles.bubbleTimeLeft]}>
        {message.time}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f3f4f6' },
  safeHeader: { backgroundColor: '#16a34a' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: Platform.OS === 'android' ? 8 : 4,
    paddingBottom: 12,
    gap: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  headerAvatarText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  headerInfo: { flex: 1 },
  headerName: { color: '#fff', fontWeight: '700', fontSize: 16 },
  onlineRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#86efac' },
  onlineText: { color: 'rgba(255,255,255,0.8)', fontSize: 12 },
  headerAction: { padding: 4 },
  messageList: { padding: 12, gap: 4, paddingBottom: 8 },
  bubbleWrapper: { marginBottom: 6 },
  bubbleLeft: { alignItems: 'flex-start' },
  bubbleRight: { alignItems: 'flex-end' },
  bubble: {
    maxWidth: '75%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  bubbleSent: {
    backgroundColor: '#16a34a',
    borderBottomRightRadius: 4,
  },
  bubbleReceived: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  bubbleText: { fontSize: 15, lineHeight: 22 },
  bubbleTextSent: { color: '#fff' },
  bubbleTextReceived: { color: '#111827' },
  bubbleTime: { fontSize: 11, color: '#9ca3af', marginTop: 3 },
  bubbleTimeRight: { textAlign: 'right' },
  bubbleTimeLeft: { textAlign: 'left', marginLeft: 4 },
  inputSafe: { backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  attachBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111827',
    maxHeight: 120,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnActive: {
    backgroundColor: '#16a34a',
  },
});
