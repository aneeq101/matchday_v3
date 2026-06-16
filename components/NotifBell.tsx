import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../lib/AuthContext';
import { countUnread } from '../lib/notifications';

interface Props {
  color?: string;
  size?: number;
}

export default function NotifBell({ color = '#fff', size = 24 }: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      countUnread(user.id).then(setUnread).catch(() => {});
    }, [user?.id])
  );

  return (
    <TouchableOpacity style={styles.btn} onPress={() => router.push('/notifications')}>
      <Ionicons name="notifications-outline" size={size} color={color} />
      {unread > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: { position: 'relative', padding: 2 },
  badge: {
    position: 'absolute', top: -2, right: -4,
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: '#ef4444',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700', lineHeight: 13 },
});
