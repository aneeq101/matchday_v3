import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../lib/AuthContext';
import { fetchComments, addComment, deleteComment, type Comment } from '../lib/comments';

export default function CommentsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ postId: string; postAuthor: string }>();
  const postId = params.postId ?? '';
  const postAuthor = params.postAuthor ?? 'Post';

  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchComments(postId, user?.id ?? '');
    setComments(data);
    setLoading(false);
  }, [postId, user?.id]);

  useEffect(() => { load(); }, [load]);

  const send = async () => {
    const text = inputText.trim();
    if (!text || !postId) return;
    setInputText('');
    setSending(true);

    const userName = user?.user_metadata?.full_name ?? user?.email?.split('@')[0] ?? 'Player';
    const userInitials = userName.slice(0, 2).toUpperCase();
    const userAvatarUrl = user?.user_metadata?.avatar_url ?? undefined;

    const optimistic: Comment = {
      id: `opt-${Date.now()}`,
      postId,
      authorId: user?.id ?? null,
      authorName: userName,
      authorInitials: userInitials,
      authorAvatarColor: '#16a34a',
      authorAvatarUrl: userAvatarUrl,
      text,
      time: 'Just now',
      isOwn: true,
    };
    setComments((prev) => [...prev, optimistic]);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);

    const saved = await addComment({
      postId,
      userId: user?.id ?? null,
      userName,
      userInitials,
      userColor: '#16a34a',
      userAvatarUrl,
      text,
    });
    if (saved) {
      setComments((prev) => prev.map((c) => (c.id === optimistic.id ? saved : c)));
    }
    setSending(false);
  };

  const confirmDelete = (commentId: string) => {
    Alert.alert('Delete comment', 'Remove this comment?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setComments((prev) => prev.filter((c) => c.id !== commentId));
          await deleteComment(commentId);
        },
      },
    ]);
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#16a34a" />
      <SafeAreaView style={styles.header} edges={['top']}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Comments</Text>
          <Text style={styles.headerSub}>{postAuthor}'s post</Text>
        </View>
        <Text style={styles.commentCount}>{comments.length}</Text>
      </SafeAreaView>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#16a34a" />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={comments}
            keyExtractor={(item) => item.id}
            contentContainerStyle={comments.length === 0 ? styles.emptyContainer : styles.list}
            onLayout={() => comments.length > 0 && listRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <View style={styles.center}>
                <Ionicons name="chatbubble-outline" size={52} color="#d1d5db" />
                <Text style={styles.emptyTitle}>No comments yet</Text>
                <Text style={styles.emptySub}>Be the first to comment</Text>
              </View>
            }
            renderItem={({ item }) => (
              <CommentBubble
                comment={item}
                onDelete={item.isOwn ? () => confirmDelete(item.id) : undefined}
              />
            )}
          />
        )}

        <SafeAreaView style={styles.inputBar} edges={['bottom']}>
          <TextInput
            style={styles.input}
            placeholder="Write a comment..."
            placeholderTextColor="#9ca3af"
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendBtn, inputText.trim() && styles.sendBtnActive]}
            onPress={send}
            disabled={!inputText.trim() || sending}
          >
            {sending
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="send" size={18} color={inputText.trim() ? '#fff' : '#9ca3af'} />}
          </TouchableOpacity>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}

function CommentBubble({
  comment,
  onDelete,
}: {
  comment: Comment;
  onDelete?: () => void;
}) {
  return (
    <View style={styles.commentRow}>
      {comment.authorAvatarUrl ? (
        <Image source={{ uri: comment.authorAvatarUrl }} style={styles.commentAvatar} />
      ) : (
        <View style={[styles.commentAvatar, { backgroundColor: comment.authorAvatarColor, alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={styles.commentAvatarText}>{comment.authorInitials}</Text>
        </View>
      )}
      <View style={styles.commentBody}>
        <View style={styles.commentBubble}>
          <Text style={styles.commentAuthor}>{comment.authorName}</Text>
          <Text style={styles.commentText}>{comment.text}</Text>
        </View>
        <View style={styles.commentMeta}>
          <Text style={styles.commentTime}>{comment.time}</Text>
          {onDelete && (
            <TouchableOpacity onPress={onDelete}>
              <Text style={styles.deleteText}>Delete</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f3f4f6' },
  header: {
    backgroundColor: '#16a34a',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: Platform.OS === 'android' ? 8 : 4,
    paddingBottom: 12,
    gap: 10,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  headerSub: { color: 'rgba(255,255,255,0.75)', fontSize: 12 },
  commentCount: { color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyContainer: { flex: 1 },
  list: { padding: 12, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#374151' },
  emptySub: { color: '#9ca3af', fontSize: 14 },
  commentRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  commentAvatar: { width: 36, height: 36, borderRadius: 18, flexShrink: 0 },
  commentAvatarText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  commentBody: { flex: 1 },
  commentBubble: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderTopLeftRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 9,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  commentAuthor: { fontWeight: '700', color: '#111827', fontSize: 13, marginBottom: 3 },
  commentText: { color: '#374151', fontSize: 14, lineHeight: 20 },
  commentMeta: { flexDirection: 'row', gap: 12, marginTop: 4, paddingLeft: 4 },
  commentTime: { color: '#9ca3af', fontSize: 11 },
  deleteText: { color: '#ef4444', fontSize: 11, fontWeight: '600' },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  input: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
    maxHeight: 100,
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
  sendBtnActive: { backgroundColor: '#16a34a' },
});
