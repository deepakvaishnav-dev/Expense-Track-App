import React, { useState, useRef } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { api } from '../services/api';
import * as ImagePicker from 'expo-image-picker';
import { showCustomAlert } from '../store/alertStore';
import { Svg, Path, Circle } from 'react-native-svg';

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  imageUri?: string;
}

export const AIAssistantChatScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'ai',
      text: "Hello! I am your Gemini AI financial companion. Ask me anything about your spending, trends, or attach a receipt image for instant analysis!"
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  const handleAttachPress = () => {
    showCustomAlert(
      'Attach Receipt or Image',
      'Choose how you want to upload your receipt for AI analysis (up to 20 MB):',
      'info',
      [
        {
          text: '📷 Take Photo',
          onPress: handleLaunchCamera,
        },
        {
          text: '🖼️ Choose Gallery',
          onPress: handleLaunchGallery,
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const handleLaunchCamera = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        showCustomAlert('Permission Denied', 'Camera permission is required to snap receipt photos.', 'warning');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.9,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setAttachedImage(result.assets[0].uri);
      }
    } catch (e) {
      console.warn('Camera launch error:', e);
      showCustomAlert('Error', 'Failed to open camera.', 'error');
    }
  };

  const handleLaunchGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showCustomAlert('Permission Denied', 'Media library permission is required to upload receipt photos.', 'warning');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        quality: 0.9,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setAttachedImage(result.assets[0].uri);
      }
    } catch (e) {
      console.warn('Gallery launch error:', e);
      showCustomAlert('Error', 'Failed to open photo library.', 'error');
    }
  };

  const sendMessage = async (textToSend: string) => {
    const text = textToSend.trim();
    const currentAttachment = attachedImage;
    if (!text && !currentAttachment) return;

    setInputText('');
    setAttachedImage(null);
    const userMsgId = Date.now().toString();

    setMessages((prev) => [
      ...prev,
      {
        id: userMsgId,
        sender: 'user',
        text: text || (currentAttachment ? 'Analyze this receipt image' : ''),
        imageUri: currentAttachment || undefined,
      }
    ]);

    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    setLoading(true);

    try {
      if (currentAttachment) {
        // Upload image to OCR backend
        const uri = currentAttachment;
        const filename = uri.split('/').pop() || 'receipt.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const mimeType = match ? `image/${match[1]}` : `image/jpeg`;

        const formData = new FormData();
        formData.append('file', {
          uri,
          name: filename,
          type: mimeType,
        } as any);

        const ocrRes = await api.post('/ai/scan-receipt', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        const txn = ocrRes.data;
        const merchant = txn.merchant || 'Unknown Merchant';
        const amount = txn.amount ? `₹${parseFloat(txn.amount).toLocaleString()}` : 'N/A';
        const method = txn.payment_method || 'UPI';
        const type = txn.type || 'Expense';

        const aiResponseText = `I analyzed your receipt with Gemini OCR! 🧾\n\n` +
          `• Merchant: ${merchant}\n` +
          `• Amount: ${amount}\n` +
          `• Payment: ${method}\n` +
          `• Type: ${type}\n\n` +
          `✅ This transaction has been automatically categorized and saved to your accounts!`;

        setMessages((prev) => [
          ...prev,
          { id: (Date.now() + 1).toString(), sender: 'ai', text: aiResponseText }
        ]);
      } else {
        const response = await api.post('/ai/chat', { message: text });
        const aiReply = response.data.response;

        setMessages((prev) => [
          ...prev,
          { id: (Date.now() + 1).toString(), sender: 'ai', text: aiReply }
        ]);
      }
    } catch (e: any) {
      console.warn(e);
      const errMsg = e.response?.data?.detail || "Sorry, I'm having trouble analyzing this right now. Please verify backend is active.";
      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), sender: 'ai', text: errMsg }
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const suggestions = [
    "Show coffee vs tea spend.",
    "What was my budget balance?",
    "Summarize my June expenses."
  ];

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-white"
    >
      <View className="flex-1 bg-white p-6 justify-between">
        {/* Header */}
        <View className="flex-row items-center justify-between mt-6 mb-4">
          <View className="flex-row items-center">
            <TouchableOpacity onPress={() => navigation.pop()} className="mr-4">
              <Text className="text-gray-900 text-2xl font-bold">←</Text>
            </TouchableOpacity>
            <Text className="text-gray-900 text-2xl font-black">AI Assistant Chat</Text>
          </View>
          <View className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center">
            <Text className="text-lg">✨</Text>
          </View>
        </View>

        {/* Messages list */}
        <ScrollView
          ref={scrollViewRef}
          className="flex-1 pr-1"
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.map((msg) => {
            const isUser = msg.sender === 'user';
            return (
              <View
                key={msg.id}
                className={`mb-4 flex-row ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <View className="w-8 h-8 rounded-full bg-blue-100 items-center justify-center mr-2 self-end mb-1">
                    <Text className="text-xs">🤖</Text>
                  </View>
                )}

                <View className="max-w-[80%]">
                  {!isUser && (
                    <Text className="text-[10px] text-gray-400 font-bold mb-1 ml-1">AI Assistant Gemini</Text>
                  )}
                  <View
                    className={`p-4 rounded-3xl ${
                      isUser
                        ? 'bg-blue-600 rounded-tr-none'
                        : 'bg-gray-100 border border-gray-150 rounded-tl-none'
                    }`}
                  >
                    {msg.imageUri && (
                      <Image
                        source={{ uri: msg.imageUri }}
                        className="w-48 h-36 rounded-2xl mb-2 bg-gray-200"
                        resizeMode="cover"
                      />
                    )}
                    <Text
                      className={`text-sm leading-5 font-semibold ${
                        isUser ? 'text-white' : 'text-gray-800'
                      }`}
                    >
                      {msg.text}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}
          {loading && (
            <View className="mb-4 flex-row justify-start items-center">
              <View className="w-8 h-8 rounded-full bg-blue-100 items-center justify-center mr-2">
                <Text className="text-xs">🤖</Text>
              </View>
              <View className="bg-gray-100 border border-gray-150 p-4 rounded-3xl rounded-tl-none">
                <ActivityIndicator size="small" color="#3b82f6" />
              </View>
            </View>
          )}
        </ScrollView>

        {/* Bottom Panel */}
        <View className="mt-2">
          {/* Attached image preview banner */}
          {attachedImage && (
            <View className="flex-row items-center bg-blue-50 border border-blue-200 px-3 py-2 rounded-2xl mb-2">
              <Image
                source={{ uri: attachedImage }}
                className="w-12 h-12 rounded-xl bg-gray-200 mr-3"
                resizeMode="cover"
              />
              <View className="flex-1">
                <Text className="text-xs font-bold text-blue-900">Receipt image attached</Text>
                <Text className="text-[11px] text-blue-600 font-medium">Ready for Gemini AI scan</Text>
              </View>
              <TouchableOpacity
                onPress={() => setAttachedImage(null)}
                className="w-7 h-7 rounded-full bg-blue-200 items-center justify-center ml-2"
              >
                <Text className="text-xs font-bold text-blue-800">✕</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Suggestions chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="flex-row py-2 mb-2"
          >
            {suggestions.map((s, idx) => (
              <TouchableOpacity
                key={idx}
                onPress={() => sendMessage(s)}
                className="bg-gray-50 border border-gray-200 px-4 py-2 rounded-full mr-2"
              >
                <Text className="text-xs font-bold text-gray-600">{s}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Chat input bar */}
          <View className="flex-row items-center bg-gray-100 px-4 py-3 rounded-2xl">
            {/* Paperclip attach icon */}
            <TouchableOpacity className="p-1 mr-2" onPress={handleAttachPress}>
              <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={attachedImage ? "#2563eb" : "#9ca3af"} strokeWidth="2.5">
                <Path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636l-3.536 3.536m0 0l-3.536 3.536m3.536-3.536L13.5 13.5m-6-6l8.485 8.485M7.5 10.5h.008v.008H7.5V10.5zm0 3h.008v.008H7.5v-.008zm0 3h.008v.008H7.5v-.008z" />
                <Path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a3 3 0 104.243 4.243l7.07-7.071a5 5 0 00-7.07-7.07L6.242 10.28a7 7 0 009.9 9.9l3.889-3.889" />
              </Svg>
            </TouchableOpacity>

            <TextInput
              placeholder="Ask a question about your spending..."
              placeholderTextColor="#9ca3af"
              value={inputText}
              onChangeText={setInputText}
              className="flex-1 text-gray-900 text-sm p-0"
              onSubmitEditing={() => sendMessage(inputText)}
            />

            {/* Send button */}
            <TouchableOpacity
              onPress={() => sendMessage(inputText)}
              className="w-8 h-8 rounded-full bg-blue-600 items-center justify-center ml-2"
            >
              <Svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3">
                <Path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </Svg>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};
