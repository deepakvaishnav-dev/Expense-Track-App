import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Image, Dimensions } from 'react-native';
import { api } from '../services/api';
import * as ImagePicker from 'expo-image-picker';
import { showCustomAlert } from '../store/alertStore';

const { width } = Dimensions.get('window');

export const ScanReceiptScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [uploading, setUploading] = useState(false);
  const [progressStep, setProgressStep] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Trigger camera access prompt when entering the scanning screen
  useEffect(() => {
    openCamera();
  }, []);

  const openGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showCustomAlert('Permission Denied', 'Permission to access media library is required to upload receipts.', 'warning');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedImage(result.assets[0].uri);
      }
    } catch (e: any) {
      console.warn(e);
      showCustomAlert('Error', 'Failed to open image library.', 'error');
    }
  };

  const openCamera = async () => {
    showCustomAlert(
      'Camera Access Required',
      'Would you like to open the camera to scan your receipt?',
      'info',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Allow',
          onPress: async () => {
            try {
              const { status } = await ImagePicker.requestCameraPermissionsAsync();
              if (status !== 'granted') {
                showCustomAlert('Permission Denied', 'Permission to access camera is required to scan receipts.', 'warning');
                return;
              }

              const result = await ImagePicker.launchCameraAsync({
                mediaTypes: 'images',
                allowsEditing: true,
                quality: 1,
              });

              if (!result.canceled && result.assets && result.assets.length > 0) {
                setSelectedImage(result.assets[0].uri);
              }
            } catch (e: any) {
              console.warn(e);
              showCustomAlert('Error', 'Failed to open camera.', 'error');
            }
          },
        },
      ]
    );
  };

  const uploadReceipt = async () => {
    if (!selectedImage) {
      showCustomAlert('Capture Required', 'Please snap or select a receipt image first.', 'warning');
      return;
    }

    setUploading(true);
    setProgressStep('Uploading receipt image...');

    try {
      const uri = selectedImage;
      const filename = uri.split('/').pop() || 'receipt.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : `image/jpeg`;

      const formData = new FormData();
      formData.append('file', {
        uri,
        name: filename,
        type,
      } as any);

      setProgressStep('AI OCR extracting details...');
      const response = await api.post('/ai/scan-receipt', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const transaction = response.data;

      setProgressStep('Categorizing and updating account balances...');
      await new Promise<void>((resolve) => setTimeout(() => resolve(), 800));

      showCustomAlert(
        'OCR Scan Completed',
        `AI successfully extracted:\nMerchant: ${transaction.merchant || 'Unknown'}\nAmount: ₹${transaction.amount}`,
        'success',
        [
          {
            text: 'View Dashboard',
            onPress: () => {
              navigation.pop();
            },
          },
        ]
      );
    } catch (e: any) {
      console.warn(e);
      const errorMsg = e.response?.data?.detail || e.message || 'Unknown error occurred.';
      showCustomAlert('Scan Failed', `Failed to read receipt data: ${errorMsg}. Please log manually.`, 'error');
    } finally {
      setUploading(false);
      setProgressStep('');
    }
  };

  return (
    <View className="flex-1 bg-black justify-between p-6">
      {/* Top bar Actions */}
      <View className="flex-row justify-between items-center mt-6">
        <TouchableOpacity 
          onPress={() => showCustomAlert('Flash Mode', 'Flashlight toggle switched.', 'info')}
          className="flex-row items-center"
        >
          <Text className="text-white text-base font-bold">⚡ Flash</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={openGallery}
          className="flex-row items-center"
        >
          <Text className="text-white text-base font-bold">🖼️ Gallery</Text>
        </TouchableOpacity>
      </View>

      {/* Viewfinder scanner mockup */}
      <View className="items-center my-4">
        {selectedImage ? (
          <View className="w-full aspect-[3/4] max-h-[400px] border-2 border-blue-500 rounded-3xl overflow-hidden relative shadow-lg">
            <Image
              source={{ uri: selectedImage }}
              className="w-full h-full"
              resizeMode="cover"
            />
            {uploading && (
              <View className="absolute inset-0 bg-black/75 items-center justify-center p-6">
                <ActivityIndicator size="large" color="#3b82f6" className="mb-4" />
                <Text className="text-blue-400 font-bold text-center text-sm">{progressStep}</Text>
              </View>
            )}
            {!uploading && (
              <View className="absolute bottom-4 right-4 bg-black/60 px-3 py-1.5 rounded-full">
                <TouchableOpacity onPress={() => setSelectedImage(null)}>
                  <Text className="text-white font-bold text-xs">Retake ✕</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ) : (
          <TouchableOpacity 
            onPress={openCamera}
            className="w-full aspect-[3/4] max-h-[400px] bg-neutral-900 border border-neutral-800 rounded-3xl items-center justify-center relative overflow-hidden"
          >
            {/* Outline Receipt Scanner Frame */}
            <View className="w-[80%] h-[75%] border-2 border-dashed border-gray-600 rounded-2xl items-center justify-center p-6 bg-neutral-950/40">
              <Text className="text-white font-black text-lg tracking-widest uppercase mb-1">RECEIPT RECEIPT</Text>
              <Text className="text-gray-600 text-[10px] text-center mb-6">Total: Rs. 32.30 • Starbucks</Text>
              
              {/* Hold Steady text */}
              <View className="bg-black/60 border border-white/20 py-2.5 px-4 rounded-xl shadow-md">
                <Text className="text-white font-black text-sm tracking-wide">Hold Steady,</Text>
                <Text className="text-gray-300 text-xs text-center mt-0.5">Scanning...</Text>
              </View>
            </View>
            
            {/* Visual bottom scanner banner */}
            <View className="absolute bottom-4 left-4 flex-row items-center">
              <View className="w-2 h-2 rounded-full bg-red-500 mr-2 animate-ping" />
              <Text className="text-gray-500 text-xs font-bold uppercase tracking-wider">Detecting Receipt Borders</Text>
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* Capture and manual entry actions */}
      <View className="items-center mb-6">
        {selectedImage ? (
          <TouchableOpacity
            onPress={uploadReceipt}
            disabled={uploading}
            className="w-full bg-blue-600 py-4 rounded-3xl items-center justify-center shadow-lg"
          >
            <Text className="text-white font-extrabold text-base tracking-wider">EXTRACT DETAILS VIA AI</Text>
          </TouchableOpacity>
        ) : (
          /* Shutter Circle Button */
          <TouchableOpacity
            onPress={openCamera}
            className="w-20 h-20 rounded-full border-4 border-neutral-700 bg-white items-center justify-center shadow-lg mb-6"
          >
            <View className="w-14 h-14 rounded-full bg-white border border-neutral-200" />
          </TouchableOpacity>
        )}

        {/* Link back to manual entry */}
        <TouchableOpacity 
          onPress={() => navigation.navigate('AddTransaction')}
          className="mt-3"
        >
          <Text className="text-gray-400 font-bold text-sm tracking-wide">Manual Entry</Text>
        </TouchableOpacity>

        {/* Details Caption */}
        <View className="mt-6 items-center px-6">
          <Text className="text-gray-600 text-xs font-bold text-center">
            Hold Expense / Scan Receipt
          </Text>
          <Text className="text-gray-500 text-[10px] text-center mt-0.5">
            Detecting Merchant, Amount, Date...
          </Text>
        </View>
      </View>
    </View>
  );
};
