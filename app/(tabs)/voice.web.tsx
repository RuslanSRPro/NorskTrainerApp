import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export default function WindowsVoiceScreen() {
  const [message, setMessage] =
    useState(
      'Windows audio backend is ready to be connected.'
    );

  return (
    <ScrollView
      contentContainerStyle={styles.page}
    >
      <View style={styles.header}>
        <Text style={styles.title}>
          🎙 Audio
        </Text>

        <Text style={styles.badge}>
          Windows
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>
          Lecture recording
        </Text>

        <Text style={styles.description}>
          Recording, Live transcription and offline translation
          will use the native Windows backend instead of the
          iOS Expo modules.
        </Text>

        <View style={styles.actions}>
          <Pressable
            style={styles.primaryButton}
            onPress={() =>
              setMessage(
                'Recording backend is the next Windows step.'
              )
            }
          >
            <Text style={styles.primaryText}>
              Start recording
            </Text>
          </Pressable>

          <Pressable
            style={styles.secondaryButton}
            onPress={() =>
              setMessage(
                'Live transcription backend is the next Windows step.'
              )
            }
          >
            <Text style={styles.secondaryText}>
              ● Live
            </Text>
          </Pressable>
        </View>

        <Text style={styles.status}>
          {message}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flexGrow: 1,
    padding: 28,
    paddingBottom: 130,
    backgroundColor: '#f7fbff',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },

  title: {
    fontSize: 34,
    fontWeight: '900',
    color: '#101014',
  },

  badge: {
    fontSize: 15,
    fontWeight: '800',
    color: '#147cff',
  },

  card: {
    padding: 28,
    borderRadius: 34,
    backgroundColor: '#ffffff',
  },

  heading: {
    fontSize: 25,
    fontWeight: '900',
    marginBottom: 14,
    color: '#101014',
  },

  description: {
    fontSize: 18,
    lineHeight: 29,
    color: '#51515a',
  },

  actions: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 30,
  },

  primaryButton: {
    flex: 1,
    minHeight: 76,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 26,
    backgroundColor: '#087cff',
  },

  secondaryButton: {
    flex: 1,
    minHeight: 76,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 26,
    borderWidth: 2,
    borderColor: '#087cff',
    backgroundColor: '#ffffff',
  },

  primaryText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#ffffff',
  },

  secondaryText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#087cff',
  },

  status: {
    marginTop: 24,
    fontSize: 16,
    lineHeight: 24,
    color: '#65656d',
  },
});