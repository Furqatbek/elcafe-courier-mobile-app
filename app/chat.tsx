import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Send,
  Phone,
  MoreVertical,
  Image as ImageIcon,
  MapPin,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { formatTime } from '@/lib/formatting';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'other';
  timestamp: Date;
  status?: 'sent' | 'delivered' | 'read';
}

interface QuickReply {
  id: string;
  text: string;
}

export default function ChatScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { type, orderId, customerName } = useLocalSearchParams<{
    type?: string;
    orderId?: string;
    customerName?: string;
  }>();

  const scrollViewRef = useRef<ScrollView>(null);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: type === 'support'
        ? t('chat.support_greeting')
        : t('chat.customer_greeting', { name: customerName || 'Customer' }),
      sender: 'other',
      timestamp: new Date(Date.now() - 60000),
    },
  ]);

  const quickReplies: QuickReply[] = type === 'support'
    ? [
        { id: '1', text: t('chat.quick.need_help') },
        { id: '2', text: t('chat.quick.order_issue') },
        { id: '3', text: t('chat.quick.app_problem') },
        { id: '4', text: t('chat.quick.payment_issue') },
      ]
    : [
        { id: '1', text: t('chat.quick.on_my_way') },
        { id: '2', text: t('chat.quick.arriving_soon') },
        { id: '3', text: t('chat.quick.at_location') },
        { id: '4', text: t('chat.quick.cant_find') },
      ];

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  };

  const sendMessage = (text: string) => {
    if (!text.trim()) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      text: text.trim(),
      sender: 'user',
      timestamp: new Date(),
      status: 'sent',
    };

    setMessages(prev => [...prev, newMessage]);
    setMessage('');

    // Simulate response
    setTimeout(() => {
      const response: Message = {
        id: (Date.now() + 1).toString(),
        text: type === 'support'
          ? t('chat.support_response')
          : t('chat.customer_response'),
        sender: 'other',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, response]);
    }, 1500);
  };

  const handleQuickReply = (reply: QuickReply) => {
    sendMessage(reply.text);
  };

  const getChatTitle = () => {
    if (type === 'support') {
      return t('chat.support_title');
    }
    return customerName || t('chat.customer');
  };

  const getChatSubtitle = () => {
    if (type === 'support') {
      return t('chat.support_subtitle');
    }
    return orderId ? `${t('chat.order')} #${orderId}` : '';
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={Colors.text} />
        </TouchableOpacity>

        <View style={styles.headerInfo}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {type === 'support' ? 'S' : (customerName?.charAt(0) || 'C')}
            </Text>
            <View style={styles.onlineIndicator} />
          </View>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>{getChatTitle()}</Text>
            <Text style={styles.headerSubtitle}>{getChatSubtitle()}</Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          {type !== 'support' && (
            <TouchableOpacity style={styles.headerButton}>
              <Phone size={20} color={Colors.text} />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.headerButton}>
            <MoreVertical size={20} color={Colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Messages */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.map((msg, index) => {
            const isUser = msg.sender === 'user';
            const showTimestamp =
              index === 0 ||
              messages[index - 1].sender !== msg.sender ||
              msg.timestamp.getTime() - messages[index - 1].timestamp.getTime() > 300000;

            return (
              <View key={msg.id}>
                {showTimestamp && (
                  <Text style={styles.timestamp}>{formatTime(msg.timestamp)}</Text>
                )}
                <View
                  style={[
                    styles.messageBubble,
                    isUser ? styles.userBubble : styles.otherBubble,
                  ]}
                >
                  <Text style={[styles.messageText, isUser && styles.userMessageText]}>
                    {msg.text}
                  </Text>
                </View>
              </View>
            );
          })}
        </ScrollView>

        {/* Quick Replies */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickRepliesContainer}
        >
          {quickReplies.map(reply => (
            <TouchableOpacity
              key={reply.id}
              style={styles.quickReply}
              onPress={() => handleQuickReply(reply)}
            >
              <Text style={styles.quickReplyText}>{reply.text}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Input */}
        <View style={styles.inputContainer}>
          <TouchableOpacity style={styles.attachButton}>
            <ImageIcon size={24} color={Colors.textSecondary} />
          </TouchableOpacity>

          {type !== 'support' && (
            <TouchableOpacity style={styles.attachButton}>
              <MapPin size={24} color={Colors.textSecondary} />
            </TouchableOpacity>
          )}

          <TextInput
            style={styles.input}
            placeholder={t('chat.type_message')}
            placeholderTextColor={Colors.textLight}
            value={message}
            onChangeText={setMessage}
            multiline
            maxLength={500}
          />

          <TouchableOpacity
            style={[
              styles.sendButton,
              message.trim() && styles.sendButtonActive,
            ]}
            onPress={() => sendMessage(message)}
            disabled={!message.trim()}
          >
            <Send size={20} color={message.trim() ? Colors.surface : Colors.textLight} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.surface,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.online,
    borderWidth: 2,
    borderColor: Colors.surface,
  },
  headerTextContainer: {
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  headerSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyboardView: {
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
  },
  timestamp: {
    textAlign: 'center',
    fontSize: 12,
    color: Colors.textLight,
    marginVertical: 16,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.surface,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    color: Colors.text,
    lineHeight: 22,
  },
  userMessageText: {
    color: Colors.surface,
  },
  quickRepliesContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  quickReply: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.primary,
    marginRight: 8,
  },
  quickReplyText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    paddingBottom: 16,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 8,
  },
  attachButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: Colors.background,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.text,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonActive: {
    backgroundColor: Colors.primary,
  },
});
